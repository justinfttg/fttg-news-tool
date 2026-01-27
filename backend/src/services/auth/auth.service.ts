import { supabase } from '../../db/client';
import { hashPassword, comparePassword } from './password';
import { generateToken } from './jwt';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  org_id: string | null;
  is_fttg_team: boolean;
}

/**
 * Register a new user account.
 * Returns the created user row (without password_hash).
 */
export async function registerUser(
  email: string,
  password: string,
  orgId?: string
): Promise<AuthUser> {
  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      org_id: orgId || null,
    })
    .select('id, email, full_name, org_id, is_fttg_team')
    .single();

  if (error || !user) {
    throw new Error(error?.message || 'Failed to create user');
  }

  return user as AuthUser;
}

/**
 * Authenticate an existing user.
 * Returns the user and a signed JWT on success.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const { data: row, error } = await supabase
    .from('users')
    .select('id, email, full_name, org_id, is_fttg_team, password_hash')
    .eq('email', email)
    .single();

  if (error || !row) {
    throw new Error('Invalid email or password');
  }

  const valid = await comparePassword(password, row.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const { password_hash: _, ...user } = row;

  const token = generateToken(user.id, user.email, {
    orgId: user.org_id,
    isFttgTeam: user.is_fttg_team,
  });

  return { user: user as AuthUser, token };
}

/**
 * Look up a user by primary key. Returns null when not found.
 */
export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, org_id, is_fttg_team')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as AuthUser;
}
