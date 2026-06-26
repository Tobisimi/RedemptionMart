-- Run this ENTIRE file in Supabase → SQL Editor → Run
-- Safe if parts already exist (skips duplicates).

-- Enums
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending', 'confirmed', 'shipped', 'ready_for_pickup',
    'delivered', 'completed', 'cancelled', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fulfillment_type AS ENUM ('delivery', 'pickup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  seller_id         uuid NOT NULL REFERENCES public.seller_profiles (id) ON DELETE RESTRICT,
  status            public.order_status NOT NULL DEFAULT 'pending',
  fulfillment_type  public.fulfillment_type NOT NULL,
  delivery_address  text,
  total             numeric(12, 2) NOT NULL CHECK (total > 0),
  payment_status    public.payment_status NOT NULL DEFAULT 'unpaid',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_delivery_address_required CHECK (
    fulfillment_type = 'pickup' OR (delivery_address IS NOT NULL AND length(trim(delivery_address)) > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  product_name  text NOT NULL,
  unit_price    numeric(12, 2) NOT NULL CHECK (unit_price > 0),
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_id_idx ON public.orders (seller_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies (drop first so re-run is safe)
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view shop orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can cancel pending orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update shop order status" ON public.orders;
DROP POLICY IF EXISTS "Order participants can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Buyers can add order items via own order" ON public.order_items;

CREATE POLICY "Buyers can view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "Sellers can view shop orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = orders.seller_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can create orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can cancel pending orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND status = 'pending')
  WITH CHECK (buyer_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "Sellers can update shop order status"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = orders.seller_id AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = seller_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Order participants can view order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.buyer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.seller_profiles sp
            WHERE sp.id = o.seller_id AND sp.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Buyers can add order items via own order"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid()
    )
  );

-- The function the app calls when you tap "Place order"
CREATE OR REPLACE FUNCTION public.place_order(
  p_seller_id uuid,
  p_fulfillment_type public.fulfillment_type,
  p_delivery_address text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid := auth.uid();
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_qty integer;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_fulfillment_type = 'delivery' AND (p_delivery_address IS NULL OR length(trim(p_delivery_address)) = 0) THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND seller_id = p_seller_id
      AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not available';
    END IF;

    v_total := v_total + (v_product.price * v_qty);
  END LOOP;

  INSERT INTO public.orders (buyer_id, seller_id, fulfillment_type, delivery_address, total)
  VALUES (
    v_buyer_id,
    p_seller_id,
    p_fulfillment_type,
    CASE WHEN p_fulfillment_type = 'pickup' THEN NULL ELSE trim(p_delivery_address) END,
    v_total
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND seller_id = p_seller_id
      AND status = 'active';

    INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, quantity)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(uuid, public.fulfillment_type, text, jsonb) TO authenticated;

-- Refresh API so the app sees the new function immediately
NOTIFY pgrst, 'reload schema';
