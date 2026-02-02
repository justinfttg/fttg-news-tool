import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, AlertCircle, Check, AlertTriangle } from 'lucide-react';
import { useAudienceProfiles } from '../../hooks/useAudience';
import { usePreviewClusters, useGenerateProposals, useTopicGeneratorSettings } from '../../hooks/useTopicProposals';
import type { AudienceProfile, TopicCluster, DurationType, NewsStory, SimilarProposalInfo } from '../../types';

interface ProposalGenerationModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'audience' | 'clusters' | 'configure' | 'generating';

const DURATION_OPTIONS: { value: DurationType; label: string; seconds: number }[] = [
  { value: 'short', label: 'Short (1-2 min)', seconds: 90 },
  { value: 'standard', label: 'Standard (3-4 min)', seconds: 180 },
  { value: 'long', label: 'Long (5-10 min)', seconds: 420 },
  { value: 'custom', label: 'Custom', seconds: 180 },
];

export default function ProposalGenerationModal({
  projectId,
  onClose,
  onSuccess,
}: ProposalGenerationModalProps) {
  const [step, setStep] = useState<Step>('audience');
  const [selectedAudience, setSelectedAudience] = useState<AudienceProfile | null>(null);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [durationType, setDurationType] = useState<DurationType>('standard');
  const [customDuration, setCustomDuration] = useState(180);
  const [comparisonRegions, setComparisonRegions] = useState<string[]>([]);
  const [regionsInput, setRegionsInput] = useState('');
  const [maxProposals, setMaxProposals] = useState(5);

  // Fetch audience profiles
  const { data: audienceProfiles, isLoading: loadingProfiles } = useAudienceProfiles(projectId);

  // Fetch settings for defaults
  const { data: settingsData } = useTopicGeneratorSettings(projectId);

  // Cluster preview (only when audience is selected)
  const {
    data: clusterData,
    isLoading: loadingClusters,
    error: clusterError,
  } = usePreviewClusters(
    selectedAudience ? { projectId, audienceProfileId: selectedAudience.id } : null
  );

  // Generate mutation
  const generateMutation = useGenerateProposals(projectId);

  // Set defaults from settings
  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      if (s.comparison_regions) {
        setComparisonRegions(s.comparison_regions);
        setRegionsInput(s.comparison_regions.join(', '));
      }
      if (s.default_duration_type) setDurationType(s.default_duration_type);
      if (s.default_duration_seconds) setCustomDuration(s.default_duration_seconds);
      if (s.max_proposals_per_run) setMaxProposals(s.max_proposals_per_run);

      // Pre-select default audience if set
      if (s.default_audience_profile_id && audienceProfiles) {
        const defaultProfile = audienceProfiles.find(p => p.id === s.default_audience_profile_id);
        if (defaultProfile) setSelectedAudience(defaultProfile);
      }
    }
  }, [settingsData, audienceProfiles]);

  // Select all clusters by default when loaded
  useEffect(() => {
    if (clusterData?.clusters && selectedClusters.length === 0) {
      setSelectedClusters(clusterData.clusters.map((_, i) => i));
    }
  }, [clusterData]);

  const handleGenerate = async () => {
    if (!selectedAudience) return;

    setStep('generating');

    try {
      await generateMutation.mutateAsync({
        projectId,
        audienceProfileId: selectedAudience.id,
        durationType,
        durationSeconds: durationType === 'custom' ? customDuration : undefined,
        comparisonRegions,
        clusterIds: selectedClusters.length > 0 ? selectedClusters : undefined,
        maxProposals,
      });

      onSuccess();
    } catch (error) {
      console.error('Generation failed:', error);
      setStep('configure');
    }
  };

  const toggleCluster = (index: number) => {
    setSelectedClusters((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const canProceedFromAudience = !!selectedAudience;
  const canProceedFromClusters = selectedClusters.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Generate Topic Proposals</h2>
            <p className="text-sm text-gray-500">
              {step === 'audience' && 'Step 1: Select target audience'}
              {step === 'clusters' && 'Step 2: Review story clusters'}
              {step === 'configure' && 'Step 3: Configure generation'}
              {step === 'generating' && 'Generating proposals...'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Audience Selection */}
          {step === 'audience' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select the target audience for your topic proposals. The AI will tailor content
                based on their values, fears, and preferences.
              </p>

              {loadingProfiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {audienceProfiles?.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedAudience(profile)}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        selectedAudience?.id === profile.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{profile.name}</h4>
                          <p className="text-sm text-gray-500">
                            {[
                              profile.market_region,
                              profile.preferred_tone,
                              profile.depth_preference,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                          {profile.values && profile.values.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              Values: {profile.values.slice(0, 3).join(', ')}
                            </p>
                          )}
                        </div>
                        {selectedAudience?.id === profile.id && (
                          <Check className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Cluster Preview */}
          {step === 'clusters' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                These are the thematic clusters identified from your flagged stories. Select which
                ones to generate proposals for.
              </p>

              {loadingClusters ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Analyzing stories...</span>
                </div>
              ) : clusterError ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>Failed to analyze stories. Please try again.</span>
                </div>
              ) : clusterData?.clusters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No story clusters found.</p>
                  <p className="text-sm mt-1">
                    {clusterData.message || 'Try flagging more stories in the News Library.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {clusterData?.stories.length} flagged stories analyzed
                    </span>
                    <button
                      onClick={() =>
                        setSelectedClusters(
                          selectedClusters.length === clusterData?.clusters.length
                            ? []
                            : clusterData?.clusters.map((_, i) => i) || []
                        )
                      }
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {selectedClusters.length === clusterData?.clusters.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>

                  {clusterData?.clusters.map((cluster, index) => (
                    <ClusterCard
                      key={index}
                      cluster={cluster}
                      isSelected={selectedClusters.includes(index)}
                      onToggle={() => toggleCluster(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Configure */}
          {step === 'configure' && (
            <div className="space-y-6">
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDurationType(option.value)}
                      className={`p-3 text-sm border rounded-lg transition-colors ${
                        durationType === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {durationType === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">
                      Custom duration (seconds)
                    </label>
                    <input
                      type="number"
                      min={60}
                      max={900}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(Number(e.target.value))}
                      className="w-32 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Comparison Regions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comparison Regions
                </label>
                <input
                  type="text"
                  value={regionsInput}
                  onChange={(e) => setRegionsInput(e.target.value)}
                  onBlur={() => {
                    const parsed = regionsInput
                      .split(',')
                      .map((r) => r.trim())
                      .filter(Boolean);
                    setComparisonRegions(parsed);
                    setRegionsInput(parsed.join(', '));
                  }}
                  placeholder="Singapore, Malaysia, United States"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of regions for investigative comparisons
                </p>
              </div>

              {/* Max Proposals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Proposals
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxProposals}
                  onChange={(e) => setMaxProposals(Number(e.target.value))}
                  className="w-24 px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Will generate up to {maxProposals} proposals from {selectedClusters.length}{' '}
                  selected clusters
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Generation Summary</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Audience: {selectedAudience?.name}</li>
                  <li>• Clusters: {selectedClusters.length} selected</li>
                  <li>
                    • Duration:{' '}
                    {durationType === 'custom'
                      ? `${Math.round(customDuration / 60)} min`
                      : DURATION_OPTIONS.find((o) => o.value === durationType)?.label}
                  </li>
                  <li>• Max proposals: {maxProposals}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 4: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Proposals</h3>
              <p className="text-sm text-gray-500 text-center">
                Analyzing stories, clustering themes, and creating audience-tailored proposals...
                <br />
                This may take a minute.
              </p>

              {generateMutation.error && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                  Generation failed. Please try again.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'generating' && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <button
              onClick={step === 'audience' ? onClose : () => setStep(step === 'clusters' ? 'audience' : 'clusters')}
              className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 'audience' ? 'Cancel' : 'Back'}
            </button>

            {step === 'audience' && (
              <button
                onClick={() => setStep('clusters')}
                disabled={!canProceedFromAudience}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'clusters' && (
              <button
                onClick={() => setStep('configure')}
                disabled={!canProceedFromClusters}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'configure' && (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Generate Proposals
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Cluster Card Component
function ClusterCard({
  cluster,
  isSelected,
  onToggle,
}: {
  cluster: TopicCluster & { stories?: NewsStory[]; similar_proposals?: SimilarProposalInfo[] };
  isSelected: boolean;
  onToggle: () => void;
}) {
  const hasSimilar = cluster.similar_proposals && cluster.similar_proposals.length > 0;
  const reviewedOrApproved = cluster.similar_proposals?.filter(
    (p) => p.status === 'reviewed' || p.status === 'approved'
  );

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 border rounded-lg transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{cluster.theme}</h4>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                cluster.relevance_score >= 80
                  ? 'bg-green-100 text-green-700'
                  : cluster.relevance_score >= 60
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cluster.relevance_score}% match
            </span>
          </div>

          {cluster.audience_relevance && (
            <p className="text-sm text-gray-600 mt-1">{cluster.audience_relevance}</p>
          )}

          <div className="flex flex-wrap gap-1 mt-2">
            {cluster.keywords.slice(0, 5).map((keyword, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                {keyword}
              </span>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {cluster.story_ids.length} {cluster.story_ids.length === 1 ? 'story' : 'stories'}
          </p>

          {/* Similar proposals warning */}
          {hasSimilar && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-amber-800 font-medium">
                    Similar proposals exist ({cluster.similar_proposals!.length})
                  </p>
                  {reviewedOrApproved && reviewedOrApproved.length > 0 && (
                    <p className="text-amber-700 mt-0.5">
                      {reviewedOrApproved.length} reviewed/approved: {reviewedOrApproved.map((p) => `"${p.title.slice(0, 30)}${p.title.length > 30 ? '...' : ''}"`).join(', ')}
                    </p>
                  )}
                  <p className="text-amber-600 mt-0.5">
                    {cluster.similar_proposals![0].overlap_percentage}% story overlap
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>
    </button>
  );
}
