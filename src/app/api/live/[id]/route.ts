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

    const supabaseServer = await createSupabaseServerClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
