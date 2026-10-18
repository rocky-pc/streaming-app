-- Migration: Live Chat Messages Table & Cleanup Stale Streams
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_live_chat_stream_id ON public.live_chat_messages(stream_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_live_chat_user_id ON public.live_chat_messages(user_id);

-- Enable RLS
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Viewers can read chat messages of accessible streams
DROP POLICY IF EXISTS "Chat messages are readable by viewers" ON public.live_chat_messages;
CREATE POLICY "Chat messages are readable by viewers"
    ON public.live_chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.live_streams s
            WHERE s.id = live_chat_messages.stream_id
            AND (
                s.visibility = 'public'
                OR s.visibility = 'unlisted'
                OR s.user_id = auth.uid()
            )
        )
    );

-- 2. INSERT Policy: Authenticated users can post chat messages
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.live_chat_messages;
CREATE POLICY "Authenticated users can insert chat messages"
    ON public.live_chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
    );

-- 3. Cleanup existing stale live streams so they don't linger on home screen
UPDATE public.live_streams
SET status = 'ended', ended_at = NOW()
WHERE status = 'live';
