import Parser from 'rss-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrendingTopic {
  title: string;
  url: string | null;
  platform: 'x' | 'google_trends' | 'reddit';
  score: number;
  hashtags: string[];
  region: string | null;
}

const FETCH_TIMEOUT = 12_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 1. getTrendingX — X/Twitter trending via Trends24 RSS or scrape fallback
// ---------------------------------------------------------------------------

const TRENDS24_RSS = 'https://trends24.in/rss/';

export async function getTrendingX(): Promise<TrendingTopic[]> {
  try {
    const parser = new Parser({ timeout: FETCH_TIMEOUT });
    const feed = await parser.parseURL(TRENDS24_RSS);

    return (feed.items || []).slice(0, 30).map((item) => {
      const title = (item.title || '').trim();
      const hashtags = title.startsWith('#') ? [title] : [];

      return {
        title,
        url: item.link || null,
        platform: 'x' as const,
        score: 1,
        hashtags,
        region: null,
      };
    });
  } catch (err) {
    console.warn(`[social-scraper] X/Trends24 failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. getGoogleTrends — Google Trends daily trending RSS
// ---------------------------------------------------------------------------

const GOOGLE_TRENDS_RSS: { url: string; region: string }[] = [
  { url: 'https://trends.google.com/trending/rss?geo=SG', region: 'southeast_asia' },
  { url: 'https://trends.google.com/trending/rss?geo=JP', region: 'east_asia' },
  { url: 'https://trends.google.com/trending/rss?geo=AU', region: 'apac' },
  { url: 'https://trends.google.com/trending/rss?geo=US', region: 'global' },
];

export async function getGoogleTrends(): Promise<TrendingTopic[]> {
  const parser = new Parser({ timeout: FETCH_TIMEOUT });
  const results: TrendingTopic[] = [];

  for (const { url, region } of GOOGLE_TRENDS_RSS) {
    try {
      const feed = await parser.parseURL(url);

      const topics = (feed.items || []).slice(0, 15).map((item) => ({
        title: (item.title || '').trim(),
        url: item.link || null,
        platform: 'google_trends' as const,
        score: 1,
        hashtags: [],
        region,
      }));

      results.push(...topics);
    } catch (err) {
      console.warn(`[social-scraper] Google Trends (${region}) failed: ${err instanceof Error ? err.message : err}`);
      // Continue with other regions
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. getRedditTrending — Reddit hot posts via public JSON API
// ---------------------------------------------------------------------------

const REDDIT_SUBREDDITS = [
  { sub: 'worldnews', region: 'global' },
  { sub: 'singapore', region: 'southeast_asia' },
  { sub: 'asia', region: 'asia' },
  { sub: 'japan', region: 'east_asia' },
  { sub: 'australia', region: 'apac' },
];

interface RedditPost {
  data: {
    title: string;
    permalink: string;
    url: string;
    score: number;
    num_comments: number;
    subreddit: string;
  };
}

export async function getRedditTrending(): Promise<TrendingTopic[]> {
  const results: TrendingTopic[] = [];

  for (const { sub, region } of REDDIT_SUBREDDITS) {
    try {
      const res = await fetchWithTimeout(`https://www.reddit.com/r/${sub}/hot.json?limit=15`, {
        headers: { 'User-Agent': 'FTTG-News-Scraper/1.0' },
      });

      if (!res.ok) {
        console.warn(`[social-scraper] Reddit r/${sub}: HTTP ${res.status}`);
        continue;
      }

      const json: any = await res.json();
      const posts: RedditPost[] = json?.data?.children || [];

      // Skip pinned/stickied posts (first 1-2 are usually stickied)
      const filtered = posts.filter((p) => !p.data.subreddit?.startsWith('announcements'));

      const topics = filtered.slice(0, 10).map((post) => ({
        title: post.data.title.trim(),
        url: `https://reddit.com${post.data.permalink}`,
        platform: 'reddit' as const,
        score: Math.max(1, Math.floor(post.data.score / 100)), // Normalize: 1 point per 100 upvotes
        hashtags: [],
        region,
      }));

      results.push(...topics);
    } catch (err) {
      console.warn(`[social-scraper] Reddit r/${sub} failed: ${err instanceof Error ? err.message : err}`);
      // Continue with other subreddits
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 4. getAllTrending — aggregated fetch from all platforms
// ---------------------------------------------------------------------------

export async function getAllTrending(): Promise<{
  topics: TrendingTopic[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allTopics: TrendingTopic[] = [];

  // Run all scrapers concurrently with individual error handling
  const [xTopics, googleTopics, redditTopics] = await Promise.all([
    getTrendingX().catch((err) => {
      errors.push(`X: ${err instanceof Error ? err.message : err}`);
      return [] as TrendingTopic[];
    }),
    getGoogleTrends().catch((err) => {
      errors.push(`Google: ${err instanceof Error ? err.message : err}`);
      return [] as TrendingTopic[];
    }),
    getRedditTrending().catch((err) => {
      errors.push(`Reddit: ${err instanceof Error ? err.message : err}`);
      return [] as TrendingTopic[];
    }),
  ]);

  allTopics.push(...xTopics, ...googleTopics, ...redditTopics);

  console.log(
    `[social-scraper] Fetched: X=${xTopics.length}, Google=${googleTopics.length}, Reddit=${redditTopics.length}`
  );

  return { topics: allTopics, errors };
}
