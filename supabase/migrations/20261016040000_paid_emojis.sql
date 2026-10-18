-- Migration: Paid Chat Emojis (Specific Emoji = Specific Coin cost)
INSERT INTO public.platform_settings (key, value, description)
VALUES (
    'paid_chat_emojis',
    $json$[{"emoji":"❤️","cost":5},{"emoji":"🔥","cost":10},{"emoji":"👏","cost":15},{"emoji":"🎉","cost":25},{"emoji":"💎","cost":50},{"emoji":"🚀","cost":100},{"emoji":"👑","cost":500}]$json$,
    'Specific coin costs for live stream chat paid emojis'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();
