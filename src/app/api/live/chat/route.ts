import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, supabaseServiceKey)
}

const DEFAULT_PAID_EMOJIS = [
  { emoji: '❤️', cost: 5 },
  { emoji: '🔥', cost: 10 },
  { emoji: '👏', cost: 15 },
  { emoji: '🎉', cost: 25 },
  { emoji: '💎', cost: 50 },
  { emoji: '🚀', cost: 100 },
  { emoji: '👑', cost: 500 },
]

// GET: Fetch recent chat messages and current chat economics (including paid emojis)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')

    if (!streamId) {
      return NextResponse.json({ error: 'streamId is required' }, { status: 400 })
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch current platform economics & paid emojis
    const { data: settings } = await supabaseService
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }
    const chatCost = parseInt(settingsMap['chat_cost_per_message'] || '0', 10)
    const streamerPercent = parseInt(settingsMap['streamer_revenue_percent'] || '70', 10)

    let paidEmojis = DEFAULT_PAID_EMOJIS
    if (settingsMap['paid_chat_emojis']) {
      try {
        const parsed = JSON.parse(settingsMap['paid_chat_emojis'])
        if (Array.isArray(parsed) && parsed.length > 0) {
          paidEmojis = parsed
        }
      } catch {
        paidEmojis = DEFAULT_PAID_EMOJIS
      }
    }

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
          paidEmojis,
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let messages: any[] = []

    const primaryQuery = await supabaseService
      .from('live_chat_messages')
      .select('id, stream_id, user_id, message, created_at, paid_emoji, coins_paid, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (primaryQuery.error) {
      console.warn('Live chat primary query failed, attempting schema fallback:', primaryQuery.error.message)
      const fallbackQuery = await supabaseService
        .from('live_chat_messages')
        .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (fallbackQuery.error) {
        return NextResponse.json({ error: fallbackQuery.error.message, messages: [] }, { status: 500 })
      }
      messages = fallbackQuery.data || []
    } else {
      messages = primaryQuery.data || []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedMessages = messages.map((m: any) => ({
      ...m,
      paidEmoji:
        m.paid_emoji && typeof m.paid_emoji === 'string' && m.paid_emoji.trim().length > 0
          ? m.paid_emoji.trim()
          : null,
      coinsPaid: m.coins_paid || null,
    }))

    return NextResponse.json({
      messages: formattedMessages,
      economics: {
        chatCost,
        streamerPercent,
        userCoins,
        userChatEnabled,
        paidEmojis,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch chat messages'
    return NextResponse.json({ error: message, messages: [] }, { status: 500 })
  }
}

// POST: Send a new chat message or Paid Super Emoji with coin deduction and streamer revenue distribution
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
    const { streamId, message, paidEmoji, emojiCost } = body || {}

    const validPaidEmoji =
      paidEmoji && typeof paidEmoji === 'string' && paidEmoji.trim().length > 0
        ? paidEmoji.trim()
        : null

    if (!streamId || (!message && !validPaidEmoji)) {
      return NextResponse.json(
        { error: 'streamId and message or paidEmoji are required.' },
        { status: 400 }
      )
    }

    let cleanMessage = (message || '').trim().slice(0, 300)
    if (validPaidEmoji && !cleanMessage) {
      cleanMessage = `${validPaidEmoji} Sent Super Emoji!`
    }

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

    // 2. Fetch platform economics & paid emojis
    const { data: settings } = await supabaseService
      .from('platform_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const defaultCost = Math.max(0, parseInt(settingsMap['chat_cost_per_message'] || '0', 10))
    const streamerPercent = Math.min(100, Math.max(0, parseInt(settingsMap['streamer_revenue_percent'] || '70', 10)))

    // Calculate actual cost: either paid emoji price or standard chat cost
    let finalCost = defaultCost
    if (validPaidEmoji) {
      finalCost = Math.max(0, parseInt(emojiCost, 10) || 5)
    }

    const currentCoins = senderProfile?.coin_balance ?? 50
    let remainingCoins = currentCoins

    // Handle test room
    if (streamId === 'test') {
      const mockMsg = {
        id: `mock-${Date.now()}`,
        stream_id: 'test',
        user_id: user.id,
        message: cleanMessage,
        created_at: new Date().toISOString(),
        paidEmoji: validPaidEmoji,
        coinsPaid: finalCost,
        profiles: {
          id: user.id,
          username: senderProfile?.username || user.user_metadata?.username || 'user',
          display_name: senderProfile?.display_name || user.user_metadata?.display_name || user.email || 'Viewer',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      }
      return NextResponse.json({ message: mockMsg, remainingCoins, coinsPaid: finalCost, paidEmoji: validPaidEmoji }, { status: 201 })
    }

    // 3. Process coin deduction if cost > 0
    if (finalCost > 0) {
      if (currentCoins < finalCost) {
        return NextResponse.json(
          {
            error: `Insufficient coins. Requires ${finalCost} coins (Your balance: ${currentCoins} coins).`,
            requiredCoins: finalCost,
            currentCoins,
          },
          { status: 402 }
        )
      }

      remainingCoins = currentCoins - finalCost

      // Deduct from viewer wallet
      await supabaseService
        .from('profiles')
        .update({ coin_balance: remainingCoins })
        .eq('id', user.id)

      // Ledger entry for sender
      await supabaseService.from('wallet_transactions').insert({
        user_id: user.id,
        amount: -finalCost,
        type: 'chat_fee',
        related_stream_id: streamId,
        description: validPaidEmoji
          ? `Super Emoji ${validPaidEmoji} (${finalCost} coins)`
          : `Live chat message fee (${finalCost} coins)`,
      })

      // 4. Distribute percentage revenue share to streamer
      try {
        const { data: streamData } = await supabaseService
          .from('live_streams')
          .select('user_id, title')
          .eq('id', streamId)
          .single()

        if (streamData && streamData.user_id && streamData.user_id !== user.id) {
          const streamerEarnings = Math.floor(finalCost * (streamerPercent / 100))

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
              description: validPaidEmoji
                ? `Super Emoji ${validPaidEmoji} streamer share (${streamerPercent}%)`
                : `Viewer chat revenue share (${streamerPercent}%)`,
            })
          }
        }
      } catch (streamerEarnErr) {
        console.warn('Error crediting streamer coins:', streamerEarnErr)
      }
    }

    // 5. Insert chat message into database
    let insertResult = await supabaseService
      .from('live_chat_messages')
      .insert({
        stream_id: streamId,
        user_id: user.id,
        message: cleanMessage,
        paid_emoji: validPaidEmoji,
        coins_paid: finalCost,
      })
      .select('id, stream_id, user_id, message, created_at, paid_emoji, coins_paid, profiles:user_id(id, username, display_name, avatar_url)')
      .single()

    if (
      insertResult.error &&
      (insertResult.error.message?.includes('paid_emoji') ||
        insertResult.error.message?.includes('coins_paid') ||
        insertResult.error.message?.includes('does not exist'))
    ) {
      console.warn('Live chat primary insert failed, attempting schema fallback:', insertResult.error.message)
      insertResult = await supabaseService
        .from('live_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          message: cleanMessage,
        })
        .select('id, stream_id, user_id, message, created_at, profiles:user_id(id, username, display_name, avatar_url)')
        .single()
    }

    const { data: newMsg, error: insertError } = insertResult

    if (insertError || !newMsg) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to send chat message.' },
        { status: 500 }
      )
    }

    // Enrich message response with paidEmoji metadata
    const enrichedMessage = {
      ...newMsg,
      paidEmoji: newMsg.paid_emoji || validPaidEmoji,
      coinsPaid: newMsg.coins_paid ?? finalCost,
    }

    return NextResponse.json(
      {
        message: enrichedMessage,
        remainingCoins,
        chatCost: finalCost,
        paidEmoji: validPaidEmoji,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
