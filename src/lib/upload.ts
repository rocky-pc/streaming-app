import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import type { VideoUpload, UploadProgress } from '@/types'
import { siteConfig, type AllowedVideoType, type AllowedThumbnailType } from '@/config/site'

export async function uploadVideo(
  upload: VideoUpload,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ videoUrl: string; thumbnailUrl: string | null; storagePath: string; thumbnailPath: string | null }> {
  const videoId = generateId()
  const videoExt = upload.file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const videoPath = `${videoId}.${videoExt}`

  await supabase.storage.from('videos').upload(videoPath, upload.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: upload.file.type,
  })

  const { data: videoUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
  const videoUrl = videoUrlData.publicUrl

  let thumbnailUrl: string | null = null
  let thumbnailPath: string | null = null

  if (upload.thumbnail) {
    const thumbExt = upload.thumbnail.name.split('.').pop()?.toLowerCase() || 'jpg'
    thumbnailPath = `${videoId}.${thumbExt}`

    await supabase.storage.from('thumbnails').upload(thumbnailPath, upload.thumbnail, {
      cacheControl: '3600',
      upsert: false,
      contentType: upload.thumbnail.type,
    })

    const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbnailPath)
    thumbnailUrl = thumbUrlData.publicUrl
  }

  return { videoUrl, thumbnailUrl, storagePath: videoPath, thumbnailPath }
}

export async function uploadVideoWithProgress(
  upload: VideoUpload,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ videoUrl: string; thumbnailUrl: string | null; storagePath: string; thumbnailPath: string | null }> {
  const videoId = generateId()
  const videoExt = upload.file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const videoPath = `${videoId}.${videoExt}`

  const { data: videoData, error: videoError } = await supabase.storage
    .from('videos')
    .upload(videoPath, upload.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: upload.file.type,
    })

  if (videoError) throw new Error(videoError.message)

  const { data: videoUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
  const videoUrl = videoUrlData.publicUrl

  let thumbnailUrl: string | null = null
  let thumbnailPath: string | null = null

  if (upload.thumbnail) {
    const thumbExt = upload.thumbnail.name.split('.').pop()?.toLowerCase() || 'jpg'
    thumbnailPath = `${videoId}.${thumbExt}`

    const { error: thumbError } = await supabase.storage
      .from('thumbnails')
      .upload(thumbnailPath, upload.thumbnail, {
        cacheControl: '3600',
        upsert: false,
        contentType: upload.thumbnail.type,
      })

    if (thumbError) throw new Error(thumbError.message)

    const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbnailPath)
    thumbnailUrl = thumbUrlData.publicUrl
  }

  return { videoUrl, thumbnailUrl, storagePath: videoPath, thumbnailPath }
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  if (!siteConfig.video.allowedTypes.includes(file.type as AllowedVideoType)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed types: ${siteConfig.video.allowedTypes.join(', ')}`,
    }
  }

  if (file.size > siteConfig.video.maxFileSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${formatFileSize(siteConfig.video.maxFileSize)}`,
    }
  }

  return { valid: true }
}

export function validateThumbnailFile(file: File): { valid: boolean; error?: string } {
  if (!siteConfig.video.thumbnailTypes.includes(file.type as AllowedThumbnailType)) {
    return {
      valid: false,
      error: `Unsupported thumbnail type. Allowed types: ${siteConfig.video.thumbnailTypes.join(', ')}`,
    }
  }

  if (file.size > siteConfig.video.maxThumbnailSize) {
    return {
      valid: false,
      error: `Thumbnail too large. Maximum size: ${formatFileSize(siteConfig.video.maxThumbnailSize)}`,
    }
  }

  return { valid: true }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      resolve(0)
    }
    video.src = URL.createObjectURL(file)
  })
}