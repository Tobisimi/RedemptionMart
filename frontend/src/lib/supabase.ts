import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared/types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values."
  );
}

/**
 * Browser Supabase client using the anon key.
 * Respects Row Level Security policies defined in migrations.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type { Profile, SellerProfile, Product, Order, OrderItem } from "../../../shared/types/database.types";
