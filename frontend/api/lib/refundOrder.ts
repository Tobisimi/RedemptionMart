import { nairaToKobo, refundTransaction } from "./paystack.js";
import { supabaseAdmin } from "./supabase.js";

/** Refund a paid order via Paystack (pending cancel or auto-cancel — spec Section 9). */
export async function refundPaidOrder(orderId: string, partialKobo?: number) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status, total, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error("Order not found");
  if (order.payment_status !== "paid") throw new Error("Order is not paid");

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("paystack_reference")
    .eq("order_id", orderId)
    .maybeSingle();

  if (txError || !transaction) throw new Error("Transaction not found");

  const refund = await refundTransaction(
    transaction.paystack_reference,
    partialKobo ?? nairaToKobo(Number(order.total))
  );

  if (!refund.status) {
    throw new Error(refund.message || "Refund failed");
  }

  await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled", payment_status: "paid" })
    .eq("id", orderId);

  await supabaseAdmin
    .from("transactions")
    .update({ payout_status: "failed" })
    .eq("order_id", orderId);

  return { orderId, refundStatus: refund.data.status };
}
