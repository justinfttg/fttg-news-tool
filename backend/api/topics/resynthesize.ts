import { Request, Response } from 'express';
import { supabase } from '../../src/db/client';
import {
  getTopicProposalById,
  updateTopicProposal,
} from '../../src/db/queries/topic-proposals.queries';
import { generateTopicProposal } from '../../src/services/ai/topic-generator';
import { findResearchCitations } from '../../src/services/ai/research-finder';
import type { AudienceProfile, NewsStory, TopicCluster } from '../../src/types';

// ============================================================================
// Helpers
// ============================================================================

async function verifyMembership(
  projectId: string,
  userId: string
): Promise<{ role: string } | null> {
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data;
}

// ============================================================================
// POST /api/topics/proposals/:id/resynthesize
// ============================================================================

export async function resynthesizeHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const proposalId = req.params.id;
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID required' });
    }

    const existing = await getTopicProposalById(proposalId);
    if (!existing) {
      return res.status(404).json({ error: 'Topic proposal not found' });
    }

    // Verify project membership
    const member = await verifyMembership(existing.project_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Viewers cannot resynthesize
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot edit topic proposals' });
    }

    // Fetch source stories
    let stories: NewsStory[] = [];
    if (existing.source_story_ids && existing.source_story_ids.length > 0) {
      const { data: storiesData } = await supabase
        .from('news_stories')
        .select('*')
        .in('id', existing.source_story_ids);

      stories = (storiesData || []) as NewsStory[];
    }

    if (stories.length === 0) {
      return res.status(400).json({ error: 'No source stories available for re-synthesis' });
    }

    // Fetch audience profile
    let audienceProfile: AudienceProfile | undefined;
    if (existing.audience_profile_id) {
      const { data: audienceData } = await supabase
        .from('audience_profiles')
        .select('*')
        .eq('id', existing.audience_profile_id)
        .single();

      if (audienceData) {
        audienceProfile = audienceData as AudienceProfile;
      }
    }

    if (!audienceProfile) {
      // Try to get the default audience profile for the project
      const { data: defaultProfile } = await supabase
        .from('audience_profiles')
        .select('*')
        .eq('project_id', existing.project_id)
        .limit(1)
        .single();

      if (defaultProfile) {
        audienceProfile = defaultProfile as AudienceProfile;
      }
    }

    if (!audienceProfile) {
      return res.status(400).json({ error: 'No audience profile available for re-synthesis' });
    }

    // Create a cluster from existing data
    const cluster: TopicCluster = {
      theme: existing.cluster_theme || existing.title,
      keywords: existing.cluster_keywords || [],
      story_ids: existing.source_story_ids,
      relevance_score: 1.0,
      audience_relevance: existing.audience_care_statement || undefined,
    };

    console.log('[resynthesize] Generating new proposal content for:', existing.title);

    // Generate new proposal content using AI
    const generatedProposal = await generateTopicProposal({
      cluster,
      stories,
      audienceProfile,
      durationType: existing.duration_type,
      durationSeconds: existing.duration_seconds,
      comparisonRegions: existing.comparison_regions || [],
      trendingContext: existing.trending_context || [],
    });

    // Find research citations for the new talking points
    let researchCitations = existing.research_citations || [];
    if (generatedProposal.research_suggestions && generatedProposal.research_suggestions.length > 0) {
      try {
        const newCitations = await findResearchCitations({
          topic: generatedProposal.title,
          queries: generatedProposal.research_suggestions,
          audienceRegion: audienceProfile.market_region ?? undefined,
          maxCitationsPerQuery: 2,
        });
        // Merge with existing citations, avoiding duplicates by URL
        const existingUrls = new Set(researchCitations.map((c) => c.url));
        for (const citation of newCitations) {
          if (!existingUrls.has(citation.url)) {
            researchCitations.push(citation);
          }
        }
      } catch (error) {
        console.warn('[resynthesize] Failed to find new research citations:', error);
        // Continue with existing citations
      }
    }

    // Update the proposal with new content
    const updatedProposal = await updateTopicProposal(proposalId, {
      title: generatedProposal.title,
      hook: generatedProposal.hook,
      audienceCareStatement: generatedProposal.audience_care_statement,
      talkingPoints: generatedProposal.talking_points,
      researchCitations,
    });

    // Fetch source stories for the response
    if (updatedProposal.source_story_ids && updatedProposal.source_story_ids.length > 0) {
      const { data: storiesForResponse } = await supabase
        .from('news_stories')
        .select('id, title, summary, source, url, category, published_at, thumbnail_url')
        .in('id', updatedProposal.source_story_ids);

      (updatedProposal as any).source_stories = storiesForResponse || [];
    }

    console.log('[resynthesize] Successfully re-synthesized proposal:', updatedProposal.id);

    return res.status(200).json({ proposal: updatedProposal });
  } catch (error) {
    console.error('[topics/proposals/:id/resynthesize] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to re-synthesize proposal';
    return res.status(500).json({ error: message });
  }
}
