import { Link, useParams } from 'react-router-dom';
import { TopicProposals } from '../components/topic-proposals';

export default function TopicProposalsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-blue-600">FTTG</Link>
              <Link to="/projects" className="text-gray-600 hover:text-gray-900">Projects</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Back link and title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link to="/projects" className="text-blue-600 hover:text-blue-700 text-sm">
          ← Projects
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <Link
              to={`/project/${id}`}
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            >
              Calendar
            </Link>
            <Link
              to={`/project/${id}/library`}
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            >
              News Library
            </Link>
            <Link
              to={`/project/${id}/social-listener`}
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            >
              Social Listener
            </Link>
            <Link
              to={`/project/${id}/topics`}
              className="py-4 px-1 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
            >
              Topic Proposals
            </Link>
            <Link
              to={`/project/${id}/audience`}
              className="py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            >
              Audience
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TopicProposals projectId={id} />
      </main>
    </div>
  );
}
