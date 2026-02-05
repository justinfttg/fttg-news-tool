import { cors } from '../../_cors';
import { authenticate } from '../../_auth';
import {
  updateHandler,
  deleteHandler,
} from '../../../backend/api/calendar/items';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;

  const isAuthenticated = await authenticate(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Extract ID from URL path - Vercel puts dynamic segments in req.query
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'Item ID required' });
  }

  // Make id available to handlers via req.params
  req.params = { ...req.params, id };

  switch (req.method) {
    case 'PUT':
      return updateHandler(req, res);
    case 'DELETE':
      return deleteHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
