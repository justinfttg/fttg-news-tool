import { useState, useCallback, useRef, useEffect } from 'react';
import { useNewsFeed, useTrendingNews } from '../../hooks/useNews';
import { StoryCard } from './StoryCard';
import { NewsStory } from '../../types';

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'global', label: 'Global' },
  { value: 'asia', label: 'Asia' },
  { value: 'southeast_asia', label: 'Southeast Asia' },
  { value: 'east_asia', label: 'East Asia' },
  { value: 'apac', label: 'APAC' },
];

const CATEGORIES = [
  'All',
  'Technology',
  'Health',
  'Economy',
  'Business',
  'Environment',
  'Politics',
  'Security',
  'Science',
  'Education',
  'Sports',
  'Entertainment',
];

type Tab = 'latest' | 'trending';

interface NewsLibraryProps {
  projectId: string;
}

export function NewsLibrary({ projectId }: NewsLibraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('latest');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  // --- Latest feed (infinite scroll) ---
  const feedQuery = useNewsFeed({
    region: region || undefined,
    category: category === 'All' ? undefined : category,
  });

  // --- Trending feed ---
  const trendingQuery = useTrendingNews(30);

  // --- Infinite scroll observer ---
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            feedQuery.hasNextPage &&
            !feedQuery.isFetchingNextPage
          ) {
            feedQuery.fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    },
    [feedQuery.hasNextPage, feedQuery.isFetchingNextPage, feedQuery.fetchNextPage]
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // --- Derived data ---
  const latestStories: NewsStory[] =
    feedQuery.data?.pages.flatMap((page) => page.stories) || [];

  const trendingStories: NewsStory[] = trendingQuery.data?.stories || [];

  // Client-side search filter
  const filterBySearch = (stories: NewsStory[]) => {
    if (!search.trim()) return stories;
    const q = search.toLowerCase();
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary?.toLowerCase().includes(q) ||
        s.source.toLowerCase().includes(q)
    );
  };

  const displayStories =
    activeTab === 'latest'
      ? filterBySearch(latestStories)
      : filterBySearch(trendingStories);

  const isLoading =
    activeTab === 'latest' ? feedQuery.isLoading : trendingQuery.isLoading;

  const isError =
    activeTab === 'latest' ? feedQuery.isError : trendingQuery.isError;

  const totalCount =
    activeTab === 'latest'
      ? feedQuery.data?.pages[0]?.pagination.total ?? 0
      : trendingQuery.data?.count ?? 0;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setActiveTab('latest')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'latest'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Latest
        </button>
        <button
          onClick={() => setActiveTab('trending')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'trending'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Trending
        </button>

        <span className="ml-auto text-xs text-gray-400">
          {totalCount} {totalCount === 1 ? 'story' : 'stories'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search stories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-56 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        />

        {/* Region filter */}
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        >
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                category === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="text-center py-8 text-red-500 text-sm">
          Failed to load stories. Please try again.
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading stories...</div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && displayStories.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {search
            ? 'No stories match your search.'
            : activeTab === 'trending'
              ? 'No trending stories right now.'
              : 'No stories found for this filter.'}
        </div>
      )}

      {/* Story grid */}
      {displayStories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayStories.map((story) => (
            <StoryCard key={story.id} story={story} projectId={projectId} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel (latest tab only) */}
      {activeTab === 'latest' && feedQuery.hasNextPage && (
        <div ref={loadMoreRef} className="py-6 text-center">
          {feedQuery.isFetchingNextPage ? (
            <span className="text-sm text-gray-400">Loading more...</span>
          ) : (
            <span className="text-sm text-gray-300">Scroll for more</span>
          )}
        </div>
      )}
    </div>
  );
}
