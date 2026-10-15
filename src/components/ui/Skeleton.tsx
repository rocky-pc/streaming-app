'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-800 rounded',
        'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animation-shimmer',
        className
      )}
      {...props}
    />
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="group relative bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden transition-all duration-300">
      <Skeleton className="aspect-video w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export function VideoPlayerSkeleton() {
  return (
    <div className="aspect-video w-full bg-gray-900 rounded-xl overflow-hidden">
      <Skeleton className="w-full h-full" />
    </div>
  )
}