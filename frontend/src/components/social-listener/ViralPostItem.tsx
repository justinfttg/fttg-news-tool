// Viral post list item component - expandable row format

import { useState } from 'react';
import type { SocialPost } from '../../services/social-listener.service';

interface ViralPostItemProps {
  post: SocialPost;
  onWatch: (query: string) => void;
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  reddit: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Reddit', icon: '🔥' },
  x: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'X', icon: '𝕏' },
  google_trends: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Google', icon: '📈' },
  youtube: { bg: 'bg-red-100', text: 'text-red-700', label: 'YouTube', icon: '▶️' },
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

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ViralPostItem({ post, onWatch }: ViralPostItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const platformStyle = PLATFORM_STYLES[post.platform] || PLATFORM_STYLES.reddit;

  const engagementScore = post.likes + post.comments * 3 + post.reposts * 2;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Collapsed row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Platform icon */}
        <span
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm ${platformStyle.bg}`}
        >
          {platformStyle.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{post.content}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${platformStyle.text}`}>
              {platformStyle.label}
            </span>
            {post.authorHandle && (
              <span className="text-xs text-gray-400">
                @{post.authorHandle}
              </span>
            )}
            {post.region && (
              <span className="text-xs text-gray-400">
                • {post.region}
              </span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1" title="Likes">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            {formatNumber(post.likes)}
          </span>
          <span className="flex items-center gap-1" title="Comments">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            {formatNumber(post.comments)}
          </span>
          {post.postedAt && (
            <span className="text-gray-400 hidden sm:inline">
              {formatTimeAgo(post.postedAt)}
            </span>
          )}
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
        <div className="px-4 pb-4 pl-16 space-y-3">
          {/* Full content */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>

          {/* Media preview */}
          {post.mediaUrls.length > 0 && (
            <div className="rounded overflow-hidden bg-gray-100 max-w-md">
              <img
                src={post.mediaUrls[0]}
                alt=""
                className="w-full h-auto max-h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onWatch(tag);
                  }}
                  className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Engagement details */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{formatNumber(post.likes)} likes</span>
            <span>{formatNumber(post.comments)} comments</span>
            {post.reposts > 0 && <span>{formatNumber(post.reposts)} reposts</span>}
            {post.views > 0 && <span>{formatNumber(post.views)} views</span>}
            <span className="text-gray-400">
              Score: {formatNumber(engagementScore)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {post.postUrl && (
              <a
                href={post.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View original
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWatch(post.content.split(' ').slice(0, 3).join(' '));
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Watch topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
