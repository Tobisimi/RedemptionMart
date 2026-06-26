import { useEffect, useState } from "react";
import {
  clearPendingPayment,
  readPendingPayment,
  verifyPaystackReturn,
} from "../lib/paystackCheckout";
import PaymentReceipt from "./PaymentReceipt";

type Props = {
  reference: string;
  onDone: () => void;
};

export default function PaymentReturn({ reference, onDone }: Props) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [orderId, setOrderId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verify() {
      const pending = readPendingPayment();

      try {
        const result = await verifyPaystackReturn(reference, pending?.orderId);
        if (!active) return;
        setOrderId(result.orderId);
        setStatus("success");
        clearPendingPayment();
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Payment verification failed");
      }
    }

    verify();
    return () => {
      active = false;
    };
  }, [reference]);

  if (status === "loading") {
    return (
      <section className="card receipt-loading">
        <div className="spinner" aria-hidden />
        <h2>Confirming your payment…</h2>
        <p className="muted">Talking to Paystack — this usually takes a few seconds.</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="card payment-error-card">
        <div className="error-icon" aria-hidden>
          !
        </div>
        <h2>We could not confirm payment</h2>
        <p className="feedback error">{error}</p>
        <p className="muted small">
          If money left your account, open <strong>Orders</strong> and tap <strong>Pay now</strong>{" "}
          again — we will not charge twice if it already went through.
        </p>
        <button type="button" className="btn primary" onClick={onDone}>
          Go to orders
        </button>
      </section>
    );
  }

  return (
    <PaymentReceipt
      reference={reference}
      orderId={orderId}
      onDone={() => {
        clearPendingPayment();
        onDone();
      }}
    />
  );
}
