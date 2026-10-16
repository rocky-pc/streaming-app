import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { Video, PaginatedResponse, SearchParams, Profile, VideoUpdatePayload } from '@/types'

// Helper to get either provided client or browser client
function getClient(customClient?: any) {
  return customClient || getSupabaseBrowserClient()
}

/**
 * Get public videos for home page with title/description search and pagination
 */
export async function getVideos(
  params: SearchParams = {},
  customClient?: any
): Promise<PaginatedResponse<Video>> {
  const client = getClient(customClient)
  const { query, page = 1, limit = 12 } = params
  const from = (page - 1) * limit
  const to = from + limit - 1

  let queryBuilder = client
    .from('videos')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)', { count: 'exact' })
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query && query.trim()) {
    const q = query.trim()
    queryBuilder = queryBuilder.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data, error, count } = await queryBuilder

  if (error) {
    console.error('Error fetching videos:', error)
    throw new Error(error.message)
  }

  return {
    data: (data || []) as Video[],
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > to + 1,
  }
}

/**
 * Get video by ID (handles public, unlisted, and private authorization)
 */
export async function getVideoById(
  id: string,
  customClient?: any
): Promise<{ video: Video | null; isPrivateRestricted?: boolean }> {
  const client = getClient(customClient)

  const { data, error } = await client
    .from('videos')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { video: null }
    console.warn('Error fetching video by id:', error.message)
    return { video: null, isPrivateRestricted: true }
  }

  if (!data) return { video: null }

  const video = data as Video

  // Check if private video
  if (video.visibility === 'private') {
    const { data: { user } } = await client.auth.getUser()
    if (!user || user.id !== video.user_id) {
      return { video: null, isPrivateRestricted: true }
    }
    // Generate signed playback URL for private video
    const { data: signedData } = await client.storage
      .from('videos')
      .createSignedUrl(video.storage_path, 7200)

    if (signedData?.signedUrl) {
      video.signed_playback_url = signedData.signedUrl
    }
  }

  return { video }
}

/**
 * Get related public videos
 */
export async function getRelatedVideos(
  currentVideoId: string,
  limit = 8,
  customClient?: any
): Promise<Video[]> {
  const client = getClient(customClient)

  const { data, error } = await client
    .from('videos')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('visibility', 'public')
    .neq('id', currentVideoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching related videos:', error)
    return []
  }

  return (data || []) as Video[]
}

/**
 * Get videos for My Videos page (current logged in user: all visibilities)
 */
export async function getMyVideos(
  userId: string,
  customClient?: any
): Promise<Video[]> {
  const client = getClient(customClient)

  const { data, error } = await client
    .from('videos')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my videos:', error)
    throw new Error(error.message)
  }

  return (data || []) as Video[]
}

/**
 * Get user's public videos for profile page
 */
export async function getUserPublicVideos(
  userId: string,
  customClient?: any
): Promise<Video[]> {
  const client = getClient(customClient)

  const { data, error } = await client
    .from('videos')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user public videos:', error)
    return []
  }

  return (data || []) as Video[]
}

/**
 * Get user profile by ID or username
 */
export async function getUserProfile(
  identifier: string,
  customClient?: any
): Promise<Profile | null> {
  const client = getClient(customClient)

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

  let queryBuilder = client.from('profiles').select('*')
  if (isUuid) {
    queryBuilder = queryBuilder.eq('id', identifier)
  } else {
    queryBuilder = queryBuilder.eq('username', identifier.toLowerCase())
  }

  const { data, error } = await queryBuilder.single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching user profile:', error)
    return null
  }

  return data as Profile
}

/**
 * Get streamer lifetime coin revenue earned from live stream chats and super emojis
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserStreamerRevenue(userId: string, customClient?: any): Promise<number> {
  const client = getClient(customClient)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'streamer_earning')

  if (error || !data) return 0
  return data.reduce((acc: number, tx: { amount?: number }) => acc + (tx.amount || 0), 0)
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Profile>,
  customClient?: any
): Promise<Profile> {
  const client = getClient(customClient)

  const { data, error } = await (client as any)
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Profile
}

/**
 * Update video metadata (title, description, visibility, etc.)
 */
export async function updateVideo(
  id: string,
  updates: VideoUpdatePayload,
  customClient?: any
): Promise<Video> {
  const client = getClient(customClient)

  const { data, error } = await (client as any)
    .from('videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Video
}

/**
 * Delete a video and its associated storage files
 */
export async function deleteVideo(
  id: string,
  storagePath?: string,
  thumbnailPath?: string,
  customClient?: any
): Promise<void> {
  const client = getClient(customClient)

  // 1. Delete from database
  const { error: dbError } = await client.from('videos').delete().eq('id', id)
  if (dbError) {
    throw new Error(dbError.message)
  }

  // 2. Clean up storage files (non-blocking)
  try {
    if (storagePath) {
      await client.storage.from('videos').remove([storagePath])
    }
    if (thumbnailPath) {
      await client.storage.from('thumbnails').remove([thumbnailPath])
    }
  } catch (storageErr) {
    console.warn('Failed to clean up storage files on delete:', storageErr)
  }
}