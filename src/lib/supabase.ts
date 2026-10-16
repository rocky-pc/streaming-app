import { createClient as createBrowserClientInstance } from './supabase/client'

export const STORAGE_BUCKETS = {
  VIDEOS: 'videos',
  THUMBNAILS: 'thumbnails',
} as const

// Client-side singleton for browser usage
let browserClient: ReturnType<typeof createBrowserClientInstance> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    return createBrowserClientInstance()
  }
  if (!browserClient) {
    browserClient = createBrowserClientInstance()
  }
  return browserClient
}

export const supabase = getSupabaseBrowserClient()

export async function createSignedUploadUrl(bucket: string, path: string, expiresIn = 3600) {
  const client = getSupabaseBrowserClient()
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export function getPublicUrl(bucket: string, path: string) {
  const client = getSupabaseBrowserClient()
  const { data } = client.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}