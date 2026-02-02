import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getTopicProposals,
  createTopicProposal,
  getFlaggedStoriesForClustering,
  getTopicGeneratorSettings,
  getCachedClusters,
  saveClustersCache,
  findSimilarProposals,
} from '../../src/db/queries/topic-proposals.queries';
import { getAudienceProfileById } from '../../src/db/queries/audience.queries';
import {
  clusterStoriesByTheme,
  generateTopicProposal,
  generateStoriesHash,
  generateTrendsHash,
} from '../../src/services/ai/topic-generator';
import { findResearchCitations, deduplicateCitations } from '../../src/services/ai/research-finder';
import { getWatchedTrends, getViralPostsFromDB } from '../../src/db/queries/social-listener.queries';
import type { TrendingContext, TopicCluster, NewsStory } from '../../src/types';

// ============================================================================
// Schemas
// ============================================================================

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['draft', 'reviewed', 'approved', 'rejected', 'archived']).optional(),
  audienceProfileId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const GenerateSchema = z.object({
  projectId: z.string().uuid(),
  audienceProfileId: z.string().uuid(),
  durationType: z.enum(['short', 'standard', 'long', 'custom']),
  durationSeconds: z.number().min(60).max(900).optional(),
  comparisonRegions: z.array(z.string()).optional(),
  clusterIds: z.array(z.number()).optional(), // Optional: generate only from specific clusters
  maxProposals: z.number().min(1).max(10).optional(),
});

const PreviewClustersSchema = z.object({
  projectId: z.string().uuid(),
  audienceProfileId: z.string().uuid(),
  forceRefresh: z.boolean().optional(),
});

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

function getDurationSeconds(type: string, customSeconds?: number): number {
  switch (type) {
    case 'short': return 90;
    case 'standard': return 180;
    case 'long': return 420;
    case 'custom': return customSeconds || 180;
    default: return 180;
  }
}

async function buildTrendingContext(projectId: string, userId: string): Promise<TrendingContext[]> {
  try {
    const watchedTrends = await getWatchedTrends(projectId, userId);
    if (watchedTrends.length === 0) return [];

    const viralPosts = await getViralPostsFromDB({ limit: 50 });

    return watchedTrends.slice(0, 5).map(trend => {
      const relatedPosts = viralPosts
        .filter(post => {
          const content = post.content.toLowerCase();
          const query = trend.query.toLowerCase().replace(/^#/, '');
          return content.includes(query) ||
                 post.hashtags.some((h: string) => h.toLowerCase().includes(query));
        })
        .slice(0, 3)
        .map(post => ({
          platform: post.platform,
          content: post.content,
          engagement_score: post.engagement_score,
          post_url: post.post_url || undefined,
        }));

      return {
        trend_query: trend.query,
        platforms: trend.platforms as string[],
        viral_posts: relatedPosts,
      };
    });
  } catch (error) {
    console.warn('[topics/proposals] Could not build trending context:', error);
    return [];
  }
}

// ============================================================================
// GET /api/topics/proposals - List proposals
// ============================================================================

export async function listHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = ListQuerySchema.parse(req.query);

    const member = await verifyMembership(query.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const proposals = await getTopicProposals(query.projectId, {
      status: query.status,
      audienceProfileId: query.audienceProfileId,
      limit: query.limit,
      offset: query.offset,
    });

    return res.status(200).json({ proposals });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/proposals] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch topic proposals' });
  }
}

// ============================================================================
// POST /api/topics/proposals/generate - Generate proposals
// ============================================================================

export async function generateHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = GenerateSchema.parse(req.body);

    // Verify project membership
    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Fetch audience profile
    const audienceProfile = await getAudienceProfileById(input.audienceProfileId);
    if (!audienceProfile) {
      return res.status(404).json({ error: 'Audience profile not found' });
    }

    // Get settings for this project (or use defaults)
    const settings = await getTopicGeneratorSettings(input.projectId);
    const timeWindowDays = settings?.time_window_days || 7;
    const maxProposals = input.maxProposals || settings?.max_proposals_per_run || 5;
    const comparisonRegions = input.comparisonRegions || settings?.comparison_regions || [];

    // Fetch flagged stories
    const stories = await getFlaggedStoriesForClustering(input.projectId, userId, {
      timeWindowDays,
      focusCategories: settings?.focus_categories || [],
      limit: 50,
    });

    if (stories.length < 2) {
      return res.status(400).json({
        error: 'Not enough flagged stories',
        message: `Found ${stories.length} flagged stories. Need at least 2 to cluster.`,
      });
    }

    // Build trending context
    const trendingContext = settings?.include_trending_context !== false
      ? await buildTrendingContext(input.projectId, userId)
      : [];

    // Cluster stories by theme
    const clusters = await clusterStoriesByTheme({
      stories,
      audienceProfile,
      trendingContext,
    });

    if (clusters.length === 0) {
      return res.status(400).json({
        error: 'No clusters found',
        message: 'Could not identify meaningful themes from the flagged stories.',
      });
    }

    // Filter to specific clusters if requested
    const clustersToProcess = input.clusterIds
      ? clusters.filter((_, i) => input.clusterIds!.includes(i))
      : clusters;

    // Calculate duration
    const durationSeconds = getDurationSeconds(input.durationType, input.durationSeconds);

    // Generate proposals for each cluster (up to maxProposals)
    const generatedProposals = [];

    for (const cluster of clustersToProcess.slice(0, maxProposals)) {
      try {
        // Get full story data for this cluster
        const clusterStories = stories.filter(s => cluster.story_ids.includes(s.id)) as unknown as NewsStory[];

        // Generate the proposal
        const generated = await generateTopicProposal({
          cluster,
          stories: clusterStories,
          audienceProfile,
          durationType: input.durationType,
          durationSeconds,
          comparisonRegions: comparisonRegions as string[],
          trendingContext,
        });

        // Find research citations based on AI suggestions
        const citations = await findResearchCitations({
          topic: cluster.theme,
          queries: generated.research_suggestions || [],
          audienceRegion: audienceProfile.market_region || undefined,
          maxCitationsPerQuery: 2,
        });

        // Save the proposal
        const proposal = await createTopicProposal({
          projectId: input.projectId,
          createdByUserId: userId,
          title: generated.title,
          hook: generated.hook,
          audienceCareStatement: generated.audience_care_statement,
          talkingPoints: generated.talking_points,
          researchCitations: deduplicateCitations(citations),
          sourceStoryIds: cluster.story_ids,
          clusterTheme: cluster.theme,
          clusterKeywords: cluster.keywords,
          durationType: input.durationType,
          durationSeconds,
          generationTrigger: 'manual',
          audienceProfileId: input.audienceProfileId,
          comparisonRegions: comparisonRegions as string[],
          trendingContext,
        });

        generatedProposals.push(proposal);
      } catch (error) {
        console.error(`[topics/proposals] Failed to generate proposal for cluster "${cluster.theme}":`, error);
        // Continue with other clusters
      }
    }

    if (generatedProposals.length === 0) {
      return res.status(500).json({ error: 'Failed to generate any proposals' });
    }

    return res.status(201).json({
      proposals: generatedProposals,
      clustersProcessed: clustersToProcess.length,
      totalClusters: clusters.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/proposals] Generate error:', error);
    return res.status(500).json({ error: 'Failed to generate topic proposals' });
  }
}

// ============================================================================
// POST /api/topics/preview-clusters - Preview clusters without generating
// ============================================================================

export async function previewClustersHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = PreviewClustersSchema.parse(req.body);

    // Verify project membership
    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Fetch audience profile
    const audienceProfile = await getAudienceProfileById(input.audienceProfileId);
    if (!audienceProfile) {
      return res.status(404).json({ error: 'Audience profile not found' });
    }

    // Get settings
    const settings = await getTopicGeneratorSettings(input.projectId);

    // Fetch flagged stories
    const stories = await getFlaggedStoriesForClustering(input.projectId, userId, {
      timeWindowDays: settings?.time_window_days || 7,
      focusCategories: settings?.focus_categories || [],
      limit: 50,
    });

    if (stories.length < 2) {
      return res.status(200).json({
        clusters: [],
        stories: stories,
        message: `Found ${stories.length} flagged stories. Need at least 2 to cluster.`,
      });
    }

    // Check cache first (unless force refresh)
    const storiesHash = generateStoriesHash(stories);
    const trendingContext = settings?.include_trending_context !== false
      ? await buildTrendingContext(input.projectId, userId)
      : [];
    const trendsHash = generateTrendsHash(trendingContext);

    if (!input.forceRefresh) {
      const cached = await getCachedClusters(input.projectId, input.audienceProfileId);
      if (cached && cached.stories_hash === storiesHash && cached.trends_hash === trendsHash) {
        // Enrich clusters with story data and similar proposals
        const enrichedClusters = await Promise.all(
          cached.clusters.map(async (cluster) => {
            const similarProposals = await findSimilarProposals(
              input.projectId,
              cluster.story_ids,
              { minOverlapPercentage: 50 }
            );
            return {
              ...cluster,
              stories: stories.filter(s => cluster.story_ids.includes(s.id)),
              similar_proposals: similarProposals,
            };
          })
        );

        return res.status(200).json({
          clusters: enrichedClusters,
          stories,
          fromCache: true,
        });
      }
    }

    // Generate fresh clusters
    const clusters = await clusterStoriesByTheme({
      stories,
      audienceProfile,
      trendingContext,
    });

    // Cache the results
    await saveClustersCache(
      input.projectId,
      input.audienceProfileId,
      clusters,
      storiesHash,
      trendsHash
    );

    // Enrich clusters with story data and similar proposals
    const enrichedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        const similarProposals = await findSimilarProposals(
          input.projectId,
          cluster.story_ids,
          { minOverlapPercentage: 50 }
        );
        return {
          ...cluster,
          stories: stories.filter(s => cluster.story_ids.includes(s.id)),
          similar_proposals: similarProposals,
        };
      })
    );

    return res.status(200).json({
      clusters: enrichedClusters,
      stories,
      trendingContext,
      fromCache: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/preview-clusters] Error:', error);
    return res.status(500).json({ error: 'Failed to preview clusters' });
  }
}
