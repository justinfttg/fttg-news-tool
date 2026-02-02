import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { generateHandler } from '../../backend/api/angles/generate';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;
  return withAuth(generateHandler)(req, res);
}
