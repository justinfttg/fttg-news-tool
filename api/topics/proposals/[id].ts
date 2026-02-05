import { cors } from '../../_cors';
import { withAuth } from '../../_auth';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client directly in this file
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Full column list including linked_episode_id
const PROPOSAL_COLUMNS = `
  id, project_id, created_by_user_id,
  title, hook, audience_care_statement,
  talking_points, research_citations,
  source_story_ids, cluster_theme, cluster_keywords,
  duration_type, duration_seconds,
  generation_trigger, audience_profile_id, comparison_regions, trending_context,
  status, review_notes,
  linked_episode_id, scheduled_tx_date,
  created_at, updated_at
`;

async function verifyMembership(projectId: string, userId: string) {
  const { data } = await supabase
    .from('project_members')
    .select('role, can_approve_stories')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  return data;
}

async function getProposalById(id: string) {
  const { data, error } = await supabase
    .from('topic_proposals')
    .select(`${PROPOSAL_COLUMNS}, audience_profiles(*)`)
    .eq('id', id)
    .single();

  if (error) return null;

  const { audience_profiles, ...rest } = data as any;
  return {
    ...rest,
    audience_profile: audience_profiles,
  };
}

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  const handler = async (req: any, res: any) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Proposal ID required' });
    }

    if (req.method === 'GET') {
      try {
        const proposal = await getProposalById(id);
        if (!proposal) {
          return res.status(404).json({ error: 'Topic proposal not found' });
        }

        const member = await verifyMembership(proposal.project_id, userId);
        if (!member) {
          return res.status(403).json({ error: 'Not a member of this project' });
        }

        // Fetch source stories
        if (proposal.source_story_ids && proposal.source_story_ids.length > 0) {
          const { data: stories } = await supabase
            .from('news_stories')
            .select('id, title, summary, source, url, category, published_at, thumbnail_url')
            .in('id', proposal.source_story_ids);
          (proposal as any).source_stories = stories || [];
        }

        return res.status(200).json({ proposal });
      } catch (error) {
        console.error('[topics/proposals/:id] Get error:', error);
        return res.status(500).json({ error: 'Failed to fetch topic proposal' });
      }
    }

    // For PATCH and DELETE, import from backend
    const { updateHandler, deleteHandler } = await import('../../../backend/api/topics/proposal-by-id');
    req.params = { id };

    if (req.method === 'PATCH') {
      return updateHandler(req, res);
    } else if (req.method === 'DELETE') {
      return deleteHandler(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  };

  return withAuth(handler)(req, res);
}
