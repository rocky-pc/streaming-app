'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn, formatDuration, formatDate, formatRelativeTime } from '@/lib/utils'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CopyLink } from './CopyLink'
import {
  Clock,
  Calendar,
  Globe,
  Link2,
  Lock,
  Edit,
  Video as VideoIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { Video } from '@/types'

interface VideoPlayerPageClientProps {
  video: Video
  relatedVideos: Video[]
}

export function VideoPlayerPageClient({ video, relatedVideos }: VideoPlayerPageClientProps) {
  const { user } = useAuth()
  const [showFullDescription, setShowFullDescription] = useState(false)

  const isOwner = user && user.id === video.user_id
  const uploader = video.profiles || video.profile
  const uploaderName = uploader?.display_name || uploader?.username || 'Creator'
  const uploaderUsername = uploader?.username || 'user'
  const uploaderAvatar = uploader?.avatar_url
  const uploaderProfileUrl = video.user_id ? `/profile/${video.user_id}` : '#'

  // Stream URL: prefer signed URL (for private videos) or standard video_url
  const streamSrc = video.signed_playback_url || video.video_url

  return (
    <div className="min-h-screen bg-gray-950 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Video & Details (2 columns on lg) */}
          <div className="lg:col-span-2 space-y-6">
            {/* HTML5 Video Player */}
            <div className="rounded-2xl overflow-hidden bg-black shadow-2xl border border-gray-800">
              <VideoPlayer
                src={streamSrc}
                poster={video.thumbnail_url || undefined}
                title={video.title}
                autoPlay={false}
              />
            </div>

            {/* Video Metadata Card */}
            <div className="space-y-4">
              {/* Title & Badges */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {video.visibility === 'public' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2.5 py-0.5 rounded-full">
                      <Globe className="h-3.5 w-3.5" /> Public
                    </span>
                  )}
                  {video.visibility === 'unlisted' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 rounded-full">
                      <Link2 className="h-3.5 w-3.5" /> Unlisted
                    </span>
                  )}
                  {video.visibility === 'private' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2.5 py-0.5 rounded-full">
                      <Lock className="h-3.5 w-3.5" /> Private
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                  {video.title}
                </h1>
              </div>

              {/* Uploader & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3 border-y border-gray-800">
                {/* Channel Profile */}
                <Link
                  href={uploaderProfileUrl}
                  className="flex items-center gap-3 group focus:outline-none"
                >
                  {uploaderAvatar ? (
                    <img
                      src={uploaderAvatar}
                      alt={uploaderName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-700 group-hover:ring-indigo-500 transition-all"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-base font-bold uppercase shadow-sm">
                      {uploaderName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors text-sm sm:text-base">
                      {uploaderName}
                    </h3>
                    <p className="text-xs text-gray-400">@{uploaderUsername}</p>
                  </div>
                </Link>

                {/* Buttons (Share, Edit if Owner) */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isOwner && (
                    <Link href="/my-videos">
                      <Button variant="outline" size="sm" className="border-gray-700 bg-gray-800/80 text-gray-200 hover:text-white hover:bg-gray-700 gap-1.5">
                        <Edit className="h-4 w-4" />
                        <span>Edit Video</span>
                      </Button>
                    </Link>
                  )}

                  <CopyLink video={video} />
                </div>
              </div>

              {/* Description Card */}
              <div className="rounded-2xl bg-gray-900/70 border border-gray-800/80 p-4 sm:p-5 text-sm space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400">
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    Published on {formatDate(video.created_at)} ({formatRelativeTime(video.created_at)})
                  </span>
                  {video.duration && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-500" />
                      Duration: {formatDuration(video.duration)}
                    </span>
                  )}
                </div>

                {video.description ? (
                  <div>
                    <p
                      className={cn(
                        'text-gray-300 whitespace-pre-wrap leading-relaxed',
                        !showFullDescription && 'line-clamp-3'
                      )}
                    >
                      {video.description}
                    </p>

                    {video.description.length > 120 && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                      >
                        {showFullDescription ? (
                          <>
                            <span>Show less</span>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Show more</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No description provided for this video.</p>
                )}
              </div>
            </div>
          </div>

          {/* Related Videos Sidebar */}
          <aside className="space-y-4">
            <Card className="bg-gray-900/60 border-gray-800">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                  <span>Up Next</span>
                  <span className="text-xs font-normal text-gray-500">
                    {relatedVideos.length} {relatedVideos.length === 1 ? 'video' : 'videos'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {relatedVideos.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center">No other public videos found.</p>
                ) : (
                  <div className="space-y-3.5">
                    {relatedVideos.map((item) => {
                      const itemUploader = item.profiles || item.profile
                      const itemName = itemUploader?.display_name || itemUploader?.username || 'Creator'

                      return (
                        <Link
                          key={item.id}
                          href={`/video/${item.id}`}
                          className="flex gap-3 group focus:outline-none"
                        >
                          <div className="relative w-36 aspect-video shrink-0 rounded-lg overflow-hidden bg-gray-800 border border-gray-800">
                            {item.thumbnail_url ? (
                              <img
                                src={item.thumbnail_url}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <VideoIcon className="h-5 w-5" />
                              </div>
                            )}
                            {item.duration && (
                              <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-semibold px-1 rounded">
                                {formatDuration(item.duration)}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-gray-400 truncate mt-1">{itemName}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{formatRelativeTime(item.created_at)}</p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}