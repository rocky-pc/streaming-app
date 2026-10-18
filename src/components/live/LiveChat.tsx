'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Room, RoomEvent } from 'livekit-client'
import { useAuth } from '@/context/AuthContext'
import {
  Send,
  MessageSquare,
  ArrowDown,
  Smile,
  Crown,
  Lock,
  Loader2,
  X,
  AlertTriangle,
  Coins,
  Sparkles,
  ChevronLeft,
  Search,
  User as UserIcon,
  MessageCircle,
  Plus,
} from 'lucide-react'
import { TopUpModal } from '@/components/wallet/TopUpModal'

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

export interface PrivateChatMessage {
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
}

export interface PrivateConversation {
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
  const { user, profile, refreshProfile } = useAuth()

  // Tab State: 'public' (Live Chat) vs 'private' (1-on-1 Paid Private Chat)
  const [activeChatTab, setActiveChatTab] = useState<'public' | 'private'>('public')

  // Public Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [showPaidEmojisTray, setShowPaidEmojisTray] = useState(false)

  // Economics & Wallet state
  const [chatCost, setChatCost] = useState<number>(0)
  const [streamerPercent, setStreamerPercent] = useState<number>(70)
  const [privateChatCost, setPrivateChatCost] = useState<number>(10)
  const [privateChatStreamerPercent, setPrivateChatStreamerPercent] = useState<number>(80)
  const [userCoins, setUserCoins] = useState<number | null>(null)
  const [userChatEnabled, setUserChatEnabled] = useState<boolean>(true)
  const [paidEmojis, setPaidEmojis] = useState<PaidEmoji[]>(DEFAULT_PAID_EMOJIS)

  // Private Chat State
  const [conversations, setConversations] = useState<PrivateConversation[]>([])
  const [selectedViewer, setSelectedViewer] = useState<PrivateConversation['otherUser'] | null>(null)
  const [privateMessages, setPrivateMessages] = useState<PrivateChatMessage[]>([])
  const [privateInputText, setPrivateInputText] = useState('')
  const [isSendingPrivate, setIsSendingPrivate] = useState(false)
  const [viewerSearch, setViewerSearch] = useState('')
  const [privateChatError, setPrivateChatError] = useState<string | null>(null)
  const [hostProfile, setHostProfile] = useState<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null>(null)

  // Server confirmed Host detection (ensures host is immediately recognized on mobile view)
  const [serverIsHost, setServerIsHost] = useState<boolean>(false)

  // Private Chat Unlock state (viewer pays fee declared by admin to unlock until admin turns off switch)
  const [isPrivateChatUnlocked, setIsPrivateChatUnlocked] = useState<boolean>(false)
  const [privateChatUnlockCost, setPrivateChatUnlockCost] = useState<number>(50)
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false)

  // Top Up Modal State
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const privateScrollContainerRef = useRef<HTMLDivElement>(null)

  const isHost = Boolean(
    serverIsHost || isBroadcaster || (user && broadcasterId && user.id === broadcasterId)
  )

  useEffect(() => {
    // If profile indicates private_chat_enabled, mark unlocked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (profile && (profile as any).private_chat_enabled) {
      setIsPrivateChatUnlocked(true)
    }
  }, [profile])

  const currentBalance = userCoins ?? profile?.coin_balance ?? 50
  const isBalanceInsufficient = !isHost && chatCost > 0 && currentBalance < chatCost
  const isPrivateBalanceInsufficient = !isHost && currentBalance < privateChatCost

  // Total unread private messages for host
  const totalUnreadPrivateCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  }, [conversations])

  // --------------------------------------------------------------------------
  // 1. Fetch Public Chat & Economics
  // --------------------------------------------------------------------------
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
                for (const m of prev) {
                  map.set(m.id, m)
                }
                let hasNew = false
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
              if (typeof json.economics.privateChatCost === 'number') {
                setPrivateChatCost(json.economics.privateChatCost)
              }
              if (typeof json.economics.privateChatStreamerPercent === 'number') {
                setPrivateChatStreamerPercent(json.economics.privateChatStreamerPercent)
              }
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

  // --------------------------------------------------------------------------
  // 2. Fetch Private Chats (WhatsApp-like for Host, 1-on-1 for Viewers)
  // --------------------------------------------------------------------------
  const fetchPrivateChat = useCallback(async () => {
    if (!user) return

    try {
      // Determine endpoint based on whether host is viewing a specific viewer
      const targetUrl =
        isHost && selectedViewer
          ? `/api/live/chat/private?streamId=${streamId}&withUserId=${selectedViewer.id}`
          : `/api/live/chat/private?streamId=${streamId}`

      const res = await fetch(targetUrl)
      if (res.ok) {
        const data = await res.json()

        // Sync host status confirmed by server (crucial for mobile view)
        if (data.isHost) {
          setServerIsHost(true)
          setIsPrivateChatUnlocked(true)
        }

        if (Array.isArray(data.conversations)) {
          setConversations(data.conversations)
        }
        if (Array.isArray(data.messages)) {
          setPrivateMessages(data.messages)
        }
        if (data.otherUser) {
          setHostProfile(data.otherUser)
        }
        if (data.economics) {
          if (typeof data.economics.isPrivateChatUnlocked === 'boolean') {
            setIsPrivateChatUnlocked(data.economics.isPrivateChatUnlocked)
          }
          if (typeof data.economics.privateChatUnlockCost === 'number') {
            setPrivateChatUnlockCost(data.economics.privateChatUnlockCost)
          }
          if (typeof data.economics.privateChatCost === 'number') {
            setPrivateChatCost(data.economics.privateChatCost)
          }
          if (typeof data.economics.privateChatStreamerPercent === 'number') {
            setPrivateChatStreamerPercent(data.economics.privateChatStreamerPercent)
          }
          if (data.economics.userCoins !== null && data.economics.userCoins !== undefined) {
            setUserCoins(data.economics.userCoins)
          }
        }
      }

      // If host is viewing a specific viewer, also sync conversations list for badges
      if (isHost && selectedViewer) {
        const convRes = await fetch(`/api/live/chat/private?streamId=${streamId}`)
        if (convRes.ok) {
          const convData = await convRes.json()
          if (Array.isArray(convData.conversations)) {
            setConversations(convData.conversations)
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching private chats:', err)
    }
  }, [user, isHost, selectedViewer, streamId])

  useEffect(() => {
    fetchPrivateChat()
    // Poll private chat frequently so incoming messages appear live
    const interval = setInterval(fetchPrivateChat, 2500)
    return () => clearInterval(interval)
  }, [fetchPrivateChat])

  // --------------------------------------------------------------------------
  // 3. Real-Time DataChannel Listeners via LiveKit
  // --------------------------------------------------------------------------
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

  // Scroll to bottom helper for public chat
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

  // Scroll to bottom helper for private chat
  const scrollToPrivateBottom = useCallback((smooth = true) => {
    const el = privateScrollContainerRef.current
    if (el) {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } else {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [])

  const prevCountRef = useRef(0)
  useEffect(() => {
    if (activeChatTab === 'public' && !isScrolledUp) {
      const isNew = messages.length > prevCountRef.current
      if (isNew || prevCountRef.current === 0) {
        scrollToBottom(prevCountRef.current > 0)
      }
    }
    prevCountRef.current = messages.length
  }, [messages.length, isScrolledUp, activeChatTab, scrollToBottom])

  useEffect(() => {
    if (activeChatTab === 'private') {
      scrollToPrivateBottom(false)
    }
  }, [privateMessages.length, selectedViewer, activeChatTab, scrollToPrivateBottom])

  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setIsScrolledUp(!isAtBottom)
  }

  useEffect(() => {
    if (chatError) {
      const t = setTimeout(() => setChatError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [chatError])

  useEffect(() => {
    if (privateChatError) {
      const t = setTimeout(() => setPrivateChatError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [privateChatError])

  // --------------------------------------------------------------------------
  // 4. Send Public Message Handler
  // --------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent, selectedPaidEmoji?: PaidEmoji) => {
    if (e) e.preventDefault()
    setChatError(null)

    const cleanText = inputText.trim()
    if (!cleanText && !selectedPaidEmoji) return
    if (isSending || !user) return

    if (!userChatEnabled) {
      setChatError('Your live chat privileges have been disabled by an administrator.')
      return
    }

    const currentCoins = currentBalance
    const itemCost = selectedPaidEmoji ? selectedPaidEmoji.cost : chatCost
    const requiredCoins = isHost ? 0 : itemCost

    if (requiredCoins > 0 && currentCoins < requiredCoins) {
      setChatError(`Insufficient coins. Requires ${requiredCoins} coins (Your balance: ${currentCoins} coins).`)
      setIsTopUpModalOpen(true)
      return
    }

    setIsSending(true)
    setShowPaidEmojisTray(false)

    try {
      const res = await fetch('/api/live/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          message: cleanText,
          paidEmoji: selectedPaidEmoji?.emoji || null,
          emojiCost: selectedPaidEmoji?.cost || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          setChatError(data.error || 'Insufficient coins')
          setIsTopUpModalOpen(true)
        } else {
          setChatError(data.error || 'Failed to send message')
        }
        return
      }

      if (data.message) {
        setMessages((prev) => [...prev, data.message])
        setInputText('')
        if (typeof data.remainingCoins === 'number') {
          setUserCoins(data.remainingCoins)
        }
        scrollToBottom(true)

        if (room) {
          try {
            const encoder = new TextEncoder()
            const payload = encoder.encode(
              JSON.stringify({
                type: 'chat_message',
                message: data.message,
              })
            )
            await room.localParticipant.publishData(payload, { reliable: true })
          } catch (broadcastErr) {
            console.warn('DataChannel broadcast failed:', broadcastErr)
          }
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error sending message'
      setChatError(errorMsg)
    } finally {
      setIsSending(false)
    }
  }

  // --------------------------------------------------------------------------
  // 5. Send 1-on-1 Paid Private Message Handler
  // --------------------------------------------------------------------------
  const handleSendPrivateMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    setPrivateChatError(null)

    const cleanText = privateInputText.trim()
    if (!cleanText || isSendingPrivate || !user) return

    if (!userChatEnabled) {
      setPrivateChatError('Your chat privileges have been disabled by an administrator.')
      return
    }

    // Normal viewer balance check (Streamer chats completely FREE)
    if (!isHost && currentBalance < privateChatCost) {
      setPrivateChatError(
        `Insufficient coins. Private chat requires ${privateChatCost} coins (Your balance: ${currentBalance} coins).`
      )
      setIsTopUpModalOpen(true)
      return
    }

    const targetRecipientId = isHost ? selectedViewer?.id : broadcasterId
    if (!targetRecipientId) {
      setPrivateChatError('Please select a recipient to send message.')
      return
    }

    setIsSendingPrivate(true)

    try {
      const res = await fetch('/api/live/chat/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          message: cleanText,
          recipientId: targetRecipientId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          setPrivateChatError(data.error || 'Insufficient coins')
          setIsTopUpModalOpen(true)
        } else if (res.status === 403 && data.locked) {
          setIsPrivateChatUnlocked(false)
          setPrivateChatError(data.error || 'Private chat is locked. Please unlock private chat to message.')
        } else {
          setPrivateChatError(data.error || 'Failed to send private message')
        }
        return
      }

      if (data.message) {
        setPrivateMessages((prev) => [...prev, data.message])
        setPrivateInputText('')
        if (typeof data.remainingCoins === 'number') {
          setUserCoins(data.remainingCoins)
        }
        scrollToPrivateBottom(true)
        fetchPrivateChat()
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error sending private message'
      setPrivateChatError(errorMsg)
    } finally {
      setIsSendingPrivate(false)
    }
  }

  // -------------------------------------------------------------
  // UNLOCK PRIVATE CHAT HANDLER (REQUESTED BY USER)
  // -------------------------------------------------------------
  const handleUnlockPrivateChat = async () => {
    if (!user) return
    if (currentBalance < privateChatUnlockCost) {
      setIsTopUpModalOpen(true)
      return
    }
    setIsUnlocking(true)
    setPrivateChatError(null)
    try {
      const res = await fetch('/api/live/chat/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          action: 'unlock',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsPrivateChatUnlocked(true)
        if (typeof data.userCoins === 'number') {
          setUserCoins(data.userCoins)
        }
        refreshProfile?.()
        fetchPrivateChat()
      } else {
        setPrivateChatError(data.error || 'Failed to unlock private chat')
        if (res.status === 402) {
          setIsTopUpModalOpen(true)
        }
      }
    } catch {
      setPrivateChatError('Network error unlocking private chat')
    } finally {
      setIsUnlocking(false)
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

  // Filter conversations for host WhatsApp search
  const filteredConversations = useMemo(() => {
    if (!viewerSearch.trim()) return conversations
    const q = viewerSearch.toLowerCase()
    return conversations.filter(
      (c) =>
        c.otherUser.username.toLowerCase().includes(q) ||
        (c.otherUser.display_name && c.otherUser.display_name.toLowerCase().includes(q)) ||
        c.lastMessage.toLowerCase().includes(q)
    )
  }, [conversations, viewerSearch])

  return (
    <div
      className={`flex flex-col bg-[#0f0f0f] border border-[#272727] rounded-2xl overflow-hidden shadow-2xl relative select-none ${className}`}
    >
      {/* Top Header with Tab Switcher (Mobile Responsive) */}
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 bg-[#181818] border-b border-[#272727] flex items-center justify-between shrink-0 gap-1.5 sm:gap-2">
        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1 bg-[#121212] p-0.5 sm:p-1 rounded-xl border border-[#262626] shrink min-w-0">
          {/* Public Live Chat Tab */}
          <button
            type="button"
            onClick={() => setActiveChatTab('public')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeChatTab === 'public'
                ? 'bg-[#272727] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span>Live Chat</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5 shrink-0" />
          </button>

          {/* Private Chat Tab (Paid Option for Viewers / WhatsApp Inbox for Streamer) */}
          <button
            type="button"
            onClick={() => {
              setActiveChatTab('private')
              fetchPrivateChat()
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all relative shrink-0 ${
              activeChatTab === 'private'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-purple-300 shrink-0" />
            <span>{isHost ? 'Private Chats' : 'Private Chat'}</span>

            {/* Unread badge for streamer */}
            {isHost && totalUnreadPrivateCount > 0 && (
              <span className="bg-emerald-500 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full leading-none animate-pulse">
                {totalUnreadPrivateCount}
              </span>
            )}

            {/* Price indicator for normal viewers */}
            {!isHost && (
              <span className="text-[10px] bg-purple-950/70 border border-purple-400/40 text-purple-200 px-1.5 py-0.2 rounded-full font-mono hidden xs:inline-block">
                🪙 {isPrivateChatUnlocked ? privateChatCost : privateChatUnlockCost}
              </span>
            )}
          </button>
        </div>

        {/* Status Badge / Close Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isHost ? (
            <div
              className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0"
              title="You are the host of this stream. All chats are completely free for you!"
            >
              <Crown className="h-3 w-3 text-amber-400 shrink-0" />
              <span>Host<span className="hidden sm:inline"> (Free Chat)</span></span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsTopUpModalOpen(true)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold transition-colors cursor-pointer shrink-0"
              title="Click to top up coins"
            >
              <span>🪙</span>
              <span>{currentBalance}</span>
              <Plus className="h-2.5 w-2.5 ml-0.5 text-amber-400" />
            </button>
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

      {/* ===================================================================== */}
      {/* TAB 1: PUBLIC LIVE CHAT                                              */}
      {/* ===================================================================== */}
      {activeChatTab === 'public' && (
        <>
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

                // RENDER PAID SUPER EMOJI
                if (isPaidSuperEmoji) {
                  return (
                    <div key={msg.id} className="pt-2.5 first:pt-0">
                      <div className="rounded-xl overflow-hidden border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-zinc-900/90 to-zinc-900 shadow-lg shadow-amber-500/10">
                        <div className="px-3 py-1.5 bg-amber-500/25 border-b border-amber-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-amber-300 font-extrabold text-[10px] tracking-wider uppercase">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            <span>Super Emoji</span>
                          </div>
                          {msg.coinsPaid && msg.coinsPaid > 0 ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-black/40 px-2 py-0.5 rounded-full border border-amber-500/30">
                              🪙 {msg.coinsPaid} Coins
                            </span>
                          ) : null}
                        </div>

                        <div className="p-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-amber-500/30">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-amber-400">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-1 mb-1">
                              <span className="font-bold text-xs text-amber-200 truncate">{displayName}</span>
                              <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                                {formatChatTime(msg.created_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 my-1">
                              <span className="text-3xl filter drop-shadow-md select-none">{msg.paidEmoji}</span>
                              {msg.message && (
                                <p className="text-xs text-zinc-200 font-medium break-words leading-relaxed">
                                  {msg.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // RENDER REGULAR LIVE CHAT MESSAGE
                return (
                  <div key={msg.id} className="pt-2 first:pt-0 group hover:bg-zinc-900/30 -mx-1 px-1 rounded-lg transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0 mt-0.5 border border-zinc-700">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-zinc-300">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span
                            className={`font-semibold text-xs truncate ${
                              isMsgBroadcaster ? 'text-amber-400 flex items-center gap-1 font-bold' : 'text-zinc-400'
                            }`}
                          >
                            {displayName}
                            {isMsgBroadcaster && (
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                Host
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">{formatChatTime(msg.created_at)}</span>
                        </div>

                        <p className="text-xs text-zinc-200 break-words leading-relaxed mt-0.5">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scrolled Up Notice */}
          {isScrolledUp && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-zinc-800/95 hover:bg-zinc-700 border border-zinc-700 text-white rounded-full text-xs font-semibold shadow-xl flex items-center gap-1.5 transition-all animate-bounce"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>New messages</span>
            </button>
          )}

          {/* Chat Error Notice */}
          {chatError && (
            <div className="mx-3 my-1 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{chatError}</span>
              </div>
              <button onClick={() => setChatError(null)} className="text-red-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Paid Super Emojis Shelf Tray */}
          {showPaidEmojisTray && (
            <div className="p-3 bg-[#141414] border-t border-[#272727] shrink-0 space-y-2 animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Send Paid Super Emoji</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaidEmojisTray(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
                {paidEmojis.map((item) => {
                  const canAfford = isHost || currentBalance >= item.cost
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
                      title={isHost ? `${item.emoji} Free for Host` : `${item.emoji} costs ${item.cost} coins`}
                    >
                      <span className="text-2xl select-none mb-1">{item.emoji}</span>
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                        {isHost ? (
                          <span className="text-[9px] text-emerald-400 font-bold">FREE</span>
                        ) : (
                          <>
                            <span>🪙</span>
                            <span>{item.cost}</span>
                          </>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bottom Public Chat Input Bar */}
          <div className="p-3 bg-[#181818] border-t border-[#272727] shrink-0 space-y-2">
            {user ? (
              !userChatEnabled ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-red-400" />
                  <span>Your live chat privileges have been disabled by an administrator.</span>
                </div>
              ) : (
                <form onSubmit={(e) => handleSendMessage(e)} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPaidEmojisTray(!showPaidEmojisTray)}
                      className={`p-2 rounded-full border transition-colors shrink-0 ${
                        showPaidEmojisTray
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-[#141414] hover:bg-[#242424] text-amber-400 border-[#303030]'
                      }`}
                      title="Send Super Emoji"
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
                          : isHost
                          ? 'Chat with your viewers (Free for Host)...'
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

                  <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <span>🪙</span>
                        <span>{currentBalance} coins</span>
                      </span>
                      {isHost ? (
                        <span className="text-emerald-400 font-semibold">• Host (Free Chat)</span>
                      ) : chatCost > 0 ? (
                        <span className="text-zinc-500">• {chatCost} coins / msg</span>
                      ) : (
                        <span className="text-emerald-400">• Free Chat</span>
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
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 1-ON-1 PAID PRIVATE CHAT                                      */}
      {/* ===================================================================== */}
      {activeChatTab === 'private' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c]">
          {/* --------------------------------------------------------------- */}
          {/* STREAMER EXPERIENCE: WhatsApp-Style Inbox                       */}
          {/* --------------------------------------------------------------- */}
          {isHost ? (
            !selectedViewer ? (
              /* LEVEL A: Streamer's Contact List (One person one-by-one) */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search Bar for Viewers */}
                <div className="p-2.5 bg-[#141414] border-b border-[#242424] shrink-0">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search viewers..."
                      value={viewerSearch}
                      onChange={(e) => setViewerSearch(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-[#2e2e2e] focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e1e]">
                  {filteredConversations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-400">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">No Private Messages Yet</h4>
                        <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
                          When viewers pay coins to message you privately during the live stream, their 1-on-1 chats will appear here.
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-[#181818] border border-[#2a2a2a] rounded-full text-[10px] text-purple-300 font-mono">
                        Viewers pay 🪙 {privateChatCost} coins / msg
                      </div>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => {
                      const userInitials = (conv.otherUser.display_name || conv.otherUser.username || 'U')
                        .charAt(0)
                        .toUpperCase()

                      return (
                        <div
                          key={conv.otherUser.id}
                          onClick={() => {
                            setSelectedViewer(conv.otherUser)
                            fetchPrivateChat()
                          }}
                          className="p-3 hover:bg-[#181818] cursor-pointer transition-colors flex items-center gap-3 group"
                        >
                          {/* Viewer Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 border border-purple-500/30 flex items-center justify-center">
                              {conv.otherUser.avatar_url ? (
                                <img
                                  src={conv.otherUser.avatar_url}
                                  alt={conv.otherUser.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold text-sm text-purple-300">{userInitials}</span>
                              )}
                            </div>
                            {conv.unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>

                          {/* Message Preview Snippet */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-bold text-xs text-white truncate group-hover:text-purple-300 transition-colors">
                                {conv.otherUser.display_name || conv.otherUser.username}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                                {formatChatTime(conv.lastMessageAt)}
                              </span>
                            </div>

                            <p className="text-[11px] text-zinc-400 truncate leading-relaxed">
                              {conv.lastMessage}
                            </p>

                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full font-bold">
                                🪙 {conv.totalCoinsPaid} coins paid
                              </span>
                              <span className="text-[9px] text-zinc-600 font-mono">
                                @{conv.otherUser.username}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              /* LEVEL B: Streamer's 1-on-1 Chat Thread with Selected Person */
              <div className="flex-1 flex flex-col min-h-0">
                {/* 1-on-1 Header Bar with Back Button */}
                <div className="px-3 py-2 bg-[#161616] border-b border-[#262626] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedViewer(null)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                      title="Back to all conversations"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-800 border border-purple-500/40 shrink-0">
                      {selectedViewer.avatar_url ? (
                        <img
                          src={selectedViewer.avatar_url}
                          alt={selectedViewer.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-purple-300">
                          {(selectedViewer.display_name || selectedViewer.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {selectedViewer.display_name || selectedViewer.username}
                      </div>
                      <div className="text-[9px] text-zinc-400">@{selectedViewer.username}</div>
                    </div>
                  </div>

                  <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0">
                    Host (Free Chat)
                  </div>
                </div>

                {/* 1-on-1 Messages Thread */}
                <div
                  ref={privateScrollContainerRef}
                  className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs text-zinc-200"
                >
                  {privateMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-1">
                      <MessageCircle className="h-8 w-8 text-zinc-700 stroke-1" />
                      <p className="text-xs">No messages yet with this viewer.</p>
                      <p className="text-[10px] text-zinc-600">Reply freely to their private chat inquiry.</p>
                    </div>
                  ) : (
                    privateMessages.map((m) => {
                      const isFromHost = Boolean(user && m.sender_id === user.id)
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isFromHost ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 space-y-1 ${
                              isFromHost
                                ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/20'
                                : 'bg-[#1e1e1e] border border-[#2e2e2e] text-zinc-200 rounded-tl-sm'
                            }`}
                          >
                            <p className="text-xs break-words leading-relaxed whitespace-pre-wrap">{m.message}</p>
                            <div
                              className={`flex items-center gap-1.5 text-[9px] ${
                                isFromHost ? 'text-purple-200 justify-end' : 'text-zinc-500'
                              }`}
                            >
                              <span>{formatChatTime(m.created_at)}</span>
                              {!isFromHost && m.coins_paid > 0 && (
                                <span className="text-amber-400 font-bold">• 🪙 {m.coins_paid} paid</span>
                              )}
                              {isFromHost && <span>• 👑 You (Host)</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Streamer Reply Bar (Free for streamer) */}
                <form
                  onSubmit={handleSendPrivateMessage}
                  className="p-2.5 bg-[#161616] border-t border-[#262626] shrink-0 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={500}
                      placeholder={`Reply to @${selectedViewer.username}... (Free for Streamer)`}
                      value={privateInputText}
                      onChange={(e) => setPrivateInputText(e.target.value)}
                      className="flex-1 bg-[#1e1e1e] border border-[#303030] focus:border-purple-500 rounded-full px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={!privateInputText.trim() || isSendingPrivate}
                      className="px-3.5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold flex items-center gap-1 transition-colors shrink-0 shadow-md shadow-purple-600/20"
                    >
                      {isSendingPrivate ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>Send</span>
                          <Send className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
                    <span className="text-emerald-400 font-semibold">👑 Broadcaster: Free chat (0 coins deducted)</span>
                    <span>{privateInputText.length}/500</span>
                  </div>
                </form>
              </div>
            )
          ) : (
            /* --------------------------------------------------------------- */
            /* VIEWER EXPERIENCE: 1-on-1 Paid Private Chat with Host          */
            /* --------------------------------------------------------------- */
            !isPrivateChatUnlocked ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-purple-600/30">
                    <Lock className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 border-2 border-[#0c0c0c] flex items-center justify-center text-black text-xs font-black shadow">
                    🪙
                  </div>
                </div>

                <div className="space-y-1.5 max-w-xs">
                  <h3 className="text-base font-extrabold text-white">Unlock 1-on-1 Private Chat</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Chat directly with{' '}
                    <strong className="text-white">@{hostProfile?.username || 'streamer'}</strong>. Once
                    unlocked, your private chat stays active until turned off by an admin!
                  </p>
                </div>

                {/* Price and Details Card */}
                <div className="w-full max-w-xs p-3.5 rounded-2xl bg-[#141414] border border-[#272727] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Unlock Fee:</span>
                    <span className="font-extrabold text-amber-400 text-sm flex items-center gap-1">
                      <span>🪙</span>
                      <span>{privateChatUnlockCost} Coins</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#222] pt-2">
                    <span className="text-zinc-400">Your Coin Balance:</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        currentBalance < privateChatUnlockCost ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      <span>🪙</span>
                      <span>{currentBalance} Coins</span>
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-500 pt-0.5">
                    Broadcaster receives {privateChatStreamerPercent}% of the unlock fee
                  </div>
                </div>

                {/* Error Notice */}
                {privateChatError && (
                  <div className="w-full max-w-xs p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2">
                    <span>{privateChatError}</span>
                    <button
                      onClick={() => setPrivateChatError(null)}
                      className="text-red-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Action Button */}
                {user ? (
                  currentBalance < privateChatUnlockCost ? (
                    <div className="w-full max-w-xs space-y-2">
                      <button
                        type="button"
                        onClick={() => setIsTopUpModalOpen(true)}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Coins className="h-4 w-4" />
                        <span>Top Up Coins ({currentBalance}/{privateChatUnlockCost})</span>
                      </button>
                      <p className="text-[10px] text-zinc-500">
                        You need {privateChatUnlockCost - currentBalance} more coins to unlock
                      </p>
                    </div>
                  ) : (
                    <div className="w-full max-w-xs space-y-2">
                      <button
                        type="button"
                        disabled={isUnlocking}
                        onClick={handleUnlockPrivateChat}
                        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isUnlocking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Unlocking Private Chat...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-amber-300" />
                            <span>Unlock Now • 🪙 {privateChatUnlockCost} Coins</span>
                          </>
                        )}
                      </button>
                    </div>
                  )
                ) : (
                  <Link
                    href={`/login?redirect=/live/${streamId}`}
                    className="w-full max-w-xs py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center"
                  >
                    Sign In to Unlock Private Chat
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Host Profile Banner & Cost */}
                <div className="p-3 bg-gradient-to-r from-purple-950/40 to-zinc-900 border-b border-[#282828] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-purple-500/40 shrink-0">
                    {hostProfile?.avatar_url ? (
                      <img
                        src={hostProfile.avatar_url}
                        alt="Host"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-purple-300">
                        👑
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate">
                        {hostProfile?.display_name || hostProfile?.username || 'Stream Host'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded-full">
                        Host
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400">1-on-1 Private Live Chat</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-purple-300 font-mono">
                    🪙 {privateChatCost} Coins
                  </div>
                  <div className="text-[9px] text-zinc-500">per message</div>
                </div>
              </div>

              {/* Messages Thread */}
              <div
                ref={privateScrollContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs text-zinc-200"
              >
                {privateMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-950/30 border border-purple-800/30 flex items-center justify-center text-purple-400">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Direct 1-on-1 Chat with Host</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-[240px]">
                        Send a private paid message directly to the streamer. The host will see your message in their private inbox.
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-[#181818] border border-[#2a2a2a] rounded-full text-[10px] text-purple-300 font-mono">
                      🪙 {privateChatCost} coins per message • {privateChatStreamerPercent}% goes to host
                    </div>
                  </div>
                ) : (
                  privateMessages.map((m) => {
                    const isFromMe = m.sender_id === user?.id
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 space-y-1 ${
                            isFromMe
                              ? 'bg-purple-600 text-white rounded-tr-sm shadow-md shadow-purple-900/20'
                              : 'bg-[#1e1e1e] border border-amber-500/30 text-zinc-100 rounded-tl-sm'
                          }`}
                        >
                          <p className="text-xs break-words leading-relaxed whitespace-pre-wrap">{m.message}</p>
                          <div
                            className={`flex items-center gap-1.5 text-[9px] ${
                              isFromMe ? 'text-purple-200 justify-end' : 'text-amber-400'
                            }`}
                          >
                            <span>{formatChatTime(m.created_at)}</span>
                            {isFromMe && m.coins_paid > 0 && (
                              <span>• 🪙 {m.coins_paid} coins paid</span>
                            )}
                            {!isFromMe && <span className="font-bold">• 👑 Host</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Private Chat Error Notice */}
              {privateChatError && (
                <div className="mx-3 my-1 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{privateChatError}</span>
                  </div>
                  <button onClick={() => setPrivateChatError(null)} className="text-red-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Bottom Viewer Private Message Input Bar */}
              <div className="p-3 bg-[#181818] border-t border-[#272727] shrink-0 space-y-2">
                {user ? (
                  isPrivateBalanceInsufficient ? (
                    <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/40 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>🪙 Insufficient Coins</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Need {privateChatCost} coins (Your balance: {currentBalance} coins)
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsTopUpModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        Top Up Coins
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendPrivateMessage} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={500}
                          placeholder={`Private message to host (🪙 ${privateChatCost} coins)...`}
                          value={privateInputText}
                          onChange={(e) => setPrivateInputText(e.target.value)}
                          className="flex-1 bg-[#121212] border border-purple-500/40 focus:border-purple-400 rounded-full px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                        />

                        <button
                          type="submit"
                          disabled={!privateInputText.trim() || isSendingPrivate}
                          className="px-3.5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold flex items-center gap-1 transition-colors shrink-0 shadow-md shadow-purple-600/30"
                        >
                          {isSendingPrivate ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Send</span>
                              <Send className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-amber-400 flex items-center gap-1">
                            <span>🪙</span>
                            <span>{currentBalance} coins</span>
                          </span>
                          <span className="text-purple-300 font-medium">
                            • Costs {privateChatCost} coins / msg
                          </span>
                        </div>
                        <span>{privateInputText.length}/500</span>
                      </div>
                    </form>
                  )
                ) : (
                  <div className="flex items-center justify-between p-2 rounded-2xl bg-[#121212] border border-[#272727]">
                    <span className="text-xs text-zinc-400">Sign in to chat privately with host</span>
                    <Link
                      href={`/login?redirect=/live/${streamId}`}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-xs font-semibold transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    )}

      {/* Coin Top-Up Modal Integration */}
      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={() => setIsTopUpModalOpen(false)}
        onSuccess={() => {
          refreshProfile?.()
          fetchPrivateChat()
        }}
      />
    </div>
  )
}
