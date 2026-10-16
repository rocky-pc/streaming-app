// Supabase Edge Function: livekit-token
// Generates short-lived, least-privilege LiveKit tokens with strict Supabase Auth & RLS validation

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AccessToken } from 'npm:livekit-server-sdk@^2.6.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  streamId: string
  action: 'broadcast' | 'view' | 'end'
  participantName?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const livekitUrl = Deno.env.get('LIVEKIT_URL') || ''
    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY') || ''
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') || ''

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      return new Response(
        JSON.stringify({ error: 'LiveKit server configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate the caller using Supabase Auth
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    let authenticatedUser: { id: string; email?: string } | null = null

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
        if (!userError && user) {
          authenticatedUser = { id: user.id, email: user.email }
        }
      }
    }

    const body: RequestBody = await req.json()
    const { streamId, action, participantName } = body

    if (!streamId || !action) {
      return new Response(
        JSON.stringify({ error: 'streamId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch stream record from database
    const { data: stream, error: streamError } = await supabaseClient
      .from('live_streams')
      .select('*, profiles:user_id(username, display_name, avatar_url)')
      .eq('id', streamId)
      .single()

    if (streamError || !stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Broadcaster Action: Authorization & Transition to Live
    if (action === 'broadcast') {
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ error: 'Authentication required to broadcast' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (stream.user_id !== authenticatedUser.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: you do not own this live stream' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (stream.status === 'ended') {
        return new Response(
          JSON.stringify({ error: 'This stream has already ended and cannot be restarted.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Transition to live if scheduled
      if (stream.status === 'scheduled') {
        await supabaseClient
          .from('live_streams')
          .update({
            status: 'live',
            started_at: new Date().toISOString(),
          })
          .eq('id', stream.id)
      }

      // Mint Broadcaster Token (canPublish: true)
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

      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. End Stream Action: Securely transition status to ended
    if (action === 'end') {
      if (!authenticatedUser || stream.user_id !== authenticatedUser.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: only the broadcaster can end this stream' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabaseClient
        .from('live_streams')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', stream.id)

      return new Response(
        JSON.stringify({ success: true, status: 'ended' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Viewer Action: Least-Privilege Subscribe Token
    if (action === 'view') {
      // Check stream status
      if (stream.status === 'ended') {
        return new Response(
          JSON.stringify({ error: 'Stream has ended', status: 'ended' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (stream.status === 'scheduled') {
        return new Response(
          JSON.stringify({ error: 'Stream has not started yet', status: 'scheduled' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check visibility rules
      if (stream.visibility === 'private') {
        if (!authenticatedUser || authenticatedUser.id !== stream.user_id) {
          return new Response(
            JSON.stringify({ error: 'This stream is private and can only be viewed by its creator.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Generate anonymous or user viewer identity
      const viewerIdentity = authenticatedUser
        ? `viewer-${authenticatedUser.id}`
        : `guest-${crypto.randomUUID().slice(0, 8)}`

      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: viewerIdentity,
        name: participantName || (authenticatedUser ? 'Viewer' : 'Guest Viewer'),
        ttl: '3h',
      })

      // Least Privilege: Subscribe ONLY. Cannot publish audio, video, or data tracks.
      at.addGrant({
        room: stream.room_name,
        roomJoin: true,
        canPublish: false,
        canPublishData: false,
        canSubscribe: true,
      })

      const token = await at.toJwt()

      return new Response(
        JSON.stringify({
          token,
          livekitUrl,
          roomName: stream.room_name,
          stream: {
            id: stream.id,
            title: stream.title,
            status: stream.status,
            visibility: stream.visibility,
            user_id: stream.user_id,
            profiles: stream.profiles,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
