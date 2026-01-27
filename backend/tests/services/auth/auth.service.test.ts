import { registerUser, loginUser, getUserById, AuthUser } from '../../../src/services/auth/auth.service';
import * as passwordModule from '../../../src/services/auth/password';
import * as jwtModule from '../../../src/services/auth/jwt';
import { supabase } from '../../../src/db/client';

// Mock the Supabase client
jest.mock('../../../src/db/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock password and jwt modules
jest.mock('../../../src/services/auth/password');
jest.mock('../../../src/services/auth/jwt');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockHashPassword = passwordModule.hashPassword as jest.MockedFunction<typeof passwordModule.hashPassword>;
const mockComparePassword = passwordModule.comparePassword as jest.MockedFunction<typeof passwordModule.comparePassword>;
const mockGenerateToken = jwtModule.generateToken as jest.MockedFunction<typeof jwtModule.generateToken>;

// Helper to build a chainable Supabase query mock
function mockQuery(returnValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(returnValue),
  };
  (mockSupabase.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

// Helper for multi-step queries (e.g., registerUser does 2 queries)
function mockQuerySequence(calls: Array<{ data: any; error: any }>) {
  let callIndex = 0;
  const makeChain = (): any => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        const result = calls[callIndex];
        callIndex++;
        return Promise.resolve(result);
      }),
    };
    return chain;
  };

  (mockSupabase.from as jest.Mock).mockImplementation(() => makeChain());
}

const sampleUser: AuthUser = {
  id: 'uuid-123',
  email: 'test@example.com',
  full_name: 'Test User',
  org_id: null,
  is_fttg_team: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth.service', () => {
  describe('registerUser', () => {
    it('should create a new user and return AuthUser', async () => {
      mockQuerySequence([
        // First call: check existing user — not found
        { data: null, error: { code: 'PGRST116' } },
        // Second call: insert user
        { data: sampleUser, error: null },
      ]);
      mockHashPassword.mockResolvedValue('hashed-password');

      const result = await registerUser('test@example.com', 'password123');

      expect(mockHashPassword).toHaveBeenCalledWith('password123');
      expect(result).toEqual(sampleUser);
    });

    it('should throw if email already exists', async () => {
      mockQuery({ data: { id: 'existing-id' }, error: null });

      await expect(
        registerUser('taken@example.com', 'password123')
      ).rejects.toThrow('Email already registered');
    });

    it('should hash the password before inserting', async () => {
      mockQuerySequence([
        { data: null, error: { code: 'PGRST116' } },
        { data: sampleUser, error: null },
      ]);
      mockHashPassword.mockResolvedValue('$2a$10$hashedvalue');

      await registerUser('test@example.com', 'mySecretPwd');

      expect(mockHashPassword).toHaveBeenCalledWith('mySecretPwd');
    });

    it('should pass orgId to insert when provided', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      let callCount = 0;
      (mockSupabase.from as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Check existing
          chain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
        } else {
          // Insert
          chain.single.mockResolvedValueOnce({ data: { ...sampleUser, org_id: 'org-789' }, error: null });
        }
        return chain;
      });
      mockHashPassword.mockResolvedValue('hashed');

      const result = await registerUser('test@example.com', 'pass', 'org-789');

      expect(result.org_id).toBe('org-789');
    });

    it('should set org_id to null when orgId not provided', async () => {
      mockQuerySequence([
        { data: null, error: { code: 'PGRST116' } },
        { data: sampleUser, error: null },
      ]);
      mockHashPassword.mockResolvedValue('hashed');

      const result = await registerUser('test@example.com', 'password');

      expect(result.org_id).toBeNull();
    });

    it('should throw on database insert error', async () => {
      mockQuerySequence([
        { data: null, error: { code: 'PGRST116' } },
        { data: null, error: { message: 'DB insert failed' } },
      ]);
      mockHashPassword.mockResolvedValue('hashed');

      await expect(
        registerUser('test@example.com', 'password')
      ).rejects.toThrow('DB insert failed');
    });
  });

  describe('loginUser', () => {
    const userWithHash = {
      ...sampleUser,
      password_hash: '$2a$10$hashedvalue',
    };

    it('should return user and token on valid credentials', async () => {
      mockQuery({ data: userWithHash, error: null });
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('jwt-token-123');

      const result = await loginUser('test@example.com', 'correctpassword');

      expect(result.user).toEqual(sampleUser);
      expect(result.token).toBe('jwt-token-123');
    });

    it('should throw on non-existent email', async () => {
      mockQuery({ data: null, error: { code: 'PGRST116' } });

      await expect(
        loginUser('nonexistent@example.com', 'password')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw on wrong password', async () => {
      mockQuery({ data: userWithHash, error: null });
      mockComparePassword.mockResolvedValue(false);

      await expect(
        loginUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });

    it('should not include password_hash in returned user', async () => {
      mockQuery({ data: userWithHash, error: null });
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await loginUser('test@example.com', 'password');

      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('should generate token with correct user data', async () => {
      mockQuery({ data: userWithHash, error: null });
      mockComparePassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('jwt-token');

      await loginUser('test@example.com', 'password');

      expect(mockGenerateToken).toHaveBeenCalledWith(
        sampleUser.id,
        sampleUser.email,
        {
          orgId: sampleUser.org_id,
          isFttgTeam: sampleUser.is_fttg_team,
        }
      );
    });
  });

  describe('getUserById', () => {
    it('should return AuthUser when found', async () => {
      mockQuery({ data: sampleUser, error: null });

      const result = await getUserById('uuid-123');

      expect(result).toEqual(sampleUser);
    });

    it('should return null when not found', async () => {
      mockQuery({ data: null, error: { code: 'PGRST116' } });

      const result = await getUserById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockQuery({ data: null, error: { message: 'connection failed' } });

      const result = await getUserById('any-id');

      expect(result).toBeNull();
    });
  });
});
