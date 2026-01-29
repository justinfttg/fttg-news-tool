import { NewsStory } from '../../types';
import { AddToCalendarButton } from './AddToCalendarButton';

const CATEGORY_COLORS: Record<string, string> = {
  Technology: 'bg-blue-100 text-blue-700',
  Health: 'bg-green-100 text-green-700',
  Economy: 'bg-amber-100 text-amber-700',
  Business: 'bg-purple-100 text-purple-700',
  Environment: 'bg-emerald-100 text-emerald-700',
  Politics: 'bg-red-100 text-red-700',
  Security: 'bg-orange-100 text-orange-700',
  Science: 'bg-cyan-100 text-cyan-700',
  Education: 'bg-indigo-100 text-indigo-700',
  Sports: 'bg-lime-100 text-lime-700',
  Entertainment: 'bg-pink-100 text-pink-700',
  General: 'bg-gray-100 text-gray-700',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Show relative time for recent articles
  if (diffMins < 60) {
    return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Older articles show full date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface StoryCardProps {
  story: NewsStory;
  projectId: string;
}

export function StoryCard({ story, projectId }: StoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail image */}
      {story.thumbnail_url && (
        <div className="w-full h-32 bg-gray-100">
          <img
            src={story.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken images
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="p-4">
        {/* Header: Category badge + trending indicator */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryColor(story.category)}`}>
            {story.category}
          </span>
          {story.is_trending && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
              Trending {story.trend_score > 0 && `(${story.trend_score})`}
            </span>
          )}
          {story.region && (
            <span className="text-xs text-gray-400 ml-auto">
              {story.region.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
          {story.url ? (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600"
            >
              {story.title}
            </a>
          ) : (
            story.title
          )}
        </h3>

        {/* Summary/Excerpt */}
        {(story.summary || story.content) && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2">
            {story.summary || (story.content !== story.title ? story.content : null)}
          </p>
        )}

        {/* Footer: source, date, actions */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-medium text-gray-500">{story.source}</span>
            <span>&middot;</span>
            <span>{formatDate(story.published_at)}</span>
          </div>

          <AddToCalendarButton story={story} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
