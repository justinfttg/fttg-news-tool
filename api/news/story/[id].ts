import { Request, Response } from 'express';
import { storyHandler } from '../../../backend/api/news/feed';

export default async function handler(req: Request, res: Response) {
  return storyHandler(req, res);
}
