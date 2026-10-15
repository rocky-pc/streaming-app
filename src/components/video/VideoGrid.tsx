'use client'

import { cn } from '@/lib/utils'
import { VideoCard } from './VideoCard'
import { VideoCardSkeleton } from '@/components/ui/Skeleton'
import type { Video } from '@/types'

interface VideoGridProps {
  videos: Video[]
  isLoading?: boolean
  emptyMessage?: string
  className?: string
}

export function VideoGrid({ videos, isLoading, emptyMessage = 'No videos found', className }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-6', className)}>
        {[...Array(8)].map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className={cn('col-span-full py-16 text-center', className)}>
        <div className="max-w-md mx-auto">
          <svg className="mx-auto h-16 w-16 text-gray-700 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-300 mb-2">No videos yet</h3>
          <p className="text-gray-500 mb-6">{emptyMessage}</p>
          <a href="/upload" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload your first video
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'grid gap-6',
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-4',
      '2xl:grid-cols-5',
      className
    )}>
      {videos.map((video, index) => (
        <VideoCard key={video.id} video={video} priority={index < 4} />
      ))}
    </div>
  )
}