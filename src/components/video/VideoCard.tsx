'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import { Video as VideoIcon, User, Globe, Link2, Lock } from 'lucide-react'
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
    <div className="group flex flex-col w-full">
      {/* Thumbnail Container */}
      <Link
        href={`/video/${video.id}`}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900 border border-gray-800/80 transition-all duration-300 group-hover:border-indigo-500/50 group-hover:shadow-lg group-hover:shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {video.thumbnail_url && !imageError ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 text-gray-600">
            <VideoIcon className="h-10 w-10 text-gray-600 mb-1" />
            <span className="text-xs text-gray-500">No Preview</span>
          </div>
        )}

        {/* Video Duration */}
        {video.duration ? (
          <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md shadow">
            {formatDuration(video.duration)}
          </div>
        ) : null}

        {/* Visibility Badge if requested */}
        {showVisibilityBadge && (
          <div className="absolute top-2 left-2">
            {video.visibility === 'public' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                <Globe className="h-3 w-3" /> Public
              </span>
            )}
            {video.visibility === 'unlisted' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                <Link2 className="h-3 w-3" /> Unlisted
              </span>
            )}
            {video.visibility === 'private' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full backdrop-blur-sm">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Meta details below thumbnail */}
      <div className="flex gap-3 pt-3">
        {/* Creator Avatar */}
        <Link
          href={uploaderLink}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
          aria-label={uploaderName}
        >
          {uploaderAvatar ? (
            <img
              src={uploaderAvatar}
              alt={uploaderName}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-700 hover:ring-indigo-500 transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
              {uploaderName.charAt(0)}
            </div>
          )}
        </Link>

        {/* Title and Metadata */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/video/${video.id}`}
            className="block font-medium text-sm text-gray-100 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors focus:outline-none focus:underline"
          >
            {video.title}
          </Link>

          <Link
            href={uploaderLink}
            className="block text-xs text-gray-400 hover:text-gray-200 truncate mt-1 transition-colors"
          >
            {uploaderName}
          </Link>

          <div className="flex items-center text-xs text-gray-500 gap-1.5 mt-0.5">
            <span>{formatRelativeTime(video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}