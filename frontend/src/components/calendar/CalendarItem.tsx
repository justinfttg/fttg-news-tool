import type { CalendarItem as CalendarItemType } from '../../types';

const statusConfig: Record<CalendarItemType['status'], { bg: string; text: string; label: string }> = {
  draft:            { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'Draft' },
  pending_review:   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Review' },
  approved:         { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Approved' },
  in_production:    { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Production' },
  published:        { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Published' },
  cancelled:        { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
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

interface CalendarItemProps {
  item: CalendarItemType;
}

export function CalendarItemContent({ item }: CalendarItemProps) {
  const config = statusConfig[item.status];
  const hasStory = !!item.news_story_id;

  return (
    <div className="px-1 py-0.5 text-xs leading-tight overflow-hidden w-full">
      <div className="font-medium truncate">
        {hasStory ? item.title : 'Empty Slot'}
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
