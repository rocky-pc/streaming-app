-- Migration: Add thumbnail_url to live_streams and paid_emoji/coins_paid to live_chat_messages
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS paid_emoji TEXT;
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS coins_paid INT DEFAULT 0;
