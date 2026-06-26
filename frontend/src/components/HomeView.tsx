import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import BrowseProducts, { SellerDashboard } from "./Marketplace";
import ProductDetail from "./ProductDetail";
import CartView from "./CartView";
import OrdersView from "./OrdersView";

type Tab = "browse" | "cart" | "orders" | "sell";

type Props = {
  startOnOrders?: boolean;
};

export default function HomeView({ startOnOrders = false }: Props) {
  const { profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const [tab, setTab] = useState<Tab>(startOnOrders ? "orders" : "browse");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  function goToBrowse() {
    setSelectedProductId(null);
    setTab("browse");
  }

  return (
    <>
      <nav className="nav">
        <button
          type="button"
          className={tab === "browse" ? "nav-btn active" : "nav-btn"}
          onClick={goToBrowse}
        >
          Browse
        </button>
        <button
          type="button"
          className={tab === "cart" ? "nav-btn active" : "nav-btn"}
          onClick={() => {
            setSelectedProductId(null);
            setTab("cart");
          }}
        >
          Cart{itemCount > 0 ? ` (${itemCount})` : ""}
        </button>
        <button
          type="button"
          className={tab === "orders" ? "nav-btn active" : "nav-btn"}
          onClick={() => {
            setSelectedProductId(null);
            setTab("orders");
          }}
        >
          Orders
        </button>
        <button
          type="button"
          className={tab === "sell" ? "nav-btn active" : "nav-btn"}
          onClick={() => {
            setSelectedProductId(null);
            setTab("sell");
          }}
        >
          {profile?.is_seller ? "My shop" : "Sell"}
        </button>
        <button type="button" className="nav-btn logout" onClick={() => signOut()}>
          Log out
        </button>
      </nav>

      {tab === "browse" && selectedProductId ? (
        <ProductDetail
          productId={selectedProductId}
          onBack={goToBrowse}
          onAddedToCart={() => setTab("cart")}
        />
      ) : tab === "browse" ? (
        <BrowseProducts onSelectProduct={setSelectedProductId} />
      ) : tab === "cart" ? (
        <CartView onOrderPlaced={() => setTab("orders")} />
      ) : tab === "orders" ? (
        <OrdersView />
      ) : (
        <SellerDashboard />
      )}
    </>
  );
}
