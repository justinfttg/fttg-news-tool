import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // JWT-based auth is stateless; logout is handled client-side by removing the token.
  // This endpoint exists for API completeness and future session invalidation.
  return res.status(200).json({ message: 'Logged out successfully' });
}
