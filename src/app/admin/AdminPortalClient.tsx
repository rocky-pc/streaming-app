'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Shield,
  Radio,
  Video,
  MessageSquare,
  Users,
  Activity,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Clock,
  HardDrive,
  Server,
  Key,
  LogOut,
  Database,
  Play,
  Lock,
  Globe,
  Sliders,
  Sparkles,
  Zap,
  Coins,
  DollarSign,
  Percent,
  Plus,
  Minus,
  Check,
  ToggleLeft,
  ToggleRight,
  X,
  TrendingUp,
  CreditCard,
  Copy,
  QrCode,
  XCircle,
} from 'lucide-react'
import { formatFileSize, formatRelativeTime, formatDuration, formatDate } from '@/lib/utils'

interface AdminStats {
  activeStreams: number
  totalStreams: number
  totalVideos: number
  totalChats: number
  totalProfiles: number
}

interface HealthStatus {
  database: {
    connected: boolean
    latencyMs: number
  }
  livekit: {
    connected: boolean
    activeRooms: number
    host: string
    latencyMs: number
    error: string | null
  }
}

interface AdminUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  coin_balance: number
  chat_enabled: boolean
  created_at: string
  updated_at: string
  videoCount?: number
  streamCount?: number
  totalRevenue?: number
}

export interface PaidEmojiItem {
  emoji: string
  cost: number
}

export const DEFAULT_PAID_EMOJIS: PaidEmojiItem[] = [
  { emoji: '❤️', cost: 5 },
  { emoji: '🔥', cost: 10 },
  { emoji: '👏', cost: 15 },
  { emoji: '🎉', cost: 25 },
  { emoji: '💎', cost: 50 },
  { emoji: '🚀', cost: 100 },
  { emoji: '👑', cost: 500 },
]

interface PlatformEconomics {
  signup_coin_bonus: number
  chat_cost_per_message: number
  streamer_revenue_percent: number
  paid_chat_emojis?: PaidEmojiItem[]
}

interface AdminStream {
  id: string
  user_id: string
  title: string
  description: string | null
  room_name: string
  status: 'scheduled' | 'live' | 'ended'
  visibility: 'public' | 'unlisted' | 'private'
  started_at: string | null
  ended_at: string | null
  created_at: string
  isLiveKitActive: boolean
  livekitParticipants: number
  profiles?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface AdminVideo {
  id: string
  user_id: string | null
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string
  duration: number | null
  file_size: number | null
  mime_type: string | null
  storage_path: string
  thumbnail_path: string | null
  visibility: 'public' | 'unlisted' | 'private'
  created_at: string
  profiles?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface AdminChat {
  id: string
  stream_id: string
  user_id: string
  message: string
  paid_emoji?: string | null
  coins_paid?: number | null
  created_at: string
  profiles?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  live_streams?: {
    title: string
    room_name: string
    status: string
  } | null
}

interface AdminTopupRequest {
  id: string
  user_id: string
  coins: number
  amount_inr: number
  utr_number: string
  upi_id: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    coin_balance: number
  } | null
}

interface AdminUpiSettings {
  admin_upi_id: string
  admin_upi_name: string
  coin_price_inr: number
}

type TabType = 'overview' | 'users' | 'streams' | 'videos' | 'chats' | 'topups' | 'settings'

export default function AdminPortalClient() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [streams, setStreams] = useState<AdminStream[]>([])
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [chats, setChats] = useState<AdminChat[]>([])
  const [economics, setEconomics] = useState<PlatformEconomics>({
    signup_coin_bonus: 50,
    chat_cost_per_message: 2,
    streamer_revenue_percent: 70,
    paid_chat_emojis: DEFAULT_PAID_EMOJIS,
  })

  // Top-Up & UPI Transactions State
  const [topupRequests, setTopupRequests] = useState<AdminTopupRequest[]>([])
  const [upiSettings, setUpiSettings] = useState<AdminUpiSettings>({
    admin_upi_id: 'streamflow@upi',
    admin_upi_name: 'StreamFlow Official',
    coin_price_inr: 1,
  })
  const [upiForm, setUpiForm] = useState<AdminUpiSettings>({
    admin_upi_id: 'streamflow@upi',
    admin_upi_name: 'StreamFlow Official',
    coin_price_inr: 1,
  })
  const [isSavingUpiSettings, setIsSavingUpiSettings] = useState(false)
  const [processingTopupId, setProcessingTopupId] = useState<string | null>(null)
  const [decliningRequest, setDecliningRequest] = useState<AdminTopupRequest | null>(null)
  const [declineReasonInput, setDeclineReasonInput] = useState('Payment verification failed / Invalid UTR')
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null)

  const [isLoadingData, setIsLoadingData] = useState(false)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filters
  const [userSearch, setUserSearch] = useState('')
  const [streamFilter, setStreamFilter] = useState<'all' | 'live' | 'ended'>('all')
  const [streamSearch, setStreamSearch] = useState('')
  const [videoFilter, setVideoFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all')
  const [videoSearch, setVideoSearch] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [topupFilter, setTopupFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [topupSearch, setTopupSearch] = useState('')
  const [selectedChatStream, setSelectedChatStream] = useState<string>('all')

  // Modals / Action Confirmations
  const [pendingAction, setPendingAction] = useState<{
    type: 'kill_stream' | 'delete_stream' | 'delete_video' | 'purge_chats' | 'delete_chat'
    id: string
    title?: string
    roomName?: string
  } | null>(null)
  const [isExecutingAction, setIsExecutingAction] = useState(false)

  // Manage Coins Modal State
  const [managingCoinsUser, setManagingCoinsUser] = useState<AdminUser | null>(null)
  const [coinActionType, setCoinActionType] = useState<'add' | 'remove' | 'set'>('add')
  const [coinAmount, setCoinAmount] = useState<number>(50)
  const [coinReason, setCoinReason] = useState<string>('')
  const [isSubmittingCoins, setIsSubmittingCoins] = useState(false)

  // Economics Edit State
  const [settingsForm, setSettingsForm] = useState<PlatformEconomics>({
    signup_coin_bonus: 50,
    chat_cost_per_message: 2,
    streamer_revenue_percent: 70,
    paid_chat_emojis: DEFAULT_PAID_EMOJIS,
  })
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Paid Chat Emoji Manager State
  const [newEmojiInput, setNewEmojiInput] = useState('')
  const [newEmojiCost, setNewEmojiCost] = useState<number>(20)

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth')
        const data = await res.json()
        setIsAuthenticated(Boolean(data.authenticated))
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  // Auto-dismiss notice
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => setActionNotice(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [actionNotice])

  // Login handler
  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault()
    setAuthError(null)
    setIsSubmittingAuth(true)

    const user = customUser !== undefined ? customUser : usernameInput
    const pass = customPass !== undefined ? customPass : passwordInput

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setIsAuthenticated(true)
        setActionNotice({ type: 'success', message: 'Welcome to StreamFlow Admin Console' })
      } else {
        setAuthError(data.error || 'Invalid credentials')
      }
    } catch {
      setAuthError('Connection error. Please try again.')
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
      setIsAuthenticated(false)
      setUsernameInput('')
      setPasswordInput('')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // Fetch Dashboard Data
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoadingData(true)
    try {
      // 1. Fetch Stats & Health
      const statsRes = await fetch('/api/admin/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats)
        setHealth(statsData.health)
      }

      // 2. Fetch Users
      const usersRes = await fetch('/api/admin/users')
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users || [])
      }

      // 3. Fetch Economics Settings
      const settingsRes = await fetch('/api/admin/settings')
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.settings) {
          const loaded: PlatformEconomics = {
            signup_coin_bonus: settingsData.settings.signup_coin_bonus ?? 50,
            chat_cost_per_message: settingsData.settings.chat_cost_per_message ?? 2,
            streamer_revenue_percent: settingsData.settings.streamer_revenue_percent ?? 70,
            paid_chat_emojis:
              Array.isArray(settingsData.settings.paid_chat_emojis) &&
              settingsData.settings.paid_chat_emojis.length > 0
                ? settingsData.settings.paid_chat_emojis
                : DEFAULT_PAID_EMOJIS,
          }
          setEconomics(loaded)
          setSettingsForm(loaded)
        }
      }

      // 4. Fetch Streams
      const streamsRes = await fetch('/api/admin/streams')
      if (streamsRes.ok) {
        const streamsData = await streamsRes.json()
        setStreams(streamsData.streams || [])
      }

      // 5. Fetch Videos
      const videosRes = await fetch('/api/admin/videos')
      if (videosRes.ok) {
        const videosData = await videosRes.json()
        setVideos(videosData.videos || [])
      }

      // 6. Fetch Chats
      const chatsRes = await fetch('/api/admin/chats')
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json()
        setChats(chatsData.messages || [])
      }

      // 7. Fetch Topup Requests & UPI Settings
      const topupRes = await fetch('/api/admin/topup')
      if (topupRes.ok) {
        const topupData = await topupRes.json()
        setTopupRequests(topupData.requests || [])
        if (topupData.settings) {
          setUpiSettings(topupData.settings)
          setUpiForm(topupData.settings)
        }
      }
    } catch (err) {
      console.error('Error fetching admin data:', err)
      setActionNotice({ type: 'error', message: 'Failed to refresh telemetry' })
    } finally {
      setIsLoadingData(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated, loadDashboardData])

  // Live real-time chat polling for Admin without requiring page refresh
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'chats') return
    const pollChats = async () => {
      try {
        const chatsRes = await fetch('/api/admin/chats')
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json()
          setChats(chatsData.messages || [])
        }
      } catch {
        // silent polling error
      }
    }
    const interval = setInterval(pollChats, 3500)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeTab])

  // Live real-time topup requests polling for Admin without requiring page refresh
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'topups') return
    const pollTopups = async () => {
      try {
        const res = await fetch('/api/admin/topup')
        if (res.ok) {
          const data = await res.json()
          setTopupRequests(data.requests || [])
        }
      } catch {
        // silent polling error
      }
    }
    const interval = setInterval(pollTopups, 3500)
    return () => clearInterval(interval)
  }, [isAuthenticated, activeTab])

  // -------------------------------------------------------------
  // USER LIST: LIVE CHAT ON/OFF SWITCH HANDLER
  // -------------------------------------------------------------
  const handleToggleUserChat = async (user: AdminUser) => {
    const nextState = !user.chat_enabled
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, chat_enabled: nextState }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, chat_enabled: nextState } : u))
        )
        setActionNotice({
          type: 'success',
          message: `Live chat access ${nextState ? 'ENABLED' : 'DISABLED'} for @${user.username}`,
        })
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to toggle chat permission' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to communicate with server' })
    }
  }

  // -------------------------------------------------------------
  // USER WALLET: ADD / REMOVE COINS HANDLER
  // -------------------------------------------------------------
  const handleSaveCoins = async () => {
    if (!managingCoinsUser) return
    setIsSubmittingCoins(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: managingCoinsUser.id,
          coin_action: coinActionType,
          coin_amount: Number(coinAmount),
          reason: coinReason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === managingCoinsUser.id ? { ...u, coin_balance: data.user.coin_balance } : u))
        )
        setActionNotice({
          type: 'success',
          message: `Updated @${managingCoinsUser.username} wallet to ${data.user.coin_balance} coins!`,
        })
        setManagingCoinsUser(null)
        setCoinAmount(50)
        setCoinReason('')
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to update coins' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to update wallet coins' })
    } finally {
      setIsSubmittingCoins(false)
    }
  }

  // -------------------------------------------------------------
  // PLATFORM ECONOMICS SETTINGS HANDLER
  // -------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })
      const data = await res.json()
      if (res.ok) {
        setEconomics(settingsForm)
        setActionNotice({ type: 'success', message: 'Platform economics and paid emojis updated successfully!' })
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to save economics' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Error saving settings' })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // -------------------------------------------------------------
  // TOP-UP & UPI SETTINGS HANDLERS
  // -------------------------------------------------------------
  const handleSaveUpiSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingUpiSettings(true)
    try {
      const res = await fetch('/api/admin/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          admin_upi_id: upiForm.admin_upi_id,
          admin_upi_name: upiForm.admin_upi_name,
          coin_price_inr: upiForm.coin_price_inr,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setUpiSettings(upiForm)
        setActionNotice({ type: 'success', message: data.message || 'UPI Settings saved!' })
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to save UPI settings' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to update UPI settings' })
    } finally {
      setIsSavingUpiSettings(false)
    }
  }

  const handleApproveTopup = async (requestId: string) => {
    setProcessingTopupId(requestId)
    try {
      const res = await fetch('/api/admin/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestId }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionNotice({ type: 'success', message: data.message || 'Top-up approved and coins credited!' })
        setTopupRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, status: 'approved', admin_notes: 'Payment verified by Admin' }
              : r
          )
        )
        loadDashboardData()
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to approve top-up' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error approving top-up' })
    } finally {
      setProcessingTopupId(null)
    }
  }

  const handleDeclineTopup = async (requestId: string, reason?: string) => {
    setProcessingTopupId(requestId)
    try {
      const res = await fetch('/api/admin/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          requestId,
          reason: reason || 'Payment could not be verified with UTR reference.',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionNotice({ type: 'success', message: data.message || 'Top-up request declined' })
        setTopupRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: 'rejected',
                  admin_notes: reason || 'Payment could not be verified with UTR reference.',
                }
              : r
          )
        )
        setDecliningRequest(null)
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to decline top-up' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Network error declining top-up' })
    } finally {
      setProcessingTopupId(null)
    }
  }

  // -------------------------------------------------------------
  // PAID EMOJIS (SUPER STICKERS) MANAGEMENT HANDLERS
  // -------------------------------------------------------------
  const handleUpdateEmojiCost = (emojiChar: string, newCost: number) => {
    const cost = Math.max(1, Math.min(100000, newCost || 1))
    setSettingsForm((prev) => ({
      ...prev,
      paid_chat_emojis: (prev.paid_chat_emojis || DEFAULT_PAID_EMOJIS).map((item) =>
        item.emoji === emojiChar ? { ...item, cost } : item
      ),
    }))
  }

  const handleDeleteEmoji = (emojiChar: string) => {
    setSettingsForm((prev) => {
      const current = prev.paid_chat_emojis || DEFAULT_PAID_EMOJIS
      if (current.length <= 1) {
        setActionNotice({ type: 'error', message: 'You must keep at least 1 paid emoji configured.' })
        return prev
      }
      return {
        ...prev,
        paid_chat_emojis: current.filter((item) => item.emoji !== emojiChar),
      }
    })
  }

  const handleAddEmoji = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newEmojiInput.trim()
    if (!trimmed) {
      setActionNotice({ type: 'error', message: 'Please select or enter an emoji.' })
      return
    }
    const cost = Math.max(1, Math.min(100000, Number(newEmojiCost) || 1))

    setSettingsForm((prev) => {
      const current = prev.paid_chat_emojis || DEFAULT_PAID_EMOJIS
      const existing = current.find((x) => x.emoji === trimmed)
      if (existing) {
        return {
          ...prev,
          paid_chat_emojis: current.map((x) => (x.emoji === trimmed ? { ...x, cost } : x)),
        }
      }
      return {
        ...prev,
        paid_chat_emojis: [...current, { emoji: trimmed, cost }],
      }
    })
    setActionNotice({ type: 'success', message: `Added paid emoji ${trimmed} at ${cost} coins!` })
    setNewEmojiInput('')
    setNewEmojiCost(20)
  }

  const handleResetEmojis = () => {
    setSettingsForm((prev) => ({
      ...prev,
      paid_chat_emojis: DEFAULT_PAID_EMOJIS,
    }))
    setActionNotice({ type: 'success', message: 'Reset emojis to standard platform defaults' })
  }

  // Stream Actions
  const handleKillStream = async (streamId: string, roomName: string) => {
    setIsExecutingAction(true)
    try {
      const res = await fetch('/api/admin/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill_stream', streamId, roomName }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionNotice({ type: 'success', message: 'Stream forcibly ended and room disconnected' })
        setPendingAction(null)
        loadDashboardData()
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Failed to kill stream' })
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Error communicating with server' })
    } finally {
      setIsExecutingAction(false)
    }
  }

  const handleUpdateStreamVisibility = async (streamId: string, visibility: string) => {
    try {
      const res = await fetch('/api/admin/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_visibility', streamId, visibility }),
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: `Stream visibility updated to ${visibility}` })
        setStreams((prev) =>
          prev.map((s) => (s.id === streamId ? { ...s, visibility: visibility as AdminStream['visibility'] } : s))
        )
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to update visibility' })
    }
  }

  const handleDeleteStream = async (streamId: string) => {
    setIsExecutingAction(true)
    try {
      const res = await fetch('/api/admin/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_stream', streamId }),
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: 'Stream and chat logs deleted' })
        setPendingAction(null)
        setStreams((prev) => prev.filter((s) => s.id !== streamId))
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to delete stream' })
    } finally {
      setIsExecutingAction(false)
    }
  }

  const handlePurgeGhostStreams = async () => {
    setIsLoadingData(true)
    try {
      const res = await fetch('/api/admin/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge_ghosts' }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionNotice({ type: 'success', message: data.message || 'Ghost streams pruned' })
        loadDashboardData()
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to purge ghost streams' })
    } finally {
      setIsLoadingData(false)
    }
  }

  // Video Actions
  const handleUpdateVideoVisibility = async (videoId: string, visibility: string) => {
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, visibility }),
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: `Video visibility changed to ${visibility}` })
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, visibility: visibility as AdminVideo['visibility'] } : v))
        )
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to update video visibility' })
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    setIsExecutingAction(true)
    try {
      const res = await fetch(`/api/admin/videos?id=${videoId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: 'Video and storage files deleted permanently' })
        setPendingAction(null)
        setVideos((prev) => prev.filter((v) => v.id !== videoId))
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to delete video' })
    } finally {
      setIsExecutingAction(false)
    }
  }

  // Chat Actions
  const handleDeleteChat = async (chatId: string) => {
    setIsExecutingAction(true)
    try {
      const res = await fetch(`/api/admin/chats?id=${chatId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: 'Chat message deleted' })
        setPendingAction(null)
        setChats((prev) => prev.filter((c) => c.id !== chatId))
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to delete message' })
    } finally {
      setIsExecutingAction(false)
    }
  }

  const handlePurgeStreamChats = async (streamId: string) => {
    setIsExecutingAction(true)
    try {
      const res = await fetch(`/api/admin/chats?stream_id=${streamId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActionNotice({ type: 'success', message: 'All chat messages for this stream purged' })
        setPendingAction(null)
        setChats((prev) => prev.filter((c) => c.stream_id !== streamId))
      }
    } catch {
      setActionNotice({ type: 'error', message: 'Failed to purge chats' })
    } finally {
      setIsExecutingAction(false)
    }
  }

  // Filtered views
  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true
    const q = userSearch.toLowerCase()
    return (
      u.username.toLowerCase().includes(q) ||
      (u.display_name && u.display_name.toLowerCase().includes(q))
    )
  })

  const filteredStreams = streams.filter((s) => {
    if (streamFilter === 'live' && s.status !== 'live') return false
    if (streamFilter === 'ended' && s.status !== 'ended') return false
    if (streamSearch) {
      const q = streamSearch.toLowerCase()
      const titleMatch = s.title.toLowerCase().includes(q)
      const roomMatch = s.room_name.toLowerCase().includes(q)
      const userMatch = s.profiles?.username?.toLowerCase().includes(q) || false
      return titleMatch || roomMatch || userMatch
    }
    return true
  })

  const filteredVideos = videos.filter((v) => {
    if (videoFilter !== 'all' && v.visibility !== videoFilter) return false
    if (videoSearch) {
      const q = videoSearch.toLowerCase()
      const titleMatch = v.title.toLowerCase().includes(q)
      const userMatch = v.profiles?.username?.toLowerCase().includes(q) || false
      return titleMatch || userMatch
    }
    return true
  })

  const filteredChats = chats.filter((c) => {
    if (selectedChatStream !== 'all' && c.stream_id !== selectedChatStream) return false
    if (chatSearch) {
      const q = chatSearch.toLowerCase()
      const msgMatch = c.message.toLowerCase().includes(q)
      const userMatch = c.profiles?.username?.toLowerCase().includes(q) || false
      return msgMatch || userMatch
    }
    return true
  })

  const totalCirculatingCoins = users.reduce((acc, u) => acc + (u.coin_balance || 0), 0)
  const totalStreamerRevenue = users.reduce((acc, u) => acc + (u.totalRevenue || 0), 0)

  const filteredTopups = topupRequests.filter((r) => {
    if (topupFilter !== 'all' && r.status !== topupFilter) return false
    if (topupSearch) {
      const q = topupSearch.toLowerCase()
      const utrMatch = r.utr_number.toLowerCase().includes(q)
      const userMatch = r.profiles?.username?.toLowerCase().includes(q) || false
      const nameMatch = r.profiles?.display_name?.toLowerCase().includes(q) || false
      return utrMatch || userMatch || nameMatch
    }
    return true
  })

  const pendingTopupsCount = topupRequests.filter((r) => r.status === 'pending').length
  const totalTopupInr = topupRequests
    .filter((r) => r.status === 'approved')
    .reduce((acc, r) => acc + (Number(r.amount_inr) || 0), 0)
  const totalTopupCoins = topupRequests
    .filter((r) => r.status === 'approved')
    .reduce((acc, r) => acc + (r.coins || 0), 0)

  // Loading initial state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen -mt-14 -mb-14 sm:mb-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-sm">Connecting to StreamFlow Admin Service...</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW: ADMIN LOGIN PORTAL
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen -mt-14 -mb-14 sm:mb-0 bg-[#070707] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-zinc-800/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 space-y-6">
          {/* Header Brand */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/80 shadow-2xl mb-1">
              <Shield className="h-9 w-9 text-red-500" />
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-semibold text-red-400 tracking-wider uppercase mb-1">
              Restricted Access Console
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">StreamFlow Admin Portal</h1>
            <p className="text-xs text-zinc-400">
              Enterprise Control Hub • Stream Infrastructure & Policy Management
            </p>
          </div>

          {/* Authentic Admin Login Form */}
          <form
            onSubmit={(e) => handleLogin(e)}
            className="bg-[#121212]/90 border border-[#2a2a2a] rounded-2xl p-7 shadow-2xl backdrop-blur-xl space-y-5"
          >
            {authError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2.5 animate-shake">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="font-medium">{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Administrator Username
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Shield className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Enter administrator username"
                  className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-red-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-red-500 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth || !usernameInput.trim() || !passwordInput}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmittingAuth ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Sign In to Admin Portal</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center border-t border-[#222]">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <span>← Return to StreamFlow Main Site</span>
              </Link>
            </div>
          </form>

          {/* Security Notice */}
          <div className="text-center text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Authorized personnel only. All administrative activities and IP addresses are monitored and logged.
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW: MAIN ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen -mt-14 -mb-14 sm:mb-0 bg-[#0f0f0f] text-zinc-100 flex flex-col font-sans">
      {/* Top Admin Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-[#272727] px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">StreamFlow</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 hidden sm:block">Vercel Serverless Stream Flow & Coin Control</span>
            </div>
          </div>

          {/* Quick Health Pills */}
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#272727]">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                health?.livekit.connected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${health?.livekit.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>LiveKit Cloud</span>
              {health?.livekit.latencyMs ? <span className="text-[10px] opacity-75">{health.livekit.latencyMs}ms</span> : null}
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Supabase Edge</span>
              {health?.database.latencyMs ? <span className="text-[10px] opacity-75">{health.database.latencyMs}ms</span> : null}
            </div>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={isLoadingData}
            title="Refresh All Telemetry"
            className="p-2 text-zinc-400 hover:text-white hover:bg-[#272727] rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin text-red-500' : ''}`} />
          </button>

          <Link
            href="/"
            target="_blank"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-[#1f1f1f] hover:bg-[#272727] border border-[#272727] rounded-xl transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Public Site</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Floating Action Notice Toast */}
      {actionNotice && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-sm flex items-center gap-2.5 animate-slide-up backdrop-blur-md ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/90 border-red-500/30 text-red-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Main Admin Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#272727] pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Overview & Health</span>
          </button>

          {/* User List with Live Chat switch & Coin wallet */}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Users & Wallets</span>
            <span className="text-xs text-amber-400 font-bold">({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('streams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'streams'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Radio className="h-4 w-4" />
            <span>Live Streams</span>
            {stats && stats.activeStreams > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-red-600 font-bold animate-pulse">
                {stats.activeStreams}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'videos'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>Uploaded Videos</span>
            {stats && (
              <span className="text-xs text-zinc-400 font-normal">({stats.totalVideos})</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('chats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'chats'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Live Chats</span>
            {stats && (
              <span className="text-xs text-zinc-400 font-normal">({stats.totalChats})</span>
            )}
          </button>

          {/* Top-Up Requests & UPI Settings Tab */}
          <button
            onClick={() => setActiveTab('topups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'topups'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Top-Up & UPI</span>
            {pendingTopupsCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-extrabold animate-pulse">
                {pendingTopupsCount}
              </span>
            ) : (
              <span className="text-xs text-zinc-400 font-normal">({topupRequests.length})</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Economy & Flow Settings</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Active Live Streams */}
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Live Streams Now</span>
                  <span className="p-2 rounded-xl bg-red-500/10 text-red-500">
                    <Radio className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{stats?.activeStreams ?? 0}</span>
                  {stats && stats.activeStreams > 0 && (
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Broadcasting
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Total broadcast sessions: {stats?.totalStreams ?? 0}
                </p>
              </div>

              {/* Total Coins in Circulation */}
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Circulating Coins</span>
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Coins className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-400">🪙 {totalCirculatingCoins}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Across {users.length} user wallets</p>
              </div>

              {/* Uploaded Videos */}
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Uploaded Videos</span>
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Video className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{stats?.totalVideos ?? 0}</span>
                  <span className="text-xs text-zinc-400">Assets</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Stored in Supabase Storage</p>
              </div>

              {/* Live Chat Messages */}
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Chat Messages</span>
                  <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <MessageSquare className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{stats?.totalChats ?? 0}</span>
                  <span className="text-xs text-zinc-400">Interactions</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">WebRTC + PostgreSQL</p>
              </div>

              {/* Registered Profiles */}
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">User Channels</span>
                  <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Users className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">{stats?.totalProfiles ?? users.length}</span>
                  <span className="text-xs text-zinc-400">Users</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">With coin wallets & chat toggles</p>
              </div>
            </div>

            {/* Quick Economics Summary Card */}
            <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-5 w-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">Active Coin Economics Policy</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  New users receive <strong className="text-amber-400">🪙 {economics.signup_coin_bonus} coins</strong> sign-up bonus • Live chat costs <strong className="text-amber-400">🪙 {economics.chat_cost_per_message} coins/message</strong> • Streamers earn <strong className="text-emerald-400">{economics.streamer_revenue_percent}%</strong> per chat!
                </p>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-amber-500/20 shrink-0"
              >
                Modify Economics Policy
              </button>
            </div>

            {/* Cloud Diagnostics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Server className="h-4 w-4 text-red-500" />
                    LiveKit Cloud WebRTC
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      health?.livekit.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {health?.livekit.connected ? 'Operational' : 'Disconnected'}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="flex justify-between py-1 border-b border-[#252525]">
                    <span className="text-zinc-500">Host URL</span>
                    <span className="font-mono text-zinc-300">{health?.livekit.host || 'wss://stream-flow...'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#252525]">
                    <span className="text-zinc-500">Active LiveKit Rooms</span>
                    <span className="font-semibold text-white">{health?.livekit.activeRooms ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Server SDK Latency</span>
                    <span className="font-semibold text-emerald-400">{health?.livekit.latencyMs ?? 0}ms</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-500" />
                    Supabase PostgreSQL & Storage
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    Operational
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="flex justify-between py-1 border-b border-[#252525]">
                    <span className="text-zinc-500">Role Privilege</span>
                    <span className="font-mono text-emerald-400">service_role (Admin Bypass RLS)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#252525]">
                    <span className="text-zinc-500">Tables</span>
                    <span className="font-semibold text-white">profiles, videos, live_streams, platform_settings</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">PostgreSQL Latency</span>
                    <span className="font-semibold text-emerald-400">{health?.database.latencyMs ?? 0}ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: USERS & WALLETS (LIVE CHAT SWITCH + COIN LOGIC) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181818] border border-[#272727] p-4 rounded-2xl">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by username or display name..."
                  className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span>Total Users: <strong className="text-white">{filteredUsers.length}</strong></span>
                <span>•</span>
                <span>Circulating Coins: <strong className="text-amber-400">🪙 {totalCirculatingCoins}</strong></span>
                <span>•</span>
                <span>Total Streamer Earnings: <strong className="text-emerald-400">📈 {totalStreamerRevenue} Coins</strong></span>
              </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 ? (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl p-12 text-center text-zinc-500 space-y-2">
                <Users className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No users found</p>
                <p className="text-xs">Users registered on StreamFlow will appear here</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202020] text-zinc-400 uppercase tracking-wider text-[11px] border-b border-[#272727]">
                      <tr>
                        <th className="py-3 px-4">User Channel</th>
                        <th className="py-3 px-4">Joined</th>
                        <th className="py-3 px-4">Activity</th>
                        <th className="py-3 px-4 text-center">Live Chat Access</th>
                        <th className="py-3 px-4">Wallet Balance</th>
                        <th className="py-3 px-4">Streamer Revenue</th>
                        <th className="py-3 px-4 text-right">Wallet Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#272727]">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <Image
                                  src={u.avatar_url}
                                  alt={u.username}
                                  width={32}
                                  height={32}
                                  className="rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center font-bold text-xs text-white shrink-0">
                                  {u.username[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-white block">
                                  {u.display_name || u.username}
                                </span>
                                <span className="text-[11px] text-zinc-500">@{u.username}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            {formatDate(u.created_at)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            <span>{u.videoCount ?? 0} videos</span>
                            <span className="mx-1">•</span>
                            <span>{u.streamCount ?? 0} streams</span>
                          </td>

                          {/* LIVE CHAT ON/OFF SWITCH */}
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleUserChat(u)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                                u.chat_enabled !== false
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                              }`}
                              title={
                                u.chat_enabled !== false
                                  ? 'Live chat is ON. Click to disable/mute.'
                                  : 'Live chat is OFF. Click to re-enable.'
                              }
                            >
                              {u.chat_enabled !== false ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Chat ON</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span>Chat OFF (Muted)</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* WALLET COIN BALANCE */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold text-xs">
                              <span>🪙</span>
                              <span>{u.coin_balance ?? 0} Coins</span>
                            </div>
                          </td>

                          {/* STREAMER REVENUE */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-xs" title="Lifetime coins earned from chat & super stickers">
                              <span>📈</span>
                              <span>{u.totalRevenue ?? 0} Coins</span>
                            </div>
                          </td>

                          {/* WALLET MANAGEMENT BUTTONS */}
                          <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                            <button
                              onClick={() => {
                                setManagingCoinsUser(u)
                                setCoinActionType('add')
                                setCoinAmount(50)
                                setCoinReason('Admin bonus')
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl transition-colors"
                            >
                              <Coins className="h-3.5 w-3.5" />
                              <span>Manage Coins</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: LIVE STREAMS MANAGEMENT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'streams' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181818] border border-[#272727] p-4 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={streamSearch}
                    onChange={(e) => setStreamSearch(e.target.value)}
                    placeholder="Search by title, room, broadcaster..."
                    className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <select
                  value={streamFilter}
                  onChange={(e) => setStreamFilter(e.target.value as 'all' | 'live' | 'ended')}
                  className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Streams</option>
                  <option value="live">Live Only</option>
                  <option value="ended">Ended Only</option>
                </select>
              </div>

              <button
                onClick={handlePurgeGhostStreams}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-zinc-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Prune Ghost Streams</span>
              </button>
            </div>

            {/* Streams List */}
            {filteredStreams.length === 0 ? (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl p-12 text-center text-zinc-500 space-y-2">
                <Radio className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No live streams found</p>
                <p className="text-xs">Adjust your search criteria or start a stream in Go Live Studio</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202020] text-zinc-400 uppercase tracking-wider text-[11px] border-b border-[#272727]">
                      <tr>
                        <th className="py-3 px-4">Status & Room</th>
                        <th className="py-3 px-4">Broadcaster</th>
                        <th className="py-3 px-4">Stream Title</th>
                        <th className="py-3 px-4">Visibility</th>
                        <th className="py-3 px-4">Started / Duration</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#272727]">
                      {filteredStreams.map((s) => (
                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-1">
                              {s.status === 'live' ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                  LIVE ({s.livekitParticipants} online)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400">
                                  Ended
                                </span>
                              )}
                              <p className="font-mono text-[11px] text-zinc-400">{s.room_name}</p>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {s.profiles?.avatar_url ? (
                                <Image
                                  src={s.profiles.avatar_url}
                                  alt={s.profiles.username}
                                  width={28}
                                  height={28}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-red-600/30 text-red-300 flex items-center justify-center font-bold text-xs">
                                  {(s.profiles?.username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-white block">
                                  {s.profiles?.display_name || s.profiles?.username || 'Unknown'}
                                </span>
                                <span className="text-[11px] text-zinc-500">@{s.profiles?.username || 'user'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <span className="font-medium text-white block truncate" title={s.title}>
                              {s.title}
                            </span>
                            {s.description && (
                              <span className="text-[11px] text-zinc-400 block truncate" title={s.description}>
                                {s.description}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <select
                              value={s.visibility}
                              onChange={(e) => handleUpdateStreamVisibility(s.id, e.target.value)}
                              className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:border-red-500"
                            >
                              <option value="public">Public</option>
                              <option value="unlisted">Unlisted</option>
                              <option value="private">Private</option>
                            </select>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            {s.started_at ? (
                              <div>
                                <span>{formatRelativeTime(s.started_at)}</span>
                                {s.ended_at && (
                                  <span className="block text-zinc-500">
                                    Duration: {formatDuration((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span>Not started</span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                            {s.status === 'live' && (
                              <>
                                <Link
                                  href={`/live/${s.id}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#272727] hover:bg-[#333333] text-zinc-200 rounded-lg transition-colors"
                                >
                                  <Play className="h-3 w-3" />
                                  <span>Watch</span>
                                </Link>

                                <button
                                  onClick={() =>
                                    setPendingAction({
                                      type: 'kill_stream',
                                      id: s.id,
                                      title: s.title,
                                      roomName: s.room_name,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-sm"
                                >
                                  <PowerOffIcon className="h-3 w-3" />
                                  <span>Kill Room</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() =>
                                setPendingAction({
                                  type: 'delete_stream',
                                  id: s.id,
                                  title: s.title,
                                })
                              }
                              title="Delete Stream Record"
                              className="inline-flex items-center p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: UPLOADED VIDEOS MANAGEMENT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'videos' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181818] border border-[#272727] p-4 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={videoSearch}
                    onChange={(e) => setVideoSearch(e.target.value)}
                    placeholder="Search by video title, uploader..."
                    className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <select
                  value={videoFilter}
                  onChange={(e) => setVideoFilter(e.target.value as 'all' | 'public' | 'unlisted' | 'private')}
                  className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Visibilities</option>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="text-xs text-zinc-400">
                Total Uploads: <span className="font-bold text-white">{filteredVideos.length}</span>
              </div>
            </div>

            {/* Video List Table */}
            {filteredVideos.length === 0 ? (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl p-12 text-center text-zinc-500 space-y-2">
                <Video className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No uploaded videos found</p>
                <p className="text-xs">Uploaded videos will appear here with full deletion and privacy control</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202020] text-zinc-400 uppercase tracking-wider text-[11px] border-b border-[#272727]">
                      <tr>
                        <th className="py-3 px-4">Video & Thumbnail</th>
                        <th className="py-3 px-4">Uploader</th>
                        <th className="py-3 px-4">Storage & Size</th>
                        <th className="py-3 px-4">Visibility</th>
                        <th className="py-3 px-4">Uploaded</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#272727]">
                      {filteredVideos.map((v) => (
                        <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative w-24 h-14 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-[#333333]">
                                {v.thumbnail_url ? (
                                  <Image
                                    src={v.thumbnail_url}
                                    alt={v.title}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                    <Video className="h-5 w-5" />
                                  </div>
                                )}
                                {v.duration && (
                                  <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                                    {formatDuration(v.duration)}
                                  </span>
                                )}
                              </div>
                              <div className="max-w-xs">
                                <span className="font-semibold text-white block truncate" title={v.title}>
                                  {v.title}
                                </span>
                                <span className="text-[11px] text-zinc-500 font-mono block truncate" title={v.id}>
                                  ID: {v.id.substring(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {v.profiles?.avatar_url ? (
                                <Image
                                  src={v.profiles.avatar_url}
                                  alt={v.profiles.username}
                                  width={24}
                                  height={24}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center font-bold text-[10px]">
                                  {(v.profiles?.username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-zinc-300">
                                @{v.profiles?.username || 'anonymous'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            <div>
                              <span className="font-semibold text-zinc-200">{formatFileSize(v.file_size)}</span>
                              <span className="block text-zinc-500 font-mono text-[10px] truncate max-w-[140px]" title={v.storage_path}>
                                {v.storage_path}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <select
                              value={v.visibility}
                              onChange={(e) => handleUpdateVideoVisibility(v.id, e.target.value)}
                              className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:border-red-500"
                            >
                              <option value="public">Public</option>
                              <option value="unlisted">Unlisted</option>
                              <option value="private">Private</option>
                            </select>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            {formatRelativeTime(v.created_at)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                            <Link
                              href={`/video/${v.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#272727] hover:bg-[#333333] text-zinc-200 rounded-lg transition-colors"
                            >
                              <Play className="h-3 w-3" />
                              <span>Watch</span>
                            </Link>

                            <button
                              onClick={() =>
                                setPendingAction({
                                  type: 'delete_video',
                                  id: v.id,
                                  title: v.title,
                                })
                              }
                              title="Delete Video & Storage Files"
                              className="inline-flex items-center p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: LIVE CHAT MODERATION */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'chats' && (
          <div className="space-y-4 animate-fade-in">
            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181818] border border-[#272727] p-4 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search chat messages or users..."
                    className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <select
                  value={selectedChatStream}
                  onChange={(e) => setSelectedChatStream(e.target.value)}
                  className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 max-w-[200px]"
                >
                  <option value="all">All Live Streams</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedChatStream !== 'all' && (
                <button
                  onClick={() =>
                    setPendingAction({
                      type: 'purge_chats',
                      id: selectedChatStream,
                      title: streams.find((s) => s.id === selectedChatStream)?.title || 'Selected Stream',
                    })
                  }
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge Stream Chat</span>
                </button>
              )}
            </div>

            {/* Chat Messages List */}
            {filteredChats.length === 0 ? (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl p-12 text-center text-zinc-500 space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No chat messages found</p>
                <p className="text-xs">Live chat messages sent during broadcasts will appear here for moderation</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-xl">
                <div className="divide-y divide-[#272727]">
                  {filteredChats.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 hover:bg-white/[0.02] transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        {c.profiles?.avatar_url ? (
                          <Image
                            src={c.profiles.avatar_url}
                            alt={c.profiles.username}
                            width={32}
                            height={32}
                            className="rounded-full object-cover mt-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center font-bold text-xs mt-0.5">
                            {(c.profiles?.username || 'U')[0].toUpperCase()}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-xs text-white">
                              {c.profiles?.display_name || c.profiles?.username || 'Anonymous'}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              @{c.profiles?.username || 'user'}
                            </span>
                            <span className="text-[10px] text-zinc-500">• {formatRelativeTime(c.created_at)}</span>
                            {c.live_streams && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                                in: {c.live_streams.title}
                              </span>
                            )}
                            {(c.paid_emoji || (c.coins_paid && c.coins_paid > 0)) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
                                {c.paid_emoji && <span className="text-sm">{c.paid_emoji}</span>}
                                <span>🪙 {c.coins_paid || 0} Coins Paid</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {c.paid_emoji && (
                              <span className="text-2xl filter drop-shadow shrink-0 select-none">
                                {c.paid_emoji}
                              </span>
                            )}
                            <p className={`text-sm break-words ${c.paid_emoji ? 'text-amber-200 font-semibold' : 'text-zinc-200'}`}>
                              {c.message}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setPendingAction({
                            type: 'delete_chat',
                            id: c.id,
                            title: `"${c.message.substring(0, 30)}..."`,
                          })
                        }
                        title="Delete this message"
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: ECONOMY & FLOW SETTINGS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in">
            {/* PLATFORM COIN ECONOMICS CONTROLS (REQUESTED BY USER) */}
            <form onSubmit={handleSaveSettings} className="bg-[#181818] border border-[#272727] rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#272727]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-400" />
                    <span>Live Chat Pricing & Coin Economics</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Control how coins are gifted on signup, how viewers pay per chat, and what percent streamers earn.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  {isSavingSettings ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Save Economics Policy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sign-up Coin Bonus */}
                <div className="bg-[#121212] border border-[#2c2c2c] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Sign-Up Bonus
                    </span>
                    <span className="text-base">🎁</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Coins automatically deposited into every newly created user wallet upon sign up.
                  </p>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Bonus Coins Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={settingsForm.signup_coin_bonus}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            signup_coin_bonus: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full bg-[#181818] border border-[#333] rounded-xl px-3 py-2 text-sm font-bold text-white pl-8 focus:outline-none focus:border-amber-400"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">🪙</span>
                    </div>
                  </div>
                </div>

                {/* Per-Chat Cost */}
                <div className="bg-[#121212] border border-[#2c2c2c] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      Live Chat Charge
                    </span>
                    <span className="text-base">💬</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Coins charged from a viewer's wallet for every message sent in live stream chat. (0 for free chat)
                  </p>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Cost Per Message</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={settingsForm.chat_cost_per_message}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            chat_cost_per_message: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full bg-[#181818] border border-[#333] rounded-xl px-3 py-2 text-sm font-bold text-white pl-8 focus:outline-none focus:border-blue-400"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">🪙</span>
                    </div>
                  </div>
                </div>

                {/* Streamer Revenue Share % */}
                <div className="bg-[#121212] border border-[#2c2c2c] rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Streamer Revenue %
                    </span>
                    <span className="text-base">📈</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Percentage of the chat fee that gets credited directly to the live streamer's wallet.
                  </p>
                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Broadcaster Allocation (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settingsForm.streamer_revenue_percent}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            streamer_revenue_percent: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                          })
                        }
                        className="w-full bg-[#181818] border border-[#333] rounded-xl px-3 py-2 text-sm font-bold text-white pr-8 focus:outline-none focus:border-emerald-400"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Calculation */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>
                    <strong>Economic Simulation:</strong> A viewer posts 1 chat message → Viewer pays{' '}
                    <strong className="text-amber-400">🪙 {settingsForm.chat_cost_per_message} coins</strong> → Streamer receives{' '}
                    <strong className="text-emerald-400">
                      🪙 {Math.floor(settingsForm.chat_cost_per_message * (settingsForm.streamer_revenue_percent / 100))} coins
                    </strong>{' '}
                    ({settingsForm.streamer_revenue_percent}%).
                  </span>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* PAID CHAT EMOJIS (SUPER STICKERS) MANAGER */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-6 border-t border-[#272727] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>Live Stream Paid Chat Emojis (Super Stickers)</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configure custom coin prices for each interactive emoji in live chat. Broadcasters earn{' '}
                      <strong className="text-emerald-400">{settingsForm.streamer_revenue_percent}%</strong> of every sticker sent.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetEmojis}
                    className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 underline self-start sm:self-auto"
                  >
                    Reset to Defaults
                  </button>
                </div>

                {/* Add New Emoji Row */}
                <div className="bg-[#121212] border border-[#2c2c2c] rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                    <span>Add or Update Paid Emoji</span>
                  </div>

                  {/* Preset quick picks */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-zinc-500 mr-1">Quick Picks:</span>
                    {['❤️', '🔥', '👏', '🎉', '💎', '🚀', '👑', '⚡', '🌟', '🏆', '💯', '💰', '🦄', '🎯', '🍕', '🎮', '🥳', '😎'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setNewEmojiInput(em)}
                        className={`text-base p-1.5 rounded-lg border transition-transform hover:scale-110 ${
                          newEmojiInput === em
                            ? 'bg-amber-500/20 border-amber-500/50'
                            : 'bg-[#181818] border-[#2e2e2e] hover:border-zinc-500'
                        }`}
                        title={`Select ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <div className="flex-1 w-full sm:w-auto">
                      <label className="text-[11px] text-zinc-500 block mb-1">Emoji Character</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. ⚡ or 🏆"
                        value={newEmojiInput}
                        onChange={(e) => setNewEmojiInput(e.target.value)}
                        className="w-full bg-[#181818] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 text-center font-emoji"
                      />
                    </div>

                    <div className="w-full sm:w-44">
                      <label className="text-[11px] text-zinc-500 block mb-1">Coin Cost</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          value={newEmojiCost}
                          onChange={(e) => setNewEmojiCost(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-[#181818] border border-[#333] rounded-xl px-3 py-2 text-sm font-bold text-white pl-8 focus:outline-none focus:border-amber-400"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">🪙</span>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto pt-5">
                      <button
                        type="button"
                        onClick={handleAddEmoji}
                        disabled={!newEmojiInput.trim()}
                        className="w-full sm:w-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add / Update Sticker</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Configured Emojis Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(settingsForm.paid_chat_emojis || DEFAULT_PAID_EMOJIS).map((item) => (
                    <div
                      key={item.emoji}
                      className="bg-[#121212] border border-[#2a2a2a] hover:border-zinc-700 rounded-2xl p-3.5 flex flex-col items-center gap-2 relative group transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteEmoji(item.emoji)}
                        title={`Delete ${item.emoji}`}
                        className="absolute top-2 right-2 p-1 text-zinc-600 hover:text-red-400 opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <div className="text-3xl pt-1 select-none transform group-hover:scale-110 transition-transform">
                        {item.emoji}
                      </div>

                      <div className="w-full space-y-1">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block text-center font-semibold">
                          Coins
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="100000"
                            value={item.cost}
                            onChange={(e) =>
                              handleUpdateEmojiCost(item.emoji, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-full bg-[#181818] border border-[#333] focus:border-amber-400 rounded-xl py-1 px-2 pl-6 text-xs font-bold text-amber-300 text-center focus:outline-none"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px]">🪙</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-500 font-mono">
                        Broadcaster: +{Math.floor(item.cost * (settingsForm.streamer_revenue_percent / 100))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Serverless Infrastructure Config */}
            <div className="bg-[#181818] border border-[#272727] rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-red-500" />
                <span>StreamFlow Serverless Configuration</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#121212] border border-[#2c2c2c] space-y-3">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">
                    Admin Portal Authentication
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#222]">
                      <span className="text-zinc-500">Security Model</span>
                      <span className="font-semibold text-emerald-400">HTTP-Only Signed Session Token</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#222]">
                      <span className="text-zinc-500">Credentials Origin</span>
                      <span className="font-mono text-zinc-300">Environment Variables (Encrypted)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#222]">
                      <span className="text-zinc-500">Session Status</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active Authenticated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#121212] border border-[#2c2c2c] space-y-3">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                    LiveKit Cloud WebRTC
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#222]">
                      <span className="text-zinc-500">Cloud URL</span>
                      <span className="font-mono text-white">wss://stream-flow-8560l64p.livekit.cloud</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#222]">
                      <span className="text-zinc-500">Protocol</span>
                      <span className="font-semibold text-emerald-400">WebRTC (Ultra Low Latency)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: TOP-UP REQUESTS & UPI CONFIGURATION */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'topups' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top KPI Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Pending Requests
                  </span>
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Clock className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400">{pendingTopupsCount}</span>
                  <span className="text-xs text-zinc-500">awaiting review</span>
                </div>
              </div>

              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Total Approved Coins
                  </span>
                  <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Coins className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">🪙 {totalTopupCoins}</span>
                  <span className="text-xs text-emerald-400">credited</span>
                </div>
              </div>

              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Top-Up Volume (INR)
                  </span>
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <CreditCard className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">₹{totalTopupInr}</span>
                  <span className="text-xs text-zinc-500">verified</span>
                </div>
              </div>

              <div className="bg-[#181818] border border-[#272727] p-5 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Exchange Rate
                  </span>
                  <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Percent className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-white">1 Coin = ₹{upiSettings.coin_price_inr}</span>
                </div>
              </div>
            </div>

            {/* UPI & Exchange Rate Configuration Form (Editable by Admin) */}
            <form
              onSubmit={handleSaveUpiSettings}
              className="bg-[#181818] border border-[#272727] rounded-2xl p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#272727]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-amber-400" />
                    <span>Admin UPI Payment Gateway Settings</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    This UPI ID and coin exchange rate are displayed to all normal users when requesting a wallet top-up.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSavingUpiSettings}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  {isSavingUpiSettings ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save UPI Settings</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Admin UPI ID (VPA Address)
                  </label>
                  <input
                    type="text"
                    required
                    value={upiForm.admin_upi_id}
                    onChange={(e) => setUpiForm((prev) => ({ ...prev, admin_upi_id: e.target.value }))}
                    placeholder="e.g. streamflow@upi"
                    className="w-full bg-[#121212] border border-[#2f2f2f] focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Users will transfer INR to this UPI ID.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Payee Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={upiForm.admin_upi_name}
                    onChange={(e) => setUpiForm((prev) => ({ ...prev, admin_upi_name: e.target.value }))}
                    placeholder="e.g. StreamFlow Official"
                    className="w-full bg-[#121212] border border-[#2f2f2f] focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Shown inside user&apos;s UPI app (GPay, PhonePe, Paytm).
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Coin Exchange Rate (1 Coin = ? INR)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={upiForm.coin_price_inr}
                      onChange={(e) =>
                        setUpiForm((prev) => ({
                          ...prev,
                          coin_price_inr: parseFloat(e.target.value) || 1,
                        }))
                      }
                      className="w-full bg-[#121212] border border-[#2f2f2f] focus:border-red-500 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-bold"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">₹</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    e.g. 1 means 100 coins = ₹100 INR.
                  </span>
                </div>
              </div>
            </form>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181818] border border-[#272727] p-4 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={topupSearch}
                    onChange={(e) => setTopupSearch(e.target.value)}
                    placeholder="Search by username or UTR reference..."
                    className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <select
                  value={topupFilter}
                  onChange={(e) =>
                    setTopupFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')
                  }
                  className="bg-[#121212] border border-[#2c2c2c] text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Statuses ({topupRequests.length})</option>
                  <option value="pending">Pending ({pendingTopupsCount})</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Declined</option>
                </select>
              </div>

              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span>Matching Requests: <strong className="text-white">{filteredTopups.length}</strong></span>
              </div>
            </div>

            {/* Topup Requests Table */}
            {filteredTopups.length === 0 ? (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl p-12 text-center text-zinc-500 space-y-2">
                <CreditCard className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No top-up requests found</p>
                <p className="text-xs">User submitted UPI top-ups with UTR numbers will appear here for verification</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202020] text-zinc-400 uppercase tracking-wider text-[11px] border-b border-[#272727]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Coins Requested</th>
                        <th className="py-3 px-4">Amount (INR)</th>
                        <th className="py-3 px-4">UTR Reference</th>
                        <th className="py-3 px-4">Submitted</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#272727]">
                      {filteredTopups.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* User */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {r.profiles?.avatar_url ? (
                                <Image
                                  src={r.profiles.avatar_url}
                                  alt={r.profiles.username}
                                  width={32}
                                  height={32}
                                  className="rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center font-bold text-xs text-black shrink-0">
                                  {(r.profiles?.username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-white block">
                                  {r.profiles?.display_name || r.profiles?.username || 'User'}
                                </span>
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                  <span>@{r.profiles?.username || 'user'}</span>
                                  <span>•</span>
                                  <span className="text-amber-400 font-bold">🪙 {r.profiles?.coin_balance ?? 0}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Coins */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-extrabold text-xs">
                              <span>🪙</span>
                              <span>{r.coins} Coins</span>
                            </span>
                          </td>

                          {/* Amount INR */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-white text-xs">
                              ₹{r.amount_inr} INR
                            </span>
                          </td>

                          {/* UTR */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono text-zinc-300">
                              <span className="bg-[#121212] px-2 py-1 rounded-lg border border-[#2e2e2e] select-all">
                                {r.utr_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.utr_number)
                                  setCopiedUtr(r.utr_number)
                                  setTimeout(() => setCopiedUtr(null), 2000)
                                }}
                                title="Copy UTR to clipboard"
                                className="p-1 hover:text-white text-zinc-500 transition-colors"
                              >
                                {copiedUtr === r.utr_number ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Submitted */}
                          <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                            {formatRelativeTime(r.created_at)}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            {r.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                                <Clock className="h-3 w-3 animate-pulse" />
                                <span>Pending</span>
                              </span>
                            )}
                            {r.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Approved</span>
                              </span>
                            )}
                            {r.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[11px] font-bold" title={r.admin_notes || ''}>
                                <XCircle className="h-3 w-3" />
                                <span>Declined</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 whitespace-nowrap text-right space-x-2">
                            {r.status === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={processingTopupId === r.id}
                                  onClick={() => handleApproveTopup(r.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {processingTopupId === r.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  <span>Approve & Credit</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={processingTopupId === r.id}
                                  onClick={() => {
                                    setDecliningRequest(r)
                                    setDeclineReasonInput('Payment verification failed / Invalid UTR')
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl transition-colors disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Decline</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-zinc-500 italic">
                                {r.admin_notes || (r.status === 'approved' ? 'Coins Credited' : 'Declined')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DECLINE TOP-UP MODAL */}
      {/* ------------------------------------------------------------- */}
      {decliningRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Decline Top-Up Request</h4>
                  <p className="text-xs text-zinc-400">
                    User: <strong className="text-white">@{decliningRequest.profiles?.username || 'user'}</strong> (UTR: {decliningRequest.utr_number})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDecliningRequest(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Reason for Decline
                </label>
                <input
                  type="text"
                  value={declineReasonInput}
                  onChange={(e) => setDeclineReasonInput(e.target.value)}
                  placeholder="e.g. Invalid UTR or payment not received"
                  className="w-full bg-[#121212] border border-[#333] focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDecliningRequest(null)}
                  className="px-4 py-2 text-xs font-semibold bg-[#242424] hover:bg-[#2c2c2c] text-zinc-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingTopupId === decliningRequest.id}
                  onClick={() => handleDeclineTopup(decliningRequest.id, declineReasonInput)}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {processingTopupId === decliningRequest.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  <span>Confirm Decline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MANAGE USER COINS MODAL */}
      {/* ------------------------------------------------------------- */}
      {managingCoinsUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Manage User Wallet Coins</h4>
                  <p className="text-xs text-zinc-400">
                    Target: <strong className="text-white">@{managingCoinsUser.username}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCoinsUser(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Balance Display */}
            <div className="p-3 bg-[#121212] border border-[#272727] rounded-xl flex items-center justify-between text-xs">
              <span className="text-zinc-400">Current Wallet Balance:</span>
              <span className="text-base font-bold text-amber-400">
                🪙 {managingCoinsUser.coin_balance ?? 0} Coins
              </span>
            </div>

            {/* Action Type Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCoinActionType('add')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  coinActionType === 'add'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#141414] border-[#292929] text-zinc-400 hover:text-white'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Coins</span>
              </button>

              <button
                type="button"
                onClick={() => setCoinActionType('remove')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  coinActionType === 'remove'
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-[#141414] border-[#292929] text-zinc-400 hover:text-white'
                }`}
              >
                <Minus className="h-3.5 w-3.5" />
                <span>Deduct</span>
              </button>

              <button
                type="button"
                onClick={() => setCoinActionType('set')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                  coinActionType === 'set'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'bg-[#141414] border-[#292929] text-zinc-400 hover:text-white'
                }`}
              >
                <span>Set Exact</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[10, 50, 100, 250, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCoinAmount(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                    coinAmount === preset
                      ? 'bg-amber-500 text-black'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {coinActionType === 'remove' ? `-${preset}` : `+${preset}`}
                </button>
              ))}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Coin Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-sm text-white pl-8 focus:outline-none focus:border-amber-400"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">🪙</span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Community award, Compensation, Adjustment"
                value={coinReason}
                onChange={(e) => setCoinReason(e.target.value)}
                className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#272727]">
              <button
                type="button"
                disabled={isSubmittingCoins}
                onClick={() => setManagingCoinsUser(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-[#222] hover:bg-[#282828] rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingCoins}
                onClick={handleSaveCoins}
                className="px-4 py-2 text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingCoins ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Coins className="h-3.5 w-3.5" />
                    <span>Confirm Wallet Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-600/20 text-red-500 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirm Admin Action</h4>
                <p className="text-xs text-zinc-400">This action has immediate effects on live viewers</p>
              </div>
            </div>

            <div className="p-3 bg-[#121212] border border-[#272727] rounded-xl text-xs text-zinc-300">
              {pendingAction.type === 'kill_stream' && (
                <span>
                  Are you sure you want to forcibly terminate live room{' '}
                  <strong className="text-white">{pendingAction.roomName}</strong>? This will immediately disconnect
                  all broadcast tracks and live viewers.
                </span>
              )}
              {pendingAction.type === 'delete_stream' && (
                <span>
                  Are you sure you want to delete stream <strong className="text-white">{pendingAction.title}</strong>{' '}
                  and all associated chat logs permanently?
                </span>
              )}
              {pendingAction.type === 'delete_video' && (
                <span>
                  Are you sure you want to permanently delete video{' '}
                  <strong className="text-white">{pendingAction.title}</strong>? Both the database record and storage
                  video files will be wiped.
                </span>
              )}
              {pendingAction.type === 'purge_chats' && (
                <span>
                  Are you sure you want to purge all chat messages for{' '}
                  <strong className="text-white">{pendingAction.title}</strong>?
                </span>
              )}
              {pendingAction.type === 'delete_chat' && (
                <span>
                  Are you sure you want to delete message: <strong className="text-white">{pendingAction.title}</strong>?
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isExecutingAction}
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-[#222] hover:bg-[#282828] rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isExecutingAction}
                onClick={() => {
                  if (pendingAction.type === 'kill_stream') {
                    handleKillStream(pendingAction.id, pendingAction.roomName || '')
                  } else if (pendingAction.type === 'delete_stream') {
                    handleDeleteStream(pendingAction.id)
                  } else if (pendingAction.type === 'delete_video') {
                    handleDeleteVideo(pendingAction.id)
                  } else if (pendingAction.type === 'purge_chats') {
                    handlePurgeStreamChats(pendingAction.id)
                  } else if (pendingAction.type === 'delete_chat') {
                    handleDeleteChat(pendingAction.id)
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-lg shadow-red-600/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isExecutingAction ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <span>Execute Action</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PowerOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  )
}
