import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';

const InviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
  canCreateStories: z.boolean().default(true),
  canApproveStories: z.boolean().default(false),
  canGenerateScripts: z.boolean().default(false),
  canInviteMembers: z.boolean().default(false),
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = InviteSchema.parse(req.body);

    // Verify inviter is owner or has invite permission
    const { data: inviter } = await supabase
      .from('project_members')
      .select('role, can_invite_members')
      .eq('project_id', input.projectId)
      .eq('user_id', userId)
      .single();

    if (!inviter || (inviter.role !== 'owner' && !inviter.can_invite_members)) {
      return res.status(403).json({ error: 'No permission to invite members' });
    }

    // Find user by email
    const { data: invitee } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.email)
      .single();

    if (!invitee) {
      return res.status(404).json({ error: 'User not found. They must register first.' });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', input.projectId)
      .eq('user_id', invitee.id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    const { data: member, error } = await supabase
      .from('project_members')
      .insert({
        project_id: input.projectId,
        user_id: invitee.id,
        role: input.role,
        can_create_stories: input.canCreateStories,
        can_approve_stories: input.canApproveStories,
        can_generate_scripts: input.canGenerateScripts,
        can_invite_members: input.canInviteMembers,
        invited_by_user_id: userId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Failed to invite member';
    return res.status(500).json({ error: message });
  }
}
