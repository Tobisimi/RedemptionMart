import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../../lib/auth.js";
import { serverEnv } from "../../lib/env.js";
import { nairaToKobo, verifyPayment } from "../../lib/paystack.js";
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

    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("order_id, paystack_reference")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (txError || !transaction) {
      return res.status(404).json({ error: "Payment reference not found" });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, payment_status, total")
      .eq("id", transaction.order_id)
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
        orderId: transaction.order_id,
        alreadyPaid: true,
      });
    }

    const verified = await verifyPayment(reference);

    if (!verified.status || verified.data.status !== "success") {
      return res.status(400).json({
        error: "Payment was not successful",
        status: verified.data?.status ?? "failed",
      });
    }

    if (verified.data.amount !== nairaToKobo(Number(order.total))) {
      return res.status(400).json({ error: "Paid amount does not match order total" });
    }

    const paidAt = verified.data.paid_at ?? new Date().toISOString();

    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", transaction.order_id);

    if (orderUpdateError) {
      return res.status(500).json({ error: orderUpdateError.message });
    }

    const { error: txUpdateError } = await supabaseAdmin
      .from("transactions")
      .update({ paid_at: paidAt })
      .eq("paystack_reference", reference);

    if (txUpdateError) {
      return res.status(500).json({ error: txUpdateError.message });
    }

    return res.status(200).json({ status: "success", orderId: transaction.order_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
