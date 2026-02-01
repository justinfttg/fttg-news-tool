// Platform-specific feed widget component for horizontal scroll layout

import { useState } from 'react';
import type { SocialPost } from '../../services/social-listener.service';

interface PlatformFeedWidgetProps {
  platform: {
    id: string;
    label: string;
    color: string;
    icon: string;
    bgGradient: string;
  };
  posts: SocialPost[];
  isLoading: boolean;
  onWatch: (query: string) => void;
}

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

export function PlatformFeedWidget({ platform, posts, isLoading, onWatch }: PlatformFeedWidgetProps) {
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  return (
    <div className="flex-shrink-0 w-[calc(28.57%-0.75rem)] min-w-[280px] bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className={`px-4 py-3 ${platform.bgGradient} flex items-center gap-2`}>
        <span className="text-lg">{platform.icon}</span>
        <span className="font-semibold text-white text-sm">{platform.label}</span>
        <span className="ml-auto text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
          {posts.length} posts
        </span>
      </div>

      {/* Feed content */}
      <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-3xl mb-2 opacity-50">{platform.icon}</span>
            <p className="text-sm text-gray-400">No posts available</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={`${post.platform}-${post.externalId}`} className="group">
              {/* Collapsed view */}
              <button
                onClick={() => setExpandedPost(expandedPost === post.externalId ? null : post.externalId)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm text-gray-800 line-clamp-2 leading-snug">{post.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  {post.authorHandle && (
                    <span className="text-gray-400 truncate max-w-[100px]">@{post.authorHandle}</span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                    {formatNumber(post.likes)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
                    </svg>
                    {formatNumber(post.comments)}
                  </span>
                  {post.postedAt && (
                    <span className="ml-auto text-gray-400">{formatTimeAgo(post.postedAt)}</span>
                  )}
                </div>
              </button>

              {/* Expanded view */}
              {expandedPost === post.externalId && (
                <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  {/* Hashtags */}
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {post.hashtags.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation();
                            onWatch(tag);
                          }}
                          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    {post.postUrl && (
                      <a
                        href={post.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatch(post.content.split(' ').slice(0, 3).join(' '));
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Watch
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
