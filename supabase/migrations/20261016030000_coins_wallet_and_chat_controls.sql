-- Migration: Coin Economics, User Wallet, Chat Controls & Platform Settings

-- 1. Extend profiles with coin_balance and chat_enabled
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 50;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT true;

-- Update existing profiles to ensure valid defaults
UPDATE public.profiles
SET coin_balance = 50
WHERE coin_balance IS NULL OR coin_balance < 0;

UPDATE public.profiles
SET chat_enabled = true
WHERE chat_enabled IS NULL;

-- 2. Platform Settings Table (Configured from Admin Panel)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform settings are readable by everyone" ON public.platform_settings;
CREATE POLICY "Platform settings are readable by everyone"
    ON public.platform_settings FOR SELECT
    USING (true);

-- Seed default platform economics
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('signup_coin_bonus', '50', 'Initial coin bonus awarded to newly registered users'),
    ('chat_cost_per_message', '2', 'Cost in coins per message sent in live stream chat'),
    ('streamer_revenue_percent', '70', 'Percentage of chat cost allocated to the broadcaster')
ON CONFLICT (key) DO NOTHING;

-- 3. Wallet Transactions Ledger Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for credits, negative for debits
    type TEXT NOT NULL, -- 'signup_bonus', 'chat_fee', 'streamer_earning', 'admin_adjustment'
    related_stream_id UUID REFERENCES public.live_streams(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_stream_id ON public.wallet_transactions(related_stream_id);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can read own transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Update handle_new_user trigger to award dynamic sign-up bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INT := 0;
    bonus_amount INT := 50;
    setting_val TEXT;
BEGIN
    -- Determine sign up bonus from platform_settings
    SELECT value INTO setting_val FROM public.platform_settings WHERE key = 'signup_coin_bonus';
    IF setting_val IS NOT NULL THEN
        bonus_amount := COALESCE(setting_val::INT, 50);
    END IF;

    base_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        NULLIF(split_part(NEW.email, '@', 1), ''),
        'user'
    );
    -- Clean username
    base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
    IF base_username = '' THEN
        base_username := 'user';
    END IF;

    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username AND id != NEW.id) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;

    INSERT INTO public.profiles (id, username, display_name, avatar_url, coin_balance, chat_enabled)
    VALUES (
        NEW.id,
        final_username,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
            NEW.raw_user_meta_data->>'full_name',
            final_username
        ),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
            NULLIF(NEW.raw_user_meta_data->>'picture', '')
        ),
        bonus_amount,
        true
    );

    -- Log initial signup bonus transaction
    IF bonus_amount > 0 THEN
        INSERT INTO public.wallet_transactions (user_id, amount, type, description)
        VALUES (NEW.id, bonus_amount, 'signup_bonus', 'Welcome Sign-up Coin Bonus');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Seed initial welcome bonus transactions for existing profiles if missing
INSERT INTO public.wallet_transactions (user_id, amount, type, description)
SELECT p.id, p.coin_balance, 'signup_bonus', 'Initial Coin Balance'
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions wt WHERE wt.user_id = p.id
);
