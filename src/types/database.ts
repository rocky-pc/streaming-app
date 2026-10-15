export interface VideoRow {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string
  duration: number | null
  file_size: number | null
  mime_type: string | null
  storage_path: string
  thumbnail_path: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: VideoRow
        Insert: Omit<VideoRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VideoRow, 'id' | 'created_at' | 'updated_at'>>
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
  }
}