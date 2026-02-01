import { cors } from '../_cors';
import { withAuth } from '../_auth';
import { markedHandler } from '../../backend/api/news/marked';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  return withAuth(markedHandler)(req, res);
}
