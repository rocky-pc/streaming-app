import { supabase } from '@/lib/supabase'
import type { Video, PaginatedResponse, SearchParams } from '@/types'

export async function getVideos(params: SearchParams = {}): Promise<PaginatedResponse<Video>> {
  const { query, page = 1, limit = 20 } = params
  const from = (page - 1) * limit
  const to = from + limit - 1

  let queryBuilder = supabase
    .from('videos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (query && query.trim()) {
    queryBuilder = queryBuilder.ilike('title', `%${query.trim()}%`)
  }

  const { data, error, count } = await queryBuilder

  if (error) {
    throw new Error(error.message)
  }

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > to + 1,
  }
}

export async function getVideoById(id: string): Promise<Video | null> {
  const { data, error } = await supabase.from('videos').select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data
}

export async function getRelatedVideos(currentVideoId: string, limit = 8): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .neq('id', currentVideoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function createVideo(video: Omit<Video, 'id' | 'created_at' | 'updated_at'>): Promise<Video> {
  const { data, error } = await supabase
    .from('videos')
    .insert(video as any)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from('videos').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}