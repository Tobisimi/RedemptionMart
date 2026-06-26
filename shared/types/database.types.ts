/**
 * Supabase database types for RedemptionMart.
 *
 * Regenerate after schema changes (requires linked Supabase project):
 *   npm run db:types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          phone: string | null;
          is_buyer: boolean;
          is_seller: boolean;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          phone?: string | null;
          is_buyer?: boolean;
          is_seller?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          phone?: string | null;
          is_buyer?: boolean;
          is_seller?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_profiles: {
        Row: {
          id: string;
          user_id: string;
          shop_name: string;
          description: string | null;
          latitude: number | null;
          longitude: number | null;
          address: string;
          bank_account_number: string | null;
          bank_code: string | null;
          bank_account_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shop_name: string;
          description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          address: string;
          bank_account_number?: string | null;
          bank_code?: string | null;
          bank_account_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          shop_name?: string;
          description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          address?: string;
          bank_account_number?: string | null;
          bank_code?: string | null;
          bank_account_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          seller_id: string;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          status: Database["public"]["Enums"]["product_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          image_url?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          seller_id: string;
          status: Database["public"]["Enums"]["order_status"];
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          delivery_address: string | null;
          total: number;
          payment_status: Database["public"]["Enums"]["payment_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          seller_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          delivery_address?: string | null;
          total: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          seller_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"];
          delivery_address?: string | null;
          total?: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit_price: number;
          quantity?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          unit_price?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      place_order: {
        Args: {
          p_seller_id: string;
          p_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          p_delivery_address: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      ensure_profile: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      product_status: "active" | "sold_out";
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "ready_for_pickup"
        | "delivered"
        | "completed"
        | "cancelled"
        | "disputed";
      fulfillment_type: "delivery" | "pickup";
      payment_status: "unpaid" | "paid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/** Spec "User" model — maps to public.profiles */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Spec "SellerProfile" model — maps to public.seller_profiles */
export type SellerProfile = Database["public"]["Tables"]["seller_profiles"]["Row"];

/** Spec "Product" model — maps to public.products */
export type Product = Database["public"]["Tables"]["products"]["Row"];

/** Spec "Order" model — maps to public.orders */
export type Order = Database["public"]["Tables"]["orders"]["Row"];

export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type SellerProfileInsert = Database["public"]["Tables"]["seller_profiles"]["Insert"];

export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type SellerProfileUpdate = Database["public"]["Tables"]["seller_profiles"]["Update"];
