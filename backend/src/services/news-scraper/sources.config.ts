export interface RSSSource {
  name: string;
  url: string;
  category: string;
  region: 'asia' | 'southeast_asia' | 'east_asia' | 'apac' | 'global';
}

export const CATEGORIES = [
  'Politics',
  'Economy',
  'Technology',
  'Health',
  'Environment',
  'Business',
  'Science',
  'Education',
  'Sports',
  'Entertainment',
  'Security',
  'General',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const RSS_SOURCES: Record<string, RSSSource[]> = {
  asia: [
    { name: 'CNA Asia', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511', category: 'General', region: 'asia' },
    { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss', category: 'Business', region: 'asia' },
    { name: 'Asia Times', url: 'https://asiatimes.com/feed/', category: 'General', region: 'asia' },
  ],
  southeast_asia: [
    { name: 'CNA Singapore', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416', category: 'General', region: 'southeast_asia' },
    { name: 'The Straits Times', url: 'https://www.straitstimes.com/news/asia/south-east-asia/rss.xml', category: 'General', region: 'southeast_asia' },
    { name: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/topstories.xml', category: 'General', region: 'southeast_asia' },
    { name: 'VNExpress International', url: 'https://e.vnexpress.net/rss/news.rss', category: 'General', region: 'southeast_asia' },
  ],
  east_asia: [
    { name: 'NHK World', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', category: 'General', region: 'east_asia' },
    { name: 'Yonhap News', url: 'https://en.yna.co.kr/RSS/news.xml', category: 'General', region: 'east_asia' },
    { name: 'SCMP', url: 'https://www.scmp.com/rss/91/feed', category: 'General', region: 'east_asia' },
    { name: 'Taipei Times', url: 'https://www.taipeitimes.com/xml/index.rss', category: 'General', region: 'east_asia' },
  ],
  apac: [
    { name: 'ABC News Australia', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', category: 'General', region: 'apac' },
    { name: 'RNZ New Zealand', url: 'https://www.rnz.co.nz/rss/news.xml', category: 'General', region: 'apac' },
    { name: 'The Hindu', url: 'https://www.thehindu.com/news/feeder/default.rss', category: 'General', region: 'apac' },
  ],
  global: [
    { name: 'Reuters World', url: 'https://feeds.reuters.com/Reuters/worldNews', category: 'General', region: 'global' },
    { name: 'AP News', url: 'https://rsshub.app/apnews/topics/world-news', category: 'General', region: 'global' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'General', region: 'global' },
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'General', region: 'global' },
  ],
};

/**
 * Return all sources, or filter by region.
 */
export function getSources(region?: string): RSSSource[] {
  if (region && RSS_SOURCES[region]) {
    return RSS_SOURCES[region];
  }
  return Object.values(RSS_SOURCES).flat();
}
