
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "achievement_unlocks": {
                  Row: {
                    "achievement": string,"match_id": string | null,"pinned": number | null,"tier": string,"unlocked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement": string,"match_id"?: string | null,"pinned"?: number | null,"tier": string,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement"?: string,"match_id"?: string | null,"pinned"?: number | null,"tier"?: string,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "achievement_unlocks_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
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
                },"daily_challenges": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"day": string,"game_id": string,"game_version": number,"seed": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"day": string,"game_id": string,"game_version": number,"seed": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"day"?: string,"game_id"?: string,"game_version"?: number,"seed"?: string
                  }
                  Relationships: [
                    
                  ]
                },"frame_unlocks": {
                  Row: {
                    "frame": string,"match_id": string | null,"unlocked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "frame": string,"match_id"?: string | null,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "frame"?: string,"match_id"?: string | null,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "frame_unlocks_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"match_participants": {
                  Row: {
                    "assisted": boolean,"bot": string | null,"match_id": string,"outcome": number | null,"placement": number | null,"rating_after": number | null,"rating_before": number | null,"score": number | null,"seat": number,"time_ms": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assisted"?: boolean,"bot"?: string | null,"match_id": string,"outcome"?: number | null,"placement"?: number | null,"rating_after"?: number | null,"rating_before"?: number | null,"score"?: number | null,"seat": number,"time_ms"?: number | null,"user_id"?: string | null
                  }
                  Update: {
                    "assisted"?: boolean,"bot"?: string | null,"match_id"?: string,"outcome"?: number | null,"placement"?: number | null,"rating_after"?: number | null,"rating_before"?: number | null,"score"?: number | null,"seat"?: number,"time_ms"?: number | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_participants_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "config": Json | null,"created_at": string,"duration_ms": number | null,"ended_at": string,"game_id": string,"game_version": number,"id": string,"mode": string,"pgn": string | null,"pool": string | null,"rated": boolean,"reason": string,"seed": string | null,"started_at": string,"status": string,"timer": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: Json | null,"created_at"?: string,"duration_ms"?: number | null,"ended_at": string,"game_id": string,"game_version": number,"id"?: string,"mode"?: string,"pgn"?: string | null,"pool"?: string | null,"rated": boolean,"reason": string,"seed"?: string | null,"started_at": string,"status": string,"timer"?: NonNullable<Json>
                  }
                  Update: {
                    "config"?: Json | null,"created_at"?: string,"duration_ms"?: number | null,"ended_at"?: string,"game_id"?: string,"game_version"?: number,"id"?: string,"mode"?: string,"pgn"?: string | null,"pool"?: string | null,"rated"?: boolean,"reason"?: string,"seed"?: string | null,"started_at"?: string,"status"?: string,"timer"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"play_streaks": {
                  Row: {
                    "best": number,"current": number,"last_day": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best"?: number,"current"?: number,"last_day"?: string | null,"user_id": string
                  }
                  Update: {
                    "best"?: number,"current"?: number,"last_day"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"player_game_stats": {
                  Row: {
                    "abandons": number,"best_score": number | null,"best_streak": number,"best_time_ms": number | null,"draws": number,"game_id": string,"last_played_at": string | null,"losses": number,"played": number,"score_total": number,"scored": number,"streak": number,"time_played_ms": number,"user_id": string,"wins": number
                  }
                  ComputedFields: never
                  Insert: {
                    "abandons"?: number,"best_score"?: number | null,"best_streak"?: number,"best_time_ms"?: number | null,"draws"?: number,"game_id": string,"last_played_at"?: string | null,"losses"?: number,"played"?: number,"score_total"?: number,"scored"?: number,"streak"?: number,"time_played_ms"?: number,"user_id": string,"wins"?: number
                  }
                  Update: {
                    "abandons"?: number,"best_score"?: number | null,"best_streak"?: number,"best_time_ms"?: number | null,"draws"?: number,"game_id"?: string,"last_played_at"?: string | null,"losses"?: number,"played"?: number,"score_total"?: number,"scored"?: number,"streak"?: number,"time_played_ms"?: number,"user_id"?: string,"wins"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_frame": string | null,"avatar_kind": string,"avatar_path": string | null,"avatar_preset": string | null,"bio": string | null,"country": string | null,"created_at": string,"id": string,"is_guest": boolean,"level": number,"nickname": string | null,"nickname_changed_at": string | null,"updated_at": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_frame"?: string | null,"avatar_kind"?: string,"avatar_path"?: string | null,"avatar_preset"?: string | null,"bio"?: string | null,"country"?: string | null,"created_at"?: string,"id": string,"is_guest"?: boolean,"level"?: number,"nickname"?: string | null,"nickname_changed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Update: {
                    "avatar_frame"?: string | null,"avatar_kind"?: string,"avatar_path"?: string | null,"avatar_preset"?: string | null,"bio"?: string | null,"country"?: string | null,"created_at"?: string,"id"?: string,"is_guest"?: boolean,"level"?: number,"nickname"?: string | null,"nickname_changed_at"?: string | null,"updated_at"?: string,"xp"?: number
                  }
                  Relationships: [
                    
                  ]
                },"rating_history": {
                  Row: {
                    "created_at": string,"game_id": string,"id": number,"match_id": string,"pool": string,"rating": number,"rd": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: never,"match_id": string,"pool": string,"rating": number,"rd": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: never,"match_id"?: string,"pool"?: string,"rating"?: number,"rd"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rating_history_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"ratings": {
                  Row: {
                    "created_at": string,"game_id": string,"games": number,"pool": string,"rating": number,"rd": number,"updated_at": string,"user_id": string,"volatility": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"game_id": string,"games"?: number,"pool": string,"rating"?: number,"rd"?: number,"updated_at"?: string,"user_id": string,"volatility"?: number
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"games"?: number,"pool"?: string,"rating"?: number,"rd"?: number,"updated_at"?: string,"user_id"?: string,"volatility"?: number
                  }
                  Relationships: [
                    
                  ]
                },"room_members": {
                  Row: {
                    "gone_at": string | null,"joined_at": string,"last_seen_at": string,"ready": boolean,"role": string,"room_id": string,"seat": number | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gone_at"?: string | null,"joined_at"?: string,"last_seen_at"?: string,"ready"?: boolean,"role": string,"room_id": string,"seat"?: number | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "gone_at"?: string | null,"joined_at"?: string,"last_seen_at"?: string,"ready"?: boolean,"role"?: string,"room_id"?: string,"seat"?: number | null,"status"?: string,"user_id"?: string
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
                },"room_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"nickname": string,"room_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"nickname": string,"room_id": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"nickname"?: string,"room_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_messages_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "allow_spectators": boolean,"bot_seats": (number)[],"code": string,"created_at": string,"game_id": string,"game_version": number,"host_id": string | null,"id": string,"last_active_at": string,"locked": boolean,"players": number,"rated": Json | null,"settings": NonNullable<Json>,"status": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_spectators"?: boolean,"bot_seats"?: (number)[],"code": string,"created_at"?: string,"game_id": string,"game_version": number,"host_id"?: string | null,"id"?: string,"last_active_at"?: string,"locked"?: boolean,"players": number,"rated"?: Json | null,"settings"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "allow_spectators"?: boolean,"bot_seats"?: (number)[],"code"?: string,"created_at"?: string,"game_id"?: string,"game_version"?: number,"host_id"?: string | null,"id"?: string,"last_active_at"?: string,"locked"?: boolean,"players"?: number,"rated"?: Json | null,"settings"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"visibility"?: string
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
                },"words_of_the_day": {
                  Row: {
                    "day": string,"locale": string,"meaning": string | null,"word": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"locale": string,"meaning"?: string | null,"word": string
                  }
                  Update: {
                    "day"?: string,"locale"?: string,"meaning"?: string | null,"word"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "player_stats": {
                  Row: {
                    "favorite_game": string | null,"games_tried": number | null,"matches": number | null,"time_played_ms": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "account_deletion_date":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"achievement_figures":
{ Args: { "p_user": string }; Returns: Json
                           },
"achievements_unlock":
{ Args: { "p_match": string,"p_unlocks": Json,"p_user": string }; Returns: number
                           },
"avatar_upload_allowed":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_use_room_channel":
{ Args: { "p_topic": string }; Returns: boolean
                           },
"cancel_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"cancel_rated_search":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"check_nickname":
{ Args: { "p_nickname": string }; Returns: string
                           },
"claim_host":
{ Args: { "p_from"?: string,"p_room": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"daily_challenge":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"daily_submit":
{ Args: { "p_day": string,"p_entry": Json,"p_match": string,"p_user": string }; Returns: Json
                           },
"due_account_deletions":
{ Args: { "p_limit"?: number }; Returns: string[]
                           },
"due_rated_games":
{ Args: { "p_limit": number }; Returns: string[]
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
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"leaderboard":
{ Args: { "p_board": string,"p_limit"?: number,"p_period"?: string }; Returns: Json
                           },
"leaderboard_entries_export":
{ Args: { "p_user": string }; Returns: {
              "achieved_at": string,"board": string,"match_id": string,"period": string,"value": number
            }[]
                           },
"leaderboard_submit":
{ Args: { "p_entries": Json,"p_match": string,"p_user": string }; Returns: Json
                           },
"leave_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"lock_room":
{ Args: { "p_locked": boolean,"p_room": string }; Returns: undefined
                           },
"match_record":
{ Args: { "p_match": string }; Returns: Json
                           },
"match_rewards":
{ Args: { "p_match": string,"p_user": string }; Returns: Json
                           },
"merge_guest":
{ Args: { "p_guest": string,"p_target": string }; Returns: undefined
                           },
"play_load":
{ Args: { "p_play": string }; Returns: Json
                           },
"play_record":
{ Args: { "p_play": string,"p_result": Json }; Returns: string
                           },
"player_history":
{ Args: { "p_limit"?: number,"p_user": string }; Returns: Json
                           },
"public_rooms":
{ Args: { "p_game_id"?: string }; Returns: {
              "bots": number,"code": string,"created_at": string,"game_id": string,"host_nickname": string,"people": number,"players": number,"status": string
            }[]
                           },
"purge_account":
{ Args: { "p_user": string }; Returns: undefined
                           },
"quick_match":
{ Args: { "p_game_id": string,"p_game_version": number,"p_players": number,"p_settings"?: Json }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"rated_action":
{ Args: { "p_action": Json,"p_room": string }; Returns: undefined
                           },
"rated_game_load":
{ Args: { "p_game": string,"p_room": string,"p_seed": string }; Returns: Json
                           },
"rated_game_record":
{ Args: { "p_game": string,"p_result": Json }; Returns: string
                           },
"rated_search":
{ Args: { "p_game_id": string,"p_game_version": number,"p_timer": number }; Returns: Json
                           },
"reopen_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"request_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"room_goodbye":
{ Args: { "p_room": string }; Returns: undefined
                           },
"room_heartbeat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"room_invite":
{ Args: { "p_code": string }; Returns: string
                           },
"room_relay":
{ Args: { "p_message": Json,"p_room": string }; Returns: undefined
                           },
"room_report_load":
{ Args: { "p_room": string,"p_seed": string,"p_user": string }; Returns: Json
                           },
"room_report_record":
{ Args: { "p_report": Json,"p_seed": string,"p_user": string }; Returns: Json
                           },
"send_room_message":
{ Args: { "p_body": string,"p_room": string }; Returns: {
              "body": string,
"created_at": string,
"id": number,
"nickname": string,
"room_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "room_messages"
        isOneToOne: true
        isSetofReturn: false
      } },
"server_time":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"set_achievement_pins":
{ Args: { "p_achievements": (string)[] }; Returns: undefined
                           },
"set_avatar_frame":
{ Args: { "p_frame"?: string }; Returns: undefined
                           },
"set_guest_profile":
{ Args: { "p_nickname": string }; Returns: string
                           },
"set_ready":
{ Args: { "p_ready": boolean,"p_room": string }; Returns: undefined
                           },
"set_room_rated":
{ Args: { "p_rated": boolean,"p_room": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"set_user_role":
{ Args: { "p_granted": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"start_daily":
{ Args: { "p_game_version": number }; Returns: Json
                           },
"start_play":
{ Args: { "p_game_id": string,"p_game_version": number }; Returns: Json
                           },
"start_room":
{ Args: { "p_room": string }; Returns: {
              "allow_spectators": boolean,
"bot_seats": (number)[],
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"code": string,
"created_at": string,
"game_id": string,
"game_version": number,
"host_id": string | null,
"id": string,
"last_active_at": string,
"locked": boolean,
"players": number,
"rated": Json | null,
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
"word_of_the_day":
{ Args: { "p_locale": string }; Returns: Json
                           },
"xp_events_export":
{ Args: { "p_user": string }; Returns: {
              "amount": number,"created_at": string,"day": string,"game_id": string,"match_id": string,"reason": string
            }[]
                           }
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
