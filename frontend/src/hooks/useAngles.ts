import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateAngle,
  getAngles,
  getAngle,
  updateAngleStatus,
  deleteAngle,
  GenerateAngleParams,
} from '../services/angle.service';

export function useAngles(projectId: string, storyId?: string) {
  return useQuery({
    queryKey: ['angles', projectId, storyId],
    queryFn: () => getAngles(projectId, storyId),
    enabled: !!projectId,
  });
}

export function useAngle(id: string | undefined) {
  return useQuery({
    queryKey: ['angle', id],
    queryFn: () => getAngle(id!),
    enabled: !!id,
  });
}

export function useGenerateAngle(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GenerateAngleParams) => generateAngle(params),
    onSuccess: (data) => {
      // Invalidate angles list
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      // Also invalidate the specific story's angles
      if (data.angle.news_story_id) {
        queryClient.invalidateQueries({
          queryKey: ['angles', projectId, data.angle.news_story_id],
        });
      }
    },
  });
}

export function useUpdateAngleStatus(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'approved' | 'archived' }) =>
      updateAngleStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      queryClient.invalidateQueries({ queryKey: ['angle', variables.id] });
    },
  });
}

export function useDeleteAngle(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAngle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
    },
  });
}
