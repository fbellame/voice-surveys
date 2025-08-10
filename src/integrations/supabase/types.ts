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
      answer: {
        Row: {
          answer_text: string
          answered_at: string | null
          created_at: string | null
          id: string
          question_id: number
          survey_submission_id: string
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          answered_at?: string | null
          created_at?: string | null
          id?: string
          question_id: number
          survey_submission_id: string
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          answered_at?: string | null
          created_at?: string | null
          id?: string
          question_id?: number
          survey_submission_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_survey_submission_id_fkey"
            columns: ["survey_submission_id"]
            isOneToOne: false
            referencedRelation: "survey_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign: {
        Row: {
          campaign_type: string
          campaign_uri: string | null
          closing: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          greeting: string | null
          id: number
          intro_prompt: string | null
          name: string
          purpose_explanation: string | null
          start_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          campaign_type?: string
          campaign_uri?: string | null
          closing?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          greeting?: string | null
          id?: number
          intro_prompt?: string | null
          name: string
          purpose_explanation?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_type?: string
          campaign_uri?: string | null
          closing?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          greeting?: string | null
          id?: number
          intro_prompt?: string | null
          name?: string
          purpose_explanation?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_links: {
        Row: {
          id: string
          campaign_id: number
          link_type: string
          unique_token: string
          name: string | null
          description: string | null
          is_active: boolean
          max_responses: number | null
          current_responses: number
          created_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          campaign_id: number
          link_type?: string
          unique_token?: string
          name?: string | null
          description?: string | null
          is_active?: boolean
          max_responses?: number | null
          current_responses?: number
          created_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          campaign_id?: number
          link_type?: string
          unique_token?: string
          name?: string | null
          description?: string | null
          is_active?: boolean
          max_responses?: number | null
          current_responses?: number
          created_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_room_mapping: {
        Row: {
          campaign_id: number
          created_at: string | null
          id: number
          is_active: boolean | null
          room_pattern: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          room_pattern: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: number
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          room_pattern?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_room_mapping_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      question: {
        Row: {
          campaign_id: number
          created_at: string | null
          id: number
          question_order: number
          question_text: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: number
          created_at?: string | null
          id?: number
          question_order?: number
          question_text: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: number
          created_at?: string | null
          id?: number
          question_order?: number
          question_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_invitations: {
        Row: {
          campaign_id: number
          created_at: string
          id: string
          qr_code_url: string | null
          responded_at: string | null
          sent_at: string | null
          unique_token: string
          updated_at: string
          user_id: string | null
          invitation_type: string
          contact_value: string | null
          email: string | null
        }
        Insert: {
          campaign_id: number
          created_at?: string
          id?: string
          qr_code_url?: string | null
          responded_at?: string | null
          sent_at?: string | null
          unique_token?: string
          updated_at?: string
          user_id?: string | null
          invitation_type?: string
          contact_value?: string | null
          email?: string | null
        }
        Update: {
          campaign_id?: number
          created_at?: string
          id?: string
          qr_code_url?: string | null
          responded_at?: string | null
          sent_at?: string | null
          unique_token?: string
          updated_at?: string
          user_id?: string | null
          invitation_type?: string
          contact_value?: string | null
          email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          id: string
          campaign_id: number
          full_name: string | null
          email: string | null
          geography: string | null
          occupation: string | null
          phone_number: string | null
          link_token: string
          link_type: string
          invitation_token: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: number
          full_name?: string | null
          email?: string | null
          geography?: string | null
          occupation?: string | null
          phone_number?: string | null
          link_token: string
          link_type: string
          invitation_token?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: number
          full_name?: string | null
          email?: string | null
          geography?: string | null
          occupation?: string | null
          phone_number?: string | null
          link_token?: string
          link_type?: string
          invitation_token?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_submissions: {
        Row: {
          id: string
          campaign_id: number
          user_profile_id: string | null
          room_name: string | null
          link_token: string
          link_type: string
          s3_recording_url: string | null
          created_at: string | null
          updated_at: string | null
          call_timestamp: string | null
        }
        Insert: {
          id?: string
          campaign_id: number
          user_profile_id?: string | null
          room_name?: string | null
          link_token: string
          link_type: string
          s3_recording_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          call_timestamp?: string | null
        }
        Update: {
          id?: string
          campaign_id?: number
          user_profile_id?: string | null
          room_name?: string | null
          link_token?: string
          link_type?: string
          s3_recording_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          call_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_submissions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_invitation_responded_at: {
        Args: {
          token: string
          responded_timestamp: string
        }
        Returns: {
          id: string
          responded_at: string | null
        }[]
      }
      increment_generic_link_responses: {
        Args: Record<string, never>
        Returns: unknown
      }
      decrement_generic_link_responses: {
        Args: Record<string, never>
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
