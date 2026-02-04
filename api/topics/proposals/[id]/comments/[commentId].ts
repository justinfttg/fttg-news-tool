import { cors } from '../../../../_cors';
import { withAuth } from '../../../../_auth';
import { updateHandler, deleteHandler } from '../../../../../backend/api/topics/comments';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  // Extract IDs from Vercel's query params
  const { id, commentId } = req.query;
  req.params = { id, commentId };

  const handler = async (req: any, res: any) => {
    switch (req.method) {
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
