export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      habit_completions: {
        Row: {
          completed_at: string
          habit_id: string
          id: string
          notes: string | null
          points_earned: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          habit_id: string
          id?: string
          notes?: string | null
          points_earned?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          habit_id?: string
          id?: string
          notes?: string | null
          points_earned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "habit_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      habits: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string
          description: string | null
          frequency: Database["public"]["Enums"]["habit_frequency"]
          id: string
          is_active: boolean
          points_value: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          created_by: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          id?: string
          is_active?: boolean
          points_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          id?: string
          is_active?: boolean
          points_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "habits_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "habits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "habits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      partnership_interactions: {
        Row: {
          created_at: string
          created_by: string
          details: Json | null
          id: string
          interaction_type: string
          partnership_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          details?: Json | null
          id?: string
          interaction_type: string
          partnership_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: Json | null
          id?: string
          interaction_type?: string
          partnership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_interactions_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          created_at: string
          dominant_id: string
          id: string
          status: string
          submissive_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dominant_id: string
          id?: string
          status?: string
          submissive_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dominant_id?: string
          id?: string
          status?: string
          submissive_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_dominant_id_fkey"
            columns: ["dominant_id"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partnerships_dominant_id_fkey"
            columns: ["dominant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partnerships_submissive_id_fkey"
            columns: ["submissive_id"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partnerships_submissive_id_fkey"
            columns: ["submissive_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          points: number
          reason: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          points: number
          reason?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          points?: number
          reason?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "points_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "points_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "points_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          availability: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          experience_level: string | null
          id: string
          interests: string[] | null
          location: string | null
          looking_for: string | null
          role: Database["public"]["Enums"]["user_role"]
          theme_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          experience_level?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          looking_for?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          experience_level?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          looking_for?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          theme_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      punishments: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          for_user: string
          id: string
          is_active: boolean
          severity: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          for_user: string
          id?: string
          is_active?: boolean
          severity?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          for_user?: string
          id?: string
          is_active?: boolean
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "punishments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "punishments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "punishments_for_user_fkey"
            columns: ["for_user"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "punishments_for_user_fkey"
            columns: ["for_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rewards: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          for_user: string
          id: string
          is_active: boolean
          points_cost: number
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          for_user: string
          id?: string
          is_active?: boolean
          points_cost?: number
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          for_user?: string
          id?: string
          is_active?: boolean
          points_cost?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rewards_for_user_fkey"
            columns: ["for_user"]
            isOneToOne: false
            referencedRelation: "partner_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rewards_for_user_fkey"
            columns: ["for_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      partner_stats: {
        Row: {
          completions_today: number | null
          current_points: number | null
          display_name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_completions: number | null
          total_habits_assigned: number | null
          total_points_earned: number | null
          total_points_spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      habit_frequency: "daily" | "weekly" | "custom"
      transaction_type: "reward" | "punishment" | "bonus" | "penalty"
      user_role: "dominant" | "submissive" | "switch"
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
      habit_frequency: ["daily", "weekly", "custom"],
      transaction_type: ["reward", "punishment", "bonus", "penalty"],
      user_role: ["dominant", "submissive", "switch"],
    },
  },
} as const
