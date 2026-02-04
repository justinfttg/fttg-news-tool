import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  getCommentCounts,
  type CreateCommentInput,
  type UpdateCommentInput,
  type ListCommentsParams,
} from '../services/proposal-comments.service';

// ---------------------------------------------------------------------------
// Comment Hooks
// ---------------------------------------------------------------------------

export function useProposalComments(
  proposalId: string | undefined,
  params?: ListCommentsParams
) {
  return useQuery({
    queryKey: ['proposalComments', proposalId, params],
    queryFn: () => getComments(proposalId!, params),
    enabled: !!proposalId,
  });
}

export function useCommentCounts(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['commentCounts', proposalId],
    queryFn: () => getCommentCounts(proposalId!),
    enabled: !!proposalId,
  });
}

export function useCreateComment(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(proposalId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalComments', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['commentCounts', proposalId] });
    },
  });
}

export function useUpdateComment(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, ...input }: UpdateCommentInput & { commentId: string }) =>
      updateComment(proposalId!, commentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalComments', proposalId] });
    },
  });
}

export function useDeleteComment(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(proposalId!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalComments', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['commentCounts', proposalId] });
    },
  });
}

export function useResolveComment(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => resolveComment(proposalId!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalComments', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['commentCounts', proposalId] });
    },
  });
}

export function useUnresolveComment(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => unresolveComment(proposalId!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalComments', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['commentCounts', proposalId] });
    },
  });
}
