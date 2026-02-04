import api from './api';
import type { ProductionWorkflowTemplate, MilestoneOffset, TimelineType } from '../types';

// ---------------------------------------------------------------------------
// Templates API
// ---------------------------------------------------------------------------

export interface ListTemplatesParams {
  projectId: string;
  timelineType?: TimelineType;
}

export async function getTemplates(params: ListTemplatesParams): Promise<ProductionWorkflowTemplate[]> {
  const { data } = await api.get<ProductionWorkflowTemplate[]>('/workflows/templates', {
    params,
  });
  return data;
}

export async function getTemplate(id: string): Promise<ProductionWorkflowTemplate> {
  const { data } = await api.get<ProductionWorkflowTemplate>(`/workflows/templates/${id}`);
  return data;
}

export interface CreateTemplateInput {
  projectId: string;
  name: string;
  description?: string;
  timelineType: TimelineType;
  isDefault?: boolean;
  milestoneOffsets: MilestoneOffset[];
}

export async function createTemplate(input: CreateTemplateInput): Promise<ProductionWorkflowTemplate> {
  const { data } = await api.post<ProductionWorkflowTemplate>('/workflows/templates', input);
  return data;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  timelineType?: TimelineType;
  isDefault?: boolean;
  milestoneOffsets?: MilestoneOffset[];
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<ProductionWorkflowTemplate> {
  const { data } = await api.patch<ProductionWorkflowTemplate>(`/workflows/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/workflows/templates/${id}`);
}

export async function setTemplateAsDefault(id: string): Promise<ProductionWorkflowTemplate> {
  const { data } = await api.post<ProductionWorkflowTemplate>(`/workflows/templates/${id}/default`);
  return data;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getDefaultTemplate(
  templates: ProductionWorkflowTemplate[],
  timelineType: TimelineType
): ProductionWorkflowTemplate | undefined {
  return templates.find((t) => t.timeline_type === timelineType && t.is_default);
}

export function formatDaysOffset(daysOffset: number): string {
  if (daysOffset === 0) return 'TX Day';
  if (daysOffset > 0) return `TX +${daysOffset} day${daysOffset !== 1 ? 's' : ''}`;
  return `TX ${daysOffset} day${daysOffset !== -1 ? 's' : ''}`;
}

export function calculateMilestoneDate(txDate: string, daysOffset: number): string {
  const date = new Date(txDate + 'T00:00:00');
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

export function previewMilestones(
  txDate: string,
  milestoneOffsets: MilestoneOffset[]
): Array<MilestoneOffset & { calculatedDate: string }> {
  return milestoneOffsets.map((offset) => ({
    ...offset,
    calculatedDate: calculateMilestoneDate(txDate, offset.days_offset),
  }));
}
