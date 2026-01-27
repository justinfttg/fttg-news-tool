import { Request, Response } from 'express';
import { supabase } from '../../src/db/client';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  const projectId = req.query.projectId as string;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!projectId) {
    return res.status(400).json({ error: 'projectId query parameter required' });
  }

  try {
    // Get members with their user details
    // Supabase supports foreign key joins via !inner or (table)
    const { data: members, error } = await supabase
      .from('project_members')
      .select('*, users!inner(email, full_name)')
      .eq('project_id', projectId)
      .order('role', { ascending: true })
      .order('invited_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    // Flatten the nested user data
    const result = (members || []).map((m: any) => ({
      ...m,
      email: m.users?.email,
      full_name: m.users?.full_name,
      users: undefined,
    }));

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch members';
    return res.status(500).json({ error: message });
  }
}
