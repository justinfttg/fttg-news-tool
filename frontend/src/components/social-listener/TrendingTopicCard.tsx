// Trending topic card component

import type { TrendingTopic } from '../../services/social-listener.service';

interface TrendingTopicCardProps {
  topic: TrendingTopic;
  onWatch: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: 'bg-orange-500',
  x: 'bg-gray-800',
  google_trends: 'bg-blue-500',
  youtube: 'bg-red-500',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function TrendingTopicCard({ topic, onWatch }: TrendingTopicCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Topic name */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
          {topic.hashtag || topic.name}
        </h3>
        {topic.crossPlatform && (
          <span className="shrink-0 ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
            Cross-platform
          </span>
        )}
      </div>

      {/* Platform indicators */}
      <div className="flex items-center gap-1 mb-3">
        {topic.platforms.map((platform) => (
          <span
            key={platform}
            className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[platform] || 'bg-gray-400'}`}
            title={platform}
          />
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {topic.platforms.length} platform{topic.platforms.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">Engagement</span>
          <div className="font-semibold text-gray-800">{formatNumber(topic.engagement)}</div>
        </div>
        <div>
          <span className="text-gray-400">Score</span>
          <div className="font-semibold text-gray-800">{formatNumber(topic.score)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            Explore
          </a>
        )}
        <button
          onClick={onWatch}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50"
        >
          + Watch
        </button>
      </div>
    </div>
  );
}
