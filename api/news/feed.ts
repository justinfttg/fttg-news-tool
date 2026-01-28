import { Request, Response } from 'express';
import { feedHandler } from '../../backend/api/news/feed';

export default async function handler(req: Request, res: Response) {
  return feedHandler(req, res);
}
