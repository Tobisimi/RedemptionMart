import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../lib/auth.js";
import { payoutSellerForOrder } from "../lib/payoutSeller.js";
import { refundPaidOrder } from "../lib/refundOrder.js";
import { supabaseAdmin } from "../lib/supabase.js";

type Resolution = "refund_full" | "refund_partial" | "released_to_seller";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { disputeId, resolution, adminNotes } = (req.body ?? {}) as {
      disputeId?: string;
      resolution?: Resolution;
      adminNotes?: string;
    };

    if (!disputeId || !resolution) {
      return res.status(400).json({ error: "disputeId and resolution are required" });
    }

    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from("disputes")
      .select("id, order_id, status")
      .eq("id", disputeId)
      .maybeSingle();

    if (disputeError || !dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (dispute.status === "resolved") {
      return res.status(400).json({ error: "Dispute already resolved" });
    }

    if (resolution === "refund_full") {
      await refundPaidOrder(dispute.order_id);
    } else if (resolution === "released_to_seller") {
      await supabaseAdmin
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", dispute.order_id);
      await payoutSellerForOrder(dispute.order_id);
    }
    // refund_partial: admin handles amount outside app in V1; notes only

    const { error: updateError } = await supabaseAdmin
      .from("disputes")
      .update({
        status: "resolved",
        resolution,
        admin_notes: adminNotes?.trim() || null,
      })
      .eq("id", disputeId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ resolved: true, disputeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resolve failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
