-- RedemptionMart V1: Reviews, disputes, order timestamps, payout fields (spec Sections 5, 11, 12, 9)

-- ---------------------------------------------------------------------------
-- Order tracking timestamps (auto-cancel after 120h in shipped/ready_for_pickup)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payout_reference text;

-- Record when seller marks shipped / ready for pickup (spec Section 9 step 6 timer)
CREATE OR REPLACE FUNCTION public.track_order_fulfillment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('shipped', 'ready_for_pickup')
     AND OLD.status = 'confirmed'
     AND NEW.fulfilled_at IS NULL THEN
    NEW.fulfilled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_track_fulfillment ON public.orders;
CREATE TRIGGER orders_track_fulfillment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_order_fulfillment();

-- ---------------------------------------------------------------------------
-- Reviews (spec Section 11)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE RESTRICT,
  buyer_id   uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  seller_id  uuid NOT NULL REFERENCES public.seller_profiles (id) ON DELETE RESTRICT,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  flagged    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_seller_id_idx ON public.reviews (seller_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read reviews" ON public.reviews;
CREATE POLICY "Anyone authenticated can read reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Buyers can submit own review" ON public.reviews;
CREATE POLICY "Buyers can submit own review"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers can flag own review comment" ON public.reviews;
CREATE POLICY "Buyers can flag abusive reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_review(
  p_order_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_review_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND buyer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'You can only review completed orders';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  INSERT INTO public.reviews (order_id, buyer_id, seller_id, rating, comment)
  VALUES (p_order_id, v_order.buyer_id, v_order.seller_id, p_rating, NULLIF(trim(p_comment), ''))
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Disputes (spec Section 12)
-- ---------------------------------------------------------------------------
CREATE TYPE public.dispute_status AS ENUM ('open', 'resolved');

CREATE TYPE public.dispute_resolution AS ENUM (
  'refund_full',
  'refund_partial',
  'released_to_seller'
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE RESTRICT,
  buyer_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  buyer_message text NOT NULL,
  admin_notes   text,
  resolution    public.dispute_resolution,
  status        public.dispute_status NOT NULL DEFAULT 'open',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes (status);

DROP TRIGGER IF EXISTS disputes_set_updated_at ON public.disputes;
CREATE TRIGGER disputes_set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order participants and admins can view disputes" ON public.disputes;
CREATE POLICY "Order participants and admins can view disputes"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.seller_profiles sp ON sp.id = o.seller_id
      WHERE o.id = disputes.order_id AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Buyers can open disputes" ON public.disputes;
CREATE POLICY "Buyers can open disputes"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.report_order_problem(
  p_order_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_dispute_id uuid;
BEGIN
  IF p_message IS NULL OR length(trim(p_message)) < 5 THEN
    RAISE EXCEPTION 'Please describe the problem (at least 5 characters)';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND buyer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can be disputed';
  END IF;

  IF v_order.status NOT IN ('shipped', 'ready_for_pickup', 'delivered') THEN
    RAISE EXCEPTION 'This order cannot be disputed in its current state';
  END IF;

  INSERT INTO public.disputes (order_id, buyer_id, buyer_message)
  VALUES (p_order_id, v_order.buyer_id, trim(p_message))
  RETURNING id INTO v_dispute_id;

  UPDATE public.orders
  SET status = 'disputed'
  WHERE id = p_order_id;

  RETURN v_dispute_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_order_problem(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Buyer confirm received → delivered (spec Section 6 steps 7–8; payout via API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_commission numeric(12, 2);
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND buyer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Payment required before confirming receipt';
  END IF;

  IF v_order.status NOT IN ('shipped', 'ready_for_pickup') THEN
    RAISE EXCEPTION 'Order is not ready to confirm yet';
  END IF;

  v_commission := round(v_order.total * 0.03, 2);

  UPDATE public.orders
  SET status = 'delivered', delivered_at = now()
  WHERE id = p_order_id;

  UPDATE public.transactions
  SET
    commission_amount = v_commission,
    payout_status = 'processing'
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found for this order';
  END IF;
END;
$$;

-- Mark order completed after successful Paystack transfer (called from server API)
CREATE OR REPLACE FUNCTION public.complete_order_payout(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'completed'
  WHERE id = p_order_id AND status = 'delivered';

  UPDATE public.transactions
  SET payout_status = 'paid', paid_at = now()
  WHERE order_id = p_order_id;
END;
$$;

-- Auto-cancel stale fulfilled orders (spec Section 9 step 6) — refunds via API cron
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE status IN ('shipped', 'ready_for_pickup')
    AND fulfilled_at IS NOT NULL
    AND fulfilled_at < now() - interval '120 hours'
  RETURNING id;
END;
$$;

NOTIFY pgrst, 'reload schema';
