import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, SellerProfile } from "../lib/supabase";

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CartSeller = Pick<SellerProfile, "id" | "shop_name" | "address">;

type CartContextValue = {
  items: CartItem[];
  seller: CartSeller | null;
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, seller: CartSeller) => string | null;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [seller, setSeller] = useState<CartSeller | null>(null);

  const addItem = useCallback(
    (product: Product, nextSeller: CartSeller): string | null => {
      if (product.status !== "active") {
        return "This product is not available.";
      }

      if (seller && seller.id !== product.seller_id) {
        return `Your cart has items from ${seller.shop_name}. Clear the cart first to buy from another shop.`;
      }

      setSeller(nextSeller);

      setItems((current) => {
        const existing = current.find((item) => item.product.id === product.id);
        if (existing) {
          return current.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [...current, { product, quantity: 1 }];
      });

      return null;
    },
    [seller]
  );

  const removeItem = useCallback((productId: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.product.id !== productId);
      if (next.length === 0) setSeller(null);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSeller(null);
  }, []);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0
      ),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      seller,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [items, seller, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
