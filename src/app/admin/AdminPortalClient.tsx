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
} from 'lucide-react'
import { formatFileSize, formatRelativeTime, formatDuration } from '@/lib/utils'

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

type TabType = 'overview' | 'streams' | 'videos' | 'chats' | 'settings'

export default function AdminPortalClient() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [commonCredentials, setCommonCredentials] = useState<{ username: string; password: string }>({
    username: 'admin',
    password: 'admin123',
  })

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [streams, setStreams] = useState<AdminStream[]>([])
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [chats, setChats] = useState<AdminChat[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filters
  const [streamFilter, setStreamFilter] = useState<'all' | 'live' | 'ended'>('all')
  const [streamSearch, setStreamSearch] = useState('')
  const [videoFilter, setVideoFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all')
  const [videoSearch, setVideoSearch] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [selectedChatStream, setSelectedChatStream] = useState<string>('all')

  // Modals / Action Confirmations
  const [pendingAction, setPendingAction] = useState<{
    type: 'kill_stream' | 'delete_stream' | 'delete_video' | 'purge_chats' | 'delete_chat'
    id: string
    title?: string
    roomName?: string
  } | null>(null)
  const [isExecutingAction, setIsExecutingAction] = useState(false)

  // Check auth status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth')
        const data = await res.json()
        if (data.commonCredentials) {
          setCommonCredentials(data.commonCredentials)
        }
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

      // 2. Fetch Streams
      const streamsRes = await fetch('/api/admin/streams')
      if (streamsRes.ok) {
        const streamsData = await streamsRes.json()
        setStreams(streamsData.streams || [])
      }

      // 3. Fetch Videos
      const videosRes = await fetch('/api/admin/videos')
      if (videosRes.ok) {
        const videosData = await videosRes.json()
        setVideos(videosData.videos || [])
      }

      // 4. Fetch Chats
      const chatsRes = await fetch('/api/admin/chats')
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json()
        setChats(chatsData.messages || [])
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

  // Loading initial state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10 space-y-6">
          {/* Header Brand */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl mb-2">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">StreamFlow Admin Portal</h1>
            <p className="text-xs text-zinc-400">
              Next.js Vercel Serverless Architecture • Full Stream Flow & Upload Control
            </p>
          </div>

          {/* Common Admin Credentials Display Card (Requested Feature) */}
          <div className="bg-zinc-900/90 border border-red-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-red-500/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-3">
              <Key className="h-4 w-4 text-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                Common Admin Credentials
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-black/40 border border-zinc-800 rounded-xl p-2.5">
                <span className="text-zinc-500 block mb-0.5">Username</span>
                <span className="font-mono font-semibold text-white select-all text-sm">
                  {commonCredentials.username}
                </span>
              </div>
              <div className="bg-black/40 border border-zinc-800 rounded-xl p-2.5">
                <span className="text-zinc-500 block mb-0.5">Password</span>
                <span className="font-mono font-semibold text-white select-all text-sm">
                  {commonCredentials.password}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsernameInput(commonCredentials.username)
                  setPasswordInput(commonCredentials.password)
                }}
                className="flex-1 py-2 px-3 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors border border-zinc-700"
              >
                Fill Credentials
              </button>

              <button
                type="button"
                disabled={isSubmittingAuth}
                onClick={() => handleLogin(undefined, commonCredentials.username, commonCredentials.password)}
                className="flex-1 py-2 px-3 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>1-Click Auto Login</span>
              </button>
            </div>
          </div>

          {/* Manual Login Form */}
          <form
            onSubmit={(e) => handleLogin(e)}
            className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4"
          >
            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Admin Username</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter admin username"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Admin Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white pr-10 focus:outline-none focus:border-red-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-xl text-sm transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmittingAuth ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Sign In to Admin Portal</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                ← Return to StreamFlow Public Website
              </Link>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW: MAIN ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 flex flex-col font-sans">
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
              <span className="text-[10px] text-zinc-400 hidden sm:block">Vercel Serverless Stream Flow Control</span>
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

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#1f1f1f]'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Flow Settings</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-xs text-zinc-500 mt-2">Stored securely in Supabase Storage</p>
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
                <p className="text-xs text-zinc-500 mt-2">WebRTC DataChannel + PostgreSQL</p>
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
                  <span className="text-3xl font-extrabold text-white">{stats?.totalProfiles ?? 0}</span>
                  <span className="text-xs text-zinc-400">Creators</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Authenticated creators & viewers</p>
              </div>
            </div>

            {/* Quick Stream Flow Actions Panel */}
            <div className="bg-[#181818] border border-[#272727] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Quick Stream Flow Management</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Execute serverless stream flow operations with immediate real-time effect
                  </p>
                </div>

                <button
                  onClick={handlePurgeGhostStreams}
                  disabled={isLoadingData}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>Sync & Prune Ghost Streams</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <Link
                  href="/go-live"
                  target="_blank"
                  className="p-4 rounded-xl bg-[#222222] hover:bg-[#282828] border border-[#303030] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Launch Go Live Studio</span>
                      <span className="text-xs text-zinc-400">Broadcast camera & mic</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                </Link>

                <Link
                  href="/upload"
                  target="_blank"
                  className="p-4 rounded-xl bg-[#222222] hover:bg-[#282828] border border-[#303030] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                      <Video className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Upload New Video</span>
                      <span className="text-xs text-zinc-400">Direct Supabase Storage upload</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                </Link>

                <button
                  onClick={() => setActiveTab('streams')}
                  className="p-4 rounded-xl bg-[#222222] hover:bg-[#282828] border border-[#303030] transition-colors flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                      <Sliders className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Manage Live Rooms</span>
                      <span className="text-xs text-zinc-400">Force end or alter visibility</span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>

            {/* Cloud Architecture Diagnostics */}
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
                    <span className="text-zinc-500">Storage Buckets</span>
                    <span className="font-semibold text-white">videos, thumbnails</span>
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
        {/* TAB 2: LIVE STREAMS MANAGEMENT */}
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
        {/* TAB 3: UPLOADED VIDEOS MANAGEMENT */}
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
        {/* TAB 4: LIVE CHAT MODERATION */}
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
                          <div className="flex items-center gap-2">
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
                          </div>
                          <p className="text-sm text-zinc-200 break-words">{c.message}</p>
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
        {/* TAB 5: FLOW SETTINGS & CREDENTIAL CONFIG */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="bg-[#181818] border border-[#272727] rounded-2xl p-6 space-y-6 animate-fade-in">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-red-500" />
                <span>StreamFlow Serverless Configuration</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Zero backend required. Powered entirely by Next.js Serverless Edge Functions, LiveKit Cloud, and Supabase.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#121212] border border-[#2c2c2c] space-y-3">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">
                  Admin Credentials
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#222]">
                    <span className="text-zinc-500">Configured Username</span>
                    <span className="font-mono text-white">{commonCredentials.username}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#222]">
                    <span className="text-zinc-500">Configured Password</span>
                    <span className="font-mono text-zinc-400">•••••••••• ({commonCredentials.password})</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Override via Env</span>
                    <span className="font-mono text-zinc-400">ADMIN_USERNAME / ADMIN_PASSWORD</span>
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
                    <span className="text-zinc-500">API Key</span>
                    <span className="font-mono text-zinc-400">APID9m8XgypZbA4</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Streaming Protocol</span>
                    <span className="font-semibold text-emerald-400">WebRTC (Sub-100ms Ultra Low Latency)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block mb-0.5">Vercel Deployment Compatibility</span>
                <span>
                  This admin suite utilizes Next.js App Router Server Route Handlers with Supabase service-role client.
                  It requires zero persistent server daemons, docker containers, or external backends to run in production.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
