import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  ExternalLink,
  GripVertical,
} from 'lucide-react';
import { useUpdateProposal, useResynthesizeProposal } from '../../hooks/useTopicProposals';
import type { TopicProposal, TalkingPoint, ResearchCitation } from '../../types';

interface ProposalEditModalProps {
  proposal: TopicProposal;
  projectId: string;
  onClose: () => void;
  onUpdate: (updated: TopicProposal) => void;
}

export default function ProposalEditModal({
  proposal,
  projectId,
  onClose,
  onUpdate,
}: ProposalEditModalProps) {
  // Form state
  const [title, setTitle] = useState(proposal.title);
  const [hook, setHook] = useState(proposal.hook);
  const [audienceCareStatement, setAudienceCareStatement] = useState(proposal.audience_care_statement || '');
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>(proposal.talking_points);
  const [researchCitations, setResearchCitations] = useState<ResearchCitation[]>(proposal.research_citations || []);
  const [sourceStoryUrls, setSourceStoryUrls] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');

  // Mutation hooks
  const updateMutation = useUpdateProposal(projectId);
  const resynthesizeMutation = useResynthesizeProposal(projectId);

  const isPending = updateMutation.isPending || resynthesizeMutation.isPending;

  // Initialize source story URLs from existing source stories
  useEffect(() => {
    if (proposal.source_stories) {
      setSourceStoryUrls(proposal.source_stories.map((s) => s.url || '').filter(Boolean));
    }
  }, [proposal.source_stories]);

  // Handle save
  const handleSave = async () => {
    try {
      const updated = await updateMutation.mutateAsync({
        id: proposal.id,
        title,
        hook,
        audienceCareStatement: audienceCareStatement || null,
        talkingPoints,
        researchCitations,
      });
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to save proposal:', error);
    }
  };

  // Handle re-synthesize
  const handleResynthesize = async () => {
    try {
      const updated = await resynthesizeMutation.mutateAsync(proposal.id);
      // Update local state with new values
      setTitle(updated.title);
      setHook(updated.hook);
      setAudienceCareStatement(updated.audience_care_statement || '');
      setTalkingPoints(updated.talking_points);
      setResearchCitations(updated.research_citations || []);
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to re-synthesize proposal:', error);
    }
  };

  // Talking point management
  const addTalkingPoint = () => {
    setTalkingPoints([
      ...talkingPoints,
      {
        point: '',
        supporting_detail: '',
        duration_estimate_seconds: 30,
        audience_framing: '',
      },
    ]);
  };

  const updateTalkingPoint = (index: number, updates: Partial<TalkingPoint>) => {
    setTalkingPoints(
      talkingPoints.map((tp, i) => (i === index ? { ...tp, ...updates } : tp))
    );
  };

  const removeTalkingPoint = (index: number) => {
    setTalkingPoints(talkingPoints.filter((_, i) => i !== index));
  };

  // Research citation management
  const addResearchCitation = () => {
    setResearchCitations([
      ...researchCitations,
      {
        title: '',
        url: '',
        source_type: 'news',
        snippet: '',
        accessed_at: new Date().toISOString(),
        relevance_to_audience: '',
      },
    ]);
  };

  const updateResearchCitation = (index: number, updates: Partial<ResearchCitation>) => {
    setResearchCitations(
      researchCitations.map((rc, i) => (i === index ? { ...rc, ...updates } : rc))
    );
  };

  const removeResearchCitation = (index: number) => {
    setResearchCitations(researchCitations.filter((_, i) => i !== index));
  };

  // Source URL management (note: these are display-only for now, actual linking would require backend changes)
  const addSourceUrl = () => {
    if (newSourceUrl && !sourceStoryUrls.includes(newSourceUrl)) {
      setSourceStoryUrls([...sourceStoryUrls, newSourceUrl]);
      setNewSourceUrl('');
    }
  };

  const removeSourceUrl = (index: number) => {
    setSourceStoryUrls(sourceStoryUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Edit Topic Proposal</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResynthesize}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50"
              title="Re-generate content using AI based on source stories"
            >
              <RefreshCw className={`w-4 h-4 ${resynthesizeMutation.isPending ? 'animate-spin' : ''}`} />
              Re-synthesize
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Topic title..."
            />
          </div>

          {/* Hook */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hook
            </label>
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Opening hook to capture audience attention..."
            />
          </div>

          {/* Audience Care Statement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Why This Matters to Your Audience
            </label>
            <textarea
              value={audienceCareStatement}
              onChange={(e) => setAudienceCareStatement(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Explain why the audience should care about this topic..."
            />
          </div>

          {/* Talking Points */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Talking Points ({talkingPoints.length})
              </label>
              <button
                onClick={addTalkingPoint}
                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Point
              </button>
            </div>
            <div className="space-y-4">
              {talkingPoints.map((point, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 pt-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={point.point}
                        onChange={(e) => updateTalkingPoint(index, { point: e.target.value })}
                        placeholder="Main point..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <textarea
                        value={point.supporting_detail}
                        onChange={(e) => updateTalkingPoint(index, { supporting_detail: e.target.value })}
                        placeholder="Supporting detail..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Audience Framing (optional)</label>
                          <input
                            type="text"
                            value={point.audience_framing || ''}
                            onChange={(e) => updateTalkingPoint(index, { audience_framing: e.target.value })}
                            placeholder="How to frame for the audience..."
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs text-gray-500 mb-1">Duration (sec)</label>
                          <input
                            type="number"
                            value={point.duration_estimate_seconds}
                            onChange={(e) => updateTalkingPoint(index, { duration_estimate_seconds: parseInt(e.target.value) || 30 })}
                            min="10"
                            max="300"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeTalkingPoint(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Research Citations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Research Citations ({researchCitations.length})
              </label>
              <button
                onClick={addResearchCitation}
                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus className="w-4 h-4" />
                Add Citation
              </button>
            </div>
            <div className="space-y-3">
              {researchCitations.map((citation, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={citation.title}
                          onChange={(e) => updateResearchCitation(index, { title: e.target.value })}
                          placeholder="Citation title..."
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                        />
                        <select
                          value={citation.source_type}
                          onChange={(e) => updateResearchCitation(index, { source_type: e.target.value as ResearchCitation['source_type'] })}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="statistic">Statistic</option>
                          <option value="study">Study</option>
                          <option value="expert_opinion">Expert Opinion</option>
                          <option value="news">News</option>
                        </select>
                      </div>
                      <input
                        type="url"
                        value={citation.url}
                        onChange={(e) => updateResearchCitation(index, { url: e.target.value })}
                        placeholder="URL..."
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <textarea
                        value={citation.snippet}
                        onChange={(e) => updateResearchCitation(index, { snippet: e.target.value })}
                        placeholder="Key quote or snippet..."
                        rows={2}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={citation.relevance_to_audience || ''}
                        onChange={(e) => updateResearchCitation(index, { relevance_to_audience: e.target.value })}
                        placeholder="Why this is relevant to the audience..."
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => removeResearchCitation(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Stories (URLs) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Source Story Links ({sourceStoryUrls.length})
              </label>
            </div>
            <div className="space-y-2">
              {sourceStoryUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    readOnly
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => removeSourceUrl(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="Add new source URL..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSourceUrl();
                    }
                  }}
                />
                <button
                  onClick={addSourceUrl}
                  disabled={!newSourceUrl}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Note: Adding source URLs here is for reference. Use the re-synthesize button after updating sources to regenerate content.
              </p>
            </div>
          </div>
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
            onClick={handleSave}
            disabled={isPending || !title.trim() || !hook.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
