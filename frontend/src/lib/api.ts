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
  return apiFetch<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    amount: number;
  }>("/api/payments/initialize", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function verifyOrderPayment(reference: string, extraQuery = "") {
  return apiFetch<{ status: string; orderId: string; alreadyPaid?: boolean }>(
    `/api/payments/verify/${encodeURIComponent(reference)}${extraQuery}`
  );
}

export async function triggerSellerPayout(orderId: string) {
  return apiFetch<{ orderId: string; alreadyPaid?: boolean }>("/api/payments/payout", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function cancelPaidPendingOrder(orderId: string) {
  return apiFetch<{ cancelled: boolean; orderId: string }>(
    "/api/payments/cancel-paid-pending",
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );
}

export async function subscribeToPush(subscription: PushSubscriptionJSON) {
  return apiFetch<{ subscribed: boolean }>("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription }),
  });
}

export async function notifySellerOrderPlaced(orderId: string) {
  return apiFetch<{ notified: boolean }>("/api/push/notify-order-placed", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function syncOrderPayment(orderId: string) {
  return apiFetch<{ status: string; orderId: string; alreadyPaid?: boolean }>(
    "/api/payments/sync-order",
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }
  );
}

export async function resolveDispute(params: {
  disputeId: string;
  resolution: "refund_full" | "refund_partial" | "released_to_seller";
  adminNotes?: string;
}) {
  return apiFetch<{ resolved: boolean }>("/api/admin/resolve-dispute", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
