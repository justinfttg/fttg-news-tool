import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNewsFeed, useMarkedStories, useMarkedIds } from '../../hooks/useNews';
import { StoryCard } from './StoryCard';
import { NewsStory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const REGIONS = [
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

type Tab = 'latest' | 'marked';

interface NewsLibraryProps {
  projectId: string;
}

export function NewsLibrary({ projectId }: NewsLibraryProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('latest');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);

  // Toggle region selection
  const toggleRegion = (regionValue: string) => {
    setSelectedRegions((prev) =>
      prev.includes(regionValue)
        ? prev.filter((r) => r !== regionValue)
        : [...prev, regionValue]
    );
  };

  // Clear all regions
  const clearRegions = () => setSelectedRegions([]);

  // Close dropdown when clicking outside
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setShowRegionDropdown(false);
      }
    };
    if (showRegionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRegionDropdown]);

  // --- Latest feed (infinite scroll) ---
  const feedQuery = useNewsFeed({
    regions: selectedRegions.length > 0 ? selectedRegions : undefined,
    category: category === 'All' ? undefined : category,
  });

  // --- Marked stories feed (infinite scroll) ---
  const markedQuery = useMarkedStories(projectId);

  // --- Marked IDs for showing which stories are marked ---
  const markedIdsQuery = useMarkedIds();
  const markedIdsSet = new Set(markedIdsQuery.data || []);

  // --- Infinite scroll observer for latest feed ---
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

  // --- Infinite scroll observer for marked feed ---
  const markedObserverRef = useRef<IntersectionObserver | null>(null);
  const markedLoadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (markedObserverRef.current) markedObserverRef.current.disconnect();
      if (!node) return;

      markedObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            markedQuery.hasNextPage &&
            !markedQuery.isFetchingNextPage
          ) {
            markedQuery.fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );
      markedObserverRef.current.observe(node);
    },
    [markedQuery.hasNextPage, markedQuery.isFetchingNextPage, markedQuery.fetchNextPage]
  );

  // Cleanup observers on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (markedObserverRef.current) markedObserverRef.current.disconnect();
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

  // --- Marked stories (with deduplication) ---
  const markedStories: NewsStory[] = (() => {
    const allStories = markedQuery.data?.pages.flatMap((page) => page.stories) || [];
    const seen = new Set<string>();
    return allStories.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });
  })();

  // --- Refresh handler ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // For infinite queries, we need to reset (clear cache + refetch from page 1)
      // This ensures we get truly fresh data, not just re-fetch existing pages
      await queryClient.resetQueries({ queryKey: ['newsFeed'] });
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Fetch new stories from RSS (admin only) ---
  const handleFetchNews = async () => {
    if (!user?.is_fttg_team) return;

    setIsFetching(true);
    setFetchResult(null);
    try {
      const { data } = await api.post('/cron/news-fetcher');
      const msg = `Fetched ${data.inserted} new stories (${data.skipped} duplicates skipped)`;
      setFetchResult(msg);
      // Refresh the feed to show new stories
      await queryClient.resetQueries({ queryKey: ['newsFeed'] });
      setLastRefreshed(new Date());
    } catch (error: any) {
      setFetchResult(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsFetching(false);
    }
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
          onClick={() => setActiveTab('marked')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'marked'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Marked
          {markedQuery.data?.pages[0]?.pagination.total ? (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {markedQuery.data.pages[0].pagination.total}
            </span>
          ) : null}
        </button>
      </div>

      {/* Marked Stories Tab */}
      {activeTab === 'marked' && (
        <>
          {/* Header with count */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-400">
              {markedQuery.data?.pages[0]?.pagination.total ?? 0} marked{' '}
              {(markedQuery.data?.pages[0]?.pagination.total ?? 0) === 1 ? 'story' : 'stories'}
            </span>
          </div>

          {/* Error state */}
          {markedQuery.isError && (
            <div className="text-center py-8 text-red-500 text-sm">
              Failed to load marked stories. Please try again.
            </div>
          )}

          {/* Loading state */}
          {markedQuery.isLoading && (
            <div className="text-center py-12 text-gray-400 text-sm">Loading marked stories...</div>
          )}

          {/* Empty state */}
          {!markedQuery.isLoading && !markedQuery.isError && markedStories.length === 0 && (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <p className="text-gray-400 text-sm">No marked articles yet.</p>
              <p className="text-gray-400 text-xs mt-1">
                Click the bookmark icon on any article to save it here.
              </p>
            </div>
          )}

          {/* Story grid */}
          {markedStories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {markedStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  projectId={projectId}
                  isMarked={true}
                />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {markedQuery.hasNextPage && (
            <div ref={markedLoadMoreRef} className="py-6 text-center">
              {markedQuery.isFetchingNextPage ? (
                <span className="text-sm text-gray-400">Loading more...</span>
              ) : (
                <span className="text-sm text-gray-300">Scroll for more</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Latest News Tab */}
      {activeTab === 'latest' && (
        <>
          {/* Header with count and refresh */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {totalCount} {totalCount === 1 ? 'story' : 'stories'}
              </span>
              {lastRefreshed && (
                <span className="text-xs text-gray-400">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              {fetchResult && (
                <span className={`text-xs ${fetchResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {fetchResult}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Fetch Latest - Admin only (TODO: set is_fttg_team=true in DB for your user) */}
              {user && (
                <button
                  onClick={handleFetchNews}
                  disabled={isFetching}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isFetching ? 'animate-pulse' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {isFetching ? 'Fetching...' : 'Fetch Latest'}
                </button>
              )}
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
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
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
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

            {/* Region filter - Multi-select dropdown */}
            <div className="relative" ref={regionDropdownRef}>
              <button
                onClick={() => setShowRegionDropdown(!showRegionDropdown)}
                className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white hover:bg-gray-50 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <span>
                  {selectedRegions.length === 0
                    ? 'All Regions'
                    : `${selectedRegions.length} region${selectedRegions.length > 1 ? 's' : ''}`}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showRegionDropdown && (
                <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <button
                      onClick={clearRegions}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2">
                    {REGIONS.map((r) => (
                      <label
                        key={r.value}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(r.value)}
                          onChange={() => toggleRegion(r.value)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm">{r.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <button
                      onClick={() => setShowRegionDropdown(false)}
                      className="w-full text-sm text-center py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

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
                <StoryCard
                  key={story.id}
                  story={story}
                  projectId={projectId}
                  isMarked={markedIdsSet.has(story.id)}
                />
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
