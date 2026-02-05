import { useState, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventContentArg, DateSelectArg, EventDropArg, EventClickArg } from '@fullcalendar/core';
import { format, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';

import type { CalendarItem, ProductionEpisode } from '../../types';
import { useCalendarItems, useUpdateCalendarItem, useCreateCalendarItem } from '../../hooks/useCalendar';
import { useEpisodes } from '../../hooks/useEpisodes';
import { CalendarItemContent, statusColors, statusTextColors } from './CalendarItem';
import { CalendarItemModal } from './CalendarItemModal';

type StatusFilter = CalendarItem['status'] | 'all';

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'draft',          label: 'Draft' },
  { value: 'pending_review', label: 'Review' },
  { value: 'approved',       label: 'Approved' },
  { value: 'in_production',  label: 'Production' },
  { value: 'published',      label: 'Published' },
  { value: 'cancelled',      label: 'Cancelled' },
];

interface CalendarViewProps {
  projectId: string;
}

export function CalendarView({ projectId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch a padded window around the current month for smooth navigation
  const startDate = format(subDays(startOfMonth(currentDate), 7), 'yyyy-MM-dd');
  const endDate = format(addDays(endOfMonth(currentDate), 7), 'yyyy-MM-dd');

  const { data: items, isLoading } = useCalendarItems(projectId, startDate, endDate);
  const { data: episodes = [] } = useEpisodes({ projectId, includeMilestones: false });
  const updateMutation = useUpdateCalendarItem(projectId);
  const createItem = useCreateCalendarItem(projectId);

  // Create a map of calendar_item_id to episode for quick lookup
  const episodeByCalendarItemId = useMemo(() => {
    const map = new Map<string, ProductionEpisode>();
    episodes.forEach((ep) => {
      if (ep.calendar_item_id) {
        map.set(ep.calendar_item_id, ep);
      }
    });
    return map;
  }, [episodes]);

  // Filter items by status
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === 'all') return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  // Map CalendarItems to FullCalendar EventInput
  const events: EventInput[] = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        title: (item.news_story_id || (item as any).episode_id) ? item.title : 'Empty Slot',
        start: item.scheduled_time
          ? `${item.scheduled_date}T${item.scheduled_time}`
          : item.scheduled_date,
        allDay: !item.scheduled_time,
        backgroundColor: statusColors[item.status],
        borderColor: statusColors[item.status],
        textColor: statusTextColors[item.status],
        extendedProps: { calendarItem: item },
      })),
    [filteredItems]
  );

  // Click event to open detail modal
  const handleEventClick = useCallback((info: EventClickArg) => {
    const item = info.event.extendedProps.calendarItem as CalendarItem;
    if (item) setSelectedItem(item);
  }, []);

  // Drag-drop to reschedule
  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const item = info.event.extendedProps.calendarItem as CalendarItem;
      const newDate = info.event.start;
      if (!newDate) return;

      const scheduledDate = format(newDate, 'yyyy-MM-dd');
      updateMutation.mutate(
        { id: item.id, scheduledDate },
        {
          onError: () => {
            info.revert();
          },
        }
      );
    },
    [updateMutation]
  );

  // Select date range to create a new item
  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      const scheduledDate = format(selectInfo.start, 'yyyy-MM-dd');
      createItem.mutate({
        projectId,
        title: 'New Item',
        scheduledDate,
      });
    },
    [projectId, createItem]
  );

  // Track the current visible date range as user navigates
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date }) => {
    // Use midpoint of visible range to determine current month
    const mid = new Date((dateInfo.start.getTime() + dateInfo.end.getTime()) / 2);
    setCurrentDate(mid);
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm rounded-md border border-gray-300 px-2 py-1 focus:border-primary-500 focus:outline-none"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {items && (
            <span className="text-xs text-gray-400 ml-2">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-96 text-gray-400">
            Loading calendar...
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={3}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            select={handleDateSelect}
            datesSet={handleDatesSet}
            eventContent={(arg: EventContentArg) => {
              const item = arg.event.extendedProps.calendarItem as CalendarItem;
              const episode = episodeByCalendarItemId.get(item.id);
              return <CalendarItemContent item={item} episode={episode} />;
            }}
            height="auto"
          />
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <CalendarItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
