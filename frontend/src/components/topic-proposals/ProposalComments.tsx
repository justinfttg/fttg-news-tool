import { useState } from 'react';
import {
  MessageSquare,
  Send,
  Reply,
  Check,
  Undo2,
  Trash2,
  AlertCircle,
  User,
} from 'lucide-react';
import {
  useProposalComments,
  useCreateComment,
  useDeleteComment,
  useResolveComment,
  useUnresolveComment,
} from '../../hooks/useProposalComments';
import {
  getCommentTypeLabel,
  formatCommentDate,
} from '../../services/proposal-comments.service';
import type { ProposalComment, CommentType } from '../../types';

interface ProposalCommentsProps {
  proposalId: string;
  currentUserId: string;
}

export default function ProposalComments({ proposalId, currentUserId }: ProposalCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('internal');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const { data: comments = [], isLoading } = useProposalComments(proposalId);
  const createComment = useCreateComment(proposalId);
  const deleteComment = useDeleteComment(proposalId);
  const resolveComment = useResolveComment(proposalId);
  const unresolveComment = useUnresolveComment(proposalId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({
        content: newComment.trim(),
        commentType,
      });
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleReply = async (parentCommentId: string) => {
    if (!replyContent.trim()) return;

    try {
      await createComment.mutateAsync({
        content: replyContent.trim(),
        parentCommentId,
        commentType: 'internal',
      });
      setReplyingTo(null);
      setReplyContent('');
    } catch (error) {
      console.error('Failed to reply:', error);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await resolveComment.mutateAsync(commentId);
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  const handleUnresolve = async (commentId: string) => {
    try {
      await unresolveComment.mutateAsync(commentId);
    } catch (error) {
      console.error('Failed to unresolve comment:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const getTypeColorClass = (type: CommentType) => {
    switch (type) {
      case 'internal':
        return 'bg-gray-100 text-gray-700';
      case 'client_feedback':
        return 'bg-blue-100 text-blue-700';
      case 'revision_request':
        return 'bg-orange-100 text-orange-700';
    }
  };

  const renderComment = (comment: ProposalComment, isReply = false) => (
    <div
      key={comment.id}
      className={`${isReply ? 'ml-8 mt-3' : ''} ${
        comment.is_resolved ? 'opacity-60' : ''
      }`}
    >
      <div
        className={`border rounded-lg overflow-hidden ${
          comment.comment_type === 'revision_request' && !comment.is_resolved
            ? 'border-orange-200 bg-orange-50/50'
            : 'border-gray-200'
        }`}
      >
        <div className="px-4 py-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">
                    {comment.author?.full_name || 'Unknown User'}
                  </span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getTypeColorClass(comment.comment_type)}`}>
                    {getCommentTypeLabel(comment.comment_type)}
                  </span>
                  {comment.is_resolved && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3 h-3" />
                      Resolved
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatCommentDate(comment.created_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {comment.comment_type === 'revision_request' && (
                <>
                  {comment.is_resolved ? (
                    <button
                      onClick={() => handleUnresolve(comment.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="Unresolve"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResolve(comment.id)}
                      className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                      title="Mark as resolved"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
              {!isReply && (
                <button
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Reply"
                >
                  <Reply className="w-4 h-4" />
                </button>
              )}
              {comment.author_user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <p className="text-gray-700 mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>

          {/* Reply input */}
          {replyingTo === comment.id && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReply(comment.id);
                    }
                  }}
                />
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={!replyContent.trim() || createComment.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Comment</label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type:</label>
            <select
              value={commentType}
              onChange={(e) => setCommentType(e.target.value as CommentType)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
            >
              <option value="internal">Internal</option>
              <option value="client_feedback">Client Feedback</option>
              <option value="revision_request">Revision Request</option>
            </select>
            {commentType === 'revision_request' && (
              <span className="flex items-center gap-1 text-xs text-orange-600">
                <AlertCircle className="w-3 h-3" />
                Requires resolution
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!newComment.trim() || createComment.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createComment.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Post Comment
              </>
            )}
          </button>
        </div>
      </form>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No comments yet</p>
        </div>
      ) : (
        <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
      )}
    </div>
  );
}
