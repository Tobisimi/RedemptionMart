import { Analytics } from "@vercel/analytics/react";
import AuthForm from "./components/AuthForm";
import HomeView from "./components/HomeView";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { session, loading } = useAuth();

  return (
    <main className="app">
      <header className="hero">
        <h1>RedemptionMart</h1>
        <p>Local marketplace for Redemption City</p>
      </header>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : session ? (
        <HomeView />
      ) : (
        <AuthForm />
      )}

      <Analytics />
    </main>
  );
}
