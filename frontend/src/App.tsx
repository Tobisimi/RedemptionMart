import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import HomeView from "./components/HomeView";
import PaymentReturn from "./components/PaymentReturn";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { session, profile, loading } = useAuth();
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [ordersTabOnLoad, setOrdersTabOnLoad] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");

    if (reference) {
      setPaymentReference(reference);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand">
            <span className="brand-mark">R</span>
            <div>
              <h1>RedemptionMart</h1>
              <p>Redemption City marketplace</p>
            </div>
          </div>
          {session && profile?.display_name && (
            <span className="user-chip">Hi, {profile.display_name.split(" ")[0]}</span>
          )}
        </div>
      </header>

      <main className="shell-main">
        {loading ? (
          <section className="card receipt-loading">
            <div className="spinner" aria-hidden />
            <p className="muted">Loading…</p>
          </section>
        ) : !session ? (
          <div className="auth-layout">
            <section className="auth-hero card">
              <p className="eyebrow">Local commerce</p>
              <h2>Buy and sell in Redemption City</h2>
              <p className="muted">
                Browse shops near you, pay securely with Paystack, and pick up or get delivery.
              </p>
              <ul className="hero-points">
                <li>Secure Paystack payments</li>
                <li>Funds held until you confirm</li>
                <li>Trusted local sellers</li>
              </ul>
            </section>
            <AuthForm />
          </div>
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
    </div>
  );
}
