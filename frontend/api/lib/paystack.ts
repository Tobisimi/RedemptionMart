import { createHmac } from "node:crypto";
import { serverEnv } from "./env.js";

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
  };
};

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv.paystackSecretKey}`,
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
      metadata: { order_id: params.orderId },
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

type TransferRecipientResponse = {
  status: boolean;
  message: string;
  data: { recipient_code: string };
};

type TransferResponse = {
  status: boolean;
  message: string;
  data: { transfer_code: string; status: string; reference: string };
};

type RefundResponse = {
  status: boolean;
  message: string;
  data: { status: string; transaction: { reference: string } };
};

export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) {
  return paystackFetch<TransferRecipientResponse>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
}

export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reason: string;
  reference: string;
}) {
  return paystackFetch<TransferResponse>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reason: params.reason,
      reference: params.reference,
    }),
  });
}

export async function refundTransaction(transactionReference: string, amountKobo?: number) {
  return paystackFetch<RefundResponse>("/refund", {
    method: "POST",
    body: JSON.stringify({
      transaction: transactionReference,
      ...(amountKobo ? { amount: amountKobo } : {}),
    }),
  });
}

export function verifyPaystackWebhookSignature(
  rawBody: string | Buffer,
  signature: string | undefined
): boolean {
  if (!signature || !serverEnv.paystackSecretKey) return false;
  const hash = createHmac("sha512", serverEnv.paystackSecretKey)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
}
