import { useCallback, useEffect, useState } from "react";
import { supabase, type Product, type SellerProfile } from "../lib/supabase";
import { formatNaira } from "../lib/format";
import { useCart } from "../contexts/CartContext";

import { sellerMapEmbedUrl, sellerMapUrl } from "../lib/maps";

type ProductDetail = Product & {
  seller_profiles: Pick<
    SellerProfile,
    "id" | "shop_name" | "address" | "description" | "latitude" | "longitude"
  > | null;
};

type Props = {
  productId: string;
  onBack: () => void;
  onAddedToCart: () => void;
};

export default function ProductDetail({ productId, onBack, onAddedToCart }: Props) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*, seller_profiles(id, shop_name, address, description, latitude, longitude)")
      .eq("id", productId)
      .eq("status", "active")
      .maybeSingle();

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    if (!data) {
      setError("Product not found or no longer available.");
      return;
    }

    setProduct(data as ProductDetail);
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  function handleAddToCart() {
    if (!product?.seller_profiles) return;

    const cartError = addItem(product, {
      id: product.seller_profiles.id,
      shop_name: product.seller_profiles.shop_name,
      address: product.seller_profiles.address,
    });

    if (cartError) {
      setCartMessage(cartError);
      return;
    }

    setCartMessage("Added to cart.");
    onAddedToCart();
  }

  if (loading) return <p className="muted">Loading product…</p>;
  if (error || !product) return <p className="feedback error">{error ?? "Product unavailable."}</p>;

  const shop = product.seller_profiles;

  return (
    <section className="stack">
      <button type="button" className="btn link" onClick={onBack}>
        ← Back to browse
      </button>

      <article className="card product-detail">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="product-image large" />
        ) : (
          <div className="product-image large placeholder">No image</div>
        )}

        <h2>{product.name}</h2>
        <p className="price large">{formatNaira(Number(product.price))}</p>
        {product.description && <p>{product.description}</p>}

        {shop && (
          <section className="seller-box">
            <h3>Sold by {shop.shop_name}</h3>
            {shop.description && <p className="muted">{shop.description}</p>}
            <p className="muted">📍 {shop.address}</p>
            <a
              href={sellerMapUrl({
                address: shop.address,
                latitude: shop.latitude,
                longitude: shop.longitude,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="btn link small"
            >
              Open seller location on map
            </a>
            {shop.latitude != null && shop.longitude != null && (
              <iframe
                title={`Map for ${shop.shop_name}`}
                className="seller-map"
                src={sellerMapEmbedUrl({
                  latitude: shop.latitude,
                  longitude: shop.longitude,
                })}
                loading="lazy"
              />
            )}
          </section>
        )}

        {cartMessage && (
          <p className={cartMessage.startsWith("Added") ? "feedback success" : "feedback error"}>
            {cartMessage}
          </p>
        )}

        <button type="button" className="btn primary" onClick={handleAddToCart}>
          Add to cart
        </button>
      </article>
    </section>
  );
}
