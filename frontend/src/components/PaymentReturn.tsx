import { useEffect, useState } from "react";
import { verifyOrderPayment } from "../lib/api";

type Props = {
  reference: string;
  onDone: () => void;
};

export default function PaymentReturn({ reference, onDone }: Props) {
  const [message, setMessage] = useState("Confirming your payment…");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const result = await verifyOrderPayment(reference);
        if (!active) return;
        setMessage(
          result.alreadyPaid
            ? "Payment already confirmed. Your order is with the seller."
            : "Payment successful! The seller has been notified."
        );
      } catch (error) {
        if (!active) return;
        setIsError(true);
        setMessage(error instanceof Error ? error.message : "Payment verification failed");
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <section className="card">
      <h2>Payment</h2>
      <p className={isError ? "feedback error" : "feedback success"}>{message}</p>
      <button type="button" className="btn primary" onClick={onDone}>
        View my orders
      </button>
    </section>
  );
}
