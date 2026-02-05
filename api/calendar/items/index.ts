import { cors } from '../../_cors';
import { authenticate } from '../../_auth';
import {
  listHandler,
  createHandler,
} from '../../../backend/api/calendar/items';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;

  const isAuthenticated = await authenticate(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  switch (req.method) {
    case 'GET':
      return listHandler(req, res);
    case 'POST':
      return createHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
