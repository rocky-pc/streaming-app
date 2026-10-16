import { Metadata } from 'next'
import { getVideos } from '@/lib/api'
import { HomePageClient } from './HomePageClient'
import { Suspense } from 'react'
import { VideoGridSkeleton } from '@/components/video/VideoGridSkeleton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Explore & Stream Videos',
  description: 'Watch, share, and discover public videos uploaded by the community.',
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const query = resolvedParams?.q || ''

  const initialResult = await getVideos({ query, page: 1, limit: 12 })

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<VideoGridSkeleton />}>
          <HomePageClient
            initialVideos={initialResult.data}
            initialHasMore={initialResult.hasMore}
            initialTotal={initialResult.total}
            initialQuery={query}
          />
        </Suspense>
      </div>
    </div>
  )
}