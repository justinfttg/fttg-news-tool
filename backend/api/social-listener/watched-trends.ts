// /api/social-listener/watched-trends
// CRUD operations for user's watched trends

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, type AuthPayload } from '../../src/services/auth/jwt';
import {
  createWatchedTrend,
  getWatchedTrends,
  deleteWatchedTrend,
} from '../../src/db/queries/social-listener.queries';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  let auth: AuthPayload;
  try {
    auth = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const projectId = req.query.projectId ? String(req.query.projectId) : null;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, auth, projectId);
    case 'POST':
      return handlePost(req, res, auth);
    case 'DELETE':
      return handleDelete(req, res, auth);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthPayload,
  projectId: string | null
) {
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const trends = await getWatchedTrends(projectId, auth.sub);

  return res.status(200).json({
    trends: trends.map((t) => ({
      id: t.id,
      query: t.query,
      queryType: t.query_type,
      platforms: t.platforms,
      regions: t.regions,
      isActive: t.is_active,
      createdAt: t.created_at,
      lastScrapedAt: t.last_scraped_at,
    })),
  });
}

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthPayload
) {
  const { query, queryType, projectId, platforms, regions } = req.body;

  if (!query || !projectId) {
    return res.status(400).json({ error: 'query and projectId are required' });
  }

  // Validate query type
  const validTypes = ['hashtag', 'keyword', 'phrase'];
  const type = validTypes.includes(queryType) ? queryType : 'keyword';

  // Clean up hashtag queries
  const cleanQuery = type === 'hashtag' && !query.startsWith('#')
    ? `#${query}`
    : query;

  const trend = await createWatchedTrend({
    userId: auth.sub,
    projectId,
    query: cleanQuery,
    queryType: type,
    platforms,
    regions,
  });

  if (!trend) {
    return res.status(500).json({ error: 'Failed to create watched trend' });
  }

  return res.status(201).json({
    trend: {
      id: trend.id,
      query: trend.query,
      queryType: trend.query_type,
      platforms: trend.platforms,
      regions: trend.regions,
      isActive: trend.is_active,
      createdAt: trend.created_at,
    },
  });
}

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthPayload
) {
  const trendId = req.query.id ? String(req.query.id) : null;

  if (!trendId) {
    return res.status(400).json({ error: 'id is required' });
  }

  const success = await deleteWatchedTrend(trendId, auth.sub);

  if (!success) {
    return res.status(404).json({ error: 'Trend not found or not authorized' });
  }

  return res.status(200).json({ success: true });
}
