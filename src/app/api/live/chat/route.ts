import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// GET: Fetch recent chat messages for a live stream
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'streamId is required' }, { status: 400 })
    }

    // If test stream, return empty or mock messages
    if (streamId === 'test') {
      return NextResponse.json({ messages: [] })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data: messages, error } = await supabaseService
      .from('live_chat_messages')
      .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message, messages: [] }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch chat messages'
    return NextResponse.json({ error: message, messages: [] }, { status: 500 })
  }
}

// POST: Send a new chat message
export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be signed in to send messages.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { streamId, message } = body

    if (!streamId || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'streamId and message are required.' },
        { status: 400 }
      )
    }

    const cleanMessage = message.trim().slice(0, 300)

    // Handle test room
    if (streamId === 'test') {
      const mockMsg = {
        id: `mock-${Date.now()}`,
        stream_id: 'test',
        user_id: user.id,
        message: cleanMessage,
        created_at: new Date().toISOString(),
        profiles: {
          id: user.id,
          username: user.user_metadata?.username || 'user',
          display_name: user.user_metadata?.display_name || user.email || 'Viewer',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      }
      return NextResponse.json({ message: mockMsg }, { status: 201 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data: newMsg, error: insertError } = await supabaseService
      .from('live_chat_messages')
      .insert({
        stream_id: streamId,
        user_id: user.id,
        message: cleanMessage,
      })
      .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (insertError || !newMsg) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to send chat message.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: newMsg }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
