import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, supabaseServiceKey)
}

interface PrivateMessageItem {
  id: string
  stream_id: string
  sender_id: string
  recipient_id: string
  message: string
  coins_paid: number
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  recipient?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface ConversationSummary {
  otherUser: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  lastMessage: string
  lastMessageAt: string
  lastMessageSenderId: string
  unreadCount: number
  totalCoinsPaid: number
}

// GET: Fetch conversations list (for streamer WhatsApp view) OR messages for 1-on-1 thread
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('streamId')
    const withUserId = searchParams.get('withUserId')

    if (!streamId) {
      return NextResponse.json({ error: 'streamId is required' }, { status: 400 })
    }

    const supabaseServer = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch platform settings
    const { data: settings } = await supabaseService.from('platform_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const privateChatCost = parseInt(settingsMap['private_chat_cost_per_message'] || '10', 10)
    const privateChatStreamerPercent = parseInt(
      settingsMap['private_chat_streamer_revenue_percent'] || '80',
      10
    )

    // 2. Fetch stream info
    let hostUserId = user.id
    let hostProfile = null

    if (streamId !== 'test') {
      const { data: streamData } = await supabaseService
        .from('live_streams')
        .select('user_id, profiles:user_id(id, username, display_name, avatar_url)')
        .eq('id', streamId)
        .single()

      if (streamData) {
        hostUserId = streamData.user_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hostProfile = (streamData as any).profiles
      }
    }

    const isHost = user.id === hostUserId

    // Fetch caller's profile (coin balance & chat status)
    const { data: callerProfile } = await supabaseService
      .from('profiles')
      .select('id, username, display_name, avatar_url, coin_balance, chat_enabled')
      .eq('id', user.id)
      .single()

    const userCoins = callerProfile?.coin_balance ?? 50
    const userChatEnabled = callerProfile?.chat_enabled ?? true

    // Query helper for private messages
    const fetchAllStreamPrivateMessages = async (): Promise<PrivateMessageItem[]> => {
      // First try dedicated live_private_chat_messages table
      const res = await supabaseService
        .from('live_private_chat_messages')
        .select(
          'id, stream_id, sender_id, recipient_id, message, coins_paid, is_read, created_at, sender:sender_id(id, username, display_name, avatar_url), recipient:recipient_id(id, username, display_name, avatar_url)'
        )
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })

      if (!res.error && res.data) {
        return res.data as PrivateMessageItem[]
      }

      // Fallback: Query live_chat_messages where paid_emoji starts with __private:
      const fallbackRes = await supabaseService
        .from('live_chat_messages')
        .select(
          'id, stream_id, user_id, message, created_at, paid_emoji, coins_paid, profiles:user_id(id, username, display_name, avatar_url)'
        )
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })

      if (fallbackRes.error || !fallbackRes.data) {
        return []
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedFallback: PrivateMessageItem[] = []
      for (const row of fallbackRes.data) {
        if (row.paid_emoji && String(row.paid_emoji).startsWith('__private:')) {
          const recId = String(row.paid_emoji).replace('__private:', '').replace('__', '').trim()
          parsedFallback.push({
            id: row.id,
            stream_id: row.stream_id,
            sender_id: row.user_id,
            recipient_id: recId,
            message: row.message,
            coins_paid: row.coins_paid || 0,
            is_read: true,
            created_at: row.created_at,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sender: (row as any).profiles || null,
            recipient: null,
          })
        }
      }
      return parsedFallback
    }

    const allMessages = await fetchAllStreamPrivateMessages()

    // --------------------------------------------------------------------------
    // CASE 1: Host requests list of all viewer conversations (WhatsApp View)
    // --------------------------------------------------------------------------
    if (isHost && !withUserId) {
      const convMap = new Map<string, ConversationSummary>()
      const userProfilesMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }>()

      for (const msg of allMessages) {
        // Only consider messages involving the host
        if (msg.sender_id !== hostUserId && msg.recipient_id !== hostUserId) {
          continue
        }

        const otherUserId = msg.sender_id === hostUserId ? msg.recipient_id : msg.sender_id
        if (!otherUserId) continue

        // Cache profiles
        if (msg.sender && msg.sender.id === otherUserId) {
          userProfilesMap.set(otherUserId, msg.sender)
        } else if (msg.recipient && msg.recipient.id === otherUserId) {
          userProfilesMap.set(otherUserId, msg.recipient)
        }

        const existing = convMap.get(otherUserId)
        const isUnread = msg.recipient_id === hostUserId && !msg.is_read
        const coins = msg.sender_id === otherUserId ? (msg.coins_paid || 0) : 0

        if (!existing) {
          convMap.set(otherUserId, {
            otherUser: userProfilesMap.get(otherUserId) || {
              id: otherUserId,
              username: 'Viewer',
              display_name: 'Live Viewer',
              avatar_url: null,
            },
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            lastMessageSenderId: msg.sender_id,
            unreadCount: isUnread ? 1 : 0,
            totalCoinsPaid: coins,
          })
        } else {
          existing.lastMessage = msg.message
          existing.lastMessageAt = msg.created_at
          existing.lastMessageSenderId = msg.sender_id
          if (isUnread) existing.unreadCount += 1
          existing.totalCoinsPaid += coins
        }
      }

      // Fetch any missing profile details for viewers
      for (const [userId, conv] of convMap.entries()) {
        if (!conv.otherUser.username || conv.otherUser.username === 'Viewer') {
          const { data: p } = await supabaseService
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', userId)
            .single()
          if (p) {
            conv.otherUser = p
          }
        }
      }

      const conversations = Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      )

      return NextResponse.json({
        isHost: true,
        conversations,
        economics: {
          privateChatCost,
          privateChatStreamerPercent,
          userCoins,
          userChatEnabled,
        },
      })
    }

    // --------------------------------------------------------------------------
    // CASE 2: Host viewing 1-on-1 thread with a specific viewer OR Viewer viewing chat with Host
    // --------------------------------------------------------------------------
    const targetOtherUserId = isHost ? withUserId : hostUserId
    if (!targetOtherUserId) {
      return NextResponse.json({ error: 'Target user is required' }, { status: 400 })
    }

    // Filter messages for this pair
    const threadMessages = allMessages.filter(
      (m) =>
        (m.sender_id === user.id && m.recipient_id === targetOtherUserId) ||
        (m.sender_id === targetOtherUserId && m.recipient_id === user.id)
    )

    // Mark unread messages sent to the current user as read
    try {
      await supabaseService
        .from('live_private_chat_messages')
        .update({ is_read: true })
        .eq('stream_id', streamId)
        .eq('recipient_id', user.id)
        .eq('sender_id', targetOtherUserId)
    } catch {
      // Ignore if table doesn't support update yet
    }

    // Fetch other user profile
    const { data: otherUserProfile } = await supabaseService
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', targetOtherUserId)
      .single()

    return NextResponse.json({
      isHost,
      messages: threadMessages,
      otherUser: otherUserProfile || hostProfile || {
        id: targetOtherUserId,
        username: 'Streamer',
        display_name: 'Streamer',
        avatar_url: null,
      },
      economics: {
        privateChatCost,
        privateChatStreamerPercent,
        userCoins,
        userChatEnabled,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch private chat'
    return NextResponse.json({ error: message, messages: [] }, { status: 500 })
  }
}

// POST: Send a private message (Free for host, charged per msg for normal viewer)
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
    const { streamId, message, recipientId: explicitRecipientId } = body || {}

    const cleanMessage = (message || '').trim()
    if (!streamId || !cleanMessage) {
      return NextResponse.json({ error: 'streamId and message are required' }, { status: 400 })
    }

    if (cleanMessage.length > 500) {
      return NextResponse.json({ error: 'Message exceeds maximum length (500 chars)' }, { status: 400 })
    }

    const supabaseService = getServiceRoleClient()

    // 1. Fetch platform economics
    const { data: settings } = await supabaseService.from('platform_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    const privateChatCost = Math.max(0, parseInt(settingsMap['private_chat_cost_per_message'] || '10', 10))
    const privateChatStreamerPercent = Math.min(
      100,
      Math.max(0, parseInt(settingsMap['private_chat_streamer_revenue_percent'] || '80', 10))
    )

    // 2. Fetch stream info
    let hostUserId = user.id
    if (streamId !== 'test') {
      const { data: streamData } = await supabaseService
        .from('live_streams')
        .select('user_id')
        .eq('id', streamId)
        .single()

      if (streamData) {
        hostUserId = streamData.user_id
      }
    }

    const isHost = user.id === hostUserId

    // Determine recipient
    let targetRecipientId = explicitRecipientId
    if (!isHost) {
      // Viewers always message the stream host
      targetRecipientId = hostUserId
    }

    if (!targetRecipientId) {
      return NextResponse.json({ error: 'Recipient is required' }, { status: 400 })
    }

    // Sender profile
    const { data: senderProfile } = await supabaseService
      .from('profiles')
      .select('id, username, display_name, avatar_url, coin_balance, chat_enabled')
      .eq('id', user.id)
      .single()

    if (senderProfile && senderProfile.chat_enabled === false) {
      return NextResponse.json(
        { error: 'Your chat privileges have been suspended by an administrator' },
        { status: 403 }
      )
    }

    const currentCoins = senderProfile?.coin_balance ?? 50
    let remainingCoins = currentCoins
    const finalCost = isHost ? 0 : privateChatCost

    // 3. Process coin deduction for normal viewers (Streamer chats completely FREE)
    if (!isHost && finalCost > 0) {
      if (currentCoins < finalCost) {
        return NextResponse.json(
          {
            error: `Insufficient coins. Private chat requires ${finalCost} coins (Your balance: ${currentCoins} coins).`,
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
        description: `1-on-1 Private chat message to host (${finalCost} coins)`,
      })

      // 4. Distribute percentage revenue share to streamer
      try {
        if (hostUserId && hostUserId !== user.id) {
          const streamerEarnings = Math.floor(finalCost * (privateChatStreamerPercent / 100))

          if (streamerEarnings > 0) {
            const { data: streamerProfile } = await supabaseService
              .from('profiles')
              .select('coin_balance')
              .eq('id', hostUserId)
              .single()

            const currentStreamerCoins = streamerProfile?.coin_balance ?? 0
            const newStreamerCoins = currentStreamerCoins + streamerEarnings

            await supabaseService
              .from('profiles')
              .update({ coin_balance: newStreamerCoins })
              .eq('id', hostUserId)

            await supabaseService.from('wallet_transactions').insert({
              user_id: hostUserId,
              amount: streamerEarnings,
              type: 'streamer_earning',
              related_stream_id: streamId,
              description: `Private chat revenue share (${privateChatStreamerPercent}%) from @${senderProfile?.username || 'viewer'}`,
            })
          }
        }
      } catch (streamerEarnErr) {
        console.warn('Error crediting streamer coins for private chat:', streamerEarnErr)
      }
    }

    // 5. Insert private message
    let insertedMessage: PrivateMessageItem | null = null

    // Try dedicated table first
    const insertRes = await supabaseService
      .from('live_private_chat_messages')
      .insert({
        stream_id: streamId,
        sender_id: user.id,
        recipient_id: targetRecipientId,
        message: cleanMessage,
        coins_paid: finalCost,
        is_read: false,
      })
      .select(
        'id, stream_id, sender_id, recipient_id, message, coins_paid, is_read, created_at, sender:sender_id(id, username, display_name, avatar_url)'
      )
      .single()

    if (!insertRes.error && insertRes.data) {
      insertedMessage = insertRes.data as PrivateMessageItem
    } else {
      // Fallback to live_chat_messages with __private prefix
      const fallbackInsert = await supabaseService
        .from('live_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          message: cleanMessage,
          paid_emoji: `__private:${targetRecipientId}__`,
          coins_paid: finalCost,
        })
        .select('id, stream_id, user_id, message, created_at, coins_paid')
        .single()

      if (fallbackInsert.error || !fallbackInsert.data) {
        return NextResponse.json(
          { error: fallbackInsert.error?.message || 'Failed to save message' },
          { status: 500 }
        )
      }

      insertedMessage = {
        id: fallbackInsert.data.id,
        stream_id: fallbackInsert.data.stream_id,
        sender_id: user.id,
        recipient_id: targetRecipientId,
        message: fallbackInsert.data.message,
        coins_paid: fallbackInsert.data.coins_paid || 0,
        is_read: false,
        created_at: fallbackInsert.data.created_at,
        sender: senderProfile
          ? {
              id: senderProfile.id,
              username: senderProfile.username,
              display_name: senderProfile.display_name,
              avatar_url: senderProfile.avatar_url,
            }
          : null,
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: insertedMessage,
        remainingCoins,
        coinsPaid: finalCost,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to send private message'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
