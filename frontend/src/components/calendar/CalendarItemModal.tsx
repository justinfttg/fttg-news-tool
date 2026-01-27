import { useState } from 'react';
import { format } from 'date-fns';
import type { CalendarItem } from '../../types';
import { useUpdateCalendarItem, useDeleteCalendarItem } from '../../hooks/useCalendar';

const statusOptions: CalendarItem['status'][] = [
  'draft',
  'pending_review',
  'approved',
  'in_production',
  'published',
  'cancelled',
];

const statusLabels: Record<CalendarItem['status'], string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  in_production: 'In Production',
  published: 'Published',
  cancelled: 'Cancelled',
};

interface CalendarItemModalProps {
  item: CalendarItem;
  onClose: () => void;
}

export function CalendarItemModal({ item, onClose }: CalendarItemModalProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [scheduledDate, setScheduledDate] = useState(item.scheduled_date);
  const [scheduledTime, setScheduledTime] = useState(item.scheduled_time || '');
  const [status, setStatus] = useState<CalendarItem['status']>(item.status);
  const [notes, setNotes] = useState(item.notes || '');

  const updateMutation = useUpdateCalendarItem(item.project_id);
  const deleteMutation = useDeleteCalendarItem(item.project_id);

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: item.id,
        title,
        scheduledDate,
        scheduledTime: scheduledTime || null,
        status,
        notes: notes || null,
      },
      { onSuccess: onClose }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(item.id, { onSuccess: onClose });
  };

  const formattedDate = (() => {
    try {
      return format(new Date(item.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy');
    } catch {
      return item.scheduled_date;
    }
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Edit Calendar Item' : 'Calendar Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CalendarItem['status'])}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{statusLabels[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-500">Title</p>
                <p className="font-medium text-gray-900">{item.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Scheduled Date</p>
                  <p className="text-gray-900">{formattedDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="text-gray-900">{item.scheduled_time || 'Not set'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-gray-900">{statusLabels[item.status]}</p>
              </div>

              {item.news_story_id && (
                <div>
                  <p className="text-sm text-gray-500">News Story</p>
                  <p className="text-primary-600 text-sm">Linked (ID: {item.news_story_id.slice(0, 8)}...)</p>
                </div>
              )}
              {item.selected_angle_id && (
                <div>
                  <p className="text-sm text-gray-500">Story Angle</p>
                  <p className="text-primary-600 text-sm">Generated (ID: {item.selected_angle_id.slice(0, 8)}...)</p>
                </div>
              )}
              {item.script_id && (
                <div>
                  <p className="text-sm text-gray-500">Script</p>
                  <p className="text-primary-600 text-sm">Created (ID: {item.script_id.slice(0, 8)}...)</p>
                </div>
              )}
              {item.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
              {item.duration_seconds != null && (
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-gray-900">{Math.round(item.duration_seconds / 60)} minutes</p>
                </div>
              )}
            </>
          )}

          {(updateMutation.error || deleteMutation.error) && (
            <p className="text-sm text-red-600">
              {((updateMutation.error || deleteMutation.error) as any)?.response?.data?.error ||
                'Operation failed'}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div>
            {!editing && item.status === 'draft' && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {!item.news_story_id && item.status === 'draft' && (
                  <button
                    disabled
                    className="px-3 py-2 text-sm text-gray-400 border border-gray-200 rounded-md cursor-not-allowed"
                    title="News Library coming in Phase 3"
                  >
                    Attach Story
                  </button>
                )}
                {item.status === 'draft' && (
                  <button
                    onClick={() => {
                      updateMutation.mutate(
                        { id: item.id, status: 'pending_review' },
                        { onSuccess: onClose }
                      );
                    }}
                    disabled={updateMutation.isPending}
                    className="px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 font-medium disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
