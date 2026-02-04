import { cors } from '../../../_cors';
import { withAuth } from '../../../_auth';
import { updateHandler } from '../../../../backend/api/episodes/milestones';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract IDs from Vercel's query params
  const { id, milestoneId } = req.query;
  req.params = { id, milestoneId };

  const handler = async (req: any, res: any) => {
    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return updateHandler(req, res);
  };

  return withAuth(handler)(req, res);
}
