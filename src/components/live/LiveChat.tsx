'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Room, RoomEvent } from 'livekit-client'
import { useAuth } from '@/context/AuthContext'
import {
  Send,
  MessageSquare,
  ChevronDown,
  ArrowDown,
  Smile,
  Crown,
  Lock,
  Loader2,
  X,
  AlertTriangle,
  Coins,
  Sparkles,
  Zap,
} from 'lucide-react'

export interface ChatMessage {
  id: string
  stream_id: string
  user_id: string
  message: string
  created_at: string
  paidEmoji?: string | null
  coinsPaid?: number | null
  profiles?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface PaidEmoji {
  emoji: string
  cost: number
}

interface LiveChatProps {
  streamId: string
  room: Room | null
  broadcasterId: string
  isBroadcaster?: boolean
  className?: string
  onClose?: () => void
}

const DEFAULT_PAID_EMOJIS: PaidEmoji[] = [
  { emoji: '❤️', cost: 5 },
  { emoji: '🔥', cost: 10 },
  { emoji: '👏', cost: 15 },
  { emoji: '🎉', cost: 25 },
  { emoji: '💎', cost: 50 },
  { emoji: '🚀', cost: 100 },
  { emoji: '👑', cost: 500 },
]

export function LiveChat({
  streamId,
  room,
  broadcasterId,
  isBroadcaster = false,
  className = '',
  onClose,
}: LiveChatProps) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [showPaidEmojisTray, setShowPaidEmojisTray] = useState(false)

  // Economics & Wallet state
  const [chatCost, setChatCost] = useState<number>(0)
  const [streamerPercent, setStreamerPercent] = useState<number>(70)
  const [userCoins, setUserCoins] = useState<number | null>(null)
  const [userChatEnabled, setUserChatEnabled] = useState<boolean>(true)
  const [paidEmojis, setPaidEmojis] = useState<PaidEmoji[]>(DEFAULT_PAID_EMOJIS)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 1. Initial Load & Background Live Polling of chat messages & economics from API
  useEffect(() => {
    let isMounted = true

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/live/chat?streamId=${streamId}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted) {
            if (json.messages && Array.isArray(json.messages)) {
              setMessages((prev) => {
                const map = new Map<string, ChatMessage>()
                // First keep existing messages
                for (const m of prev) {
                  map.set(m.id, m)
                }
                let hasNew = false
                // Merge incoming server messages
                for (const m of json.messages) {
                  if (!map.has(m.id)) {
                    map.set(m.id, m)
                    hasNew = true
                  }
                }
                if (!hasNew && map.size === prev.length) {
                  return prev
                }
                return Array.from(map.values()).sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )
              })
            }
            if (json.economics) {
              setChatCost(json.economics.chatCost ?? 0)
              setStreamerPercent(json.economics.streamerPercent ?? 70)
              if (json.economics.userCoins !== null && json.economics.userCoins !== undefined) {
                setUserCoins(json.economics.userCoins)
              }
              if (typeof json.economics.userChatEnabled === 'boolean') {
                setUserChatEnabled(json.economics.userChatEnabled)
              }
              if (Array.isArray(json.economics.paidEmojis) && json.economics.paidEmojis.length > 0) {
                setPaidEmojis(json.economics.paidEmojis)
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      }
    }

    fetchHistory()
    // Live polling every 2.5 seconds so all viewers/streamers receive chat messages live without refreshing
    const pollInterval = setInterval(fetchHistory, 2500)
    window.addEventListener('focus', fetchHistory)

    return () => {
      isMounted = false
      clearInterval(pollInterval)
      window.removeEventListener('focus', fetchHistory)
    }
  }, [streamId])

  // Sync profile balance if available
  useEffect(() => {
    if (profile && userCoins === null) {
      setUserCoins(profile.coin_balance ?? 50)
      setUserChatEnabled(profile.chat_enabled ?? true)
    }
  }, [profile, userCoins])

  // 2. Real-Time DataChannel Listeners via LiveKit
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload)
        const data = JSON.parse(text)

        if (data.type === 'chat_message' && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) {
              return prev
            }
            return [...prev, data.message]
          })
        }
      } catch (err) {
        console.error('Error parsing live chat data packet:', err)
      }
    }

    room.on(RoomEvent.DataReceived, handleDataReceived)
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived)
    }
  }, [room])

  // Auto-scroll to bottom inside the chat container ONLY (never scrolls window/page)
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current
    if (el) {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } else {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [])

  const prevCountRef = useRef(0)

  // Auto-scroll only when user is not scrolled up and new messages arrive
  useEffect(() => {
    if (!isScrolledUp) {
      const isNew = messages.length > prevCountRef.current
      if (isNew || prevCountRef.current === 0) {
        scrollToBottom(prevCountRef.current > 0)
      }
    }
    prevCountRef.current = messages.length
  }, [messages.length, isScrolledUp, scrollToBottom])

  // Track scroll position to pause auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setIsScrolledUp(!isAtBottom)
  }

  // Auto dismiss chat error
  useEffect(() => {
    if (chatError) {
      const t = setTimeout(() => setChatError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [chatError])

  // 3. Send Message Handler (Normal Message or with Paid Emoji)
  const handleSendMessage = async (e?: React.FormEvent, selectedPaidEmoji?: PaidEmoji) => {
    if (e) e.preventDefault()
    setChatError(null)

    const cleanText = inputText.trim()
    if (!cleanText && !selectedPaidEmoji) return
    if (isSending || !user) return

    // Pre-flight chat permission
    if (!userChatEnabled) {
      setChatError('Your live chat privileges have been disabled by an administrator.')
      return
    }

    const currentBalance = userCoins ?? profile?.coin_balance ?? 50
    const requiredCoins = selectedPaidEmoji ? selectedPaidEmoji.cost : chatCost

    if (requiredCoins > 0 && currentBalance < requiredCoins) {
      setChatError(
        selectedPaidEmoji
          ? `Insufficient coins for ${selectedPaidEmoji.emoji}! Requires ${selectedPaidEmoji.cost} coins (Your balance: ${currentBalance}).`
          : `Insufficient coins! Requires ${chatCost} coins to chat (Your balance: ${currentBalance}).`
      )
      return
    }

    setIsSending(true)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const messageText = cleanText || (selectedPaidEmoji ? `${selectedPaidEmoji.emoji}` : '')

    const optimisticMessage: ChatMessage = {
      id: tempId,
      stream_id: streamId,
      user_id: user.id,
      message: messageText,
      paidEmoji: selectedPaidEmoji?.emoji || null,
      coinsPaid: requiredCoins > 0 ? requiredCoins : null,
      created_at: new Date().toISOString(),
      profiles: {
        id: user.id,
        username: profile?.username || user.user_metadata?.username || 'user',
        display_name: profile?.display_name || user.user_metadata?.display_name || user.email || 'Viewer',
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
      },
    }

    // Immediately display locally
    setMessages((prev) => [...prev, optimisticMessage])
    setInputText('')
    setIsScrolledUp(false)
    setShowPaidEmojisTray(false)

    // Broadcast instantly to all connected viewers over LiveKit DataChannel
    if (room && room.localParticipant) {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'chat_message',
            message: optimisticMessage,
          })
        )
        await room.localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.error('Failed to broadcast via LiveKit data channel:', err)
      }
    }

    // Persist message to database via API & process coins
    try {
      const res = await fetch('/api/live/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          message: cleanText || undefined,
          paidEmoji: selectedPaidEmoji?.emoji || undefined,
          emojiCost: selectedPaidEmoji?.cost || undefined,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        if (json.message) {
          // Replace optimistic ID with persistent ID
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...json.message,
                    paidEmoji: selectedPaidEmoji?.emoji || null,
                    coinsPaid: requiredCoins > 0 ? requiredCoins : null,
                  }
                : m
            )
          )
        }
        if (json.remainingCoins !== undefined) {
          setUserCoins(json.remainingCoins)
        }
      } else {
        // Rollback optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setChatError(json.error || 'Failed to send chat message')
        if (res.status === 403) {
          setUserChatEnabled(false)
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setChatError('Connection error sending chat message.')
    } finally {
      setIsSending(false)
    }
  }

  const formatChatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return ''
    }
  }

  const currentBalance = userCoins ?? profile?.coin_balance ?? 50
  const isBalanceInsufficient = chatCost > 0 && currentBalance < chatCost

  return (
    <div
      className={`flex flex-col bg-[#0f0f0f] border border-[#272727] rounded-2xl overflow-hidden shadow-2xl relative select-none ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#181818] border-b border-[#272727] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-red-500" />
          <span className="font-bold text-sm text-white">Live Chat</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
        </div>

        <div className="flex items-center gap-2">
          {/* Active Coin Economics Pill */}
          {chatCost > 0 ? (
            <div
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold"
              title={`${chatCost} coins deducted per chat. ${streamerPercent}% to streamer.`}
            >
              <span>🪙</span>
              <span>{chatCost} / msg</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              Free Chat
            </span>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs text-[#f1f1f1] divide-y divide-zinc-900/40"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center py-12 space-y-2">
            <MessageSquare className="h-8 w-8 text-zinc-700 stroke-1" />
            <p className="text-xs">Welcome to live chat!</p>
            <p className="text-[11px] text-zinc-600">Messages & Super Emojis will appear here in real time.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMsgBroadcaster = msg.user_id === broadcasterId
            const displayName =
              msg.profiles?.display_name || msg.profiles?.username || 'Viewer'
            const avatarUrl = msg.profiles?.avatar_url
            const isPaidSuperEmoji = Boolean(
              msg.paidEmoji && typeof msg.paidEmoji === 'string' && msg.paidEmoji.trim().length > 0
            )

            // RENDER PAID SUPER EMOJI (YOUTUBE SUPER CHAT STYLE)
            if (isPaidSuperEmoji) {
              return (
                <div
                  key={msg.id}
                  className="pt-2.5 first:pt-0"
                >
                  <div className="rounded-xl overflow-hidden border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-zinc-900/90 to-zinc-900 shadow-lg shadow-amber-500/10 animate-scale-up">
                    {/* Super Sticker Header Bar */}
                    <div className="px-3 py-1.5 bg-amber-500/25 border-b border-amber-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        <span>SUPER EMOJI • {msg.coinsPaid ?? 5} COINS</span>
                      </div>
                      <span className="text-[10px] text-amber-300/70 font-mono">
                        {formatChatTime(msg.created_at)}
                      </span>
                    </div>

                    {/* Super Sticker Content Body */}
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 ring-2 ring-amber-500/40"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-xs font-bold uppercase shrink-0 ring-2 ring-amber-500/40">
                            {displayName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-white text-xs block truncate">
                            {displayName}
                          </span>
                          {msg.message && msg.message !== msg.paidEmoji && (
                            <p className="text-zinc-200 text-xs mt-0.5 break-words">
                              {msg.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Prominent Paid Emoji Sticker */}
                      <span className="text-3xl sm:text-4xl filter drop-shadow-md shrink-0 select-none animate-pulse">
                        {msg.paidEmoji}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }

            // STANDARD LIVE CHAT MESSAGE
            return (
              <div
                key={msg.id}
                className="pt-2 first:pt-0 flex items-start gap-2.5 group hover:bg-white/[0.02] px-1 py-0.5 rounded-lg transition-colors"
              >
                {/* User Avatar */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-zinc-700"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-[10px] font-bold uppercase shrink-0 mt-0.5">
                    {displayName.charAt(0)}
                  </div>
                )}

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-semibold truncate text-[11px] ${
                        isMsgBroadcaster
                          ? 'text-red-400 font-bold'
                          : 'text-zinc-400 hover:text-white transition-colors'
                      }`}
                    >
                      {displayName}
                    </span>

                    {/* Broadcaster Badge */}
                    {isMsgBroadcaster && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-red-600/90 text-white rounded text-[9px] font-bold tracking-wider uppercase">
                        <Crown className="h-2.5 w-2.5" />
                        Host
                      </span>
                    )}

                    <span className="text-[10px] text-zinc-600">
                      {formatChatTime(msg.created_at)}
                    </span>

                    {Boolean(msg.coinsPaid && msg.coinsPaid > 0) && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-mono">
                        <span>🪙</span>
                        <span>{msg.coinsPaid}</span>
                      </span>
                    )}
                  </div>

                  {/* Text Content */}
                  <p className="text-zinc-200 break-words mt-0.5 text-xs font-normal">
                    {msg.message}
                  </p>
                </div>
              </div>
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating "Chat is paused" Pill when scrolled up */}
      {isScrolledUp && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/95 hover:bg-zinc-700 text-white text-[11px] font-semibold rounded-full shadow-lg border border-[#3e3e3e] transition-all"
          >
            <span>Chat paused</span>
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Chat Error Banner */}
      {chatError && (
        <div className="px-3 py-2 bg-red-950/90 border-t border-red-500/30 text-red-300 text-xs flex items-center justify-between gap-2 animate-slide-up">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-[11px]">{chatError}</span>
          </div>
          <button onClick={() => setChatError(null)} className="text-red-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* PAID SUPER EMOJIS TRAY (ALLOCATED BY ADMIN PANEL) */}
      {user && userChatEnabled && showPaidEmojisTray && (
        <div className="p-3 bg-[#161616] border-t border-amber-500/30 space-y-2 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Super Emojis (Paid Reaction Stickers)</span>
            </span>
            <span className="text-[10px] text-zinc-400">
              Streamer receives {streamerPercent}%
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {paidEmojis.map((item) => {
              const canAfford = currentBalance >= item.cost
              return (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => handleSendMessage(undefined, item)}
                  disabled={!canAfford || isSending}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    canAfford
                      ? 'bg-[#1f1f1f] hover:bg-[#282828] border-zinc-700 hover:border-amber-500/50 hover:scale-105 active:scale-95'
                      : 'bg-zinc-900/60 border-zinc-800 opacity-40 cursor-not-allowed'
                  }`}
                  title={`${item.emoji} costs ${item.cost} coins`}
                >
                  <span className="text-2xl select-none mb-1">{item.emoji}</span>
                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                    <span>🪙</span>
                    <span>{item.cost}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="p-3 bg-[#181818] border-t border-[#272727] shrink-0 space-y-2">
        {user ? (
          !userChatEnabled ? (
            /* Chat Disabled for User by Admin */
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
              <Lock className="h-4 w-4 shrink-0 text-red-400" />
              <span>Your live chat privileges have been disabled by an administrator.</span>
            </div>
          ) : (
            <form onSubmit={(e) => handleSendMessage(e)} className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Toggle Paid Super Emojis Shelf Button */}
                <button
                  type="button"
                  onClick={() => setShowPaidEmojisTray(!showPaidEmojisTray)}
                  className={`p-2 rounded-full border transition-colors shrink-0 ${
                    showPaidEmojisTray
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-[#141414] hover:bg-[#242424] text-amber-400 border-[#303030]'
                  }`}
                  title="Send Paid Super Emoji (Specific Emoji = Specific Coin cost)"
                >
                  <Sparkles className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  maxLength={300}
                  disabled={isBalanceInsufficient}
                  placeholder={
                    isBalanceInsufficient
                      ? `Insufficient coins (${currentBalance}/${chatCost} coins needed)`
                      : 'Send a message or Super Emoji...'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-[#121212] border border-[#303030] focus:border-[#3ea6ff] rounded-full px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending || isBalanceInsufficient}
                  className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center transition-colors shrink-0 shadow-md"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 ml-0.5" />
                  )}
                </button>
              </div>

              {/* Wallet and Character Stats Bar */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-semibold text-amber-400">
                    <span>🪙</span>
                    <span>{currentBalance} coins</span>
                  </span>
                  {chatCost > 0 && (
                    <span className="text-zinc-500">• {chatCost} coins / msg</span>
                  )}
                </div>

                <span>{inputText.length}/300</span>
              </div>
            </form>
          )
        ) : (
          <div className="flex items-center justify-between p-2 rounded-2xl bg-[#121212] border border-[#272727]">
            <span className="text-xs text-zinc-400">Sign in to participate in chat</span>
            <Link
              href={`/login?redirect=/live/${streamId}`}
              className="px-3 py-1 bg-[#3ea6ff]/10 hover:bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/30 rounded-full text-xs font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
