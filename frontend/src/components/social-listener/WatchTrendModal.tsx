// Modal for creating a new watched trend

import { useState } from 'react';
import { useWatchTrend } from '../../hooks/useSocialListener';

interface WatchTrendModalProps {
  projectId: string;
  initialQuery?: string;
  onClose: () => void;
}

const PLATFORMS = [
  { id: 'reddit', label: 'Reddit' },
  { id: 'x', label: 'X/Twitter' },
  { id: 'google_trends', label: 'Google Trends' },
];

const QUERY_TYPES = [
  { id: 'keyword', label: 'Keyword', description: 'Match any mention of this word' },
  { id: 'hashtag', label: 'Hashtag', description: 'Track a specific hashtag' },
  { id: 'phrase', label: 'Phrase', description: 'Match exact phrase' },
];

export function WatchTrendModal({
  projectId,
  initialQuery = '',
  onClose,
}: WatchTrendModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [queryType, setQueryType] = useState<'keyword' | 'hashtag' | 'phrase'>(
    initialQuery.startsWith('#') ? 'hashtag' : 'keyword'
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'reddit',
    'x',
    'google_trends',
  ]);
  const [error, setError] = useState<string | null>(null);

  const watchMutation = useWatchTrend();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!query.trim()) return;

    if (!projectId) {
      setError('No project selected. Please select a project first.');
      return;
    }

    watchMutation.mutate(
      {
        query: query.trim(),
        queryType,
        projectId,
        platforms: selectedPlatforms,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: Error) => {
          console.error('[WatchTrendModal] Error creating watched trend:', err);
          setError(err.message || 'Failed to create watched trend. Please try again.');
        },
      }
    );
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((p) => p !== platformId);
      }
      return [...prev, platformId];
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Watch a Trend</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* Error display */}
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Query input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic or hashtag
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., #AINews or climate change"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>

            {/* Query type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Match type
              </label>
              <div className="flex gap-2">
                {QUERY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setQueryType(type.id as typeof queryType)}
                    className={`flex-1 px-3 py-2 text-xs rounded-md border ${
                      queryType === type.id
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platforms to monitor
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      selectedPlatforms.includes(platform.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!query.trim() || watchMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
            >
              {watchMutation.isPending ? 'Adding...' : 'Watch Trend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
