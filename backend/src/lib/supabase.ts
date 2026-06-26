import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared/types/database.types.js";
import { env } from "../config/env.js";

/**
 * Server-side Supabase client using the service role key.
 * Bypasses RLS — use only in trusted backend code (admin, payments, etc.).
 * Never expose this client or key to the frontend.
 */
export const supabaseAdmin = createClient<Database>(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export type { Profile, SellerProfile, Product, Order, OrderItem } from "../../../shared/types/database.types.js";
