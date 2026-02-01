import { AudienceProfile } from '../../types';

interface AudienceProfileCardProps {
  profile: AudienceProfile;
  onEdit: (profile: AudienceProfile) => void;
  onDelete: (id: string) => void;
}

const toneLabels: Record<string, string> = {
  investigative: 'Investigative',
  educational: 'Educational',
  balanced: 'Balanced',
  provocative: 'Provocative',
  conversational: 'Conversational',
};

const depthLabels: Record<string, string> = {
  surface: 'Surface',
  medium: 'Medium',
  deep_dive: 'Deep Dive',
};

const platformTypeLabels: Record<string, string> = {
  digital_media: 'Digital Media',
  broadcast_tv: 'Broadcast TV',
  radio: 'Radio',
  print: 'Print',
  social_media: 'Social Media',
  podcast: 'Podcast',
  other: 'Other',
};

export function AudienceProfileCard({ profile, onEdit, onDelete }: AudienceProfileCardProps) {
  const demographics = [
    profile.age_range,
    profile.location,
    profile.education_level,
  ].filter(Boolean);

  const languageMarket = [
    profile.primary_language,
    profile.market_region,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{profile.name}</h3>
          {profile.platform_name && (
            <p className="text-sm text-gray-500">{profile.platform_name}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(profile)}
            className="text-gray-400 hover:text-primary-600 text-sm"
            title="Edit"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(profile.id)}
            className="text-gray-400 hover:text-red-600 text-sm"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Platform URL */}
      {profile.platform_url && (
        <div className="mb-3">
          <a
            href={profile.platform_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            {profile.platform_url}
          </a>
        </div>
      )}

      {/* Language & Market */}
      {languageMarket.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Language & Market</p>
          <div className="flex flex-wrap gap-2">
            {profile.primary_language && (
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs rounded-full">
                {profile.primary_language}
              </span>
            )}
            {profile.market_region && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                {profile.market_region}
              </span>
            )}
            {profile.secondary_languages?.map((lang, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-cyan-50 text-cyan-600 text-xs rounded-full"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Platform Info */}
      {(profile.platform_type || profile.audience_size || (profile.content_categories && profile.content_categories.length > 0)) && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Platform</p>
          <div className="flex flex-wrap gap-2">
            {profile.platform_type && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                {platformTypeLabels[profile.platform_type] || profile.platform_type}
              </span>
            )}
            {profile.audience_size && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                {profile.audience_size}
              </span>
            )}
          </div>
          {profile.content_categories && profile.content_categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.content_categories.map((cat, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {demographics.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Demographics</p>
          <p className="text-sm text-gray-700">{demographics.join(' • ')}</p>
        </div>
      )}

      {profile.key_demographics && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Key Demographics</p>
          <p className="text-sm text-gray-700">{profile.key_demographics}</p>
        </div>
      )}

      {profile.cultural_context && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cultural Context</p>
          <p className="text-sm text-gray-700 line-clamp-2">{profile.cultural_context}</p>
        </div>
      )}

      {profile.values.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Values</p>
          <div className="flex flex-wrap gap-1">
            {profile.values.map((value, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.fears.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fears</p>
          <div className="flex flex-wrap gap-1">
            {profile.fears.map((fear, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
              >
                {fear}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.aspirations.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Aspirations</p>
          <div className="flex flex-wrap gap-1">
            {profile.aspirations.map((asp, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {asp}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
        {profile.preferred_tone && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
            {toneLabels[profile.preferred_tone] || profile.preferred_tone}
          </span>
        )}
        {profile.depth_preference && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
            {depthLabels[profile.depth_preference] || profile.depth_preference}
          </span>
        )}
        {profile.political_sensitivity && (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
            Sensitivity: {profile.political_sensitivity}/10
          </span>
        )}
      </div>
    </div>
  );
}
