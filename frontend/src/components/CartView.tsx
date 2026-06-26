import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import { openPaystackCheckout } from "../lib/paystackCheckout";
import { notifySellerOrderPlaced } from "../lib/api";
import { formatNaira } from "../lib/format";
import { useCart } from "../contexts/CartContext";
import PaymentReceipt from "./PaymentReceipt";

type Props = {
  onOrderPlaced: () => void;
};

export default function CartView({ onOrderPlaced }: Props) {
  const { items, seller, subtotal, itemCount, removeItem, updateQuantity, clearCart } =
    useCart();
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    reference: string;
    orderId: string;
    amount: number;
  } | null>(null);

  async function handlePlaceOrder(event: FormEvent) {
    event.preventDefault();
    if (!seller || items.length === 0) return;

    if (fulfillment === "delivery" && !deliveryAddress.trim()) {
      setError("Enter your delivery address.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const payload = items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }));

    const { data: orderId, error: placeError } = await supabase.rpc("place_order", {
      p_seller_id: seller.id,
      p_fulfillment_type: fulfillment,
      p_delivery_address: fulfillment === "delivery" ? deliveryAddress.trim() : null,
      p_items: payload,
    });

    if (placeError || !orderId) {
      setSubmitting(false);
      setError(placeError?.message ?? "Order was not created.");
      return;
    }

    try {
      await notifySellerOrderPlaced(orderId);
    } catch {
      /* optional */
    }

    const orderTotal = subtotal;
    clearCart();

    try {
      const result = await openPaystackCheckout(orderId);
      setReceipt({
        reference: result.reference,
        orderId: result.orderId,
        amount: result.amount ?? orderTotal,
      });
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Payment could not be completed."
      );
      onOrderPlaced();
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <PaymentReceipt
        reference={receipt.reference}
        amount={receipt.amount}
        orderId={receipt.orderId}
        onDone={onOrderPlaced}
      />
    );
  }

  if (items.length === 0) {
    return (
      <section className="empty-state card">
        <div className="empty-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p className="muted">Discover products from sellers in Redemption City.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <section className="card checkout-summary">
        <p className="eyebrow">Checkout</p>
        <h2>{seller?.shop_name}</h2>
        <p className="muted small">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>

        <ul className="checkout-lines">
          {items.map((item) => (
            <li key={item.product.id} className="checkout-line">
              <div className="checkout-line-info">
                <strong>{item.product.name}</strong>
                <span className="muted small">
                  {item.quantity} × {formatNaira(Number(item.product.price))}
                </span>
              </div>
              <div className="cart-controls">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQuantity(item.product.id, Math.max(1, Number(e.target.value) || 1))
                  }
                  className="qty-input"
                  aria-label={`Quantity for ${item.product.name}`}
                />
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => removeItem(item.product.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="checkout-total">
          <span>Total</span>
          <strong>{formatNaira(subtotal)}</strong>
        </div>
      </section>

      <section className="card pay-card">
        <form className="form" onSubmit={handlePlaceOrder}>
          <h3 className="form-title">How do you want it?</h3>

          <div className="option-cards">
            <label className={`option-card ${fulfillment === "pickup" ? "selected" : ""}`}>
              <input
                type="radio"
                name="fulfillment"
                value="pickup"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />
              <div>
                <strong>Pickup</strong>
                <p className="muted small">Collect from {seller?.address}</p>
              </div>
            </label>

            <label className={`option-card ${fulfillment === "delivery" ? "selected" : ""}`}>
              <input
                type="radio"
                name="fulfillment"
                value="delivery"
                checked={fulfillment === "delivery"}
                onChange={() => setFulfillment("delivery")}
              />
              <div>
                <strong>Delivery</strong>
                <p className="muted small">Seller delivers to your address</p>
              </div>
            </label>
          </div>

          {fulfillment === "delivery" && (
            <label>
              Delivery address
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Your address in Redemption City"
                rows={2}
                required
              />
            </label>
          )}

          <div className="paystack-preview card-inset">
            <div className="paystack-preview-icon" aria-hidden>
              💳
            </div>
            <div>
              <strong>Paystack secure card form</strong>
              <p className="muted small">
                When you tap the button below, a <strong>Paystack window</strong> opens on top of
                this page. Enter your <strong>card number</strong>, <strong>expiry date</strong>,
                and <strong>CVV</strong> there — just like paying on Jumia or Netflix.
              </p>
            </div>
          </div>

          <div className="escrow-notice">
            <strong>🛡️ Your money is protected</strong>
            <p className="muted small">
              We hold payment until you tap &ldquo;Confirm received.&rdquo; The seller only gets paid
              after you&apos;re happy.
            </p>
          </div>

          <p className="muted small test-card-hint">
            <strong>Test mode:</strong> card <span className="mono">4084084084084081</span> · CVV{" "}
            <span className="mono">408</span> · expiry any future date · OTP{" "}
            <span className="mono">123456</span>
          </p>

          {error && <p className="feedback error">{error}</p>}

          <button type="submit" className="btn primary full pay-btn" disabled={submitting}>
            {submitting ? "Opening card form…" : `Pay ${formatNaira(subtotal)} with card`}
          </button>

          <p className="paystack-badge">🔒 Secured by Paystack</p>
        </form>
      </section>
    </section>
  );
}
