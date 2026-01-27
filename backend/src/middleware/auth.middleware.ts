import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/auth/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Express middleware that validates the JWT in the Authorization header.
 * On success, attaches the decoded payload to `req.user`.
 * Returns 401 if the header is missing or the token is invalid/expired.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Keep legacy alias so existing imports continue to work
export { authenticateRequest as authMiddleware };
