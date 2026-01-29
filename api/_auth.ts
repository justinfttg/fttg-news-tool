/**
 * Auth helper for Vercel serverless functions.
 * Verifies JWT and attaches user to request.
 */
import { verifyToken } from '../backend/src/services/auth/jwt';

export async function authenticate(req: any): Promise<boolean> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token);
    req.user = payload;
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrapper for protected endpoints.
 * Returns 401 if not authenticated, otherwise calls handler.
 */
export function withAuth(handler: (req: any, res: any) => Promise<any>) {
  return async (req: any, res: any) => {
    const isAuthenticated = await authenticate(req);
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return handler(req, res);
  };
}
