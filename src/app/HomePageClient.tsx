'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { VideoGrid } from '@/components/video/VideoGrid'
import { LiveCard } from '@/components/live/LiveCard'
import { getVideos } from '@/lib/api'
import type { Video } from '@/types'
import type { LiveStreamRow, ProfileRow } from '@/types/database'
import { Loader2, X, Radio, ArrowRight } from 'lucide-react'

interface HomePageClientProps {
  initialVideos: Video[]
  initialHasMore: boolean
  initialTotal: number
  initialQuery?: string
  initialLiveStreams?: (LiveStreamRow & { profiles?: ProfileRow | null })[]
}

const TOPIC_CHIPS = [
  'All',
  'Live',
  'Gaming',
  'Music',
  'Coding',
  'Podcasts',
  'Trailers',
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
  initialLiveStreams = [],
}: HomePageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [liveStreams, setLiveStreams] = useState<(LiveStreamRow & { profiles?: ProfileRow | null })[]>(
    initialLiveStreams
  )
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

  // Periodic refresh & focus refresh for live streams to immediately eliminate ended ghosts
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch('/api/live?status=live&limit=6')
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setLiveStreams(json.data)
          }
        }
      } catch (e) {
        console.error('Failed to poll live streams:', e)
      }
    }

    const interval = setInterval(fetchLive, 8000)
    window.addEventListener('focus', fetchLive)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', fetchLive)
    }
  }, [])

  const handleChipClick = async (chip: string) => {
    if (chip === selectedChip) return
    setSelectedChip(chip)

    if (chip === 'All' || chip === 'Live' || chip === 'Recently uploaded') {
      if (searchQuery) {
        router.push('/')
      }
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

  const isLiveTabSelected = selectedChip === 'Live'

  return (
    <div className="space-y-6">
      {/* YouTube Style Horizontal Topic Filter Chips Bar */}
      <div className="sticky top-14 z-30 bg-[#0f0f0f]/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-[#272727]">
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth">
          {TOPIC_CHIPS.map((chip) => {
            const isActive =
              (chip === 'All' && !searchQuery && selectedChip === 'All') ||
              selectedChip === chip ||
              (searchQuery && searchQuery.toLowerCase() === chip.toLowerCase())

            return (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#272727] text-[#f1f1f1] hover:bg-[#383838]'
                }`}
              >
                {chip === 'Live' && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-red-600 animate-ping' : 'bg-red-500'
                    }`}
                  />
                )}
                <span>{chip}</span>
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

      {/* Live Now Section (Shown when no search query or on Live tab) */}
      {!searchQuery && (
        <>
          {liveStreams.length > 0 ? (
            <section className="space-y-4 pt-1 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-600/10 text-red-500">
                    <Radio className="h-4 w-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      Live Now
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
                        {liveStreams.length} LIVE
                      </span>
                    </h2>
                  </div>
                </div>

                <Link
                  href="/go-live"
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                >
                  <span>Start your live stream</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Live Streams Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                {liveStreams.map((stream) => (
                  <LiveCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : isLiveTabSelected ? (
            /* Friendly Empty State for Live Streams */
            <div className="py-16 text-center space-y-3 bg-[#141414] rounded-3xl border border-[#272727] p-8 max-w-xl mx-auto my-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <Radio className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">No streams are live right now</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                There are currently no active public broadcasts. Be the first creator to start a live stream!
              </p>
              <div className="pt-2">
                <Link
                  href="/go-live"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-full transition-colors shadow-lg shadow-red-900/20"
                >
                  <Radio className="h-4 w-4" />
                  <span>Go Live Now</span>
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Responsive Videos Grid (Only if not exclusively viewing empty live tab) */}
      {(!isLiveTabSelected || liveStreams.length > 0) && (
        <section className="space-y-4">
          {!searchQuery && liveStreams.length > 0 && (
            <div className="border-t border-[#272727] pt-6">
              <h2 className="text-lg font-bold text-white tracking-tight pb-3">Recommended Videos</h2>
            </div>
          )}

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
        </section>
      )}
    </div>
  )
}