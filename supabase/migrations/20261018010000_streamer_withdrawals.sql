-- ==============================================================================
-- STREAMFLOW MIGRATION: STREAMER EARNINGS WITHDRAWALS & PAYOUTS
-- Handles streamer coin-to-INR earnings conversion, UPI payout requests, and admin manual processing
-- ==============================================================================

-- 1. WITHDRAWAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coins INT NOT NULL,
    amount_inr NUMERIC(10, 2) NOT NULL,
    upi_id TEXT NOT NULL,
    upi_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created ON public.withdrawal_requests(created_at DESC);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own withdrawal requests
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
    ON public.withdrawal_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can create withdrawal requests
DROP POLICY IF EXISTS "Authenticated users can create withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Authenticated users can create withdrawal requests"
    ON public.withdrawal_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE WALLET TRANSACTIONS TYPE CHECK CONSTRAINT
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
    CHECK (type IN ('signup_bonus', 'chat_fee', 'streamer_earning', 'admin_adjustment', 'purchase', 'topup', 'withdrawal', 'withdrawal_refund'));

-- 5. SEED PLATFORM SETTINGS FOR STREAMER EARNINGS & WITHDRAWAL
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('streamer_payout_rate_coins', '100', 'Streamer payout exchange rate - Coins denominator (e.g. 100 coins = 20 INR)'),
    ('streamer_payout_rate_inr', '20', 'Streamer payout exchange rate - INR numerator (e.g. 100 coins = 20 INR)'),
    ('min_withdrawal_inr', '100', 'Minimum withdrawal threshold in INR set by admin'),
    ('withdrawal_instructions', 'Enter your UPI ID (GPay, PhonePe, Paytm, BHIM) and withdrawal amount. Admin will verify your earnings and transfer the amount to your UPI manually within 24 hours.', 'Instructions shown on withdrawal screen')
ON CONFLICT (key) DO NOTHING;
