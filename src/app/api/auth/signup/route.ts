import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, username, displayName } = body || {}

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const cleanUsername = String(username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')

    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters and contain only letters, numbers, and underscores.' },
        { status: 400 }
      )
    }

    const cleanDisplayName = String(displayName || '').trim() || cleanUsername
    const supabaseAdmin = getServiceRoleClient()

    // 1. Check if username is already taken
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', cleanUsername)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: 'This username is already taken. Please choose another.' }, { status: 400 })
    }

    // 2. Fetch signup bonus coin setting
    let signupBonus = 50
    try {
      const { data: setting } = await supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'signup_coin_bonus')
        .maybeSingle()
      if (setting?.value) {
        signupBonus = Math.max(0, parseInt(setting.value, 10) || 50)
      }
    } catch {
      signupBonus = 50
    }

    // 3. Create user directly with email_confirm: true (No confirmation email sent, bypasses rate limit)
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // AUTO-CONFIRM: Skips email sending & rate limit
      user_metadata: {
        username: cleanUsername,
        display_name: cleanDisplayName,
      },
    })

    if (createError) {
      if (
        createError.message?.toLowerCase().includes('already registered') ||
        createError.message?.toLowerCase().includes('duplicate')
      ) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please sign in instead.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!createData.user) {
      return NextResponse.json({ error: 'Failed to create user account.' }, { status: 500 })
    }

    const userId = createData.user.id

    // 4. Ensure profile row exists in public.profiles with initial coins and chat enabled
    try {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: userId,
          username: cleanUsername,
          display_name: cleanDisplayName,
          coin_balance: signupBonus,
          chat_enabled: true,
          private_chat_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch (profileErr) {
      console.warn('Profile upsert warning:', profileErr)
    }

    // 5. Record initial signup bonus in wallet_transactions
    if (signupBonus > 0) {
      try {
        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: userId,
          amount: signupBonus,
          type: 'topup',
          description: `Welcome bonus: ${signupBonus} coins credited on signup`,
        })
      } catch (txErr) {
        console.warn('Signup bonus transaction warning:', txErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created and confirmed successfully!',
      user: {
        id: userId,
        email: createData.user.email,
        username: cleanUsername,
        displayName: cleanDisplayName,
      },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error during registration'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
