import { createClient } from '@supabase/supabase-js'
import type { LiveStreamRow, ProfileRow } from '@/types/database'

export async function getPublicLiveStreams(limit = 6): Promise<(LiveStreamRow & { profiles?: ProfileRow | null })[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: streams, error } = await supabase
      .from('live_streams')
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('visibility', 'public')
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error || !streams) {
      return []
    }

    return streams as (LiveStreamRow & { profiles?: ProfileRow | null })[]
  } catch (err) {
    console.error('Error fetching public live streams:', err)
    return []
  }
}
