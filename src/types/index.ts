import type { VideoVisibility, ProfileRow, VideoRow, LiveStreamRow, LiveStreamStatus, LiveStreamVisibility } from './database'

export type { VideoVisibility, ProfileRow, VideoRow, LiveStreamRow, LiveStreamStatus, LiveStreamVisibility }

export interface LiveStream extends LiveStreamRow {
  profile?: Profile | null
}

export interface Profile extends ProfileRow {}

export interface Video extends VideoRow {
  profiles?: Profile | null
  // Helper alias if joined as profile
  profile?: Profile | null
  // Private signed playback url if applicable
  signed_playback_url?: string | null
}

export interface VideoUpload {
  title: string
  description?: string
  visibility: VideoVisibility
  file: File
  thumbnail?: File | null
}

export interface VideoUpdatePayload {
  title?: string
  description?: string | null
  visibility?: VideoVisibility
  thumbnail_url?: string | null
  thumbnail_path?: string | null
}

export interface UploadProgress {
  stage: 'idle' | 'validating' | 'uploading-video' | 'uploading-thumbnail' | 'saving' | 'complete'
  percentage: number
  loaded: number
  total: number
  message?: string
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
  visibility?: VideoVisibility
  userId?: string
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