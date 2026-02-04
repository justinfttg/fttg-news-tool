import { cors } from '../../../../../_cors';
import { withAuth } from '../../../../../_auth';
import { resolveHandler } from '../../../../../../backend/api/topics/comments';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract IDs from Vercel's query params
  const { id, commentId } = req.query;
  req.params = { id, commentId };

  const handler = async (req: any, res: any) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return resolveHandler(req, res);
  };

  return withAuth(handler)(req, res);
}
