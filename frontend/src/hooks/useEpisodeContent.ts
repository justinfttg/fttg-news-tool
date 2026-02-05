import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEpisodeContent,
  saveContentVersion,
  submitContentForReview,
  approveContent,
  lockContent,
  getContentFeedback,
  addContentFeedback,
  resolveFeedback,
  type ContentType,
  type FeedbackType,
} from '../services/episode-content.service';

// ============================================================================
// Query Keys
// ============================================================================

export const episodeContentKeys = {
  all: ['episodeContent'] as const,
  content: (episodeId: string, contentType: ContentType) =>
    [...episodeContentKeys.all, 'content', episodeId, contentType] as const,
  feedback: (episodeId: string, contentType: ContentType, versionId?: string) =>
    [...episodeContentKeys.all, 'feedback', episodeId, contentType, versionId] as const,
};

// ============================================================================
// Content Hooks
// ============================================================================

export function useEpisodeContent(episodeId: string | undefined, contentType: ContentType) {
  return useQuery({
    queryKey: episodeContentKeys.content(episodeId || '', contentType),
    queryFn: () => getEpisodeContent(episodeId!, contentType),
    enabled: !!episodeId,
  });
}

export function useSaveContentVersion(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { title?: string; body: string; changeSummary?: string }) =>
      saveContentVersion(episodeId, contentType, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}

export function useSubmitForReview(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => submitContentForReview(episodeId, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}

export function useApproveContent(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => approveContent(episodeId, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}

export function useLockContent(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => lockContent(episodeId, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}

// ============================================================================
// Feedback Hooks
// ============================================================================

export function useContentFeedback(
  episodeId: string | undefined,
  contentType: ContentType,
  versionId?: string
) {
  return useQuery({
    queryKey: episodeContentKeys.feedback(episodeId || '', contentType, versionId),
    queryFn: () => getContentFeedback(episodeId!, contentType, versionId),
    enabled: !!episodeId,
  });
}

export function useAddFeedback(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      versionId: string;
      comment: string;
      feedbackType?: FeedbackType;
      highlightStart?: number;
      highlightEnd?: number;
      highlightedText?: string;
      parentFeedbackId?: string;
      isClientFeedback?: boolean;
    }) => addContentFeedback(episodeId, contentType, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.feedback(episodeId, contentType),
      });
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}

export function useResolveFeedback(episodeId: string, contentType: ContentType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackId: string) => resolveFeedback(episodeId, contentType, feedbackId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.feedback(episodeId, contentType),
      });
      queryClient.invalidateQueries({
        queryKey: episodeContentKeys.content(episodeId, contentType),
      });
    },
  });
}
