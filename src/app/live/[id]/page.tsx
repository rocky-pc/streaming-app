import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { LivePlayerClient } from './LivePlayerClient'
import type { LiveStreamRow, ProfileRow } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getLiveStream(id: string): Promise<(LiveStreamRow & { profiles?: ProfileRow | null }) | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
