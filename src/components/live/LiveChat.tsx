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
} from 'lucide-react'

export interface ChatMessage {
  id: string
  stream_id: string
  user_id: string
  message: string
  created_at: string
  profiles?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface LiveChatProps {
  streamId: string
  room: Room | null
  broadcasterId: string
  isBroadcaster?: boolean
  className?: string
  onClose?: () => void
}

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😂', '🎉', '🙌', '💯', '🚀']

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

  // Economics & Wallet state
  const [chatCost, setChatCost] = useState<number>(0)
  const [streamerPercent, setStreamerPercent] = useState<number>(70)
  const [userCoins, setUserCoins] = useState<number | null>(null)
  const [userChatEnabled, setUserChatEnabled] = useState<boolean>(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 1. Initial Load of chat messages & economics from API
  useEffect(() => {
    let isMounted = true

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/live/chat?streamId=${streamId}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted) {
            if (json.messages) setMessages(json.messages)
            if (json.economics) {
              setChatCost(json.economics.chatCost ?? 0)
              setStreamerPercent(json.economics.streamerPercent ?? 70)
              if (json.economics.userCoins !== null && json.economics.userCoins !== undefined) {
                setUserCoins(json.economics.userCoins)
              }
              if (typeof json.economics.userChatEnabled === 'boolean') {
                setUserChatEnabled(json.economics.userChatEnabled)
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      }
    }

    fetchHistory()
    return () => {
      isMounted = false
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

  // Auto-scroll to bottom unless viewer has manually scrolled up
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      })
    }
  }, [])

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom(false)
    }
  }, [messages, isScrolledUp, scrollToBottom])

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

  // 3. Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setChatError(null)

    const cleanText = inputText.trim()
    if (!cleanText || isSending) return

    if (!user) return

    // Pre-flight validation
    if (!userChatEnabled) {
      setChatError('Your live chat privileges have been disabled by an administrator.')
      return
    }

    const currentBalance = userCoins ?? profile?.coin_balance ?? 50
    if (chatCost > 0 && currentBalance < chatCost) {
      setChatError(`Insufficient coins! You need ${chatCost} coins to send a message. Your balance is ${currentBalance} coins.`)
      return
    }

    setIsSending(true)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const optimisticMessage: ChatMessage = {
      id: tempId,
      stream_id: streamId,
      user_id: user.id,
      message: cleanText,
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
          message: cleanText,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        if (json.message) {
          // Replace optimistic ID with persistent ID
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? json.message : m))
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

  const handleAddEmoji = (emoji: string) => {
    setInputText((prev) => `${prev} ${emoji} `.trim())
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
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold"
              title={`${chatCost} coins deducted per chat message. ${streamerPercent}% allocated to streamer.`}
            >
              <span>🪙</span>
              <span>{chatCost} / msg</span>
            </div>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
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
            <p className="text-[11px] text-zinc-600">Messages will appear here in real time.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMsgBroadcaster = msg.user_id === broadcasterId
            const displayName =
              msg.profiles?.display_name || msg.profiles?.username || 'Viewer'
            const avatarUrl = msg.profiles?.avatar_url

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

      {/* Quick Emojis Shelf */}
      {user && userChatEnabled && !isBalanceInsufficient && (
        <div className="px-3 py-1.5 bg-[#181818]/60 border-t border-[#272727] flex items-center gap-1 overflow-x-auto no-scrollbar">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-sm transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
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
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={300}
                  disabled={isBalanceInsufficient}
                  placeholder={
                    isBalanceInsufficient
                      ? `Insufficient coins (${currentBalance}/${chatCost} coins needed)`
                      : 'Send a message...'
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
