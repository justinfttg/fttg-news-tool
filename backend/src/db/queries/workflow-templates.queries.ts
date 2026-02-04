import { supabase } from '../client';
import type { ProductionWorkflowTemplate, MilestoneOffset, TimelineType } from '../../types';

// ---------------------------------------------------------------------------
// Column selection (single source of truth)
// ---------------------------------------------------------------------------

const TEMPLATE_COLUMNS = `
  id, project_id, name, description, timeline_type, is_default,
  milestone_offsets, created_at, updated_at
`;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateTemplateInput {
  projectId: string;
  name: string;
  description?: string;
  timelineType: TimelineType;
  isDefault?: boolean;
  milestoneOffsets: MilestoneOffset[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  timelineType?: TimelineType;
  isDefault?: boolean;
  milestoneOffsets?: MilestoneOffset[];
}

// ---------------------------------------------------------------------------
// Default Templates
// ---------------------------------------------------------------------------

/**
 * Default 7-day normal production workflow
 * TX date is Friday, milestones work backwards
 */
export const DEFAULT_NORMAL_WORKFLOW: MilestoneOffset[] = [
  {
    milestone_type: 'topic_confirmation',
    days_offset: -7,
    time: '11:00',
    label: 'Topic Confirmation',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'script_deadline',
    days_offset: -5,
    time: '18:00',
    label: 'Script Development',
    is_client_facing: false,
    requires_client_approval: false,
  },
  {
    milestone_type: 'script_approval',
    days_offset: -4,
    time: '12:00',
    label: 'Script Approval',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'production_day',
    days_offset: -3,
    time: '09:00',
    label: 'Production Day',
    is_client_facing: false,
    requires_client_approval: false,
  },
  {
    milestone_type: 'post_production',
    days_offset: -3,
    time: '14:00',
    label: 'Post-Production',
    is_client_facing: false,
    requires_client_approval: false,
  },
  {
    milestone_type: 'draft_1_review',
    days_offset: -2,
    time: '14:00',
    label: 'Draft 1 Review',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'draft_2_review',
    days_offset: -1,
    time: '14:00',
    label: 'Draft 2 Review',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'final_delivery',
    days_offset: -1,
    time: '18:00',
    label: 'Final Delivery',
    is_client_facing: true,
    requires_client_approval: false,
  },
];

/**
 * Breaking news 3-day fast-track workflow
 */
export const DEFAULT_BREAKING_NEWS_WORKFLOW: MilestoneOffset[] = [
  {
    milestone_type: 'topic_approval',
    days_offset: -3,
    time: '12:00',
    label: 'Topic Approval',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'script_approval',
    days_offset: -2,
    time: '18:00',
    label: 'Script Approval',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'production_day',
    days_offset: -2,
    time: '09:00',
    label: 'Remote Production',
    is_client_facing: false,
    requires_client_approval: false,
  },
  {
    milestone_type: 'final_delivery',
    days_offset: 0,
    time: '12:00',
    label: 'Final Delivery',
    is_client_facing: true,
    requires_client_approval: false,
  },
];

/**
 * Emergency same-day workflow
 */
export const DEFAULT_EMERGENCY_WORKFLOW: MilestoneOffset[] = [
  {
    milestone_type: 'topic_approval',
    days_offset: 0,
    time: '09:00',
    label: 'Topic Approval',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'script_approval',
    days_offset: 0,
    time: '12:00',
    label: 'Script Approval',
    is_client_facing: true,
    requires_client_approval: true,
  },
  {
    milestone_type: 'final_delivery',
    days_offset: 0,
    time: '18:00',
    label: 'Final Delivery',
    is_client_facing: true,
    requires_client_approval: false,
  },
];

// ---------------------------------------------------------------------------
// Template Queries
// ---------------------------------------------------------------------------

/**
 * Get all templates for a project
 */
export async function getTemplates(
  projectId: string,
  timelineType?: TimelineType
): Promise<ProductionWorkflowTemplate[]> {
  let query = supabase
    .from('production_workflow_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('project_id', projectId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (timelineType) {
    query = query.eq('timeline_type', timelineType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ProductionWorkflowTemplate[];
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  id: string
): Promise<ProductionWorkflowTemplate | null> {
  const { data, error } = await supabase
    .from('production_workflow_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    return null;
  }

  return data as ProductionWorkflowTemplate;
}

/**
 * Get the default template for a project and timeline type
 */
export async function getDefaultTemplate(
  projectId: string,
  timelineType: TimelineType
): Promise<ProductionWorkflowTemplate | null> {
  const { data, error } = await supabase
    .from('production_workflow_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('project_id', projectId)
    .eq('timeline_type', timelineType)
    .eq('is_default', true)
    .single();

  if (error) {
    return null;
  }

  return data as ProductionWorkflowTemplate;
}

/**
 * Create a template
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<ProductionWorkflowTemplate> {
  // If this template should be default, unset other defaults first
  if (input.isDefault) {
    await unsetDefaultTemplates(input.projectId, input.timelineType);
  }

  const { data, error } = await supabase
    .from('production_workflow_templates')
    .insert({
      project_id: input.projectId,
      name: input.name,
      description: input.description || null,
      timeline_type: input.timelineType,
      is_default: input.isDefault ?? false,
      milestone_offsets: input.milestoneOffsets,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create template');
  }

  return data as ProductionWorkflowTemplate;
}

/**
 * Update a template
 */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<ProductionWorkflowTemplate> {
  // Get current template to check timeline type
  const current = await getTemplateById(id);
  if (!current) {
    throw new Error('Template not found');
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    const timelineType = input.timelineType || current.timeline_type;
    await unsetDefaultTemplates(current.project_id, timelineType, id);
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.timelineType !== undefined) payload.timeline_type = input.timelineType;
  if (input.isDefault !== undefined) payload.is_default = input.isDefault;
  if (input.milestoneOffsets !== undefined) payload.milestone_offsets = input.milestoneOffsets;

  const { data, error } = await supabase
    .from('production_workflow_templates')
    .update(payload)
    .eq('id', id)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update template');
  }

  return data as ProductionWorkflowTemplate;
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('production_workflow_templates')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Set a template as the default for its timeline type
 */
export async function setTemplateAsDefault(id: string): Promise<ProductionWorkflowTemplate> {
  const template = await getTemplateById(id);
  if (!template) {
    throw new Error('Template not found');
  }

  // Unset other defaults
  await unsetDefaultTemplates(template.project_id, template.timeline_type, id);

  // Set this one as default
  return updateTemplate(id, { isDefault: true });
}

/**
 * Unset default flag for all templates of a timeline type
 */
async function unsetDefaultTemplates(
  projectId: string,
  timelineType: TimelineType,
  excludeId?: string
): Promise<void> {
  let query = supabase
    .from('production_workflow_templates')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('timeline_type', timelineType)
    .eq('is_default', true);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Ensure default templates exist for a project
 * Creates them if they don't exist
 */
export async function ensureDefaultTemplates(
  projectId: string
): Promise<ProductionWorkflowTemplate[]> {
  const existing = await getTemplates(projectId);
  const created: ProductionWorkflowTemplate[] = [];

  // Check for normal workflow
  const hasNormal = existing.some((t) => t.timeline_type === 'normal');
  if (!hasNormal) {
    const normalTemplate = await createTemplate({
      projectId,
      name: 'Standard 7-Day Workflow',
      description: 'Default production workflow with 7-day lead time before TX',
      timelineType: 'normal',
      isDefault: true,
      milestoneOffsets: DEFAULT_NORMAL_WORKFLOW,
    });
    created.push(normalTemplate);
  }

  // Check for breaking news workflow
  const hasBreaking = existing.some((t) => t.timeline_type === 'breaking_news');
  if (!hasBreaking) {
    const breakingTemplate = await createTemplate({
      projectId,
      name: 'Breaking News 3-Day',
      description: 'Fast-track workflow for breaking news with 3-day lead time',
      timelineType: 'breaking_news',
      isDefault: true,
      milestoneOffsets: DEFAULT_BREAKING_NEWS_WORKFLOW,
    });
    created.push(breakingTemplate);
  }

  // Check for emergency workflow
  const hasEmergency = existing.some((t) => t.timeline_type === 'emergency');
  if (!hasEmergency) {
    const emergencyTemplate = await createTemplate({
      projectId,
      name: 'Emergency Same-Day',
      description: 'Same-day turnaround for urgent content',
      timelineType: 'emergency',
      isDefault: true,
      milestoneOffsets: DEFAULT_EMERGENCY_WORKFLOW,
    });
    created.push(emergencyTemplate);
  }

  return created;
}

/**
 * Get or create the default template for a timeline type
 */
export async function getOrCreateDefaultTemplate(
  projectId: string,
  timelineType: TimelineType
): Promise<ProductionWorkflowTemplate> {
  // Try to get existing default
  const existing = await getDefaultTemplate(projectId, timelineType);
  if (existing) {
    return existing;
  }

  // Create default based on timeline type
  const defaultOffsets =
    timelineType === 'normal'
      ? DEFAULT_NORMAL_WORKFLOW
      : timelineType === 'breaking_news'
      ? DEFAULT_BREAKING_NEWS_WORKFLOW
      : DEFAULT_EMERGENCY_WORKFLOW;

  const defaultName =
    timelineType === 'normal'
      ? 'Standard 7-Day Workflow'
      : timelineType === 'breaking_news'
      ? 'Breaking News 3-Day'
      : 'Emergency Same-Day';

  return createTemplate({
    projectId,
    name: defaultName,
    timelineType,
    isDefault: true,
    milestoneOffsets: defaultOffsets,
  });
}
