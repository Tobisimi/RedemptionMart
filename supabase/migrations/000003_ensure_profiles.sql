-- Fix: users who signed up before the profile trigger existed have no profiles row.
-- That blocks seller_profiles inserts (foreign key on user_id → profiles.id).

-- 1. Backfill missing profiles for all existing auth users
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. Callable from the app before creating a shop (safe to run repeatedly)
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;
