// Platform-specific trending topics widget for horizontal scroll layout

import { useState } from 'react';
import type { TrendingTopic } from '../../services/social-listener.service';

interface TrendingTopicWidgetProps {
  platform: {
    id: string;
    label: string;
    color: string;
    icon: string;
    bgGradient: string;
  };
  topics: TrendingTopic[];
  isLoading: boolean;
  onWatch: (query: string) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function TrendingTopicWidget({ platform, topics, isLoading, onWatch }: TrendingTopicWidgetProps) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  return (
    <div className="flex-shrink-0 w-[calc(28.57%-0.75rem)] min-w-[280px] bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className={`px-4 py-3 ${platform.bgGradient} flex items-center gap-2`}>
        <span className="text-lg">{platform.icon}</span>
        <span className="font-semibold text-white text-sm">{platform.label}</span>
        <span className="ml-auto text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
          {topics.length} topics
        </span>
      </div>

      {/* Topics content */}
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading...</span>
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <span className="text-3xl mb-2 opacity-50">{platform.icon}</span>
            <p className="text-sm text-gray-400">No trending topics</p>
          </div>
        ) : (
          topics.map((topic, index) => (
            <div key={`${platform.id}-${topic.name}`} className="group">
              {/* Collapsed view */}
              <button
                onClick={() => setExpandedTopic(expandedTopic === topic.name ? null : topic.name)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {/* Rank */}
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium text-gray-800 truncate flex-1">
                    {topic.hashtag || topic.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 pl-7">
                  <span>{formatNumber(topic.engagement)} engagement</span>
                  <span className="text-gray-300">|</span>
                  <span>{topic.posts} posts</span>
                </div>
              </button>

              {/* Expanded view */}
              {expandedTopic === topic.name && (
                <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  {/* Full name if different */}
                  {topic.hashtag && topic.name !== topic.hashtag && (
                    <p className="text-xs text-gray-600 pt-2">{topic.name}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    {topic.url && (
                      <a
                        href={topic.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Explore
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatch(topic.hashtag || topic.name);
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
