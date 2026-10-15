import { Metadata } from 'next'
import { getVideos } from '@/lib/api'
import type { Video, PaginatedResponse } from '@/types'
import { Suspense } from 'react'
import { HomePageClient } from './HomePageClient'
import { SearchBarClient } from './SearchBarClient'
import { VideoGridSkeleton } from '@/components/video/VideoGridSkeleton'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Home',
  }
}

async function VideoList() {
  const result: PaginatedResponse<Video> = await getVideos({ query: '', page: 1, limit: 20 })

  return (
    <HomePageClient
      initialVideos={result.data}
      initialHasMore={result.hasMore}
      initialTotal={result.total}
    />
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Videos</h1>
          <p className="text-gray-400">Discover and watch amazing content</p>
        </div>

        <div className="mb-8">
          <SearchBarClient />
        </div>

        <Suspense fallback={<VideoGridSkeleton />}>
          <VideoList />
        </Suspense>
      </div>
    </div>
  )
}