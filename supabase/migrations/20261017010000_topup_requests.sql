-- ==============================================================================
-- TOPUP REQUESTS & UPI SETTINGS MIGRATION
-- Handles user coin top-up with UPI ID, UTR submission, and admin approval
-- ==============================================================================

-- 1. TOPUP REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.topup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coins INT NOT NULL,
    amount_inr NUMERIC(10, 2) NOT NULL,
    utr_number TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_topup_requests_user_id ON public.topup_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_requests_status ON public.topup_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topup_requests_utr ON public.topup_requests(utr_number);

-- 3. ENABLE RLS
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own topup requests
DROP POLICY IF EXISTS "Users can view own topup requests" ON public.topup_requests;
CREATE POLICY "Users can view own topup requests"
    ON public.topup_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can insert their own topup requests
DROP POLICY IF EXISTS "Authenticated users can create topup requests" ON public.topup_requests;
CREATE POLICY "Authenticated users can create topup requests"
    ON public.topup_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE WALLET TRANSACTIONS TYPE CONSTRAINT TO INCLUDE 'topup'
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
    CHECK (type IN ('signup_bonus', 'chat_fee', 'streamer_earning', 'admin_adjustment', 'purchase', 'topup'));

-- 5. SEED PLATFORM SETTINGS FOR UPI & TOPUP RATES
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('admin_upi_id', 'streamflow@upi', 'Admin UPI VPA address for user coin top-up payments'),
    ('admin_upi_name', 'StreamFlow Entertainment', 'Payee display name shown on UPI apps'),
    ('coin_price_inr', '1', 'Base exchange rate: 1 Coin = X INR (e.g. 1 means 100 coins = 100 INR)'),
    ('topup_packages', $json$[{"coins":50,"inr":50,"popular":false},{"coins":100,"inr":100,"popular":true},{"coins":250,"inr":250,"popular":false},{"coins":500,"inr":500,"popular":false},{"coins":1000,"inr":950,"popular":false}]$json$, 'Predefined quick topup coin packages and INR prices'),
    ('topup_instructions', 'Pay using any UPI app (GPay, PhonePe, Paytm, BHIM) to the UPI ID above. After payment, enter your 12-digit transaction UTR/reference number and submit for instant wallet credit upon admin verification.', 'Guidance instructions displayed to users in the top-up window')
ON CONFLICT (key) DO NOTHING;
