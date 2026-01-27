import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject } from '../services/project.service';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
}

export function useCreateProject(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      options?.onSuccess?.();
    },
  });
}

export function useProject(projectId: string | undefined) {
  const { data: projects, ...rest } = useProjects();

  const project = projects?.find((p) => p.id === projectId) ?? null;

  return {
    data: project,
    ...rest,
  };
}
