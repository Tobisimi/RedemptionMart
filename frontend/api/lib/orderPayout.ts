import { supabaseAdmin } from "./supabase.js";

export async function completeOrderPayout(orderId: string) {
  const { error } = await supabaseAdmin.rpc("complete_order_payout", {
    p_order_id: orderId,
  });

  if (error) throw new Error(error.message);
}
