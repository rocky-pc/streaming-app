export interface Video {
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

export interface VideoUpload {
  title: string
  description: string
  file: File
  thumbnail?: File
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface VideoPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isFullscreen: boolean
  error: string | null
  isLoading: boolean
}

export interface SearchParams {
  query?: string
  page?: number
  limit?: number
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}