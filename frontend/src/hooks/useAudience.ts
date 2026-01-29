import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAudienceProfiles,
  createAudienceProfile,
  updateAudienceProfile,
  deleteAudienceProfile,
  CreateAudienceProfileInput,
  UpdateAudienceProfileInput,
} from '../services/audience.service';

export function useAudienceProfiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ['audienceProfiles', projectId],
    queryFn: () => getAudienceProfiles(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateAudienceProfile(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAudienceProfileInput) => createAudienceProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audienceProfiles', projectId] });
    },
  });
}

export function useUpdateAudienceProfile(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAudienceProfileInput & { id: string }) =>
      updateAudienceProfile(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audienceProfiles', projectId] });
    },
  });
}

export function useDeleteAudienceProfile(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAudienceProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audienceProfiles', projectId] });
    },
  });
}
