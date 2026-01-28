import { Request, Response } from 'express';
import {
  listHandler,
  createHandler,
  updateHandler,
  deleteHandler,
} from '../../backend/api/calendar/items';

export default async function handler(req: Request, res: Response) {
  switch (req.method) {
    case 'GET':
      return listHandler(req, res);
    case 'POST':
      return createHandler(req, res);
    case 'PUT':
      return updateHandler(req, res);
    case 'DELETE':
      return deleteHandler(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
