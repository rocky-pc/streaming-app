import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    const supabase = createAdminClient()

    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, coin_balance, chat_enabled, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (q) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    }

    const { data: users, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich with video, stream counts, and lifetime streamer revenue
    const enrichedUsers = await Promise.all(
      (users || []).map(async (u) => {
        const [{ count: videoCount }, { count: streamCount }, { data: earningsData }] = await Promise.all([
          supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
          supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
          supabase.from('wallet_transactions').select('amount').eq('user_id', u.id).eq('type', 'streamer_earning'),
        ])
        const totalEarnings = (earningsData || []).reduce((acc, row) => acc + (row.amount || 0), 0)
        return {
          ...u,
          videoCount: videoCount || 0,
          streamCount: streamCount || 0,
          totalRevenue: totalEarnings,
        }
      })
    )

    return NextResponse.json({ users: enrichedUsers })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch users'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userId, chat_enabled, coin_action, coin_amount, reason } = body || {}

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Live Chat Permission Toggle
    if (typeof chat_enabled === 'boolean') {
      const { data, error } = await supabase
        .from('profiles')
        .update({ chat_enabled })
        .eq('id', userId)
        .select('id, username, display_name, chat_enabled, coin_balance')
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        user: data,
        message: `Live chat access ${chat_enabled ? 'enabled' : 'disabled'} for @${data.username}`,
      })
    }

    // 2. Coin Management (Add / Remove / Set)
    if (coin_action && typeof coin_amount === 'number') {
      const { data: currentProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, username, coin_balance')
        .eq('id', userId)
        .single()

      if (fetchErr || !currentProfile) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const currentCoins = currentProfile.coin_balance ?? 0
      let newBalance = currentCoins
      let delta = 0

      if (coin_action === 'add') {
        delta = Math.abs(coin_amount)
        newBalance = currentCoins + delta
      } else if (coin_action === 'remove') {
        delta = -Math.abs(coin_amount)
        newBalance = Math.max(0, currentCoins - Math.abs(coin_amount))
      } else if (coin_action === 'set') {
        newBalance = Math.max(0, coin_amount)
        delta = newBalance - currentCoins
      }

      const { data: updatedUser, error: updateErr } = await supabase
        .from('profiles')
        .update({ coin_balance: newBalance })
        .eq('id', userId)
        .select('id, username, display_name, chat_enabled, coin_balance')
        .single()

      if (updateErr) throw updateErr

      // Log wallet transaction
      if (delta !== 0) {
        await supabase.from('wallet_transactions').insert({
          user_id: userId,
          amount: delta,
          type: 'admin_adjustment',
          description: reason || `Admin adjusted coins (${delta > 0 ? `+${delta}` : delta} coins)`,
        })
      }

      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: `Updated @${updatedUser.username} wallet balance to ${newBalance} coins`,
      })
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update user'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
