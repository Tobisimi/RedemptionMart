import { Router } from "express";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import {
  buildPaymentReference,
  initializePayment,
  nairaToKobo,
  verifyPayment,
} from "../lib/paystack.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const paymentsRouter = Router();

paymentsRouter.post("/initialize", requireAuth, async (req, res) => {
  try {
    if (!env.paystackSecretKey) {
      res.status(503).json({ error: "Paystack is not configured on the server" });
      return;
    }

    const { orderId } = req.body as { orderId?: string };
    const user = (req as AuthedRequest).user;

    if (!orderId) {
      res.status(400).json({ error: "orderId is required" });
      return;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, total, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.buyer_id !== user.id) {
      res.status(403).json({ error: "Not your order" });
      return;
    }

    if (order.payment_status === "paid") {
      res.status(400).json({ error: "Order is already paid" });
      return;
    }

    const reference = buildPaymentReference(order.id);
    const callbackUrl = `${env.frontendUrl}/`;

    const paystack = await initializePayment({
      email: user.email ?? "buyer@redemptionmart.local",
      amountNaira: Number(order.total),
      reference,
      orderId: order.id,
      callbackUrl,
    });

    if (!paystack.status) {
      res.status(502).json({ error: paystack.message || "Paystack initialization failed" });
      return;
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
      res.status(500).json({ error: txError.message });
      return;
    }

    res.json({
      authorizationUrl: paystack.data.authorization_url,
      accessCode: paystack.data.access_code,
      reference: paystack.data.reference,
      amount: Number(order.total),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Payment initialization failed",
    });
  }
});

paymentsRouter.get("/verify/:reference", requireAuth, async (req, res) => {
  try {
    if (!env.paystackSecretKey) {
      res.status(503).json({ error: "Paystack is not configured on the server" });
      return;
    }

    const user = (req as AuthedRequest).user;
    const { reference } = req.params;

    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("order_id, paystack_reference")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (txError || !transaction) {
      res.status(404).json({ error: "Payment reference not found" });
      return;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("buyer_id, payment_status, total")
      .eq("id", transaction.order_id)
      .maybeSingle();

    if (orderError || !order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.buyer_id !== user.id) {
      res.status(403).json({ error: "Not your payment" });
      return;
    }

    if (order.payment_status === "paid") {
      res.json({ status: "success", orderId: transaction.order_id, alreadyPaid: true });
      return;
    }

    const verified = await verifyPayment(reference);

    if (!verified.status || verified.data.status !== "success") {
      res.status(400).json({
        error: "Payment was not successful",
        status: verified.data?.status ?? "failed",
      });
      return;
    }

    const expectedKobo = nairaToKobo(Number(order.total));
    if (verified.data.amount !== expectedKobo) {
      res.status(400).json({ error: "Paid amount does not match order total" });
      return;
    }

    const paidAt = verified.data.paid_at ?? new Date().toISOString();

    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", transaction.order_id);

    if (orderUpdateError) {
      res.status(500).json({ error: orderUpdateError.message });
      return;
    }

    const { error: txUpdateError } = await supabaseAdmin
      .from("transactions")
      .update({ paid_at: paidAt })
      .eq("paystack_reference", reference);

    if (txUpdateError) {
      res.status(500).json({ error: txUpdateError.message });
      return;
    }

    res.json({ status: "success", orderId: transaction.order_id });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Payment verification failed",
    });
  }
});
