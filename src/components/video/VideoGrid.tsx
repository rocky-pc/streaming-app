'use client'

import { cn } from '@/lib/utils'
import { VideoCard } from './VideoCard'
import { VideoGridSkeleton } from './VideoGridSkeleton'
import type { Video } from '@/types'
import Link from 'next/link'
import { Video as VideoIcon, Upload } from 'lucide-react'

interface VideoGridProps {
  videos: Video[]
  isLoading?: boolean
  emptyMessage?: string
  className?: string
  showVisibilityBadge?: boolean
}

export function VideoGrid({
  videos,
  isLoading,
  emptyMessage = 'No videos found',
  className,
  showVisibilityBadge = false,
}: VideoGridProps) {
  if (isLoading) {
    return <VideoGridSkeleton />
  }

  if (videos.length === 0) {
    return (
      <div className={cn('col-span-full py-16 text-center', className)}>
        <div className="max-w-md mx-auto px-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mb-4 shadow-inner">
            <VideoIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-200 mb-1">No videos yet</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm">{emptyMessage}</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors shadow-md shadow-indigo-600/20"
          >
            <Upload className="h-4 w-4" />
            <span>Upload a Video</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        className
      )}
    >
      {videos.map((video, index) => (
        <VideoCard
          key={video.id}
          video={video}
          priority={index < 4}
          showVisibilityBadge={showVisibilityBadge}
        />
      ))}
    </div>
  )
}