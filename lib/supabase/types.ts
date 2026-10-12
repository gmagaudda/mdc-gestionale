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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
          legal_name?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brands_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
          },
        ];
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
          {
            foreignKeyName: "budget_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_budget_vs_actual";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "budget_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_budget_vs_previous_season";
            referencedColumns: ["budget_id", "brand_id"];
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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
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
            foreignKeyName: "budgets_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
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
          area: string;
          billing_address: NonNullable<Json>;
          category: string;
          city: string;
          country: string;
          created_at: string;
          deleted_at: string | null;
          external_code: string | null;
          id: string;
          import_batch_id: string | null;
          legal_name: string;
          notes: string;
          payment_terms: string;
          pec: string;
          representative: string;
          sdi_code: string;
          shipping_address: NonNullable<Json>;
          tax_code: string;
          trade_name: string;
          updated_at: string;
          vat_number: string;
        };
        ComputedFields: never;
        Insert: {
          area?: string;
          billing_address?: NonNullable<Json>;
          category?: string;
          city?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          import_batch_id?: string | null;
          legal_name: string;
          notes?: string;
          payment_terms?: string;
          pec?: string;
          representative?: string;
          sdi_code?: string;
          shipping_address?: NonNullable<Json>;
          tax_code?: string;
          trade_name?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Update: {
          area?: string;
          billing_address?: NonNullable<Json>;
          category?: string;
          city?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          external_code?: string | null;
          id?: string;
          import_batch_id?: string | null;
          legal_name?: string;
          notes?: string;
          payment_terms?: string;
          pec?: string;
          representative?: string;
          sdi_code?: string;
          shipping_address?: NonNullable<Json>;
          tax_code?: string;
          trade_name?: string;
          updated_at?: string;
          vat_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
          },
        ];
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
            foreignKeyName: "documents_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
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
            foreignKeyName: "event_reminders_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "portal_events";
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
      import_batches: {
        Row: {
          budget_season_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          expected_totals: NonNullable<Json>;
          file_expires_at: string;
          file_name: string;
          file_removed_at: string | null;
          file_sha256: string;
          id: string;
          kind: string;
          options: NonNullable<Json>;
          profile_id: string | null;
          rolled_back_at: string | null;
          season_id: string | null;
          size_bytes: number;
          stats: NonNullable<Json>;
          status: string;
          storage_path: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget_season_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          expected_totals?: NonNullable<Json>;
          file_expires_at?: string;
          file_name: string;
          file_removed_at?: string | null;
          file_sha256: string;
          id?: string;
          kind: string;
          options?: NonNullable<Json>;
          profile_id?: string | null;
          rolled_back_at?: string | null;
          season_id?: string | null;
          size_bytes: number;
          stats?: NonNullable<Json>;
          status?: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          budget_season_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          expected_totals?: NonNullable<Json>;
          file_expires_at?: string;
          file_name?: string;
          file_removed_at?: string | null;
          file_sha256?: string;
          id?: string;
          kind?: string;
          options?: NonNullable<Json>;
          profile_id?: string | null;
          rolled_back_at?: string | null;
          season_id?: string | null;
          size_bytes?: number;
          stats?: NonNullable<Json>;
          status?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_budget_season_id_fkey";
            columns: ["budget_season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_budget_season_id_fkey";
            columns: ["budget_season_id"];
            isOneToOne: false;
            referencedRelation: "v_budget_vs_previous_season";
            referencedColumns: ["previous_season_id"];
          },
          {
            foreignKeyName: "import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "import_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "v_budget_vs_previous_season";
            referencedColumns: ["previous_season_id"];
          },
        ];
      };
      import_profiles: {
        Row: {
          created_at: string;
          created_by: string;
          entity: string;
          header_row: number;
          id: string;
          mapping: NonNullable<Json>;
          name: string;
          options: NonNullable<Json>;
          sheet_name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          entity: string;
          header_row: number;
          id?: string;
          mapping: NonNullable<Json>;
          name: string;
          options?: NonNullable<Json>;
          sheet_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          entity?: string;
          header_row?: number;
          id?: string;
          mapping?: NonNullable<Json>;
          name?: string;
          options?: NonNullable<Json>;
          sheet_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      import_rows: {
        Row: {
          batch_id: string;
          created_at: string;
          entity: string;
          id: string;
          mapped: NonNullable<Json>;
          match: NonNullable<Json>;
          messages: NonNullable<Json>;
          raw: NonNullable<Json>;
          row_number: number;
          sheet: string;
          status: string;
          target_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          created_at?: string;
          entity: string;
          id?: string;
          mapped: NonNullable<Json>;
          match?: NonNullable<Json>;
          messages?: NonNullable<Json>;
          raw: NonNullable<Json>;
          row_number: number;
          sheet: string;
          status: string;
          target_id?: string | null;
          updated_at?: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          entity?: string;
          id?: string;
          mapped?: NonNullable<Json>;
          match?: NonNullable<Json>;
          messages?: NonNullable<Json>;
          raw?: NonNullable<Json>;
          row_number?: number;
          sheet?: string;
          status?: string;
          target_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
          },
        ];
      };
      invoice_counters: {
        Row: {
          brand_id: string;
          created_at: string;
          id: string;
          last_number: number;
          updated_at: string;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          id?: string;
          last_number: number;
          updated_at?: string;
          year: number;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          id?: string;
          last_number?: number;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_counters_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_webhook_events: {
        Row: {
          brand_id: string;
          created_at: string;
          event_id: string;
          external_status: Database["public"]["Enums"]["invoice_status"];
          fic_digest: string | null;
          id: string;
          invoice_id: string;
          provider: string;
          reconcile_error: boolean;
          reconcile_lease: string | null;
          reconcile_pending: boolean;
          reconcile_started_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          event_id: string;
          external_status: Database["public"]["Enums"]["invoice_status"];
          fic_digest?: string | null;
          id?: string;
          invoice_id: string;
          provider: string;
          reconcile_error?: boolean;
          reconcile_lease?: string | null;
          reconcile_pending?: boolean;
          reconcile_started_at?: string | null;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          event_id?: string;
          external_status?: Database["public"]["Enums"]["invoice_status"];
          fic_digest?: string | null;
          id?: string;
          invoice_id?: string;
          provider?: string;
          reconcile_error?: boolean;
          reconcile_lease?: string | null;
          reconcile_pending?: boolean;
          reconcile_started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_webhook_events_invoice_id_brand_id_fkey";
            columns: ["invoice_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "invoice_webhook_events_invoice_id_brand_id_fkey";
            columns: ["invoice_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      invoices: {
        Row: {
          brand_id: string;
          created_at: string;
          currency: string;
          customer_id: string;
          customer_snapshot: Json | null;
          due_date: string;
          external_id: string | null;
          external_status: string | null;
          fic_company_id: number | null;
          fic_document_id: number | null;
          fic_document_number: string | null;
          fic_request_fingerprint: string | null;
          fic_request_state: string | null;
          gross_cents: number;
          id: string;
          idempotency_key: string;
          issue_date: string;
          lines_snapshot: Json | null;
          net_cents: number;
          number: string;
          order_discount_pct: number;
          order_id: string | null;
          payment_terms: string;
          pdf_path: string | null;
          processing_error: string | null;
          processing_kind: string;
          processing_lease: string | null;
          processing_started_at: string | null;
          processing_status: string;
          provider: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          supplier_snapshot: Json | null;
          updated_at: string;
          vat_cents: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          currency?: string;
          customer_id: string;
          customer_snapshot?: Json | null;
          due_date: string;
          external_id?: string | null;
          external_status?: string | null;
          fic_company_id?: number | null;
          fic_document_id?: number | null;
          fic_document_number?: string | null;
          fic_request_fingerprint?: string | null;
          fic_request_state?: string | null;
          gross_cents: number;
          id?: string;
          idempotency_key?: string;
          issue_date: string;
          lines_snapshot?: Json | null;
          net_cents: number;
          number: string;
          order_discount_pct?: number;
          order_id?: string | null;
          payment_terms?: string;
          pdf_path?: string | null;
          processing_error?: string | null;
          processing_kind?: string;
          processing_lease?: string | null;
          processing_started_at?: string | null;
          processing_status?: string;
          provider?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          supplier_snapshot?: Json | null;
          updated_at?: string;
          vat_cents: number;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          customer_snapshot?: Json | null;
          due_date?: string;
          external_id?: string | null;
          external_status?: string | null;
          fic_company_id?: number | null;
          fic_document_id?: number | null;
          fic_document_number?: string | null;
          fic_request_fingerprint?: string | null;
          fic_request_state?: string | null;
          gross_cents?: number;
          id?: string;
          idempotency_key?: string;
          issue_date?: string;
          lines_snapshot?: Json | null;
          net_cents?: number;
          number?: string;
          order_discount_pct?: number;
          order_id?: string | null;
          payment_terms?: string;
          pdf_path?: string | null;
          processing_error?: string | null;
          processing_kind?: string;
          processing_lease?: string | null;
          processing_started_at?: string | null;
          processing_status?: string;
          provider?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          supplier_snapshot?: Json | null;
          updated_at?: string;
          vat_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      mock_invoice_records: {
        Row: {
          brand_id: string;
          created_at: string;
          external_id: string;
          fingerprint: string;
          id: string;
          idempotency_key: string;
          status: Database["public"]["Enums"]["invoice_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          external_id: string;
          fingerprint: string;
          id: string;
          idempotency_key: string;
          status: Database["public"]["Enums"]["invoice_status"];
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          external_id?: string;
          fingerprint?: string;
          id?: string;
          idempotency_key?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mock_invoice_records_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "mock_invoice_records_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
            referencedColumns: ["id", "brand_id"];
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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
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
            foreignKeyName: "order_lines_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
          },
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
            foreignKeyName: "order_lines_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
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
          {
            foreignKeyName: "order_private_id_brand_id_fkey";
            columns: ["id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
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
          {
            foreignKeyName: "order_status_history_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
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
          external_ref: string | null;
          gross_total_cents: number;
          id: string;
          import_batch_id: string | null;
          import_granularity: string | null;
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
          external_ref?: string | null;
          gross_total_cents?: number;
          id?: string;
          import_batch_id?: string | null;
          import_granularity?: string | null;
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
          external_ref?: string | null;
          gross_total_cents?: number;
          id?: string;
          import_batch_id?: string | null;
          import_granularity?: string | null;
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
            foreignKeyName: "orders_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
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
      payments: {
        Row: {
          amount_cents: number;
          brand_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          idempotency_key: string;
          invoice_id: string;
          method: string;
          note: string;
          paid_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          brand_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string;
          invoice_id: string;
          method: string;
          note?: string;
          paid_at: string;
        };
        Update: {
          amount_cents?: number;
          brand_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string;
          invoice_id?: string;
          method?: string;
          note?: string;
          paid_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_invoice_id_brand_id_fkey";
            columns: ["invoice_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "payments_invoice_id_brand_id_fkey";
            columns: ["invoice_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_invoice_balances";
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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
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
            foreignKeyName: "product_variants_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
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
            foreignKeyName: "products_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
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
      push_deliveries: {
        Row: {
          attempted_at: string;
          attempts: number;
          completed_at: string | null;
          event_id: string;
          id: string;
          lease_id: string;
          starts_at: string;
          status: string;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string;
          attempts?: number;
          completed_at?: string | null;
          event_id: string;
          id?: string;
          lease_id?: string;
          starts_at: string;
          status?: string;
          subscription_id: string;
        };
        Update: {
          attempted_at?: string;
          attempts?: number;
          completed_at?: string | null;
          event_id?: string;
          id?: string;
          lease_id?: string;
          starts_at?: string;
          status?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "portal_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "push_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_test_at: string | null;
          p256dh: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_test_at?: string | null;
          p256dh: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_test_at?: string | null;
          p256dh?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          import_batch_id: string | null;
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
          import_batch_id?: string | null;
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
          import_batch_id?: string | null;
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
          {
            foreignKeyName: "seasons_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasons_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "v_import_batch_totals";
            referencedColumns: ["batch_id"];
          },
        ];
      };
    };
    Views: {
      portal_documents: {
        Row: {
          brand_id: string | null;
          brand_name: string | null;
          created_at: string | null;
          id: string | null;
          kind: Database["public"]["Enums"]["document_kind"] | null;
          name: string | null;
          size_bytes: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "documents_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_events: {
        Row: {
          all_day: boolean | null;
          brand_id: string | null;
          description: string | null;
          ends_at: string | null;
          id: string | null;
          location: string | null;
          starts_at: string | null;
          title: string | null;
          type: Database["public"]["Enums"]["event_type"] | null;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean | null;
          brand_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string | null;
          location?: string | null;
          starts_at?: string | null;
          title?: string | null;
          type?: Database["public"]["Enums"]["event_type"] | null;
        };
        Update: {
          all_day?: boolean | null;
          brand_id?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string | null;
          location?: string | null;
          starts_at?: string | null;
          title?: string | null;
          type?: Database["public"]["Enums"]["event_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
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
      v_budget_vs_actual: {
        Row: {
          brand_id: string | null;
          budget_cents: string | null;
          customer_id: string | null;
          difference_cents: string | null;
          difference_pct: string | null;
          id: string | null;
          period_end: string | null;
          period_start: string | null;
          revenue_cents: string | null;
          season_id: string | null;
          sold_cents: string | null;
        };
        ComputedFields: never;
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
      v_budget_vs_previous_season: {
        Row: {
          brand_id: string | null;
          budget_cents: string | null;
          budget_id: string | null;
          budget_season: string | null;
          budget_season_id: string | null;
          customer_id: string | null;
          difference_cents: string | null;
          difference_pct: string | null;
          previous_season: string | null;
          previous_season_id: string | null;
          sold_cents: string | null;
        };
        ComputedFields: never;
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
            columns: ["budget_season_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      v_commissions: {
        Row: {
          brand_id: string | null;
          brand_name: string | null;
          commission_cents: string | null;
          commission_pct: string | null;
          has_override: boolean | null;
          id: string | null;
          net_cents: string | null;
          number: string | null;
          order_date: string | null;
          season_id: string | null;
        };
        ComputedFields: never;
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
      v_import_batch_totals: {
        Row: {
          batch_id: string | null;
          brand: string | null;
          customers: number | null;
          gross_cents: string | null;
          net_cents: string | null;
          orders: number | null;
          pieces: number | null;
          season: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_invoice_balances: {
        Row: {
          balance_cents: string | null;
          brand_id: string | null;
          customer_id: string | null;
          due_date: string | null;
          gross_cents: number | null;
          id: string | null;
          issue_date: string | null;
          net_cents: number | null;
          number: string | null;
          order_id: string | null;
          overdue: boolean | null;
          paid_cents: string | null;
          processing_status: string | null;
          provider: string | null;
          status: Database["public"]["Enums"]["invoice_status"] | null;
          vat_cents: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "invoices_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "portal_orders";
            referencedColumns: ["id", "brand_id"];
          },
          {
            foreignKeyName: "invoices_order_id_brand_id_fkey";
            columns: ["order_id", "brand_id"];
            isOneToOne: false;
            referencedRelation: "v_commissions";
            referencedColumns: ["id", "brand_id"];
          },
        ];
      };
      v_revenue_by_brand_period: {
        Row: {
          brand_id: string | null;
          invoice_count: number | null;
          month: string | null;
          net_cents: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "invoices_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      v_sales_by_brand_season: {
        Row: {
          brand_id: string | null;
          net_total_cents: string | null;
          order_count: number | null;
          season_id: string | null;
        };
        ComputedFields: never;
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
      v_sales_by_customer: {
        Row: {
          brand_id: string | null;
          customer_city: string | null;
          customer_display_name: string | null;
          customer_id: string | null;
          net_total_cents: string | null;
          order_count: number | null;
          season_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "orders_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
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
    };
    Functions: {
      apply_invoice_webhook: {
        Args: {
          p_event_id: string;
          p_external_id: string;
          p_provider: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: boolean;
      };
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
      claim_fic_webhooks: { Args: Record<PropertyKey, never>; Returns: Json };
      claim_invoice_cancellation: { Args: { p_id: string }; Returns: string };
      claim_invoice_issue: { Args: { p_id: string }; Returns: string };
      claim_push_reminders: {
        Args: { p_end: string; p_start: string };
        Returns: {
          auth: string;
          delivery_id: string;
          endpoint: string;
          lease_id: string;
          p256dh: string;
          subscription_id: string;
        }[];
      };
      claim_push_test: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string };
        Returns: boolean;
      };
      commissions_report: {
        Args: {
          p_brand_id?: string;
          p_end?: string;
          p_limit?: number;
          p_offset?: number;
          p_season_id?: string;
          p_start?: string;
        };
        Returns: Json;
      };
      complete_performance_import: {
        Args: { p_confirm_differences?: boolean; p_id: string };
        Returns: Json;
      };
      configure_import_batch:
        | {
            Args: { p_expected: Json; p_id: string; p_options: Json };
            Returns: undefined;
          }
        | {
            Args: {
              p_expected: Json;
              p_id: string;
              p_options: Json;
              p_previous_revision: string;
            };
            Returns: undefined;
          };
      dashboard_report: {
        Args: {
          p_brand_id?: string;
          p_end?: string;
          p_season_id?: string;
          p_start?: string;
        };
        Returns: Json;
      };
      duplicate_order: { Args: { p_id: string }; Returns: string };
      enqueue_fic_webhook: {
        Args: {
          p_company_id: number;
          p_digest: string;
          p_document_ids: number[];
          p_event_id: string;
        };
        Returns: number;
      };
      exclude_import_errors: {
        Args: { p_id: string; p_revision: string; p_rows: string[] };
        Returns: number;
      };
      fail_fic_webhook: {
        Args: { p_id: string; p_lease: string };
        Returns: undefined;
      };
      fail_import_upload: { Args: { p_id: string }; Returns: undefined };
      fail_invoice_issue: {
        Args: { p_error: string; p_id: string; p_lease: string };
        Returns: boolean;
      };
      fic_definite_failure: { Args: { p_id: string }; Returns: undefined };
      fic_link_invoice: {
        Args: { p_document_id: number; p_id: string; p_number: string };
        Returns: undefined;
      };
      fic_mark_attempt: { Args: { p_id: string }; Returns: boolean };
      fic_prepare_invoice: {
        Args: { p_company_id: number; p_fingerprint: string; p_id: string };
        Returns: Json;
      };
      finish_event_reminder: {
        Args: { p_id: string; p_lease: string; p_status: string };
        Returns: boolean;
      };
      finish_fic_webhook: {
        Args: {
          p_id: string;
          p_lease: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: boolean;
      };
      finish_import_file_retention: {
        Args: { p_id: string };
        Returns: boolean;
      };
      finish_import_staging: {
        Args: { p_counts: Json; p_id: string; p_revision: string };
        Returns: undefined;
      };
      finish_invoice_cancellation: {
        Args: { p_id: string; p_lease: string };
        Returns: boolean;
      };
      finish_invoice_issue: {
        Args: {
          p_external_id: string;
          p_id: string;
          p_lease: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: boolean;
      };
      finish_push_reminder: {
        Args: {
          p_expired?: boolean;
          p_id: string;
          p_lease: string;
          p_status: string;
        };
        Returns: boolean;
      };
      has_brand_access: { Args: { p_brand_id: string }; Returns: boolean };
      has_push_subscription: { Args: { p_endpoint: string }; Returns: boolean };
      import_batch_report: {
        Args: { p_export?: boolean; p_id: string; p_page?: number };
        Returns: Json;
      };
      import_commit: {
        Args: {
          p_confirm_differences?: boolean;
          p_confirm_updates?: boolean;
          p_id: string;
        };
        Returns: Json;
      };
      import_matching: {
        Args: { p_id: string; p_page?: number; p_threshold?: number };
        Returns: Json;
      };
      import_preview: {
        Args: { p_id: string; p_page?: number };
        Returns: Json;
      };
      import_rollback: { Args: { p_id: string }; Returns: undefined };
      import_totals: { Args: { p_id: string }; Returns: Json };
      mock_invoice_put: {
        Args: {
          p_fingerprint: string;
          p_id: string;
          p_key: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: Json;
      };
      mock_invoice_transition: {
        Args: {
          p_external_id: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: Json;
      };
      performance_report: {
        Args: { p_dimension?: string; p_filters?: Json; p_id: string };
        Returns: Json;
      };
      portal_dashboard_report: {
        Args: {
          p_brand_id?: string;
          p_end?: string;
          p_season_id?: string;
          p_start?: string;
        };
        Returns: Json;
      };
      portal_orders_report: {
        Args: {
          p_brand_id?: string;
          p_end?: string;
          p_limit?: number;
          p_offset?: number;
          p_season_id?: string;
          p_start?: string;
          p_status?: Database["public"]["Enums"]["order_status"];
        };
        Returns: Json;
      };
      portal_sales_report: {
        Args: {
          p_brand_id?: string;
          p_end?: string;
          p_limit?: number;
          p_offset?: number;
          p_season_id?: string;
          p_start?: string;
        };
        Returns: Json;
      };
      read_ical_feed: { Args: { p_hash: string }; Returns: Json };
      recalculate_order_totals: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      reconcile_invoice_status: {
        Args: {
          p_external_id: string;
          p_id: string;
          p_status: Database["public"]["Enums"]["invoice_status"];
        };
        Returns: undefined;
      };
      register_invoice_payment: {
        Args: {
          p_amount: number;
          p_id: string;
          p_key: string;
          p_method: string;
          p_note?: string;
          p_paid_at: string;
        };
        Returns: string;
      };
      release_invoice_cancellation: {
        Args: { p_id: string; p_lease: string };
        Returns: boolean;
      };
      reserve_invoice_from_order: {
        Args: {
          p_due_date: string;
          p_issue_date: string;
          p_order_id: string;
          p_provider: string;
        };
        Returns: string;
      };
      resolve_import_match: {
        Args: {
          p_choice: Json;
          p_id: string;
          p_kind: string;
          p_revision: string;
          p_subject: Json;
        };
        Returns: number;
      };
      revoke_ical_token: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      revoke_push_subscription: {
        Args: { p_endpoint?: string };
        Returns: undefined;
      };
      rollback_performance_import: {
        Args: { p_id: string };
        Returns: undefined;
      };
      rotate_ical_token: { Args: { p_hash: string }; Returns: undefined };
      save_brand: { Args: { p_data: Json; p_id: string }; Returns: string };
      save_budget: {
        Args: { p_data: Json; p_id: string; p_updated_at?: string };
        Returns: string;
      };
      save_import_profile: {
        Args: { p_data: Json; p_id: string };
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
      set_import_expected: {
        Args: { p_expected: Json; p_id: string; p_revision: string };
        Returns: undefined;
      };
      stage_import_rows:
        | { Args: { p_id: string; p_rows: Json }; Returns: number }
        | {
            Args: { p_id: string; p_revision: string; p_rows: Json };
            Returns: number;
          };
      start_import_batch:
        | {
            Args: {
              p_filename: string;
              p_id: string;
              p_kind: string;
              p_sha256: string;
              p_size: number;
            };
            Returns: string;
          }
        | {
            Args: {
              p_filename: string;
              p_id: string;
              p_kind: string;
              p_retention_days: number;
              p_sha256: string;
              p_size: number;
            };
            Returns: string;
          };
      subscribe_push: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string };
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
