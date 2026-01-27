import api from './api';
import { Project, ProjectMember } from '../types';

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects/list');
  return data;
}

export async function createProject(input: {
  name: string;
  description?: string;
  postingFrequency: string;
  customFrequencyDays?: number;
  videoQuotaPerYear?: number;
  startDate: string;
  endDate?: string;
}): Promise<Project> {
  const { data } = await api.post<Project>('/projects/create', input);
  return data;
}

export async function inviteMember(input: {
  projectId: string;
  email: string;
  role: 'editor' | 'viewer';
  canCreateStories?: boolean;
  canApproveStories?: boolean;
  canGenerateScripts?: boolean;
  canInviteMembers?: boolean;
}): Promise<ProjectMember> {
  const { data } = await api.post<ProjectMember>('/projects/invite', input);
  return data;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data } = await api.get<ProjectMember[]>(`/projects/members?projectId=${projectId}`);
  return data;
}
