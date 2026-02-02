import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { listHandler } from '../../backend/api/angles/generate';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return withAuth(listHandler)(req, res);
}
