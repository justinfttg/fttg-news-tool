import { cors } from '../../../_cors';
import { withAuth } from '../../../_auth';
import { listHandler } from '../../../../backend/api/episodes/milestones';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract ID from Vercel's query params
  const { id } = req.query;
  req.params = { id };

  const handler = async (req: any, res: any) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return listHandler(req, res);
  };

  return withAuth(handler)(req, res);
}
