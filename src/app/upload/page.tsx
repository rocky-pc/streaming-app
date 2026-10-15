'use client'

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileVideo, Image as ImageIcon } from 'lucide-react'
import { siteConfig, type AllowedVideoType, type AllowedThumbnailType } from '@/config/site'

interface UploadPageProps {}

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  const validateVideo = useCallback((file: File): boolean => {
    if (!siteConfig.video.allowedTypes.includes(file.type as AllowedVideoType)) {
      setError(`Unsupported video format. Allowed: ${siteConfig.video.allowedTypes.join(', ')}`)
      return false
    }
    if (file.size > siteConfig.video.maxFileSize) {
      setError(`Video too large. Maximum size: ${formatFileSize(siteConfig.video.maxFileSize)}`)
      return false
    }
    return true
  }, [])

  const validateThumbnail = useCallback((file: File): boolean => {
    if (!siteConfig.video.thumbnailTypes.includes(file.type as AllowedThumbnailType)) {
      setError(`Unsupported image format. Allowed: ${siteConfig.video.thumbnailTypes.join(', ')}`)
      return false
    }
    if (file.size > siteConfig.video.maxThumbnailSize) {
      setError(`Thumbnail too large. Maximum size: ${formatFileSize(siteConfig.video.maxThumbnailSize)}`)
      return false
    }
    return true
  }, [])

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

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (validateVideo(file)) {
        setVideoFile(file)
        setError(null)
      }
    }
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (validateThumbnail(file)) {
        setThumbnailFile(file)
        setError(null)
      }
    }
  }

  const removeVideo = () => {
    setVideoFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeThumbnail = () => {
    setThumbnailFile(null)
    if (thumbInputRef.current) thumbInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    if (!videoFile) {
      setError('Please select a video file')
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('video', videoFile)
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(true)
      setVideoUrl(`/video/${data.video.id}`)
      setTitle('')
      setDescription('')
      setVideoFile(null)
      setThumbnailFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (thumbInputRef.current) thumbInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Upload Video</h1>
          <p className="text-gray-400">Share your content with the world</p>
        </div>

        {success && videoUrl && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <div>
                <p className="text-green-300 font-medium">Video uploaded successfully!</p>
                <a href={videoUrl} className="text-indigo-400 hover:underline text-sm">
                  View your video
                </a>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle>Video File</CardTitle>
              <CardDescription>MP4, WebM, MOV up to 2GB</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={siteConfig.video.allowedTypes.join(',')}
                  onChange={handleVideoChange}
                  className="sr-only"
                  id="video-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="video-upload"
                  className={cn(
                    'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                    videoFile
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-indigo-500 hover:bg-gray-800/50'
                  )}
                >
                  {videoFile ? (
                    <div className="w-full space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <FileVideo className="h-8 w-8 text-indigo-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{videoFile.name}</p>
                          <p className="text-sm text-gray-400">{formatFileSize(videoFile.size)} • {videoFile.type}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeVideo}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-12 w-12 text-gray-500 mb-3" />
                      <p className="text-gray-300 mb-1">Drag & drop a video file, or click to browse</p>
                      <p className="text-sm text-gray-500">Maximum file size: 2GB</p>
                    </div>
                  )}
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle>Thumbnail (Optional)</CardTitle>
              <CardDescription>JPG, PNG, WebP up to 5MB</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="relative">
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept={siteConfig.video.thumbnailTypes.join(',')}
                  onChange={handleThumbnailChange}
                  className="sr-only"
                  id="thumbnail-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="thumbnail-upload"
                  className={cn(
                    'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                    thumbnailFile
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-gray-700 hover:border-indigo-500 hover:bg-gray-800/50'
                  )}
                >
                  {thumbnailFile ? (
                    <div className="w-full space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                          <img
                            src={URL.createObjectURL(thumbnailFile)}
                            alt="Thumbnail preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{thumbnailFile.name}</p>
                          <p className="text-sm text-gray-400">{formatFileSize(thumbnailFile.size)} • {thumbnailFile.type}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeThumbnail}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 text-gray-500 mb-3" />
                      <p className="text-gray-300 mb-1">Drag & drop a thumbnail, or click to browse</p>
                      <p className="text-sm text-gray-500">Optional - will be generated from video if not provided</p>
                    </div>
                  )}
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle>Video Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <Input
                label="Title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                maxLength={200}
                disabled={isUploading}
                error={error?.includes('title') ? error : undefined}
              />
              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers about your video (optional)"
                maxLength={5000}
                rows={4}
                disabled={isUploading}
              />
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isUploading || !videoFile}
              className="flex-1 py-3"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Uploading... {progress > 0 && `${progress}%`}
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Video
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = '/'}
              disabled={isUploading}
              className="py-3"
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}