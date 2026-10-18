-- ==============================================================================
-- STREAMFLOW MIGRATION: 1-ON-1 PAID LIVE STREAM PRIVATE CHAT
-- ==============================================================================

-- 1. Create live_private_chat_messages table
CREATE TABLE IF NOT EXISTS public.live_private_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    coins_paid INT DEFAULT 0,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_private_chat_stream_pair 
    ON public.live_private_chat_messages(stream_id, sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_private_chat_recipient 
    ON public.live_private_chat_messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_private_chat_sender 
    ON public.live_private_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_stream_id 
    ON public.live_private_chat_messages(stream_id, created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.live_private_chat_messages ENABLE ROW LEVEL SECURITY;

-- Select Policy: Users can read messages where they are sender or recipient
DROP POLICY IF EXISTS "Users can read own private messages" ON public.live_private_chat_messages;
CREATE POLICY "Users can read own private messages"
    ON public.live_private_chat_messages
    FOR SELECT
    USING (
        auth.uid() = sender_id OR auth.uid() = recipient_id
    );

-- Insert Policy: Authenticated users can insert messages where sender is themselves
DROP POLICY IF EXISTS "Authenticated users can insert private messages" ON public.live_private_chat_messages;
CREATE POLICY "Authenticated users can insert private messages"
    ON public.live_private_chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
    );

-- Update Policy: Recipients can mark messages as read
DROP POLICY IF EXISTS "Recipients can update read status" ON public.live_private_chat_messages;
CREATE POLICY "Recipients can update read status"
    ON public.live_private_chat_messages
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- 4. Seed default platform economics for private chat
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('private_chat_cost_per_message', '10', 'Cost in coins per message sent in live stream 1-on-1 private chat'),
    ('private_chat_streamer_revenue_percent', '80', 'Percentage of private chat message fees credited to the broadcaster')
ON CONFLICT (key) DO NOTHING;
