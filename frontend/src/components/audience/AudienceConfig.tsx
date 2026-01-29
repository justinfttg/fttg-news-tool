import { useState } from 'react';
import { useAudienceProfiles, useDeleteAudienceProfile } from '../../hooks/useAudience';
import { AudienceProfileCard } from './AudienceProfileCard';
import { AudienceProfileModal } from './AudienceProfileModal';
import { AudienceProfile } from '../../types';

interface AudienceConfigProps {
  projectId: string;
}

export function AudienceConfig({ projectId }: AudienceConfigProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AudienceProfile | null>(null);

  const { data: profiles, isLoading, isError } = useAudienceProfiles(projectId);
  const deleteMutation = useDeleteAudienceProfile(projectId);

  const handleEdit = (profile: AudienceProfile) => {
    setEditingProfile(profile);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this audience profile?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProfile(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Loading audience profiles...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-red-500 text-sm">
        Failed to load audience profiles. Please try again.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audience Profiles</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define your target audiences to tailor content and messaging.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + New Profile
        </button>
      </div>

      {profiles && profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <AudienceProfileCard
              key={profile.id}
              profile={profile}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 text-4xl mb-3">👥</div>
          <h3 className="text-gray-700 font-medium mb-1">No audience profiles yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Create your first audience profile to start tailoring your content.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Profile
          </button>
        </div>
      )}

      {showModal && (
        <AudienceProfileModal
          projectId={projectId}
          profile={editingProfile}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
