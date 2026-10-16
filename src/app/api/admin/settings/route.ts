import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data: settings, error } = await supabase
      .from('platform_settings')
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const settingsMap: Record<string, string> = {}
    for (const s of settings || []) {
      settingsMap[s.key] = s.value
    }

    return NextResponse.json({
      settings: {
        signup_coin_bonus: parseInt(settingsMap['signup_coin_bonus'] || '50', 10),
        chat_cost_per_message: parseInt(settingsMap['chat_cost_per_message'] || '2', 10),
        streamer_revenue_percent: parseInt(settingsMap['streamer_revenue_percent'] || '70', 10),
      },
      raw: settings || [],
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch settings'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminSession(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { signup_coin_bonus, chat_cost_per_message, streamer_revenue_percent } = body || {}

    const supabase = createAdminClient()
    const upserts = []

    if (signup_coin_bonus !== undefined) {
      upserts.push({
        key: 'signup_coin_bonus',
        value: String(Math.max(0, parseInt(signup_coin_bonus, 10) || 0)),
        description: 'Initial coin bonus awarded to newly registered users',
        updated_at: new Date().toISOString(),
      })
    }

    if (chat_cost_per_message !== undefined) {
      upserts.push({
        key: 'chat_cost_per_message',
        value: String(Math.max(0, parseInt(chat_cost_per_message, 10) || 0)),
        description: 'Cost in coins per message sent in live stream chat',
        updated_at: new Date().toISOString(),
      })
    }

    if (streamer_revenue_percent !== undefined) {
      const pct = Math.min(100, Math.max(0, parseInt(streamer_revenue_percent, 10) || 0))
      upserts.push({
        key: 'streamer_revenue_percent',
        value: String(pct),
        description: 'Percentage of chat cost allocated to the broadcaster',
        updated_at: new Date().toISOString(),
      })
    }

    if (upserts.length > 0) {
      for (const item of upserts) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert(item, { onConflict: 'key' })
        if (error) throw error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Platform economics updated successfully',
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update settings'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
