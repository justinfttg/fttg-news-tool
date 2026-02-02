import { cors } from '../../_cors';
import { withAuth } from '../../_auth';
import { listHandler, generateHandler } from '../../../backend/api/topics/proposals';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  const handler = async (req: any, res: any) => {
    switch (req.method) {
      case 'GET':
        return listHandler(req, res);
      case 'POST':
        // POST to /api/topics/proposals generates proposals
        return generateHandler(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  };

  return withAuth(handler)(req, res);
}
