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
      app_config: {
        Row: {
          int_val: number | null
          key: string
          updated_at: string
        }
        Insert: {
          int_val?: number | null
          key: string
          updated_at?: string
        }
        Update: {
          int_val?: number | null
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          amount: number
          created_at: string
          id: string
          market_id: string
          outcome_id: string
          price_at_bet: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          market_id: string
          outcome_id: string
          price_at_bet: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          market_id?: string
          outcome_id?: string
          price_at_bet?: number
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
            foreignKeyName: "bets_outcome_fk"
            columns: ["outcome_id", "market_id"]
            isOneToOne: false
            referencedRelation: "market_outcomes"
            referencedColumns: ["id", "market_id"]
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
      ledger_checks: {
        Row: {
          balanced: boolean
          checked_at: string
          delta: number
          detail: Json
          id: number
        }
        Insert: {
          balanced: boolean
          checked_at?: string
          delta: number
          detail: Json
          id?: never
        }
        Update: {
          balanced?: boolean
          checked_at?: string
          delta?: number
          detail?: Json
          id?: never
        }
        Relationships: []
      }
      market_outcomes: {
        Row: {
          created_at: string
          id: string
          is_catch_all: boolean
          label: string
          market_id: string
          pool: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_catch_all?: boolean
          label: string
          market_id: string
          pool?: number
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_catch_all?: boolean
          label?: string
          market_id?: string
          pool?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_outcomes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
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
          resolution_criteria: string
          resolve_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["market_status"]
          title: string
          winning_outcome_id: string | null
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
          resolution_criteria: string
          resolve_at: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title: string
          winning_outcome_id?: string | null
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
          resolution_criteria?: string
          resolve_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          title?: string
          winning_outcome_id?: string | null
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
          {
            foreignKeyName: "markets_winning_outcome_fk"
            columns: ["winning_outcome_id", "id"]
            isOneToOne: false
            referencedRelation: "market_outcomes"
            referencedColumns: ["id", "market_id"]
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
          outcome_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["mod_action_type"]
          created_at?: string
          id?: string
          market_id?: string | null
          moderator_id: string
          note?: string | null
          outcome_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["mod_action_type"]
          created_at?: string
          id?: string
          market_id?: string | null
          moderator_id?: string
          note?: string | null
          outcome_id?: string | null
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
      notifications: {
        Row: {
          created_at: string
          email_sent_at: string | null
          email_status: string
          id: string
          market_id: string | null
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          email_status?: string
          id?: string
          market_id?: string | null
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          email_status?: string
          id?: string
          market_id?: string | null
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
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
          implied: number
          market_id: string
          outcome_id: string
          pool: number
          recorded_at: string
        }
        Insert: {
          id?: number
          implied: number
          market_id: string
          outcome_id: string
          pool: number
          recorded_at?: string
        }
        Update: {
          id?: number
          implied?: number
          market_id?: string
          outcome_id?: string
          pool?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_outcome_fk"
            columns: ["outcome_id", "market_id"]
            isOneToOne: false
            referencedRelation: "market_outcomes"
            referencedColumns: ["id", "market_id"]
          },
        ]
      }
      profiles: {
        Row: {
          anon_handle: string
          created_at: string
          display_mode: Database["public"]["Enums"]["display_mode"]
          email: string
          email_notifications: boolean
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
          email_notifications?: boolean
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
          email_notifications?: boolean
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
      _outcome_map: { Args: { p_market_id: string }; Returns: Json }
      assert_can_manage_market: {
        Args: {
          p_market: Database["public"]["Tables"]["markets"]["Row"]
          p_uid: string
        }
        Returns: undefined
      }
      assert_can_moderate_market: {
        Args: {
          p_market: Database["public"]["Tables"]["markets"]["Row"]
          p_uid: string
        }
        Returns: undefined
      }
      check_cron_health: {
        Args: never
        Returns: {
          failed_runs: number
          jobid: number
          last_failure: string
          last_message: string
        }[]
      }
      claim_bailout: { Args: never; Returns: boolean }
      claim_daily_bonus: { Args: never; Returns: boolean }
      create_market: {
        Args: {
          p_auto_flagged?: boolean
          p_catch_all?: boolean
          p_category: Database["public"]["Enums"]["market_category"]
          p_close_at: string
          p_description: string
          p_outcomes: Json
          p_resolution_criteria: string
          p_resolve_at: string
          p_title: string
        }
        Returns: Json
      }
      gen_anon_handle: { Args: never; Returns: string }
      get_accuracy_leaderboard: {
        Args: { p_resolved_before?: string; p_semester_id: string }
        Returns: {
          display_name: string
          losses: number
          rank: number
          user_id: string
          volume: number
          win_rate: number
          wins: number
        }[]
      }
      get_balance: { Args: { p_user_id: string }; Returns: number }
      get_current_semester: {
        Args: never
        Returns: {
          ends_at: string
          id: string
          name: string
          starts_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "semesters"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_market_card: { Args: { p_market_id: string }; Returns: Json }
      get_my_balance: { Args: never; Returns: number }
      get_platform_volume: { Args: never; Returns: number }
      get_profile_stats: {
        Args: { p_resolved_before?: string; p_user: string }
        Returns: Json
      }
      get_semester_leaderboard: {
        Args: { p_limit?: number; p_semester_id: string }
        Returns: {
          display_name: string
          rank: number
          score: number
          user_id: string
        }[]
      }
      get_share_card: { Args: { p_bet_id: string }; Returns: Json }
      handle_report: {
        Args: { p_action: string; p_note?: string; p_report_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      lock_market: { Args: { p_market_id: string }; Returns: undefined }
      place_bet: {
        Args: { p_amount: number; p_market_id: string; p_outcome_id: string }
        Returns: Json
      }
      price_history_growth: { Args: never; Returns: Json }
      reopen_semester: { Args: { p_semester_id: string }; Returns: number }
      reroll_anon_handle: { Args: never; Returns: string }
      resolve_market: {
        Args: {
          p_action: string
          p_market_id: string
          p_winning_outcome_id?: string
        }
        Returns: Json
      }
      review_market: {
        Args: { p_action: string; p_market_id: string }
        Returns: undefined
      }
      review_mod_application: {
        Args: { p_application_id: string; p_decision: string }
        Returns: undefined
      }
      revoke_moderator: { Args: { p_user_id: string }; Returns: undefined }
      set_market_hidden: {
        Args: { p_hidden: boolean; p_market_id: string }
        Returns: undefined
      }
      snapshot_semester: { Args: { p_semester_id: string }; Returns: number }
      update_market: {
        Args: {
          p_auto_flagged?: boolean
          p_catch_all?: boolean
          p_category: Database["public"]["Enums"]["market_category"]
          p_close_at: string
          p_description: string
          p_market_id: string
          p_outcomes: Json
          p_resolution_criteria: string
          p_resolve_at: string
          p_title: string
        }
        Returns: Json
      }
      verify_ledger_invariant: { Args: never; Returns: Json }
    }
    Enums: {
      application_status: "pending" | "approved" | "rejected"
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
        | "resolved"
        | "voided"
        | "pending"
        | "rejected"
      mod_action_type:
        | "resolve"
        | "void"
        | "lock"
        | "report_dismiss"
        | "report_action"
        | "hide"
        | "mod_revoke"
        | "approve_market"
        | "reject_market"
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
        "resolved",
        "voided",
        "pending",
        "rejected",
      ],
      mod_action_type: [
        "resolve",
        "void",
        "lock",
        "report_dismiss",
        "report_action",
        "hide",
        "mod_revoke",
        "approve_market",
        "reject_market",
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
