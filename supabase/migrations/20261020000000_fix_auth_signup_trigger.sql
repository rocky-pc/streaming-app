-- ==============================================================================
-- STREAMFLOW MIGRATION: Fix Auth Signup Trigger & handle_new_user Idempotency
-- Resolves HTTP 500 Internal Server Error during auth/v1/signup
-- Root Cause:
-- 1. Trigger on_auth_user_created was set to "AFTER INSERT OR UPDATE OF raw_user_meta_data"
-- 2. During signup, GoTrue inserts and updates in the same transaction, firing the trigger twice.
-- 3. handle_new_user lacked "ON CONFLICT (id)", causing Postgres error 23505 (profiles_pkey duplicate).
-- 4. Uncaught exceptions in the trigger caused the whole auth.users insert transaction to abort with 500.
-- ==============================================================================

-- 1. Redefine handle_new_user() with proper conflict resolution, exception handling, and search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INT := 0;
    bonus_amount INT := 50;
    setting_val TEXT;
BEGIN
    -- Determine sign up bonus from platform_settings safely (fallback to 50)
    BEGIN
        SELECT value INTO setting_val FROM public.platform_settings WHERE key = 'signup_coin_bonus';
        IF setting_val IS NOT NULL AND setting_val ~ '^\d+$' THEN
            bonus_amount := setting_val::INT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        bonus_amount := 50;
    END;

    -- Extract or derive base username
    base_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        NULLIF(split_part(NEW.email, '@', 1), ''),
        'user'
    );
    -- Clean username (letters, numbers, underscores only)
    base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
    IF base_username = '' THEN
        base_username := 'user';
    END IF;

    -- Ensure unique username if not already existing for this user
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username AND id != NEW.id) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;

    -- Upsert profile safely with ON CONFLICT (id) DO UPDATE
    INSERT INTO public.profiles (
        id, 
        username, 
        display_name, 
        avatar_url, 
        coin_balance, 
        chat_enabled,
        private_chat_enabled,
        created_at,
        updated_at
    )
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
        true,
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = CASE 
            WHEN public.profiles.username IS NULL OR public.profiles.username = '' 
            THEN EXCLUDED.username 
            ELSE public.profiles.username 
        END,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = NOW();

    -- Log initial signup bonus transaction only once
    IF bonus_amount > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.wallet_transactions 
            WHERE user_id = NEW.id AND type = 'signup_bonus'
        ) THEN
            INSERT INTO public.wallet_transactions (user_id, amount, type, description)
            VALUES (NEW.id, bonus_amount, 'signup_bonus', 'Welcome Sign-up Coin Bonus');
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger failure from aborting user registration
    RAISE WARNING 'handle_new_user error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Drop all previous/duplicate variants of the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS tr_auth_users_insert ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 3. Recreate trigger strictly on AFTER INSERT (NOT on UPDATE)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
