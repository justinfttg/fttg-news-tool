import { Request, Response } from 'express';
import { supabase } from '../../src/db/client';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get project IDs where user is a member, along with their role
    const { data: memberships, error: memberError } = await supabase
      .from('project_members')
      .select('project_id, role')
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!memberships || memberships.length === 0) {
      return res.status(200).json([]);
    }

    const projectIds = memberships.map((m) => m.project_id);
    const roleMap = new Map(memberships.map((m) => [m.project_id, m.role]));

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    if (projectError) {
      throw new Error(projectError.message);
    }

    // Attach user_role to each project
    const result = (projects || []).map((p) => ({
      ...p,
      user_role: roleMap.get(p.id) || null,
    }));

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch projects';
    return res.status(500).json({ error: message });
  }
}
