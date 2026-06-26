export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server env: ${name}`);
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return getEnv("SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return getEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get paystackSecretKey() {
    return process.env.PAYSTACK_SECRET_KEY ?? "";
  },
  frontendUrl(req: { headers: Record<string, string | string[] | undefined> }) {
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    const host = req.headers.host;
    if (host) return `https://${host}`;
    return "http://localhost:5173";
  },
};
