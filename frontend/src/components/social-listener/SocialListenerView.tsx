// Main Social Listener view component

import { useState } from 'react';
import { useViralPosts, useTrendingTopics, useWatchedTrends } from '../../hooks/useSocialListener';
import { ViralPostItem } from './ViralPostItem';
import { TrendingTopicItem } from './TrendingTopicItem';
import { WatchedTrendCard } from './WatchedTrendCard';
import { WatchTrendModal } from './WatchTrendModal';

const PLATFORMS = [
  { id: 'reddit', label: 'Reddit', color: 'bg-orange-500' },
  { id: 'x', label: 'X', color: 'bg-black' },
  { id: 'google_trends', label: 'Google', color: 'bg-blue-500' },
  { id: 'youtube', label: 'YouTube', color: 'bg-red-600' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-pink-500' },
  { id: 'instagram', label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
];

const REGIONS = [
  { id: 'all', label: 'All Regions' },
  { id: 'global', label: 'Global' },
  { id: 'singapore', label: 'Singapore' },
  { id: 'china', label: 'China' },
  { id: 'east_asia', label: 'East Asia' },
  { id: 'apac', label: 'Asia Pacific' },
];

type SubTab = 'viral' | 'trending' | 'watching';

interface SocialListenerViewProps {
  projectId: string;
  region?: string;
}

export function SocialListenerView({ projectId, region: initialRegion }: SocialListenerViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('viral');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'reddit',
    'x',
    'google_trends',
    'youtube',
    'tiktok',
    'instagram',
  ]);
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion || 'all');
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [prefilledQuery, setPrefilledQuery] = useState('');

  // Convert "all" to undefined for API
  const regionParam = selectedRegion === 'all' ? undefined : selectedRegion;

  // Data fetching
  const viralQuery = useViralPosts({
    platforms: selectedPlatforms,
    region: regionParam,
    limit: 50,
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
          onClick={() => {
            if (subTab === 'viral') viralQuery.refetch();
            else if (subTab === 'trending') trendingQuery.refetch();
            else watchedQuery.refetch();
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

        {/* Region filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Region:</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {REGIONS.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </select>
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

      {/* Loading state */}
      {isLoading && (
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

      {/* Viral Posts Tab */}
      {subTab === 'viral' && !isLoading && !isError && (
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

          {/* Posts list */}
          {viralQuery.data?.posts && viralQuery.data.posts.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {viralQuery.data.posts.map((post) => (
                <ViralPostItem
                  key={`${post.platform}-${post.externalId}`}
                  post={post}
                  onWatch={handleWatch}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              <p>No viral posts found for selected platforms.</p>
              <p className="mt-1 text-xs">Try selecting different platforms or regions.</p>
            </div>
          )}
        </div>
      )}

      {/* Trending Topics Tab */}
      {subTab === 'trending' && !isLoading && !isError && (
        <div>
          {trendingQuery.data?.topics && trendingQuery.data.topics.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {trendingQuery.data.topics.map((topic, index) => (
                <TrendingTopicItem
                  key={topic.name}
                  topic={topic}
                  rank={index + 1}
                  onWatch={() => handleWatch(topic.hashtag || topic.name)}
                />
              ))}
            </div>
          ) : (
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
