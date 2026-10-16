'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  Participant,
  ConnectionState,
} from 'livekit-client'
import {
  Radio,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  RefreshCw,
  ArrowLeft,
  Users,
} from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import type { LiveStreamRow, ProfileRow } from '@/types/database'
import { LiveChat } from '@/components/live/LiveChat'

interface LivePlayerClientProps {
  initialStream?: (LiveStreamRow & { profiles?: ProfileRow | null }) | null
  streamId: string
}

export function LivePlayerClient({ initialStream, streamId }: LivePlayerClientProps) {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [stream, setStream] = useState<LiveStreamRow & { profiles?: ProfileRow | null } | null>(
    initialStream || null
  )
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEnded, setIsEnded] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  // Player controls
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [viewerCount, setViewerCount] = useState(1)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const roomRef = useRef<Room | null>(null)

  // Load stream metadata
  const loadStream = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${streamId}`)
      const data = await res.json()

      if (!res.ok || !data.data) {
        if (res.status === 403) {
          setIsPrivate(true)
          throw new Error('This live stream is private.')
        }
        if (res.status === 404) {
          throw new Error('Live stream not found.')
        }
        throw new Error(data.error || 'Failed to load live stream.')
      }

      const streamData = data.data
      setStream(streamData)

      if (streamData.status === 'ended') {
        setIsEnded(true)
        setIsLoading(false)
        return null
      }

      return streamData
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching live stream'
      setError(msg)
      setIsLoading(false)
      return null
    }
  }, [streamId])

  // Join Room as Subscribe-Only Viewer
  const joinStream = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      const currentStream = await loadStream()
      if (!currentStream) return

      if (currentStream.status === 'ended') {
        setIsEnded(true)
        setIsLoading(false)
        return
      }

      // 1. Fetch Viewer Token from API (with Supabase Edge Function fallback)
      let tokenData: { token: string; livekitUrl?: string; status?: string } | null = null
      try {
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId,
            action: 'view',
          }),
        })

        const resJson = await tokenRes.json()
        if (tokenRes.ok && resJson.token) {
          tokenData = resJson
        } else {
          if (resJson.status === 'ended') {
            setIsEnded(true)
            setIsLoading(false)
            return
          }
          throw new Error(resJson.error || 'Server token error')
        }
      } catch (apiErr: unknown) {
        // Fallback directly to deployed Supabase Edge Function livekit-token
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            streamId,
            action: 'view',
          }),
        })

        const edgeJson = await edgeRes.json()
        if (edgeRes.ok && edgeJson.token) {
          tokenData = edgeJson
        } else {
          if (edgeJson.status === 'ended') {
            setIsEnded(true)
            setIsLoading(false)
            return
          }
          const errMsg = edgeJson?.error || (apiErr instanceof Error ? apiErr.message : 'Failed to obtain access token.')
          throw new Error(errMsg)
        }
      }

      if (!tokenData || !tokenData.token) {
        throw new Error('Failed to obtain access token.')
      }

      const livekitUrl = tokenData.livekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-flow-8560l64p.livekit.cloud'

      // 2. Disconnect existing room if any
      if (roomRef.current) {
        roomRef.current.disconnect()
      }

      // 3. Create LiveKit Room instance (Viewer)
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })
      roomRef.current = room

      // Setup Event Listeners
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(state)
        if (state === ConnectionState.Connected) {
          setIsLoading(false)
          setHasStarted(true)
        }
      })

      // When Broadcaster's Track is Subscribed
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: Participant) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current)
          } else if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current)
          }
        }
      )

      // When Track is Unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: Participant) => {
          track.detach()
        }
      )

      // When Broadcaster disconnects or Room Closes
      room.on(RoomEvent.Disconnected, () => {
        setIsEnded(true)
      })

      // Update viewer count
      room.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(room.numParticipants)
      })
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(Math.max(1, room.numParticipants))
      })

      // 4. Connect to Room
      await room.connect(livekitUrl, tokenData.token)
      setViewerCount(Math.max(1, room.numParticipants))
    } catch (err: unknown) {
      console.error('Failed to join live stream:', err)
      setIsLoading(false)
      const message = err instanceof Error ? err.message : 'Failed to connect to live stream.'
      setError(message)
    }
  }, [streamId, loadStream])

  useEffect(() => {
    joinStream()

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
    }
  }, [joinStream])

  // Volume control
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol)
    setIsMuted(newVol === 0)
    if (audioRef.current) {
      audioRef.current.volume = newVol
      audioRef.current.muted = newVol === 0
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (isMuted) {
      const restoredVol = volume === 0 ? 1 : volume
      setVolume(restoredVol)
      setIsMuted(false)
      if (audioRef.current) {
        audioRef.current.muted = false
        audioRef.current.volume = restoredVol
      }
    } else {
      setIsMuted(true)
      if (audioRef.current) {
        audioRef.current.muted = true
      }
    }
  }

  // Fullscreen control
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Fullscreen request failed:', err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Exit fullscreen failed:', err)
      })
      setIsFullscreen(false)
    }
  }

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Copy share URL
  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    addToast('Live stream URL copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const broadcasterProfile = stream?.profiles
  const isBroadcaster = user && stream && user.id === stream.user_id

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0f0f0f] text-[#f1f1f1] px-4 py-6 max-w-7xl mx-auto">
      {/* Back Link */}
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Player Column (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Responsive 16:9 Live Video Player Container */}
          <div
            ref={containerRef}
            className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-[#272727] shadow-2xl flex items-center justify-center group select-none"
          >
            {/* Native Video Element for Broadcaster Track */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />

            {/* Native Audio Element for Broadcaster Track */}
            <audio ref={audioRef} autoPlay />

            {/* Loading State */}
            {isLoading && !isEnded && !error && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-3 z-20">
                <Loader2 className="h-10 w-10 animate-spin text-red-500" />
                <p className="text-xs font-medium text-zinc-300">Connecting to live stream...</p>
              </div>
            )}

            {/* Reconnecting State */}
            {connectionState === ConnectionState.Reconnecting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-1.5 bg-amber-500/90 text-black text-xs font-bold rounded-full shadow-lg">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Reconnecting live broadcast...</span>
              </div>
            )}

            {/* Stream Ended State */}
            {isEnded && (
              <div className="absolute inset-0 bg-[#121212] flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Radio className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white">Live Stream Ended</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  This live broadcast has concluded. Thank you for tuning in!
                </p>
                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold transition-colors"
                  >
                    Explore More Content
                  </Link>
                </div>
              </div>
            )}

            {/* Stream Private State */}
            {isPrivate && (
              <div className="absolute inset-0 bg-[#121212] flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Lock className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-white">Private Stream</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  This broadcast is private and can only be accessed by its owner.
                </p>
                <Link
                  href="/"
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#272727] text-white text-xs font-semibold"
                >
                  Return to Home
                </Link>
              </div>
            )}

            {/* Error State */}
            {error && !isEnded && !isPrivate && (
              <div className="absolute inset-0 bg-[#121212] flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
                <AlertCircle className="h-10 w-10 text-rose-500" />
                <h3 className="text-lg font-bold text-white">Playback Error</h3>
                <p className="text-xs text-zinc-400 max-w-sm">{error}</p>
                <button
                  type="button"
                  onClick={joinStream}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Stream</span>
                </button>
              </div>
            )}

            {/* LIVE Badge (Top Left) */}
            {!isEnded && connectionState === ConnectionState.Connected && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1 bg-red-600/95 backdrop-blur-md rounded-md text-white text-xs font-bold tracking-wider uppercase shadow-md">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE
              </div>
            )}

            {/* Viewers Counter (Top Right) */}
            {!isEnded && connectionState === ConnectionState.Connected && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-md text-zinc-200 text-xs font-medium">
                <Eye className="h-3.5 w-3.5 text-zinc-400" />
                <span>{viewerCount} watching</span>
              </div>
            )}

            {/* Player Controls Overlay (Bottom) */}
            {!isEnded && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  {/* Mute/Volume Toggle */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-white hover:text-red-500 transition-colors"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>

                  {/* Volume Slider */}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 accent-red-600 cursor-pointer h-1.5 rounded-lg bg-zinc-700"
                    aria-label="Volume slider"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="text-white hover:text-red-500 transition-colors"
                    aria-label="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stream Metadata & Creator Header */}
          <div className="space-y-4 pt-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {stream?.title || 'Live Broadcast'}
            </h1>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#272727] gap-3">
              {/* Broadcaster Profile */}
              <div className="flex items-center gap-3">
                <Link href={stream ? `/profile/${stream.user_id}` : '#'}>
                  {broadcasterProfile?.avatar_url ? (
                    <img
                      src={broadcasterProfile.avatar_url}
                      alt={broadcasterProfile.display_name || 'Broadcaster'}
                      className="w-11 h-11 rounded-full object-cover ring-1 ring-zinc-700 hover:ring-zinc-500 transition-all shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white font-bold uppercase shrink-0">
                      {(broadcasterProfile?.display_name || 'C').charAt(0)}
                    </div>
                  )}
                </Link>

                <div>
                  <Link
                    href={stream ? `/profile/${stream.user_id}` : '#'}
                    className="font-semibold text-white hover:underline text-sm block"
                  >
                    {broadcasterProfile?.display_name || 'Broadcaster'}
                  </Link>
                  <p className="text-xs text-zinc-400">
                    @{broadcasterProfile?.username || 'creator'}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Share & Broadcaster Studio Link */}
              <div className="flex items-center gap-2">
                {isBroadcaster && (
                  <Link
                    href="/go-live"
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full transition-colors shadow-md"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Manage Broadcast</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleCopyShare}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium rounded-full transition-colors"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Share'}</span>
                </button>
              </div>
            </div>

            {/* Description Box */}
            {stream?.description && (
              <div className="p-4 bg-[#181818] rounded-2xl border border-[#272727] text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {stream.description}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column: Live Chat & Stream Details (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* YouTube-Style Live Chat */}
          <LiveChat
            streamId={streamId}
            room={roomRef.current}
            broadcasterId={stream?.user_id || ''}
            className="h-[520px]"
          />

          {/* Broadcast Details Card */}
          <div className="p-4 bg-[#181818] border border-[#272727] rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500">
              <Radio className="h-4 w-4" />
              <span>Broadcast Details</span>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex justify-between py-1 border-b border-[#272727]">
                <span className="text-zinc-500">Status</span>
                <span className={`font-semibold capitalize ${isEnded ? 'text-zinc-400' : 'text-emerald-400'}`}>
                  {isEnded ? 'Ended' : stream?.status || 'Live'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#272727]">
                <span className="text-zinc-500">Visibility</span>
                <span className="font-semibold capitalize text-white">
                  {stream?.visibility || 'Public'}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#272727]">
                <span className="text-zinc-500">Started</span>
                <span className="text-zinc-300">
                  {stream?.started_at ? new Date(stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Realtime Network</span>
                <span className="text-zinc-300">LiveKit Cloud WebRTC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
