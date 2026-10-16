import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getVideoById, getRelatedVideos } from '@/lib/api'
import { VideoPlayerPageClient } from './VideoPlayerClient'
import { Lock, ArrowLeft, Home, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const { video } = await getVideoById(id)

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
  const { video, isPrivateRestricted } = await getVideoById(id)

  if (isPrivateRestricted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gray-950">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/5">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Private Video</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              This video is private and only viewable by its uploader. If you are the owner, please sign in to the corresponding account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2">
                <Home className="h-4 w-4" />
                <span>Explore Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!video) {
    notFound()
  }

  const relatedVideos = await getRelatedVideos(id, 8)

  return <VideoPlayerPageClient video={video} relatedVideos={relatedVideos} />
}