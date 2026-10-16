'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { getMyVideos } from '@/lib/api'
import { formatDuration, formatDate, formatRelativeTime } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Video as VideoIcon,
  Upload,
  Globe,
  Link2,
  Lock,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  X,
  ImageIcon,
  Plus,
} from 'lucide-react'
import type { Video, VideoVisibility } from '@/types'
import { getSupabaseBrowserClient, getPublicUrl } from '@/lib/supabase'

export default function MyVideosPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const { toast } = useToast()

  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterVisibility, setFilterVisibility] = useState<'all' | VideoVisibility>('all')

  // Edit Video Modal State
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editVisibility, setEditVisibility] = useState<VideoVisibility>('public')
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null)
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Delete Video State
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/my-videos')
    }
  }, [user, isAuthLoading, router])

  const loadVideos = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await getMyVideos(user.id)
      setVideos(data)
    } catch (err) {
      console.error('Error loading my videos:', err)
      toast('Failed to load your videos.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    if (user) {
      loadVideos()
    }
  }, [user, loadVideos])

  // Open Edit Dialog
  const handleOpenEdit = (video: Video) => {
    setEditingVideo(video)
    setEditTitle(video.title)
    setEditDescription(video.description || '')
    setEditVisibility(video.visibility)
    setEditThumbnailFile(null)
    setEditThumbnailPreview(video.thumbnail_url || null)
  }

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVideo) return

    if (!editTitle.trim()) {
      toast('Title cannot be empty.', 'error')
      return
    }

    setIsUpdating(true)
    try {
      let newThumbnailUrl = editingVideo.thumbnail_url
      let newThumbnailPath = editingVideo.thumbnail_path

      // If user selected a new thumbnail
      if (editThumbnailFile && user) {
        const supabase = getSupabaseBrowserClient()
        const ext = editThumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/${editingVideo.id}_thumb_${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(path, editThumbnailFile, { upsert: true })

        if (uploadError) throw uploadError

        newThumbnailPath = path
        newThumbnailUrl = getPublicUrl('thumbnails', path)
      }

      const res = await fetch(`/api/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          visibility: editVisibility,
          thumbnail_url: newThumbnailUrl,
          thumbnail_path: newThumbnailPath,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update video.')
      }

      setVideos((prev) =>
        prev.map((v) => (v.id === editingVideo.id ? (result.video as Video) : v))
      )
      toast('Video updated successfully!', 'success')
      setEditingVideo(null)
    } catch (err) {
      console.error('Update error:', err)
      toast(err instanceof Error ? err.message : 'Failed to update video.', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  // Confirm and Execute Delete
  const handleDeleteConfirm = async () => {
    if (!deletingVideo) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/videos/${deletingVideo.id}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete video.')
      }

      setVideos((prev) => prev.filter((v) => v.id !== deletingVideo.id))
      toast('Video deleted successfully.', 'success')
      setDeletingVideo(null)
    } catch (err) {
      console.error('Delete error:', err)
      toast(err instanceof Error ? err.message : 'Failed to delete video.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredVideos = videos.filter((v) => {
    if (filterVisibility === 'all') return true
    return v.visibility === filterVisibility
  })

  const publicCount = videos.filter((v) => v.visibility === 'public').length
  const unlistedCount = videos.filter((v) => v.visibility === 'unlisted').length
  const privateCount = videos.filter((v) => v.visibility === 'private').length

  if (isAuthLoading || (isLoading && !videos.length)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <VideoIcon className="h-8 w-8 text-indigo-500" />
              <span>My Videos</span>
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage your uploads, edit titles, adjust privacy visibility, and delete content.
            </p>
          </div>

          <Link href="/upload">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-600/25">
              <Plus className="h-4 w-4" />
              <span>Upload New Video</span>
            </Button>
          </Link>
        </div>

        {/* Visibility Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterVisibility('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterVisibility === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850 border border-gray-800'
            }`}
          >
            All Videos ({videos.length})
          </button>

          <button
            onClick={() => setFilterVisibility('public')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              filterVisibility === 'public'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850 border border-gray-800'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-400" />
            <span>Public ({publicCount})</span>
          </button>

          <button
            onClick={() => setFilterVisibility('unlisted')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              filterVisibility === 'unlisted'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850 border border-gray-800'
            }`}
          >
            <Link2 className="h-3.5 w-3.5 text-amber-400" />
            <span>Unlisted ({unlistedCount})</span>
          </button>

          <button
            onClick={() => setFilterVisibility('private')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              filterVisibility === 'private'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850 border border-gray-800'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-rose-400" />
            <span>Private ({privateCount})</span>
          </button>
        </div>

        {/* Video List */}
        {filteredVideos.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-gray-900/50 border border-gray-800/80 p-8">
            <VideoIcon className="mx-auto h-12 w-12 text-gray-600 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No videos found</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              {filterVisibility === 'all'
                ? "You haven't uploaded any videos yet. Share your first video with the community!"
                : `You don't have any ${filterVisibility} videos at the moment.`}
            </p>
            <Link href="/upload">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <Upload className="h-4 w-4" />
                <span>Upload a Video</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-gray-900/80 border border-gray-800 hover:border-gray-700/80 transition-all shadow-sm"
              >
                {/* Thumbnail */}
                <Link
                  href={`/video/${video.id}`}
                  className="relative w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-gray-800 shrink-0 group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <VideoIcon className="h-8 w-8" />
                    </div>
                  )}
                  {video.duration ? (
                    <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </span>
                  ) : null}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {video.visibility === 'public' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                        <Globe className="h-3 w-3" /> Public
                      </span>
                    )}
                    {video.visibility === 'unlisted' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full">
                        <Link2 className="h-3 w-3" /> Unlisted
                      </span>
                    )}
                    {video.visibility === 'private' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    )}

                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">Uploaded {formatDate(video.created_at)}</span>
                  </div>

                  <Link
                    href={`/video/${video.id}`}
                    className="block font-semibold text-white hover:text-indigo-400 transition-colors truncate"
                  >
                    {video.title}
                  </Link>

                  <p className="text-xs text-gray-400 line-clamp-1">
                    {video.description || 'No description provided.'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-gray-800 pt-3 sm:pt-0 shrink-0">
                  <Link href={`/video/${video.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-300 hover:text-white hover:bg-gray-800 gap-1.5"
                      title="Watch Video"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sm:hidden">Watch</span>
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(video)}
                    className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-1.5"
                    title="Edit Video"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingVideo(video)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                    title="Delete Video"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sm:hidden">Delete</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-400" />
                <span>Edit Video Details</span>
              </h3>
              <button
                onClick={() => setEditingVideo(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5" htmlFor="edit-title">
                  Title
                </label>
                <Input
                  id="edit-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5" htmlFor="edit-desc">
                  Description
                </label>
                <Textarea
                  id="edit-desc"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-indigo-500"
                />
              </div>

              {/* Visibility Options */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVisibility('public')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'public'
                        ? 'border-indigo-500 bg-indigo-950/30 text-white'
                        : 'border-gray-800 bg-gray-850 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-white mb-0.5">
                      <Globe className="h-3.5 w-3.5 text-emerald-400" /> Public
                    </div>
                    <span>Everyone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVisibility('unlisted')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'unlisted'
                        ? 'border-indigo-500 bg-indigo-950/30 text-white'
                        : 'border-gray-850 bg-gray-850 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-white mb-0.5">
                      <Link2 className="h-3.5 w-3.5 text-amber-400" /> Unlisted
                    </div>
                    <span>Link only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVisibility('private')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'private'
                        ? 'border-indigo-500 bg-indigo-950/30 text-white'
                        : 'border-gray-850 bg-gray-850 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-white mb-0.5">
                      <Lock className="h-3.5 w-3.5 text-rose-400" /> Private
                    </div>
                    <span>Only you</span>
                  </button>
                </div>
              </div>

              {/* Optional Thumbnail Change */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Update Thumbnail
                </label>
                <div className="flex items-center gap-4">
                  {editThumbnailPreview && (
                    <div className="w-24 aspect-video rounded-lg overflow-hidden bg-gray-800 border border-gray-700 shrink-0">
                      <img
                        src={editThumbnailPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setEditThumbnailFile(file)
                        setEditThumbnailPreview(URL.createObjectURL(file))
                      }
                    }}
                    className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => setEditingVideo(null)}
                  className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingVideo}
        title="Delete Video"
        message={`Are you sure you want to delete "${deletingVideo?.title}"? This action cannot be undone and will permanently remove the video file and its thumbnail.`}
        confirmText="Delete Video"
        cancelText="Keep Video"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingVideo(null)}
      />
    </div>
  )
}
