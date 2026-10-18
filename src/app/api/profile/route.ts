import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const username = searchParams.get('username')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseService = createSupabaseServiceClient<any>(supabaseUrl, supabaseServiceKey)

    let targetUserId = userId

    if (!targetUserId && !username) {
      const supabaseServer = await createClient()
      const { data: { user } } = await supabaseServer.auth.getUser()
      if (user) {
        targetUserId = user.id
      } else {
        return NextResponse.json({ error: 'User ID or username is required' }, { status: 400 })
      }
    }

    let profileQuery = supabaseService.from('profiles').select('*')
    if (targetUserId) {
      profileQuery = profileQuery.eq('id', targetUserId)
    } else if (username) {
      profileQuery = profileQuery.eq('username', username.toLowerCase())
    }

    const { data: profile, error: profileErr } = await profileQuery.single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Sum all streamer_earning transactions for this user
    const { data: earningsData } = await supabaseService
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', profile.id)
      .eq('type', 'streamer_earning')

    const streamerRevenue = (earningsData || []).reduce(
      (acc: number, tx: { amount?: number }) => acc + (tx.amount || 0),
      0
    )

    return NextResponse.json({
      profile,
      streamerRevenue,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

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
