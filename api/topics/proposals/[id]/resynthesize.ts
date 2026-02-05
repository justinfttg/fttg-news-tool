import { cors } from '../../../_cors';
import { authenticate } from '../../../_auth';
import { resynthesizeHandler } from '../../../../backend/api/topics/resynthesize';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;

  const isAuthenticated = await authenticate(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Extract ID from URL path
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'Proposal ID required' });
  }

  // Make id available to handler via req.params
  req.params = { ...req.params, id };

  if (req.method === 'POST') {
    return resynthesizeHandler(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
