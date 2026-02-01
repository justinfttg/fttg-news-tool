import { Request, Response } from 'express';
import { z } from 'zod';
import { analyzeAudienceFromUrl } from '../../src/services/ai/audience-analyzer';

const AnalyzeUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

/**
 * POST /api/audience/analyze
 * Analyze a URL to infer audience characteristics using AI
 */
export async function analyzeHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { url } = AnalyzeUrlSchema.parse(req.body);

    const analysis = await analyzeAudienceFromUrl(url);

    if (!analysis) {
      return res.status(500).json({ error: 'Failed to analyze URL' });
    }

    return res.status(200).json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }

    const message = error instanceof Error ? error.message : 'Failed to analyze URL';

    // Check for specific error types
    if (message.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    if (message.includes('Failed to fetch')) {
      return res.status(400).json({ error: 'Could not fetch the URL. Please check the URL is accessible.' });
    }

    return res.status(500).json({ error: message });
  }
}
