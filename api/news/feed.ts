import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { feedHandler } from '../../backend/api/news/feed';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  return withAuth(feedHandler)(req, res);
}
