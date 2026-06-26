-- RedemptionMart V1: User (profiles) and SellerProfile (seller_profiles)
-- Maps to spec Section 5 data models, linked to Supabase Auth.

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at on row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- public.profiles (spec: User)
-- One row per auth.users entry; created automatically on signup.
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name  text,
  phone         text,
  is_buyer      boolean NOT NULL DEFAULT true,
  is_seller     boolean NOT NULL DEFAULT false,
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create a profile row whenever a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- public.seller_profiles (spec: SellerProfile)
-- One shop per user; bank fields are placeholders for future Paystack payouts.
-- ---------------------------------------------------------------------------
CREATE TABLE public.seller_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  shop_name           text NOT NULL,
  description         text,
  latitude            double precision,
  longitude           double precision,
  address             text NOT NULL,
  bank_account_number text,
  bank_code           text,
  bank_account_name   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER seller_profiles_set_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- When a seller profile is created, mark the user as a seller.
CREATE OR REPLACE FUNCTION public.handle_seller_profile_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET is_seller = true
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_seller_profile_created
  AFTER INSERT ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seller_profile_created();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read and update their own row.
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (uses helper to avoid RLS recursion).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Sellers can read buyer display names on orders for their shop.
CREATE POLICY "Sellers can view buyer profiles on shop orders"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.seller_profiles sp ON sp.id = o.seller_id
      WHERE o.buyer_id = profiles.id
        AND sp.user_id = auth.uid()
    )
  );

-- Buyers can read seller account profile on orders they placed.
CREATE POLICY "Buyers can view seller profiles on their orders"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.seller_profiles sp ON sp.id = o.seller_id
      WHERE sp.user_id = profiles.id
        AND o.buyer_id = auth.uid()
    )
  );

-- Seller profiles: any authenticated user can browse shops (buyer product pages).
CREATE POLICY "Authenticated users can view seller profiles"
  ON public.seller_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Seller profiles: owners can create their own shop.
CREATE POLICY "Users can create own seller profile"
  ON public.seller_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Seller profiles: owners can update their own shop.
CREATE POLICY "Users can update own seller profile"
  ON public.seller_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seller profiles: owners can delete their own shop.
CREATE POLICY "Users can delete own seller profile"
  ON public.seller_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
