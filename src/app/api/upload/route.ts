import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createVideo } from '@/lib/api'
import { validateVideoFile, validateThumbnailFile, getVideoDuration } from '@/lib/upload'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const videoFile = formData.get('video') as File
    const thumbnailFile = formData.get('thumbnail') as File | null

    if (!title || !videoFile) {
      return NextResponse.json(
        { error: 'Title and video file are required' },
        { status: 400 }
      )
    }

    const videoValidation = validateVideoFile(videoFile)
    if (!videoValidation.valid) {
      return NextResponse.json(
        { error: videoValidation.error },
        { status: 400 }
      )
    }

    if (thumbnailFile && thumbnailFile.size > 0) {
      const thumbValidation = validateThumbnailFile(thumbnailFile)
      if (!thumbValidation.valid) {
        return NextResponse.json(
          { error: thumbValidation.error },
          { status: 400 }
        )
      }
    }

    const supabase = createServerClient()

    const videoId = crypto.randomUUID()
    const videoExt = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4'
    const videoPath = `${videoId}.${videoExt}`

    const { error: videoUploadError } = await supabase.storage
      .from('videos')
      .upload(videoPath, videoFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: videoFile.type,
      })

    if (videoUploadError) {
      throw new Error(videoUploadError.message)
    }

    const { data: videoUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
    const videoUrl = videoUrlData.publicUrl

    let thumbnailUrl: string | null = null
    let thumbnailPath: string | null = null

    if (thumbnailFile && thumbnailFile.size > 0) {
      const thumbExt = thumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      thumbnailPath = `${videoId}.${thumbExt}`

      const { error: thumbUploadError } = await supabase.storage
        .from('thumbnails')
        .upload(thumbnailPath, thumbnailFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: thumbnailFile.type,
        })

      if (thumbUploadError) {
        throw new Error(thumbUploadError.message)
      }

      const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbnailPath)
      thumbnailUrl = thumbUrlData.publicUrl
    }

    const duration = await getVideoDuration(videoFile)

    const video = await createVideo({
      title,
      description: description || null,
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl,
      duration,
      file_size: videoFile.size,
      mime_type: videoFile.type,
      storage_path: videoPath,
      thumbnail_path: thumbnailPath,
    })

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Error uploading video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload video' },
      { status: 500 }
    )
  }
}