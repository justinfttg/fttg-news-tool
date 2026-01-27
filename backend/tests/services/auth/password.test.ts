import bcrypt from 'bcryptjs';
import { hashPassword, comparePassword } from '../../../src/services/auth/password';

describe('password', () => {
  describe('hashPassword', () => {
    it('should return a bcrypt hash string', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      // bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('should produce different hashes for the same password (unique salts)', async () => {
      const hash1 = await hashPassword('samepassword');
      const hash2 = await hashPassword('samepassword');
      expect(hash1).not.toBe(hash2);
    });

    it('should use salt rounds of 10', async () => {
      const hash = await hashPassword('testpassword');
      // bcrypt hash format: $2a$<rounds>$...
      // With rounds=10, the prefix is $2a$10$
      expect(hash).toMatch(/^\$2[ab]\$10\$/);
    });

    it('should handle empty string password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('comparePassword', () => {
    it('should return true when comparing correct password with its hash', async () => {
      const password = 'correctpassword';
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false when comparing incorrect password with a hash', async () => {
      const hash = await hashPassword('original');
      const result = await comparePassword('wrong', hash);
      expect(result).toBe(false);
    });

    it('should return false for completely different hash', async () => {
      const fakeHash = '$2a$10$invalidhashvaluexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const result = await comparePassword('any', fakeHash);
      expect(result).toBe(false);
    });

    it('should handle comparison with empty string password', async () => {
      const hash = await hashPassword('notempty');
      const result = await comparePassword('', hash);
      expect(result).toBe(false);
    });
  });
});
