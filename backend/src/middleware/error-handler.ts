import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err.message);

  if (err.message.includes('already registered') || err.message.includes('already exists')) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err.message.includes('Invalid') || err.message.includes('not found')) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
