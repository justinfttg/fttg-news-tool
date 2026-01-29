// Trending topic list item component - expandable row format

import { useState } from 'react';
import type { TrendingTopic } from '../../services/social-listener.service';

interface TrendingTopicItemProps {
  topic: TrendingTopic;
  rank: number;
  onWatch: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: 'bg-orange-500',
  x: 'bg-gray-800',
  google_trends: 'bg-blue-500',
  youtube: 'bg-red-500',
  tiktok: 'bg-pink-500',
  instagram: 'bg-purple-500',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function TrendingTopicItem({ topic, rank, onWatch }: TrendingTopicItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCrossPlatform = topic.platforms.length > 1;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Collapsed row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Rank */}
        <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
          {rank}
        </span>

        {/* Topic name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {topic.hashtag || topic.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Platform indicators */}
            <div className="flex items-center gap-0.5">
              {topic.platforms.map((platform) => (
                <span
                  key={platform}
                  className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[platform] || 'bg-gray-400'}`}
                  title={platform}
                />
              ))}
            </div>
            {isCrossPlatform && (
              <span className="text-xs text-purple-600 font-medium">
                Cross-platform 🔥
              </span>
            )}
            {topic.region && topic.region !== 'global' && (
              <span className="text-xs text-gray-400">
                {topic.region}
              </span>
            )}
          </div>
        </div>

        {/* Engagement */}
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-medium text-gray-700">
            {formatNumber(topic.engagement)}
          </div>
          <div className="text-xs text-gray-400">
            {topic.posts} posts
          </div>
        </div>

        {/* Expand icon */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 pl-14 space-y-3">
          {/* Full name if different from hashtag */}
          {topic.hashtag && topic.name !== topic.hashtag && (
            <p className="text-sm text-gray-700">{topic.name}</p>
          )}

          {/* Platforms breakdown */}
          <div className="flex flex-wrap gap-2">
            {topic.platforms.map((platform) => (
              <span
                key={platform}
                className={`text-xs px-2 py-0.5 rounded-full text-white ${PLATFORM_COLORS[platform] || 'bg-gray-500'}`}
              >
                {platform === 'google_trends' ? 'Google' : platform}
              </span>
            ))}
          </div>

          {/* Engagement info */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              <span className="font-medium">{formatNumber(topic.engagement)}</span> engagement
            </span>
            <span>
              <span className="font-medium">{topic.posts}</span> posts
            </span>
            {isCrossPlatform && (
              <span className="text-purple-600">
                Trending on {topic.platforms.length} platforms
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {topic.url && (
              <a
                href={topic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Explore
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWatch();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Watch this trend
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
