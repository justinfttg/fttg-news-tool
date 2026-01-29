-- Migration: Add Singapore and China regions to news_stories
-- This allows the news scraper to tag stories from Singapore and China sources

-- Drop and recreate the check constraint to include new regions
ALTER TABLE news_stories DROP CONSTRAINT IF EXISTS news_stories_region_check;

ALTER TABLE news_stories ADD CONSTRAINT news_stories_region_check
  CHECK (region IN ('asia', 'southeast_asia', 'east_asia', 'apac', 'global', 'singapore', 'china'));

-- Add comment
COMMENT ON CONSTRAINT news_stories_region_check ON news_stories IS
  'Valid regions: asia, southeast_asia, east_asia, apac, global, singapore, china';
