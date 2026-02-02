import { useState } from 'react';
import { Settings, Plus, RefreshCw, Clock } from 'lucide-react';
import { useTopicProposals, useTopicGeneratorSettings } from '../../hooks/useTopicProposals';
import { useAudienceProfiles } from '../../hooks/useAudience';
import TopicProposalCard from './TopicProposalCard';
import ProposalGenerationModal from './ProposalGenerationModal';
import ProposalViewModal from './ProposalViewModal';
import ProposalSettingsModal from './ProposalSettingsModal';
import type { TopicProposal, ProposalStatus } from '../../types';

interface TopicProposalsProps {
  projectId: string;
}

const STATUS_TABS: { label: string; value: ProposalStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Approved', value: 'approved' },
  { label: 'Archived', value: 'archived' },
];

export default function TopicProposals({ projectId }: TopicProposalsProps) {
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | 'all'>('all');
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<TopicProposal | null>(null);

  // Fetch proposals
  const {
    data: proposals,
    isLoading,
    error,
    refetch,
  } = useTopicProposals({
    projectId,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
  });

  // Fetch settings for auto-generation info
  const { data: settingsData } = useTopicGeneratorSettings(projectId);

  // Fetch audience profiles to check if any exist
  const { data: audienceProfiles } = useAudienceProfiles(projectId);

  const hasAudienceProfiles = audienceProfiles && audienceProfiles.length > 0;

  // Format next auto-generation time
  const getNextAutoGenTime = () => {
    if (!settingsData?.settings?.auto_generation_enabled) {
      return null;
    }
    const time = settingsData.settings.auto_generation_time;
    const tz = settingsData.settings.auto_generation_timezone || 'Asia/Singapore';
    return `${time.slice(0, 5)} ${tz}`;
  };

  const nextAutoGen = getNextAutoGenTime();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Topic Proposals</h2>
          <p className="text-sm text-gray-500">
            AI-generated topic proposals from your flagged stories
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-generation status */}
          {nextAutoGen && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Auto-gen: {nextAutoGen}</span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Generator Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Generate button */}
          <button
            onClick={() => setShowGenerationModal(true)}
            disabled={!hasAudienceProfiles}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title={!hasAudienceProfiles ? 'Create an audience profile first' : 'Generate Proposals'}
          >
            <Plus className="w-4 h-4" />
            Generate Proposals
          </button>
        </div>
      </div>

      {/* No audience profiles warning */}
      {!hasAudienceProfiles && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>No audience profiles found.</strong> Create an audience profile in the
            Audience tab before generating topic proposals.
          </p>
        </div>
      )}

      {/* Status tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                selectedStatus === tab.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {settingsData?.stats?.byStatus?.[tab.value] !== undefined && tab.value !== 'all' && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({settingsData.stats.byStatus[tab.value] || 0})
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading topic proposals...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load topic proposals. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && proposals?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {selectedStatus === 'all'
              ? 'No topic proposals yet. Flag some stories and generate proposals!'
              : `No ${selectedStatus} proposals found.`}
          </p>
          {hasAudienceProfiles && selectedStatus === 'all' && (
            <button
              onClick={() => setShowGenerationModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Generate Your First Proposals
            </button>
          )}
        </div>
      )}

      {/* Proposals grid */}
      {!isLoading && proposals && proposals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <TopicProposalCard
              key={proposal.id}
              proposal={proposal}
              onClick={() => setSelectedProposal(proposal)}
            />
          ))}
        </div>
      )}

      {/* Generation Modal */}
      {showGenerationModal && (
        <ProposalGenerationModal
          projectId={projectId}
          onClose={() => setShowGenerationModal(false)}
          onSuccess={() => {
            setShowGenerationModal(false);
            refetch();
          }}
        />
      )}

      {/* View/Edit Modal */}
      {selectedProposal && (
        <ProposalViewModal
          proposal={selectedProposal}
          projectId={projectId}
          onClose={() => setSelectedProposal(null)}
          onUpdate={(updated) => {
            setSelectedProposal(updated);
            refetch();
          }}
          onDelete={() => {
            setSelectedProposal(null);
            refetch();
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <ProposalSettingsModal
          projectId={projectId}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
