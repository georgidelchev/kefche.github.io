
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"ip_hash": string | null,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"ip_hash"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"ip_hash"?: string | null,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"consent_records": {
                  Row: {
                    "anonymous_id": string | null,"categories": NonNullable<Json>,"created_at": string,"id": string,"policy_version": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymous_id"?: string | null,"categories": NonNullable<Json>,"created_at"?: string,"id"?: string,"policy_version": string,"user_id"?: string | null
                  }
                  Update: {
                    "anonymous_id"?: string | null,"categories"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"policy_version"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_kind": string,"avatar_path": string | null,"avatar_preset": string | null,"bio": string | null,"country": string | null,"created_at": string,"id": string,"is_guest": boolean,"level": number,"nickname": string | null,"nickname_changed_at": string | null,"updated_at": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_kind"?: string,"avatar_path"?: string | null,"avatar_preset"?: string | null,"bio"?: string | null,"country"?: string | null,"created_at"?: string,"id": string,"is_guest"?: boolean,"level"?: number,"nickname"?: string | null,"nickname_changed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "avatar_kind"?: string,"avatar_path"?: string | null,"avatar_preset"?: string | null,"bio"?: string | null,"country"?: string | null,"created_at"?: string,"id"?: string,"is_guest"?: boolean,"level"?: number,"nickname"?: string | null,"nickname_changed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Relationships: [
                    
                  ]
                },"room_members": {
                  Row: {
                    "joined_at": string,"last_seen_at": string,"ready": boolean,"role": string,"room_id": string,"seat": number | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"last_seen_at"?: string,"ready"?: boolean,"role": string,"room_id": string,"seat"?: number | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"last_seen_at"?: string,"ready"?: boolean,"role"?: string,"room_id"?: string,"seat"?: number | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "allow_spectators": boolean,"bot_seats": (number)[],"closed_at": string | null,"code": string,"created_at": string,"game_id": string,"game_version": number,"host_id": string | null,"id": string,"last_active_at": string,"locked": boolean,"players": number,"settings": NonNullable<Json>,"status": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_spectators"?: boolean,"bot_seats"?: (number)[],"closed_at"?: string | null,"code": string,"created_at"?: string,"game_id": string,"game_version": number,"host_id"?: string | null,"id"?: string,"last_active_at"?: string,"locked"?: boolean,"players": number,"settings"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "allow_spectators"?: boolean,"bot_seats"?: (number)[],"closed_at"?: string | null,"code"?: string,"created_at"?: string,"game_id"?: string,"game_version"?: number,"host_id"?: string | null,"id"?: string,"last_active_at"?: string,"locked"?: boolean,"players"?: number,"settings"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "birth_year": number | null,"created_at": string,"haptics": boolean,"locale": string | null,"privacy_invites": string,"privacy_messages": string,"reduced_motion": string,"show_in_leaderboards": boolean,"show_online": boolean,"sound_effects": number,"sound_master": number,"sound_music": number,"theme": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"created_at"?: string,"haptics"?: boolean,"locale"?: string | null,"privacy_invites"?: string,"privacy_messages"?: string,"reduced_motion"?: string,"show_in_leaderboards"?: boolean,"show_online"?: boolean,"sound_effects"?: number,"sound_master"?: number,"sound_music"?: number,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "birth_year"?: number | null,"created_at"?: string,"haptics"?: boolean,"locale"?: string | null,"privacy_invites"?: string,"privacy_messages"?: string,"reduced_motion"?: string,"show_in_leaderboards"?: boolean,"show_online"?: boolean,"sound_effects"?: number,"sound_master"?: number,"sound_music"?: number,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "account_deletion_date":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"avatar_upload_allowed":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"check_nickname":
{ Args: { "p_nickname": string }; Returns: string
                           },
"claim_host":
{ Args: { "p_from": string,"p_room": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"closed_at": string | null,
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"settings": NonNullable<Json>,
"status": string,
"updated_at": string,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "rooms"
        isOneToOne: true
        isSetofReturn: false
      } },
"close_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"complete_profile":
{ Args: { "p_birth_month"?: number,"p_birth_year"?: number,"p_nickname"?: string }; Returns: string
                           },
"create_room":
{ Args: { "p_allow_spectators"?: boolean,"p_bot_seats"?: (number)[],"p_game_id": string,"p_game_version": number,"p_players": number,"p_settings"?: Json,"p_visibility"?: string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"closed_at": string | null,
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"settings": NonNullable<Json>,
"status": string,
"updated_at": string,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "rooms"
        isOneToOne: true
        isSetofReturn: false
      } },
"due_account_deletions":
{ Args: { "p_limit"?: number }; Returns: string[]
                           },
"finish_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"has_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_room_member":
{ Args: { "p_room": string }; Returns: boolean
                           },
"join_room":
{ Args: { "p_code": string,"p_spectate"?: boolean }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"closed_at": string | null,
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"settings": NonNullable<Json>,
"status": string,
"updated_at": string,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "rooms"
        isOneToOne: true
        isSetofReturn: false
      } },
"kick_member":
{ Args: { "p_member": string,"p_room": string }; Returns: undefined
                           },
"leave_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"lock_room":
{ Args: { "p_locked": boolean,"p_room": string }; Returns: undefined
                           },
"merge_guest":
{ Args: { "p_guest": string,"p_target": string }; Returns: undefined
                           },
"public_rooms":
{ Args: { "p_game_id"?: string }; Returns: {
              "bots": number,"code": string,"created_at": string,"game_id": string,"host_nickname": string,"people": number,"players": number,"status": string
            }[]
                           },
"purge_account":
{ Args: { "p_user": string }; Returns: undefined
                           },
"reopen_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"request_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"room_heartbeat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"set_ready":
{ Args: { "p_ready": boolean,"p_room": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_granted": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"start_room":
{ Args: { "p_room": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"closed_at": string | null,
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"settings": NonNullable<Json>,
"status": string,
"updated_at": string,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "rooms"
        isOneToOne: true
        isSetofReturn: false
      } },
"take_rate_limit":
{ Args: { "p_capacity": number,"p_key": string,"p_refill_per_second": number }; Returns: boolean
                           },
"transfer_host":
{ Args: { "p_member": string,"p_room": string }; Returns: undefined
                           },
"update_room":
{ Args: { "p_allow_spectators": boolean,"p_bot_seats": (number)[],"p_players": number,"p_room": string,"p_settings": Json,"p_visibility": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"closed_at": string | null,
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"settings": NonNullable<Json>,
"status": string,
"updated_at": string,
"visibility": string
            }
                          SetofOptions: {
        from: "*"
        to: "rooms"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "app_role": "moderator"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["moderator", "admin"]
          }
        }
} as const
