import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import {
  getTopicGeneratorSettings,
  upsertTopicGeneratorSettings,
  getProposalStats,
} from '../../src/db/queries/topic-proposals.queries';

// ============================================================================
// Schemas
// ============================================================================

const GetSettingsSchema = z.object({
  projectId: z.string().uuid(),
});

const UpdateSettingsSchema = z.object({
  projectId: z.string().uuid(),
  autoGenerationEnabled: z.boolean().optional(),
  autoGenerationTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  autoGenerationTimezone: z.string().max(50).optional(),
  timeWindowDays: z.number().int().min(1).max(30).optional(),
  minStoriesForCluster: z.number().int().min(1).max(10).optional(),
  maxProposalsPerRun: z.number().int().min(1).max(20).optional(),
  focusCategories: z.array(z.string()).optional(),
  comparisonRegions: z.array(z.string()).optional(),
  defaultDurationType: z.enum(['short', 'standard', 'long', 'custom']).optional(),
  defaultDurationSeconds: z.number().int().min(60).max(900).optional(),
  defaultAudienceProfileId: z.string().uuid().nullable().optional(),
  includeTrendingContext: z.boolean().optional(),
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

// Default settings (used when no settings exist)
const DEFAULT_SETTINGS = {
  auto_generation_enabled: true,
  auto_generation_time: '06:00:00',
  auto_generation_timezone: 'Asia/Singapore',
  time_window_days: 7,
  min_stories_for_cluster: 2,
  max_proposals_per_run: 5,
  focus_categories: [],
  comparison_regions: ['Singapore', 'Malaysia', 'United States'],
  default_duration_type: 'standard' as const,
  default_duration_seconds: 180,
  default_audience_profile_id: null,
  include_trending_context: true,
};

// ============================================================================
// GET /api/topics/settings
// ============================================================================

export async function getSettingsHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const query = GetSettingsSchema.parse(req.query);

    // Verify project membership
    const member = await verifyMembership(query.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Get settings (or return defaults)
    let settings = await getTopicGeneratorSettings(query.projectId);

    if (!settings) {
      // Return defaults with project_id
      settings = {
        id: '',
        project_id: query.projectId,
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Get stats for display
    const stats = await getProposalStats(query.projectId);

    return res.status(200).json({
      settings,
      stats,
      isDefault: !settings.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/settings] Get error:', error);
    return res.status(500).json({ error: 'Failed to fetch topic generator settings' });
  }
}

// ============================================================================
// PUT /api/topics/settings
// ============================================================================

export async function updateSettingsHandler(req: Request, res: Response) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const input = UpdateSettingsSchema.parse(req.body);

    // Verify project membership
    const member = await verifyMembership(input.projectId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    // Only owner and editors can update settings
    if (member.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update settings' });
    }

    // Validate default audience profile if provided
    if (input.defaultAudienceProfileId) {
      const { data: profile } = await supabase
        .from('audience_profiles')
        .select('id')
        .eq('id', input.defaultAudienceProfileId)
        .eq('project_id', input.projectId)
        .single();

      if (!profile) {
        return res.status(400).json({ error: 'Invalid default audience profile' });
      }
    }

    const settings = await upsertTopicGeneratorSettings(input);

    return res.status(200).json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[topics/settings] Update error:', error);
    return res.status(500).json({ error: 'Failed to update topic generator settings' });
  }
}
