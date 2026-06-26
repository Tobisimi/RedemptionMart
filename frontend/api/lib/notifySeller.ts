import webpush from "web-push";
import { serverEnv } from "./env.js";
import { supabaseAdmin } from "./supabase.js";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@redemptionmart.local";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!configureWebPush()) return;

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions?.length) return;

  const message = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message
      )
    )
  );
}

/** Notify the seller when a buyer pays for an order (spec Section 7). */
export async function notifySellerNewOrder(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total, seller_id, seller_profiles!inner(user_id, shop_name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.seller_profiles) return;

  const seller = order.seller_profiles as unknown as { user_id: string; shop_name: string };

  await sendPushToUser(seller.user_id, {
    title: "New paid order",
    body: `You have a new order for ₦${Number(order.total).toLocaleString()} — open RedemptionMart to confirm.`,
    url: "/?tab=sell",
  });
}

/** Notify seller when order is placed (before payment) — optional heads-up. */
export async function notifySellerOrderPlaced(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, seller_id, seller_profiles!inner(user_id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.seller_profiles) return;

  const seller = order.seller_profiles as unknown as { user_id: string };

  await sendPushToUser(seller.user_id, {
    title: "New order received",
    body: "A buyer placed an order — waiting for payment.",
    url: "/?tab=sell",
  });
}
