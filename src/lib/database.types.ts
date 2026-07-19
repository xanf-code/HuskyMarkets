export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          amount: number
          created_at: string
          id: string
          market_id: string
          price_at_bet: number
          side: Database["public"]["Enums"]["bet_side"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          market_id: string
          price_at_bet: number
          side: Database["public"]["Enums"]["bet_side"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          market_id?: string
          price_at_bet?: number
          side?: Database["public"]["Enums"]["bet_side"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hall_of_fame: {
        Row: {
          display_name_snapshot: string
          id: string
          rank: number
          score: number
          semester_id: string
          user_id: string
        }
        Insert: {
          display_name_snapshot: string
          id?: string
          rank: number
          score: number
          semester_id: string
          user_id: string
        }
        Update: {
          display_name_snapshot?: string
          id?: string
          rank?: number
          score?: number
          semester_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hall_of_fame_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_of_fame_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hall_of_fame_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          auto_flagged: boolean
          category: Database["public"]["Enums"]["market_category"]
          close_at: string
          created_at: string
          creator_id: string
          description: string | null
          hidden: boolean
          id: string
          no_pool: number
          resolution_criteria: string
          resolve_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["market_status"]
          title: string
          yes_pool: number
        }
        Insert: {
          auto_flagged?: boolean
          category: Database["public"]["Enums"]["market_category"]
          close_at: string
          created_at?: string
          creator_id: string
          description?: string | null
          hidden?: boolean
          id?: string
          no_pool?: number
          resolution_criteria: string
          resolve_at: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title: string
          yes_pool?: number
        }
        Update: {
          auto_flagged?: boolean
          category?: Database["public"]["Enums"]["market_category"]
          close_at?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          hidden?: boolean
          id?: string
          no_pool?: number
          resolution_criteria?: string
          resolve_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title?: string
          yes_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "markets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_actions: {
        Row: {
          action: Database["public"]["Enums"]["mod_action_type"]
          created_at: string
          id: string
          market_id: string | null
          moderator_id: string
          note: string | null
          target_user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["mod_action_type"]
          created_at?: string
          id?: string
          market_id?: string | null
          moderator_id: string
          note?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["mod_action_type"]
          created_at?: string
          id?: string
          market_id?: string | null
          moderator_id?: string
          note?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mod_actions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_applications: {
        Row: {
          created_at: string
          id: string
          reviewed_by: string | null
          statement: string
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_by?: string | null
          statement: string
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_by?: string | null
          statement?: string
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mod_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          id: number
          implied_yes: number
          market_id: string
          no_pool: number
          recorded_at: string
          yes_pool: number
        }
        Insert: {
          id?: number
          implied_yes: number
          market_id: string
          no_pool: number
          recorded_at?: string
          yes_pool: number
        }
        Update: {
          id?: number
          implied_yes?: number
          market_id?: string
          no_pool?: number
          recorded_at?: string
          yes_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anon_handle: string
          created_at: string
          display_mode: Database["public"]["Enums"]["display_mode"]
          email: string
          id: string
          onboarded: boolean
          real_name: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          anon_handle: string
          created_at?: string
          display_mode?: Database["public"]["Enums"]["display_mode"]
          email: string
          id: string
          onboarded?: boolean
          real_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          anon_handle?: string
          created_at?: string
          display_mode?: Database["public"]["Enums"]["display_mode"]
          email?: string
          id?: string
          onboarded?: boolean
          real_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          handled_by: string | null
          id: string
          market_id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          handled_by?: string | null
          id?: string
          market_id: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          handled_by?: string | null
          id?: string
          market_id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          ends_at: string
          id: string
          name: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          name: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          bet_id: string | null
          created_at: string
          day_key: string | null
          id: string
          market_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string | null
        }
        Insert: {
          amount: number
          bet_id?: string | null
          created_at?: string
          day_key?: string | null
          id?: string
          market_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          bet_id?: string | null
          created_at?: string
          day_key?: string | null
          id?: string
          market_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          display_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          display_name?: never
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          display_name?: never
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_can_moderate_market: {
        Args: {
          p_market: Database["public"]["Tables"]["markets"]["Row"]
          p_uid: string
        }
        Returns: undefined
      }
      claim_bailout: { Args: never; Returns: boolean }
      claim_daily_bonus: { Args: never; Returns: boolean }
      gen_anon_handle: { Args: never; Returns: string }
      get_balance: { Args: { p_user_id: string }; Returns: number }
      get_my_balance: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      lock_market: { Args: { p_market_id: string }; Returns: undefined }
      place_bet: {
        Args: {
          p_amount: number
          p_market_id: string
          p_side: Database["public"]["Enums"]["bet_side"]
        }
        Returns: Json
      }
      reroll_anon_handle: { Args: never; Returns: string }
      resolve_market: {
        Args: { p_market_id: string; p_outcome: string }
        Returns: Json
      }
    }
    Enums: {
      application_status: "pending" | "approved" | "rejected"
      bet_side: "yes" | "no"
      display_mode: "real" | "anon"
      market_category:
        | "campus"
        | "transit"
        | "weather"
        | "sports"
        | "academics"
        | "dining"
        | "wildcard"
      market_status:
        | "open"
        | "closed"
        | "resolved_yes"
        | "resolved_no"
        | "voided"
      mod_action_type:
        | "resolve_yes"
        | "resolve_no"
        | "void"
        | "lock"
        | "report_dismiss"
        | "report_action"
        | "hide"
        | "mod_revoke"
      report_status: "open" | "dismissed" | "actioned"
      tx_type:
        | "signup_grant"
        | "daily_bonus"
        | "bailout"
        | "bet_place"
        | "bet_payout"
        | "vig_burn"
        | "market_refund"
      user_role: "user" | "moderator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: ["pending", "approved", "rejected"],
      bet_side: ["yes", "no"],
      display_mode: ["real", "anon"],
      market_category: [
        "campus",
        "transit",
        "weather",
        "sports",
        "academics",
        "dining",
        "wildcard",
      ],
      market_status: [
        "open",
        "closed",
        "resolved_yes",
        "resolved_no",
        "voided",
      ],
      mod_action_type: [
        "resolve_yes",
        "resolve_no",
        "void",
        "lock",
        "report_dismiss",
        "report_action",
        "hide",
        "mod_revoke",
      ],
      report_status: ["open", "dismissed", "actioned"],
      tx_type: [
        "signup_grant",
        "daily_bonus",
        "bailout",
        "bet_place",
        "bet_payout",
        "vig_burn",
        "market_refund",
      ],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const
