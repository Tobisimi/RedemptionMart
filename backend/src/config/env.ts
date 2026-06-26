import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
  frontendUrl:
    process.env.FRONTEND_URL ??
    process.env.FRONTEND_URL_PRODUCTION ??
    "http://localhost:5173",
} as const;

export function allowedOrigins(): string[] {
  return [
    ...new Set(
      [
        env.frontendUrl,
        process.env.FRONTEND_URL_PRODUCTION,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ].filter((value): value is string => Boolean(value))
    ),
  ];
}
