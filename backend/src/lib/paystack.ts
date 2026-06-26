import { env } from "../config/env.js";

type PaystackInitResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    paid_at: string | null;
    metadata: { order_id?: string };
  };
};

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.paystackSecretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body && "message" in body && body.message
        ? String(body.message)
        : `Paystack request failed (${response.status})`
    );
  }

  return body;
}

export function nairaToKobo(amount: number): number {
  return Math.round(amount * 100);
}

export async function initializePayment(params: {
  email: string;
  amountNaira: number;
  reference: string;
  orderId: string;
  callbackUrl: string;
}) {
  return paystackFetch<PaystackInitResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: nairaToKobo(params.amountNaira),
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: {
        order_id: params.orderId,
        custom_fields: [
          { display_name: "Order ID", variable_name: "order_id", value: params.orderId },
        ],
      },
    }),
  });
}

export async function verifyPayment(reference: string) {
  return paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
}

export function buildPaymentReference(orderId: string): string {
  const slug = orderId.replace(/-/g, "").slice(0, 12);
  return `rm_${slug}_${Date.now()}`;
}
