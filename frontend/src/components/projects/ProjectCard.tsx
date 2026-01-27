import { Link } from 'react-router-dom';
import { Project } from '../../types';

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  'bi-weekly': 'Bi-weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-600',
};

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/project/${project.id}/calendar`}
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900 truncate pr-2">{project.name}</h3>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
            statusStyles[project.status] || statusStyles.archived
          }`}
        >
          {project.status}
        </span>
      </div>

      {project.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {frequencyLabels[project.posting_frequency] || project.posting_frequency}
        </span>

        {project.video_quota_per_year != null && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {project.video_quota_per_year} videos/year
          </span>
        )}
      </div>

      {project.user_role && (
        <div className="mt-2 text-xs text-gray-400 capitalize">
          Role: {project.user_role}
        </div>
      )}
    </Link>
  );
}
