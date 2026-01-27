import { Request, Response, NextFunction } from 'express';

export function teamOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isFttgTeam) {
    res.status(403).json({ error: 'This feature is only available to FTTG team members' });
    return;
  }
  next();
}
