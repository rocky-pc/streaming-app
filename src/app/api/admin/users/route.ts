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

    // 1. Fetch unlocked private chat users from platform settings for fallback resilience
    const { data: unlockSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'unlocked_private_chat_users')
      .maybeSingle()

    let unlockedUserIds: string[] = []
    if (unlockSetting?.value) {
      try {
        const parsed = JSON.parse(unlockSetting.value)
        if (Array.isArray(parsed)) unlockedUserIds = parsed
      } catch {
        // ignore
      }
    }
    const unlockedSet = new Set(unlockedUserIds)

    // 2. Query profiles
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (q) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    }

    const { data: users, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Enrich with video, stream counts, lifetime streamer revenue, and private_chat_enabled
    const enrichedUsers = await Promise.all(
      (users || []).map(async (u) => {
        const [{ count: videoCount }, { count: streamCount }, { data: earningsData }] = await Promise.all([
          supabase.from('videos').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
          supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
          supabase.from('wallet_transactions').select('amount').eq('user_id', u.id).eq('type', 'streamer_earning'),
        ])
        const totalEarnings = (earningsData || []).reduce((acc, row) => acc + (row.amount || 0), 0)
        const isPrivateChatUnlocked = Boolean(u.private_chat_enabled || unlockedSet.has(u.id))

        return {
          ...u,
          private_chat_enabled: isPrivateChatUnlocked,
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
    const { userId, chat_enabled, private_chat_enabled, coin_action, coin_amount, reason } = body || {}

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

    // 2. Private Chat Permission Switch (Requested by user)
    if (typeof private_chat_enabled === 'boolean') {
      // Try updating profiles column
      await supabase
        .from('profiles')
        .update({ private_chat_enabled })
        .eq('id', userId)

      // Also sync to platform_settings unlocked_private_chat_users for 100% resilience
      try {
        const { data: unlockSetting } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'unlocked_private_chat_users')
          .maybeSingle()

        let userIds: string[] = []
        if (unlockSetting?.value) {
          try {
            const parsed = JSON.parse(unlockSetting.value)
            if (Array.isArray(parsed)) userIds = parsed
          } catch {
            // ignore
          }
        }

        if (private_chat_enabled) {
          if (!userIds.includes(userId)) userIds.push(userId)
        } else {
          userIds = userIds.filter((id) => id !== userId)
        }

        await supabase
          .from('platform_settings')
          .upsert({
            key: 'unlocked_private_chat_users',
            value: JSON.stringify(userIds),
            description: 'List of user IDs with active private chat access',
            updated_at: new Date().toISOString(),
          })
      } catch (syncErr) {
        console.warn('Error syncing unlocked_private_chat_users:', syncErr)
      }

      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name, chat_enabled, coin_balance')
        .eq('id', userId)
        .single()

      return NextResponse.json({
        success: true,
        user: { ...updatedProfile, private_chat_enabled },
        message: `Private chat ${private_chat_enabled ? 'unlocked/enabled' : 'locked/disabled'} for @${updatedProfile?.username || 'user'}`,
      })
    }

    // 3. Coin Management (Add / Remove / Set)
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update user'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

// DELETE: Permanently delete a user (Requested by user)
export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    let userId = searchParams.get('userId')

    if (!userId) {
      try {
        const body = await request.json()
        userId = body?.userId
      } catch {
        // no body
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch user profile for username confirmation
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle()

    const username = targetProfile?.username || userId

    // 2. Cascade cleanup related records
    try {
      await supabase.from('live_private_chat_messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    } catch {
      // ignore
    }

    try {
      await supabase.from('live_chat_messages').delete().eq('user_id', userId)
      await supabase.from('topup_requests').delete().eq('user_id', userId)
      await supabase.from('wallet_transactions').delete().eq('user_id', userId)
      await supabase.from('live_streams').delete().eq('user_id', userId)
      await supabase.from('videos').delete().eq('user_id', userId)
    } catch (cleanupErr) {
      console.warn('Error during user tables cleanup:', cleanupErr)
    }

    // 3. Remove from unlocked_private_chat_users if present
    try {
      const { data: unlockSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'unlocked_private_chat_users')
        .maybeSingle()

      if (unlockSetting?.value) {
        const parsed = JSON.parse(unlockSetting.value)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((id) => id !== userId)
          await supabase.from('platform_settings').upsert({
            key: 'unlocked_private_chat_users',
            value: JSON.stringify(filtered),
            description: 'List of user IDs with active private chat access',
            updated_at: new Date().toISOString(),
          })
        }
      }
    } catch {
      // ignore
    }

    // 4. Delete Profile record
    await supabase.from('profiles').delete().eq('id', userId)

    // 5. Delete Supabase Auth User
    try {
      const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId)
      if (authDeleteErr) {
        console.warn('Auth user deletion warning:', authDeleteErr.message)
      }
    } catch (authErr) {
      console.warn('Error deleting auth user:', authErr)
    }

    return NextResponse.json({
      success: true,
      message: `User @${username} was permanently deleted successfully.`,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete user'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
