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
  Plus,
  SlidersHorizontal,
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
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff0000]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Studio Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#272727]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f1f1f1] tracking-tight flex items-center gap-3">
              <VideoIcon className="h-7 w-7 text-[#ff0000]" />
              <span>Channel Content</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              Manage video privacy, edit titles, and organize your channel catalog.
            </p>
          </div>

          <Link href="/upload">
            <button className="px-4 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-sm font-semibold rounded-full transition-colors flex items-center gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Upload Video</span>
            </button>
          </Link>
        </div>

        {/* Studio Visibility Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#272727] pb-3">
          <button
            onClick={() => setFilterVisibility('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterVisibility === 'all'
                ? 'bg-white text-black font-bold'
                : 'bg-[#272727] text-zinc-300 hover:bg-[#383838]'
            }`}
          >
            All ({videos.length})
          </button>

          <button
            onClick={() => setFilterVisibility('public')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterVisibility === 'public'
                ? 'bg-white text-black font-bold'
                : 'bg-[#272727] text-zinc-300 hover:bg-[#383838]'
            }`}
          >
            <Globe className="h-3 w-3 text-emerald-400" />
            <span>Public ({publicCount})</span>
          </button>

          <button
            onClick={() => setFilterVisibility('unlisted')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterVisibility === 'unlisted'
                ? 'bg-white text-black font-bold'
                : 'bg-[#272727] text-zinc-300 hover:bg-[#383838]'
            }`}
          >
            <Link2 className="h-3 w-3 text-amber-400" />
            <span>Unlisted ({unlistedCount})</span>
          </button>

          <button
            onClick={() => setFilterVisibility('private')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterVisibility === 'private'
                ? 'bg-white text-black font-bold'
                : 'bg-[#272727] text-zinc-300 hover:bg-[#383838]'
            }`}
          >
            <Lock className="h-3 w-3 text-rose-400" />
            <span>Private ({privateCount})</span>
          </button>
        </div>

        {/* Video List */}
        {filteredVideos.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-[#191919] border border-[#272727] p-8">
            <VideoIcon className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No videos found</h3>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto mb-6">
              {filterVisibility === 'all'
                ? "You haven't uploaded any videos yet. Upload your first video to get started!"
                : `You don't have any ${filterVisibility} videos at the moment.`}
            </p>
            <Link href="/upload">
              <button className="px-5 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-sm font-semibold rounded-full transition-colors inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Upload a Video</span>
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-2xl bg-[#181818] border border-[#272727] hover:border-[#383838] transition-all"
              >
                {/* 16:9 Thumbnail */}
                <Link
                  href={`/video/${video.id}`}
                  className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-black shrink-0 group focus:outline-none"
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-[#222222]">
                      <VideoIcon className="h-7 w-7" />
                    </div>
                  )}
                  {video.duration ? (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </span>
                  ) : null}
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {video.visibility === 'public' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full">
                        <Globe className="h-3 w-3" /> Public
                      </span>
                    )}
                    {video.visibility === 'unlisted' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full">
                        <Link2 className="h-3 w-3" /> Unlisted
                      </span>
                    )}
                    {video.visibility === 'private' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-950/80 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    )}

                    <span className="text-xs text-zinc-500">•</span>
                    <span className="text-xs text-zinc-400">Uploaded {formatDate(video.created_at)}</span>
                  </div>

                  <Link
                    href={`/video/${video.id}`}
                    className="block font-semibold text-sm text-[#f1f1f1] hover:text-white hover:underline transition-colors truncate"
                  >
                    {video.title}
                  </Link>

                  <p className="text-xs text-zinc-400 line-clamp-1">
                    {video.description || 'No description provided.'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-[#272727] pt-2.5 sm:pt-0 shrink-0">
                  <Link href={`/video/${video.id}`}>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-[#272727] hover:bg-[#383838] rounded-full transition-colors flex items-center gap-1.5"
                      title="Watch Video"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Watch</span>
                    </button>
                  </Link>

                  <button
                    onClick={() => handleOpenEdit(video)}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-[#272727] hover:bg-[#383838] rounded-full transition-colors flex items-center gap-1.5"
                    title="Edit Details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setDeletingVideo(video)}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-colors"
                    title="Delete Video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#212121] border border-[#333333] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-[#ff0000]" />
                <span>Video Details</span>
              </h3>
              <button
                onClick={() => setEditingVideo(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-full"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="edit-title">
                  Title (required)
                </label>
                <Input
                  id="edit-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="edit-desc">
                  Description
                </label>
                <Textarea
                  id="edit-desc"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              {/* Visibility Options */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVisibility('public')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'public'
                        ? 'border-white bg-[#2e2e2e] text-white font-semibold'
                        : 'border-[#333333] bg-[#181818] text-zinc-400 hover:border-[#444444]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-white mb-0.5">
                      <Globe className="h-3.5 w-3.5 text-emerald-400" /> Public
                    </div>
                    <span className="text-[11px] text-zinc-400">Everyone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVisibility('unlisted')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'unlisted'
                        ? 'border-white bg-[#2e2e2e] text-white font-semibold'
                        : 'border-[#333333] bg-[#181818] text-zinc-400 hover:border-[#444444]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-white mb-0.5">
                      <Link2 className="h-3.5 w-3.5 text-amber-400" /> Unlisted
                    </div>
                    <span className="text-[11px] text-zinc-400">Link only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditVisibility('private')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      editVisibility === 'private'
                        ? 'border-white bg-[#2e2e2e] text-white font-semibold'
                        : 'border-[#333333] bg-[#181818] text-zinc-400 hover:border-[#444444]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-white mb-0.5">
                      <Lock className="h-3.5 w-3.5 text-rose-400" /> Private
                    </div>
                    <span className="text-[11px] text-zinc-400">Only you</span>
                  </button>
                </div>
              </div>

              {/* Optional Thumbnail Change */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Thumbnail
                </label>
                <div className="flex items-center gap-3">
                  {editThumbnailPreview && (
                    <div className="w-24 aspect-video rounded-lg overflow-hidden bg-black border border-[#383838] shrink-0">
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
                    className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#272727] file:text-zinc-200 hover:file:bg-[#383838] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setEditingVideo(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-[#2e2e2e] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingVideo}
        title="Delete Video"
        message={`Delete "${deletingVideo?.title}" permanently? You won't be able to undo this.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingVideo(null)}
      />
    </div>
  )
}
