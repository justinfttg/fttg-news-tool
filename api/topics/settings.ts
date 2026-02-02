import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { getSettingsHandler, updateSettingsHandler } from '../../backend/api/topics/settings';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  const handler = async (req: any, res: any) => {
    switch (req.method) {
      case 'GET':
        return getSettingsHandler(req, res);
      case 'PUT':
        return updateSettingsHandler(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  };

  return withAuth(handler)(req, res);
}
