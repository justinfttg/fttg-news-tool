import { cors } from '../_cors';
import handler from '../../backend/cron/cleanup';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;
  return handler(req, res);
}
