import type { Category } from './sources.config';

/**
 * Keyword → category mapping.
 * Each keyword is tested against the lowercase title + summary.
 * First match wins, so more specific categories should appear first.
 */
const KEYWORD_MAP: { keywords: string[]; category: Category }[] = [
  {
    category: 'Technology',
    keywords: [
      'ai ', 'artificial intelligence', 'machine learning', 'semiconductor', 'chip',
      'startup', 'tech', 'software', 'cyber', 'data breach', 'blockchain', 'crypto',
      'robot', 'quantum', '5g', 'app ', 'silicon', 'digital',
    ],
  },
  {
    category: 'Health',
    keywords: [
      'health', 'covid', 'pandemic', 'vaccine', 'hospital', 'disease', 'medical',
      'doctor', 'patient', 'drug', 'pharma', 'who ', 'mental health', 'virus',
      'cancer', 'epidemic', 'clinic',
    ],
  },
  {
    category: 'Economy',
    keywords: [
      'economy', 'gdp', 'inflation', 'interest rate', 'central bank', 'trade war',
      'tariff', 'recession', 'fiscal', 'monetary', 'imf', 'world bank', 'debt',
      'export', 'import', 'currency', 'forex',
    ],
  },
  {
    category: 'Business',
    keywords: [
      'business', 'stock', 'market', 'company', 'profit', 'revenue', 'merger',
      'acquisition', 'ipo', 'investor', 'shares', 'ceo', 'corporate', 'earnings',
      'nasdaq', 'wall street',
    ],
  },
  {
    category: 'Environment',
    keywords: [
      'climate', 'environment', 'carbon', 'emission', 'renewable', 'solar', 'wind energy',
      'pollution', 'deforestation', 'biodiversity', 'flood', 'typhoon', 'earthquake',
      'drought', 'wildfire', 'sustainability', 'green energy',
    ],
  },
  {
    category: 'Politics',
    keywords: [
      'election', 'government', 'president', 'minister', 'parliament', 'congress',
      'diplomat', 'sanction', 'summit', 'policy', 'vote', 'opposition', 'coalition',
      'legislation', 'referendum', 'coup', 'geopolitic',
    ],
  },
  {
    category: 'Security',
    keywords: [
      'military', 'defense', 'war', 'conflict', 'missile', 'nuclear', 'terrorism',
      'attack', 'navy', 'army', 'border', 'weapon', 'intelligence', 'nato',
      'peacekeep', 'ceasefire',
    ],
  },
  {
    category: 'Science',
    keywords: [
      'science', 'research', 'study', 'discovery', 'space', 'nasa', 'experiment',
      'physics', 'biology', 'chemistry', 'genome', 'fossil', 'asteroid', 'mars',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'education', 'school', 'university', 'student', 'teacher', 'curriculum',
      'scholarship', 'academic', 'exam', 'degree',
    ],
  },
  {
    category: 'Sports',
    keywords: [
      'sport', 'football', 'soccer', 'cricket', 'olympics', 'world cup', 'tennis',
      'basketball', 'rugby', 'swimming', 'badminton', 'boxing', 'medal', 'championship',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'entertainment', 'movie', 'film', 'music', 'celebrity', 'concert', 'k-pop',
      'drama', 'netflix', 'award', 'festival', 'actor', 'actress', 'box office',
    ],
  },
];

/**
 * Categorize a news story using keyword matching against title + summary.
 * Returns the best-matching category, or the provided fallback.
 */
export function categorizeStory(
  title: string,
  summary: string | null,
  fallback: string = 'General'
): string {
  const text = `${title} ${summary || ''}`.toLowerCase();

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) {
        return entry.category;
      }
    }
  }

  return fallback;
}
