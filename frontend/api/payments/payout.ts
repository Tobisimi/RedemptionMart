import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../../lib/auth.js";
import { payoutSellerForOrder } from "../../lib/payoutSeller.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireUser(req);
    const { orderId } = (req.body ?? {}) as { orderId?: string };

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const result = await payoutSellerForOrder(orderId);
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payout failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
