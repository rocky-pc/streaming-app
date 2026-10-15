'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface VideoPlayerProps {
  src: string
  poster?: string
  title: string
  onTimeUpdate?: (currentTime: number, duration: number) => void
  initialTime?: number
  autoPlay?: boolean
}

export function VideoPlayer({
  src,
  poster,
  title,
  onTimeUpdate,
  initialTime = 0,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buffered, setBuffered] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastVolumeRef = useRef(1)

  const savePlaybackPosition = useCallback(() => {
    if (videoRef.current && currentTime > 0) {
      const key = `video-position-${src}`
      localStorage.setItem(key, JSON.stringify({ time: currentTime, timestamp: Date.now() }))
    }
  }, [src, currentTime])

  const loadPlaybackPosition = useCallback(() => {
    const key = `video-position-${src}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const { time, timestamp } = JSON.parse(saved)
        if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000 && time > 10 && time < (duration || Infinity)) {
          return time
        }
      } catch {
        // Ignore parse errors
      }
    }
    return initialTime
  }, [src, initialTime, duration])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const savedTime = loadPlaybackPosition()
    if (savedTime > 0) {
      video.currentTime = savedTime
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime, video.duration)
    }

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1))
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      const key = `video-position-${src}`
      localStorage.removeItem(key)
    }

    const handleError = () => {
      setError('Failed to load video. Please try again.')
      setIsLoading(false)
    }

    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('progress', handleProgress)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)

    if (autoPlay) {
      video.play().catch(() => {})
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('progress', handleProgress)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [src, autoPlay, loadPlaybackPosition, onTimeUpdate])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          adjustVolume(0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          adjustVolume(-0.1)
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
        case '>':
        case '.':
          setPlaybackRate(Math.min(playbackRate + 0.25, 2))
          break
        case '<':
        case ',':
          setPlaybackRate(Math.max(playbackRate - 0.25, 0.25))
          break
        case '0':
          seekTo(0)
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          seekTo((parseInt(e.key) / 10) * duration)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown as EventListener)
    return () => document.removeEventListener('keydown', handleKeyDown as EventListener)
  }, [duration, isPlaying, isFullscreen, playbackRate])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = isMuted ? 0 : volume
    video.playbackRate = playbackRate
  }, [volume, isMuted, playbackRate])

  useEffect(() => {
    if (isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {})
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [isFullscreen])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }

  const seek = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration))
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(time, video.duration))
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seekTo(percent * video.duration)
  }

  const handleProgressKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return
    const step = video.duration / 100
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        seek(-step * 10)
        break
      case 'ArrowRight':
        e.preventDefault()
        seek(step * 10)
        break
      case 'Home':
        e.preventDefault()
        seekTo(0)
        break
      case 'End':
        e.preventDefault()
        seekTo(video.duration)
        break
    }
  }

  const adjustVolume = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (newVolume > 0) lastVolumeRef.current = newVolume
  }

  const toggleMute = () => {
    if (isMuted) {
      setVolume(lastVolumeRef.current)
      setIsMuted(false)
    } else {
      lastVolumeRef.current = volume
      setVolume(0)
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000)
  }

  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    setShowControls(false)
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-xl overflow-hidden',
        'group',
        isFullscreen && 'fixed inset-0 z-50 w-screen h-screen rounded-none'
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-8 text-center">
          <svg className="h-16 w-16 text-red-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-white text-lg font-medium mb-2">Playback Error</p>
          <p className="text-gray-400 mb-6 max-w-md">{error}</p>
          <Button variant="outline" onClick={() => videoRef.current?.load()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent',
          'px-4 pb-3 pt-6 transition-opacity duration-300',
          showControls || isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        role="region"
        aria-label="Video player controls"
      >
        <div className="max-w-5xl mx-auto">
          <div
            ref={progressRef}
            className="relative h-1.5 mb-3 rounded-full bg-gray-800 cursor-pointer"
            onClick={handleProgressClick}
            onKeyDown={handleProgressKeyDown}
            role="slider"
            tabIndex={0}
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={duration > 0 ? Math.round((currentTime / duration) * 100) : 0}
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-gray-600"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-indigo-500 transition-all duration-75"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-1/2 left-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500 border-2 border-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="text-white hover:bg-gray-800"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => seek(-10)}
                aria-label="Rewind 10 seconds"
                className="text-white hover:bg-gray-800"
              >
                <SkipBack className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => seek(10)}
                aria-label="Forward 10 seconds"
                className="text-white hover:bg-gray-800"
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-1 text-sm text-gray-300 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span className="text-gray-500">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="text-white hover:bg-gray-800"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                <div
                  className={cn(
                    'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-900 border border-gray-700 rounded-lg',
                    'opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all'
                  )}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setVolume(val)
                      setIsMuted(val === 0)
                      if (val > 0) lastVolumeRef.current = val
                    }}
                    className="w-32 h-2 appearance-none bg-gray-700 rounded-lg accent-indigo-500 cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Playback settings"
                  className="text-white hover:bg-gray-800"
                >
                  <Settings className="h-5 w-5" />
                </Button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[140px] z-10">
                    <p className="px-2 py-1 text-xs text-gray-400">Playback Speed</p>
                    {playbackRates.map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setPlaybackRate(rate)}
                        className={cn(
                          'w-full px-3 py-1.5 text-sm text-left rounded transition-colors',
                          playbackRate === rate
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800'
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="text-white hover:bg-gray-800"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}