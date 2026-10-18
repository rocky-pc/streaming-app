import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Stream ID is required' }, { status: 400 })
    }

    if (id === 'test') {
      return NextResponse.json({
        data: {
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      })
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (!isUuid) {
      return NextResponse.json({ error: 'Live stream not found' }, { status: 404 })
    }

    const supabaseServer = await createSupabaseServerClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data: stream, error } = await supabaseService
      .from('live_streams')
      .select('*, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('id', id)
      .single()

    if (error || !stream) {
      return NextResponse.json({ error: 'Live stream not found' }, { status: 404 })
    }

    // Check visibility permissions
    if (stream.visibility === 'private') {
      if (!user || user.id !== stream.user_id) {
        return NextResponse.json(
          { error: 'This live stream is private.' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ data: stream })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
