import { supabase } from "./supabase";

/** Creates a profiles row if missing (e.g. user signed up before DB trigger existed). */
export async function ensureProfile(): Promise<string | null> {
  const { error } = await supabase.rpc("ensure_profile");
  return error?.message ?? null;
}
