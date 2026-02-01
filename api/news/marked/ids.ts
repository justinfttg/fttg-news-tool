import { cors } from '../../_cors';
import { withAuth } from '../../_auth';
import { markedIdsHandler } from '../../../backend/api/news/marked';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  return withAuth(markedIdsHandler)(req, res);
}
