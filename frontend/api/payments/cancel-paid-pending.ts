import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../../lib/auth.js";
import { refundPaidOrder } from "../../lib/refundOrder.js";
import { supabaseAdmin } from "../../lib/supabase.js";

/** Cancel a pending paid order with full refund (spec Section 9 step 7). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const { orderId } = (req.body ?? {}) as { orderId?: string };

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { data: shop } = await supabaseAdmin
      .from("seller_profiles")
      .select("user_id")
      .eq("id", order.seller_id)
      .maybeSingle();

    const isBuyer = order.buyer_id === user.id;
    const isSeller = shop?.user_id === user.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: "Not allowed to cancel this order" });
    }

    if (order.status !== "pending" || order.payment_status !== "paid") {
      return res.status(400).json({
        error: "Only pending paid orders can be cancelled with a refund",
      });
    }

    await refundPaidOrder(orderId);

    return res.status(200).json({ cancelled: true, orderId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancel failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
