import {
  buildPaymentReference,
  createTransferRecipient,
  initiateTransfer,
  nairaToKobo,
} from "./paystack.js";
import { supabaseAdmin } from "./supabase.js";
import { completeOrderPayout } from "./orderPayout.js";

/**
 * Pay seller via Paystack Transfer after buyer confirms receipt (spec Section 9 step 5).
 * Sets order to completed on success.
 */
export async function payoutSellerForOrder(orderId: string) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, status, total, seller_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error("Order not found");
  if (order.status !== "delivered") {
    throw new Error("Order must be in delivered status before payout");
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (txError || !transaction) throw new Error("Transaction not found");
  if (transaction.payout_status === "paid") {
    return { alreadyPaid: true, orderId };
  }

  const { data: shop, error: shopError } = await supabaseAdmin
    .from("seller_profiles")
    .select(
      "shop_name, bank_account_number, bank_code, bank_account_name, paystack_recipient_code"
    )
    .eq("id", order.seller_id)
    .maybeSingle();

  if (shopError || !shop) throw new Error("Seller shop not found");

  if (!shop.bank_account_number || !shop.bank_code) {
    throw new Error("Seller has not added bank details for payout");
  }

  let recipientCode = shop.paystack_recipient_code;

  if (!recipientCode) {
    const recipient = await createTransferRecipient({
      name: shop.bank_account_name ?? shop.shop_name,
      accountNumber: shop.bank_account_number,
      bankCode: shop.bank_code,
    });

    if (!recipient.status) {
      throw new Error(recipient.message || "Could not create Paystack recipient");
    }

    recipientCode = recipient.data.recipient_code;

    await supabaseAdmin
      .from("seller_profiles")
      .update({ paystack_recipient_code: recipientCode })
      .eq("id", order.seller_id);
  }

  const commission = Number(transaction.commission_amount ?? roundCommission(order.total));
  const sellerAmount = Number(order.total) - commission;
  const transferRef = buildPaymentReference(orderId).replace(/^rm_/, "rm_payout_");

  const transfer = await initiateTransfer({
    amountKobo: nairaToKobo(sellerAmount),
    recipientCode,
    reason: `RedemptionMart order ${orderId.slice(0, 8)}`,
    reference: transferRef,
  });

  if (!transfer.status) {
    await supabaseAdmin
      .from("transactions")
      .update({ payout_status: "failed" })
      .eq("order_id", orderId);
    throw new Error(transfer.message || "Paystack transfer failed");
  }

  await supabaseAdmin
    .from("transactions")
    .update({
      payout_status: "processing",
      payout_reference: transfer.data.reference ?? transferRef,
    })
    .eq("order_id", orderId);

  await completeOrderPayout(orderId);

  return { orderId, transferReference: transfer.data.reference ?? transferRef };
}

function roundCommission(total: number): number {
  return Math.round(total * 0.03 * 100) / 100;
}
