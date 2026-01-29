import { useState, useCallback, useRef, useEffect } from 'react';
import { useNewsFeed } from '../../hooks/useNews';
import { StoryCard } from './StoryCard';
import { SocialListenerView } from '../social-listener';
import { NewsStory } from '../../types';

const REGIONS = [
  { value: '', label: 'All Regions' },
  { value: 'singapore', label: 'Singapore' },
  { value: 'china', label: 'China' },
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

type Tab = 'latest' | 'social';

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

  // --- Derived data (with deduplication by story ID) ---
  const latestStories: NewsStory[] = (() => {
    const allStories = feedQuery.data?.pages.flatMap((page) => page.stories) || [];
    const seen = new Set<string>();
    return allStories.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });
  })();

  // --- Refresh handler ---
  const handleRefresh = () => {
    feedQuery.refetch();
  };

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

  const displayStories = filterBySearch(latestStories);

  const totalCount = feedQuery.data?.pages[0]?.pagination.total ?? 0;

  return (
    <div>
      {/* Main Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setActiveTab('latest')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'latest'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          News Feed
        </button>
        <button
          onClick={() => setActiveTab('social')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'social'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Social Listener
        </button>
      </div>

      {/* Social Listener Tab */}
      {activeTab === 'social' && (
        <SocialListenerView projectId={projectId} region={region || undefined} />
      )}

      {/* Latest News Tab */}
      {activeTab === 'latest' && (
        <>
          {/* Header with count and refresh */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-400">
              {totalCount} {totalCount === 1 ? 'story' : 'stories'}
            </span>
            <button
              onClick={handleRefresh}
              disabled={feedQuery.isRefetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${feedQuery.isRefetching ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {feedQuery.isRefetching ? 'Refreshing...' : 'Refresh'}
            </button>
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
          {feedQuery.isError && (
            <div className="text-center py-8 text-red-500 text-sm">
              Failed to load stories. Please try again.
            </div>
          )}

          {/* Loading state */}
          {feedQuery.isLoading && (
            <div className="text-center py-12 text-gray-400 text-sm">Loading stories...</div>
          )}

          {/* Empty state */}
          {!feedQuery.isLoading && !feedQuery.isError && displayStories.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              {search
                ? 'No stories match your search.'
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

          {/* Infinite scroll sentinel */}
          {feedQuery.hasNextPage && (
            <div ref={loadMoreRef} className="py-6 text-center">
              {feedQuery.isFetchingNextPage ? (
                <span className="text-sm text-gray-400">Loading more...</span>
              ) : (
                <span className="text-sm text-gray-300">Scroll for more</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
