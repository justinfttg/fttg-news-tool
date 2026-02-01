// Main Social Listener view component

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useViralPosts, useTrendingTopics, useWatchedTrends } from '../../hooks/useSocialListener';
import { WatchedTrendCard } from './WatchedTrendCard';
import { WatchTrendModal } from './WatchTrendModal';
import { PlatformFeedWidget } from './PlatformFeedWidget';
import { TrendingTopicWidget } from './TrendingTopicWidget';

const PLATFORMS = [
  { id: 'reddit', label: 'Reddit', color: 'bg-orange-500', icon: '🔥', bgGradient: 'bg-gradient-to-r from-orange-500 to-orange-600' },
  { id: 'x', label: 'X', color: 'bg-black', icon: '𝕏', bgGradient: 'bg-gradient-to-r from-gray-800 to-gray-900' },
  { id: 'google_trends', label: 'Google Trends', color: 'bg-blue-500', icon: '📈', bgGradient: 'bg-gradient-to-r from-blue-500 to-blue-600' },
  { id: 'youtube', label: 'YouTube', color: 'bg-red-600', icon: '▶️', bgGradient: 'bg-gradient-to-r from-red-500 to-red-600' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-pink-500', icon: '🎵', bgGradient: 'bg-gradient-to-r from-pink-500 to-pink-600' },
  { id: 'instagram', label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500', icon: '📷', bgGradient: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400' },
];

const REGIONS = [
  { value: 'singapore', label: 'Singapore' },
  { value: 'china', label: 'China' },
  { value: 'global', label: 'Global' },
  { value: 'asia', label: 'Asia' },
  { value: 'southeast_asia', label: 'Southeast Asia' },
  { value: 'east_asia', label: 'East Asia' },
  { value: 'apac', label: 'APAC' },
];

type SubTab = 'viral' | 'trending' | 'watching';

interface SocialListenerViewProps {
  projectId: string;
  regions?: string[];
}

export function SocialListenerView({ projectId, regions: initialRegions }: SocialListenerViewProps) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>('viral');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'reddit',
    'x',
    'google_trends',
    'youtube',
    'tiktok',
    'instagram',
  ]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(initialRegions || []);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [prefilledQuery, setPrefilledQuery] = useState('');
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

  // Convert empty array to undefined for API
  const regionParam = selectedRegions.length > 0 ? selectedRegions[0] : undefined;

  // Data fetching - request more posts so each platform widget has enough content
  const viralQuery = useViralPosts({
    platforms: selectedPlatforms,
    region: regionParam,
    limit: 100,
  });

  const trendingQuery = useTrendingTopics({
    platforms: selectedPlatforms,
    region: regionParam,
    limit: 50,
  });

  const watchedQuery = useWatchedTrends(projectId);

  // Handle watch action from cards
  const handleWatch = (query: string) => {
    setPrefilledQuery(query);
    setShowWatchModal(true);
  };

  // Toggle platform filter
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        // Don't allow removing all platforms
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== platformId);
      }
      return [...prev, platformId];
    });
  };

  const isLoading =
    subTab === 'viral'
      ? viralQuery.isLoading
      : subTab === 'trending'
        ? trendingQuery.isLoading
        : watchedQuery.isLoading;

  const isError =
    subTab === 'viral'
      ? viralQuery.isError
      : subTab === 'trending'
        ? trendingQuery.isError
        : watchedQuery.isError;

  const postCount = viralQuery.data?.posts?.length || 0;
  const topicCount = trendingQuery.data?.topics?.length || 0;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setSubTab('viral')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'viral'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Viral Posts {postCount > 0 && `(${postCount})`}
        </button>
        <button
          onClick={() => setSubTab('trending')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'trending'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Trending Topics {topicCount > 0 && `(${topicCount})`}
        </button>
        <button
          onClick={() => setSubTab('watching')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'watching'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Watching ({watchedQuery.data?.trends.length || 0})
        </button>

        {/* Refresh button */}
        <button
          onClick={async () => {
            // Use resetQueries to clear cache and refetch fresh data
            if (subTab === 'viral') {
              await queryClient.resetQueries({ queryKey: ['viralPosts'] });
            } else if (subTab === 'trending') {
              await queryClient.resetQueries({ queryKey: ['trendingTopics'] });
            } else {
              await queryClient.resetQueries({ queryKey: ['watchedTrends'] });
            }
          }}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          <svg
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
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
          Refresh
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Platform filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Platforms:</span>
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-colors ${
                selectedPlatforms.includes(platform.id)
                  ? `${platform.color} text-white`
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {platform.label}
            </button>
          ))}
        </div>

        {/* Region filter - Multi-select dropdown */}
        <div className="relative" ref={regionDropdownRef}>
          <button
            onClick={() => setShowRegionDropdown(!showRegionDropdown)}
            className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white hover:bg-gray-50 focus:ring-1 focus:ring-primary-500"
          >
            <span>
              {selectedRegions.length === 0
                ? 'All Regions'
                : `${selectedRegions.length} region${selectedRegions.length > 1 ? 's' : ''}`}
            </span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRegionDropdown && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg">
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
                      className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-xs">{r.label}</span>
                  </label>
                ))}
              </div>
              <div className="p-2 border-t border-gray-100">
                <button
                  onClick={() => setShowRegionDropdown(false)}
                  className="w-full text-xs text-center py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {subTab === 'watching' && (
          <button
            onClick={() => {
              setPrefilledQuery('');
              setShowWatchModal(true);
            }}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
          >
            + Watch Trend
          </button>
        )}
      </div>

      {/* Error state */}
      {isError && (
        <div className="text-center py-8 text-red-500 text-sm">
          Failed to load data. Please try again.
        </div>
      )}

      {/* Loading state - only for watching tab now */}
      {isLoading && subTab === 'watching' && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading social data...
          </div>
        </div>
      )}

      {/* Viral Posts Tab - Horizontal Scrollable Widgets */}
      {subTab === 'viral' && !isError && (
        <div className="space-y-3">
          {/* Hashtag summary bar */}
          {viralQuery.data?.hashtags && viralQuery.data.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
              <span className="text-xs text-gray-500 mr-1">Top hashtags:</span>
              {viralQuery.data.hashtags.slice(0, 8).map((h) => (
                <button
                  key={h.hashtag}
                  onClick={() => handleWatch(h.hashtag)}
                  className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                >
                  {h.hashtag}
                  <span className="ml-1 text-blue-400">
                    {h.momentum === 'rising' && '↑'}
                    {h.momentum === 'falling' && '↓'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Horizontal scrollable platform widgets */}
          <div className="relative">
            {/* Scroll hint gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />

            {/* Scrollable container - shows 3.5 widgets */}
            <div
              className="flex gap-4 overflow-x-auto pb-4 px-2 scroll-smooth snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent'
              }}
            >
              {PLATFORMS.filter(p => selectedPlatforms.includes(p.id)).map((platform) => {
                const platformPosts = viralQuery.data?.posts?.filter(
                  post => post.platform === platform.id
                ) || [];

                return (
                  <div key={platform.id} className="snap-start">
                    <PlatformFeedWidget
                      platform={platform}
                      posts={platformPosts}
                      isLoading={viralQuery.isLoading}
                      onWatch={handleWatch}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* No data state */}
          {!viralQuery.isLoading && (!viralQuery.data?.posts || viralQuery.data.posts.length === 0) && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <p>No viral posts found for selected platforms.</p>
              <p className="mt-1 text-xs">Try selecting different platforms or regions.</p>
            </div>
          )}
        </div>
      )}

      {/* Trending Topics Tab - Horizontal Scrollable Widgets */}
      {subTab === 'trending' && !isError && (
        <div className="space-y-3">
          {/* Horizontal scrollable platform widgets */}
          <div className="relative">
            {/* Scroll hint gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />

            {/* Scrollable container - shows 3.5 widgets */}
            <div
              className="flex gap-4 overflow-x-auto pb-4 px-2 scroll-smooth snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent'
              }}
            >
              {PLATFORMS.filter(p => selectedPlatforms.includes(p.id)).map((platform) => {
                // Get topics for this platform
                const platformTopics = trendingQuery.data?.topics?.filter(
                  topic => topic.platforms.includes(platform.id)
                ) || [];

                return (
                  <div key={platform.id} className="snap-start">
                    <TrendingTopicWidget
                      platform={platform}
                      topics={platformTopics}
                      isLoading={trendingQuery.isLoading}
                      onWatch={handleWatch}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* No data state */}
          {!trendingQuery.isLoading && (!trendingQuery.data?.topics || trendingQuery.data.topics.length === 0) && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <p>No trending topics found for selected platforms.</p>
              <p className="mt-1 text-xs">Try selecting different platforms or regions.</p>
            </div>
          )}
        </div>
      )}

      {/* Watching Tab */}
      {subTab === 'watching' && !isLoading && !isError && (
        <div>
          {watchedQuery.data?.trends && watchedQuery.data.trends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {watchedQuery.data.trends.map((trend) => (
                <WatchedTrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              <p className="mb-3">You're not watching any trends yet.</p>
              <button
                onClick={() => {
                  setPrefilledQuery('');
                  setShowWatchModal(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
              >
                + Watch Your First Trend
              </button>
            </div>
          )}
        </div>
      )}

      {/* Watch Modal */}
      {showWatchModal && (
        <WatchTrendModal
          projectId={projectId}
          initialQuery={prefilledQuery}
          onClose={() => setShowWatchModal(false)}
        />
      )}
    </div>
  );
}
