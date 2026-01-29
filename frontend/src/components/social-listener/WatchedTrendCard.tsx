// Watched trend card component

import { useUnwatchTrend } from '../../hooks/useSocialListener';
import type { WatchedTrend } from '../../services/social-listener.service';

interface WatchedTrendCardProps {
  trend: WatchedTrend;
}

const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  x: 'X',
  google_trends: 'Google',
};

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffMs / 86400000);
  return `${diffDays}d ago`;
}

export function WatchedTrendCard({ trend }: WatchedTrendCardProps) {
  const unwatchMutation = useUnwatchTrend();

  const handleUnwatch = () => {
    if (confirm(`Stop watching "${trend.query}"?`)) {
      unwatchMutation.mutate(trend.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Query */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{trend.query}</h3>
        <span className="shrink-0 ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
          {trend.queryType}
        </span>
      </div>

      {/* Platforms */}
      <div className="flex flex-wrap gap-1 mb-3">
        {trend.platforms.map((platform) => (
          <span
            key={platform}
            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
          >
            {PLATFORM_LABELS[platform] || platform}
          </span>
        ))}
      </div>

      {/* Status */}
      <div className="text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${trend.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          {trend.isActive ? 'Active' : 'Paused'}
        </div>
        {trend.lastScrapedAt && (
          <div className="mt-1 text-gray-400">
            Last updated: {formatTimeAgo(trend.lastScrapedAt)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button className="text-xs text-primary-600 hover:text-primary-700">
          View insights
        </button>
        <button
          onClick={handleUnwatch}
          disabled={unwatchMutation.isPending}
          className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
        >
          {unwatchMutation.isPending ? 'Removing...' : 'Unwatch'}
        </button>
      </div>
    </div>
  );
}
