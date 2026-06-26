import { formatNaira } from "../lib/format";

type Props = {
  reference: string;
  amount?: number;
  orderId?: string;
  onDone: () => void;
};

export default function PaymentReceipt({ reference, amount, orderId, onDone }: Props) {
  return (
    <section className="receipt card">
      <div className="receipt-icon" aria-hidden>
        ✓
      </div>
      <h2>Payment confirmed</h2>
      <p className="receipt-lead">
        Your payment was processed securely by Paystack. Funds are held until you confirm
        receipt of your order.
      </p>

      <dl className="receipt-details">
        <div>
          <dt>Amount paid</dt>
          <dd>{amount != null ? formatNaira(amount) : "—"}</dd>
        </div>
        <div>
          <dt>Paystack reference</dt>
          <dd className="mono">{reference}</dd>
        </div>
        {orderId && (
          <div>
            <dt>Order ID</dt>
            <dd className="mono">{orderId.slice(0, 8).toUpperCase()}</dd>
          </div>
        )}
      </dl>

      <div className="trust-strip">
        <span>🔒 Secured by Paystack</span>
        <span>·</span>
        <span>Escrow until delivery</span>
      </div>

      <button type="button" className="btn primary full" onClick={onDone}>
        View order status
      </button>
    </section>
  );
}
