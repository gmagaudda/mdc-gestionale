export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: string;
          record_id: string | null;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      brand_contacts: {
        Row: {
          brand_id: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          phone: string;
          role_title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name: string;
          phone?: string;
          role_title?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          phone?: string;
          role_title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_contacts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_private: {
        Row: {
          address: string;
          city: string;
          commission_pct: number;
          country: string;
          created_at: string;
          id: string;
          notes: string;
          tax_code: string;
          updated_at: string;
          vat_number: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string;
          city?: string;
          commission_pct?: number;
          country?: string;
          created_at?: string;
          id: string;
          notes?: string;
          tax_code?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Update: {
          address?: string;
          city?: string;
          commission_pct?: number;
          country?: string;
          created_at?: string;
          id?: string;
          notes?: string;
          tax_code?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_private_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_users: {
        Row: {
          brand_id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_users_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          can_see_customer_names: boolean;
          created_at: string;
          deleted_at: string | null;
          external_code: string | null;
          id: string;
          legal_name: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          can_see_customer_names?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          legal_name?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          can_see_customer_names?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          legal_name?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_private: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          notes: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          id: string;
          notes?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          notes?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      budgets: {
        Row: {
          amount_cents: number;
          brand_id: string;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          id: string;
          period_end: string;
          period_start: string;
          season_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          brand_id: string;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          period_end: string;
          period_start: string;
          season_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          brand_id?: string;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          period_end?: string;
          period_start?: string;
          season_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_season_id_brand_id_fkey";
            columns: ["season_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      customer_contacts: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          phone: string;
          role_title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name: string;
          phone?: string;
          role_title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          phone?: string;
          role_title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          billing_address: NonNullable<Json>;
          city: string;
          country: string;
          created_at: string;
          deleted_at: string | null;
          external_code: string | null;
          id: string;
          legal_name: string;
          notes: string;
          payment_terms: string;
          pec: string;
          sdi_code: string;
          shipping_address: NonNullable<Json>;
          tax_code: string;
          trade_name: string;
          updated_at: string;
          vat_number: string;
        };
        ComputedFields: never;
        Insert: {
          billing_address?: NonNullable<Json>;
          city?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          legal_name: string;
          notes?: string;
          payment_terms?: string;
          pec?: string;
          sdi_code?: string;
          shipping_address?: NonNullable<Json>;
          tax_code?: string;
          trade_name?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Update: {
          billing_address?: NonNullable<Json>;
          city?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          legal_name?: string;
          notes?: string;
          payment_terms?: string;
          pec?: string;
          sdi_code?: string;
          shipping_address?: NonNullable<Json>;
          tax_code?: string;
          trade_name?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          brand_id: string;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["document_kind"];
          mime_type: string;
          name: string;
          order_id: string | null;
          original_filename: string;
          ready: boolean;
          shared_with_brand: boolean;
          size_bytes: number;
          storage_path: string;
          updated_at: string;
          uploaded_by: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["document_kind"];
          mime_type: string;
          name: string;
          order_id?: string | null;
          original_filename: string;
          ready?: boolean;
          shared_with_brand?: boolean;
          size_bytes: number;
          storage_path: string;
          updated_at?: string;
          uploaded_by?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["document_kind"];
          mime_type?: string;
          name?: string;
          order_id?: string | null;
          original_filename?: string;
          ready?: boolean;
          shared_with_brand?: boolean;
          size_bytes?: number;
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_reminders: {
        Row: {
          attempted_at: string;
          completed_at: string | null;
          event_id: string;
          id: string;
          lease_id: string;
          recipient_id: string;
          starts_at: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string;
          completed_at?: string | null;
          event_id: string;
          id?: string;
          lease_id?: string;
          recipient_id: string;
          starts_at: string;
          status?: string;
        };
        Update: {
          attempted_at?: string;
          completed_at?: string | null;
          event_id?: string;
          id?: string;
          lease_id?: string;
          recipient_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_reminders_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          all_day: boolean;
          assigned_to: string | null;
          brand_id: string | null;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          description: string;
          ends_at: string;
          id: string;
          location: string;
          starts_at: string;
          title: string;
          type: Database["public"]["Enums"]["event_type"];
          updated_at: string;
          visible_to_brand: boolean;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          assigned_to?: string | null;
          brand_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string;
          ends_at: string;
          id?: string;
          location?: string;
          starts_at: string;
          title: string;
          type?: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
          visible_to_brand?: boolean;
        };
        Update: {
          all_day?: boolean;
          assigned_to?: string | null;
          brand_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string;
          ends_at?: string;
          id?: string;
          location?: string;
          starts_at?: string;
          title?: string;
          type?: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
          visible_to_brand?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "events_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      ical_tokens: {
        Row: {
          created_at: string;
          id: string;
          revoked_at: string | null;
          token_hash: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          token_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          revoked_at?: string | null;
          token_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ical_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_counters: {
        Row: {
          created_at: string;
          last_number: number;
          updated_at: string;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          last_number: number;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          last_number?: number;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      order_lines: {
        Row: {
          brand_id: string;
          color: string;
          created_at: string;
          discount_pct: number;
          id: string;
          line_net_cents: number;
          line_vat_cents: number;
          order_id: string;
          product_name: string;
          quantity: number;
          size: string;
          sku: string;
          unit_price_cents: number;
          updated_at: string;
          variant_id: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          color: string;
          created_at?: string;
          discount_pct?: number;
          id?: string;
          line_net_cents: number;
          line_vat_cents: number;
          order_id: string;
          product_name: string;
          quantity: number;
          size: string;
          sku: string;
          unit_price_cents: number;
          updated_at?: string;
          variant_id: string;
          vat_rate: number;
        };
        Update: {
          brand_id?: string;
          color?: string;
          created_at?: string;
          discount_pct?: number;
          id?: string;
          line_net_cents?: number;
          line_vat_cents?: number;
          order_id?: string;
          product_name?: string;
          quantity?: number;
          size?: string;
          sku?: string;
          unit_price_cents?: number;
          updated_at?: string;
          variant_id?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "order_lines_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "order_lines_variant_id_brand_id_fkey";
            columns: ["variant_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      order_private: {
        Row: {
          brand_id: string;
          commission_pct_override: number | null;
          created_at: string;
          id: string;
          internal_notes: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          commission_pct_override?: number | null;
          created_at?: string;
          id: string;
          internal_notes?: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          commission_pct_override?: number | null;
          created_at?: string;
          id?: string;
          internal_notes?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "order_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          brand_id: string;
          changed_at: string;
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: string;
          note: string;
          order_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          changed_at?: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string;
          order_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          changed_at?: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string;
          order_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      orders: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_id: string;
          deleted_at: string | null;
          delivery_date: string | null;
          discount_pct: number;
          gross_total_cents: number;
          id: string;
          net_total_cents: number;
          number: string;
          order_date: string;
          payment_terms: string;
          season_id: string;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
          vat_total_cents: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id: string;
          deleted_at?: string | null;
          delivery_date?: string | null;
          discount_pct?: number;
          gross_total_cents?: number;
          id?: string;
          net_total_cents?: number;
          number: string;
          order_date?: string;
          payment_terms?: string;
          season_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          vat_total_cents?: number;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string;
          deleted_at?: string | null;
          delivery_date?: string | null;
          discount_pct?: number;
          gross_total_cents?: number;
          id?: string;
          net_total_cents?: number;
          number?: string;
          order_date?: string;
          payment_terms?: string;
          season_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
          vat_total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_season_id_brand_id_fkey";
            columns: ["season_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      product_variants: {
        Row: {
          brand_id: string;
          color: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          product_id: string;
          size: string;
          sku: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          color: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          product_id: string;
          size: string;
          sku: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          product_id?: string;
          size?: string;
          sku?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_brand_id_fkey";
            columns: ["product_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      products: {
        Row: {
          brand_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          name: string;
          retail_price_cents: number;
          season_id: string;
          sku_base: string;
          updated_at: string;
          vat_rate: number;
          wholesale_price_cents: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          name: string;
          retail_price_cents?: number;
          season_id: string;
          sku_base: string;
          updated_at?: string;
          vat_rate?: number;
          wholesale_price_cents: number;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          name?: string;
          retail_price_cents?: number;
          season_id?: string;
          sku_base?: string;
          updated_at?: string;
          vat_rate?: number;
          wholesale_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_season_id_brand_id_fkey";
            columns: ["season_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          brand_id: string;
          campaign_end: string | null;
          campaign_start: string | null;
          code: string;
          created_at: string;
          deleted_at: string | null;
          delivery_end: string | null;
          delivery_start: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          campaign_end?: string | null;
          campaign_start?: string | null;
          code: string;
          created_at?: string;
          deleted_at?: string | null;
          delivery_end?: string | null;
          delivery_start?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          campaign_end?: string | null;
          campaign_start?: string | null;
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          delivery_end?: string | null;
          delivery_start?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      portal_orders: {
        Row: {
          brand_id: string | null;
          currency: string | null;
          customer_city: string | null;
          customer_display_name: string | null;
          delivery_date: string | null;
          gross_total_cents: number | null;
          id: string | null;
          net_total_cents: number | null;
          number: string | null;
          order_date: string | null;
          season_id: string | null;
          status: Database["public"]["Enums"]["order_status"] | null;
          vat_total_cents: number | null;
        };
        ComputedFields: never;
        Insert: {
          brand_id?: string | null;
          currency?: string | null;
          customer_city?: never;
          customer_display_name?: never;
          delivery_date?: string | null;
          gross_total_cents?: number | null;
          id?: string | null;
          net_total_cents?: number | null;
          number?: string | null;
          order_date?: string | null;
          season_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"] | null;
          vat_total_cents?: number | null;
        };
        Update: {
          brand_id?: string | null;
          currency?: string | null;
          customer_city?: never;
          customer_display_name?: never;
          delivery_date?: string | null;
          gross_total_cents?: number | null;
          id?: string | null;
          net_total_cents?: number | null;
          number?: string | null;
          order_date?: string | null;
          season_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"] | null;
          vat_total_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_season_id_brand_id_fkey";
            columns: ["season_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
    };
    Functions: {
      calendar_assignees: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          full_name: string;
          id: string;
        }[];
      };
      change_order_status: {
        Args: {
          p_id: string;
          p_note?: string;
          p_status: Database["public"]["Enums"]["order_status"];
        };
        Returns: undefined;
      };
      claim_event_reminders: {
        Args: { p_end: string; p_start: string };
        Returns: {
          all_day: boolean;
          description: string;
          email: string;
          ends_at: string;
          event_id: string;
          lease_id: string;
          location: string;
          reminder_id: string;
          starts_at: string;
          title: string;
        }[];
      };
      duplicate_order: { Args: { p_id: string }; Returns: string };
      finish_event_reminder: {
        Args: { p_id: string; p_lease: string; p_status: string };
        Returns: boolean;
      };
      has_brand_access: { Args: { p_brand_id: string }; Returns: boolean };
      read_ical_feed: { Args: { p_hash: string }; Returns: Json };
      recalculate_order_totals: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      revoke_ical_token: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      rotate_ical_token: { Args: { p_hash: string }; Returns: undefined };
      save_brand: { Args: { p_data: Json; p_id: string }; Returns: string };
      save_budget: {
        Args: { p_data: Json; p_id: string; p_updated_at?: string };
        Returns: string;
      };
      save_order: {
        Args: { p_data: Json; p_id: string; p_lines: Json };
        Returns: string;
      };
      save_product: { Args: { p_data: Json; p_id: string }; Returns: string };
      save_user: {
        Args: {
          p_brand_ids: string[];
          p_full_name: string;
          p_id: string;
          p_is_active: boolean;
          p_role: Database["public"]["Enums"]["app_role"];
        };
        Returns: undefined;
      };
      write_audit: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_record_id: string;
          p_table_name: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "staff" | "accounting" | "brand";
      document_kind:
        | "catalog"
        | "lookbook"
        | "price_list"
        | "order_confirmation"
        | "contract"
        | "other";
      event_type:
        "appointment" | "campaign" | "delivery" | "payment_due" | "other";
      invoice_status:
        "draft" | "issued" | "sent" | "paid" | "cancelled" | "rejected";
      order_status:
        | "draft"
        | "confirmed"
        | "in_production"
        | "shipped"
        | "delivered"
        | "invoiced"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "staff", "accounting", "brand"],
      document_kind: [
        "catalog",
        "lookbook",
        "price_list",
        "order_confirmation",
        "contract",
        "other",
      ],
      event_type: [
        "appointment",
        "campaign",
        "delivery",
        "payment_due",
        "other",
      ],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "paid",
        "cancelled",
        "rejected",
      ],
      order_status: [
        "draft",
        "confirmed",
        "in_production",
        "shipped",
        "delivered",
        "invoiced",
        "cancelled",
      ],
    },
  },
} as const;
