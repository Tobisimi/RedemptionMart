import { supabaseAdmin } from "./supabase.js";
import { nairaToKobo, verifyPayment } from "./paystack.js";
import { notifySellerNewOrder } from "./notifySeller.js";

/** Mark an order paid after Paystack confirms payment (verify endpoint + webhook). */
export async function markOrderPaid(orderId: string, reference: string, paidAt: string) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, seller_id, payment_status, total")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  if (order.payment_status === "paid") {
    return { orderId: order.id, alreadyPaid: true as const };
  }

  const verified = await verifyPayment(reference);

  if (!verified.status || verified.data.status !== "success") {
    throw new Error("Payment was not successful");
  }

  if (verified.data.amount !== nairaToKobo(Number(order.total))) {
    const expected = nairaToKobo(Number(order.total));
    const diff = Math.abs(verified.data.amount - expected);
    if (diff > 1) {
      throw new Error("Paid amount does not match order total");
    }
  }

  const { error: orderUpdateError } = await supabaseAdmin
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId);

  if (orderUpdateError) throw new Error(orderUpdateError.message);

  const { error: txUpdateError } = await supabaseAdmin
    .from("transactions")
    .update({ paid_at: paidAt })
    .eq("paystack_reference", reference);

  if (txUpdateError) throw new Error(txUpdateError.message);

  await notifySellerNewOrder(orderId);

  return { orderId: order.id, alreadyPaid: false as const };
}
