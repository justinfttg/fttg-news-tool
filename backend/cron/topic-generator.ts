import { Request, Response } from 'express';
import { verifyToken } from '../src/services/auth/jwt';
import { supabase, query } from '../src/db/client';
import { clusterStoriesByTheme, generateTopicProposal, generateStoriesHash } from '../src/services/ai/topic-generator';
import { findResearchCitations } from '../src/services/ai/research-finder';
import {
  getAllFlaggedStoriesForProject,
  createTopicProposal,
  getCachedClusters,
  saveClustersCache,
  CreateTopicProposalInput,
} from '../src/db/queries/topic-proposals.queries';
import type { AudienceProfile, TopicCluster } from '../src/types';

// Duration configuration
const DURATION_CONFIG = {
  short: { minSeconds: 60, maxSeconds: 120 },
  standard: { minSeconds: 180, maxSeconds: 240 },
  long: { minSeconds: 300, maxSeconds: 600 },
  custom: { minSeconds: 60, maxSeconds: 900 },
};

/**
 * Cron handler for auto-generating topic proposals
 *
 * Runs hourly and checks each project's auto_generation_time setting
 * to determine if it should generate proposals for that project.
 *
 * POST /api/cron/topic-generator
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: accept Vercel Cron, CRON_SECRET header, or admin JWT
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isCronSecret = !!(cronSecret && token === cronSecret);

  let isAuthenticated = false;
  if (!isVercelCron && !isCronSecret && token) {
    try {
      const payload = await verifyToken(token);
      isAuthenticated = !!payload.userId;
    } catch {
      // Invalid token
    }
  }

  if (!isVercelCron && !isCronSecret && !isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[topic-generator] Starting auto-generation check...');
    const startTime = Date.now();

    // Get all projects with auto-generation enabled
    const projects = await query<{
      project_id: string;
      auto_generation_enabled: boolean;
      auto_generation_time: string;
      time_window_days: number;
      focus_categories: string[];
      comparison_regions: string[];
      default_duration_type: 'short' | 'standard' | 'long' | 'custom';
      min_stories_for_cluster: number;
      max_proposals_per_run: number;
      default_audience_profile_id: string | null;
      project_name: string;
    }>(`
      SELECT
        s.project_id,
        s.auto_generation_enabled,
        s.auto_generation_time,
        s.time_window_days,
        s.focus_categories,
        s.comparison_regions,
        s.default_duration_type,
        s.min_stories_for_cluster,
        s.max_proposals_per_run,
        s.default_audience_profile_id,
        p.name as project_name
      FROM topic_generator_settings s
      JOIN projects p ON p.id = s.project_id
      WHERE s.auto_generation_enabled = true
    `);

    console.log(`[topic-generator] Found ${projects.length} projects with auto-generation enabled`);

    const results: { projectId: string; projectName: string; proposalsGenerated: number; error?: string }[] = [];

    // Current time for schedule checking
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    for (const project of projects) {
      try {
        // Parse the auto_generation_time (e.g., "06:00:00")
        const [schedHour] = (project.auto_generation_time || '06:00:00')
          .split(':')
          .map(Number);

        // Check if current time is within the scheduled window (±30 min tolerance for hourly cron)
        const isScheduledTime = currentHour === schedHour && currentMinute < 30;

        if (!isScheduledTime) {
          console.log(`[topic-generator] Skipping project ${project.project_name} - not scheduled time (scheduled: ${schedHour}:00, current: ${currentHour}:${currentMinute})`);
          continue;
        }

        console.log(`[topic-generator] Processing project: ${project.project_name}`);

        // Get flagged stories for clustering (all users in project)
        const stories = await getAllFlaggedStoriesForProject(
          project.project_id,
          {
            timeWindowDays: project.time_window_days || 7,
            focusCategories: project.focus_categories || [],
          }
        );

        const minStories = project.min_stories_for_cluster || 2;
        if (stories.length < minStories) {
          console.log(`[topic-generator] Not enough stories for project ${project.project_name} (${stories.length} < ${minStories})`);
          results.push({
            projectId: project.project_id,
            projectName: project.project_name,
            proposalsGenerated: 0,
            error: `Not enough stories (${stories.length})`,
          });
          continue;
        }

        // Get default audience profile if set
        let audienceProfile: AudienceProfile | undefined;
        if (project.default_audience_profile_id) {
          const { data: audienceData } = await supabase
            .from('audience_profiles')
            .select('*')
            .eq('id', project.default_audience_profile_id)
            .single();

          if (audienceData) {
            audienceProfile = audienceData as AudienceProfile;
          }
        }

        // Skip if no audience profile
        if (!audienceProfile) {
          console.log(`[topic-generator] No audience profile for project ${project.project_name}, skipping`);
          results.push({
            projectId: project.project_id,
            projectName: project.project_name,
            proposalsGenerated: 0,
            error: 'No default audience profile configured',
          });
          continue;
        }

        // Check cache for existing clusters
        const storiesHash = generateStoriesHash(stories);
        const audienceProfileId = project.default_audience_profile_id;
        let clusters: TopicCluster[];

        const cached = await getCachedClusters(project.project_id, audienceProfileId);
        if (cached && cached.clusters && cached.stories_hash === storiesHash) {
          console.log(`[topic-generator] Using cached clusters for project ${project.project_name}`);
          clusters = cached.clusters;
        } else {
          // Generate new clusters
          console.log(`[topic-generator] Generating new clusters for project ${project.project_name}`);
          clusters = await clusterStoriesByTheme({
            stories,
            audienceProfile,
          });

          // Cache the clusters
          await saveClustersCache(project.project_id, audienceProfileId, clusters, storiesHash, '');
        }

        // Filter clusters by minimum story count
        const validClusters = clusters.filter(
          c => c.story_ids.length >= minStories
        );

        if (validClusters.length === 0) {
          console.log(`[topic-generator] No valid clusters for project ${project.project_name}`);
          results.push({
            projectId: project.project_id,
            projectName: project.project_name,
            proposalsGenerated: 0,
            error: 'No valid clusters found',
          });
          continue;
        }

        // Generate proposals for top clusters (up to max_proposals_per_run)
        const maxProposals = project.max_proposals_per_run || 5;
        const clustersToProcess = validClusters.slice(0, maxProposals);
        let proposalsGenerated = 0;

        // Get duration configuration
        const durationType = project.default_duration_type || 'standard';
        const durationConfig = DURATION_CONFIG[durationType];
        const durationSeconds = Math.floor(
          (durationConfig.minSeconds + durationConfig.maxSeconds) / 2
        );

        for (const cluster of clustersToProcess) {
          try {
            // Get full story data for the cluster
            const clusterStories = stories.filter(s => cluster.story_ids.includes(s.id));

            // Generate the proposal
            const proposal = await generateTopicProposal({
              cluster,
              stories: clusterStories as any, // Stories from clustering have partial data
              audienceProfile,
              durationType,
              durationSeconds,
              comparisonRegions: project.comparison_regions || [],
            });

            // Find research citations
            const citations = await findResearchCitations({
              topic: proposal.title,
              queries: proposal.research_suggestions || [],
              audienceRegion: audienceProfile.market_region ?? undefined,
              maxCitationsPerQuery: 2,
            });

            // Save to database
            const proposalInput: CreateTopicProposalInput = {
              projectId: project.project_id,
              title: proposal.title,
              hook: proposal.hook,
              audienceCareStatement: proposal.audience_care_statement,
              talkingPoints: proposal.talking_points,
              researchCitations: citations,
              sourceStoryIds: cluster.story_ids,
              clusterTheme: cluster.theme,
              clusterKeywords: cluster.keywords,
              durationType,
              durationSeconds,
              generationTrigger: 'auto',
              audienceProfileId: project.default_audience_profile_id ?? undefined,
              comparisonRegions: project.comparison_regions || [],
            };

            await createTopicProposal(proposalInput);

            proposalsGenerated++;
            console.log(`[topic-generator] Generated proposal: "${proposal.title}" for project ${project.project_name}`);
          } catch (clusterError) {
            console.error(`[topic-generator] Error generating proposal for cluster "${cluster.theme}":`, clusterError);
          }
        }

        results.push({
          projectId: project.project_id,
          projectName: project.project_name,
          proposalsGenerated,
        });
      } catch (projectError) {
        const errorMessage = projectError instanceof Error ? projectError.message : 'Unknown error';
        console.error(`[topic-generator] Error processing project ${project.project_name}:`, projectError);
        results.push({
          projectId: project.project_id,
          projectName: project.project_name,
          proposalsGenerated: 0,
          error: errorMessage,
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalProposals = results.reduce((sum, r) => sum + r.proposalsGenerated, 0);

    console.log(`[topic-generator] Complete in ${elapsed}s — projects: ${projects.length}, proposals: ${totalProposals}`);

    return res.status(200).json({
      success: true,
      elapsed: `${elapsed}s`,
      projectsChecked: projects.length,
      totalProposalsGenerated: totalProposals,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Topic generation failed';
    console.error(`[topic-generator] Fatal error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
}
