import { cors } from '../_cors';
import handler from '../../backend/api/auth/login';

export default async function (req: any, res: any) {
  if (cors(req, res)) return;
  return handler(req, res);
}
