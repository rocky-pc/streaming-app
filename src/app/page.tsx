import { Metadata } from 'next'
import { getVideos } from '@/lib/api'
import { getPublicLiveStreams } from '@/lib/live'
import { HomePageClient } from './HomePageClient'
import { Suspense } from 'react'
import { VideoGridSkeleton } from '@/components/video/VideoGridSkeleton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Watch, share, and discover public videos and live streams uploaded by the community.',
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const query = resolvedParams?.q || ''

  const [initialResult, liveStreams] = await Promise.all([
    getVideos({ query, page: 1, limit: 12 }),
    getPublicLiveStreams(6),
  ])

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Suspense fallback={<VideoGridSkeleton />}>
          <HomePageClient
            initialVideos={initialResult.data}
            initialHasMore={initialResult.hasMore}
            initialTotal={initialResult.total}
            initialQuery={query}
            initialLiveStreams={liveStreams}
          />
        </Suspense>
      </div>
    </div>
  )
}