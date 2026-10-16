'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
  ConnectionState,
} from 'livekit-client'
import {
  Radio,
  Video as VideoIcon,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Globe,
  Link as LinkIcon,
  Users,
  Eye,
  StopCircle,
  ExternalLink,
} from 'lucide-react'

interface MediaDeviceInfoState {
  videoInputs: MediaDeviceInfo[]
  audioInputs: MediaDeviceInfo[]
}

export function GoLiveClient() {
  const router = useRouter()
  const { user, profile, isLoading: isAuthLoading } = useAuth()
  const { addToast } = useToast()

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public')

  // Device & Preview states
  const [devices, setDevices] = useState<MediaDeviceInfoState>({ videoInputs: [], audioInputs: [] })
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('')
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('')
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  // LiveKit / Stream states
  const [streamId, setStreamId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [liveDuration, setLiveDuration] = useState(0)
  const [viewerCount, setViewerCount] = useState(0)
  const [copiedLink, setCopiedLink] = useState(false)

  // Refs
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null)
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null)
  const roomRef = useRef<Room | null>(null)
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Redirect unauthenticated creators
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/go-live')
    }
  }, [user, isAuthLoading, router])

  // Stop local media tracks helper
  const stopLocalTracks = useCallback(() => {
    if (localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.stop()
      } catch (e) {
        console.error('Error stopping video track:', e)
      }
      localVideoTrackRef.current = null
    }
    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop()
      } catch (e) {
        console.error('Error stopping audio track:', e)
      }
      localAudioTrackRef.current = null
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null
    }
  }, [])

  // Request permissions and initialize devices
  const initializeDevicesAndPreview = useCallback(async () => {
    setDeviceError(null)
    setIsRequestingPermission(true)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera or microphone access.')
      }

      // Stop existing tracks before recreating
      stopLocalTracks()

      // Create video track
      const videoTrack = await createLocalVideoTrack({
        deviceId: selectedVideoDeviceId ? { exact: selectedVideoDeviceId } : undefined,
        resolution: { width: 1280, height: 720, frameRate: 30 },
      })
      localVideoTrackRef.current = videoTrack

      // Create audio track
      const audioTrack = await createLocalAudioTrack({
        deviceId: selectedAudioDeviceId ? { exact: selectedAudioDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
      })
      localAudioTrackRef.current = audioTrack

      // Attach video track to preview element
      if (previewVideoRef.current) {
        videoTrack.attach(previewVideoRef.current)
      }

      // Enumerate devices
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput')
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput')

      setDevices({ videoInputs, audioInputs })
      if (!selectedVideoDeviceId && videoInputs.length > 0) {
        setSelectedVideoDeviceId(videoInputs[0].deviceId)
      }
      if (!selectedAudioDeviceId && audioInputs.length > 0) {
        setSelectedAudioDeviceId(audioInputs[0].deviceId)
      }

      setHasPermission(true)
    } catch (err: unknown) {
      console.error('Permission / Device Error:', err)
      setHasPermission(false)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setDeviceError('Camera or microphone permission was denied. Please allow camera and microphone permissions in your browser settings to go live.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setDeviceError('No camera or microphone device was found. Please plug in a webcam or microphone.')
        } else {
          setDeviceError(err.message || 'Unable to access your camera and microphone.')
        }
      } else {
        setDeviceError('An unknown error occurred while requesting device access.')
      }
    } finally {
      setIsRequestingPermission(false)
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId, stopLocalTracks])

  // Initialize camera and mic preview on component mount
  useEffect(() => {
    initializeDevicesAndPreview()

    return () => {
      stopLocalTracks()
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }
    }
  }, [initializeDevicesAndPreview, stopLocalTracks])

  // Toggle Camera
  const toggleCamera = async () => {
    const newState = !isCameraEnabled
    setIsCameraEnabled(newState)

    if (localVideoTrackRef.current) {
      if (newState) {
        await localVideoTrackRef.current.unmute()
      } else {
        await localVideoTrackRef.current.mute()
      }
    }
  }

  // Toggle Microphone
  const toggleMic = async () => {
    const newState = !isMicEnabled
    setIsMicEnabled(newState)

    if (localAudioTrackRef.current) {
      if (newState) {
        await localAudioTrackRef.current.unmute()
      } else {
        await localAudioTrackRef.current.mute()
      }
    }
  }

  // Handle device change
  const handleCameraChange = async (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId)
    try {
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop()
      }
      const newVideoTrack = await createLocalVideoTrack({
        deviceId: { exact: deviceId },
        resolution: { width: 1280, height: 720, frameRate: 30 },
      })
      localVideoTrackRef.current = newVideoTrack
      if (previewVideoRef.current) {
        newVideoTrack.attach(previewVideoRef.current)
      }
      if (roomRef.current && isLive) {
        await roomRef.current.localParticipant.publishTrack(newVideoTrack)
      }
    } catch (e) {
      console.error('Failed to change camera:', e)
      addToast('Failed to switch camera device', 'error')
    }
  }

  const handleMicChange = async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId)
    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
      }
      const newAudioTrack = await createLocalAudioTrack({
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
      })
      localAudioTrackRef.current = newAudioTrack
      if (roomRef.current && isLive) {
        await roomRef.current.localParticipant.publishTrack(newAudioTrack)
      }
    } catch (e) {
      console.error('Failed to change microphone:', e)
      addToast('Failed to switch microphone device', 'error')
    }
  }

  // Broadcaster Starts Stream: "Go Live"
  const handleGoLive = async () => {
    if (!title.trim()) {
      addToast('Please enter a stream title before going live.', 'error')
      return
    }

    if (!localVideoTrackRef.current || !localAudioTrackRef.current) {
      addToast('Please ensure your camera and microphone are ready.', 'error')
      return
    }

    setIsConnecting(true)

    try {
      // 1. Create stream record in database
      const createRes = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
        }),
      })

      const createData = await createRes.json()
      if (!createRes.ok || !createData.data) {
        throw new Error(createData.error || 'Failed to initialize live stream record.')
      }

      const newStream = createData.data
      setStreamId(newStream.id)

      // 2. Request Broadcaster Token from /api/livekit/token (or Supabase Edge Function)
      let tokenData: { token: string; livekitUrl?: string } | null = null
      try {
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: newStream.id,
            action: 'broadcast',
            participantName: profile?.display_name || user?.email || 'Broadcaster',
          }),
        })

        const resJson = await tokenRes.json()
        if (tokenRes.ok && resJson.token) {
          tokenData = resJson
        } else {
          throw new Error(resJson.error || 'Server token generation error')
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
            streamId: newStream.id,
            action: 'broadcast',
            participantName: profile?.display_name || user?.email || 'Broadcaster',
          }),
        })

        const edgeJson = await edgeRes.json()
        if (edgeRes.ok && edgeJson.token) {
          tokenData = edgeJson
        } else {
          const errMsg = edgeJson?.error || (apiErr instanceof Error ? apiErr.message : 'Failed to retrieve authorization token.')
          throw new Error(errMsg)
        }
      }

      if (!tokenData || !tokenData.token) {
        throw new Error('Failed to obtain a valid streaming token.')
      }

      // 3. Connect to LiveKit Room using official client SDK
      const livekitUrl = tokenData.livekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-flow-8560l64p.livekit.cloud'
      if (!livekitUrl) {
        throw new Error('LiveKit WebSocket connection URL is missing.')
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      // Setup room event listeners
      room.on(RoomEvent.Connected, () => {
        setIsLive(true)
        setIsConnecting(false)
        addToast('You are now LIVE on StreamFlow!', 'success')

        // Start duration counter
        setLiveDuration(0)
        durationTimerRef.current = setInterval(() => {
          setLiveDuration((prev) => prev + 1)
        }, 1000)
      })

      room.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount((prev) => prev + 1)
      })

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount((prev) => Math.max(0, prev - 1))
      })

      room.on(RoomEvent.Disconnected, () => {
        setIsLive(false)
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current)
        }
      })

      // Connect to LiveKit Cloud
      await room.connect(livekitUrl, tokenData.token)
      roomRef.current = room

      // 4. Publish local camera and microphone tracks
      if (localVideoTrackRef.current) {
        await room.localParticipant.publishTrack(localVideoTrackRef.current, {
          name: 'camera',
          simulcast: true,
        })
      }

      if (localAudioTrackRef.current) {
        await room.localParticipant.publishTrack(localAudioTrackRef.current, {
          name: 'microphone',
        })
      }
    } catch (err: unknown) {
      console.error('Failed to go live:', err)
      setIsConnecting(false)
      const message = err instanceof Error ? err.message : 'Failed to connect to streaming servers.'
      addToast(message, 'error')
    }
  }

  // Broadcaster Ends Stream: "End Live"
  const handleEndLive = async () => {
    if (!confirm('Are you sure you want to end your live broadcast?')) {
      return
    }

    try {
      // 1. Notify server to mark stream as ended
      if (streamId) {
        await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId,
            action: 'end',
          }),
        })
      }

      // 2. Disconnect LiveKit Room
      if (roomRef.current) {
        await roomRef.current.disconnect()
        roomRef.current = null
      }

      // 3. Stop local tracks & release media resources
      stopLocalTracks()

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current)
      }

      setIsLive(false)
      addToast('Your live stream has ended.', 'info')
      router.push(streamId ? `/live/${streamId}` : '/')
    } catch (err: unknown) {
      console.error('Error ending live stream:', err)
      addToast('Error ending stream cleanly. Redirecting...', 'error')
      router.push('/')
    }
  }

  // Copy watch link helper
  const handleCopyLink = () => {
    if (!streamId) return
    const url = `${window.location.origin}/live/${streamId}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    addToast('Live stream URL copied to clipboard!', 'success')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Format seconds to mm:ss or hh:mm:ss
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0f0f0f] text-[#f1f1f1] px-4 py-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#272727] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-600/10 text-red-500">
              <Radio className="h-6 w-6 animate-pulse" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">StreamFlow Live Studio</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Broadcast high-definition video directly from your browser powered by LiveKit Cloud
          </p>
        </div>

        {isLive && streamId && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-wider animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              LIVE {formatDuration(liveDuration)}
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium rounded-full transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
            </button>

            <Link
              href={`/live/${streamId}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#272727] hover:bg-[#383838] text-zinc-300 hover:text-white text-xs font-medium rounded-full transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Watch Room</span>
            </Link>
          </div>
        )}
      </div>

      {/* Permission or Device Error Alert */}
      {deviceError && (
        <div className="my-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-rose-200">Device Access Issue</p>
            <p>{deviceError}</p>
            <button
              onClick={initializeDevicesAndPreview}
              className="mt-2 text-xs font-semibold text-white underline hover:no-underline"
            >
              Retry device permissions
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Camera Preview & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 16:9 Video Preview Container */}
          <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-[#272727] shadow-2xl flex items-center justify-center">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isCameraEnabled ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Camera Off Placeholder */}
            {!isCameraEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141414] text-zinc-400 space-y-2">
                <VideoOff className="h-12 w-12 text-zinc-500" />
                <p className="text-sm font-medium">Camera is turned off</p>
              </div>
            )}

            {/* Permission Request Overlay */}
            {isRequestingPermission && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                <p className="text-xs font-medium text-zinc-300">Requesting camera & microphone access...</p>
              </div>
            )}

            {/* Live Indicator Chip */}
            {isLive && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-600/90 backdrop-blur-md rounded-md text-white text-xs font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE NOW
              </div>
            )}

            {/* Viewer Count Chip */}
            {isLive && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-md text-zinc-200 text-xs font-medium">
                <Eye className="h-3.5 w-3.5 text-zinc-400" />
                <span>{viewerCount} watching</span>
              </div>
            )}

            {/* Bottom Preview Controls Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-[#181818]/90 backdrop-blur-md border border-[#303030] rounded-full shadow-lg">
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isMicEnabled
                    ? 'bg-[#282828] hover:bg-[#383838] text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
                title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>

              {/* Camera Toggle Button */}
              <button
                type="button"
                onClick={toggleCamera}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCameraEnabled
                    ? 'bg-[#282828] hover:bg-[#383838] text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
                title={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              >
                {isCameraEnabled ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Device Selection Card */}
          <div className="p-4 bg-[#181818] border border-[#272727] rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              <Settings className="h-4 w-4 text-zinc-400" />
              <span>Input Devices</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Camera Selector */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="camera-select">
                  Camera
                </label>
                <select
                  id="camera-select"
                  value={selectedVideoDeviceId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  disabled={isLive || devices.videoInputs.length === 0}
                  className="w-full bg-[#121212] border border-[#383838] text-white text-xs rounded-xl px-3 py-2 focus:border-[#3ea6ff] focus:outline-none"
                >
                  {devices.videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera (${d.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                  {devices.videoInputs.length === 0 && <option value="">No cameras found</option>}
                </select>
              </div>

              {/* Microphone Selector */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="mic-select">
                  Microphone
                </label>
                <select
                  id="mic-select"
                  value={selectedAudioDeviceId}
                  onChange={(e) => handleMicChange(e.target.value)}
                  disabled={isLive || devices.audioInputs.length === 0}
                  className="w-full bg-[#121212] border border-[#383838] text-white text-xs rounded-xl px-3 py-2 focus:border-[#3ea6ff] focus:outline-none"
                >
                  {devices.audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone (${d.deviceId.slice(0, 5)})`}
                    </option>
                  ))}
                  {devices.audioInputs.length === 0 && <option value="">No microphones found</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Stream Configuration & Action Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 bg-[#181818] border border-[#272727] rounded-3xl shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Stream Details</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Set up your broadcast metadata before streaming live to viewers
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="stream-title">
                Stream Title <span className="text-red-500">*</span>
              </label>
              <input
                id="stream-title"
                type="text"
                required
                disabled={isLive}
                placeholder="e.g., Live Coding & Q&A Stream"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#121212] border border-[#383838] text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-[#3ea6ff] focus:outline-none placeholder-zinc-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="stream-desc">
                Description (Optional)
              </label>
              <textarea
                id="stream-desc"
                rows={3}
                disabled={isLive}
                placeholder="What is this live stream about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#121212] border border-[#383838] text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-[#3ea6ff] focus:outline-none placeholder-zinc-500 resize-none"
              />
            </div>

            {/* Visibility Option */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Visibility</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isLive}
                  onClick={() => setVisibility('public')}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-medium transition-all ${
                    visibility === 'public'
                      ? 'border-[#ff0000] bg-[#ff0000]/10 text-white'
                      : 'border-[#2e2e2e] bg-[#141414] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Globe className="h-4 w-4 mb-1" />
                  <span>Public</span>
                </button>

                <button
                  type="button"
                  disabled={isLive}
                  onClick={() => setVisibility('unlisted')}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-medium transition-all ${
                    visibility === 'unlisted'
                      ? 'border-[#ff0000] bg-[#ff0000]/10 text-white'
                      : 'border-[#2e2e2e] bg-[#141414] text-zinc-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="h-4 w-4 mb-1" />
                  <span>Unlisted</span>
                </button>

                <button
                  type="button"
                  disabled={isLive}
                  onClick={() => setVisibility('private')}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-medium transition-all ${
                    visibility === 'private'
                      ? 'border-[#ff0000] bg-[#ff0000]/10 text-white'
                      : 'border-[#2e2e2e] bg-[#141414] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lock className="h-4 w-4 mb-1" />
                  <span>Private</span>
                </button>
              </div>
            </div>

            {/* Prominent Action Button: Go Live or End Live */}
            <div className="pt-2">
              {!isLive ? (
                <button
                  type="button"
                  onClick={handleGoLive}
                  disabled={isConnecting || isRequestingPermission || !hasPermission}
                  className="w-full bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-xl active:scale-[0.99]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Connecting to LiveKit Cloud...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="h-4 w-4" />
                      <span>Go Live</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEndLive}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-xl active:scale-[0.99]"
                >
                  <StopCircle className="h-4 w-4" />
                  <span>End Live Stream</span>
                </button>
              )}
            </div>

            {/* Broadcaster Profile Card */}
            <div className="pt-4 border-t border-[#272727] flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'Broadcaster'}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-zinc-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white shrink-0">
                  {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {profile?.display_name || user?.user_metadata?.display_name || 'Creator'}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  @{profile?.username || user?.user_metadata?.username || 'user'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
