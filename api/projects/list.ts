import { cors } from '../_cors';
import { withAuth } from '../_auth';
import handler from '../../backend/api/projects/list';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;
  return withAuth(handler)(req, res);
}
