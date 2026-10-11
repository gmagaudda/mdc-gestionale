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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_brand_access: { Args: { p_brand_id: string }; Returns: boolean };
      save_brand: { Args: { p_data: Json; p_id: string }; Returns: string };
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
