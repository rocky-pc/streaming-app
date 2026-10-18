import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export const DEFAULT_PAID_EMOJIS = [
  { emoji: '❤️', cost: 5 },
  { emoji: '🔥', cost: 10 },
  { emoji: '👏', cost: 15 },
  { emoji: '🎉', cost: 25 },
  { emoji: '💎', cost: 50 },
  { emoji: '🚀', cost: 100 },
  { emoji: '👑', cost: 500 },
]

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

    let paidEmojis = DEFAULT_PAID_EMOJIS
    if (settingsMap['paid_chat_emojis']) {
      try {
        const parsed = JSON.parse(settingsMap['paid_chat_emojis'])
        if (Array.isArray(parsed) && parsed.length > 0) {
          paidEmojis = parsed
        }
      } catch {
        paidEmojis = DEFAULT_PAID_EMOJIS
      }
    }

    let packages = [
      { coins: 100, inr: 50, popular: false },
      { coins: 250, inr: 100, popular: true },
      { coins: 550, inr: 200, popular: false },
      { coins: 1500, inr: 500, popular: false },
      { coins: 3200, inr: 1000, popular: false },
    ]
    if (settingsMap['topup_packages']) {
      try {
        const parsed = JSON.parse(settingsMap['topup_packages'])
        if (Array.isArray(parsed) && parsed.length > 0) {
          packages = parsed
        }
      } catch {
        // default
      }
    }

    return NextResponse.json({
      settings: {
        signup_coin_bonus: parseInt(settingsMap['signup_coin_bonus'] || '50', 10),
        chat_cost_per_message: parseInt(settingsMap['chat_cost_per_message'] || '2', 10),
        streamer_revenue_percent: parseInt(settingsMap['streamer_revenue_percent'] || '70', 10),
        private_chat_cost_per_message: parseInt(settingsMap['private_chat_cost_per_message'] || '10', 10),
        private_chat_streamer_revenue_percent: parseInt(settingsMap['private_chat_streamer_revenue_percent'] || '80', 10),
        private_chat_unlock_cost: parseInt(settingsMap['private_chat_unlock_cost'] || '50', 10),
        paid_chat_emojis: paidEmojis,
        topup_packages: packages,
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
    const {
      signup_coin_bonus,
      chat_cost_per_message,
      streamer_revenue_percent,
      private_chat_cost_per_message,
      private_chat_streamer_revenue_percent,
      private_chat_unlock_cost,
      paid_chat_emojis,
      topup_packages,
    } = body || {}

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

    if (private_chat_unlock_cost !== undefined) {
      upserts.push({
        key: 'private_chat_unlock_cost',
        value: String(Math.max(0, parseInt(private_chat_unlock_cost, 10) || 0)),
        description: 'Cost in coins for a viewer to unlock 1-on-1 private chat feature with broadcaster',
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

    if (private_chat_cost_per_message !== undefined) {
      upserts.push({
        key: 'private_chat_cost_per_message',
        value: String(Math.max(0, parseInt(private_chat_cost_per_message, 10) || 0)),
        description: 'Cost in coins per message sent in live stream 1-on-1 private chat',
        updated_at: new Date().toISOString(),
      })
    }

    if (private_chat_streamer_revenue_percent !== undefined) {
      const pct = Math.min(100, Math.max(0, parseInt(private_chat_streamer_revenue_percent, 10) || 0))
      upserts.push({
        key: 'private_chat_streamer_revenue_percent',
        value: String(pct),
        description: 'Percentage of private chat message fees credited to the broadcaster',
        updated_at: new Date().toISOString(),
      })
    }

    if (Array.isArray(paid_chat_emojis)) {
      upserts.push({
        key: 'paid_chat_emojis',
        value: JSON.stringify(paid_chat_emojis),
        description: 'Specific coin costs for live stream chat paid emojis',
        updated_at: new Date().toISOString(),
      })
    }

    if (Array.isArray(topup_packages)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validPackages = topup_packages
        .map((p: any) => ({
          coins: Math.max(1, parseInt(p.coins, 10) || 0),
          inr: Math.max(1, parseFloat(p.inr) || 0),
          popular: Boolean(p.popular),
        }))
        .filter((p) => p.coins > 0 && p.inr > 0)

      upserts.push({
        key: 'topup_packages',
        value: JSON.stringify(validPackages),
        description: 'Coin packages declared by admin (e.g. 50 rupees = 100 coins)',
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
      message: 'Platform economics and paid emojis updated successfully',
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update settings'
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
