import { useParams, Link } from 'react-router-dom';
import { AudienceConfig } from '../components/audience/AudienceConfig';
import { useProject } from '../hooks/useProjects';

export function AudiencePage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id);

  return (
    <div>
      <div className="flex items-center space-x-4 mb-6">
        <Link to="/projects" className="text-primary-600 hover:text-primary-700 text-sm">
          &larr; Projects
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isLoading ? 'Loading...' : project?.name || 'Audience'}
        </h1>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <Link
          to={`/project/${id}/calendar`}
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Calendar
        </Link>
        <Link
          to={`/project/${id}/library`}
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          News Library
        </Link>
        <Link
          to={`/project/${id}/audience`}
          className="px-4 py-2 text-sm font-medium text-primary-600 border-b-2 border-primary-600"
        >
          Audience
        </Link>
      </div>

      {id ? (
        <AudienceConfig projectId={id} />
      ) : (
        <div className="text-center py-12 text-gray-500">Project not found</div>
      )}
    </div>
  );
}
