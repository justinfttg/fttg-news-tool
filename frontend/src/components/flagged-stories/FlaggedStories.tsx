import { useState, useCallback, useRef, useEffect } from 'react';
import { useMarkedStories } from '../../hooks/useNews';
import { useAudienceProfiles } from '../../hooks/useAudience';
import { useAngles } from '../../hooks/useAngles';
import { useWatchedTrends } from '../../hooks/useSocialListener';
import { FlaggedStoryCard } from './FlaggedStoryCard';
import { AngleGenerationModal } from './AngleGenerationModal';
import { AngleViewModal } from './AngleViewModal';
import { NewsStory } from '../../types';
import { AngleWithDetails } from '../../services/angle.service';

interface FlaggedStoriesProps {
  projectId: string;
}

export function FlaggedStories({ projectId }: FlaggedStoriesProps) {
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AngleWithDetails | null>(null);
  const [showAngleModal, setShowAngleModal] = useState(false);
  const [showAngleViewModal, setShowAngleViewModal] = useState(false);

  // Fetch marked stories
  const markedQuery = useMarkedStories(projectId);

  // Fetch audience profiles for angle generation
  const { data: audienceProfiles } = useAudienceProfiles(projectId);

  // Fetch all angles for this project
  const { data: angles } = useAngles(projectId);

  // Fetch watched trends for context
  const { data: watchedTrendsData } = useWatchedTrends(projectId);
  const watchedTrends = watchedTrendsData?.trends || [];

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            markedQuery.hasNextPage &&
            !markedQuery.isFetchingNextPage
          ) {
            markedQuery.fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    },
    [markedQuery.hasNextPage, markedQuery.isFetchingNextPage, markedQuery.fetchNextPage]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Deduplicated marked stories
  const markedStories: NewsStory[] = (() => {
    const allStories = markedQuery.data?.pages.flatMap((page) => page.stories) || [];
    const seen = new Set<string>();
    return allStories.filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });
  })();

  // Group angles by story ID for easy lookup
  const anglesByStory = (angles || []).reduce((acc, angle) => {
    const storyId = angle.news_story_id;
    if (!acc[storyId]) acc[storyId] = [];
    acc[storyId].push(angle);
    return acc;
  }, {} as Record<string, AngleWithDetails[]>);

  const handleGenerateAngle = (story: NewsStory) => {
    setSelectedStory(story);
    setShowAngleModal(true);
  };

  const handleViewAngle = (angle: AngleWithDetails) => {
    setSelectedAngle(angle);
    setShowAngleViewModal(true);
  };

  const handleCloseAngleModal = () => {
    setShowAngleModal(false);
    setSelectedStory(null);
  };

  const handleCloseAngleViewModal = () => {
    setShowAngleViewModal(false);
    setSelectedAngle(null);
  };

  const totalCount = markedQuery.data?.pages[0]?.pagination.total ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Flagged Stories</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate story angles for your flagged news stories using AI-powered frameworks.
            </p>
          </div>
          <span className="text-xs text-gray-400">
            {totalCount} {totalCount === 1 ? 'story' : 'stories'} flagged
          </span>
        </div>
      </div>

      {/* Watched trends context */}
      {watchedTrends.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800">Social Listening Context Active</h3>
              <p className="text-xs text-blue-700 mt-1">
                The following trends from Social Listener will be considered when generating story angles:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {watchedTrends.slice(0, 5).map((trend) => (
                  <span
                    key={trend.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
                  >
                    {trend.queryType === 'hashtag' && '#'}
                    {trend.query.replace(/^#/, '')}
                    <span className="text-blue-400">({trend.platforms.length} platforms)</span>
                  </span>
                ))}
                {watchedTrends.length > 5 && (
                  <span className="text-xs text-blue-500">+{watchedTrends.length - 5} more</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No audience profiles warning */}
      {(!audienceProfiles || audienceProfiles.length === 0) && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-amber-800">No Audience Profiles</h3>
              <p className="text-sm text-amber-700 mt-1">
                You need at least one audience profile to generate story angles.{' '}
                <a href={`/project/${projectId}/audience`} className="underline font-medium">
                  Create an audience profile
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {markedQuery.isError && (
        <div className="text-center py-8 text-red-500 text-sm">
          Failed to load flagged stories. Please try again.
        </div>
      )}

      {/* Loading state */}
      {markedQuery.isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading flagged stories...</div>
      )}

      {/* Empty state */}
      {!markedQuery.isLoading && !markedQuery.isError && markedStories.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            />
          </svg>
          <p className="text-gray-500 text-sm font-medium">No flagged stories yet</p>
          <p className="text-gray-400 text-xs mt-2">
            Go to the News Library and click the flag icon on stories you want to develop angles for.
          </p>
        </div>
      )}

      {/* Story cards */}
      {markedStories.length > 0 && (
        <div className="space-y-4">
          {markedStories.map((story) => (
            <FlaggedStoryCard
              key={story.id}
              story={story}
              projectId={projectId}
              angles={anglesByStory[story.id] || []}
              onGenerateAngle={() => handleGenerateAngle(story)}
              onViewAngle={handleViewAngle}
              hasAudienceProfiles={!!audienceProfiles && audienceProfiles.length > 0}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {markedQuery.hasNextPage && (
        <div ref={loadMoreRef} className="py-6 text-center">
          {markedQuery.isFetchingNextPage ? (
            <span className="text-sm text-gray-400">Loading more...</span>
          ) : (
            <span className="text-sm text-gray-300">Scroll for more</span>
          )}
        </div>
      )}

      {/* Angle Generation Modal */}
      {showAngleModal && selectedStory && audienceProfiles && (
        <AngleGenerationModal
          story={selectedStory}
          projectId={projectId}
          audienceProfiles={audienceProfiles}
          onClose={handleCloseAngleModal}
        />
      )}

      {/* Angle View Modal */}
      {showAngleViewModal && selectedAngle && (
        <AngleViewModal
          angle={selectedAngle}
          projectId={projectId}
          onClose={handleCloseAngleViewModal}
        />
      )}
    </div>
  );
}
