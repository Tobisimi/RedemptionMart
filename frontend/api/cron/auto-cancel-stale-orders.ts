import type { VercelRequest, VercelResponse } from "@vercel/node";
import { refundPaidOrder } from "../lib/refundOrder.js";
import { supabaseAdmin } from "../lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: cancelledIds, error } = await supabaseAdmin.rpc("auto_cancel_stale_orders");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const orderIds = (cancelledIds as string[] | null) ?? [];
    const refunds: { orderId: string; ok: boolean; error?: string }[] = [];

    for (const orderId of orderIds) {
      try {
        await refundPaidOrder(orderId);
        refunds.push({ orderId, ok: true });
      } catch (refundError) {
        refunds.push({
          orderId,
          ok: false,
          error: refundError instanceof Error ? refundError.message : "Refund failed",
        });
      }
    }

    return res.status(200).json({ cancelled: orderIds.length, refunds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron job failed";
    return res.status(500).json({ error: message });
  }
}
