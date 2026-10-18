'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatDate } from '@/lib/utils'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  User as UserIcon,
  Calendar,
  Film,
  Edit3,
  X,
  Loader2,
  Bell,
  Play,
  Upload,
  TrendingUp,
  Coins,
} from 'lucide-react'
import type { Profile, Video } from '@/types'
import { getSupabaseBrowserClient, getPublicUrl } from '@/lib/supabase'

interface ProfileClientProps {
  profile: Profile
  initialVideos: Video[]
  streamerRevenue?: number
}

export function ProfileClient({
  profile: initialProfile,
  initialVideos,
  streamerRevenue: initialRevenue = 0,
}: ProfileClientProps) {
  const { user, refreshProfile } = useAuth()
  const { toast } = useToast()

  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [videos] = useState<Video[]>(initialVideos)
  const [streamerRevenue, setStreamerRevenue] = useState<number>(initialRevenue)
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Synchronize / fetch verified streamer earnings
  useEffect(() => {
    let isMounted = true
    const fetchEarnings = async () => {
      try {
        const res = await fetch(`/api/profile?userId=${profile.id}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            if (typeof data.streamerRevenue === 'number') {
              setStreamerRevenue(data.streamerRevenue)
            }
            if (data.profile) {
              setProfile((prev) => ({ ...prev, ...data.profile }))
            }
          }
        }
      } catch (err) {
        console.error('Failed to load profile earnings:', err)
      }
    }
    fetchEarnings()
    return () => {
      isMounted = false
    }
  }, [profile.id])

  // Edit Profile Modal
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null)
  const [isSaving, setIsSaving] = useState(false)

  const isOwner = user?.id === profile.id

  const handleSubscribeToggle = () => {
    setIsSubscribed(!isSubscribed)
    toast(
      !isSubscribed
        ? `Subscribed to ${profile.display_name || profile.username}!`
        : `Unsubscribed from ${profile.display_name || profile.username}`,
      'info'
    )
  }

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
    <div className="min-h-screen bg-[#0f0f0f] py-6 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* YouTube Channel Banner & Header */}
        <div className="rounded-3xl bg-gradient-to-r from-[#1c1c1c] via-[#242424] to-[#1a1a1a] border border-[#272727] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Channel Avatar */}
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={name}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover ring-2 ring-white/10 shadow-xl"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-3xl sm:text-4xl font-black uppercase shadow-xl ring-2 ring-white/10">
                    {name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Channel Info */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f1f1f1] tracking-tight">{name}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#aaaaaa]">
                  <span className="font-semibold text-zinc-300">@{profile.username}</span>
                  <span>•</span>
                  <span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}</span>
                  <span>•</span>
                  <span>Joined {formatDate(profile.created_at)}</span>
                </div>

                {profile.bio && (
                  <p className="text-xs sm:text-sm text-zinc-300 max-w-xl whitespace-pre-line pt-1 leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* User Wallet Coins, Streamer Revenue and Live Chat Status */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs shadow-sm" title="Your current wallet coin balance">
                    <span className="text-sm">🪙</span>
                    <span>{profile.coin_balance ?? 50} Coins</span>
                  </div>

                  {/* Streamer Revenue Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs shadow-sm" title="Total lifetime coins earned from live streams and chat super emojis">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <span>🪙 {streamerRevenue} Coins Earned</span>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      profile.chat_enabled !== false
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.chat_enabled !== false ? 'bg-blue-400' : 'bg-red-500'}`} />
                    <span>{profile.chat_enabled !== false ? 'Live Chat Active' : 'Chat Muted by Admin'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Owner Customize OR Visitor Subscribe */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {isOwner ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Customize Channel</span>
                  </button>

                  <Link href="/my-videos">
                    <button className="px-4 py-2 bg-[#272727] hover:bg-[#383838] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5">
                      <Film className="h-3.5 w-3.5" />
                      <span>Manage Videos</span>
                    </button>
                  </Link>
                </>
              ) : (
                <button
                  onClick={handleSubscribeToggle}
                  className={`px-5 py-2 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
                    isSubscribed
                      ? 'bg-[#272727] text-white hover:bg-[#383838]'
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  {isSubscribed ? (
                    <>
                      <Bell className="h-3.5 w-3.5" />
                      <span>Subscribed</span>
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Channel Navigation Tab */}
        <div className="border-b border-[#272727] flex items-center gap-8 px-2 text-sm font-semibold text-white">
          <div className="border-b-2 border-white pb-3 cursor-pointer">
            Videos
          </div>
        </div>

        {/* Videos Grid */}
        <div>
          <VideoGrid
            videos={videos}
            emptyMessage={`${name} has not published any public videos yet.`}
          />
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#212121] border border-[#333333] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-[#ff0000]" />
                <span>Customize Channel</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-full"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="edit-name">
                  Channel Name
                </label>
                <Input
                  id="edit-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="edit-bio">
                  Channel Description (Bio)
                </label>
                <Textarea
                  id="edit-bio"
                  rows={3}
                  placeholder="Tell viewers about your channel..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-14 h-14 rounded-full object-cover ring-1 ring-zinc-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#181818] flex items-center justify-center text-zinc-500">
                      <UserIcon className="h-6 w-6" />
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
                    className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#272727] file:text-zinc-200 hover:file:bg-[#383838] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#333333]">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-[#2e2e2e] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
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
    </div>
  )
}
