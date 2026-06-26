import { useEffect, useState } from "react";
import { verifyOrderPayment } from "../lib/api";
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
      try {
        const result = await verifyOrderPayment(reference);
        if (!active) return;
        setOrderId(result.orderId);
        setStatus("success");
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
        <h2>Verifying payment…</h2>
        <p className="muted">Confirming with Paystack</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="card">
        <h2>Payment issue</h2>
        <p className="feedback error">{error}</p>
        <button type="button" className="btn secondary" onClick={onDone}>
          Back to orders
        </button>
      </section>
    );
  }

  return <PaymentReceipt reference={reference} orderId={orderId} onDone={onDone} />;
}
