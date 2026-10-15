import { NextRequest, NextResponse } from 'next/server'
import { createVideo } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      title,
      description,
      thumbnail_url,
      video_url,
      duration,
      file_size,
      mime_type,
      storage_path,
      thumbnail_path,
    } = body

    if (!title || !video_url || !storage_path) {
      return NextResponse.json(
        { error: 'Title, video URL, and storage path are required' },
        { status: 400 }
      )
    }

    const video = await createVideo({
      title,
      description: description || null,
      thumbnail_url: thumbnail_url || null,
      video_url,
      duration: duration || null,
      file_size: file_size || null,
      mime_type: mime_type || null,
      storage_path,
      thumbnail_path: thumbnail_path || null,
    })

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Error saving video metadata:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save video metadata' },
      { status: 500 }
    )
  }
}