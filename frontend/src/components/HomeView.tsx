import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import BrowseProducts, { SellerDashboard } from "./Marketplace";
import ProductDetail from "./ProductDetail";
import CartView from "./CartView";
import OrdersView from "./OrdersView";
import AdminPanel from "./AdminPanel";

type Tab = "browse" | "cart" | "orders" | "sell" | "admin";

type Props = {
  startOnOrders?: boolean;
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "browse", label: "Shop", icon: "🏪" },
  { id: "cart", label: "Cart", icon: "🛒" },
  { id: "orders", label: "Orders", icon: "📦" },
  { id: "sell", label: "Sell", icon: "🏷️" },
];

export default function HomeView({ startOnOrders = false }: Props) {
  const { profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const [tab, setTab] = useState<Tab>(startOnOrders ? "orders" : "browse");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "sell" || tabParam === "orders" || tabParam === "cart" || tabParam === "admin") {
      setTab(tabParam);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function goToBrowse() {
    setSelectedProductId(null);
    setTab("browse");
  }

  function selectTab(next: Tab) {
    setSelectedProductId(null);
    setTab(next);
  }

  return (
    <div className="app-frame">
      <div className="page-content">
        {tab === "browse" && selectedProductId ? (
          <ProductDetail
            productId={selectedProductId}
            onBack={goToBrowse}
            onAddedToCart={() => selectTab("cart")}
          />
        ) : tab === "browse" ? (
          <BrowseProducts onSelectProduct={setSelectedProductId} />
        ) : tab === "cart" ? (
          <CartView onOrderPlaced={() => selectTab("orders")} />
        ) : tab === "orders" ? (
          <OrdersView />
        ) : tab === "admin" && profile?.is_admin ? (
          <AdminPanel />
        ) : (
          <SellerDashboard />
        )}
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bottom-nav-btn ${tab === item.id ? "active" : ""}`}
            onClick={() => selectTab(item.id)}
          >
            <span className="bottom-nav-icon" aria-hidden>
              {item.icon}
              {item.id === "cart" && itemCount > 0 && (
                <span className="nav-badge">{itemCount}</span>
              )}
            </span>
            <span>{item.id === "sell" && profile?.is_seller ? "My shop" : item.label}</span>
          </button>
        ))}
        {profile?.is_admin && (
          <button
            type="button"
            className={`bottom-nav-btn ${tab === "admin" ? "active" : ""}`}
            onClick={() => selectTab("admin")}
          >
            <span className="bottom-nav-icon" aria-hidden>
              ⚙️
            </span>
            <span>Admin</span>
          </button>
        )}
      </nav>

      <button type="button" className="signout-link" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
