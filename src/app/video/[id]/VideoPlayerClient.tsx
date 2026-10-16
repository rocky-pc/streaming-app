'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn, formatDuration, formatDate, formatRelativeTime } from '@/lib/utils'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { CopyLink } from './CopyLink'
import {
  Globe,
  Link2,
  Lock,
  Edit,
  Video as VideoIcon,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  Check,
  Bell,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import type { Video } from '@/types'

interface VideoPlayerPageClientProps {
  video: Video
  relatedVideos: Video[]
}

export function VideoPlayerPageClient({ video, relatedVideos }: VideoPlayerPageClientProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const isOwner = user && user.id === video.user_id
  const uploader = video.profiles || video.profile
  const uploaderName = uploader?.display_name || uploader?.username || 'Creator'
  const uploaderUsername = uploader?.username || 'user'
  const uploaderAvatar = uploader?.avatar_url
  const uploaderProfileUrl = video.user_id ? `/profile/${video.user_id}` : '#'

  // Stream URL: prefer signed URL (for private videos) or standard video_url
  const streamSrc = video.signed_playback_url || video.video_url

  const handleSubscribeToggle = () => {
    setIsSubscribed(!isSubscribed)
    toast(
      !isSubscribed
        ? `Subscribed to ${uploaderName}!`
        : `Unsubscribed from ${uploaderName}`,
      'info'
    )
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = streamSrc
    a.download = `${video.title}.mp4`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast('Download started', 'info')
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-4 px-3 sm:px-6 lg:px-8 select-none">
      <div className="max-w-[1720px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Video & Details (8 columns on lg, 12 on mobile) */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* YouTube Cinema Player Container */}
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10">
              <VideoPlayer
                src={streamSrc}
                poster={video.thumbnail_url || undefined}
                title={video.title}
                autoPlay={false}
              />
            </div>

            {/* Video Title */}
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {video.visibility === 'public' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                )}
                {video.visibility === 'unlisted' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full">
                    <Link2 className="h-3 w-3" /> Unlisted
                  </span>
                )}
                {video.visibility === 'private' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-[#f1f1f1] tracking-tight leading-snug">
                {video.title}
              </h1>
            </div>

            {/* Channel Details & Actions Row (Authentic YouTube Style) */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-[#272727]">
              {/* Channel Profile on Left */}
              <div className="flex items-center gap-3">
                <Link
                  href={uploaderProfileUrl}
                  className="shrink-0 focus:outline-none rounded-full ring-1 ring-zinc-700 hover:ring-white/40 transition-all"
                  aria-label={uploaderName}
                >
                  {uploaderAvatar ? (
                    <img
                      src={uploaderAvatar}
                      alt={uploaderName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-sm font-bold uppercase shadow-sm">
                      {uploaderName.charAt(0)}
                    </div>
                  )}
                </Link>

                <div className="min-w-0 pr-2">
                  <Link
                    href={uploaderProfileUrl}
                    className="block font-semibold text-sm text-[#f1f1f1] hover:underline leading-snug truncate"
                  >
                    {uploaderName}
                  </Link>
                  <p className="text-xs text-[#aaaaaa]">@{uploaderUsername}</p>
                </div>

                {/* Owner Edit OR Subscribe Button */}
                {isOwner ? (
                  <Link href="/my-videos">
                    <button className="px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ml-2">
                      <Edit className="h-3.5 w-3.5" />
                      <span>Edit Video</span>
                    </button>
                  </Link>
                ) : (
                  <button
                    onClick={handleSubscribeToggle}
                    className={`px-4 py-2 text-xs font-semibold rounded-full transition-colors ml-2 flex items-center gap-1.5 ${
                      isSubscribed
                        ? 'bg-[#272727] text-white hover:bg-[#383838]'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <Bell className="h-3.5 w-3.5" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      'Subscribe'
                    )}
                  </button>
                )}
              </div>

              {/* Action Buttons: Share, Download */}
              <div className="flex items-center gap-2">
                <CopyLink video={video} />

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#272727] hover:bg-[#383838] text-white text-xs font-medium rounded-full transition-colors"
                  title="Download MP4"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>
            </div>

            {/* YouTube Description Card Container */}
            <div
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="rounded-xl bg-[#272727]/80 hover:bg-[#272727] transition-colors p-3.5 sm:p-4 cursor-pointer text-sm space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#f1f1f1]">
                <span>Uploaded {formatDate(video.created_at)}</span>
                <span>•</span>
                <span>{formatRelativeTime(video.created_at)}</span>
                {video.duration && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(video.duration)} duration</span>
                  </>
                )}
              </div>

              {video.description ? (
                <div>
                  <p
                    className={cn(
                      'text-xs sm:text-sm text-[#f1f1f1] whitespace-pre-wrap leading-relaxed',
                      !showFullDescription && 'line-clamp-3'
                    )}
                  >
                    {video.description}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-white hover:underline inline-flex items-center gap-1"
                  >
                    {showFullDescription ? (
                      <>
                        <span>Show less</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <span>...more</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">No description provided for this video.</p>
              )}
            </div>
          </div>

          {/* Right Column: Up Next / Related Videos (4 columns on lg) */}
          <aside className="lg:col-span-4 space-y-3">
            <h3 className="text-base font-bold text-white px-1">Up Next</h3>

            <div className="space-y-3">
              {relatedVideos.length === 0 ? (
                <p className="text-xs text-zinc-500 px-1 py-4">No other public videos found.</p>
              ) : (
                relatedVideos.map((item) => {
                  const itemUploader = item.profiles || item.profile
                  const itemName = itemUploader?.display_name || itemUploader?.username || 'Creator'

                  return (
                    <Link
                      key={item.id}
                      href={`/video/${item.id}`}
                      className="flex gap-2.5 group focus:outline-none rounded-xl p-1 hover:bg-[#1f1f1f] transition-colors"
                    >
                      {/* Compact 16:9 Thumbnail */}
                      <div className="relative w-40 sm:w-44 aspect-video shrink-0 rounded-xl overflow-hidden bg-[#1f1f1f] border border-[#272727]">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <VideoIcon className="h-5 w-5" />
                          </div>
                        )}
                        {item.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-semibold px-1 py-0.5 rounded">
                            {formatDuration(item.duration)}
                          </span>
                        )}
                      </div>

                      {/* Video Title and Details */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="font-semibold text-xs sm:text-sm text-[#f1f1f1] line-clamp-2 leading-snug group-hover:text-white transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-[#aaaaaa] truncate mt-1">{itemName}</p>
                        <p className="text-[11px] text-[#aaaaaa] mt-0.5">{formatRelativeTime(item.created_at)}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}