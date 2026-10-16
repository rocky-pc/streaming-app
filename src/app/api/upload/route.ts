import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VideoVisibility } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Server-side authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to upload videos.' },
        { status: 401 }
      )
    }

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
      visibility = 'public',
    } = body

    if (!title || !video_url || !storage_path) {
      return NextResponse.json(
        { error: 'Title, video URL, and storage path are required.' },
        { status: 400 }
      )
    }

    const validVisibilities: VideoVisibility[] = ['public', 'unlisted', 'private']
    const finalVisibility: VideoVisibility = validVisibilities.includes(visibility)
      ? visibility
      : 'public'

    const insertPayload: any = {
      title: title.trim(),
      description: description?.trim() || null,
      thumbnail_url: thumbnail_url || null,
      video_url,
      duration: duration || null,
      file_size: file_size || null,
      mime_type: mime_type || null,
      storage_path,
      thumbnail_path: thumbnail_path || null,
      visibility: finalVisibility,
      user_id: user.id,
    }

    const { data: video, error: dbError } = await supabase
      .from('videos')
      .insert(insertPayload)
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (dbError) {
      // If DB insert fails, attempt cleanup of storage files to avoid orphans
      try {
        if (storage_path) {
          await supabase.storage.from('videos').remove([storage_path])
        }
        if (thumbnail_path) {
          await supabase.storage.from('thumbnails').remove([thumbnail_path])
        }
      } catch (cleanErr) {
        console.warn('Cleanup failed after error:', cleanErr)
      }

      console.error('Database insert error:', dbError)
      return NextResponse.json(
        { error: dbError.message || 'Failed to save video metadata.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ video }, { status: 201 })
  } catch (error) {
    console.error('Error saving video metadata:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    )
  }
}