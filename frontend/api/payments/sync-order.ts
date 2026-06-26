import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../../lib/auth.js";
import { markOrderPaid } from "../../lib/markOrderPaid.js";
import { serverEnv } from "../../lib/env.js";
import { supabaseAdmin } from "../../lib/supabase.js";

/** Buyer tapped "Check payment" — verify with Paystack and mark order paid if successful. */
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
      .select("id, buyer_id, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyer_id !== user.id) {
      return res.status(403).json({ error: "Not your order" });
    }

    if (order.payment_status === "paid") {
      return res.status(200).json({ status: "success", orderId, alreadyPaid: true });
    }

    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("paystack_reference")
      .eq("order_id", orderId)
      .maybeSingle();

    if (txError || !transaction?.paystack_reference) {
      return res.status(404).json({
        error: "No payment started for this order yet. Tap Pay now first.",
      });
    }

    const result = await markOrderPaid(
      orderId,
      transaction.paystack_reference,
      new Date().toISOString()
    );

    return res.status(200).json({
      status: "success",
      orderId: result.orderId,
      alreadyPaid: result.alreadyPaid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify payment";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 400;
    return res.status(status).json({ error: message });
  }
}
