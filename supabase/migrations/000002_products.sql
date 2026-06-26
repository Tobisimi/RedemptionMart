-- RedemptionMart V1: Product listings (spec Section 5)

CREATE TYPE public.product_status AS ENUM ('active', 'sold_out');

CREATE TABLE public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES public.seller_profiles (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  price       numeric(12, 2) NOT NULL CHECK (price > 0),
  image_url   text,
  status      public.product_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_seller_id_idx ON public.products (seller_id);
CREATE INDEX products_status_idx ON public.products (status);

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Buyers see active products; sellers also see their own (any status).
CREATE POLICY "Authenticated users can view products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    OR EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = products.seller_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = seller_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = products.seller_id AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = seller_id AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete own products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = products.seller_id AND sp.user_id = auth.uid()
    )
  );
