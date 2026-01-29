-- Migration: Add thumbnail_url column to news_stories
-- This allows storing thumbnail images extracted from RSS feeds

ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment
COMMENT ON COLUMN news_stories.thumbnail_url IS 'Thumbnail image URL extracted from RSS media:thumbnail or enclosure';
