import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { overdueHandler } from '../../backend/api/episodes/milestones';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  const handler = async (req: any, res: any) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return overdueHandler(req, res);
  };

  return withAuth(handler)(req, res);
}
