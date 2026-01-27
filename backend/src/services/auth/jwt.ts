import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  orgId: string | null;
  isFttgTeam: boolean;
}

/**
 * Generate a signed JWT for the given user.
 * Additional claims (orgId, isFttgTeam) can be passed via the optional
 * `extra` parameter and will be embedded in the token payload.
 */
export function generateToken(
  userId: string,
  email: string,
  extra?: { orgId?: string | null; isFttgTeam?: boolean }
): string {
  const payload: TokenPayload = {
    userId,
    email,
    orgId: extra?.orgId ?? null,
    isFttgTeam: extra?.isFttgTeam ?? false,
  };
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify and decode a JWT. Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<TokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded as TokenPayload);
    });
  });
}
