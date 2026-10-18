import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('stream_id')
    const q = searchParams.get('q')?.trim()

    const supabase = createAdminClient()

    let query = supabase
      .from('live_chat_messages')
      .select('*, profiles:user_id(username, display_name, avatar_url), live_streams:stream_id(title, room_name, status)')
      .order('created_at', { ascending: false })

    if (streamId) {
      query = query.eq('stream_id', streamId)
    }

    if (q) {
      query = query.ilike('message', `%${q}%`)
    }

    const { data: messages, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch chats'
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
    const messageId = searchParams.get('id')
    const streamId = searchParams.get('stream_id')

    if (!messageId && !streamId) {
      return NextResponse.json(
        { error: 'Provide either id (message id) or stream_id to purge' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    if (messageId) {
      const { error } = await supabase
        .from('live_chat_messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Chat message deleted successfully',
      })
    }

    if (streamId) {
      const { error } = await supabase
        .from('live_chat_messages')
        .delete()
        .eq('stream_id', streamId)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'All chat messages for this stream were purged',
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete chat'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
