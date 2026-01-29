import { useState, KeyboardEvent } from 'react';
import { useCreateAudienceProfile, useUpdateAudienceProfile } from '../../hooks/useAudience';
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

export function AudienceProfileModal({ projectId, profile, onClose }: AudienceProfileModalProps) {
  const isEditing = !!profile;

  const [name, setName] = useState(profile?.name || '');
  const [ageRange, setAgeRange] = useState(profile?.age_range || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level || '');
  const [values, setValues] = useState<string[]>(profile?.values || []);
  const [fears, setFears] = useState<string[]>(profile?.fears || []);
  const [aspirations, setAspirations] = useState<string[]>(profile?.aspirations || []);
  const [preferredTone, setPreferredTone] = useState(profile?.preferred_tone || '');
  const [depthPreference, setDepthPreference] = useState(profile?.depth_preference || '');
  const [politicalSensitivity, setPoliticalSensitivity] = useState(profile?.political_sensitivity || 5);

  const [valueInput, setValueInput] = useState('');
  const [fearInput, setFearInput] = useState('');
  const [aspirationInput, setAspirationInput] = useState('');

  const createMutation = useCreateAudienceProfile(projectId);
  const updateMutation = useUpdateAudienceProfile(projectId);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      ageRange: ageRange || undefined,
      location: location || undefined,
      educationLevel: educationLevel || undefined,
      values,
      fears,
      aspirations,
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
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
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Young Professionals, Retired Educators"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
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
                  placeholder="e.g., 25-40"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Urban, Suburban"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Education Level</label>
                <input
                  type="text"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  placeholder="e.g., College-educated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
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
                placeholder="e.g., Family, Integrity, Innovation"
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
                placeholder="e.g., Economic uncertainty, Being misinformed"
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
                placeholder="e.g., Financial security, Making a difference"
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
