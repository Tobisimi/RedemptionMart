import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared/types/database.types";
import { serverEnv } from "./env.js";

export const supabaseAdmin = createClient<Database>(
  serverEnv.supabaseUrl,
  serverEnv.supabaseServiceRoleKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);
