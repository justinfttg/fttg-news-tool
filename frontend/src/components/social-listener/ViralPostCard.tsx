// Viral post card component

import type { SocialPost } from '../../services/social-listener.service';

interface ViralPostCardProps {
  post: SocialPost;
  onWatch: (query: string) => void;
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  reddit: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Reddit' },
  x: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'X' },
  google_trends: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Google' },
  youtube: { bg: 'bg-red-100', text: 'text-red-700', label: 'YouTube' },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ViralPostCard({ post, onWatch }: ViralPostCardProps) {
  const platformStyle = PLATFORM_STYLES[post.platform] || PLATFORM_STYLES.reddit;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header: Platform + Author */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformStyle.bg} ${platformStyle.text}`}
        >
          {platformStyle.label}
        </span>
        {post.authorHandle && (
          <span className="text-xs text-gray-500 truncate">
            @{post.authorHandle}
          </span>
        )}
        {post.postedAt && (
          <span className="text-xs text-gray-400 ml-auto">
            {formatTimeAgo(post.postedAt)}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-gray-800 mb-3 line-clamp-3">{post.content}</p>

      {/* Media preview */}
      {post.mediaUrls.length > 0 && (
        <div className="mb-3 rounded overflow-hidden bg-gray-100 h-24">
          <img
            src={post.mediaUrls[0]}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Engagement metrics */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {formatNumber(post.likes)}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {formatNumber(post.comments)}
        </span>
        {post.reposts > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {formatNumber(post.reposts)}
          </span>
        )}
      </div>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.hashtags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={() => onWatch(tag)}
              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
              title="Click to watch this hashtag"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {post.postUrl && (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            View original
          </a>
        )}
        <button
          onClick={() => onWatch(post.content.split(' ').slice(0, 3).join(' '))}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Watch topic
        </button>
      </div>
    </div>
  );
}
