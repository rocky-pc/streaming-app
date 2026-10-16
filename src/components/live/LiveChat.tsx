'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Room, RoomEvent } from 'livekit-client'
import { useAuth } from '@/context/AuthContext'
import {
  Send,
  MessageSquare,
  ChevronDown,
  ArrowDown,
  Smile,
  ShieldCheck,
  Crown,
  Lock,
  Loader2,
  X,
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 1. Initial Load of chat messages from API
  useEffect(() => {
    let isMounted = true

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/live/chat?streamId=${streamId}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted && json.messages) {
            setMessages(json.messages)
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

  // 2. Real-Time DataChannel Listeners via LiveKit
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload)
        const data = JSON.parse(text)

        if (data.type === 'chat_message' && data.message) {
          setMessages((prev) => {
            // Avoid duplicate message IDs
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

  // 3. Auto-scroll to bottom unless user scrolled up
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    }
    setIsScrolledUp(false)
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

  // 4. Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanText = inputText.trim()
    if (!cleanText || isSending) return

    if (!user) {
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

    // Persist message to database via API
    try {
      const res = await fetch('/api/live/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          message: cleanText,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.message) {
          // Replace optimistic ID with database ID
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? json.message : m))
          )
        }
      }
    } catch (err) {
      console.error('Error saving chat message to database:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleAddEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji)
  }

  const formatChatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div
      className={`flex flex-col bg-[#141414] border border-[#272727] rounded-3xl overflow-hidden shadow-2xl h-[560px] max-h-[80vh] ${className}`}
    >
      {/* YouTube Style Chat Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#272727] bg-[#181818] select-none shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            Live Chat
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-medium">
            {messages.length} message{messages.length === 1 ? '' : 's'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close chat"
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
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative text-xs scrollbar-none"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <MessageSquare className="h-8 w-8 text-zinc-600" />
            <p className="font-medium text-zinc-400">Welcome to live chat!</p>
            <p className="text-[11px] max-w-[200px]">
              Remember to guard your privacy and abide by our community guidelines.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderProfile = msg.profiles
            const isMsgBroadcaster = msg.user_id === broadcasterId
            const displayName = senderProfile?.display_name || senderProfile?.username || 'Viewer'
            const avatarUrl = senderProfile?.avatar_url

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 leading-relaxed group ${
                  isMsgBroadcaster ? 'bg-red-500/5 -mx-2 px-2 py-1 rounded-xl' : ''
                }`}
              >
                {/* User Avatar */}
                <div className="shrink-0 mt-0.5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                      {displayName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div className="min-w-0 flex-1">
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/95 hover:bg-zinc-700 text-white text-[11px] font-semibold rounded-full shadow-lg border border-[#3e3e3e] transition-all"
          >
            <span>Chat paused</span>
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Quick Emojis Shelf */}
      {user && (
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
      <div className="p-3 bg-[#181818] border-t border-[#272727] shrink-0">
        {user ? (
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={300}
                placeholder="Chat as "
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#303030] focus:border-[#3ea6ff] rounded-full px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
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

            <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
              <span>{inputText.length}/300</span>
              <span className="truncate">Press Enter to chat</span>
            </div>
          </form>
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
