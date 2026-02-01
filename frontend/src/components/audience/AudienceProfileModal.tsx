import { useState, KeyboardEvent } from 'react';
import { useCreateAudienceProfile, useUpdateAudienceProfile } from '../../hooks/useAudience';
import { analyzeAudienceFromUrl, AnalyzedAudienceResult } from '../../services/audience.service';
import { AudienceProfile } from '../../types';

interface AudienceProfileModalProps {
  projectId: string;
  profile?: AudienceProfile | null;
  onClose: () => void;
}

const toneOptions = [
  { value: '', label: 'Select tone...' },
  { value: 'investigative', label: 'Investigative' },
  { value: 'educational', label: 'Educational' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'provocative', label: 'Provocative' },
  { value: 'conversational', label: 'Conversational' },
];

const depthOptions = [
  { value: '', label: 'Select depth...' },
  { value: 'surface', label: 'Surface - Quick overview' },
  { value: 'medium', label: 'Medium - Balanced detail' },
  { value: 'deep_dive', label: 'Deep Dive - Comprehensive' },
];

const platformTypeOptions = [
  { value: '', label: 'Select platform type...' },
  { value: 'digital_media', label: 'Digital Media' },
  { value: 'broadcast_tv', label: 'Broadcast TV' },
  { value: 'radio', label: 'Radio' },
  { value: 'print', label: 'Print' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'other', label: 'Other' },
];

const languageOptions = [
  { value: '', label: 'Select language...' },
  { value: 'English', label: 'English' },
  { value: 'Mandarin', label: 'Mandarin (中文)' },
  { value: 'Malay', label: 'Malay (Bahasa Melayu)' },
  { value: 'Tamil', label: 'Tamil (தமிழ்)' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  { value: 'Indonesian', label: 'Indonesian (Bahasa Indonesia)' },
  { value: 'Thai', label: 'Thai (ไทย)' },
  { value: 'Vietnamese', label: 'Vietnamese (Tiếng Việt)' },
  { value: 'Japanese', label: 'Japanese (日本語)' },
  { value: 'Korean', label: 'Korean (한국어)' },
  { value: 'Spanish', label: 'Spanish (Español)' },
  { value: 'French', label: 'French (Français)' },
  { value: 'German', label: 'German (Deutsch)' },
  { value: 'Arabic', label: 'Arabic (العربية)' },
  { value: 'Portuguese', label: 'Portuguese (Português)' },
  { value: 'Other', label: 'Other' },
];

const marketRegionOptions = [
  { value: '', label: 'Select market region...' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Hong Kong', label: 'Hong Kong' },
  { value: 'Taiwan', label: 'Taiwan' },
  { value: 'China', label: 'China (Mainland)' },
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'India', label: 'India' },
  { value: 'Australia', label: 'Australia' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Southeast Asia', label: 'Southeast Asia (Regional)' },
  { value: 'Asia Pacific', label: 'Asia Pacific (Regional)' },
  { value: 'Global', label: 'Global' },
  { value: 'Other', label: 'Other' },
];

export function AudienceProfileModal({ projectId, profile, onClose }: AudienceProfileModalProps) {
  const isEditing = !!profile;

  // Basic Info
  const [name, setName] = useState(profile?.name || '');

  // Demographics
  const [ageRange, setAgeRange] = useState(profile?.age_range || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level || '');

  // Language & Market
  const [primaryLanguage, setPrimaryLanguage] = useState(profile?.primary_language || '');
  const [secondaryLanguages, setSecondaryLanguages] = useState<string[]>(profile?.secondary_languages || []);
  const [marketRegion, setMarketRegion] = useState(profile?.market_region || '');

  // Platform Info
  const [platformUrl, setPlatformUrl] = useState(profile?.platform_url || '');
  const [platformName, setPlatformName] = useState(profile?.platform_name || '');
  const [platformType, setPlatformType] = useState(profile?.platform_type || '');
  const [contentCategories, setContentCategories] = useState<string[]>(profile?.content_categories || []);
  const [audienceSize, setAudienceSize] = useState(profile?.audience_size || '');

  // Psychographics
  const [values, setValues] = useState<string[]>(profile?.values || []);
  const [fears, setFears] = useState<string[]>(profile?.fears || []);
  const [aspirations, setAspirations] = useState<string[]>(profile?.aspirations || []);
  const [keyDemographics, setKeyDemographics] = useState(profile?.key_demographics || '');
  const [culturalContext, setCulturalContext] = useState(profile?.cultural_context || '');

  // Content Preferences
  const [preferredTone, setPreferredTone] = useState(profile?.preferred_tone || '');
  const [depthPreference, setDepthPreference] = useState(profile?.depth_preference || '');
  const [politicalSensitivity, setPoliticalSensitivity] = useState(profile?.political_sensitivity || 5);

  // Input states for tag fields
  const [valueInput, setValueInput] = useState('');
  const [fearInput, setFearInput] = useState('');
  const [aspirationInput, setAspirationInput] = useState('');
  const [secondaryLangInput, setSecondaryLangInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  // AI Analyzer state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const createMutation = useCreateAudienceProfile(projectId);
  const updateMutation = useUpdateAudienceProfile(projectId);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const applyAnalysisResults = (analysis: AnalyzedAudienceResult) => {
    // Apply all analyzed fields, letting user adjust after
    if (analysis.platformName) setPlatformName(analysis.platformName);
    if (analysis.platformType) setPlatformType(analysis.platformType);
    if (analysis.primaryLanguage) setPrimaryLanguage(analysis.primaryLanguage);
    if (analysis.secondaryLanguages?.length) setSecondaryLanguages(analysis.secondaryLanguages);
    if (analysis.marketRegion) setMarketRegion(analysis.marketRegion);
    if (analysis.contentCategories?.length) setContentCategories(analysis.contentCategories);
    if (analysis.audienceSize) setAudienceSize(analysis.audienceSize);
    if (analysis.ageRange) setAgeRange(analysis.ageRange);
    if (analysis.location) setLocation(analysis.location);
    if (analysis.educationLevel) setEducationLevel(analysis.educationLevel);
    if (analysis.keyDemographics) setKeyDemographics(analysis.keyDemographics);
    if (analysis.culturalContext) setCulturalContext(analysis.culturalContext);
    if (analysis.values?.length) setValues(analysis.values);
    if (analysis.fears?.length) setFears(analysis.fears);
    if (analysis.aspirations?.length) setAspirations(analysis.aspirations);
    if (analysis.preferredTone) setPreferredTone(analysis.preferredTone);
    if (analysis.depthPreference) setDepthPreference(analysis.depthPreference);
    if (analysis.politicalSensitivity) setPoliticalSensitivity(analysis.politicalSensitivity);

    // Auto-generate name if empty
    if (!name && analysis.platformName) {
      setName(`${analysis.platformName} Audience`);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!platformUrl) {
      setAnalyzeError('Please enter a URL first');
      return;
    }

    // Validate URL format
    try {
      new URL(platformUrl);
    } catch {
      setAnalyzeError('Please enter a valid URL (e.g., https://www.8world.com)');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const analysis = await analyzeAudienceFromUrl(platformUrl);
      applyAnalysisResults(analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalyzeError(
        error instanceof Error
          ? error.message
          : 'Failed to analyze URL. Please try again or fill in manually.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      // Demographics
      ageRange: ageRange || undefined,
      location: location || undefined,
      educationLevel: educationLevel || undefined,
      // Language & Market
      primaryLanguage: primaryLanguage || undefined,
      secondaryLanguages,
      marketRegion: marketRegion || undefined,
      // Platform Info
      platformUrl: platformUrl || undefined,
      platformName: platformName || undefined,
      platformType: (platformType as AudienceProfile['platform_type']) || null,
      contentCategories,
      audienceSize: audienceSize || undefined,
      // Psychographics
      values,
      fears,
      aspirations,
      keyDemographics: keyDemographics || undefined,
      culturalContext: culturalContext || undefined,
      // Content Preferences
      preferredTone: (preferredTone as AudienceProfile['preferred_tone']) || null,
      depthPreference: (depthPreference as AudienceProfile['depth_preference']) || null,
      politicalSensitivity: politicalSensitivity || null,
    };

    try {
      if (isEditing && profile) {
        await updateMutation.mutateAsync({ id: profile.id, ...data });
      } else {
        await createMutation.mutateAsync({ projectId, ...data });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handleTagKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: (v: string) => void,
    tags: string[],
    setTags: (v: string[]) => void
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = input.trim().replace(/,+$/, '');
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setInput('');
    }
  };

  const removeTag = (tags: string[], setTags: (v: string[]) => void, index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Audience Profile' : 'Create Audience Profile'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* AI Analyzer Section */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">AI-Powered Audience Analysis</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Enter your client's platform URL and let AI analyze the website to auto-fill audience characteristics. You can adjust the results after.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={platformUrl}
                    onChange={(e) => {
                      setPlatformUrl(e.target.value);
                      setAnalyzeError(null);
                    }}
                    placeholder="https://www.8world.com"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    disabled={isAnalyzing}
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeUrl}
                    disabled={isAnalyzing || !platformUrl}
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Analyze with AI
                      </>
                    )}
                  </button>
                </div>
                {analyzeError && (
                  <p className="text-xs text-red-600 mt-2">{analyzeError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 8world Mandarin Viewers, Channel NewsAsia Audience"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Platform Info Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Platform Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Platform URL</label>
                  <input
                    type="url"
                    value={platformUrl}
                    onChange={(e) => setPlatformUrl(e.target.value)}
                    placeholder="e.g., https://www.8world.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Platform Name</label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="e.g., 8world, CNA, The Straits Times"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Platform Type</label>
                  <select
                    value={platformType}
                    onChange={(e) => setPlatformType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {platformTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Audience Size</label>
                  <input
                    type="text"
                    value={audienceSize}
                    onChange={(e) => setAudienceSize(e.target.value)}
                    placeholder="e.g., 500K monthly, 2M subscribers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Content Categories (press Enter to add)</label>
                <input
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  onKeyDown={(e) => handleTagKeyDown(e, categoryInput, setCategoryInput, contentCategories, setContentCategories)}
                  placeholder="e.g., News, Entertainment, Lifestyle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {contentCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {contentCategories.map((cat, i) => (
                      <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full flex items-center">
                        {cat}
                        <button type="button" onClick={() => removeTag(contentCategories, setContentCategories, i)} className="ml-1 text-indigo-500 hover:text-indigo-700">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Language & Market Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Language & Market</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Primary Language</label>
                <select
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Market Region</label>
                <select
                  value={marketRegion}
                  onChange={(e) => setMarketRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {marketRegionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Secondary Languages</label>
                <input
                  type="text"
                  value={secondaryLangInput}
                  onChange={(e) => setSecondaryLangInput(e.target.value)}
                  onKeyDown={(e) => handleTagKeyDown(e, secondaryLangInput, setSecondaryLangInput, secondaryLanguages, setSecondaryLanguages)}
                  placeholder="Press Enter to add"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {secondaryLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {secondaryLanguages.map((lang, i) => (
                      <span key={i} className="px-2 py-1 bg-cyan-100 text-cyan-700 text-sm rounded-full flex items-center">
                        {lang}
                        <button type="button" onClick={() => removeTag(secondaryLanguages, setSecondaryLanguages, i)} className="ml-1 text-cyan-500 hover:text-cyan-700">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Demographics */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Age Range</label>
                <input
                  type="text"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  placeholder="e.g., 25-55"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Urban Singapore"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Education Level</label>
                <input
                  type="text"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  placeholder="e.g., Secondary and above"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">Key Demographics Summary</label>
              <textarea
                value={keyDemographics}
                onChange={(e) => setKeyDemographics(e.target.value)}
                placeholder="Describe the key demographic characteristics of this audience..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Cultural Context */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cultural Context</h3>
            <textarea
              value={culturalContext}
              onChange={(e) => setCulturalContext(e.target.value)}
              placeholder="Describe the cultural context and considerations for this audience (e.g., cultural values, sensitivities, local customs, regional perspectives)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Psychographics */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Psychographics</h3>

            {/* Values */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Values (press Enter to add)</label>
              <input
                type="text"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, valueInput, setValueInput, values, setValues)}
                placeholder="e.g., Family, Tradition, Progress"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {values.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {values.map((v, i) => (
                    <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center">
                      {v}
                      <button type="button" onClick={() => removeTag(values, setValues, i)} className="ml-1 text-green-500 hover:text-green-700">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Fears */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Fears (press Enter to add)</label>
              <input
                type="text"
                value={fearInput}
                onChange={(e) => setFearInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, fearInput, setFearInput, fears, setFears)}
                placeholder="e.g., Economic uncertainty, Being left behind"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {fears.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {fears.map((f, i) => (
                    <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full flex items-center">
                      {f}
                      <button type="button" onClick={() => removeTag(fears, setFears, i)} className="ml-1 text-red-500 hover:text-red-700">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Aspirations */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Aspirations (press Enter to add)</label>
              <input
                type="text"
                value={aspirationInput}
                onChange={(e) => setAspirationInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, aspirationInput, setAspirationInput, aspirations, setAspirations)}
                placeholder="e.g., Financial security, Better life for family"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {aspirations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {aspirations.map((a, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center">
                      {a}
                      <button type="button" onClick={() => removeTag(aspirations, setAspirations, i)} className="ml-1 text-blue-500 hover:text-blue-700">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content Preferences */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Content Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Preferred Tone</label>
                <select
                  value={preferredTone}
                  onChange={(e) => setPreferredTone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {toneOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Depth Preference</label>
                <select
                  value={depthPreference}
                  onChange={(e) => setDepthPreference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {depthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">
                Political Sensitivity: {politicalSensitivity}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={politicalSensitivity}
                onChange={(e) => setPoliticalSensitivity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low (direct)</span>
                <span>High (careful)</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 pt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
