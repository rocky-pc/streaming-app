import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APID9m8XgypZbA4'
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'N2RpJ7xVbyNfZnd3bzY1yQ6CZPoVTLGRS3cqYnnF6qO'
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || 'wss://stream-flow-8560l64p.livekit.cloud'

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit server credentials are not configured.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { streamId, action, participantName } = body

    if (!streamId || !action) {
      return NextResponse.json(
        { error: 'streamId and action are required.' },
        { status: 400 }
      )
    }

    // 1. Identify user from Next.js session or Authorization header
    let authenticatedUser: { id: string; email?: string } | null = null
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    if (user) {
      authenticatedUser = { id: user.id, email: user.email }
    } else {
      // Check Bearer authorization header fallback
      const authHeader = request.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim()
        if (token) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          const tokenClient = createClient(supabaseUrl, supabaseAnonKey)
          const { data: { user: headerUser } } = await tokenClient.auth.getUser(token)
          if (headerUser) {
            authenticatedUser = { id: headerUser.id, email: headerUser.email }
          }
        }
      }
    }

    // 2. Fetch stream from database using service role client to ensure reliable access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data: stream, error: streamError } = await supabaseService
      .from('live_streams')
      .select('*, profiles:user_id(username, display_name, avatar_url)')
      .eq('id', streamId)
      .single()

    if (streamError || !stream) {
      return NextResponse.json(
        { error: 'Live stream not found.' },
        { status: 404 }
      )
    }

    // 3. Broadcaster Action
    if (action === 'broadcast') {
      if (!authenticatedUser) {
        return NextResponse.json(
          { error: 'Authentication required to broadcast.' },
          { status: 401 }
        )
      }

      if (stream.user_id !== authenticatedUser.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own this live stream.' },
          { status: 403 }
        )
      }

      if (stream.status === 'ended') {
        return NextResponse.json(
          { error: 'This live stream has already ended and cannot be restarted.' },
          { status: 400 }
        )
      }

      // Transition to live if currently scheduled
      if (stream.status === 'scheduled') {
        await supabaseService
          .from('live_streams')
          .update({
            status: 'live',
            started_at: new Date().toISOString(),
          })
          .eq('id', stream.id)
      }

      // Broadcaster grant: can publish audio, video, and data tracks
      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: `broadcaster-${authenticatedUser.id}`,
        name: participantName || stream.profiles?.display_name || 'Broadcaster',
        ttl: '6h',
      })

      at.addGrant({
        room: stream.room_name,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      })

      const token = await at.toJwt()

      return NextResponse.json({
        token,
        livekitUrl,
        roomName: stream.room_name,
        stream: {
          id: stream.id,
          title: stream.title,
          status: 'live',
          visibility: stream.visibility,
          user_id: stream.user_id,
        },
      })
    }

    // 4. End Stream Action
    if (action === 'end') {
      if (!authenticatedUser || stream.user_id !== authenticatedUser.id) {
        return NextResponse.json(
          { error: 'Forbidden: Only the stream owner can end this stream.' },
          { status: 403 }
        )
      }

      await supabaseService
        .from('live_streams')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', stream.id)

      return NextResponse.json({ success: true, status: 'ended' })
    }

    // 5. Viewer Action
    if (action === 'view') {
      if (stream.status === 'ended') {
        return NextResponse.json(
          { error: 'This live stream has ended.', status: 'ended' },
          { status: 410 }
        )
      }

      if (stream.status === 'scheduled') {
        return NextResponse.json(
          { error: 'This stream has not started broadcasting yet.', status: 'scheduled' },
          { status: 400 }
        )
      }

      if (stream.visibility === 'private') {
        if (!authenticatedUser || authenticatedUser.id !== stream.user_id) {
          return NextResponse.json(
            { error: 'This stream is private and can only be viewed by its owner.' },
            { status: 403 }
          )
        }
      }

      const viewerIdentity = authenticatedUser
        ? `viewer-${authenticatedUser.id}`
        : `guest-${Math.random().toString(36).substring(2, 9)}`

      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: viewerIdentity,
        name: participantName || (authenticatedUser ? 'Viewer' : 'Guest Viewer'),
        ttl: '3h',
      })

      // Least Privilege: Subscribe ONLY!
      at.addGrant({
        room: stream.room_name,
        roomJoin: true,
        canPublish: false,
        canPublishData: false,
        canSubscribe: true,
      })

      const token = await at.toJwt()

      return NextResponse.json({
        token,
        livekitUrl,
        roomName: stream.room_name,
        stream: {
          id: stream.id,
          title: stream.title,
          description: stream.description,
          status: stream.status,
          visibility: stream.visibility,
          user_id: stream.user_id,
          profiles: stream.profiles,
        },
      })
    }

    return NextResponse.json(
      { error: `Unsupported action: ${action}` },
      { status: 400 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
