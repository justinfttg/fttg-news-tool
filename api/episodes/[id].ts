import { cors } from '../_cors';
import { withAuth } from '../_auth';
import {
  getHandler,
  updateHandler,
  deleteHandler,
} from '../../backend/api/episodes/episodes';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract ID from Vercel's query params
  const { id } = req.query;
  req.params = { id };

  const handler = async (req: any, res: any) => {
    switch (req.method) {
      case 'GET':
        return getHandler(req, res);
      case 'PATCH':
        return updateHandler(req, res);
      case 'DELETE':
        return deleteHandler(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  };

  return withAuth(handler)(req, res);
}
