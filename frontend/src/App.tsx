import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import HomeView from "./components/HomeView";
import PaymentReturn from "./components/PaymentReturn";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { session, loading } = useAuth();
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [ordersTabOnLoad, setOrdersTabOnLoad] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const payment = params.get("payment");

    if (reference && payment === "return") {
      setPaymentReference(reference);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <main className="app">
      <header className="hero">
        <h1>RedemptionMart</h1>
        <p>Local marketplace for Redemption City</p>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !session ? (
        <AuthForm />
      ) : paymentReference ? (
        <PaymentReturn
          reference={paymentReference}
          onDone={() => {
            setPaymentReference(null);
            setOrdersTabOnLoad(true);
          }}
        />
      ) : (
        <HomeView startOnOrders={ordersTabOnLoad} />
      )}
    </main>
  );
}
