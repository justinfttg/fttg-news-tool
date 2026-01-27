import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, TokenPayload } from '../../../src/services/auth/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('jwt', () => {
  describe('generateToken', () => {
    it('should return a valid JWT string', () => {
      const token = generateToken('user-123', 'test@example.com');
      expect(typeof token).toBe('string');
      // JWT has 3 dot-separated parts
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include userId and email in the payload', () => {
      const token = generateToken('user-123', 'test@example.com');
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should set orgId to null when no extra provided', () => {
      const token = generateToken('user-123', 'test@example.com');
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.orgId).toBeNull();
    });

    it('should set isFttgTeam to false when no extra provided', () => {
      const token = generateToken('user-123', 'test@example.com');
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.isFttgTeam).toBe(false);
    });

    it('should include orgId when provided in extra', () => {
      const token = generateToken('user-123', 'test@example.com', {
        orgId: 'org-456',
      });
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.orgId).toBe('org-456');
    });

    it('should include isFttgTeam when provided in extra', () => {
      const token = generateToken('user-123', 'test@example.com', {
        isFttgTeam: true,
      });
      const decoded = jwt.decode(token) as TokenPayload;
      expect(decoded.isFttgTeam).toBe(true);
    });

    it('should set an expiry on the token', () => {
      const token = generateToken('user-123', 'test@example.com');
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.payload).toHaveProperty('exp');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return TokenPayload', async () => {
      const token = generateToken('user-123', 'test@example.com', {
        orgId: 'org-456',
        isFttgTeam: true,
      });

      const payload = await verifyToken(token);
      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.orgId).toBe('org-456');
      expect(payload.isFttgTeam).toBe(true);
    });

    it('should reject an invalid token', async () => {
      await expect(verifyToken('not.a.validtoken')).rejects.toThrow();
    });

    it('should reject a token signed with a different secret', async () => {
      const wrongToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '7d' }
      );
      await expect(verifyToken(wrongToken)).rejects.toThrow();
    });

    it('should reject an expired token', async () => {
      // Create a token that expired 1 second ago
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', orgId: null, isFttgTeam: false },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );
      await expect(verifyToken(expiredToken)).rejects.toThrow();
    });
  });
});
