import { useCallback, useEffect, useState } from "react";
import { supabase, type Order, type OrderItem } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { initializeOrderPayment } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import SellerOrdersPanel from "./SellerOrdersPanel";

type OrderRow = Order & {
  order_items: OrderItem[];
  seller_profiles: { shop_name: string } | null;
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

function statusClass(status: Order["status"]): string {
  if (status === "cancelled") return "cancelled";
  if (status === "completed" || status === "delivered") return "completed";
  if (status === "pending") return "pending";
  return "active";
}

export default function OrdersView() {
  const { user, profile } = useAuth();
  const [buyerOrders, setBuyerOrders] = useState<OrderRow[]>([]);
  const [hasShop, setHasShop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const loadBuyerOrders = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const { data: shop } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setHasShop(!!shop);

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*, order_items(*), seller_profiles(shop_name)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setBuyerOrders((data as OrderRow[]) ?? []);
  }, [user]);

  useEffect(() => {
    loadBuyerOrders();
  }, [loadBuyerOrders]);

  async function cancelOrder(orderId: string) {
    setActionError(null);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) {
      setActionError(updateError.message);
      return;
    }

    await loadBuyerOrders();
  }

  async function payForOrder(orderId: string) {
    setActionError(null);
    setPayingOrderId(orderId);
    try {
      const payment = await initializeOrderPayment(orderId);
      window.location.href = payment.authorizationUrl;
    } catch (payError) {
      setPayingOrderId(null);
      setActionError(payError instanceof Error ? payError.message : "Payment failed to start");
    }
  }

  async function confirmReceived(orderId: string) {
    setActionError(null);
    const { error: confirmError } = await supabase.rpc("confirm_order_received", {
      p_order_id: orderId,
    });

    if (confirmError) {
      setActionError(confirmError.message);
      return;
    }

    await loadBuyerOrders();
  }

  if (loading) return <p className="muted">Loading orders…</p>;
  if (error) return <p className="feedback error">{error}</p>;

  return (
    <section className="stack">
      {actionError && <p className="feedback error">{actionError}</p>}

      {hasShop && user && (
        <section className="card">
          <SellerOrdersPanel userId={user.id} title="Shop orders (seller)" />
        </section>
      )}

      <section className="card">
        <h2>My purchases</h2>
        {buyerOrders.length === 0 ? (
          <p className="muted">You have not placed any orders yet.</p>
        ) : (
          <ul className="order-list">
            {buyerOrders.map((order) => (
              <li key={order.id} className="order-card">
                <OrderHeader
                  title={order.seller_profiles?.shop_name ?? "Shop"}
                  order={order}
                />
                <OrderItems items={order.order_items} />

                <div className="row-actions wrap">
                  {order.payment_status === "unpaid" && order.status === "pending" && (
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={payingOrderId === order.id}
                      onClick={() => payForOrder(order.id)}
                    >
                      {payingOrderId === order.id ? "Opening Paystack…" : "Pay now"}
                    </button>
                  )}

                  {order.status === "pending" && order.payment_status === "unpaid" && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => cancelOrder(order.id)}
                    >
                      Cancel order
                    </button>
                  )}

                  {order.payment_status === "paid" &&
                    (order.status === "shipped" || order.status === "ready_for_pickup") && (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => confirmReceived(order.id)}
                      >
                        Confirm received
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile?.is_seller && !hasShop && (
        <p className="muted">
          You are marked as a seller but no shop was found. Open the Sell tab to set up your shop.
        </p>
      )}
    </section>
  );
}

function OrderHeader({ title, order }: { title: string; order: OrderRow }) {
  return (
    <div className="order-header">
      <div>
        <strong>{title}</strong>
        <p className="muted small">
          {new Date(order.created_at).toLocaleString()} · {order.fulfillment_type}
        </p>
      </div>
      <div className="order-meta">
        <span className={`badge ${statusClass(order.status)}`}>
          {STATUS_LABELS[order.status]}
        </span>
        <span className={`badge ${order.payment_status === "paid" ? "active" : "pending"}`}>
          {order.payment_status === "paid" ? "Paid" : "Unpaid"}
        </span>
        <span className="price">{formatNaira(Number(order.total))}</span>
      </div>
    </div>
  );
}

function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <ul className="order-items">
      {items.map((item) => (
        <li key={item.id}>
          {item.quantity}× {item.product_name} — {formatNaira(Number(item.unit_price))}
        </li>
      ))}
    </ul>
  );
}
