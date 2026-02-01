-- Migration: Enhance audience_profiles with language/market and platform fields
-- Date: 2025-01-29

-- Add new columns to audience_profiles
ALTER TABLE audience_profiles
ADD COLUMN IF NOT EXISTS primary_language VARCHAR(50),
ADD COLUMN IF NOT EXISTS secondary_languages JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS market_region VARCHAR(100),
ADD COLUMN IF NOT EXISTS platform_url TEXT,
ADD COLUMN IF NOT EXISTS platform_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS platform_type VARCHAR(50) CHECK (platform_type IN ('digital_media', 'broadcast_tv', 'radio', 'print', 'social_media', 'podcast', 'other')),
ADD COLUMN IF NOT EXISTS content_categories JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS audience_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS key_demographics TEXT,
ADD COLUMN IF NOT EXISTS cultural_context TEXT;

-- Add index for market_region queries
CREATE INDEX IF NOT EXISTS idx_audience_market_region ON audience_profiles(market_region);
CREATE INDEX IF NOT EXISTS idx_audience_language ON audience_profiles(primary_language);
