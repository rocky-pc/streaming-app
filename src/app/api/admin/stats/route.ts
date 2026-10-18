import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const startTime = Date.now()

    // 1. Parallel queries to Supabase
    const [
      { count: activeStreamsCount },
      { count: totalStreamsCount },
      { count: totalVideosCount },
      { count: totalChatsCount },
      { count: totalProfilesCount },
    ] = await Promise.all([
      supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('status', 'live'),
      supabase.from('live_streams').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('live_chat_messages').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    const dbLatency = Date.now() - startTime

    // 2. Check LiveKit Cloud Status
    const livekitHost = (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'https://stream-flow-8560l64p.livekit.cloud')
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
    const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APID9m8XgypZbA4'
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'N2RpJ7xVbyNfZnd3bzY1yQ6CZPoVTLGRS3cqYnnF6qO'

    let livekitStatus = {
      connected: false,
      activeRooms: 0,
      host: livekitHost,
      latencyMs: 0,
      error: null as string | null,
    }

    try {
      const lkStart = Date.now()
      const { RoomServiceClient } = await import('livekit-server-sdk')
      const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret)
      const rooms = await roomService.listRooms()
      livekitStatus = {
        connected: true,
        activeRooms: rooms.length,
        host: livekitHost,
        latencyMs: Date.now() - lkStart,
        error: null,
      }
    } catch (lkErr: unknown) {
      livekitStatus.error = lkErr instanceof Error ? lkErr.message : 'Connection failed'
    }

    return NextResponse.json({
      stats: {
        activeStreams: activeStreamsCount || 0,
        totalStreams: totalStreamsCount || 0,
        totalVideos: totalVideosCount || 0,
        totalChats: totalChatsCount || 0,
        totalProfiles: totalProfilesCount || 0,
      },
      health: {
        database: {
          connected: true,
          latencyMs: dbLatency,
        },
        livekit: livekitStatus,
      },
      serverTime: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch admin stats'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
