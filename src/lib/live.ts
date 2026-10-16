import { createClient } from '@supabase/supabase-js'
import { RoomServiceClient } from 'livekit-server-sdk'
import type { LiveStreamRow, ProfileRow } from '@/types/database'

export async function getPublicLiveStreams(limit = 6): Promise<(LiveStreamRow & { profiles?: ProfileRow | null })[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: streams, error } = await supabase
      .from('live_streams')
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error || !streams || streams.length === 0) {
      return []
    }

    // Auto-prune ghost streams: verify if room is genuinely active on LiveKit Cloud
    const livekitHost = (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'https://stream-flow-8560l64p.livekit.cloud')
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
    const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APID9m8XgypZbA4'
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'N2RpJ7xVbyNfZnd3bzY1yQ6CZPoVTLGRS3cqYnnF6qO'

    try {
      const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret)
      const activeRooms = await roomService.listRooms()
      const activeRoomNames = new Set(activeRooms.map((r) => r.name))

      const verifiedStreams: (LiveStreamRow & { profiles?: ProfileRow | null })[] = []
      const ghostStreamIds: string[] = []
      const now = Date.now()

      for (const stream of streams) {
        const streamStartTime = stream.started_at ? new Date(stream.started_at).getTime() : now
        const isFresh = now - streamStartTime < 45000 // give 45s grace period after clicking Go Live

        if (activeRoomNames.has(stream.room_name) || isFresh) {
          verifiedStreams.push(stream as (LiveStreamRow & { profiles?: ProfileRow | null }))
        } else {
          // Room does not exist on LiveKit and grace period expired -> ghost stream!
          ghostStreamIds.push(stream.id)
        }
      }

      // Automatically prune ghost streams in DB
      if (ghostStreamIds.length > 0) {
        void supabase
          .from('live_streams')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .in('id', ghostStreamIds)
          .then(
            () => {
              console.log(`Pruned ${ghostStreamIds.length} inactive ghost stream(s) from database.`)
            },
            (err: unknown) => {
              console.error('Error auto-pruning ghost streams:', err)
            }
          )
      }

      return verifiedStreams
    } catch (livekitErr) {
      console.warn('LiveKit room check unavailable, returning database records:', livekitErr)
      return streams as (LiveStreamRow & { profiles?: ProfileRow | null })[]
    }
  } catch (err) {
    console.error('Error fetching public live streams:', err)
    return []
  }
}
