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
          id: number
          question_id: number
          survey_response_id: number
          updated_at: string | null
        }
        Insert: {
          answer_text: string
          answered_at?: string | null
          created_at?: string | null
          id?: number
          question_id: number
          survey_response_id: number
          updated_at?: string | null
        }
        Update: {
          answer_text?: string
          answered_at?: string | null
          created_at?: string | null
          id?: number
          question_id?: number
          survey_response_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_call_id_fkey"
            columns: ["survey_response_id"]
            isOneToOne: false
            referencedRelation: "survey_response"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
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
          question_order: number
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
          email: string
          id: string
          qr_code_url: string | null
          responded_at: string | null
          sent_at: string | null
          unique_token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id: number
          created_at?: string
          email: string
          id?: string
          qr_code_url?: string | null
          responded_at?: string | null
          sent_at?: string | null
          unique_token?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: number
          created_at?: string
          email?: string
          id?: string
          qr_code_url?: string | null
          responded_at?: string | null
          sent_at?: string | null
          unique_token?: string
          updated_at?: string
          user_id?: string | null
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
      survey_response: {
        Row: {
          call_timestamp: string | null
          campaign_id: number
          created_at: string | null
          id: number
          invitation_token: string | null
          phone_number: string
          room_name: string
          s3_recording_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          call_timestamp?: string | null
          campaign_id: number
          created_at?: string | null
          id?: number
          invitation_token?: string | null
          phone_number: string
          room_name: string
          s3_recording_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          call_timestamp?: string | null
          campaign_id?: number
          created_at?: string | null
          id?: number
          invitation_token?: string | null
          phone_number?: string
          room_name?: string
          s3_recording_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_response_invitation_token_fkey"
            columns: ["invitation_token"]
            isOneToOne: false
            referencedRelation: "survey_invitations"
            referencedColumns: ["unique_token"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
