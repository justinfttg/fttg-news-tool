import { useState } from 'react';
import { NewsStory } from '../../types';
import { useCreateCalendarItem } from '../../hooks/useCalendar';

interface AddToCalendarButtonProps {
  story: NewsStory;
  projectId: string;
}

export function AddToCalendarButton({ story, projectId }: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('09:00');

  const createMutation = useCreateCalendarItem(projectId);

  function handleAdd() {
    createMutation.mutate(
      {
        projectId,
        title: story.title,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        newsStoryId: story.id,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
        },
      }
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
      >
        Mark Article
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Add to Calendar</h3>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{story.title}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-xs text-red-600 mt-2">
            Failed to add to calendar. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs font-medium text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={createMutation.isPending}
            className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-md"
          >
            {createMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
