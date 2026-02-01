import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../src/db/client';
import { generateStoryAngle, AngleGenerationParams } from '../../src/services/ai/angle-generator';

const generateAngleSchema = z.object({
  newsStoryId: z.string().uuid(),
  audienceProfileId: z.string().uuid(),
  projectId: z.string().uuid(),
  frameworkType: z.enum(['fttg_investigative', 'educational_deepdive']),
  comparisonRegions: z.array(z.string()).optional(),
});

export async function generateHandler(req: Request, res: Response) {
  try {
    const parsed = generateAngleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      });
    }

    const { newsStoryId, audienceProfileId, projectId, frameworkType, comparisonRegions } = parsed.data;
    const userId = req.user?.userId;

    // Fetch the news story
    const { data: newsStory, error: newsError } = await supabase
      .from('news_stories')
      .select('id, title, content, source, published_at')
      .eq('id', newsStoryId)
      .single();

    if (newsError || !newsStory) {
      return res.status(404).json({ error: 'News story not found' });
    }

    // Fetch the audience profile
    const { data: audienceProfile, error: audienceError } = await supabase
      .from('audience_profiles')
      .select('*')
      .eq('id', audienceProfileId)
      .single();

    if (audienceError || !audienceProfile) {
      return res.status(404).json({ error: 'Audience profile not found' });
    }

    // Verify project access
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Generate the angle using AI
    const params: AngleGenerationParams = {
      newsStory: {
        id: newsStory.id,
        title: newsStory.title,
        content: newsStory.content,
        source: newsStory.source,
        published_at: newsStory.published_at,
      },
      audienceProfile: {
        id: audienceProfile.id,
        name: audienceProfile.name,
        age_range: audienceProfile.age_range,
        location: audienceProfile.location,
        education_level: audienceProfile.education_level,
        primary_language: audienceProfile.primary_language,
        market_region: audienceProfile.market_region,
        values: audienceProfile.values || [],
        fears: audienceProfile.fears || [],
        aspirations: audienceProfile.aspirations || [],
        cultural_context: audienceProfile.cultural_context,
        preferred_tone: audienceProfile.preferred_tone,
        depth_preference: audienceProfile.depth_preference,
        political_sensitivity: audienceProfile.political_sensitivity,
      },
      frameworkType,
      comparisonRegions,
    };

    const generatedAngle = await generateStoryAngle(params);

    // Save the generated angle to the database
    const { data: savedAngle, error: saveError } = await supabase
      .from('story_angles')
      .insert({
        news_story_id: newsStoryId,
        audience_profile_id: audienceProfileId,
        project_id: projectId,
        created_by_user_id: userId,
        angle_data: generatedAngle.angle_data,
        audience_care_statement: generatedAngle.audience_care_statement,
        comparison_regions: generatedAngle.comparison_regions,
        status: 'draft',
      })
      .select()
      .single();

    if (saveError) {
      console.error('[angles/generate] Save error:', saveError);
      return res.status(500).json({ error: 'Failed to save generated angle' });
    }

    return res.status(201).json({
      angle: savedAngle,
      framework_type: generatedAngle.framework_type,
    });
  } catch (error) {
    console.error('[angles/generate] Error:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    return res.status(500).json({ error: 'Failed to generate angle' });
  }
}

// List angles for a story
export async function listHandler(req: Request, res: Response) {
  try {
    const { storyId, projectId } = req.query;
    const userId = req.user?.userId;

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Verify project access
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    let query = supabase
      .from('story_angles')
      .select(`
        *,
        news_stories!inner (id, title, source),
        audience_profiles (id, name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (storyId && typeof storyId === 'string') {
      query = query.eq('news_story_id', storyId);
    }

    const { data: angles, error } = await query;

    if (error) {
      console.error('[angles/list] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch angles' });
    }

    return res.json({ angles });
  } catch (error) {
    console.error('[angles/list] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch angles' });
  }
}

// Get a single angle
export async function getHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const { data: angle, error } = await supabase
      .from('story_angles')
      .select(`
        *,
        news_stories (id, title, summary, content, source, url, published_at),
        audience_profiles (id, name, primary_language, market_region)
      `)
      .eq('id', id)
      .single();

    if (error || !angle) {
      return res.status(404).json({ error: 'Angle not found' });
    }

    // Verify project access
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', angle.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this angle' });
    }

    return res.json({ angle });
  } catch (error) {
    console.error('[angles/get] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch angle' });
  }
}

// Update angle status
export async function updateStatusHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    if (!['draft', 'approved', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the angle to verify access
    const { data: angle, error: fetchError } = await supabase
      .from('story_angles')
      .select('project_id')
      .eq('id', id)
      .single();

    if (fetchError || !angle) {
      return res.status(404).json({ error: 'Angle not found' });
    }

    // Verify project access
    const { data: membership } = await supabase
      .from('project_members')
      .select('role, can_approve_stories')
      .eq('project_id', angle.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this angle' });
    }

    // Only users with approve permission can approve angles
    if (status === 'approved' && !membership.can_approve_stories && membership.role !== 'owner') {
      return res.status(403).json({ error: 'You do not have permission to approve angles' });
    }

    const { data: updatedAngle, error: updateError } = await supabase
      .from('story_angles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update angle' });
    }

    return res.json({ angle: updatedAngle });
  } catch (error) {
    console.error('[angles/updateStatus] Error:', error);
    return res.status(500).json({ error: 'Failed to update angle' });
  }
}

// Delete an angle
export async function deleteHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Get the angle to verify access
    const { data: angle, error: fetchError } = await supabase
      .from('story_angles')
      .select('project_id, created_by_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !angle) {
      return res.status(404).json({ error: 'Angle not found' });
    }

    // Verify project access
    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', angle.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this angle' });
    }

    // Only owner or the creator can delete
    if (membership.role !== 'owner' && angle.created_by_user_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this angle' });
    }

    const { error: deleteError } = await supabase
      .from('story_angles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete angle' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[angles/delete] Error:', error);
    return res.status(500).json({ error: 'Failed to delete angle' });
  }
}
