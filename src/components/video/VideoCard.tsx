'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import { Video as VideoIcon, Globe, Link2, Lock } from 'lucide-react'
import type { Video as VideoType } from '@/types'

interface VideoCardProps {
  video: VideoType
  priority?: boolean
  showVisibilityBadge?: boolean
}

export function VideoCard({ video, priority = false, showVisibilityBadge = false }: VideoCardProps) {
  const [imageError, setImageError] = useState(false)

  const uploader = video.profiles || video.profile
  const uploaderName = uploader?.display_name || uploader?.username || 'Creator'
  const uploaderAvatar = uploader?.avatar_url
  const uploaderLink = video.user_id ? `/profile/${video.user_id}` : '#'

  return (
    <div className="group flex flex-col w-full select-none">
      {/* 16:9 Thumbnail Container */}
      <Link
        href={`/video/${video.id}`}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#1f1f1f] border border-[#272727] transition-all duration-200 group-hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        {video.thumbnail_url && !imageError ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading={priority ? 'eager' : 'lazy'}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1c1c1c] to-[#121212] text-zinc-600">
            <VideoIcon className="h-10 w-10 text-zinc-600 mb-1" />
            <span className="text-[11px] text-zinc-500 font-medium">StreamFlow</span>
          </div>
        )}

        {/* Video Duration Badge (YouTube Style) */}
        {video.duration ? (
          <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-xs text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md shadow-md tracking-wider">
            {formatDuration(video.duration)}
          </div>
        ) : null}

        {/* Visibility Badge if requested */}
        {showVisibilityBadge && (
          <div className="absolute top-2 left-2">
            {video.visibility === 'public' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded-full backdrop-blur-xs shadow">
                <Globe className="h-3 w-3" /> Public
              </span>
            )}
            {video.visibility === 'unlisted' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-950/90 border border-amber-500/50 text-amber-300 px-2 py-0.5 rounded-full backdrop-blur-xs shadow">
                <Link2 className="h-3 w-3" /> Unlisted
              </span>
            )}
            {video.visibility === 'private' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-rose-950/90 border border-rose-500/50 text-rose-300 px-2 py-0.5 rounded-full backdrop-blur-xs shadow">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Meta details below thumbnail */}
      <div className="flex gap-3 pt-3 px-0.5">
        {/* Creator Channel Avatar */}
        <Link
          href={uploaderLink}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-white/30 rounded-full"
          aria-label={uploaderName}
          onClick={(e) => e.stopPropagation()}
        >
          {uploaderAvatar ? (
            <img
              src={uploaderAvatar}
              alt={uploaderName}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-[#333333] hover:ring-white/50 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
              {uploaderName.charAt(0)}
            </div>
          )}
        </Link>

        {/* Title and Channel Info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/video/${video.id}`}
            className="block font-semibold text-sm text-[#f1f1f1] line-clamp-2 leading-snug hover:text-white transition-colors focus:outline-none focus:underline"
            title={video.title}
          >
            {video.title}
          </Link>

          <Link
            href={uploaderLink}
            className="block text-xs text-[#aaaaaa] hover:text-[#f1f1f1] truncate mt-1 transition-colors font-normal"
            onClick={(e) => e.stopPropagation()}
          >
            {uploaderName}
          </Link>

          <div className="flex items-center text-xs text-[#aaaaaa] gap-1.5 mt-0.5">
            <span>{formatRelativeTime(video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}