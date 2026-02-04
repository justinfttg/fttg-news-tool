import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateAsDefault,
  type ListTemplatesParams,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from '../services/workflow-templates.service';

// ---------------------------------------------------------------------------
// Template Hooks
// ---------------------------------------------------------------------------

export function useWorkflowTemplates(params: ListTemplatesParams | undefined) {
  return useQuery({
    queryKey: ['workflowTemplates', params],
    queryFn: () => getTemplates(params!),
    enabled: !!params?.projectId,
  });
}

export function useWorkflowTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['workflowTemplate', id],
    queryFn: () => getTemplate(id!),
    enabled: !!id,
  });
}

export function useCreateWorkflowTemplate(_projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTemplateInput) => createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
    },
  });
}

export function useUpdateWorkflowTemplate(_projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTemplateInput & { id: string }) =>
      updateTemplate(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplate', data.id] });
    },
  });
}

export function useDeleteWorkflowTemplate(_projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
    },
  });
}

export function useSetTemplateAsDefault(_projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setTemplateAsDefault,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
    },
  });
}
