/**
 * CORS helper for Vercel serverless functions.
 * Handles preflight OPTIONS requests and sets CORS headers.
 */
export function cors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
