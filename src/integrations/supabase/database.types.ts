/* eslint-disable @typescript-eslint/no-empty-object-type */
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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string
          activity_type_id: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          custom_venue: string | null
          end_time: string
          id: string
          is_completed: boolean
          is_home_game: boolean | null
          notes: string | null
          season_id: string
          start_time: string
          team_id: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          activity_date: string
          activity_type_id: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          custom_venue?: string | null
          end_time: string
          id?: string
          is_completed?: boolean
          is_home_game?: boolean | null
          notes?: string | null
          season_id: string
          start_time: string
          team_id: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          activity_date?: string
          activity_type_id?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          custom_venue?: string | null
          end_time?: string
          id?: string
          is_completed?: boolean
          is_home_game?: boolean | null
          notes?: string | null
          season_id?: string
          start_time?: string
          team_id?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_team_id_season_id_fkey"
            columns: ["team_id", "season_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "season_id"]
          },
          {
            foreignKeyName: "activities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_coaches: {
        Row: {
          activity_amount: number | null
          activity_id: string
          coach_id: string
          created_at: string
          hours_worked: number | null
          id: string
          mileage_amount: number | null
          mileage_km: number | null
          rate_per_km: number | null
          rate_type1_per_hour: number | null
          rate_type2_per_hour: number | null
          rate_type3_fixed: number | null
          role: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          activity_amount?: number | null
          activity_id: string
          coach_id: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          mileage_amount?: number | null
          mileage_km?: number | null
          rate_per_km?: number | null
          rate_type1_per_hour?: number | null
          rate_type2_per_hour?: number | null
          rate_type3_fixed?: number | null
          role: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          activity_amount?: number | null
          activity_id?: string
          coach_id?: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          mileage_amount?: number | null
          mileage_km?: number | null
          rate_per_km?: number | null
          rate_type1_per_hour?: number | null
          rate_type2_per_hour?: number | null
          rate_type3_fixed?: number | null
          role?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_coaches_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          notes: string | null
          player_id: string
          recorded_by: string
          status: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          recorded_by: string
          status: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          recorded_by?: string
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          correction_reason: string | null
          correction_request_id: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          correction_reason?: string | null
          correction_request_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          correction_reason?: string | null
          correction_request_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_correction_request_id_fkey"
            columns: ["correction_request_id"]
            isOneToOne: false
            referencedRelation: "correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_rates: {
        Row: {
          assistant_type1_per_hour: number | null
          assistant_type2_per_hour: number | null
          assistant_type3_fixed: number | null
          coach_id: string
          created_at: string
          head_type1_per_hour: number | null
          head_type2_per_hour: number | null
          head_type3_fixed: number | null
          id: string
          is_active: boolean
          rate_per_km: number | null
          season_id: string
          updated_at: string
        }
        Insert: {
          assistant_type1_per_hour?: number | null
          assistant_type2_per_hour?: number | null
          assistant_type3_fixed?: number | null
          coach_id: string
          created_at?: string
          head_type1_per_hour?: number | null
          head_type2_per_hour?: number | null
          head_type3_fixed?: number | null
          id?: string
          is_active?: boolean
          rate_per_km?: number | null
          season_id: string
          updated_at?: string
        }
        Update: {
          assistant_type1_per_hour?: number | null
          assistant_type2_per_hour?: number | null
          assistant_type3_fixed?: number | null
          coach_id?: string
          created_at?: string
          head_type1_per_hour?: number | null
          head_type2_per_hour?: number | null
          head_type3_fixed?: number | null
          id?: string
          is_active?: boolean
          rate_per_km?: number | null
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_rates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_rates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: {
          activity_id: string
          admin_notes: string | null
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          proposed_value: string | null
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          activity_id: string
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          proposed_value?: string | null
          reason: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          activity_id?: string
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          proposed_value?: string | null
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          request_type: string
          status: string
          subject_email: string
          subject_name: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          request_type: string
          status?: string
          subject_email: string
          subject_name?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          status?: string
          subject_email?: string
          subject_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_types: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          name?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locked_months: {
        Row: {
          id: string
          locked_at: string
          locked_by: string
          month_year: string
          notes: string | null
          season_id: string
        }
        Insert: {
          id?: string
          locked_at?: string
          locked_by: string
          month_year: string
          notes?: string | null
          season_id: string
        }
        Update: {
          id?: string
          locked_at?: string
          locked_by?: string
          month_year?: string
          notes?: string | null
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locked_months_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locked_months_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_forms: {
        Row: {
          created_at: string
          form_type_id: string
          id: string
          notes: string | null
          player_id: string
          received_date: string | null
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_type_id: string
          id?: string
          notes?: string | null
          player_id: string
          received_date?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_type_id?: string
          id?: string
          notes?: string | null
          player_id?: string
          received_date?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_forms_form_type_id_fkey"
            columns: ["form_type_id"]
            isOneToOne: false
            referencedRelation: "form_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_forms_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_forms_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          is_primary: boolean
          player_id: string
          relationship: string | null
        }
        Insert: {
          created_at?: string
          guardian_id: string
          is_primary?: boolean
          player_id: string
          relationship?: string | null
        }
        Update: {
          created_at?: string
          guardian_id?: string
          is_primary?: boolean
          player_id?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          date_of_birth: string
          first_name: string
          gender: string | null
          guardian1_email: string | null
          guardian1_name: string | null
          guardian1_phone: string | null
          guardian2_email: string | null
          guardian2_name: string | null
          guardian2_phone: string | null
          id: string
          is_active: boolean
          joined_date: string | null
          last_name: string
          left_date: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth: string
          first_name: string
          gender?: string | null
          guardian1_email?: string | null
          guardian1_name?: string | null
          guardian1_phone?: string | null
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          id?: string
          is_active?: boolean
          joined_date?: string | null
          last_name: string
          left_date?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string
          first_name?: string
          gender?: string | null
          guardian1_email?: string | null
          guardian1_name?: string | null
          guardian1_phone?: string | null
          guardian2_email?: string | null
          guardian2_name?: string | null
          guardian2_phone?: string | null
          id?: string
          is_active?: boolean
          joined_date?: string | null
          last_name?: string
          left_date?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          km_rate: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          hourly_rate?: number | null
          id: string
          is_active?: boolean
          km_rate?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          km_rate?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedule_templates: {
        Row: {
          created_at: string
          custom_venue: string | null
          day_of_week: number
          default_activity_type_id: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          team_id: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          custom_venue?: string | null
          day_of_week: number
          default_activity_type_id: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          team_id: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          custom_venue?: string | null
          day_of_week?: number
          default_activity_type_id?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          team_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          is_archived: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_coaches: {
        Row: {
          can_be_assistant: boolean
          can_be_head_coach: boolean
          coach_id: string
          created_at: string
          id: string
          is_active: boolean
          team_id: string
          updated_at: string
        }
        Insert: {
          can_be_assistant?: boolean
          can_be_head_coach?: boolean
          coach_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          team_id: string
          updated_at?: string
        }
        Update: {
          can_be_assistant?: boolean
          can_be_head_coach?: boolean
          coach_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          created_at: string
          id: string
          membership_status: string
          notes: string | null
          player_id: string
          team_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          membership_status?: string
          notes?: string | null
          player_id: string
          team_id: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          membership_status?: string
          notes?: string | null
          player_id?: string
          team_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          age_category: string | null
          created_at: string
          gender: string | null
          head_coach_id: string | null
          id: string
          is_archived: boolean
          name: string
          notes: string | null
          season_id: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          age_category?: string | null
          created_at?: string
          gender?: string | null
          head_coach_id?: string | null
          id?: string
          is_archived?: boolean
          name: string
          notes?: string | null
          season_id: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          age_category?: string | null
          created_at?: string
          gender?: string | null
          head_coach_id?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string | null
          season_id?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_head_coach_id_fkey"
            columns: ["head_coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          room_designation: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          room_designation?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          room_designation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_recalculate_activity: {
        Args: {
          p_activity_id: string
          p_correction_request_id?: string
          p_reason: string
        }
        Returns: Json
      }
      complete_activity: { Args: { p_activity_id: string }; Returns: Json }
      complete_activity_with_rates: {
        Args: { p_activity_id: string }
        Returns: Json
      }
      create_or_open_activity: {
        Args: {
          p_activity_date: string
          p_activity_type_id: number
          p_custom_venue?: string
          p_end_time?: string
          p_is_home_game?: boolean
          p_start_time?: string
          p_team_id: string
          p_venue_id?: string
        }
        Returns: Json
      }
      get_all_coaches_stats: {
        Args: { p_end_date: string; p_season_id?: string; p_start_date: string }
        Returns: {
          activity_amount: number
          assistant_count: number
          away_games: number
          coach_id: string
          coach_name: string
          head_coach_count: number
          home_games: number
          mileage_amount: number
          total_amount: number
          total_hours: number
          total_km: number
          type1_count: number
          type2_count: number
          type3_count: number
        }[]
      }
      get_coach_stats: {
        Args: { p_coach_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          activity_amount: number
          assistant_count: number
          away_games: number
          coach_id: string
          coach_name: string
          head_coach_count: number
          home_games: number
          mileage_amount: number
          total_amount: number
          total_hours: number
          total_km: number
          type1_count: number
          type2_count: number
          type3_count: number
        }[]
      }
      get_players_lowest_attendance: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_season_id: string
          p_start_date: string
        }
        Returns: {
          attendance_percentage: number
          attended: number
          player_id: string
          player_name: string
          team_name: string
          total_activities: number
        }[]
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
