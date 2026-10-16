import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
