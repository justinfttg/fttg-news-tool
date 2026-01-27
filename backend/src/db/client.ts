/**
 * FTTG Content Intelligence Platform
 * Database Connection Service
 *
 * Exports:
 *  - supabase        — Typed Supabase client (service role, server-side)
 *  - supabaseAnon    — Typed Supabase client (anon key, client-safe)
 *  - pool            — Raw PostgreSQL connection pool (lazy, with retry)
 *  - query / queryOne / withTransaction — pg helper functions
 *  - testConnection  — Health-check (Supabase first, pg fallback)
 *  - Database types   re-exported from database.types.ts
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { Database } from './database.types';

// Re-export all database types for consumers
export type { Database } from './database.types';
export * from './database.types';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

function validateEnv(): void {
  const required: Record<string, string> = {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(`[db] Missing required env vars: ${missing.join(', ')}`);
  }

  // Optional but useful warnings
  if (!SUPABASE_ANON_KEY && process.env.NODE_ENV !== 'test') {
    console.warn('[db] SUPABASE_ANON_KEY not set — supabaseAnon client will not work');
  }
  if (!DATABASE_URL && process.env.NODE_ENV !== 'test') {
    console.warn('[db] DATABASE_URL not set — raw pg pool unavailable');
  }
}
validateEnv();

// ---------------------------------------------------------------------------
// Supabase Clients (primary data access — works over HTTPS)
// ---------------------------------------------------------------------------

/** Service-role client — full table access, bypasses RLS. Server-side only. */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);

/** Anon-key client — respects RLS, safe to expose to the frontend. */
export const supabaseAnon: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY // fall back to service key if anon not set
);

/**
 * Typed Supabase client — provides compile-time column/table checking.
 * Use this when writing new code that benefits from autocomplete.
 * Existing code can continue using the untyped `supabase` export.
 */
export const db = supabase as unknown as SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// PostgreSQL Connection Pool (for complex raw SQL / full-text search / joins)
// ---------------------------------------------------------------------------

const PG_RETRY_ATTEMPTS = 3;
const PG_RETRY_DELAY_MS = 2000;

let _pool: Pool | null = null;

function createPool(): Pool {
  const config: PoolConfig = {
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  const p = new Pool(config);

  p.on('error', (err) => {
    console.error('[db/pg] Unexpected pool error:', err.message);
    // Destroy the broken pool so the next call creates a fresh one
    _pool = null;
  });

  p.on('connect', () => {
    console.log('[db/pg] New client connected to pool');
  });

  return p;
}

/** Lazily initialised pg pool. Recreated automatically after fatal errors. */
export function getPool(): Pool {
  if (!_pool) {
    if (!DATABASE_URL) {
      throw new Error('[db/pg] DATABASE_URL is not configured — cannot create pool');
    }
    _pool = createPool();
  }
  return _pool;
}

// Named export so consumers can do `import { pool } from './client'`
export { getPool as pool };

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts: number = PG_RETRY_ATTEMPTS,
  delayMs: number = PG_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < attempts) {
        console.warn(`[db] ${label} failed (attempt ${i}/${attempts}): ${lastError.message}. Retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  console.error(`[db] ${label} failed after ${attempts} attempts`);
  throw lastError;
}

// ---------------------------------------------------------------------------
// Raw SQL Query Helpers (pg pool with retry)
// ---------------------------------------------------------------------------

/** Execute a query and return all rows. Retries on transient failures. */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  return withRetry(async () => {
    const result = await getPool().query(text, params);
    return result.rows as T[];
  }, 'query');
}

/** Execute a query and return the first row, or null. Retries on transient failures. */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  return withRetry(async () => {
    const result = await getPool().query(text, params);
    return (result.rows[0] as T) ?? null;
  }, 'queryOne');
}

/** Run a callback inside a database transaction. Retries the entire transaction on failure. */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }, 'transaction');
}

// ---------------------------------------------------------------------------
// Connection Health Checks
// ---------------------------------------------------------------------------

/** Test Supabase REST connection. Returns true if the API responds. */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    if (error && error.code !== 'PGRST205') {
      console.error('[db/supabase] Connection test failed:', error.message);
      return false;
    }
    console.log('[db/supabase] Connection successful');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[db/supabase] Connection test error:', msg);
    return false;
  }
}

/** Test raw pg connection with retry. Returns true if SELECT 1 succeeds. */
export async function testPgConnection(): Promise<boolean> {
  if (!DATABASE_URL) {
    console.warn('[db/pg] DATABASE_URL not configured — skipping pg test');
    return false;
  }
  try {
    await withRetry(async () => {
      await getPool().query('SELECT 1');
    }, 'pg-health-check');
    console.log('[db/pg] Connection successful');
    return true;
  } catch {
    console.error('[db/pg] Connection failed after retries');
    return false;
  }
}

/** Combined health check — Supabase first (always works), pg second (optional). */
export async function testConnection(): Promise<boolean> {
  const supabaseOk = await testSupabaseConnection();
  if (!supabaseOk) return false;

  // pg is best-effort — don't fail the health check if it's unavailable
  if (DATABASE_URL) {
    const pgOk = await testPgConnection();
    if (!pgOk) {
      console.warn('[db] pg connection unavailable — Supabase REST will be used exclusively');
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

export async function closeConnections(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    console.log('[db/pg] Pool closed');
  }
}
