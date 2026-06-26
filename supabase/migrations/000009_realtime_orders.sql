-- Enable live order updates for sellers (payment status refreshes without manual reload)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
