'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import {
  Upload as UploadIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  Image as ImageIcon,
  Globe,
  Link2,
  Lock,
  ArrowRight,
  Eye,
} from 'lucide-react'
import { siteConfig } from '@/config/site'
import { getSupabaseBrowserClient, getPublicUrl } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import type { VideoVisibility } from '@/types'

export default function UploadPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<VideoVisibility>('public')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(0)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<string>('')
  const [uploadPercent, setUploadPercent] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [createdVideo, setCreatedVideo] = useState<{ id: string; title: string; thumbnail_url?: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Redirect if not authenticated once auth is loaded
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/upload')
    }
  }, [user, isAuthLoading, router])

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration || 0)
      }
      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        resolve(0)
      }
      video.src = URL.createObjectURL(file)
    })
  }

  const handleVideoSelect = async (file: File) => {
    setError(null)
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !['mp4', 'webm', 'mov', 'mkv'].includes(ext || '')) {
      setError('Unsupported video format. Please upload MP4, WebM, or QuickTime (.mov).')
      return
    }

    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError('Video file exceeds maximum limit of 2 GB.')
      return
    }

    setVideoFile(file)
    if (!title) {
      // Auto populate title without extension
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      setTitle(cleanName)
    }

    try {
      const dur = await getVideoDuration(file)
      setDuration(dur)
    } catch {
      setDuration(0)
    }
  }

  const handleThumbnailSelect = (file: File) => {
    setError(null)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Thumbnail must be a JPEG, PNG, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Thumbnail exceeds maximum limit of 5 MB.')
      return
    }

    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  const removeVideo = () => {
    setVideoFile(null)
    setDuration(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeThumbnail = () => {
    setThumbnailFile(null)
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview)
      setThumbnailPreview(null)
    }
    if (thumbInputRef.current) thumbInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('You must be logged in to upload.')
      return
    }

    if (!title.trim()) {
      setError('Please enter a video title.')
      return
    }

    if (!videoFile) {
      setError('Please select a video file.')
      return
    }

    setIsUploading(true)
    setUploadPercent(10)
    setUploadStage('Uploading video file to storage...')

    const supabase = getSupabaseBrowserClient()
    const videoId = generateId()
    const videoExt = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4'
    const videoStoragePath = `${user.id}/${videoId}.${videoExt}`

    let thumbnailStoragePath: string | null = null
    let thumbnailUrl: string | null = null

    try {
      // 1. Upload video file directly to Supabase Storage
      const { data: videoData, error: videoUploadError } = await supabase.storage
        .from('videos')
        .upload(videoStoragePath, videoFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: videoFile.type || 'video/mp4',
        })

      if (videoUploadError) {
        throw new Error(`Video upload failed: ${videoUploadError.message}`)
      }

      setUploadPercent(60)
      const videoPublicUrl = getPublicUrl('videos', videoStoragePath)

      // 2. Upload thumbnail if provided
      if (thumbnailFile) {
        setUploadStage('Uploading thumbnail...')
        const thumbExt = thumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        thumbnailStoragePath = `${user.id}/${videoId}.${thumbExt}`

        const { error: thumbUploadError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbnailStoragePath, thumbnailFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: thumbnailFile.type || 'image/jpeg',
          })

        if (thumbUploadError) {
          console.warn('Thumbnail upload warning:', thumbUploadError.message)
        } else {
          thumbnailUrl = getPublicUrl('thumbnails', thumbnailStoragePath)
        }
      }

      setUploadPercent(85)
      setUploadStage('Saving video details...')

      // 3. Save metadata to API route (verifies session server-side)
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          thumbnail_url: thumbnailUrl,
          video_url: videoPublicUrl,
          duration,
          file_size: videoFile.size,
          mime_type: videoFile.type || 'video/mp4',
          storage_path: videoStoragePath,
          thumbnail_path: thumbnailStoragePath,
          visibility,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save video metadata.')
      }

      setUploadPercent(100)
      setUploadStage('Upload complete!')
      setCreatedVideo({
        id: data.video.id,
        title: data.video.title,
        thumbnail_url: thumbnailUrl || undefined,
      })

      toast('Video uploaded successfully!', 'success')
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during upload.')

      // Clean up orphaned storage files on failure
      try {
        if (videoStoragePath) {
          await supabase.storage.from('videos').remove([videoStoragePath])
        }
        if (thumbnailStoragePath) {
          await supabase.storage.from('thumbnails').remove([thumbnailStoragePath])
        }
      } catch (cleanErr) {
        console.warn('Clean up error:', cleanErr)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setTitle('')
    setDescription('')
    setVisibility('public')
    removeVideo()
    removeThumbnail()
    setCreatedVideo(null)
    setError(null)
    setUploadPercent(0)
    setUploadStage('')
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Upload Video</h1>
          <p className="mt-1 text-sm text-gray-400">
            Publish a new video file to your channel and share it with the world.
          </p>
        </div>

        {createdVideo ? (
          <Card className="bg-gray-900 border-gray-800 shadow-2xl p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">Your Video is Ready!</h2>
              <p className="mt-1 text-gray-400 text-sm">
                &quot;{createdVideo.title}&quot; has been published successfully.
              </p>
            </div>

            {createdVideo.thumbnail_url && (
              <div className="max-w-md mx-auto aspect-video rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
                <img
                  src={createdVideo.thumbnail_url}
                  alt={createdVideo.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link href={`/video/${createdVideo.id}`}>
                <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Watch Video</span>
                </Button>
              </Link>

              <Link href="/my-videos">
                <Button variant="outline" className="w-full sm:w-auto border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800">
                  <span>Manage in My Videos</span>
                </Button>
              </Link>

              <Button
                variant="ghost"
                onClick={handleReset}
                className="w-full sm:w-auto text-gray-400 hover:text-white"
              >
                <span>Upload Another</span>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="bg-gray-900/90 border-gray-800 shadow-2xl">
            <CardContent className="pt-6">
              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Video File Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Video File <span className="text-red-400">*</span>
                  </label>

                  {videoFile ? (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-850 border border-gray-750">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <FileVideo className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{videoFile.name}</p>
                          <p className="text-xs text-gray-400">
                            {formatFileSize(videoFile.size)} • {videoFile.type || 'Video'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeVideo}
                        disabled={isUploading}
                        className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
                        aria-label="Remove video"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (e.dataTransfer.files?.[0]) {
                          handleVideoSelect(e.dataTransfer.files[0])
                        }
                      }}
                      className="border-2 border-dashed border-gray-700 hover:border-indigo-500/70 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-950/40 hover:bg-indigo-950/10"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleVideoSelect(e.target.files[0])
                        }}
                      />
                      <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-3">
                        <UploadIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium text-white">
                        Click to select or drag and drop video file
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        MP4, WebM, or MOV up to 2 GB
                      </p>
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-200 mb-2">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="title"
                    type="text"
                    required
                    disabled={isUploading}
                    placeholder="Enter an engaging video title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-200 mb-2">
                    Description
                  </label>
                  <Textarea
                    id="description"
                    rows={4}
                    disabled={isUploading}
                    placeholder="Tell viewers what your video is about..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                  />
                </div>

                {/* Thumbnail Picker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Custom Thumbnail (Optional)
                  </label>

                  {thumbnailPreview ? (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-850 border border-gray-750">
                      <div className="w-24 aspect-video rounded-lg overflow-hidden bg-gray-900 border border-gray-700 shrink-0">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">{thumbnailFile?.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {thumbnailFile ? formatFileSize(thumbnailFile.size) : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeThumbnail}
                        disabled={isUploading}
                        className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
                        aria-label="Remove thumbnail"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => thumbInputRef.current?.click()}
                      className="border border-dashed border-gray-750 hover:border-gray-600 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-950/30 flex items-center justify-center gap-3"
                    >
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleThumbnailSelect(e.target.files[0])
                        }}
                      />
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-300">
                        Upload custom thumbnail (JPG, PNG, WebP up to 5MB)
                      </span>
                    </div>
                  )}
                </div>

                {/* Visibility Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Visibility
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('public')}
                      className={cn(
                        'flex flex-col text-left p-3.5 rounded-xl border transition-all',
                        visibility === 'public'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white ring-1 ring-indigo-500'
                          : 'border-gray-800 bg-gray-850/50 text-gray-400 hover:border-gray-700'
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm text-white mb-1">
                        <Globe className="h-4 w-4 text-indigo-400" />
                        <span>Public</span>
                      </div>
                      <span className="text-xs text-gray-400 leading-normal">
                        Visible on home page and playable by everyone
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('unlisted')}
                      className={cn(
                        'flex flex-col text-left p-3.5 rounded-xl border transition-all',
                        visibility === 'unlisted'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white ring-1 ring-indigo-500'
                          : 'border-gray-800 bg-gray-850/50 text-gray-400 hover:border-gray-700'
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm text-white mb-1">
                        <Link2 className="h-4 w-4 text-amber-400" />
                        <span>Unlisted</span>
                      </div>
                      <span className="text-xs text-gray-400 leading-normal">
                        Anyone with the link can watch; hidden from search
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setVisibility('private')}
                      className={cn(
                        'flex flex-col text-left p-3.5 rounded-xl border transition-all',
                        visibility === 'private'
                          ? 'border-indigo-500 bg-indigo-950/20 text-white ring-1 ring-indigo-500'
                          : 'border-gray-800 bg-gray-850/50 text-gray-400 hover:border-gray-700'
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm text-white mb-1">
                        <Lock className="h-4 w-4 text-rose-400" />
                        <span>Private</span>
                      </div>
                      <span className="text-xs text-gray-400 leading-normal">
                        Only you can view and play this video
                      </span>
                    </button>
                  </div>
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2 p-4 rounded-xl bg-gray-850 border border-gray-750">
                    <div className="flex justify-between text-xs text-gray-300 font-medium">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                        {uploadStage}
                      </span>
                      <span>{uploadPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isUploading || !videoFile}
                    className="w-full sm:w-auto px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 transition-colors gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadIcon className="h-4 w-4" />
                        <span>Publish Video</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}