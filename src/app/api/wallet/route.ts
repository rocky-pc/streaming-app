import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseServer = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sahwiyxzktslxlmkldrt.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaHdpeXh6a3RzbHhsbWtsZHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA3MzYzMywiZXhwIjoyMTA3NjQ5NjMzfQ.En4Jl2jBL_XnLDp79y07DPblqh9M1asP_9AQ_GBCNLE'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseService = createClient<any>(supabaseUrl, supabaseServiceKey)

    const [profileRes, txRes] = await Promise.all([
      supabaseService
        .from('profiles')
        .select('id, username, display_name, avatar_url, coin_balance, chat_enabled')
        .eq('id', user.id)
        .single(),
      supabaseService
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    return NextResponse.json({
      coin_balance: profileRes.data?.coin_balance ?? 0,
      chat_enabled: profileRes.data?.chat_enabled ?? true,
      transactions: txRes.data || [],
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch wallet'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
