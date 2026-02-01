import { useState } from 'react';
import { NewsStory, AudienceProfile } from '../../types';
import { useGenerateAngle } from '../../hooks/useAngles';

interface AngleGenerationModalProps {
  story: NewsStory;
  projectId: string;
  audienceProfiles: AudienceProfile[];
  onClose: () => void;
}

const FRAMEWORK_OPTIONS = [
  {
    value: 'fttg_investigative' as const,
    label: 'FTTG Investigative',
    description: 'Contrarian, emotionally-driven storytelling. Challenge mainstream narratives with evidence.',
    color: 'red',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    value: 'educational_deepdive' as const,
    label: 'Educational Deep-Dive',
    description: 'John Oliver-style comprehensive education with humor and systemic analysis.',
    color: 'blue',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const COMPARISON_REGIONS = [
  'Singapore',
  'Malaysia',
  'Indonesia',
  'Thailand',
  'Vietnam',
  'Philippines',
  'China',
  'Hong Kong',
  'Taiwan',
  'Japan',
  'South Korea',
  'India',
  'Australia',
  'United States',
  'United Kingdom',
  'European Union',
];

export function AngleGenerationModal({
  story,
  projectId,
  audienceProfiles,
  onClose,
}: AngleGenerationModalProps) {
  const [selectedAudienceId, setSelectedAudienceId] = useState(audienceProfiles[0]?.id || '');
  const [selectedFramework, setSelectedFramework] = useState<'fttg_investigative' | 'educational_deepdive'>('fttg_investigative');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showRegions, setShowRegions] = useState(false);

  const generateMutation = useGenerateAngle(projectId);

  const handleGenerate = async () => {
    if (!selectedAudienceId) return;

    try {
      await generateMutation.mutateAsync({
        newsStoryId: story.id,
        audienceProfileId: selectedAudienceId,
        projectId,
        frameworkType: selectedFramework,
        comparisonRegions: selectedRegions.length > 0 ? selectedRegions : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to generate angle:', error);
    }
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const selectedAudience = audienceProfiles.find((p) => p.id === selectedAudienceId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate Story Angle</h2>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{story.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Audience Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience *
            </label>
            <select
              value={selectedAudienceId}
              onChange={(e) => setSelectedAudienceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {audienceProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.platform_name && ` (${profile.platform_name})`}
                </option>
              ))}
            </select>
            {selectedAudience && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex flex-wrap gap-2">
                  {selectedAudience.primary_language && (
                    <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">
                      {selectedAudience.primary_language}
                    </span>
                  )}
                  {selectedAudience.market_region && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                      {selectedAudience.market_region}
                    </span>
                  )}
                  {selectedAudience.age_range && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      Age: {selectedAudience.age_range}
                    </span>
                  )}
                  {selectedAudience.preferred_tone && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      Tone: {selectedAudience.preferred_tone}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Framework Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Storytelling Framework *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FRAMEWORK_OPTIONS.map((framework) => (
                <button
                  key={framework.value}
                  onClick={() => setSelectedFramework(framework.value)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedFramework === framework.value
                      ? framework.color === 'red'
                        ? 'border-red-500 bg-red-50'
                        : 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedFramework === framework.value
                        ? framework.color === 'red'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {framework.icon}
                    </div>
                    <div>
                      <h3 className={`font-medium ${
                        selectedFramework === framework.value
                          ? framework.color === 'red' ? 'text-red-900' : 'text-blue-900'
                          : 'text-gray-900'
                      }`}>
                        {framework.label}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {framework.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Comparison Regions (optional, mainly for investigative) */}
          {selectedFramework === 'fttg_investigative' && (
            <div>
              <button
                onClick={() => setShowRegions(!showRegions)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showRegions ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Comparison Regions (Optional)
              </button>
              {showRegions && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  {COMPARISON_REGIONS.map((region) => (
                    <button
                      key={region}
                      onClick={() => toggleRegion(region)}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        selectedRegions.includes(region)
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              )}
              {selectedRegions.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {selectedRegions.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Error display */}
          {generateMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Failed to generate angle. Please try again.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generateMutation.isPending}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedAudienceId || generateMutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Angle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
