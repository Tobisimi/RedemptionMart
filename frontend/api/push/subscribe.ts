import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    const { subscription } = (req.body ?? {}) as {
      subscription?: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    };

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ subscribed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscribe failed";
    const status = message.includes("authorization") || message.includes("session") ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
