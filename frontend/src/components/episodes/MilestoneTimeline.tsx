import { useState } from 'react';
import {
  Check,
  Clock,
  AlertTriangle,
  SkipForward,
  Play,
  MessageSquare,
} from 'lucide-react';
import { useCompleteMilestone, useUpdateMilestone } from '../../hooks/useEpisodes';
import { formatMilestoneLabel } from '../../services/episode.service';
import type { ProductionMilestone, MilestoneStatus } from '../../types';

interface MilestoneTimelineProps {
  milestones: ProductionMilestone[];
  episodeId: string;
  isEditable?: boolean;
}

export default function MilestoneTimeline({
  milestones,
  episodeId,
  isEditable = true,
}: MilestoneTimelineProps) {
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const completeMutation = useCompleteMilestone(episodeId);
  const updateMutation = useUpdateMilestone(episodeId);

  const handleComplete = async (milestoneId: string) => {
    try {
      await completeMutation.mutateAsync({ milestoneId, notes: noteInput || undefined });
      setExpandedMilestone(null);
      setNoteInput('');
    } catch (error) {
      console.error('Failed to complete milestone:', error);
    }
  };

  const handleStatusChange = async (milestoneId: string, status: MilestoneStatus) => {
    try {
      await updateMutation.mutateAsync({ milestoneId, status });
    } catch (error) {
      console.error('Failed to update milestone:', error);
    }
  };

  const getStatusIcon = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-blue-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'skipped':
        return <SkipForward className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBgColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 border-blue-200';
      case 'overdue':
        return 'bg-red-100 border-red-200';
      case 'skipped':
        return 'bg-gray-100 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (milestone: ProductionMilestone) => {
    if (milestone.status === 'completed' || milestone.status === 'skipped') return false;
    const today = new Date().toISOString().split('T')[0];
    return milestone.deadline_date < today;
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {milestones.map((milestone) => {
          const overdue = isOverdue(milestone);
          const effectiveStatus = overdue && milestone.status === 'pending' ? 'overdue' : milestone.status;

          return (
            <div key={milestone.id} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={`absolute left-2 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getStatusBgColor(
                  effectiveStatus
                )}`}
              >
                {getStatusIcon(effectiveStatus)}
              </div>

              {/* Milestone card */}
              <div
                className={`border rounded-lg overflow-hidden ${
                  effectiveStatus === 'overdue'
                    ? 'border-red-200 bg-red-50/50'
                    : effectiveStatus === 'in_progress'
                    ? 'border-blue-200 bg-blue-50/50'
                    : effectiveStatus === 'completed'
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200'
                }`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {formatMilestoneLabel(milestone)}
                        </h4>
                        {milestone.is_client_facing && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                            Client
                          </span>
                        )}
                        {milestone.requires_client_approval && (
                          <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                            Approval Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>{formatDate(milestone.deadline_date)}</span>
                        {milestone.deadline_time && (
                          <>
                            <span>•</span>
                            <span>{milestone.deadline_time}</span>
                          </>
                        )}
                        {effectiveStatus === 'overdue' && (
                          <span className="text-red-600 font-medium">Overdue</span>
                        )}
                      </div>
                      {milestone.notes && (
                        <p className="text-sm text-gray-600 mt-2 flex items-start gap-1">
                          <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {milestone.notes}
                        </p>
                      )}
                    </div>

                    {isEditable && milestone.status !== 'completed' && milestone.status !== 'skipped' && (
                      <div className="flex items-center gap-1">
                        {milestone.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(milestone.id, 'in_progress')}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                            title="Start"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            expandedMilestone === milestone.id
                              ? setExpandedMilestone(null)
                              : setExpandedMilestone(milestone.id)
                          }
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                          title="Complete"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(milestone.id, 'skipped')}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                          title="Skip"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Completion notes input */}
                  {expandedMilestone === milestone.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Completion Notes (optional)
                      </label>
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add any notes about this milestone..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setExpandedMilestone(null);
                            setNoteInput('');
                          }}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleComplete(milestone.id)}
                          disabled={completeMutation.isPending}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {completeMutation.isPending ? 'Completing...' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Completed info */}
                {milestone.status === 'completed' && milestone.completed_at && (
                  <div className="px-4 py-2 bg-green-50 border-t border-green-100 text-sm text-green-700">
                    Completed on{' '}
                    {new Date(milestone.completed_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
