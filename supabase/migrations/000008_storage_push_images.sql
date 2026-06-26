-- RedemptionMart V1: Product image storage + push subscriptions (spec Sections 7, 2)

-- Multiple product images (spec Section 5); image_url remains primary display image
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

UPDATE public.products
SET images = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (images IS NULL OR images = '{}');

-- ---------------------------------------------------------------------------
-- Supabase Storage: product-images bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Sellers upload product images" ON storage.objects;
CREATE POLICY "Sellers upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT sp.id::text FROM public.seller_profiles sp WHERE sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers update own product images" ON storage.objects;
CREATE POLICY "Sellers update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT sp.id::text FROM public.seller_profiles sp WHERE sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers delete own product images" ON storage.objects;
CREATE POLICY "Sellers delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT sp.id::text FROM public.seller_profiles sp WHERE sp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (spec Section 7 — seller order alerts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
