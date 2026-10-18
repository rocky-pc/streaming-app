-- Migration: Live Streams table and RLS policies
CREATE TABLE IF NOT EXISTS public.live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    room_name TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_live_streams_user_id ON public.live_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON public.live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_visibility ON public.live_streams(visibility);
CREATE INDEX IF NOT EXISTS idx_live_streams_public_live ON public.live_streams(status, visibility, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_room_name ON public.live_streams(room_name);

-- Enable Row Level Security
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
-- Broadcasters can view all their own streams (scheduled, live, ended, private, unlisted, public)
-- Public visitors can discover public live/ended streams
-- Unlisted streams can be viewed by anyone with the direct link/id
-- Private streams can ONLY be viewed by the owner
DROP POLICY IF EXISTS "Live streams select policy" ON public.live_streams;
CREATE POLICY "Live streams select policy"
    ON public.live_streams
    FOR SELECT
    USING (
        (auth.uid() = user_id)
        OR (visibility = 'public' AND status IN ('live', 'ended'))
        OR (visibility = 'unlisted' AND status IN ('live', 'ended'))
    );

-- 2. INSERT Policy
-- Authenticated users can only create streams where user_id = auth.uid()
DROP POLICY IF EXISTS "Live streams insert policy" ON public.live_streams;
CREATE POLICY "Live streams insert policy"
    ON public.live_streams
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

-- 3. UPDATE Policy
-- Authenticated users can only update their own streams, and cannot reassign user_id
DROP POLICY IF EXISTS "Live streams update policy" ON public.live_streams;
CREATE POLICY "Live streams update policy"
    ON public.live_streams
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. DELETE Policy
-- Authenticated users can delete their own streams
DROP POLICY IF EXISTS "Live streams delete policy" ON public.live_streams;
CREATE POLICY "Live streams delete policy"
    ON public.live_streams
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_live_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_live_streams_updated_at ON public.live_streams;
CREATE TRIGGER trigger_live_streams_updated_at
    BEFORE UPDATE ON public.live_streams
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_live_streams_updated_at();
