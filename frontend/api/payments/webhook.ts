import type { VercelRequest, VercelResponse } from "@vercel/node";
import { markOrderPaid } from "../lib/markOrderPaid.js";
import { verifyPaystackWebhookSignature } from "../lib/paystack.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-paystack-signature"] as string | undefined;

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8")) as {
      event: string;
      data: {
        status: string;
        reference: string;
        paid_at?: string;
        metadata?: { order_id?: string };
      };
    };

    if (event.event !== "charge.success" || event.data.status !== "success") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const reference = event.data.reference;
    const orderIdFromMeta = event.data.metadata?.order_id;

    let orderId = orderIdFromMeta;

    if (!orderId) {
      const { data: transaction } = await supabaseAdmin
        .from("transactions")
        .select("order_id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      orderId = transaction?.order_id;
    }

    if (!orderId) {
      return res.status(404).json({ error: "Order not found for reference" });
    }

    await markOrderPaid(orderId, reference, event.data.paid_at ?? new Date().toISOString());

    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return res.status(500).json({ error: message });
  }
}
