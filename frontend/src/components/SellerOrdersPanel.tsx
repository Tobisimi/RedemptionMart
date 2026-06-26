import { useCallback, useEffect, useState } from "react";
import { supabase, type Order, type OrderItem } from "../lib/supabase";
import { cancelPaidPendingOrder } from "../lib/api";
import { formatNaira } from "../lib/format";

export type SellerOrderRow = Order & {
  order_items: OrderItem[];
  profiles: { display_name: string | null } | null;
};

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  ready_for_pickup: "Ready for pickup",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

type Props = {
  userId: string;
  title?: string;
  compact?: boolean;
};

export default function SellerOrdersPanel({
  userId,
  title = "Incoming orders",
  compact = false,
}: Props) {
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: shop, error: shopError } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    if (!shop) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data, error: ordersError } = await supabase
      .from("orders")
      .select("*, order_items(*), profiles(display_name)")
      .eq("seller_id", shop.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (ordersError) {
      setError(ordersError.message);
      return;
    }

    setOrders((data as SellerOrderRow[]) ?? []);
  }, [userId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function updateStatus(orderId: string, status: Order["status"]) {
    setActionError(null);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (updateError) {
      setActionError(updateError.message);
      return;
    }

    await loadOrders();
  }

  async function cancelPaidPending(orderId: string) {
    setActionError(null);
    try {
      await cancelPaidPendingOrder(orderId);
      await loadOrders();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : "Cancel failed");
    }
  }

  const pendingCount = orders.filter(
    (o) => o.status === "pending" && o.payment_status === "paid"
  ).length;

  if (loading) return <p className="muted">Loading shop orders…</p>;

  return (
    <section className={compact ? "" : "card"}>
      <div className="section-heading">
        <h2>{title}</h2>
        {pendingCount > 0 && (
          <span className="badge pending">{pendingCount} need action</span>
        )}
      </div>

      {actionError && <p className="feedback error">{actionError}</p>}
      {error && <p className="feedback error">{error}</p>}

      {orders.length === 0 ? (
        <p className="muted">No orders for your shop yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.id} className="order-card highlight">
              <div className="order-header">
                <div>
                  <strong>Order from {order.profiles?.display_name ?? "Buyer"}</strong>
                  <p className="muted small">
                    {new Date(order.created_at).toLocaleString()} · {order.fulfillment_type}
                  </p>
                </div>
                <div className="order-meta-col">
                  <span className="badge pending">{STATUS_LABELS[order.status]}</span>
                  <span
                    className={`badge ${order.payment_status === "paid" ? "active" : "pending"}`}
                  >
                    {order.payment_status === "paid" ? "Paid" : "Awaiting payment"}
                  </span>
                </div>
              </div>

              <p className="muted">
                {order.fulfillment_type === "delivery"
                  ? `Deliver to: ${order.delivery_address}`
                  : "Buyer will pick up from your shop"}
              </p>

              <ul className="order-items">
                {order.order_items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.product_name} — {formatNaira(Number(item.unit_price))}
                  </li>
                ))}
              </ul>

              <p className="price">Total: {formatNaira(Number(order.total))}</p>

              {order.status === "pending" && order.payment_status === "paid" && (
                <>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => updateStatus(order.id, "confirmed")}
                  >
                    ✓ Confirm this order
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => cancelPaidPending(order.id)}
                  >
                    Cancel &amp; refund buyer
                  </button>
                </>
              )}

              {order.status === "pending" && order.payment_status === "unpaid" && (
                <p className="muted small">Waiting for buyer to complete Paystack payment.</p>
              )}

              {order.status === "confirmed" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    updateStatus(
                      order.id,
                      order.fulfillment_type === "delivery" ? "shipped" : "ready_for_pickup"
                    )
                  }
                >
                  Mark {order.fulfillment_type === "delivery" ? "shipped" : "ready for pickup"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
