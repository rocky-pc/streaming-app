'use client'

import { useState } from 'react'
import { cn, formatDuration, formatDate } from '@/lib/utils'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { VideoCard } from '@/components/video/VideoCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CopyLink } from './CopyLink'
import { Share2, Download, MoreHorizontal, Clock, Eye, MessageSquare } from 'lucide-react'
import type { Video } from '@/types'

interface VideoPlayerPageClientProps {
  video: Video
  relatedVideos: Video[]
}

export function VideoPlayerPageClient({ video, relatedVideos }: VideoPlayerPageClientProps) {
  const [showDescription, setShowDescription] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <VideoPlayer
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              title={video.title}
            />

            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {video.duration ? formatDuration(video.duration) : 'Unknown duration'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        Uploaded {formatDate(video.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyLink video={video} />
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {video.description && (
                  <div className="mt-6 border-t border-gray-800 pt-6">
                    <div className={cn(
                      'prose prose-invert max-w-none',
                      !showDescription && 'line-clamp-3'
                    )}>
                      <p className="text-gray-300 whitespace-pre-wrap">{video.description}</p>
                    </div>
                    <button
                      onClick={() => setShowDescription(!showDescription)}
                      className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      {showDescription ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-base">Up Next</CardTitle>
                <CardDescription className="text-xs">{relatedVideos.length} videos</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {relatedVideos.map((relatedVideo, index) => (
                    <div key={relatedVideo.id} className="flex gap-3 group">
                      <div className="relative w-40 h-22.5 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                        {relatedVideo.thumbnail_url ? (
                          <img
                            src={relatedVideo.thumbnail_url}
                            alt={relatedVideo.title}
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                          </div>
                        )}
                        {relatedVideo.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                            {formatDuration(relatedVideo.duration)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white text-sm line-clamp-2 group-hover:text-indigo-400 transition-colors">
                          {relatedVideo.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(relatedVideo.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}