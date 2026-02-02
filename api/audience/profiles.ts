import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { listHandler, createHandler, updateHandler, deleteHandler } from '../../backend/api/audience/profiles';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Route based on HTTP method
  const handler = async (req: any, res: any) => {
    switch (req.method) {
      case 'GET':
        return listHandler(req, res);
      case 'POST':
        return createHandler(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  };

  return withAuth(handler)(req, res);
}
