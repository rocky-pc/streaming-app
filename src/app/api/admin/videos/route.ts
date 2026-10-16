import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

import { VideoVisibility, Database } from '@/types/database'

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const visibility = searchParams.get('visibility')

    const supabase = createAdminClient()

    let query = supabase
      .from('videos')
      .select('*, profiles:user_id(*)')
      .order('created_at', { ascending: false })

    if (visibility && visibility !== 'all') {
      query = query.eq('visibility', visibility)
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    }

    const { data: videos, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ videos: videos || [] })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch videos'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { videoId, visibility, title, description } = body || {}

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updates: Database['public']['Tables']['videos']['Update'] = {}

    if (visibility) updates.visibility = visibility as VideoVisibility
    if (typeof title === 'string') updates.title = title
    if (typeof description === 'string') updates.description = description

    const { data, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', videoId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, video: data })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update video'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('id')

    if (!videoId) {
      return NextResponse.json({ error: 'Missing video id parameter' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Get video info to delete storage files
    const { data: video } = await supabase
      .from('videos')
      .select('storage_path, thumbnail_path')
      .eq('id', videoId)
      .single()

    // 2. Delete storage files if paths exist
    if (video?.storage_path) {
      try {
        await supabase.storage.from('videos').remove([video.storage_path])
      } catch (stErr) {
        console.warn('Storage file cleanup warning:', stErr)
      }
    }

    if (video?.thumbnail_path) {
      try {
        await supabase.storage.from('thumbnails').remove([video.thumbnail_path])
      } catch (stErr) {
        console.warn('Thumbnail storage file cleanup warning:', stErr)
      }
    }

    // 3. Delete database record
    const { error } = await supabase.from('videos').delete().eq('id', videoId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Video and associated storage assets deleted successfully',
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete video'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
