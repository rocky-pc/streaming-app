'use client'

import Link from 'next/link'
import { Radio, Users, Play } from 'lucide-react'
import type { LiveStreamRow, ProfileRow } from '@/types/database'

interface LiveCardProps {
  stream: LiveStreamRow & { profiles?: ProfileRow | null }
}

export function LiveCard({ stream }: LiveCardProps) {
  const profile = stream.profiles
  const displayName = profile?.display_name || 'Broadcaster'
  const username = profile?.username || 'user'
  const avatarUrl = profile?.avatar_url

  return (
    <div className="group flex flex-col gap-3">
      {/* 16:9 Thumbnail Container */}
      <Link
        href={`/live/${stream.id}`}
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 via-neutral-900 to-black border border-[#272727] group-hover:border-red-500/50 transition-all shadow-md group-hover:shadow-red-950/20"
      >
        {/* Animated Background Graphic */}
        <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:scale-105 transition-transform duration-500">
          <div className="w-20 h-20 rounded-full bg-red-600/10 flex items-center justify-center">
            <Radio className="h-10 w-10 text-red-500 animate-pulse" />
          </div>
        </div>

        {/* Top Left LIVE Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-red-600/95 backdrop-blur-md rounded-md text-white text-[11px] font-bold tracking-wider uppercase shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          LIVE
        </div>

        {/* Watch Live Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch Live
          </span>
        </div>
      </Link>

      {/* Stream Info & Broadcaster Header */}
      <div className="flex items-start gap-3 px-0.5">
        {/* Channel Avatar */}
        <Link href={`/profile/${stream.user_id}`} className="shrink-0 mt-0.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-700 hover:ring-white transition-all"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
              {displayName.charAt(0)}
            </div>
          )}
        </Link>

        {/* Title & Metadata */}
        <div className="min-w-0 flex-1">
          <Link href={`/live/${stream.id}`} className="block">
            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
              {stream.title}
            </h3>
          </Link>

          <Link
            href={`/profile/${stream.user_id}`}
            className="text-xs text-zinc-400 hover:text-white transition-colors block mt-1 truncate"
          >
            {displayName}
          </Link>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
            <span className="flex items-center gap-1 text-red-400 font-medium">
              <Radio className="h-3 w-3" />
              Broadcasting now
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
