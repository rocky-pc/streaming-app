-- ==============================================================================
-- STREAMFLOW CONSOLIDATED MASTER DATABASE SCHEMA & UPDATES
-- Fully idempotent migration ensuring all tables, columns, indexes, RLS, & storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE & NEW ATTRIBUTES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure profiles coin balance & live chat switch columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coin_balance INT DEFAULT 50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true;

-- 3. VIDEOS TABLE
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    duration NUMERIC,
    file_size BIGINT,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    views BIGINT DEFAULT 0,
    likes_count INT DEFAULT 0,
    dislikes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LIVE STREAMS TABLE & THUMBNAIL
CREATE TABLE IF NOT EXISTS public.live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    room_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure thumbnail_url column for live streams
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 5. LIVE CHAT MESSAGES & PAID EMOJI / SUPER STICKERS
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure paid_emoji and coins_paid columns exist
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS paid_emoji TEXT;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS coins_paid INT DEFAULT 0;

-- 6. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'chat_fee', 'streamer_earning', 'admin_adjustment', 'purchase')),
    related_stream_id UUID REFERENCES public.live_streams(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PLATFORM SETTINGS TABLE (ECONOMICS & SUPER EMOJIS)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default platform economics if not already configured
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('signup_coin_bonus', '50', 'Coins awarded to new users upon signing up'),
    ('chat_cost_per_message', '1', 'Coins charged to viewer per live chat message'),
    ('streamer_revenue_percent', '70', 'Percentage of chat fees and super stickers awarded to the broadcaster'),
    ('paid_chat_emojis', $json$[{"emoji":"❤️","cost":5},{"emoji":"🔥","cost":10},{"emoji":"👏","cost":15},{"emoji":"🎉","cost":25},{"emoji":"💎","cost":50},{"emoji":"🚀","cost":100},{"emoji":"👑","cost":500}]$json$, 'Coin prices for super emoji live chat stickers')
ON CONFLICT (key) DO NOTHING;

-- 8. INDEXES FOR HIGH-THROUGHPUT PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_live_chat_stream_id ON public.live_chat_messages(stream_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_live_chat_user_id ON public.live_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON public.live_streams(status, visibility);
CREATE INDEX IF NOT EXISTS idx_live_streams_user_id ON public.live_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON public.wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON public.videos(visibility);

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Live Streams Policies
DROP POLICY IF EXISTS "Live streams select policy" ON public.live_streams;
CREATE POLICY "Live streams select policy" ON public.live_streams FOR SELECT USING (
    visibility = 'public'
    OR visibility = 'unlisted'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Live streams insert policy" ON public.live_streams;
CREATE POLICY "Live streams insert policy" ON public.live_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live streams update policy" ON public.live_streams;
CREATE POLICY "Live streams update policy" ON public.live_streams FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live streams delete policy" ON public.live_streams;
CREATE POLICY "Live streams delete policy" ON public.live_streams FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Live Chat Messages Policies
DROP POLICY IF EXISTS "Chat messages are readable by viewers" ON public.live_chat_messages;
CREATE POLICY "Chat messages are readable by viewers" ON public.live_chat_messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.live_streams s
        WHERE s.id = live_chat_messages.stream_id
        AND (s.visibility = 'public' OR s.visibility = 'unlisted' OR s.user_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.live_chat_messages;
CREATE POLICY "Authenticated users can insert chat messages" ON public.live_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Wallet Transactions Policies
DROP POLICY IF EXISTS "Users can read own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can read own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- Platform Settings Policies
DROP POLICY IF EXISTS "Platform settings are readable by everyone" ON public.platform_settings;
CREATE POLICY "Platform settings are readable by everyone" ON public.platform_settings FOR SELECT USING (true);

-- 10. STORAGE BUCKETS SETUP
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;
