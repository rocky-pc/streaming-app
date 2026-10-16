import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// GET: Fetch live streams for homepage or public listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'live'
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50)

    // Using service role client to ensure reliable joins and RLS consistency
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabaseService
      .from('live_streams')
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('visibility', 'public')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: streams, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 })
    }

    if (!streams || streams.length === 0 || status !== 'live') {
      return NextResponse.json({ data: streams || [] })
    }

    // Auto-prune ghost streams: verify active LiveKit rooms
    const livekitHost = (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'https://stream-flow-8560l64p.livekit.cloud')
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
    const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APID9m8XgypZbA4'
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'N2RpJ7xVbyNfZnd3bzY1yQ6CZPoVTLGRS3cqYnnF6qO'

    try {
      const { RoomServiceClient } = await import('livekit-server-sdk')
      const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret)
      const activeRooms = await roomService.listRooms()
      const activeRoomNames = new Set(activeRooms.map((r) => r.name))

      const verifiedStreams = []
      const ghostStreamIds: string[] = []
      const now = Date.now()

      for (const s of streams) {
        const streamStartTime = s.started_at ? new Date(s.started_at).getTime() : now
        const isFresh = now - streamStartTime < 45000 // 45s grace period

        if (activeRoomNames.has(s.room_name) || isFresh) {
          verifiedStreams.push(s)
        } else {
          ghostStreamIds.push(s.id)
        }
      }

      if (ghostStreamIds.length > 0) {
        supabaseService
          .from('live_streams')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .in('id', ghostStreamIds)
          .then(() => {})
      }

      return NextResponse.json({ data: verifiedStreams })
    } catch {
      return NextResponse.json({ data: streams || [] })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live streams'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

// POST: Create a new live stream (authenticated)
export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be signed in to create a live stream.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, description, visibility = 'public' } = body

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'A stream title is required.' },
        { status: 400 }
      )
    }

    if (!['public', 'unlisted', 'private'].includes(visibility)) {
      return NextResponse.json(
        { error: 'Invalid visibility option.' },
        { status: 400 }
      )
    }

    // Generate unique LiveKit room name
    const uniqueId = Math.random().toString(36).substring(2, 10)
    const roomName = `room-${user.id.slice(0, 8)}-${Date.now()}-${uniqueId}`

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data: stream, error: insertError } = await supabaseService
      .from('live_streams')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        room_name: roomName,
        status: 'scheduled',
        visibility,
      })
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (insertError || !stream) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create live stream.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: stream }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
