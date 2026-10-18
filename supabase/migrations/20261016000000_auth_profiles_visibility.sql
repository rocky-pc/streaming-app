-- Migration: Auth, Profiles, and Video Visibility
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INT := 0;
BEGIN
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

    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        final_username,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            final_username
        ),
        NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Backfill profile for existing auth.users
INSERT INTO public.profiles (id, username, display_name, avatar_url)
SELECT 
    u.id,
    COALESCE(
        NULLIF(u.raw_user_meta_data->>'username', ''),
        split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 4)
    ) as username,
    COALESCE(
        NULLIF(u.raw_user_meta_data->>'display_name', ''),
        NULLIF(u.raw_user_meta_data->>'full_name', ''),
        split_part(u.email, '@', 1)
    ) as display_name,
    NULLIF(u.raw_user_meta_data->>'avatar_url', '') as avatar_url
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 2. Alter Videos Table
ALTER TABLE public.videos 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private'));

-- Update existing videos to have user_id if null
UPDATE public.videos 
SET user_id = (SELECT id FROM public.profiles LIMIT 1) 
WHERE user_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON public.videos(visibility);
CREATE INDEX IF NOT EXISTS idx_videos_description ON public.videos USING GIN (to_tsvector('english', coalesce(description, '')));

-- 3. Row Level Security for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 4. Row Level Security for Videos
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.videos;
DROP POLICY IF EXISTS "Videos select policy" ON public.videos;
DROP POLICY IF EXISTS "Allow insert for service role" ON public.videos;
DROP POLICY IF EXISTS "Allow update for service role" ON public.videos;
DROP POLICY IF EXISTS "Allow delete for service role" ON public.videos;
DROP POLICY IF EXISTS "Users can insert their own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can update their own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can delete their own videos" ON public.videos;

-- Public & unlisted videos are readable by anyone; private videos readable only by owner
CREATE POLICY "Videos select policy" ON public.videos
    FOR SELECT USING (
        visibility = 'public' 
        OR visibility = 'unlisted' 
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    );

CREATE POLICY "Users can insert their own videos" ON public.videos
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = user_id
    );

CREATE POLICY "Users can update their own videos" ON public.videos
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND auth.uid() = user_id
    );

CREATE POLICY "Users can delete their own videos" ON public.videos
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND auth.uid() = user_id
    );

-- 5. Storage Policies for Videos & Thumbnails
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'videos' AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'thumbnails' AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users can update own video files" ON storage.objects;
CREATE POLICY "Users can update own video files" ON storage.objects
    FOR UPDATE USING (
        (bucket_id = 'videos' OR bucket_id = 'thumbnails') AND (auth.uid() = owner OR auth.uid()::text = owner_id)
    );

DROP POLICY IF EXISTS "Users can delete own video files" ON storage.objects;
CREATE POLICY "Users can delete own video files" ON storage.objects
    FOR DELETE USING (
        (bucket_id = 'videos' OR bucket_id = 'thumbnails') AND (auth.uid() = owner OR auth.uid()::text = owner_id)
    );

DROP POLICY IF EXISTS "Public read access for thumbnails" ON storage.objects;
CREATE POLICY "Public read access for thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Public read access for videos" ON storage.objects;
DROP POLICY IF EXISTS "Read access for videos" ON storage.objects;
CREATE POLICY "Read access for videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');
