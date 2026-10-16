import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { display_name, bio, avatar_url } = body

    const updateData: ProfileUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (display_name !== undefined) {
      updateData.display_name = display_name?.trim() || null
    }

    if (bio !== undefined) {
      updateData.bio = bio?.trim() || null
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    const { data: profile, error: dbError } = await (supabase as any)
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
