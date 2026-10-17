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
    const status = searchParams.get('status')
    const q = searchParams.get('q')?.trim()

    const supabase = createAdminClient()

    // 1. Fetch current UPI & Coin pricing settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const upiSettings = {
      admin_upi_id: settingsMap['admin_upi_id'] || 'streamflow@upi',
      admin_upi_name: settingsMap['admin_upi_name'] || 'StreamFlow Official',
      coin_price_inr: parseFloat(settingsMap['coin_price_inr'] || '1') || 1,
    }

    // 2. Query topup requests with user profile details
    let query = supabase
      .from('topup_requests')
      .select('id, user_id, coins, amount_inr, utr_number, upi_id, status, admin_notes, created_at, updated_at, profiles:user_id(id, username, display_name, avatar_url, coin_balance)')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (q) {
      query = query.or(`utr_number.ilike.%${q}%,upi_id.ilike.%${q}%`)
    }

    const { data: requests, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: requests || [],
      settings: upiSettings,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch top-up requests'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, requestId, reason, admin_upi_id, admin_upi_name, coin_price_inr } = body || {}

    const supabase = createAdminClient()

    // -------------------------------------------------------------------------
    // ACTION: UPDATE UPI & COIN EXCHANGE SETTINGS
    // -------------------------------------------------------------------------
    if (action === 'update_settings') {
      const upiId = typeof admin_upi_id === 'string' ? admin_upi_id.trim() : 'streamflow@upi'
      const upiName = typeof admin_upi_name === 'string' ? admin_upi_name.trim() : 'StreamFlow Official'
      const coinRate = Math.max(0.01, parseFloat(coin_price_inr) || 1)

      await Promise.all([
        supabase.from('platform_settings').upsert({
          key: 'admin_upi_id',
          value: upiId,
          description: 'Admin UPI VPA address for user coin top-up payments',
          updated_at: new Date().toISOString(),
        }),
        supabase.from('platform_settings').upsert({
          key: 'admin_upi_name',
          value: upiName,
          description: 'Payee display name shown on UPI apps',
          updated_at: new Date().toISOString(),
        }),
        supabase.from('platform_settings').upsert({
          key: 'coin_price_inr',
          value: String(coinRate),
          description: 'Base exchange rate: 1 Coin = X INR',
          updated_at: new Date().toISOString(),
        }),
      ])

      return NextResponse.json({
        success: true,
        message: `UPI Settings updated! UPI ID: ${upiId} • 1 Coin = ₹${coinRate} INR`,
      })
    }

    // -------------------------------------------------------------------------
    // ACTION: APPROVE TOP-UP REQUEST
    // -------------------------------------------------------------------------
    if (action === 'approve') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      // Fetch request details
      const { data: topupReq, error: fetchErr } = await supabase
        .from('topup_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (fetchErr || !topupReq) {
        return NextResponse.json({ error: 'Top-up request not found' }, { status: 404 })
      }

      if (topupReq.status === 'approved') {
        return NextResponse.json({ error: 'This request has already been approved.' }, { status: 400 })
      }

      const userId = topupReq.user_id
      const coinsToAdd = topupReq.coins

      // Fetch user profile current balance
      const { data: userProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username, coin_balance')
        .eq('id', userId)
        .single()

      if (profileErr || !userProfile) {
        return NextResponse.json({ error: 'Associated user profile not found' }, { status: 404 })
      }

      const currentBalance = userProfile.coin_balance ?? 0
      const newBalance = currentBalance + coinsToAdd

      // 1. Credit user coin balance
      const { error: updateProfileErr } = await supabase
        .from('profiles')
        .update({ coin_balance: newBalance })
        .eq('id', userId)

      if (updateProfileErr) {
        return NextResponse.json({ error: 'Failed to update user coin balance' }, { status: 500 })
      }

      // 2. Record wallet transaction
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        amount: coinsToAdd,
        type: 'topup',
        description: `Wallet Coin Top-Up via UPI (UTR: ${topupReq.utr_number}, ₹${topupReq.amount_inr} INR)`,
      })

      // 3. Mark request as approved
      const { data: updatedReq, error: updateReqErr } = await supabase
        .from('topup_requests')
        .update({
          status: 'approved',
          admin_notes: reason?.trim() || 'Payment verified by Admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select('*')
        .single()

      if (updateReqErr) {
        return NextResponse.json({ error: updateReqErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Approved! Credited ${coinsToAdd} coins to @${userProfile.username}. New balance: ${newBalance} coins.`,
        request: updatedReq,
      })
    }

    // -------------------------------------------------------------------------
    // ACTION: DECLINE TOP-UP REQUEST
    // -------------------------------------------------------------------------
    if (action === 'decline') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const declineReason = reason?.trim() || 'Payment could not be verified with UTR reference.'

      const { data: updatedReq, error: updateReqErr } = await supabase
        .from('topup_requests')
        .update({
          status: 'rejected',
          admin_notes: declineReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select('*')
        .single()

      if (updateReqErr) {
        return NextResponse.json({ error: updateReqErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Top-up request declined: "${declineReason}"`,
        request: updatedReq,
      })
    }

    return NextResponse.json({ error: 'Invalid action provided' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
