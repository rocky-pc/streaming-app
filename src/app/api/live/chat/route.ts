import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, supabaseServiceKey)
}

// GET: Fetch recent chat messages and current chat economics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'streamId is required' }, { status: 400 })
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch current platform economics
    const { data: settings } = await supabaseService
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }
    const chatCost = parseInt(settingsMap['chat_cost_per_message'] || '2', 10)
    const streamerPercent = parseInt(settingsMap['streamer_revenue_percent'] || '70', 10)

    // Check optional authenticated user status
    let userCoins: number | null = null
    let userChatEnabled: boolean = true

    try {
      const supabaseServer = await createSupabaseServerClient()
      const { data: { user } } = await supabaseServer.auth.getUser()
      if (user) {
        const { data: userProfile } = await supabaseService
          .from('profiles')
          .select('coin_balance, chat_enabled')
          .eq('id', user.id)
          .single()

        if (userProfile) {
          userCoins = userProfile.coin_balance ?? 0
          userChatEnabled = userProfile.chat_enabled ?? true
        }
      }
    } catch {
      // Ignore if unauthenticated
    }

    // If test stream, return empty messages with economics
    if (streamId === 'test') {
      return NextResponse.json({
        messages: [],
        economics: {
          chatCost,
          streamerPercent,
          userCoins,
          userChatEnabled,
        },
      })
    }

    const { data: messages, error } = await supabaseService
      .from('live_chat_messages')
      .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message, messages: [] }, { status: 500 })
    }

    return NextResponse.json({
      messages: messages || [],
      economics: {
        chatCost,
        streamerPercent,
        userCoins,
        userChatEnabled,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch chat messages'
    return NextResponse.json({ error: message, messages: [] }, { status: 500 })
  }
}

// POST: Send a new chat message with coin deduction and streamer revenue distribution
export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be signed in to send messages.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { streamId, message } = body

    if (!streamId || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'streamId and message are required.' },
        { status: 400 }
      )
    }

    const cleanMessage = message.trim().slice(0, 300)
    const supabaseService = getServiceRoleClient()

    // 1. Verify user's chat permission and coin balance
    const { data: senderProfile } = await supabaseService
      .from('profiles')
      .select('id, username, display_name, coin_balance, chat_enabled')
      .eq('id', user.id)
      .single()

    if (senderProfile && senderProfile.chat_enabled === false) {
      return NextResponse.json(
        { error: 'Your live chat privileges have been disabled by an administrator.' },
        { status: 403 }
      )
    }

    // 2. Fetch platform economics
    const { data: settings } = await supabaseService
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const chatCost = Math.max(0, parseInt(settingsMap['chat_cost_per_message'] || '0', 10))
    const streamerPercent = Math.min(100, Math.max(0, parseInt(settingsMap['streamer_revenue_percent'] || '70', 10)))

    let remainingCoins = senderProfile?.coin_balance ?? 50

    // Handle test room
    if (streamId === 'test') {
      const mockMsg = {
        id: `mock-${Date.now()}`,
        stream_id: 'test',
        user_id: user.id,
        message: cleanMessage,
        created_at: new Date().toISOString(),
        profiles: {
          id: user.id,
          username: senderProfile?.username || user.user_metadata?.username || 'user',
          display_name: senderProfile?.display_name || user.user_metadata?.display_name || 'Viewer',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      }
      return NextResponse.json({ message: mockMsg, remainingCoins }, { status: 201 })
    }

    // 3. Process coin deduction if chat charge is active
    if (chatCost > 0) {
      const currentCoins = senderProfile?.coin_balance ?? 0
      if (currentCoins < chatCost) {
        return NextResponse.json(
          {
            error: `Insufficient coins. Each message requires ${chatCost} coins (Your balance: ${currentCoins} coins).`,
            requiredCoins: chatCost,
            currentCoins,
          },
          { status: 402 }
        )
      }

      remainingCoins = currentCoins - chatCost

      // Deduct from viewer wallet
      await supabaseService
        .from('profiles')
        .update({ coin_balance: remainingCoins })
        .eq('id', user.id)

      // Ledger entry for sender
      await supabaseService.from('wallet_transactions').insert({
        user_id: user.id,
        amount: -chatCost,
        type: 'chat_fee',
        related_stream_id: streamId,
        description: `Live chat message (${chatCost} coins)`,
      })

      // 4. Distribute percentage revenue share to streamer
      try {
        const { data: streamData } = await supabaseService
          .from('live_streams')
          .select('user_id, title')
          .eq('id', streamId)
          .single()

        if (streamData && streamData.user_id && streamData.user_id !== user.id) {
          const streamerEarnings = Math.floor(chatCost * (streamerPercent / 100))

          if (streamerEarnings > 0) {
            const { data: streamerProfile } = await supabaseService
              .from('profiles')
              .select('coin_balance')
              .eq('id', streamData.user_id)
              .single()

            const currentStreamerCoins = streamerProfile?.coin_balance ?? 0
            const newStreamerCoins = currentStreamerCoins + streamerEarnings

            await supabaseService
              .from('profiles')
              .update({ coin_balance: newStreamerCoins })
              .eq('id', streamData.user_id)

            await supabaseService.from('wallet_transactions').insert({
              user_id: streamData.user_id,
              amount: streamerEarnings,
              type: 'streamer_earning',
              related_stream_id: streamId,
              description: `Viewer chat revenue share (${streamerPercent}%)`,
            })
          }
        }
      } catch (streamerEarnErr) {
        console.warn('Error crediting streamer coins:', streamerEarnErr)
      }
    }

    // 5. Insert chat message into database
    const { data: newMsg, error: insertError } = await supabaseService
      .from('live_chat_messages')
      .insert({
        stream_id: streamId,
        user_id: user.id,
        message: cleanMessage,
      })
      .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (insertError || !newMsg) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to send chat message.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: newMsg,
        remainingCoins,
        chatCost,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
