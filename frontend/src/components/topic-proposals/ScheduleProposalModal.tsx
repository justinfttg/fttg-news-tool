import { useState, useMemo } from 'react';
import { X, Calendar, Clock, ChevronDown, AlertCircle, Check } from 'lucide-react';
import { useCreateEpisode } from '../../hooks/useEpisodes';
import { useWorkflowTemplates } from '../../hooks/useWorkflowTemplates';
import { previewMilestones, getDefaultTemplate } from '../../services/workflow-templates.service';
import { getTimelineTypeLabel } from '../../services/episode.service';
import type { TopicProposal, TimelineType } from '../../types';

interface ScheduleProposalModalProps {
  proposal: TopicProposal;
  projectId: string;
  onClose: () => void;
  onScheduled: () => void;
}

export default function ScheduleProposalModal({
  proposal,
  projectId,
  onClose,
  onScheduled,
}: ScheduleProposalModalProps) {
  // Get next Friday as default TX date
  const getNextFriday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // If today is Friday, get next Friday
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday.toISOString().split('T')[0];
  };

  const [txDate, setTxDate] = useState(getNextFriday());
  const [txTime, setTxTime] = useState('18:00');
  const [timelineType, setTimelineType] = useState<TimelineType>('normal');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showMilestonePreview, setShowMilestonePreview] = useState(true);

  const { data: templates = [] } = useWorkflowTemplates({ projectId });
  const createEpisode = useCreateEpisode(projectId);

  // Get templates for selected timeline type
  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.timeline_type === timelineType),
    [templates, timelineType]
  );

  // Get the selected or default template
  const activeTemplate = useMemo(() => {
    if (selectedTemplateId) {
      return templates.find((t) => t.id === selectedTemplateId);
    }
    return getDefaultTemplate(templates, timelineType);
  }, [templates, selectedTemplateId, timelineType]);

  // Preview milestones
  const milestonePreview = useMemo(() => {
    if (!activeTemplate || !txDate) return [];
    return previewMilestones(txDate, activeTemplate.milestone_offsets);
  }, [activeTemplate, txDate]);

  // Handle timeline type change - reset template selection
  const handleTimelineTypeChange = (type: TimelineType) => {
    setTimelineType(type);
    setSelectedTemplateId(null);
  };

  const handleSubmit = async () => {
    try {
      await createEpisode.mutateAsync({
        projectId,
        topicProposalId: proposal.id,
        title: proposal.title,
        txDate,
        txTime,
        timelineType,
        templateId: selectedTemplateId || activeTemplate?.id,
      });
      onScheduled();
    } catch (error) {
      console.error('Failed to schedule episode:', error);
    }
  };

  const formatMilestoneDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Schedule to Calendar</h2>
            <p className="text-sm text-gray-500 mt-0.5">{proposal.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TX Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TX Date (Transmission Date)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TX Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={txTime}
                  onChange={(e) => setTxTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Timeline Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Production Timeline
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'breaking_news', 'emergency'] as TimelineType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTimelineTypeChange(type)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    timelineType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getTimelineTypeLabel(type)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {timelineType === 'normal' && 'Standard 7-day production cycle with full review process.'}
              {timelineType === 'breaking_news' && 'Fast-track 3-day timeline for breaking news.'}
              {timelineType === 'emergency' && 'Same-day turnaround for urgent content.'}
            </p>
          </div>

          {/* Template Selection */}
          {filteredTemplates.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workflow Template
              </label>
              <div className="relative">
                <select
                  value={selectedTemplateId || activeTemplate?.id || ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  {filteredTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.is_default && '(Default)'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Milestone Preview */}
          {activeTemplate && (
            <div>
              <button
                onClick={() => setShowMilestonePreview(!showMilestonePreview)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
              >
                Production Milestones Preview
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showMilestonePreview ? 'rotate-180' : ''}`}
                />
              </button>

              {showMilestonePreview && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="text-xs text-gray-500">
                      Using template: <span className="font-medium text-gray-700">{activeTemplate.name}</span>
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {milestonePreview.map((milestone, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between px-4 py-2.5 ${
                          milestone.is_client_facing ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              milestone.requires_client_approval
                                ? 'bg-orange-400'
                                : milestone.is_client_facing
                                ? 'bg-blue-400'
                                : 'bg-gray-300'
                            }`}
                          />
                          <span className="text-sm text-gray-700">
                            {milestone.label || milestone.milestone_type.replace(/_/g, ' ')}
                          </span>
                          {milestone.requires_client_approval && (
                            <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                              Client Approval
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-900 font-medium">
                            {formatMilestoneDate(milestone.calculatedDate)}
                          </span>
                          {milestone.time && (
                            <span className="text-gray-500">{milestone.time}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* TX Date row */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-green-50">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-green-700">TX (Transmission)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-800 font-medium">
                          {formatMilestoneDate(txDate)}
                        </span>
                        {txTime && <span className="text-green-600">{txTime}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400" /> Requires Client Approval
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Client-Facing
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300" /> Internal
                </span>
              </div>
            </div>
          )}

          {/* Warning if dates in past */}
          {milestonePreview.some((m) => new Date(m.calculatedDate) < new Date(new Date().toDateString())) && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Some milestones are in the past</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  Consider selecting a later TX date to ensure all milestones have adequate lead time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createEpisode.isPending || !txDate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createEpisode.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Schedule Episode
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
