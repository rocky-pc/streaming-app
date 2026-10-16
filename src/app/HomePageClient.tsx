'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { VideoGrid } from '@/components/video/VideoGrid'
import { getVideos } from '@/lib/api'
import type { Video, PaginatedResponse } from '@/types'
import { Loader2, RefreshCw } from 'lucide-react'

interface HomePageClientProps {
  initialVideos: Video[]
  initialHasMore: boolean
  initialTotal: number
}

export function HomePageClient({ initialVideos, initialHasMore, initialTotal }: HomePageClientProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const isPullingRef = useRef(false)

  const fetchVideos = useCallback(async (query: string, pageNum: number = 1) => {
    if (pageNum === 1) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    try {
      const result: PaginatedResponse<Video> = await getVideos({ query, page: pageNum, limit: 20 })
      if (pageNum === 1) {
        setVideos(result.data)
      } else {
        setVideos(prev => [...prev, ...result.data])
      }
      setHasMore(result.hasMore)
      setTotal(result.total)
      setPage(result.page)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos(searchQuery, 1)
  }, [searchQuery, fetchVideos])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchVideos(searchQuery, page + 1)
    }
  }

  const handleRefresh = () => {
    fetchVideos(searchQuery, 1)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current
    if (container && container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = true
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current) return
    const container = scrollContainerRef.current
    if (!container || container.scrollTop > 0) {
      isPullingRef.current = false
      return
    }
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current
    if (diff > 50) {
      e.preventDefault()
      handleRefresh()
      isPullingRef.current = false
    }
  }

  const handleTouchEnd = () => {
    isPullingRef.current = false
  }

  return (
    <div
      ref={scrollContainerRef}
      className="overscroll-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isRefreshing && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-4 pt-4 pointer-events-none md:hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-full shadow-lg animate-slide-down">
            <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
            <span className="text-sm font-medium text-white">Refreshing...</span>
          </div>
        </div>
      )}

      <VideoGrid
        videos={videos}
        isLoading={isLoading && page === 1}
        emptyMessage={searchQuery ? `No videos found for "${searchQuery}"` : 'No videos uploaded yet. Be the first to upload!'}
      />

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto touch-target"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
          {total > 0 && <p className="mt-2 text-sm text-gray-500">Showing {videos.length} of {total} videos</p>}
        </div>
      )}
    </div>
  )
}