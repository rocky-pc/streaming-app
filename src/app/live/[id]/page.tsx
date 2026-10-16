import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { LivePlayerClient } from './LivePlayerClient'
import type { LiveStreamRow, ProfileRow } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getLiveStream(id: string): Promise<(LiveStreamRow & { profiles?: ProfileRow | null }) | null> {
  if (id === 'test') {
    return {
      id: 'test',
      user_id: 'test-broadcaster',
      title: 'LiveKit Cloud Test Room',
      description: 'Realtime test room for verifying LiveKit Cloud audio/video streaming.',
      room_name: 'Test',
      status: 'live',
      visibility: 'public',
      started_at: new Date().toISOString(),
      ended_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        id: 'test-broadcaster',
        username: 'livekit_tester',
        display_name: 'LiveKit Cloud Test',
        avatar_url: null,
        bio: 'Test Stream',
        coin_balance: 50,
        chat_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (!isUuid) {
    return null
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: stream, error } = await supabase
      .from('live_streams')
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('id', id)
      .single()

    if (error || !stream) {
      return null
    }

    return stream as (LiveStreamRow & { profiles?: ProfileRow | null })
  } catch (err) {
    console.error('Error fetching live stream on server:', err)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const stream = await getLiveStream(id)

  if (!stream) {
    return {
      title: 'Live Stream Not Found | StreamFlow',
    }
  }

  const broadcaster = stream.profiles?.display_name || 'Creator'

  return {
    title: `${stream.title} - ${broadcaster} (LIVE) | StreamFlow`,
    description: stream.description || `Watch ${broadcaster} live on StreamFlow`,
    openGraph: {
      title: `${stream.title} (LIVE)`,
      description: stream.description || `Watch ${broadcaster} live on StreamFlow`,
      type: 'video.other',
    },
  }
}

export default async function WatchLivePage({ params }: PageProps) {
  const { id } = await params
  const stream = await getLiveStream(id)

  return <LivePlayerClient initialStream={stream} streamId={id} />
}
