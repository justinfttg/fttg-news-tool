import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/client';

interface ProjectMember {
  id: string;
  role: string;
  can_create_stories: boolean;
  can_approve_stories: boolean;
  can_generate_scripts: boolean;
  can_invite_members: boolean;
}

declare global {
  namespace Express {
    interface Request {
      projectMember?: ProjectMember;
    }
  }
}

export function projectMemberMiddleware(requiredPermission?: keyof Omit<ProjectMember, 'id' | 'role'>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId || req.body.project_id;
    const userId = req.user?.userId;

    if (!projectId || !userId) {
      res.status(400).json({ error: 'Project ID and authentication required' });
      return;
    }

    const { data: member, error } = await supabase
      .from('project_members')
      .select('id, role, can_create_stories, can_approve_stories, can_generate_scripts, can_invite_members')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }

    if (requiredPermission && !member[requiredPermission] && member.role !== 'owner') {
      res.status(403).json({ error: `Permission denied: ${requiredPermission}` });
      return;
    }

    req.projectMember = member;
    next();
  };
}
