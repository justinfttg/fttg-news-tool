import { Clock, User, MessageSquare, ExternalLink } from 'lucide-react';
import { getStatusColor, formatDuration, getDurationLabel } from '../../services/topic-proposal.service';
import type { TopicProposal } from '../../types';

interface TopicProposalCardProps {
  proposal: TopicProposal;
  onClick: () => void;
}

export default function TopicProposalCard({ proposal, onClick }: TopicProposalCardProps) {
  const statusColor = getStatusColor(proposal.status);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header with status and duration */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
          {proposal.status}
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {formatDuration(proposal.duration_seconds)}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
        {proposal.title}
      </h3>

      {/* Hook preview */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {proposal.hook}
      </p>

      {/* Cluster theme */}
      {proposal.cluster_theme && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
            <MessageSquare className="w-3 h-3" />
            {proposal.cluster_theme}
          </span>
        </div>
      )}

      {/* Audience profile */}
      {proposal.audience_profile && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <User className="w-3 h-3" />
          <span>For: {proposal.audience_profile.name}</span>
          {proposal.audience_profile.preferred_tone && (
            <span className="text-gray-400">
              ({proposal.audience_profile.preferred_tone})
            </span>
          )}
        </div>
      )}

      {/* Footer with metadata */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {/* Talking points count */}
          <span className="text-xs text-gray-500">
            {proposal.talking_points.length} talking points
          </span>

          {/* Research citations count */}
          {proposal.research_citations.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <ExternalLink className="w-3 h-3" />
                {proposal.research_citations.length} sources
              </span>
            </>
          )}
        </div>

        {/* Duration type badge */}
        <span className="text-xs text-gray-400">
          {getDurationLabel(proposal.duration_type, proposal.duration_seconds)}
        </span>
      </div>

      {/* Source stories indicator */}
      <div className="mt-2 text-xs text-gray-400">
        Based on {proposal.source_story_ids.length} flagged {proposal.source_story_ids.length === 1 ? 'story' : 'stories'}
      </div>
    </div>
  );
}
