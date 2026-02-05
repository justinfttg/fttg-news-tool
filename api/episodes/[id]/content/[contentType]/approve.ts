import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../../../_cors';
import { authenticate } from '../../../../_auth';
import { approveHandler } from '../../../../../backend/api/episodes/content';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const isAuthenticated = await authenticate(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  (req as any).params = {
    episodeId: req.query.id,
    contentType: req.query.contentType,
  };

  return approveHandler(req as any, res as any);
}
