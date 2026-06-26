import { useCallback, useEffect, useState } from "react";
import { supabase, type Product, type SellerProfile } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { useAuth } from "../contexts/AuthContext";
import AddProductForm from "./AddProductForm";
import SellerSetupForm from "./SellerSetupForm";
import SellerOrdersPanel from "./SellerOrdersPanel";
import BankDetailsForm from "./BankDetailsForm";
import { registerSellerPushNotifications } from "../lib/pushNotifications";

type ProductRow = Product & {
  seller_profiles: Pick<SellerProfile, "shop_name"> | null;
};

type BrowseProps = {
  onSelectProduct: (productId: string) => void;
};

export default function BrowseProducts({ onSelectProduct }: BrowseProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*, seller_profiles(shop_name)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setProducts((data as ProductRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  if (loading) return <p className="muted">Loading products…</p>;
  if (error) return <p className="feedback error">{error}</p>;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = normalizedQuery
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.description?.toLowerCase().includes(normalizedQuery) ||
          product.seller_profiles?.shop_name?.toLowerCase().includes(normalizedQuery)
      )
    : products;

  if (products.length === 0) {
    return (
      <section className="card">
        <h2>Browse products</h2>
        <p className="muted">No products listed yet. Sellers can add items from the Sell tab.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h2 className="section-title">Shop Redemption City</h2>
        </div>
      </div>
      <label className="search-field">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          placeholder="Search products or shops…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {filteredProducts.length === 0 ? (
        <p className="muted">No products match your search.</p>
      ) : (
      <ul className="product-grid">
        {filteredProducts.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              className="card product-card clickable"
              onClick={() => onSelectProduct(product.id)}
            >
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="product-image" />
              ) : (
                <div className="product-image placeholder">No image</div>
              )}
              <h3>{product.name}</h3>
              {product.description && <p className="muted">{product.description}</p>}
              <p className="price">{formatNaira(Number(product.price))}</p>
              <p className="shop-name">{product.seller_profiles?.shop_name ?? "Unknown shop"}</p>
            </button>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}

export function SellerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSellerData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const { data: shop, error: shopError } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    setSellerProfile(shop);

    if (shop) {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", shop.id)
        .order("created_at", { ascending: false });

      if (productsError) {
        setError(productsError.message);
      } else {
        setMyProducts(products ?? []);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSellerData();
  }, [loadSellerData]);

  useEffect(() => {
    if (sellerProfile) {
      registerSellerPushNotifications().catch(() => {
        /* optional — sellers can still use the app without push */
      });
    }
  }, [sellerProfile?.id]);

  async function handleShopCreated() {
    await refreshProfile();
    await loadSellerData();
  }

  async function toggleSoldOut(product: Product) {
    const nextStatus = product.status === "active" ? "sold_out" : "active";
    const { error: updateError } = await supabase
      .from("products")
      .update({ status: nextStatus })
      .eq("id", product.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadSellerData();
  }

  if (loading) return <p className="muted">Loading your shop…</p>;

  if (!sellerProfile && !profile?.is_seller) {
    return <SellerSetupForm onComplete={handleShopCreated} />;
  }

  if (!sellerProfile) {
    return <p className="feedback error">Shop profile not found. Try refreshing.</p>;
  }

  return (
    <section className="stack seller-dashboard">
      <BankDetailsForm
        sellerId={sellerProfile.id}
        shopName={sellerProfile.shop_name}
        prominent
        initial={{
          bank_account_name: sellerProfile.bank_account_name,
          bank_account_number: sellerProfile.bank_account_number,
          bank_code: sellerProfile.bank_code,
        }}
        onSaved={loadSellerData}
      />

      {user && (
        <section className="card seller-orders-banner orders-priority">
          <SellerOrdersPanel userId={user.id} title="📦 Incoming orders" />
        </section>
      )}

      <section className="card shop-info-card">
        <p className="eyebrow">Your shop</p>
        <h2>{sellerProfile.shop_name}</h2>
        {sellerProfile.description && <p className="muted">{sellerProfile.description}</p>}
        <p className="muted">📍 {sellerProfile.address}</p>
      </section>

      <AddProductForm sellerId={sellerProfile.id} onAdded={loadSellerData} />

      <section className="card">
        <h3>Your products ({myProducts.length})</h3>
        {error && <p className="feedback error">{error}</p>}

        {myProducts.length === 0 ? (
          <p className="muted">No products yet. Add your first one above.</p>
        ) : (
          <ul className="my-products">
            {myProducts.map((product) => (
              <li key={product.id} className="my-product-row">
                <div>
                  <strong>{product.name}</strong>
                  <p className="muted">{formatNaira(Number(product.price))}</p>
                </div>
                <div className="row-actions">
                  <span className={`badge ${product.status}`}>
                    {product.status === "active" ? "Active" : "Sold out"}
                  </span>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => toggleSoldOut(product)}
                  >
                    Mark {product.status === "active" ? "sold out" : "active"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
