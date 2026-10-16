'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatDate } from '@/lib/utils'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  User as UserIcon,
  Calendar,
  Film,
  Edit3,
  X,
  Upload,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import type { Profile, Video } from '@/types'
import { getSupabaseBrowserClient, getPublicUrl } from '@/lib/supabase'

interface ProfileClientProps {
  profile: Profile
  initialVideos: Video[]
}

export function ProfileClient({ profile: initialProfile, initialVideos }: ProfileClientProps) {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [videos] = useState<Video[]>(initialVideos)

  // Edit Profile Modal
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null)
  const [isSaving, setIsSaving] = useState(false)

  const isOwner = user?.id === profile.id

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      let avatarUrl = profile.avatar_url

      if (avatarFile && user) {
        const supabase = getSupabaseBrowserClient()
        const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const avatarPath = `${user.id}/avatar_${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('thumbnails')
          .upload(avatarPath, avatarFile, { upsert: true })

        if (uploadError) throw uploadError

        avatarUrl = getPublicUrl('thumbnails', avatarPath)
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.')
      }

      setProfile(data.profile)
      await refreshProfile()
      toast('Profile updated successfully!', 'success')
      setIsEditing(false)
    } catch (err) {
      console.error('Profile update error:', err)
      toast(err instanceof Error ? err.message : 'Failed to update profile.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const name = profile.display_name || profile.username

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Profile Card Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-950/40 via-gray-900 to-gray-900 border border-gray-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover ring-2 ring-indigo-500 shadow-xl"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-extrabold uppercase shadow-xl ring-2 ring-indigo-500/50">
                    {name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Bio & Details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{name}</h1>
                  {isOwner && (
                    <span className="text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-400">@{profile.username}</p>

                {profile.bio && (
                  <p className="text-sm text-gray-300 max-w-xl whitespace-pre-line pt-1 leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-2">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    Joined {formatDate(profile.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5 text-indigo-400" />
                    {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Actions */}
            {isOwner && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-gray-700 text-gray-200 hover:text-white hover:bg-gray-800 gap-2 w-full sm:w-auto"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Profile</span>
                </Button>
                <Link href="/my-videos" className="hidden sm:block">
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    Manage Videos
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* User's Videos Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Film className="h-5 w-5 text-indigo-500" />
              <span>Videos by {name}</span>
            </h2>
            <span className="text-xs text-gray-500 font-medium">
              {videos.length} public upload{videos.length === 1 ? '' : 's'}
            </span>
          </div>

          <VideoGrid
            videos={videos}
            emptyMessage={`${name} has not published any public videos yet.`}
          />
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-400" />
                <span>Edit Profile</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5" htmlFor="edit-name">
                  Display Name
                </label>
                <Input
                  id="edit-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5" htmlFor="edit-bio">
                  Bio
                </label>
                <Textarea
                  id="edit-bio"
                  rows={3}
                  placeholder="Share a short bio with your audience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-16 h-16 rounded-xl object-cover ring-1 ring-gray-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center text-gray-500">
                      <UserIcon className="h-8 w-8" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setAvatarFile(file)
                        setAvatarPreview(URL.createObjectURL(file))
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
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                >
                  {isSaving ? (
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
    </div>
  )
}
