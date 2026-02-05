import type { CalendarItem as CalendarItemType, ProductionEpisode } from '../../types';

const statusConfig: Record<CalendarItemType['status'], { bg: string; text: string; label: string }> = {
  draft:            { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'Draft' },
  pending_review:   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Review' },
  approved:         { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Approved' },
  in_production:    { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Production' },
  published:        { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Published' },
  cancelled:        { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
};

// Milestone type styling
const milestoneConfig: Record<string, { bg: string; text: string; icon: string }> = {
  topic_confirmation:   { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: '📋' },
  script_deadline:      { bg: 'bg-orange-100',  text: 'text-orange-700',  icon: '📝' },
  script_approval:      { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: '✅' },
  production_day:       { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: '🎬' },
  post_production:      { bg: 'bg-violet-100',  text: 'text-violet-700',  icon: '🎞️' },
  draft_1_review:       { bg: 'bg-cyan-100',    text: 'text-cyan-700',    icon: '1️⃣' },
  draft_2_review:       { bg: 'bg-teal-100',    text: 'text-teal-700',    icon: '2️⃣' },
  final_delivery:       { bg: 'bg-green-100',   text: 'text-green-700',   icon: '🚀' },
  default:              { bg: 'bg-gray-100',    text: 'text-gray-700',    icon: '📌' },
};

/**
 * Maps a CalendarItem status to a FullCalendar-compatible background hex color.
 * Used by CalendarView to set `event.backgroundColor`.
 */
export const statusColors: Record<CalendarItemType['status'], string> = {
  draft:          '#e5e7eb', // gray-200
  pending_review: '#fef08a', // yellow-200
  approved:       '#bbf7d0', // green-200
  in_production:  '#e9d5ff', // purple-200
  published:      '#bfdbfe', // blue-200
  cancelled:      '#fecaca', // red-200
};

export const statusTextColors: Record<CalendarItemType['status'], string> = {
  draft:          '#374151', // gray-700
  pending_review: '#854d0e', // yellow-800
  approved:       '#166534', // green-800
  in_production:  '#6b21a8', // purple-800
  published:      '#1e40af', // blue-800
  cancelled:      '#b91c1c', // red-700
};

// Milestone-specific colors for FullCalendar
export const milestoneColors: Record<string, string> = {
  topic_confirmation:   '#dbeafe', // blue-100
  script_deadline:      '#ffedd5', // orange-100
  script_approval:      '#fef3c7', // amber-100
  production_day:       '#f3e8ff', // purple-100
  post_production:      '#ede9fe', // violet-100
  draft_1_review:       '#cffafe', // cyan-100
  draft_2_review:       '#ccfbf1', // teal-100
  final_delivery:       '#dcfce7', // green-100
  default:              '#f3f4f6', // gray-100
};

export const milestoneTextColors: Record<string, string> = {
  topic_confirmation:   '#1d4ed8', // blue-700
  script_deadline:      '#c2410c', // orange-700
  script_approval:      '#b45309', // amber-700
  production_day:       '#7c3aed', // purple-700
  post_production:      '#6d28d9', // violet-700
  draft_1_review:       '#0e7490', // cyan-700
  draft_2_review:       '#0f766e', // teal-700
  final_delivery:       '#15803d', // green-700
  default:              '#374151', // gray-700
};

interface CalendarItemProps {
  item: CalendarItemType;
  episode?: ProductionEpisode;
}

export function CalendarItemContent({ item, episode }: CalendarItemProps) {
  // Check if this is a milestone
  if (item.is_milestone && item.milestone_type) {
    const mConfig = milestoneConfig[item.milestone_type] || milestoneConfig.default;

    return (
      <div className="px-1 py-0.5 text-xs leading-tight overflow-hidden w-full">
        <div className="font-medium truncate flex items-center gap-1">
          <span>{mConfig.icon}</span>
          <span>{item.title}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`inline-block px-1 rounded ${mConfig.bg} ${mConfig.text}`} style={{ fontSize: '10px' }}>
            Milestone
          </span>
          {item.scheduled_time && (
            <span className="text-gray-500" style={{ fontSize: '10px' }}>
              {item.scheduled_time.slice(0, 5)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Regular calendar item (TX date or other)
  const config = statusConfig[item.status];
  // Show title if there's a news story or an episode linked
  const hasContent = !!item.news_story_id || !!item.episode_id || !!episode;

  // Format display title with episode number if available
  const displayTitle = (() => {
    if (!hasContent) return 'Empty Slot';
    if (episode?.episode_number) {
      return `Ep${episode.episode_number}: ${item.title}`;
    }
    return item.title;
  })();

  return (
    <div className="px-1 py-0.5 text-xs leading-tight overflow-hidden w-full">
      <div className="font-medium truncate">
        {displayTitle}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`inline-block px-1 rounded ${config.bg} ${config.text}`} style={{ fontSize: '10px' }}>
          {config.label}
        </span>
        {item.duration_seconds != null && (
          <span className="text-gray-500" style={{ fontSize: '10px' }}>
            {Math.round(item.duration_seconds / 60)}m
          </span>
        )}
      </div>
    </div>
  );
}
