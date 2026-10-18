import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, supabaseServiceKey)
}

const DEFAULT_PACKAGES = [
  { coins: 100, inr: 50, popular: false },
  { coins: 250, inr: 100, popular: true },
  { coins: 550, inr: 200, popular: false },
  { coins: 1500, inr: 500, popular: false },
  { coins: 3200, inr: 1000, popular: false },
]

export async function GET() {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user } } = await supabaseServer.auth.getUser()

    const supabaseService = getServiceRoleClient()

    // 1. Fetch UPI settings and coin rates from platform_settings
    const { data: settings } = await supabaseService
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const upiId = settingsMap['admin_upi_id'] || 'streamflow@upi'
    const upiName = settingsMap['admin_upi_name'] || 'StreamFlow Official'
    const coinPriceInr = parseFloat(settingsMap['coin_price_inr'] || '1') || 1
    const instructions = settingsMap['topup_instructions'] || 'Pay using any UPI app to the UPI ID below. Then enter your transaction UTR number and submit.'

    let packages = DEFAULT_PACKAGES
    if (settingsMap['topup_packages']) {
      try {
        const parsed = JSON.parse(settingsMap['topup_packages'])
        if (Array.isArray(parsed) && parsed.length > 0) {
          packages = parsed
        }
      } catch {
        packages = DEFAULT_PACKAGES
      }
    }

    // 2. Fetch user's recent top-up requests if authenticated
    let userRequests = []
    let currentBalance = 0

    if (user) {
      const [profileRes, requestsRes] = await Promise.all([
        supabaseService
          .from('profiles')
          .select('coin_balance')
          .eq('id', user.id)
          .single(),
        supabaseService
          .from('topup_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      currentBalance = profileRes.data?.coin_balance ?? 0
      userRequests = requestsRes.data || []
    }

    return NextResponse.json({
      upiId,
      upiName,
      coinPriceInr,
      packages,
      instructions,
      currentBalance,
      requests: userRequests,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch top-up configuration'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be signed in to submit a top-up request.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { coins, amountInr, utrNumber, upiId } = body || {}

    const cleanCoins = parseInt(coins, 10)
    const cleanAmount = parseFloat(amountInr)
    const cleanUtr = typeof utrNumber === 'string' ? utrNumber.trim().toUpperCase() : ''
    const cleanUpi = typeof upiId === 'string' ? upiId.trim() : ''

    if (!cleanCoins || cleanCoins <= 0) {
      return NextResponse.json({ error: 'Please enter a valid coin amount (minimum 1 coin).' }, { status: 400 })
    }

    if (!cleanAmount || cleanAmount <= 0) {
      return NextResponse.json({ error: 'Invalid INR amount.' }, { status: 400 })
    }

    if (!cleanUtr || cleanUtr.length < 6) {
      return NextResponse.json({ error: 'Please enter a valid 12-digit UPI / UTR Transaction Reference Number.' }, { status: 400 })
    }

    const supabaseService = getServiceRoleClient()

    // Check for duplicate pending/approved request with same UTR to prevent accidental duplicate submission
    const { data: existingUtr } = await supabaseService
      .from('topup_requests')
      .select('id, status, utr_number')
      .eq('utr_number', cleanUtr)
      .limit(1)

    if (existingUtr && existingUtr.length > 0) {
      const match = existingUtr[0]
      if (match.status === 'pending') {
        return NextResponse.json(
          { error: 'A top-up request with this UTR number is already pending review.' },
          { status: 400 }
        )
      } else if (match.status === 'approved') {
        return NextResponse.json(
          { error: 'This UTR number has already been processed and credited.' },
          { status: 400 }
        )
      }
    }

    // Insert new top-up request
    const { data: newRequest, error: insertError } = await supabaseService
      .from('topup_requests')
      .insert({
        user_id: user.id,
        coins: cleanCoins,
        amount_inr: cleanAmount,
        utr_number: cleanUtr,
        upi_id: cleanUpi || 'streamflow@upi',
        status: 'pending',
      })
      .select('*')
      .single()

    if (insertError || !newRequest) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to submit top-up request.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Top-up request submitted successfully! Coins will be credited once verified by admin.',
      request: newRequest,
    }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
