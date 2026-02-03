import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { analyzeHandler } from '../../backend/api/audience/analyze';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;

  return withAuth(analyzeHandler)(req, res);
}
