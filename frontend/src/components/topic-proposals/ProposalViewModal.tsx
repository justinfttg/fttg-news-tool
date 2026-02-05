import { useState } from 'react';
import {
  X,
  Clock,
  User,
  ExternalLink,
  Check,
  Archive,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Pencil,
  FileText,
  Video,
} from 'lucide-react';
import { useUpdateProposal, useDeleteProposal, useTopicProposal } from '../../hooks/useTopicProposals';
import { useCommentCounts } from '../../hooks/useProposalComments';
import { useAuth } from '../../context/AuthContext';
import { getStatusColor, formatDuration, getDurationLabel } from '../../services/topic-proposal.service';
import ProposalComments from './ProposalComments';
import ScheduleProposalModal from './ScheduleProposalModal';
import ProposalEditModal from './ProposalEditModal';
import ContentEditor from '../episode-content/ContentEditor';
import type { TopicProposal, ProposalStatus } from '../../types';

interface ProposalViewModalProps {
  proposal: TopicProposal;
  projectId: string;
  onClose: () => void;
  onUpdate: (updated: TopicProposal) => void;
  onDelete: () => void;
}

type TabType = 'details' | 'comments' | 'video_script' | 'article';

export default function ProposalViewModal({
  proposal: initialProposal,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: ProposalViewModalProps) {
  const [showSources, setShowSources] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { user } = useAuth();

  // Fetch full proposal data (including source stories)
  const { data: fullProposal } = useTopicProposal(initialProposal.id);
  const proposal = fullProposal || initialProposal;

  // Fetch comment counts
  const { data: commentCounts } = useCommentCounts(proposal.id);

  const updateMutation = useUpdateProposal(projectId);
  const deleteMutation = useDeleteProposal(projectId);

  const handleStatusChange = async (status: ProposalStatus) => {
    try {
      const updated = await updateMutation.mutateAsync({
        id: proposal.id,
        status,
      });
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(proposal.id);
      onDelete();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleScheduled = () => {
    setShowScheduleModal(false);
    // Could refresh or show a toast here
  };

  const statusColor = getStatusColor(proposal.status);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b flex-shrink-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
                  {proposal.status}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(proposal.duration_seconds)}
                </span>
                <span className="text-xs text-gray-400">
                  ({getDurationLabel(proposal.duration_type, proposal.duration_seconds)})
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{proposal.title}</h2>

              {/* Audience badge */}
              {proposal.audience_profile && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
                  <User className="w-4 h-4" />
                  <span>For: {proposal.audience_profile.name}</span>
                  {proposal.audience_profile.preferred_tone && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                      {proposal.audience_profile.preferred_tone}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                title="Edit proposal"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6 overflow-x-auto flex-shrink-0 bg-white">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'comments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Comments
              {commentCounts && commentCounts.total > 0 && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  commentCounts.unresolved > 0
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {commentCounts.total}
                  {commentCounts.unresolved > 0 && ` (${commentCounts.unresolved})`}
                </span>
              )}
            </button>
            {/* Video Script and Article tabs - only show if episode is linked */}
            {proposal.linked_episode_id && (
              <>
                <button
                  onClick={() => setActiveTab('video_script')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'video_script'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  Video Script
                </button>
                <button
                  onClick={() => setActiveTab('article')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'article'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Article
                </button>
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'details' ? (
              <div className="space-y-6">
                {/* Cluster theme */}
                {proposal.cluster_theme && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-700 font-medium">{proposal.cluster_theme}</span>
                    {proposal.cluster_keywords && proposal.cluster_keywords.length > 0 && (
                      <div className="flex gap-1">
                        {proposal.cluster_keywords.slice(0, 3).map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Hook */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Hook</h3>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{proposal.hook}</p>
                </div>

                {/* Audience Care Statement */}
                {proposal.audience_care_statement && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">
                      Why This Matters to Your Audience
                    </h3>
                    <p className="text-blue-900">{proposal.audience_care_statement}</p>
                  </div>
                )}

                {/* Talking Points */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Talking Points ({proposal.talking_points.length})
                  </h3>
                  <div className="space-y-3">
                    {proposal.talking_points.map((point, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </span>
                              <h4 className="font-medium text-gray-900">{point.point}</h4>
                            </div>
                            <p className="text-sm text-gray-600 ml-8">{point.supporting_detail}</p>
                            {point.audience_framing && (
                              <p className="text-xs text-blue-600 ml-8 mt-2 italic">
                                Audience framing: {point.audience_framing}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            ~{point.duration_estimate_seconds}s
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Research Citations */}
                {proposal.research_citations && proposal.research_citations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Research Citations ({proposal.research_citations.length})
                    </h3>
                    <div className="space-y-2">
                      {proposal.research_citations.map((citation, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`px-2 py-0.5 text-xs rounded ${
                                    citation.source_type === 'statistic'
                                      ? 'bg-green-100 text-green-700'
                                      : citation.source_type === 'study'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  {citation.source_type}
                                </span>
                                <h4 className="text-sm font-medium text-gray-900">{citation.title}</h4>
                              </div>
                              <p className="text-sm text-gray-600">{citation.snippet}</p>
                              {citation.relevance_to_audience && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Relevance: {citation.relevance_to_audience}
                                </p>
                              )}
                            </div>
                            <a
                              href={citation.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Stories */}
                <div>
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700"
                  >
                    Source Stories ({proposal.source_story_ids.length})
                    {showSources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showSources && proposal.source_stories && (
                    <div className="mt-3 space-y-2">
                      {proposal.source_stories.map((story) => (
                        <div key={story.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          {story.thumbnail_url && (
                            <img
                              src={story.thumbnail_url}
                              alt=""
                              className="w-16 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                              {story.title}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {story.source} • {story.category}
                            </p>
                          </div>
                          {story.url && (
                            <a
                              href={story.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'comments' ? (
              <ProposalComments
                proposalId={proposal.id}
                currentUserId={user?.id || ''}
              />
            ) : activeTab === 'video_script' && proposal.linked_episode_id ? (
              <div className="h-[60vh]">
                <ContentEditor
                  episodeId={proposal.linked_episode_id}
                  contentType="video_script"
                  episodeTitle={proposal.title}
                  canEdit={true}
                  canApprove={true}
                />
              </div>
            ) : activeTab === 'article' && proposal.linked_episode_id ? (
              <div className="h-[60vh]">
                <ContentEditor
                  episodeId={proposal.linked_episode_id}
                  contentType="article"
                  episodeTitle={proposal.title}
                  canEdit={true}
                  canApprove={true}
                />
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            {/* Delete confirmation */}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Delete this proposal?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}

            {/* Status actions */}
            <div className="flex items-center gap-2">
              {proposal.status === 'draft' && (
                <>
                  <button
                    onClick={() => handleStatusChange('reviewed')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    Mark as Reviewed
                  </button>
                  <button
                    onClick={() => handleStatusChange('approved')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </>
              )}

              {proposal.status === 'reviewed' && (
                <>
                  <button
                    onClick={() => handleStatusChange('rejected')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatusChange('approved')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </>
              )}

              {proposal.status === 'approved' && (
                <>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule to Calendar
                  </button>
                  <button
                    onClick={() => handleStatusChange('archived')}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                </>
              )}

              {(proposal.status === 'rejected' || proposal.status === 'archived') && (
                <button
                  onClick={() => handleStatusChange('draft')}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Restore to Draft
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleProposalModal
          proposal={proposal}
          projectId={projectId}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={handleScheduled}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <ProposalEditModal
          proposal={proposal}
          projectId={projectId}
          onClose={() => setShowEditModal(false)}
          onUpdate={(updated) => {
            onUpdate(updated);
            setShowEditModal(false);
          }}
        />
      )}
    </>
  );
}
