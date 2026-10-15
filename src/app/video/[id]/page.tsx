import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVideoById, getRelatedVideos } from '@/lib/api'
import { VideoPlayerPageClient } from './VideoPlayerClient'
import type { Video } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const video = await getVideoById(id)
  
  if (!video) {
    return { title: 'Video Not Found' }
  }

  return {
    title: video.title,
    description: video.description || undefined,
    openGraph: {
      type: 'video.other',
      title: video.title,
      description: video.description || undefined,
      videos: [
        {
          url: video.video_url,
          type: video.mime_type || 'video/mp4',
          width: 1280,
          height: 720,
        },
      ],
      images: video.thumbnail_url ? [{ url: video.thumbnail_url }] : [],
    },
    twitter: {
      card: 'player',
      title: video.title,
      description: video.description || undefined,
      images: video.thumbnail_url ? [video.thumbnail_url] : [],
    },
  }
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params
  const [video, relatedVideos] = await Promise.all([
    getVideoById(id),
    getRelatedVideos(id, 8),
  ])

  if (!video) {
    notFound()
  }

  return <VideoPlayerPageClient video={video} relatedVideos={relatedVideos} />
}