import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export interface AdminWithdrawalItem {
  id: string
  user_id: string
  coins: number
  amount_inr: number
  upi_id: string
  upi_name?: string | null
  status: 'pending' | 'approved' | 'rejected'
  withdrawal_source?: 'earned_only' | 'deposited_only' | 'both'
  admin_notes?: string | null
  created_at: string
  updated_at?: string
  profiles?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    coin_balance: number
  } | null
}

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q')?.trim().toLowerCase()

    const supabase = createAdminClient()

    // 1. Fetch Payout Economics & Settings
    const { data: settings } = await supabase.from('platform_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const rateCoins = Math.max(1, parseInt(settingsMap['streamer_payout_rate_coins'] || '100', 10))
    const rateInr = Math.max(0.1, parseFloat(settingsMap['streamer_payout_rate_inr'] || '20') || 20)
    const minWithdrawalInr = Math.max(1, parseFloat(settingsMap['min_withdrawal_inr'] || '100') || 100)
    const instructions =
      settingsMap['withdrawal_instructions'] ||
      'Enter your UPI ID and requested amount. Admin will verify and transfer funds to your UPI account manually.'

    // 2. Fetch withdrawal requests
    let requests: AdminWithdrawalItem[] = []

    // Try withdrawal_requests table first
    const { data: dbRequests, error: dbErr } = await supabase
      .from('withdrawal_requests')
      .select('*, profiles:user_id(id, username, display_name, avatar_url, coin_balance)')
      .order('created_at', { ascending: false })

    if (!dbErr && Array.isArray(dbRequests) && dbRequests.length > 0) {
      requests = dbRequests as AdminWithdrawalItem[]
    } else {
      // Fallback: load from platform_settings
      try {
        const parsed = JSON.parse(settingsMap['streamer_withdrawal_requests'] || '[]')
        if (Array.isArray(parsed)) {
          // Enrich with profiles
          const userIds = Array.from(new Set(parsed.map((r: AdminWithdrawalItem) => r.user_id).filter(Boolean)))
          const { data: profilesList } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, coin_balance')
            .in('id', userIds)

          const profileMap = new Map((profilesList || []).map((p) => [p.id, p]))

          requests = parsed.map((r: AdminWithdrawalItem) => ({
            ...r,
            profiles: profileMap.get(r.user_id) || null,
          }))
        }
      } catch {
        requests = []
      }
    }

    // Sort descending by created_at
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Summary statistics
    const pendingRequests = requests.filter((r) => r.status === 'pending')
    const approvedRequests = requests.filter((r) => r.status === 'approved')
    const pendingCount = pendingRequests.length
    const pendingInr = pendingRequests.reduce((acc, r) => acc + (Number(r.amount_inr) || 0), 0)
    const approvedInr = approvedRequests.reduce((acc, r) => acc + (Number(r.amount_inr) || 0), 0)
    const approvedCoins = approvedRequests.reduce((acc, r) => acc + (Number(r.coins) || 0), 0)

    // Filter if requested
    let filteredRequests = requests
    if (status && status !== 'all') {
      filteredRequests = filteredRequests.filter((r) => r.status === status)
    }

    if (q) {
      filteredRequests = filteredRequests.filter((r) => {
        const upiMatch = r.upi_id?.toLowerCase().includes(q)
        const nameMatch = r.upi_name?.toLowerCase().includes(q)
        const userMatch = r.profiles?.username?.toLowerCase().includes(q)
        const notesMatch = r.admin_notes?.toLowerCase().includes(q)
        return Boolean(upiMatch || nameMatch || userMatch || notesMatch)
      })
    }

    const allowedSource =
      (settingsMap['withdrawal_allowed_source'] as 'earned_only' | 'deposited_only' | 'both') || 'both'

    return NextResponse.json({
      success: true,
      requests: filteredRequests,
      totalCount: requests.length,
      settings: {
        streamer_payout_rate_coins: rateCoins,
        streamer_payout_rate_inr: rateInr,
        min_withdrawal_inr: minWithdrawalInr,
        withdrawal_allowed_source: allowedSource,
        instructions,
      },
      stats: {
        pendingCount,
        pendingInr: Math.round(pendingInr * 100) / 100,
        approvedInr: Math.round(approvedInr * 100) / 100,
        approvedCoins,
      },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch withdrawal requests'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      action,
      requestId,
      reason,
      utr,
      streamer_payout_rate_coins,
      streamer_payout_rate_inr,
      min_withdrawal_inr,
      withdrawal_allowed_source,
      instructions,
    } = body || {}

    const supabase = createAdminClient()

    // -------------------------------------------------------------------------
    // ACTION: UPDATE PAYOUT CONVERSION & SETTINGS
    // -------------------------------------------------------------------------
    if (action === 'update_settings') {
      const upserts = []

      if (withdrawal_allowed_source !== undefined) {
        const validSource = ['earned_only', 'deposited_only', 'both'].includes(withdrawal_allowed_source)
          ? withdrawal_allowed_source
          : 'both'
        upserts.push({
          key: 'withdrawal_allowed_source',
          value: validSource,
          description: 'Allowed withdrawal coin source: earned_only, deposited_only, or both',
          updated_at: new Date().toISOString(),
        })
      }

      if (streamer_payout_rate_coins !== undefined) {
        upserts.push({
          key: 'streamer_payout_rate_coins',
          value: String(Math.max(1, parseInt(streamer_payout_rate_coins, 10) || 100)),
          description: 'Coins equivalent for streamer earnings payout conversion (e.g. 100)',
          updated_at: new Date().toISOString(),
        })
      }

      if (streamer_payout_rate_inr !== undefined) {
        upserts.push({
          key: 'streamer_payout_rate_inr',
          value: String(Math.max(0.1, parseFloat(streamer_payout_rate_inr) || 20)),
          description: 'INR equivalent for streamer earnings payout conversion (e.g. 20 INR)',
          updated_at: new Date().toISOString(),
        })
      }

      if (min_withdrawal_inr !== undefined) {
        upserts.push({
          key: 'min_withdrawal_inr',
          value: String(Math.max(1, parseFloat(min_withdrawal_inr) || 100)),
          description: 'Minimum withdrawal amount in INR required for streamer payout request',
          updated_at: new Date().toISOString(),
        })
      }

      if (instructions !== undefined) {
        upserts.push({
          key: 'withdrawal_instructions',
          value: String(instructions).trim(),
          description: 'Instructions shown to users when requesting earnings withdrawal',
          updated_at: new Date().toISOString(),
        })
      }

      for (const item of upserts) {
        await supabase.from('platform_settings').upsert(item, { onConflict: 'key' })
      }

      return NextResponse.json({
        success: true,
        message: 'Streamer earnings payout rate and withdrawal settings updated successfully!',
      })
    }

    // -------------------------------------------------------------------------
    // ACTION: APPROVE WITHDRAWAL (ADMIN CONFIRMS UPI TRANSFER)
    // -------------------------------------------------------------------------
    if (action === 'approve') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const nowIso = new Date().toISOString()
      const utrText = utr?.trim()
      const adminNote = utrText
        ? `Paid via UPI (UTR/Ref: ${utrText})`
        : 'Paid by Admin via manual UPI transfer'

      // 1. Update in withdrawal_requests table
      let tableUpdated = false
      const { data: updatedDb, error: updateDbErr } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'approved',
          admin_notes: adminNote,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .select('*')
        .single()

      if (!updateDbErr && updatedDb) {
        tableUpdated = true
      }

      // 2. Sync to platform_settings streamer_withdrawal_requests fallback
      let matchedRequest: AdminWithdrawalItem | null = updatedDb || null
      try {
        const { data: fallbackData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'streamer_withdrawal_requests')
          .single()

        if (fallbackData?.value) {
          const list: AdminWithdrawalItem[] = JSON.parse(fallbackData.value)
          let found = false
          const updatedList = list.map((item) => {
            if (item.id === requestId) {
              found = true
              matchedRequest = {
                ...item,
                status: 'approved',
                admin_notes: adminNote,
                updated_at: nowIso,
              }
              return matchedRequest
            }
            return item
          })

          if (found) {
            await supabase.from('platform_settings').upsert({
              key: 'streamer_withdrawal_requests',
              value: JSON.stringify(updatedList),
              updated_at: nowIso,
            })
          }
        }
      } catch (err) {
        console.warn('Fallback sync notice:', err)
      }

      return NextResponse.json({
        success: true,
        message: `Withdrawal request approved and marked as paid via UPI! ${utrText ? `(UTR: ${utrText})` : ''}`,
        request: matchedRequest,
      })
    }

    // -------------------------------------------------------------------------
    // ACTION: DECLINE WITHDRAWAL (REFUNDS DEDUCTED COINS TO USER WALLET)
    // -------------------------------------------------------------------------
    if (action === 'decline') {
      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
      }

      const declineReason = reason?.trim() || 'Declined by admin: UPI details incorrect or payment failed.'
      const nowIso = new Date().toISOString()

      // 1. Find existing request data to know coins to refund & user_id
      let targetRequest: AdminWithdrawalItem | null = null

      const { data: dbItem } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (dbItem) {
        targetRequest = dbItem as AdminWithdrawalItem
      } else {
        // Look in platform_settings
        const { data: fallbackData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'streamer_withdrawal_requests')
          .single()

        if (fallbackData?.value) {
          const list: AdminWithdrawalItem[] = JSON.parse(fallbackData.value)
          targetRequest = list.find((item) => item.id === requestId) || null
        }
      }

      if (!targetRequest) {
        return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 })
      }

      if (targetRequest.status === 'rejected') {
        return NextResponse.json({ error: 'This withdrawal request has already been declined and refunded.' }, { status: 400 })
      }

      const userId = targetRequest.user_id
      const coinsToRefund = Number(targetRequest.coins) || 0

      // 2. Refund deducted coins back to the user's wallet
      if (userId && coinsToRefund > 0) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('coin_balance, username')
          .eq('id', userId)
          .single()

        const currentBalance = userProfile?.coin_balance ?? 0
        const restoredBalance = currentBalance + coinsToRefund

        await supabase
          .from('profiles')
          .update({ coin_balance: restoredBalance })
          .eq('id', userId)

        // Log refund transaction
        try {
          await supabase.from('wallet_transactions').insert({
            user_id: userId,
            amount: coinsToRefund,
            type: 'withdrawal_refund',
            description: `Withdrawal declined refund: ${coinsToRefund} coins restored. Reason: ${declineReason}`,
          })
        } catch {
          // In case constraint requires standard types, fallback with description
          try {
            await supabase.from('wallet_transactions').insert({
              user_id: userId,
              amount: coinsToRefund,
              type: 'streamer_earning',
              description: `Withdrawal declined refund: ${coinsToRefund} coins restored. Reason: ${declineReason}`,
            })
          } catch {
            // Ignore transaction logging failure if constraint blocks
          }
        }
      }

      // 3. Mark request as rejected in withdrawal_requests table
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'rejected',
          admin_notes: declineReason,
          updated_at: nowIso,
        })
        .eq('id', requestId)

      // 4. Update fallback in platform_settings
      try {
        const { data: fallbackData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'streamer_withdrawal_requests')
          .single()

        if (fallbackData?.value) {
          const list: AdminWithdrawalItem[] = JSON.parse(fallbackData.value)
          const updatedList = list.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  status: 'rejected',
                  admin_notes: declineReason,
                  updated_at: nowIso,
                }
              : item
          )
          await supabase.from('platform_settings').upsert({
            key: 'streamer_withdrawal_requests',
            value: JSON.stringify(updatedList),
            updated_at: nowIso,
          })
        }
      } catch (err) {
        console.warn('Fallback sync notice:', err)
      }

      return NextResponse.json({
        success: true,
        message: `Withdrawal declined. ${coinsToRefund} coins have been refunded back to user's wallet.`,
        refundedCoins: coinsToRefund,
      })
    }

    return NextResponse.json({ error: 'Invalid action provided' }, { status: 400 })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
