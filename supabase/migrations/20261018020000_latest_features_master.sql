-- ==============================================================================
-- STREAMFLOW MASTER MIGRATION: LATEST FEATURES
-- Includes:
-- 1. Streamer Earnings UPI Withdrawal Requests table (withdrawal_requests)
-- 2. User Profiles private_chat_enabled switch column
-- 3. Wallet Transactions check constraint expansion ('withdrawal', 'withdrawal_refund')
-- 4. 1-on-1 Paid Live Stream Private Chat (live_private_chat_messages)
-- 5. Platform settings for streamer payout rate (100 coins = 20 INR) and private chat
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WITHDRAWAL REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coins INT NOT NULL CHECK (coins > 0),
    amount_inr NUMERIC(10, 2) NOT NULL CHECK (amount_inr > 0),
    upi_id TEXT NOT NULL,
    upi_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for withdrawal requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id 
    ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status 
    ON public.withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created 
    ON public.withdrawal_requests(created_at DESC);

-- Enable RLS for withdrawal requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
    ON public.withdrawal_requests FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Authenticated users can create withdrawal requests"
    ON public.withdrawal_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Service role has full access to withdrawal requests"
    ON public.withdrawal_requests
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. PROFILES: ADD PRIVATE CHAT SWITCH COLUMN
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS private_chat_enabled BOOLEAN DEFAULT false;

-- ------------------------------------------------------------------------------
-- 3. WALLET TRANSACTIONS: EXPAND TYPE CONSTRAINT
-- ------------------------------------------------------------------------------
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
    CHECK (type IN ('signup_bonus', 'chat', 'chat_fee', 'streamer_earning', 'admin_adjustment', 'purchase', 'topup', 'withdrawal', 'withdrawal_refund'));

-- ------------------------------------------------------------------------------
-- 4. 1-ON-1 LIVE STREAM PRIVATE CHAT MESSAGES
-- ------------------------------------------------------------------------------
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

-- Indexes for private chat
CREATE INDEX IF NOT EXISTS idx_private_chat_stream_pair 
    ON public.live_private_chat_messages(stream_id, sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_private_chat_recipient 
    ON public.live_private_chat_messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_private_chat_sender 
    ON public.live_private_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_stream_id 
    ON public.live_private_chat_messages(stream_id, created_at DESC);

-- Enable RLS for private chat messages
ALTER TABLE public.live_private_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own private messages" ON public.live_private_chat_messages;
CREATE POLICY "Users can read own private messages"
    ON public.live_private_chat_messages
    FOR SELECT
    USING (
        auth.uid() = sender_id OR auth.uid() = recipient_id
    );

DROP POLICY IF EXISTS "Authenticated users can insert private messages" ON public.live_private_chat_messages;
CREATE POLICY "Authenticated users can insert private messages"
    ON public.live_private_chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
    );

DROP POLICY IF EXISTS "Recipients can update read status" ON public.live_private_chat_messages;
CREATE POLICY "Recipients can update read status"
    ON public.live_private_chat_messages
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Service role has full access to private messages" ON public.live_private_chat_messages;
CREATE POLICY "Service role has full access to private messages"
    ON public.live_private_chat_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. PLATFORM ECONOMICS CONFIGURATION SEEDS
-- ------------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('streamer_payout_rate_coins', '100', 'Streamer payout exchange rate - Coins unit (e.g. 100 coins = 20 INR)'),
    ('streamer_payout_rate_inr', '20', 'Streamer payout exchange rate - INR equivalent (e.g. 100 coins = 20 INR)'),
    ('min_withdrawal_inr', '100', 'Minimum withdrawal threshold in INR set by admin'),
    ('private_chat_cost_per_message', '10', 'Cost in coins per message sent in live stream 1-on-1 private chat'),
    ('private_chat_streamer_revenue_percent', '80', 'Percentage of private chat message fees credited to broadcaster'),
    ('private_chat_unlock_cost', '50', 'Cost in coins for a viewer to unlock 1-on-1 private chat feature'),
    ('withdrawal_instructions', 'Enter your UPI ID and requested amount. Admin will verify and transfer funds to your UPI account manually.', 'Instructions shown on withdrawal screen')
ON CONFLICT (key) DO UPDATE
SET updated_at = NOW();
