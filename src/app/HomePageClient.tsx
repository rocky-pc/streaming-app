'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { VideoGrid } from '@/components/video/VideoGrid'
import { getVideos } from '@/lib/api'
import type { Video } from '@/types'
import { Loader2, X, Sparkles } from 'lucide-react'

interface HomePageClientProps {
  initialVideos: Video[]
  initialHasMore: boolean
  initialTotal: number
  initialQuery?: string
}

const TOPIC_CHIPS = [
  'All',
  'Music',
  'Trailers',
  'Cinema',
  'Gaming',
  'Podcasts',
  'Tamil',
  'Animation',
  'Tech',
  'News',
  'Recently uploaded',
]

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
  const [selectedChip, setSelectedChip] = useState(initialQuery ? '' : 'All')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)

  // Sync state if initialProps change from URL navigation
  useEffect(() => {
    setVideos(initialVideos)
    setHasMore(initialHasMore)
    setTotal(initialTotal)
    setSearchQuery(initialQuery)
    setSelectedChip(initialQuery ? '' : 'All')
    setPage(1)
  }, [initialVideos, initialHasMore, initialTotal, initialQuery])

  const handleChipClick = async (chip: string) => {
    if (chip === selectedChip) return
    setSelectedChip(chip)

    if (chip === 'All') {
      router.push('/')
      return
    }

    if (chip === 'Recently uploaded') {
      router.push('/')
      return
    }

    router.push(`/?q=${encodeURIComponent(chip)}`)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSelectedChip('All')
    router.push('/')
  }

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)

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
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* YouTube Style Horizontal Topic Filter Chips Bar */}
      <div className="sticky top-14 z-30 bg-[#0f0f0f]/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-[#272727]">
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth">
          {TOPIC_CHIPS.map((chip) => {
            const isActive =
              (chip === 'All' && !searchQuery) ||
              selectedChip === chip ||
              (searchQuery && searchQuery.toLowerCase() === chip.toLowerCase())

            return (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#272727] text-[#f1f1f1] hover:bg-[#383838]'
                }`}
              >
                {chip}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Search Filter Chip if Search Query exists */}
      {searchQuery && (
        <div className="flex items-center justify-between gap-2 pt-1 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Search results for:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#272727] text-white border border-[#3e3e3e]">
              &quot;{searchQuery}&quot;
              <button onClick={handleClearSearch} className="hover:text-red-400" aria-label="Clear filter">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
          <span className="text-xs text-zinc-500 font-medium">
            {total} video{total === 1 ? '' : 's'} found
          </span>
        </div>
      )}

      {/* Responsive Videos Grid */}
      <VideoGrid
        videos={videos}
        isLoading={isFiltering}
        emptyMessage={
          searchQuery
            ? `No videos found matching "${searchQuery}". Try different keywords or browse all videos.`
            : 'No public videos available yet. Be the first creator to upload!'
        }
      />

      {/* Pagination / Load More */}
      {hasMore && (
        <div className="pt-8 pb-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-[#272727] hover:bg-[#383838] border border-[#383838] text-white rounded-full font-medium text-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>Load more videos</span>
            )}
          </button>
          {total > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Showing {videos.length} of {total} videos
            </p>
          )}
        </div>
      )}
    </div>
  )
}