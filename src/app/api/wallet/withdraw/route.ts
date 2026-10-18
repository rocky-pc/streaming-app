import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseServiceClient<any>(supabaseUrl, supabaseServiceKey)
}

export interface UserWithdrawalItem {
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
}

// GET: Fetch user's withdrawal data, payout rate, min limit, and request history
export async function GET() {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch user's current profile (coins)
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('id, username, display_name, coin_balance')
      .eq('id', user.id)
      .single()

    // 2. Fetch lifetime streamer revenue and deposited coins
    const [{ data: earningsData }, { data: depositsData }] = await Promise.all([
      supabaseService
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'streamer_earning'),
      supabaseService
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .in('type', ['topup', 'purchase']),
    ])

    const totalEarnedCoins = (earningsData || []).reduce(
      (acc: number, tx: { amount?: number }) => acc + (tx.amount || 0),
      0
    )
    const totalDepositedCoins = (depositsData || []).reduce(
      (acc: number, tx: { amount?: number }) => acc + (tx.amount || 0),
      0
    )

    // 3. Fetch Platform Economics for Payouts
    const { data: settings } = await supabaseService.from('platform_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const rateCoins = Math.max(1, parseInt(settingsMap['streamer_payout_rate_coins'] || '100', 10))
    const rateInr = Math.max(1, parseFloat(settingsMap['streamer_payout_rate_inr'] || '20') || 20)
    const minWithdrawalInr = Math.max(1, parseFloat(settingsMap['min_withdrawal_inr'] || '100') || 100)
    const allowedSource =
      (settingsMap['withdrawal_allowed_source'] as 'earned_only' | 'deposited_only' | 'both') || 'both'
    const instructions =
      settingsMap['withdrawal_instructions'] ||
      'Enter your UPI ID and requested amount. Admin will verify and transfer funds to your UPI account manually.'

    // 4. Fetch User's Withdrawal Requests
    let requests: UserWithdrawalItem[] = []

    // Try dedicated table first
    const { data: dbRequests, error: dbErr } = await supabaseService
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!dbErr && Array.isArray(dbRequests)) {
      requests = dbRequests as UserWithdrawalItem[]
    } else {
      // Fallback: Read from platform_settings streamer_withdrawal_requests
      try {
        const parsed = JSON.parse(settingsMap['streamer_withdrawal_requests'] || '[]')
        if (Array.isArray(parsed)) {
          requests = parsed
            .filter((r: UserWithdrawalItem) => r.user_id === user.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
      } catch {
        requests = []
      }
    }

    const balance = profile?.coin_balance ?? 0

    // Deduct previous active/completed withdrawals from corresponding source
    const withdrawnEarned = requests
      .filter((r) => r.status !== 'rejected' && r.withdrawal_source === 'earned_only')
      .reduce((acc, r) => acc + (r.coins || 0), 0)
    const withdrawnDeposited = requests
      .filter((r) => r.status !== 'rejected' && r.withdrawal_source === 'deposited_only')
      .reduce((acc, r) => acc + (r.coins || 0), 0)
    const withdrawnOther = requests
      .filter(
        (r) =>
          r.status !== 'rejected' &&
          r.withdrawal_source !== 'earned_only' &&
          r.withdrawal_source !== 'deposited_only'
      )
      .reduce((acc, r) => acc + (r.coins || 0), 0)

    const availableEarnedCoins = Math.min(
      balance,
      Math.max(0, totalEarnedCoins - withdrawnEarned - Math.min(totalEarnedCoins, withdrawnOther))
    )
    const availableDepositedCoins = Math.min(
      balance,
      Math.max(0, totalDepositedCoins - withdrawnDeposited - Math.min(totalDepositedCoins, withdrawnOther))
    )

    let withdrawableCoins = balance
    if (allowedSource === 'earned_only') {
      withdrawableCoins = availableEarnedCoins
    } else if (allowedSource === 'deposited_only') {
      withdrawableCoins = availableDepositedCoins
    } else {
      withdrawableCoins = balance
    }

    return NextResponse.json({
      success: true,
      coinBalance: balance,
      totalEarnedCoins,
      totalDepositedCoins,
      availableEarnedCoins,
      availableDepositedCoins,
      withdrawableCoins,
      allowedSource,
      settings: {
        streamer_payout_rate_coins: rateCoins,
        streamer_payout_rate_inr: rateInr,
        min_withdrawal_inr: minWithdrawalInr,
        withdrawal_allowed_source: allowedSource,
        instructions,
      },
      requests,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch withdrawal details'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Submit a new withdrawal request
export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { coins, amount_inr, upi_id, upi_name } = body || {}

    const cleanUpi = (upi_id || '').trim()
    if (!cleanUpi || !cleanUpi.includes('@')) {
      return NextResponse.json(
        { error: 'Valid UPI ID is required (e.g. yourname@okhdfcbank or 9876543210@paytm)' },
        { status: 400 }
      )
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch Platform Settings (Conversion rate & Min threshold)
    const { data: settings } = await supabaseService.from('platform_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const rateCoins = Math.max(1, parseInt(settingsMap['streamer_payout_rate_coins'] || '100', 10))
    const rateInr = Math.max(0.1, parseFloat(settingsMap['streamer_payout_rate_inr'] || '20') || 20)
    const minWithdrawalInr = Math.max(1, parseFloat(settingsMap['min_withdrawal_inr'] || '100') || 100)

    // Calculate coins to deduct and INR amount to payout
    let coinsNeeded = 0
    let finalAmountInr = 0

    if (typeof coins === 'number' && coins > 0) {
      coinsNeeded = Math.round(coins)
      finalAmountInr = Math.floor(((coinsNeeded * rateInr) / rateCoins) * 100) / 100
    } else if (typeof amount_inr === 'number' && amount_inr > 0) {
      finalAmountInr = Math.round(amount_inr * 100) / 100
      coinsNeeded = Math.ceil((finalAmountInr * rateCoins) / rateInr)
    } else {
      return NextResponse.json({ error: 'Please enter a valid withdrawal amount' }, { status: 400 })
    }

    if (finalAmountInr < minWithdrawalInr) {
      const minCoins = Math.ceil((minWithdrawalInr * rateCoins) / rateInr)
      return NextResponse.json(
        {
          error: `Minimum withdrawal amount is ₹${minWithdrawalInr} (${minCoins} coins). At current rate: ${rateCoins} coins = ₹${rateInr}.`,
        },
        { status: 400 }
      )
    }

    // 2. Fetch User Profile & Balance check
    const { data: profile, error: profileErr } = await supabaseService
      .from('profiles')
      .select('id, username, coin_balance')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const currentBalance = profile.coin_balance ?? 0

    // Fetch user's lifetime earnings & deposits to enforce allowed source policy
    const allowedSource =
      (settingsMap['withdrawal_allowed_source'] as 'earned_only' | 'deposited_only' | 'both') || 'both'

    const [{ data: earningsData }, { data: depositsData }] = await Promise.all([
      supabaseService
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'streamer_earning'),
      supabaseService
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .in('type', ['topup', 'purchase']),
    ])

    const totalEarnedCoins = (earningsData || []).reduce(
      (acc: number, tx: { amount?: number }) => acc + (tx.amount || 0),
      0
    )
    const totalDepositedCoins = (depositsData || []).reduce(
      (acc: number, tx: { amount?: number }) => acc + (tx.amount || 0),
      0
    )

    // Calculate existing withdrawals to find available amounts
    let userExistingRequests: UserWithdrawalItem[] = []
    const { data: dbExisting } = await supabaseService.from('withdrawal_requests').select('*').eq('user_id', user.id)
    if (Array.isArray(dbExisting)) {
      userExistingRequests = dbExisting
    } else if (settingsMap['streamer_withdrawal_requests']) {
      try {
        const parsed = JSON.parse(settingsMap['streamer_withdrawal_requests'])
        if (Array.isArray(parsed)) {
          userExistingRequests = parsed.filter((r: UserWithdrawalItem) => r.user_id === user.id)
        }
      } catch {}
    }

    const withdrawnEarned = userExistingRequests
      .filter((r) => r.status !== 'rejected' && r.withdrawal_source === 'earned_only')
      .reduce((acc, r) => acc + (r.coins || 0), 0)
    const withdrawnDeposited = userExistingRequests
      .filter((r) => r.status !== 'rejected' && r.withdrawal_source === 'deposited_only')
      .reduce((acc, r) => acc + (r.coins || 0), 0)
    const withdrawnOther = userExistingRequests
      .filter(
        (r) =>
          r.status !== 'rejected' &&
          r.withdrawal_source !== 'earned_only' &&
          r.withdrawal_source !== 'deposited_only'
      )
      .reduce((acc, r) => acc + (r.coins || 0), 0)

    const availableEarnedCoins = Math.min(
      currentBalance,
      Math.max(0, totalEarnedCoins - withdrawnEarned - Math.min(totalEarnedCoins, withdrawnOther))
    )
    const availableDepositedCoins = Math.min(
      currentBalance,
      Math.max(0, totalDepositedCoins - withdrawnDeposited - Math.min(totalDepositedCoins, withdrawnOther))
    )

    // Enforce Admin source policy
    if (allowedSource === 'earned_only' && coinsNeeded > availableEarnedCoins) {
      return NextResponse.json(
        {
          error: `Platform policy allows withdrawing earned coins only. You requested ${coinsNeeded} coins, but your withdrawable earned balance is ${availableEarnedCoins} coins (Total wallet balance: ${currentBalance} coins).`,
          requiredCoins: coinsNeeded,
          availableEarnedCoins,
          currentBalance,
          allowedSource,
        },
        { status: 400 }
      )
    }

    if (allowedSource === 'deposited_only' && coinsNeeded > availableDepositedCoins) {
      return NextResponse.json(
        {
          error: `Platform policy allows withdrawing deposited coins only. You requested ${coinsNeeded} coins, but your withdrawable deposited balance is ${availableDepositedCoins} coins (Total wallet balance: ${currentBalance} coins).`,
          requiredCoins: coinsNeeded,
          availableDepositedCoins,
          currentBalance,
          allowedSource,
        },
        { status: 400 }
      )
    }

    if (currentBalance < coinsNeeded) {
      return NextResponse.json(
        {
          error: `Insufficient coin balance. You need ${coinsNeeded} coins to withdraw ₹${finalAmountInr} (Your balance: ${currentBalance} coins).`,
          requiredCoins: coinsNeeded,
          currentBalance,
        },
        { status: 400 }
      )
    }

    const newBalance = currentBalance - coinsNeeded

    // 3. Deduct coins from user profile
    const { error: deductErr } = await supabaseService
      .from('profiles')
      .update({ coin_balance: newBalance })
      .eq('id', user.id)

    if (deductErr) {
      return NextResponse.json({ error: 'Failed to update coin balance' }, { status: 500 })
    }

    const requestId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    // 4. Log wallet transaction
    try {
      await supabaseService.from('wallet_transactions').insert({
        user_id: user.id,
        amount: -coinsNeeded,
        type: 'withdrawal',
        description: `Streamer withdrawal request: ₹${finalAmountInr} to UPI: ${cleanUpi}`,
      })
    } catch (txErr) {
      console.warn('Wallet transaction insert notice:', txErr)
    }

    const newRequest: UserWithdrawalItem = {
      id: requestId,
      user_id: user.id,
      coins: coinsNeeded,
      amount_inr: finalAmountInr,
      upi_id: cleanUpi,
      upi_name: upi_name ? String(upi_name).trim() : null,
      status: 'pending',
      withdrawal_source: allowedSource,
      admin_notes: `Awaiting admin transfer via UPI (${allowedSource === 'earned_only' ? 'Earned Coins' : allowedSource === 'deposited_only' ? 'Deposited Coins' : 'Wallet Balance'})`,
      created_at: nowIso,
      updated_at: nowIso,
    }

    // 5. Insert into withdrawal_requests table with fallback to platform_settings
    let insertedInTable = false
    try {
      const { error: insErr } = await supabaseService.from('withdrawal_requests').insert(newRequest)
      if (!insErr) {
        insertedInTable = true
      }
    } catch {
      // Table doesn't exist yet, use fallback
    }

    // Always sync into platform_settings streamer_withdrawal_requests as resilient fallback
    try {
      let allRequests: UserWithdrawalItem[] = []
      if (settingsMap['streamer_withdrawal_requests']) {
        const parsed = JSON.parse(settingsMap['streamer_withdrawal_requests'])
        if (Array.isArray(parsed)) allRequests = parsed
      }
      allRequests.unshift(newRequest)
      await supabaseService.from('platform_settings').upsert({
        key: 'streamer_withdrawal_requests',
        value: JSON.stringify(allRequests.slice(0, 200)),
        description: 'Active streamer withdrawal requests ledger fallback',
        updated_at: nowIso,
      })
    } catch (syncErr) {
      console.warn('Fallback sync notice:', syncErr)
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal request for ₹${finalAmountInr} submitted successfully! Admin will transfer the amount to your UPI (${cleanUpi}) manually.`,
      request: newRequest,
      newBalance,
      coinsDeducted: coinsNeeded,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit withdrawal request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
