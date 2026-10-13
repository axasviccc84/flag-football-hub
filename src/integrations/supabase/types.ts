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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["category"]
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["category"]
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["category"]
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          jersey: number
          match_id: string
          points: number
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          jersey: number
          match_id: string
          points?: number
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          jersey?: number
          match_id?: string
          points?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_id: string
          bracket_slot: number
          category: Database["public"]["Enums"]["category"]
          category_id: string | null
          created_at: string
          field: string
          group_name: string | null
          home_score: number
          home_team_id: string
          id: string
          phase: Database["public"]["Enums"]["match_phase"]
          round: number
          scheduled_at: string
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          away_score?: number
          away_team_id: string
          bracket_slot?: number
          category: Database["public"]["Enums"]["category"]
          category_id?: string | null
          created_at?: string
          field?: string
          group_name?: string | null
          home_score?: number
          home_team_id: string
          id?: string
          phase?: Database["public"]["Enums"]["match_phase"]
          round?: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          away_score?: number
          away_team_id?: string
          bracket_slot?: number
          category?: Database["public"]["Enums"]["category"]
          category_id?: string | null
          created_at?: string
          field?: string
          group_name?: string | null
          home_score?: number
          home_team_id?: string
          id?: string
          phase?: Database["public"]["Enums"]["match_phase"]
          round?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category: Database["public"]["Enums"]["category"]
          category_id: string | null
          created_at: string
          group_name: string | null
          id: string
          name: string
          short_name: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category"]
          category_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          name: string
          short_name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category"]
          category_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          name?: string
          short_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_score: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "planillero"
      category: "varonil" | "femenil" | "mixto"
      event_type:
        | "td"
        | "conv1"
        | "conv2"
        | "safety"
        | "int"
        | "sack"
        | "pass_td"
      match_phase: "grupos" | "cruce" | "semifinal" | "final"
      match_status: "programado" | "en_vivo" | "final"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "planillero"],
      category: ["varonil", "femenil", "mixto"],
      event_type: ["td", "conv1", "conv2", "safety", "int", "sack", "pass_td"],
      match_phase: ["grupos", "cruce", "semifinal", "final"],
      match_status: ["programado", "en_vivo", "final"],
    },
  },
} as const
