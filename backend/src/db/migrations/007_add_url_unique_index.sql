-- Migration: Add unique index on URL to prevent duplicate stories at DB level
-- This ensures no two stories can have the same URL (excluding nulls)

CREATE UNIQUE INDEX IF NOT EXISTS news_stories_url_unique
ON news_stories (url)
WHERE url IS NOT NULL;
