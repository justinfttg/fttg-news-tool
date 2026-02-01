import { AngleWithDetails } from '../../services/angle.service';
import { useUpdateAngleStatus, useDeleteAngle } from '../../hooks/useAngles';

interface AngleViewModalProps {
  angle: AngleWithDetails;
  projectId: string;
  onClose: () => void;
}

export function AngleViewModal({ angle, projectId, onClose }: AngleViewModalProps) {
  const updateStatusMutation = useUpdateAngleStatus(projectId);
  const deleteMutation = useDeleteAngle(projectId);

  const isInvestigative = !!angle.angle_data.contrarian_headline;

  const handleApprove = async () => {
    await updateStatusMutation.mutateAsync({ id: angle.id, status: 'approved' });
    onClose();
  };

  const handleArchive = async () => {
    await updateStatusMutation.mutateAsync({ id: angle.id, status: 'archived' });
    onClose();
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this angle?')) {
      await deleteMutation.mutateAsync(angle.id);
      onClose();
    }
  };

  const renderInvestigativeAngle = () => {
    const data = angle.angle_data;
    return (
      <div className="space-y-6">
        {/* Contrarian Headline */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <h3 className="text-xs font-semibold text-red-600 uppercase mb-1">Contrarian Headline</h3>
          <p className="text-lg font-bold text-red-900">{data.contrarian_headline}</p>
        </div>

        {/* Narrative Extraction */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Official Narrative</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{data.narrative_extraction}</p>
        </div>

        {/* Contradictions */}
        {data.contradiction_finder && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contradictions Found</h3>
            <ul className="space-y-2">
              {(Array.isArray(data.contradiction_finder) ? data.contradiction_finder : []).map((item: any, i: number) => (
                <li key={i} className="text-sm bg-amber-50 p-3 rounded-lg border-l-2 border-amber-400">
                  <span className="font-medium text-amber-900">{item.point || item}</span>
                  {item.source && (
                    <span className="text-amber-600 text-xs ml-2">— {item.source}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comparison Framework */}
        {data.comparison_framework && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Regional Comparison</h3>
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              <div>
                <span className="text-xs font-medium text-blue-600">Subject:</span>
                <p className="text-sm text-blue-900">{data.comparison_framework.subject}</p>
              </div>
              {data.comparison_framework.comparison_1 && (
                <div className="border-t border-blue-200 pt-3">
                  <span className="text-xs font-medium text-blue-600">{data.comparison_framework.comparison_1.region}:</span>
                  <p className="text-sm text-blue-800">{data.comparison_framework.comparison_1.approach}</p>
                  {data.comparison_framework.comparison_1.outcome && (
                    <p className="text-xs text-blue-600 mt-1">Outcome: {data.comparison_framework.comparison_1.outcome}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emotional Core */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Emotional Core</h3>
          <p className="text-sm text-gray-600 bg-pink-50 p-3 rounded-lg border-l-2 border-pink-400">
            {data.emotional_core}
          </p>
        </div>

        {/* Authority Challenge */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Authority Challenge</h3>
          <p className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">{data.authority_challenge}</p>
        </div>

        {/* Conclusion */}
        <div className="bg-gray-900 text-white p-4 rounded-lg">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">Conclusion</h3>
          <p className="text-base font-medium">{data.conclusion}</p>
        </div>
      </div>
    );
  };

  const renderEducationalAngle = () => {
    const data = angle.angle_data;
    return (
      <div className="space-y-6">
        {/* Timely Hook */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <h3 className="text-xs font-semibold text-blue-600 uppercase mb-1">Timely Hook</h3>
          <p className="text-sm text-blue-900">{data.timely_hook}</p>
        </div>

        {/* Context Setup */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Context Setup</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{data.context_setup}</p>
        </div>

        {/* Problem Breakdown */}
        {data.problem_breakdown && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Problem Breakdown</h3>
            <ul className="space-y-2">
              {(Array.isArray(data.problem_breakdown) ? data.problem_breakdown : []).map((item: any, i: number) => (
                <li key={i} className="text-sm bg-amber-50 p-3 rounded-lg">
                  <span className="font-medium text-amber-900">{item.issue || item}</span>
                  {item.explanation && (
                    <p className="text-amber-700 text-xs mt-1">{item.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evidence Layering */}
        {data.evidence_layering && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Evidence</h3>
            <ul className="space-y-2">
              {(Array.isArray(data.evidence_layering) ? data.evidence_layering : []).map((item: any, i: number) => (
                <li key={i} className="text-sm bg-green-50 p-3 rounded-lg flex items-start gap-2">
                  <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-xs rounded">
                    {item.type || 'data'}
                  </span>
                  <span className="text-green-900">{item.point || item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Human Impact */}
        {data.human_impact && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Human Impact</h3>
            <ul className="space-y-2">
              {(Array.isArray(data.human_impact) ? data.human_impact : []).map((item: any, i: number) => (
                <li key={i} className="text-sm bg-pink-50 p-3 rounded-lg border-l-2 border-pink-400">
                  {item.story || item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Systemic Analysis */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Systemic Analysis</h3>
          <p className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">{data.systemic_analysis}</p>
        </div>

        {/* Visual Suggestions */}
        {data.visual_suggestions && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Visual Suggestions</h3>
            <ul className="grid grid-cols-2 gap-2">
              {(Array.isArray(data.visual_suggestions) ? data.visual_suggestions : []).map((item: any, i: number) => (
                <li key={i} className="text-xs bg-indigo-50 p-2 rounded-lg">
                  <span className="font-medium text-indigo-900">{item.visual || item}</span>
                  {item.purpose && (
                    <p className="text-indigo-600 mt-0.5">{item.purpose}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Call to Action */}
        {data.call_to_action && (
          <div className="bg-gray-900 text-white p-4 rounded-lg">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Call to Action</h3>
            <ul className="space-y-1">
              {(Array.isArray(data.call_to_action) ? data.call_to_action : []).map((item: any, i: number) => (
                <li key={i} className="text-sm">
                  {item.action || item}
                  {item.who && <span className="text-gray-400 text-xs ml-2">({item.who})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Humor Opportunities */}
        {data.humor_opportunities && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Humor Opportunities</h3>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(data.humor_opportunities) ? data.humor_opportunities : []).map((item: string, i: number) => (
                <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                isInvestigative ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isInvestigative ? 'FTTG Investigative' : 'Educational Deep-Dive'}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${
                angle.status === 'approved' ? 'bg-green-100 text-green-700' :
                angle.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {angle.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
          {angle.news_stories && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-1">
              Story: {angle.news_stories.title}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Audience Care Statement */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
            <h3 className="text-xs font-semibold text-purple-600 uppercase mb-1">Why This Audience Should Care</h3>
            <p className="text-sm text-purple-900">{angle.audience_care_statement}</p>
          </div>

          {/* Framework-specific content */}
          {isInvestigative ? renderInvestigativeAngle() : renderEducationalAngle()}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between">
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <div className="flex gap-3">
            {angle.status !== 'archived' && (
              <button
                onClick={handleArchive}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Archive
              </button>
            )}
            {angle.status !== 'approved' && (
              <button
                onClick={handleApprove}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve Angle
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
