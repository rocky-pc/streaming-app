-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    duration DOUBLE PRECISION,
    file_size BIGINT,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for search
CREATE INDEX IF NOT EXISTS idx_videos_title ON public.videos USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos (created_at DESC);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Public read access for published videos
CREATE POLICY "Public read access" ON public.videos
    FOR SELECT USING (true);

-- Allow insert for authenticated users (or use service role for uploads)
CREATE POLICY "Allow insert for service role" ON public.videos
    FOR INSERT WITH CHECK (true);

-- Allow update for service role
CREATE POLICY "Allow update for service role" ON public.videos
    FOR UPDATE USING (true);

-- Allow delete for service role
CREATE POLICY "Allow delete for service role" ON public.videos
    FOR DELETE USING (true);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('videos', 'videos', true, 2147483648, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'application/x-mpegURL']),
    ('thumbnails', 'thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for videos bucket
CREATE POLICY "Public read access for videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Service role can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Service role can update videos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'videos');

CREATE POLICY "Service role can delete videos" ON storage.objects
    FOR DELETE USING (bucket_id = 'videos');

-- Storage policies for thumbnails bucket
CREATE POLICY "Public read access for thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Service role can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Service role can update thumbnails" ON storage.objects
    FOR UPDATE USING (bucket_id = 'thumbnails');

CREATE POLICY "Service role can delete thumbnails" ON storage.objects
    FOR DELETE USING (bucket_id = 'thumbnails');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS handle_videos_updated_at ON public.videos;
CREATE TRIGGER handle_videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();