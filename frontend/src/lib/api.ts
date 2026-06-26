import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You must be logged in");
  return token;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }

  return body;
}

export async function initializeOrderPayment(orderId: string) {
  return apiFetch<{ authorizationUrl: string; reference: string }>(
    "/api/payments/initialize",
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );
}

export async function verifyOrderPayment(reference: string) {
  return apiFetch<{ status: string; orderId: string; alreadyPaid?: boolean }>(
    `/api/payments/verify/${encodeURIComponent(reference)}`
  );
}
