import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Save,
  Send,
  Check,
  Lock,
  History,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';
import {
  useEpisodeContent,
  useSaveContentVersion,
  useSubmitForReview,
  useApproveContent,
  useLockContent,
  useContentFeedback,
  useAddFeedback,
  useResolveFeedback,
} from '../../hooks/useEpisodeContent';
import {
  getStatusLabel,
  getStatusColor,
  type ContentType,
  type ContentFeedback,
} from '../../services/episode-content.service';

interface ContentEditorProps {
  episodeId: string;
  contentType: ContentType;
  episodeTitle: string;
  canEdit?: boolean;
  canApprove?: boolean;
  isClient?: boolean;
}

export default function ContentEditor({
  episodeId,
  contentType,
  episodeTitle,
  canEdit = true,
  canApprove = false,
  isClient = false,
}: ContentEditorProps) {
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackType, setFeedbackType] = useState<'comment' | 'revision_request'>('comment');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data, isLoading } = useEpisodeContent(episodeId, contentType);
  const { data: feedbackData } = useContentFeedback(
    episodeId,
    contentType,
    selectedVersionId || data?.latestVersion?.id
  );

  // Mutations
  const saveMutation = useSaveContentVersion(episodeId, contentType);
  const submitMutation = useSubmitForReview(episodeId, contentType);
  const approveMutation = useApproveContent(episodeId, contentType);
  const lockMutation = useLockContent(episodeId, contentType);
  const addFeedbackMutation = useAddFeedback(episodeId, contentType);
  const resolveFeedbackMutation = useResolveFeedback(episodeId, contentType);

  const isPending = saveMutation.isPending || submitMutation.isPending || approveMutation.isPending || lockMutation.isPending;
  const isLocked = data?.content?.status === 'locked';
  const canEditContent = canEdit && !isLocked;

  // Initialize editor with latest version
  useMemo(() => {
    if (data?.latestVersion) {
      setBody(data.latestVersion.body);
      setTitle(data.latestVersion.title || '');
    }
  }, [data?.latestVersion?.id]);

  // Check if content has changed
  const hasChanges = useMemo(() => {
    if (!data?.latestVersion) return body.trim().length > 0;
    return body !== data.latestVersion.body || title !== (data.latestVersion.title || '');
  }, [body, title, data?.latestVersion]);

  // Handle text selection for inline feedback
  const handleTextSelection = useCallback(() => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;

    if (start !== end) {
      const selectedText = body.substring(start, end);
      setSelection({ start, end, text: selectedText });
      setShowFeedbackForm(true);
    }
  }, [body]);

  // Save content
  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      await saveMutation.mutateAsync({
        title: title || undefined,
        body,
        changeSummary: changeSummary || undefined,
      });
      setChangeSummary('');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  // Submit for review
  const handleSubmit = async () => {
    if (hasChanges) {
      await handleSave();
    }
    await submitMutation.mutateAsync();
  };

  // Approve content
  const handleApprove = async () => {
    await approveMutation.mutateAsync();
  };

  // Lock content
  const handleLock = async () => {
    await lockMutation.mutateAsync();
  };

  // Add feedback
  const handleAddFeedback = async () => {
    if (!feedbackComment.trim() || !data?.latestVersion) return;

    try {
      await addFeedbackMutation.mutateAsync({
        versionId: data.latestVersion.id,
        comment: feedbackComment,
        feedbackType,
        highlightStart: selection?.start,
        highlightEnd: selection?.end,
        highlightedText: selection?.text,
        isClientFeedback: isClient,
      });
      setFeedbackComment('');
      setSelection(null);
      setShowFeedbackForm(false);
    } catch (error) {
      console.error('Failed to add feedback:', error);
    }
  };

  // Resolve feedback
  const handleResolveFeedback = async (feedbackId: string) => {
    await resolveFeedbackMutation.mutateAsync(feedbackId);
  };

  // Load specific version
  const loadVersion = (version: { body: string; title: string | null }) => {
    setBody(version.body);
    setTitle(version.title || '');
    setShowVersionHistory(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading content...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <h3 className="font-medium text-gray-900">
            {contentType === 'video_script' ? 'Video Script' : 'Article'}
          </h3>
          <p className="text-sm text-gray-500">{episodeTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {data?.content && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(data.content.status)}`}>
              {getStatusLabel(data.content.status)}
            </span>
          )}

          {/* Version history toggle */}
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <History className="w-4 h-4" />
            v{data?.content?.current_version || 0}
          </button>

          {/* Unresolved feedback count */}
          {data && data.unresolvedFeedbackCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
              <AlertCircle className="w-3 h-3" />
              {data.unresolvedFeedbackCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && data?.versions && data.versions.length > 0 && (
        <div className="border-b bg-gray-50 p-4 max-h-48 overflow-y-auto">
          <div className="text-xs font-medium text-gray-500 mb-2">Version History</div>
          <div className="space-y-2">
            {data.versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 cursor-pointer"
                onClick={() => {
                  loadVersion(version);
                  setSelectedVersionId(version.id);
                }}
              >
                <div>
                  <span className="text-sm font-medium">v{version.version_number}</span>
                  {version.change_summary && (
                    <p className="text-xs text-gray-500">{version.change_summary}</p>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(version.created_at).toLocaleDateString()}
                  {version.created_by && (
                    <span className="ml-2">{version.created_by.full_name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex">
        {/* Main content area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            disabled={!canEditContent}
            className="text-lg font-medium mb-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />

          {/* Body textarea */}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onMouseUp={handleTextSelection}
            placeholder={`Write your ${contentType === 'video_script' ? 'script' : 'article'} here...`}
            disabled={!canEditContent}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 font-mono text-sm"
          />

          {/* Change summary (when saving) */}
          {hasChanges && canEditContent && (
            <div className="mt-3">
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="What changed? (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
          )}

          {/* Word count */}
          <div className="text-xs text-gray-400 mt-2">
            {body.trim().split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        {/* Feedback sidebar */}
        <div className="w-80 border-l bg-gray-50 overflow-y-auto">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Feedback</span>
            {!showFeedbackForm && data?.latestVersion && (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>

          {/* Add feedback form */}
          {showFeedbackForm && (
            <div className="p-3 border-b bg-white">
              {selection && (
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <span className="font-medium">Selected:</span>
                  <p className="text-gray-600 mt-1 line-clamp-2">"{selection.text}"</p>
                </div>
              )}
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Add your feedback..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-none"
                rows={3}
              />
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as 'comment' | 'revision_request')}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="comment">Comment</option>
                  <option value="revision_request">Request Revision</option>
                </select>
                <button
                  onClick={handleAddFeedback}
                  disabled={!feedbackComment.trim() || addFeedbackMutation.isPending}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Post
                </button>
                <button
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setSelection(null);
                    setFeedbackComment('');
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Feedback list */}
          <div className="divide-y">
            {feedbackData?.feedback.map((fb) => (
              <FeedbackItem
                key={fb.id}
                feedback={fb}
                onResolve={handleResolveFeedback}
                isResolving={resolveFeedbackMutation.isPending}
              />
            ))}
            {(!feedbackData?.feedback || feedbackData.feedback.length === 0) && (
              <div className="p-4 text-sm text-gray-400 text-center">
                No feedback yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          {data?.latestVersion && (
            <>
              Last saved: {new Date(data.latestVersion.created_at).toLocaleString()}
              {data.latestVersion.created_by && (
                <> by {data.latestVersion.created_by.full_name}</>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save */}
          {canEditContent && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          )}

          {/* Submit for review */}
          {canEditContent && data?.content?.status !== 'in_review' && (
            <button
              onClick={handleSubmit}
              disabled={isPending || !data?.latestVersion}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          )}

          {/* Approve */}
          {canApprove && data?.content?.status === 'in_review' && (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
          )}

          {/* Lock */}
          {canApprove && data?.content?.status === 'approved' && (
            <button
              onClick={handleLock}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              Lock Final
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Feedback item component
interface FeedbackItemProps {
  feedback: ContentFeedback;
  onResolve: (id: string) => void;
  isResolving: boolean;
}

function FeedbackItem({ feedback, onResolve, isResolving }: FeedbackItemProps) {
  const [showReplies, setShowReplies] = useState(true);

  return (
    <div className={`p-3 ${feedback.is_resolved ? 'bg-gray-50 opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-700">
              {feedback.author?.full_name || 'Unknown'}
            </span>
            {feedback.is_client_feedback && (
              <span className="px-1 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                Client
              </span>
            )}
            {feedback.feedback_type === 'revision_request' && !feedback.is_resolved && (
              <span className="px-1 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                Revision
              </span>
            )}
            {feedback.is_resolved && (
              <span className="px-1 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                Resolved
              </span>
            )}
          </div>

          {/* Highlighted text */}
          {feedback.highlighted_text && (
            <div className="mb-2 p-1.5 bg-yellow-50 border-l-2 border-yellow-400 text-xs text-gray-600 italic">
              "{feedback.highlighted_text}"
            </div>
          )}

          {/* Comment */}
          <p className="text-sm text-gray-700">{feedback.comment}</p>

          {/* Footer */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">
              {new Date(feedback.created_at).toLocaleDateString()}
            </span>
            {!feedback.is_resolved && feedback.feedback_type === 'revision_request' && (
              <button
                onClick={() => onResolve(feedback.id)}
                disabled={isResolving}
                className="text-xs text-green-600 hover:underline disabled:opacity-50"
              >
                Mark Resolved
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {feedback.replies && feedback.replies.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span className={`transform transition-transform ${showReplies ? 'rotate-90' : ''}`}>▶</span>
            {feedback.replies.length} {feedback.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && (
            <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
              {feedback.replies.map((reply) => (
                <div key={reply.id} className="text-xs">
                  <span className="font-medium text-gray-700">
                    {reply.author?.full_name || 'Unknown'}
                  </span>
                  <p className="text-gray-600 mt-0.5">{reply.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
