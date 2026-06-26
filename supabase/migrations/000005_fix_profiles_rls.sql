-- Fix: "Infinite recursion detected in policy for relation profiles"
-- The old admin policy queried profiles FROM INSIDE a profiles policy (infinite loop).
-- This also blocked sellers from seeing buyer names on orders.

-- Helper: check admin without triggering RLS recursion
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

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Replace the broken admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Sellers can read buyer display names on orders for their shop
DROP POLICY IF EXISTS "Sellers can view buyer profiles on shop orders" ON public.profiles;

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

-- Buyers can read seller account profile on orders they placed
DROP POLICY IF EXISTS "Buyers can view seller profiles on their orders" ON public.profiles;

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

NOTIFY pgrst, 'reload schema';
