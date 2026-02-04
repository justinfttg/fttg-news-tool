import { cors } from '../../../_cors';
import { withAuth } from '../../../_auth';
import { setDefaultHandler } from '../../../../backend/api/workflows/templates';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract ID from Vercel's query params
  const { id } = req.query;
  req.params = { id };

  const handler = async (req: any, res: any) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return setDefaultHandler(req, res);
  };

  return withAuth(handler)(req, res);
}
