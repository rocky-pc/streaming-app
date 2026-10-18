import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzM2MzMsImV4cCI6MjEwNzY0OTYzM30.default'
  return createBrowserClient<Database>(url, key)
}
