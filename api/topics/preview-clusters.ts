import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { previewClustersHandler } from '../../backend/api/topics/proposals';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withAuth(previewClustersHandler)(req, res);
}
