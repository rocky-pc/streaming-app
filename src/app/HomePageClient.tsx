'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { VideoGrid } from '@/components/video/VideoGrid'
import { getVideos } from '@/lib/api'
import type { Video } from '@/types'
import { Loader2, Search, X, Sparkles, Film } from 'lucide-react'

interface HomePageClientProps {
  initialVideos: Video[]
  initialHasMore: boolean
  initialTotal: number
  initialQuery?: string
}

export function HomePageClient({
  initialVideos,
  initialHasMore,
  initialTotal,
  initialQuery = '',
}: HomePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync state if initialProps change from URL navigation
  useEffect(() => {
    setVideos(initialVideos)
    setHasMore(initialHasMore)
    setTotal(initialTotal)
    setSearchQuery(initialQuery)
    setPage(1)
  }, [initialVideos, initialHasMore, initialTotal, initialQuery])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    router.push('/')
  }

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    setError(null)

    try {
      const nextPage = page + 1
      const result = await getVideos({
        query: searchQuery,
        page: nextPage,
        limit: 12,
      })

      setVideos((prev) => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setTotal(result.total)
      setPage(nextPage)
    } catch (err) {
      console.error('Failed to load more videos:', err)
      setError('Failed to load more videos. Please try again.')
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Film className="h-7 w-7 text-indigo-500" />
            <span>Explore Videos</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {initialQuery
              ? `Showing search results for "${initialQuery}" (${total} video${total === 1 ? '' : 's'})`
              : 'Discover newest public videos from creators around the world'}
          </p>
        </div>

        {/* Filter / In-page Search Bar */}
        <div className="w-full sm:w-80">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </div>

      {initialQuery && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Active filter:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            &quot;{initialQuery}&quot;
            <button onClick={handleClearSearch} className="hover:text-white" aria-label="Remove filter">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Videos Grid */}
      <VideoGrid
        videos={videos}
        isLoading={isSearching}
        emptyMessage={
          initialQuery
            ? `No public videos found matching "${initialQuery}". Try searching with different keywords.`
            : 'No public videos have been uploaded yet. Log in and be the first to share one!'
        }
      />

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Pagination / Load More */}
      {hasMore && (
        <div className="pt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-3 bg-gray-900 border border-gray-800 text-gray-200 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all shadow-lg hover:border-gray-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>Loading more videos...</span>
              </>
            ) : (
              <span>Load More Videos</span>
            )}
          </button>
          {total > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Showing {videos.length} of {total} public videos
            </p>
          )}
        </div>
      )}
    </div>
  )
}