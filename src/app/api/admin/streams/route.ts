import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { LiveStreamVisibility, LiveStreamRow } from '@/types/database'

function getRoomServiceClient() {
  const livekitHost = (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'https://stream-flow-8560l64p.livekit.cloud')
    .replace(/^wss:\/\//i, 'https://')
    .replace(/^ws:\/\//i, 'http://')
  const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APID9m8XgypZbA4'
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'N2RpJ7xVbyNfZnd3bzY1yQ6CZPoVTLGRS3cqYnnF6qO'

  // Dynamic import on demand
  return import('livekit-server-sdk').then(({ RoomServiceClient }) => {
    return new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret)
  })
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Fetch all streams with profiles
    const { data: streams, error } = await supabase
      .from('live_streams')
      .select('*, profiles:user_id(*)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Try fetching active rooms from LiveKit Cloud
    let activeRoomsMap: Record<string, { numParticipants: number; creationTime?: number }> = {}
    try {
      const roomService = await getRoomServiceClient()
      const livekitRooms = await roomService.listRooms()
      for (const r of livekitRooms) {
        activeRoomsMap[r.name] = {
          numParticipants: r.numParticipants,
          creationTime: Number(r.creationTime),
        }
      }
    } catch (lkErr) {
      console.warn('LiveKit room query error:', lkErr)
    }

    // Enrich stream records with LiveKit real-time telemetry
    const streamsList = (streams || []) as unknown as (LiveStreamRow & { profiles?: unknown })[]
    const enrichedStreams = streamsList.map((stream) => {
      const lkData = activeRoomsMap[stream.room_name]
      return {
        ...stream,
        isLiveKitActive: Boolean(lkData),
        livekitParticipants: lkData?.numParticipants ?? 0,
      }
    })

    return NextResponse.json({ streams: enrichedStreams })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch streams'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, streamId, roomName, visibility } = body || {}
    const supabase = createAdminClient()

    // 1. Force End / Kill Stream
    if (action === 'end_stream' || action === 'kill_stream') {
      if (!streamId) {
        return NextResponse.json({ error: 'Missing streamId' }, { status: 400 })
      }

      // If roomName provided, delete from LiveKit Cloud
      if (roomName) {
        try {
          const roomService = await getRoomServiceClient()
          await roomService.deleteRoom(roomName)
        } catch (lkErr) {
          console.warn('LiveKit deleteRoom warning:', lkErr)
        }
      }

      // Mark stream ended in database
      const { error } = await supabase
        .from('live_streams')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', streamId)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Live stream terminated and disconnected successfully',
      })
    }

    // 2. Update Stream Visibility
    if (action === 'update_visibility') {
      if (!streamId || !visibility) {
        return NextResponse.json({ error: 'Missing streamId or visibility' }, { status: 400 })
      }

      const { error } = await supabase
        .from('live_streams')
        .update({ visibility: visibility as LiveStreamVisibility })
        .eq('id', streamId)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: `Stream visibility updated to ${visibility}`,
      })
    }

    // 3. Purge Ghost Streams
    if (action === 'purge_ghosts') {
      const roomService = await getRoomServiceClient()
      const livekitRooms = await roomService.listRooms()
      const activeRoomNames = new Set(livekitRooms.map((r) => r.name))

      const { data: liveStreams } = await supabase
        .from('live_streams')
        .select('id, room_name, started_at')
        .eq('status', 'live')

      const ghostIds: string[] = []
      const now = Date.now()
      const streamsList = (liveStreams || []) as unknown as { id: string; room_name: string; started_at: string | null }[]

      for (const s of streamsList) {
        const streamStartTime = s.started_at ? new Date(s.started_at).getTime() : now
        const isFresh = now - streamStartTime < 45000 // 45s grace period
        if (!activeRoomNames.has(s.room_name) && !isFresh) {
          ghostIds.push(s.id)
        }
      }

      if (ghostIds.length > 0) {
        await supabase
          .from('live_streams')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .in('id', ghostIds)
      }

      return NextResponse.json({
        success: true,
        prunedCount: ghostIds.length,
        message: `Successfully pruned ${ghostIds.length} ghost stream(s)`,
      })
    }

    // 4. Delete Stream
    if (action === 'delete_stream') {
      if (!streamId) {
        return NextResponse.json({ error: 'Missing streamId' }, { status: 400 })
      }

      // Also clean up any associated chat messages
      await supabase.from('live_chat_messages').delete().eq('stream_id', streamId)

      const { error } = await supabase
        .from('live_streams')
        .delete()
        .eq('id', streamId)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Stream and associated chat data deleted successfully',
      })
    }

    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Action failed'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
