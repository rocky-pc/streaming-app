export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type VideoVisibility = 'public' | 'unlisted' | 'private'

export interface ProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  coin_balance: number
  chat_enabled: boolean
  created_at: string
  updated_at: string
}

export interface PlatformSettingRow {
  key: string
  value: string
  description: string | null
  updated_at: string
}

export interface WalletTransactionRow {
  id: string
  user_id: string
  amount: number
  type: 'signup_bonus' | 'chat_fee' | 'streamer_earning' | 'admin_adjustment'
  related_stream_id: string | null
  description: string | null
  created_at: string
}

export interface VideoRow {
  id: string
  user_id: string | null
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string
  duration: number | null
  file_size: number | null
  mime_type: string | null
  storage_path: string
  thumbnail_path: string | null
  visibility: VideoVisibility
  created_at: string
  updated_at: string
}

export type LiveStreamStatus = 'scheduled' | 'live' | 'ended'
export type LiveStreamVisibility = 'public' | 'unlisted' | 'private'

export interface LiveStreamRow {
  id: string
  user_id: string
  title: string
  description: string | null
  room_name: string
  status: LiveStreamStatus
  visibility: LiveStreamVisibility
  thumbnail_url?: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
  profiles?: ProfileRow | null
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          coin_balance?: number
          chat_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          coin_balance?: number
          chat_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      videos: {
        Row: VideoRow
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          description?: string | null
          thumbnail_url?: string | null
          video_url: string
          duration?: number | null
          file_size?: number | null
          mime_type?: string | null
          storage_path: string
          thumbnail_path?: string | null
          visibility?: VideoVisibility
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          video_url?: string
          duration?: number | null
          file_size?: number | null
          mime_type?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          visibility?: VideoVisibility
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      live_streams: {
        Row: LiveStreamRow
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          room_name: string
          status?: LiveStreamStatus
          visibility?: LiveStreamVisibility
          thumbnail_url?: string | null
          started_at?: string | null
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          room_name?: string
          status?: LiveStreamStatus
          visibility?: LiveStreamVisibility
          thumbnail_url?: string | null
          started_at?: string | null
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      live_chat_messages: {
        Row: {
          id: string
          stream_id: string
          user_id: string
          message: string
          created_at: string
          paid_emoji?: string | null
          coins_paid?: number | null
        }
        Insert: {
          id?: string
          stream_id: string
          user_id: string
          message: string
          created_at?: string
          paid_emoji?: string | null
          coins_paid?: number | null
        }
        Update: {
          id?: string
          stream_id?: string
          user_id?: string
          message?: string
          created_at?: string
          paid_emoji?: string | null
          coins_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
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
      video_visibility: VideoVisibility
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}