import { useCallback, useEffect, useState } from "react";
import { supabase, type Order, type OrderItem } from "../lib/supabase";
import { cancelPaidPendingOrder, syncOrderPayment, triggerSellerPayout } from "../lib/api";
import { formatNaira } from "../lib/format";
import { useAuth } from "../contexts/AuthContext";
import SellerOrdersPanel from "./SellerOrdersPanel";
import ReviewForm from "./ReviewForm";
import ReportProblemForm from "./ReportProblemForm";

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
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());
  const [hasShop, setHasShop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [reportingOrderId, setReportingOrderId] = useState<string | null>(null);

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

    if (fetchError) {
      setLoading(false);
      setError(fetchError.message);
      return;
    }

    const orders = (data as OrderRow[]) ?? [];
    setBuyerOrders(orders);

    if (orders.length > 0) {
      const completedIds = orders.filter((o) => o.status === "completed").map((o) => o.id);
      if (completedIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("order_id")
          .in("order_id", completedIds);
        setReviewedOrderIds(new Set((reviews ?? []).map((r) => r.order_id)));
      }
    }

    setLoading(false);
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

  async function cancelPaidPending(orderId: string) {
    setActionError(null);
    try {
      await cancelPaidPendingOrder(orderId);
      await loadBuyerOrders();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : "Cancel failed");
    }
  }

  async function checkPayment(orderId: string) {
    setActionError(null);
    setSyncingOrderId(orderId);
    try {
      await syncOrderPayment(orderId);
      await loadBuyerOrders();
    } catch (syncError) {
      setActionError(syncError instanceof Error ? syncError.message : "Payment not confirmed yet");
    } finally {
      setSyncingOrderId(null);
    }
  }

  async function payForOrder(orderId: string) {
    setActionError(null);
    setPayingOrderId(orderId);
    try {
      const { openPaystackCheckout } = await import("../lib/paystackCheckout");
      const result = await openPaystackCheckout(orderId);
      await loadBuyerOrders();
      if (result) {
        setActionError(null);
      }
    } catch (payError) {
      setActionError(payError instanceof Error ? payError.message : "Payment failed");
    } finally {
      setPayingOrderId(null);
    }
  }

  async function confirmReceived(orderId: string) {
    setActionError(null);
    setConfirmingOrderId(orderId);

    const { error: confirmError } = await supabase.rpc("confirm_order_received", {
      p_order_id: orderId,
    });

    if (confirmError) {
      setActionError(confirmError.message);
      setConfirmingOrderId(null);
      return;
    }

    try {
      await triggerSellerPayout(orderId);
    } catch (payoutError) {
      setActionError(
        payoutError instanceof Error
          ? `${payoutError.message} — order marked delivered; payout can be retried.`
          : "Payout could not complete automatically."
      );
    } finally {
      setConfirmingOrderId(null);
      await loadBuyerOrders();
    }
  }

  async function retryPayout(orderId: string) {
    setActionError(null);
    setConfirmingOrderId(orderId);
    try {
      await triggerSellerPayout(orderId);
    } catch (payoutError) {
      setActionError(
        payoutError instanceof Error ? payoutError.message : "Payout could not complete."
      );
    } finally {
      setConfirmingOrderId(null);
      await loadBuyerOrders();
    }
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
                    <>
                      <button
                        type="button"
                        className="btn primary small"
                        disabled={payingOrderId === order.id}
                        onClick={() => payForOrder(order.id)}
                      >
                        {payingOrderId === order.id ? "Opening card form…" : "Pay with card"}
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={syncingOrderId === order.id}
                        onClick={() => checkPayment(order.id)}
                      >
                        {syncingOrderId === order.id ? "Checking…" : "I paid — check status"}
                      </button>
                    </>
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

                  {order.status === "pending" && order.payment_status === "paid" && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => cancelPaidPending(order.id)}
                    >
                      Cancel &amp; refund
                    </button>
                  )}

                  {order.payment_status === "paid" &&
                    (order.status === "shipped" || order.status === "ready_for_pickup") &&
                    reportingOrderId !== order.id && (
                      <>
                        <button
                          type="button"
                          className="btn primary small"
                          disabled={confirmingOrderId === order.id}
                          onClick={() => confirmReceived(order.id)}
                        >
                          {confirmingOrderId === order.id ? "Processing…" : "Confirm received"}
                        </button>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setReportingOrderId(order.id)}
                        >
                          Report a problem
                        </button>
                      </>
                    )}

                  {order.status === "delivered" && (
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={confirmingOrderId === order.id}
                      onClick={() => retryPayout(order.id)}
                    >
                      Retry seller payout
                    </button>
                  )}
                </div>

                {reportingOrderId === order.id && (
                  <ReportProblemForm
                    orderId={order.id}
                    onCancel={() => setReportingOrderId(null)}
                    onSubmitted={() => {
                      setReportingOrderId(null);
                      loadBuyerOrders();
                    }}
                  />
                )}

                {order.status === "completed" && !reviewedOrderIds.has(order.id) && (
                  <ReviewForm orderId={order.id} onSubmitted={() => loadBuyerOrders()} />
                )}

                {order.status === "completed" && reviewedOrderIds.has(order.id) && (
                  <p className="muted small">You reviewed this order. Thank you!</p>
                )}

                {order.status === "disputed" && (
                  <p className="muted small">
                    Dispute open — an admin will contact you after reviewing this order.
                  </p>
                )}
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
