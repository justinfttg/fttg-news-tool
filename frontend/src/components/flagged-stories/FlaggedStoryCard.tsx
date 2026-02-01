import { NewsStory } from '../../types';
import { AngleWithDetails } from '../../services/angle.service';
import { formatDistanceToNow } from 'date-fns';

interface FlaggedStoryCardProps {
  story: NewsStory;
  projectId: string;
  angles: AngleWithDetails[];
  onGenerateAngle: () => void;
  onViewAngle: (angle: AngleWithDetails) => void;
  hasAudienceProfiles: boolean;
}

export function FlaggedStoryCard({
  story,
  angles,
  onGenerateAngle,
  onViewAngle,
  hasAudienceProfiles,
}: FlaggedStoryCardProps) {
  const publishedDate = story.published_at
    ? formatDistanceToNow(new Date(story.published_at), { addSuffix: true })
    : 'Unknown date';

  // Get framework type display name
  const getFrameworkLabel = (angleData: Record<string, any>) => {
    if (angleData.contrarian_headline) return 'FTTG Investigative';
    if (angleData.timely_hook) return 'Educational Deep-Dive';
    return 'Custom';
  };

  // Get framework badge color
  const getFrameworkColor = (angleData: Record<string, any>) => {
    if (angleData.contrarian_headline) return 'bg-red-100 text-red-700';
    if (angleData.timely_hook) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Thumbnail */}
        {story.thumbnail_url && (
          <div className="flex-shrink-0">
            <img
              src={story.thumbnail_url}
              alt=""
              className="w-32 h-24 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-1">
                {story.title}
              </h3>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="font-medium">{story.source}</span>
                <span>&bull;</span>
                <span>{publishedDate}</span>
                {story.category && (
                  <>
                    <span>&bull;</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {story.category}
                    </span>
                  </>
                )}
                {story.is_trending && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                    </svg>
                    Trending
                  </span>
                )}
              </div>

              {/* Summary */}
              {story.summary && (
                <p className="text-sm text-gray-600 line-clamp-2">{story.summary}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              <button
                onClick={onGenerateAngle}
                disabled={!hasAudienceProfiles}
                className="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                title={!hasAudienceProfiles ? 'Create an audience profile first' : 'Generate story angle'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Angle
              </button>
            </div>
          </div>

          {/* Generated Angles */}
          {angles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-xs font-medium text-gray-500">
                  {angles.length} {angles.length === 1 ? 'Angle' : 'Angles'} Generated
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {angles.map((angle) => (
                  <button
                    key={angle.id}
                    onClick={() => onViewAngle(angle)}
                    className="group flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                  >
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getFrameworkColor(angle.angle_data)}`}>
                      {getFrameworkLabel(angle.angle_data)}
                    </span>
                    {angle.angle_data.contrarian_headline && (
                      <span className="text-xs text-gray-600 max-w-48 truncate">
                        "{angle.angle_data.contrarian_headline}"
                      </span>
                    )}
                    {angle.angle_data.timely_hook && (
                      <span className="text-xs text-gray-600 max-w-48 truncate">
                        {angle.angle_data.timely_hook.slice(0, 50)}...
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      angle.status === 'approved' ? 'bg-green-100 text-green-700' :
                      angle.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {angle.status}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
