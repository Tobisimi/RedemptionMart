import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { useCart } from "../contexts/CartContext";

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
  const [success, setSuccess] = useState<string | null>(null);

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

    setSubmitting(false);

    if (placeError) {
      const hint = placeError.message.includes("place_order")
        ? " Orders database setup is missing. Run supabase/run_orders_setup.sql in Supabase SQL Editor."
        : "";
      setError(placeError.message + hint);
      return;
    }

    clearCart();
    setSuccess(`Order placed successfully. Reference: ${orderId?.slice(0, 8)}…`);
    onOrderPlaced();
  }

  if (items.length === 0 && !success) {
    return (
      <section className="card">
        <h2>Your cart</h2>
        <p className="muted">Your cart is empty. Browse products and add something.</p>
      </section>
    );
  }

  if (success) {
    return (
      <section className="card">
        <h2>Order placed</h2>
        <p className="feedback success">{success}</p>
        <p className="muted">Payment via Paystack is coming next. The seller will see your order.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <section className="card">
        <h2>Your cart ({itemCount})</h2>
        <p className="muted">From {seller?.shop_name}</p>

        <ul className="cart-items">
          {items.map((item) => (
            <li key={item.product.id} className="cart-row">
              <div>
                <strong>{item.product.name}</strong>
                <p className="muted">{formatNaira(Number(item.product.price))} each</p>
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
                  className="btn secondary small"
                  onClick={() => removeItem(item.product.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="price large">Total: {formatNaira(subtotal)}</p>
        <button type="button" className="btn link" onClick={clearCart}>
          Clear cart
        </button>
      </section>

      <section className="card">
        <h3>Checkout</h3>
        <form className="form" onSubmit={handlePlaceOrder}>
          <fieldset className="fulfillment-options">
            <legend>How do you want it?</legend>
            <label className="radio-label">
              <input
                type="radio"
                name="fulfillment"
                value="pickup"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />
              Pickup from seller ({seller?.address})
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="fulfillment"
                value="delivery"
                checked={fulfillment === "delivery"}
                onChange={() => setFulfillment("delivery")}
              />
              Delivery to my address
            </label>
          </fieldset>

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

          {error && <p className="feedback error">{error}</p>}

          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="muted small">Payment step comes next — order is saved as unpaid for now.</p>
        </form>
      </section>
    </section>
  );
}
