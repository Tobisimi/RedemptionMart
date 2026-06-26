import type { VercelRequest } from "@vercel/node";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase.js";

export async function requireUser(req: VercelRequest): Promise<User> {
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid or expired session");
  }

  return data.user;
}
