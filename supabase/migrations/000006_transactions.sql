-- RedemptionMart V1: Transactions (spec Section 5) + buyer confirm received

CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

CREATE TABLE IF NOT EXISTS public.transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE RESTRICT,
  amount             numeric(12, 2) NOT NULL CHECK (amount > 0),
  paystack_reference text NOT NULL UNIQUE,
  commission_amount  numeric(12, 2),
  payout_status      public.payout_status NOT NULL DEFAULT 'pending',
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_order_id_idx ON public.transactions (order_id);

DROP TRIGGER IF EXISTS transactions_set_updated_at ON public.transactions;
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order participants can view transactions" ON public.transactions;
CREATE POLICY "Order participants can view transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = transactions.order_id
        AND (
          o.buyer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.seller_profiles sp
            WHERE sp.id = o.seller_id AND sp.user_id = auth.uid()
          )
        )
    )
  );

-- Buyer confirms receipt: spec Section 6 step 7–8 (3% commission, payout queued)
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

  -- Spec: 3% commission on completed platform transactions
  v_commission := round(v_order.total * 0.03, 2);

  UPDATE public.orders
  SET status = 'completed'
  WHERE id = p_order_id;

  UPDATE public.transactions
  SET
    commission_amount = v_commission,
    payout_status = 'pending'
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found for this order';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_received(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
