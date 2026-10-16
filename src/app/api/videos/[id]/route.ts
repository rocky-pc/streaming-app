import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VideoVisibility, VideoRow } from '@/types'

interface RouteProps {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const { data: existingVideo, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const videoData = existingVideo as VideoRow
    if (videoData.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this video' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, visibility, thumbnail_url, thumbnail_path } = body

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof title === 'string' && title.trim()) {
      updateData.title = title.trim()
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null
    }

    if (visibility) {
      const validVisibilities: VideoVisibility[] = ['public', 'unlisted', 'private']
      if (validVisibilities.includes(visibility)) {
        updateData.visibility = visibility
      }
    }

    if (thumbnail_url !== undefined) {
      updateData.thumbnail_url = thumbnail_url
    }

    if (thumbnail_path !== undefined) {
      updateData.thumbnail_path = thumbnail_path
    }

    const { data: updatedVideo, error: updateError } = await (supabase as any)
      .from('videos')
      .update(updateData)
      .eq('id', id)
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ video: updatedVideo })
  } catch (error) {
    console.error('Error updating video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership and get storage paths for deletion
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const videoData = video as VideoRow
    if (videoData.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this video' }, { status: 403 })
    }

    // Delete record from database
    const { error: deleteError } = await supabase.from('videos').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Clean up storage files
    try {
      if (videoData.storage_path) {
        await supabase.storage.from('videos').remove([videoData.storage_path])
      }
      if (videoData.thumbnail_path) {
        await supabase.storage.from('thumbnails').remove([videoData.thumbnail_path])
      }
    } catch (storageErr) {
      console.warn('Storage cleanup warning after video deletion:', storageErr)
    }

    return NextResponse.json({ success: true, message: 'Video deleted successfully' })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
