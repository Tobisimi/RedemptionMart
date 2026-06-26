import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../../lib/auth.js";
import { serverEnv } from "../../lib/env.js";
import { markOrderPaid } from "../../lib/markOrderPaid.js";
import { verifyPayment } from "../../lib/paystack.js";
import { supabaseAdmin } from "../../lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!serverEnv.paystackSecretKey) {
      return res.status(503).json({ error: "Paystack is not configured on the server" });
    }

    const user = await requireUser(req);
    const reference = req.query.reference;

    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ error: "reference is required" });
    }

    const orderIdParam =
      typeof req.query.orderId === "string" ? req.query.orderId : undefined;

    let orderId = orderIdParam;

    const { data: byReference } = await supabaseAdmin
      .from("transactions")
      .select("order_id, paystack_reference")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (byReference) {
      orderId = byReference.order_id;
    }

    if (!orderId) {
      const paystackCheck = await verifyPayment(reference);
      const metaOrderId = paystackCheck.data?.metadata?.order_id;
      if (typeof metaOrderId === "string") {
        orderId = metaOrderId;
      }
    }

    if (!orderId && orderIdParam) {
      orderId = orderIdParam;
    }

    if (!orderId) {
      return res.status(404).json({ error: "Payment reference not found" });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer_id !== user.id) {
      return res.status(403).json({ error: "Not your payment" });
    }

    if (order.payment_status === "paid") {
      return res.status(200).json({
        status: "success",
        orderId: order.id,
        alreadyPaid: true,
      });
    }

    const { data: existingTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!existingTx) {
      return res.status(404).json({
        error: "Payment record missing — run database migration 000006_transactions.sql",
      });
    }

    await supabaseAdmin
      .from("transactions")
      .update({ paystack_reference: reference })
      .eq("order_id", orderId);

    const result = await markOrderPaid(orderId, reference, new Date().toISOString());

    return res.status(200).json({ status: "success", orderId: result.orderId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
