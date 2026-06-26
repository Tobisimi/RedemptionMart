import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../lib/auth.js";
import { serverEnv } from "../lib/env.js";
import { buildPaymentReference, initializePayment } from "../lib/paystack.js";
import { supabaseAdmin } from "../lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!serverEnv.paystackSecretKey) {
      return res.status(503).json({ error: "Paystack is not configured on the server" });
    }

    const user = await requireUser(req);
    const { orderId } = (req.body ?? {}) as { orderId?: string };

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, total, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer_id !== user.id) {
      return res.status(403).json({ error: "Not your order" });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({ error: "Order is already paid" });
    }

    const reference = buildPaymentReference(order.id);
    const callbackUrl = `${serverEnv.frontendUrl(req)}/?payment=return&orderId=${order.id}`;

    const paystack = await initializePayment({
      email: user.email ?? "buyer@redemptionmart.local",
      amountNaira: Number(order.total),
      reference,
      orderId: order.id,
      callbackUrl,
    });

    if (!paystack.status) {
      return res.status(502).json({ error: paystack.message || "Paystack initialization failed" });
    }

    const { error: txError } = await supabaseAdmin.from("transactions").upsert(
      {
        order_id: order.id,
        amount: order.total,
        paystack_reference: reference,
        payout_status: "pending",
      },
      { onConflict: "order_id" }
    );

    if (txError) {
      return res.status(500).json({ error: txError.message });
    }

    return res.status(200).json({
      authorizationUrl: paystack.data.authorization_url,
      accessCode: paystack.data.access_code,
      reference: paystack.data.reference,
      amount: Number(order.total),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment initialization failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
