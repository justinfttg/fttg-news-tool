import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTopicGeneratorSettings, useUpdateSettings } from '../../hooks/useTopicProposals';
import { useAudienceProfiles } from '../../hooks/useAudience';
import type { DurationType } from '../../types';

interface ProposalSettingsModalProps {
  projectId: string;
  onClose: () => void;
}

const TIMEZONES = [
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Australia/Sydney',
];

const DURATION_OPTIONS: { value: DurationType; label: string }[] = [
  { value: 'short', label: 'Short (1-2 min)' },
  { value: 'standard', label: 'Standard (3-4 min)' },
  { value: 'long', label: 'Long (5-10 min)' },
];

const CATEGORY_OPTIONS = [
  'Politics',
  'Technology',
  'Business',
  'Social Issues',
  'Health',
  'Environment',
  'Entertainment',
  'Sports',
  'Science',
  'Education',
];

export default function ProposalSettingsModal({ projectId, onClose }: ProposalSettingsModalProps) {
  const { data: settingsData, isLoading } = useTopicGeneratorSettings(projectId);
  const { data: audienceProfiles } = useAudienceProfiles(projectId);
  const updateMutation = useUpdateSettings(projectId);

  // Form state
  const [autoGenerationEnabled, setAutoGenerationEnabled] = useState(true);
  const [autoGenerationTime, setAutoGenerationTime] = useState('06:00');
  const [autoGenerationTimezone, setAutoGenerationTimezone] = useState('Asia/Singapore');
  const [timeWindowDays, setTimeWindowDays] = useState(7);
  const [minStoriesForCluster, setMinStoriesForCluster] = useState(2);
  const [maxProposalsPerRun, setMaxProposalsPerRun] = useState(5);
  const [focusCategories, setFocusCategories] = useState<string[]>([]);
  const [comparisonRegions, setComparisonRegions] = useState<string[]>(['Singapore', 'Malaysia']);
  const [regionsInput, setRegionsInput] = useState('Singapore, Malaysia');
  const [defaultDurationType, setDefaultDurationType] = useState<DurationType>('standard');
  const [defaultAudienceProfileId, setDefaultAudienceProfileId] = useState<string | null>(null);
  const [includeTrendingContext, setIncludeTrendingContext] = useState(true);

  // Load settings into form
  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setAutoGenerationEnabled(s.auto_generation_enabled);
      setAutoGenerationTime(s.auto_generation_time?.slice(0, 5) || '06:00');
      setAutoGenerationTimezone(s.auto_generation_timezone || 'Asia/Singapore');
      setTimeWindowDays(s.time_window_days || 7);
      setMinStoriesForCluster(s.min_stories_for_cluster || 2);
      setMaxProposalsPerRun(s.max_proposals_per_run || 5);
      setFocusCategories(s.focus_categories || []);
      const regions = s.comparison_regions || ['Singapore', 'Malaysia'];
      setComparisonRegions(regions);
      setRegionsInput(regions.join(', '));
      setDefaultDurationType(s.default_duration_type || 'standard');
      setDefaultAudienceProfileId(s.default_audience_profile_id || null);
      setIncludeTrendingContext(s.include_trending_context !== false);
    }
  }, [settingsData]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        projectId,
        autoGenerationEnabled,
        autoGenerationTime: autoGenerationTime + ':00',
        autoGenerationTimezone,
        timeWindowDays,
        minStoriesForCluster,
        maxProposalsPerRun,
        focusCategories,
        comparisonRegions,
        defaultDurationType,
        defaultAudienceProfileId,
        includeTrendingContext,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const toggleCategory = (category: string) => {
    setFocusCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Topic Generator Settings</h2>
            <p className="text-sm text-gray-500">Configure how topic proposals are generated</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Auto-generation Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Auto-Generation</h3>

            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-700">Enable daily auto-generation</label>
                  <p className="text-xs text-gray-500">
                    Automatically generate topic proposals at the scheduled time
                  </p>
                </div>
                <button
                  onClick={() => setAutoGenerationEnabled(!autoGenerationEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoGenerationEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      autoGenerationEnabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Time and timezone */}
              {autoGenerationEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={autoGenerationTime}
                      onChange={(e) => setAutoGenerationTime(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Timezone</label>
                    <select
                      value={autoGenerationTimezone}
                      onChange={(e) => setAutoGenerationTimezone(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Story Selection Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Story Selection</h3>

            <div className="space-y-4">
              {/* Time window */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Time Window (days)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={timeWindowDays}
                    onChange={(e) => setTimeWindowDays(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-12 text-sm text-gray-600 text-right">{timeWindowDays}d</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Only include flagged stories from the last {timeWindowDays} days
                </p>
              </div>

              {/* Focus categories */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Focus Categories{' '}
                  <span className="text-xs text-gray-400">(leave empty for all)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((category) => (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        focusCategories.includes(category)
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Generation Defaults Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Generation Defaults</h3>

            <div className="space-y-4">
              {/* Default duration */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">Default Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDefaultDurationType(option.value)}
                      className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                        defaultDurationType === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default audience */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Default Audience Profile</label>
                <select
                  value={defaultAudienceProfileId || ''}
                  onChange={(e) => setDefaultAudienceProfileId(e.target.value || null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">None (select each time)</option>
                  {audienceProfiles?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Used for auto-generation and as the default selection
                </p>
              </div>

              {/* Comparison regions */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Comparison Regions</label>
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
              </div>

              {/* Clustering settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Min Stories per Cluster</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={minStoriesForCluster}
                    onChange={(e) => setMinStoriesForCluster(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Max Proposals per Run</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxProposalsPerRun}
                    onChange={(e) => setMaxProposalsPerRun(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Include trending context */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-gray-700">Include trending context</label>
                  <p className="text-xs text-gray-500">
                    Use viral posts and watched trends to inform proposals
                  </p>
                </div>
                <button
                  onClick={() => setIncludeTrendingContext(!includeTrendingContext)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    includeTrendingContext ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      includeTrendingContext ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Stats */}
          {settingsData?.stats && (
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Statistics</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total proposals:</span>
                  <span className="ml-2 font-medium">{settingsData.stats.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last auto-gen:</span>
                  <span className="ml-2 font-medium">
                    {settingsData.stats.lastAutoGeneration
                      ? new Date(settingsData.stats.lastAutoGeneration).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
                {Object.entries(settingsData.stats.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <span className="text-gray-500 capitalize">{status}:</span>
                    <span className="ml-2 font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </section>
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
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
