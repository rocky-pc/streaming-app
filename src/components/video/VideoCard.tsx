'use client'

import { cn } from '@/lib/utils'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Video, Clock } from 'lucide-react'
import type { Video as VideoType } from '@/types'
import Link from 'next/link'

interface VideoCardProps {
  video: VideoType
  priority?: boolean
}

export function VideoCard({ video, priority = false }: VideoCardProps) {
  return (
    <Link href={`/video/${video.id}`} className="block group">
      <Card className="h-full flex flex-col">
        <div className="relative aspect-video overflow-hidden bg-gray-800">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading={priority ? 'eager' : 'lazy'}
              width="320"
              height="180"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <Video className="h-16 w-16 text-gray-600" />
            </div>
          )}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
          )}
        </div>
        <CardContent className="flex-1 flex flex-col p-4">
          <h3 className="font-semibold text-white line-clamp-2 group-hover:text-indigo-400 transition-colors">
            {video.title}
          </h3>
          <div className="mt-auto flex items-center gap-3 text-sm text-gray-400">
            {video.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(video.duration)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Video className="h-3.5 w-3.5" />
              {formatRelativeTime(video.created_at)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}