import { supabase } from '../client';
import type { Project, ProjectMember } from '../../types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string;
  ownerOrgId: string | null;
  createdByUserId: string;
  postingFrequency?: Project['posting_frequency'];
  customFrequencyDays?: number;
  videoQuotaPerYear?: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  postingFrequency?: Project['posting_frequency'];
  customFrequencyDays?: number | null;
  videoQuotaPerYear?: number | null;
  startDate?: string;
  endDate?: string | null;
  status?: Project['status'];
}

export interface AddMemberInput {
  projectId: string;
  userId: string;
  invitedByUserId: string;
  role: ProjectMember['role'];
  canCreateStories?: boolean;
  canApproveStories?: boolean;
  canGenerateScripts?: boolean;
  canInviteMembers?: boolean;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Project with the requesting user's role attached. */
export interface ProjectWithRole extends Project {
  user_role: ProjectMember['role'];
}

/** Project member with user details from the join. */
export interface ProjectMemberWithUser extends ProjectMember {
  email: string;
  full_name: string | null;
}

// ---------------------------------------------------------------------------
// Column selections (single source of truth for select strings)
// ---------------------------------------------------------------------------

const PROJECT_COLUMNS = 'id, name, description, owner_org_id, created_by_user_id, posting_frequency, custom_frequency_days, video_quota_per_year, start_date, end_date, status, created_at, updated_at';

const MEMBER_COLUMNS = 'id, project_id, user_id, role, can_create_stories, can_approve_stories, can_generate_scripts, can_invite_members, invited_by_user_id, invited_at';

// ---------------------------------------------------------------------------
// 1. createProject
// ---------------------------------------------------------------------------

/**
 * Insert a new project and add the creator as the owner.
 * Returns the created project row.
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: input.name,
      description: input.description || null,
      owner_org_id: input.ownerOrgId,
      created_by_user_id: input.createdByUserId,
      posting_frequency: input.postingFrequency || 'weekly',
      custom_frequency_days: input.customFrequencyDays || null,
      video_quota_per_year: input.videoQuotaPerYear || null,
      start_date: input.startDate,
      end_date: input.endDate || null,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || 'Failed to create project');
  }

  // Auto-add creator as project owner with full permissions
  const { error: memberError } = await supabase
    .from('project_members')
    .insert({
      project_id: project.id,
      user_id: input.createdByUserId,
      role: 'owner',
      can_create_stories: true,
      can_approve_stories: true,
      can_generate_scripts: true,
      can_invite_members: true,
    });

  if (memberError) {
    // Non-fatal: project exists but membership failed. Log and continue.
    console.error('[project.queries] Failed to add creator as owner:', memberError.message);
  }

  return project as Project;
}

// ---------------------------------------------------------------------------
// 2. getProjectById
// ---------------------------------------------------------------------------

/**
 * Fetch a single project if the given user is a member.
 * Returns null when the project doesn't exist or user has no access.
 */
export async function getProjectById(
  id: string,
  userId: string
): Promise<ProjectWithRole | null> {
  // Verify membership and get role in one query
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return null;
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', id)
    .single();

  if (projectError || !project) {
    return null;
  }

  return { ...project, user_role: membership.role } as ProjectWithRole;
}

// ---------------------------------------------------------------------------
// 3. getProjectsByUserId
// ---------------------------------------------------------------------------

/**
 * List all non-archived projects where the user is a member.
 * Each project includes the user's role and permission flags.
 */
export async function getProjectsByUserId(
  userId: string
): Promise<ProjectWithRole[]> {
  // Get all memberships for this user
  const { data: memberships, error: memberError } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('user_id', userId);

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const projectIds = memberships.map((m) => m.project_id);
  const roleMap = new Map(memberships.map((m) => [m.project_id, m.role]));

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .in('id', projectIds)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (projectError) {
    throw new Error(projectError.message);
  }

  return (projects || []).map((p) => ({
    ...p,
    user_role: roleMap.get(p.id) || 'viewer',
  })) as ProjectWithRole[];
}

// ---------------------------------------------------------------------------
// 4. updateProject
// ---------------------------------------------------------------------------

/**
 * Update project fields. Only the project owner can update.
 * Throws if user is not the owner or if the project doesn't exist.
 */
export async function updateProject(
  id: string,
  userId: string,
  data: UpdateProjectInput
): Promise<Project> {
  // Verify user is the owner
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    throw new Error('Project not found or access denied');
  }

  if (membership.role !== 'owner') {
    throw new Error('Only the project owner can update project settings');
  }

  // Build the update payload — only include fields that were provided
  const updatePayload: Record<string, unknown> = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.postingFrequency !== undefined) updatePayload.posting_frequency = data.postingFrequency;
  if (data.customFrequencyDays !== undefined) updatePayload.custom_frequency_days = data.customFrequencyDays;
  if (data.videoQuotaPerYear !== undefined) updatePayload.video_quota_per_year = data.videoQuotaPerYear;
  if (data.startDate !== undefined) updatePayload.start_date = data.startDate;
  if (data.endDate !== undefined) updatePayload.end_date = data.endDate;
  if (data.status !== undefined) updatePayload.status = data.status;
  updatePayload.updated_at = new Date().toISOString();

  const { data: project, error: updateError } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)
    .select(PROJECT_COLUMNS)
    .single();

  if (updateError || !project) {
    throw new Error(updateError?.message || 'Failed to update project');
  }

  return project as Project;
}

// ---------------------------------------------------------------------------
// 5. deleteProject
// ---------------------------------------------------------------------------

/**
 * Delete a project. Only the project owner can delete.
 * CASCADE in the schema handles related project_members, calendar_items, etc.
 */
export async function deleteProject(
  id: string,
  userId: string
): Promise<void> {
  // Verify user is the owner
  const { data: membership, error: memberError } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    throw new Error('Project not found or access denied');
  }

  if (membership.role !== 'owner') {
    throw new Error('Only the project owner can delete the project');
  }

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

// ---------------------------------------------------------------------------
// 6. addProjectMember
// ---------------------------------------------------------------------------

/**
 * Add a new member to a project.
 * The inviter must be the owner or have the can_invite_members flag.
 * Returns the newly created project_member row.
 */
export async function addProjectMember(input: AddMemberInput): Promise<ProjectMember> {
  // Verify inviter has permission
  const { data: inviter, error: inviterError } = await supabase
    .from('project_members')
    .select('role, can_invite_members')
    .eq('project_id', input.projectId)
    .eq('user_id', input.invitedByUserId)
    .single();

  if (inviterError || !inviter) {
    throw new Error('Inviter is not a member of this project');
  }

  if (inviter.role !== 'owner' && !inviter.can_invite_members) {
    throw new Error('No permission to invite members');
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', input.projectId)
    .eq('user_id', input.userId)
    .single();

  if (existing) {
    throw new Error('User is already a member of this project');
  }

  // Set default permissions based on role
  const defaults = getDefaultPermissions(input.role);

  const { data: member, error: insertError } = await supabase
    .from('project_members')
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      role: input.role,
      can_create_stories: input.canCreateStories ?? defaults.canCreateStories,
      can_approve_stories: input.canApproveStories ?? defaults.canApproveStories,
      can_generate_scripts: input.canGenerateScripts ?? defaults.canGenerateScripts,
      can_invite_members: input.canInviteMembers ?? defaults.canInviteMembers,
      invited_by_user_id: input.invitedByUserId,
    })
    .select(MEMBER_COLUMNS)
    .single();

  if (insertError || !member) {
    throw new Error(insertError?.message || 'Failed to add project member');
  }

  return member as ProjectMember;
}

/**
 * Default permission flags per role.
 * Owners get everything; editors can create; viewers are read-only.
 */
function getDefaultPermissions(role: ProjectMember['role']) {
  switch (role) {
    case 'owner':
      return { canCreateStories: true, canApproveStories: true, canGenerateScripts: true, canInviteMembers: true };
    case 'editor':
      return { canCreateStories: true, canApproveStories: false, canGenerateScripts: false, canInviteMembers: false };
    case 'viewer':
      return { canCreateStories: false, canApproveStories: false, canGenerateScripts: false, canInviteMembers: false };
  }
}

// ---------------------------------------------------------------------------
// 7. getProjectMembers
// ---------------------------------------------------------------------------

/**
 * List all members of a project with their user details (email, full_name).
 * Sorted by role (owner first) then by invited_at.
 */
export async function getProjectMembers(
  projectId: string
): Promise<ProjectMemberWithUser[]> {
  const { data: members, error } = await supabase
    .from('project_members')
    .select(`${MEMBER_COLUMNS}, users!inner(email, full_name)`)
    .eq('project_id', projectId)
    .order('role', { ascending: true })
    .order('invited_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  // Flatten the nested users join into the top-level object
  return (members || []).map((m: any) => ({
    id: m.id,
    project_id: m.project_id,
    user_id: m.user_id,
    role: m.role,
    can_create_stories: m.can_create_stories,
    can_approve_stories: m.can_approve_stories,
    can_generate_scripts: m.can_generate_scripts,
    can_invite_members: m.can_invite_members,
    invited_by_user_id: m.invited_by_user_id,
    invited_at: m.invited_at,
    email: m.users?.email ?? '',
    full_name: m.users?.full_name ?? null,
  })) as ProjectMemberWithUser[];
}
