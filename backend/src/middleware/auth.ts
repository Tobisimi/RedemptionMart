import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export type AuthedRequest = Request & { user: User };

const supabaseAuth = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as AuthedRequest).user = data.user;
  next();
}
