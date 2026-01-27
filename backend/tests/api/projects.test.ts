import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// Supabase mock factory — each .from() call returns its own isolated chain
// ---------------------------------------------------------------------------

type TerminalResult = { data: any; error: any };

/** Builds a self-referential chain where every method returns `this`. */
function makeChain(terminal: TerminalResult): any {
  const chain: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order'];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockResolvedValue(terminal);
  // For list-style queries that don't call .single(), resolve the last
  // chained call (eq/order/neq) to the terminal value.
  // We override the specific terminal method in each test scenario.
  return chain;
}

/**
 * Creates a `supabase.from()` mock that dispatches successive calls
 * to pre-configured chain objects.
 */
function mockFromSequence(chains: any[]) {
  let idx = 0;
  mockFrom.mockImplementation(() => {
    if (idx < chains.length) return chains[idx++];
    // fallback: return a chain that resolves to { data: null, error: null }
    return makeChain({ data: null, error: null });
  });
}

const mockFrom = jest.fn();

jest.mock('../../src/db/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock('../../src/services/auth/jwt', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
}));

import { verifyToken } from '../../src/services/auth/jwt';
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

import { authenticateRequest } from '../../src/middleware/auth.middleware';
import createHandler from '../../api/projects/create';
import listHandler from '../../api/projects/list';
import inviteHandler from '../../api/projects/invite';
import membersHandler from '../../api/projects/members';

// ---------------------------------------------------------------------------
// Express test app
// ---------------------------------------------------------------------------

function buildApp() {
  const a = express();
  a.use(express.json());
  a.post('/api/projects/create', authenticateRequest, createHandler);
  a.get('/api/projects/list', authenticateRequest, listHandler);
  a.post('/api/projects/invite', authenticateRequest, inviteHandler);
  a.get('/api/projects/members', authenticateRequest, membersHandler);
  return a;
}

const app = buildApp();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_TOKEN = 'valid-owner-token';
const EDITOR_TOKEN = 'valid-editor-token';

const ownerPayload = { userId: 'user-owner-111', email: 'owner@fttg.com', orgId: 'org-001', isFttgTeam: true };
const editorPayload = { userId: 'user-editor-222', email: 'editor@client.com', orgId: 'org-002', isFttgTeam: false };

const sampleProject = {
  id: 'proj-001', name: 'Test Project', description: 'A test project',
  owner_org_id: 'org-001', created_by_user_id: 'user-owner-111',
  posting_frequency: 'weekly', custom_frequency_days: null,
  video_quota_per_year: 52, start_date: '2025-01-06', end_date: '2025-12-31',
  status: 'active', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockImplementation(async (token: string) => {
    if (token === OWNER_TOKEN) return ownerPayload;
    if (token === EDITOR_TOKEN) return editorPayload;
    throw new Error('Invalid token');
  });
});

// ===== 1. CREATE PROJECT =====

describe('POST /api/projects/create', () => {
  const validBody = {
    name: 'Mediacorp Q1 2025', description: 'Weekly commentary project',
    postingFrequency: 'weekly', videoQuotaPerYear: 52,
    startDate: '2025-01-06', endDate: '2025-12-31',
  };

  it('should create a project and return 201 (success case)', async () => {
    // create.ts calls from('projects').insert().select().single()
    // then from('project_members').insert()
    const projectChain = makeChain({ data: sampleProject, error: null });
    const memberChain = makeChain({ data: null, error: null });
    mockFromSequence([projectChain, memberChain]);

    const res = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'proj-001');
    expect(res.body).toHaveProperty('name', 'Test Project');
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ description: 'no name or startDate' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body).toHaveProperty('details');
  });

  it('should return 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/projects/create')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Authentication required');
  });

  it('should return 401 when auth token is invalid', async () => {
    const res = await request(app)
      .post('/api/projects/create')
      .set('Authorization', 'Bearer bad-token')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('should return 400 when startDate is not a valid date', async () => {
    const res = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ ...validBody, startDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('should return 400 when name exceeds 255 characters', async () => {
    const res = await request(app)
      .post('/api/projects/create')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ ...validBody, name: 'x'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });
});

// ===== 2. LIST PROJECTS =====

describe('GET /api/projects/list', () => {
  it('should return projects for authenticated user (success case)', async () => {
    // list.ts: from('project_members').select().eq() — no .single()
    // then:    from('projects').select().in().neq().order() — no .single()
    const membershipsChain = makeChain({ data: null, error: null });
    // The list endpoint awaits the chain after .eq(), not .single()
    membershipsChain.eq = jest.fn().mockResolvedValue({
      data: [{ project_id: 'proj-001', role: 'owner' }, { project_id: 'proj-002', role: 'editor' }],
      error: null,
    });

    const projectsChain = makeChain({ data: null, error: null });
    projectsChain.order = jest.fn().mockResolvedValue({
      data: [
        { ...sampleProject, id: 'proj-001' },
        { ...sampleProject, id: 'proj-002', name: 'Project 2' },
      ],
      error: null,
    });

    mockFromSequence([membershipsChain, projectsChain]);

    const res = await request(app)
      .get('/api/projects/list')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('user_role', 'owner');
    expect(res.body[1]).toHaveProperty('user_role', 'editor');
  });

  it('should return empty array when user has no projects', async () => {
    const membershipsChain = makeChain({ data: null, error: null });
    membershipsChain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
    mockFromSequence([membershipsChain]);

    const res = await request(app)
      .get('/api/projects/list')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/projects/list');
    expect(res.status).toBe(401);
  });
});

// ===== 3. INVITE MEMBER =====

describe('POST /api/projects/invite', () => {
  const validInvite = {
    projectId: '00000000-0000-0000-0000-000000000001',
    email: 'newuser@example.com',
    role: 'editor' as const,
  };

  it('should invite a member and return 201 (success case)', async () => {
    // invite.ts makes 4 from() calls:
    // 1. from('project_members').select().eq().eq().single() — inviter check
    // 2. from('users').select().eq().single()                — find invitee
    // 3. from('project_members').select().eq().eq().single() — duplicate check
    // 4. from('project_members').insert().select().single()  — insert member
    const inviterChain = makeChain({ data: { role: 'owner', can_invite_members: true }, error: null });
    const inviteeChain = makeChain({ data: { id: 'user-new-333' }, error: null });
    const existingChain = makeChain({ data: null, error: { code: 'PGRST116' } });
    const insertChain = makeChain({
      data: { id: 'member-001', project_id: validInvite.projectId, user_id: 'user-new-333', role: 'editor' },
      error: null,
    });
    mockFromSequence([inviterChain, inviteeChain, existingChain, insertChain]);

    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send(validInvite);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('role', 'editor');
  });

  it('should return 404 when invitee email does not exist', async () => {
    const inviterChain = makeChain({ data: { role: 'owner', can_invite_members: true }, error: null });
    const inviteeChain = makeChain({ data: null, error: { code: 'PGRST116' } });
    mockFromSequence([inviterChain, inviteeChain]);

    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send(validInvite);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('User not found');
  });

  it('should return 403 when inviter lacks permission', async () => {
    const inviterChain = makeChain({ data: { role: 'viewer', can_invite_members: false }, error: null });
    mockFromSequence([inviterChain]);

    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${EDITOR_TOKEN}`)
      .send(validInvite);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('No permission');
  });

  it('should return 403 when inviter is not a member at all', async () => {
    const inviterChain = makeChain({ data: null, error: { code: 'PGRST116' } });
    mockFromSequence([inviterChain]);

    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${EDITOR_TOKEN}`)
      .send(validInvite);

    expect(res.status).toBe(403);
  });

  it('should return 409 when invitee is already a member', async () => {
    const inviterChain = makeChain({ data: { role: 'owner', can_invite_members: true }, error: null });
    const inviteeChain = makeChain({ data: { id: 'user-new-333' }, error: null });
    const existingChain = makeChain({ data: { id: 'existing-member' }, error: null });
    mockFromSequence([inviterChain, inviteeChain, existingChain]);

    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send(validInvite);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already a member');
  });

  it('should return 400 when projectId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ ...validInvite, projectId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('should return 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ ...validInvite, email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when role is not editor or viewer', async () => {
    const res = await request(app)
      .post('/api/projects/invite')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ ...validInvite, role: 'admin' });

    expect(res.status).toBe(400);
  });

  it('should return 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/projects/invite')
      .send(validInvite);

    expect(res.status).toBe(401);
  });
});

// ===== 4. GET MEMBERS =====

describe('GET /api/projects/members', () => {
  it('should return members with user details (success case)', async () => {
    const membersData = [
      {
        id: 'm-1', project_id: 'proj-001', user_id: 'user-owner-111',
        role: 'owner', can_create_stories: true, can_approve_stories: true,
        can_generate_scripts: true, can_invite_members: true,
        invited_by_user_id: null, invited_at: '2025-01-01T00:00:00Z',
        users: { email: 'owner@fttg.com', full_name: 'Owner User' },
      },
      {
        id: 'm-2', project_id: 'proj-001', user_id: 'user-editor-222',
        role: 'editor', can_create_stories: true, can_approve_stories: false,
        can_generate_scripts: false, can_invite_members: false,
        invited_by_user_id: 'user-owner-111', invited_at: '2025-01-02T00:00:00Z',
        users: { email: 'editor@client.com', full_name: 'Editor User' },
      },
    ];

    // members.ts: from('project_members').select().eq().order().order()
    // The last .order() is the terminal — it should resolve to { data, error }
    const membersChain = makeChain({ data: null, error: null });
    // The chain is: .select() → .eq() → .order() → .order()
    // Each returns `this` except the terminal. Since we have two .order() calls,
    // the first returns `this`, the second resolves.
    let orderCallCount = 0;
    membersChain.order = jest.fn().mockImplementation(() => {
      orderCallCount++;
      if (orderCallCount >= 2) {
        return Promise.resolve({ data: membersData, error: null });
      }
      return membersChain;
    });
    mockFromSequence([membersChain]);

    const res = await request(app)
      .get('/api/projects/members?projectId=proj-001')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('email', 'owner@fttg.com');
    expect(res.body[0]).toHaveProperty('full_name', 'Owner User');
    expect(res.body[1]).toHaveProperty('role', 'editor');
  });

  it('should return 400 when projectId query param is missing', async () => {
    const res = await request(app)
      .get('/api/projects/members')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('projectId');
  });

  it('should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/projects/members?projectId=proj-001');
    expect(res.status).toBe(401);
  });
});

// ===== 5. PROJECT QUERIES (unit-level) — getProjectById, updateProject, deleteProject =====

describe('project.queries — authorization', () => {
  let queries: typeof import('../../src/db/queries/project.queries');

  beforeAll(async () => {
    queries = await import('../../src/db/queries/project.queries');
  });

  describe('getProjectById', () => {
    it('should return project with role when user is a member', async () => {
      const membershipChain = makeChain({ data: { role: 'owner' }, error: null });
      const projectChain = makeChain({ data: sampleProject, error: null });
      mockFromSequence([membershipChain, projectChain]);

      const result = await queries.getProjectById('proj-001', 'user-owner-111');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('proj-001');
      expect(result!.user_role).toBe('owner');
    });

    it('should return null when user is NOT a member', async () => {
      const membershipChain = makeChain({ data: null, error: { code: 'PGRST116' } });
      mockFromSequence([membershipChain]);

      const result = await queries.getProjectById('proj-001', 'stranger');
      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('should throw when non-owner tries to update', async () => {
      const membershipChain = makeChain({ data: { role: 'editor' }, error: null });
      mockFromSequence([membershipChain]);

      await expect(
        queries.updateProject('proj-001', 'user-editor-222', { name: 'Hacked' })
      ).rejects.toThrow('Only the project owner can update project settings');
    });

    it('should throw when user is not a member', async () => {
      const membershipChain = makeChain({ data: null, error: { code: 'PGRST116' } });
      mockFromSequence([membershipChain]);

      await expect(
        queries.updateProject('proj-001', 'stranger', { name: 'Nope' })
      ).rejects.toThrow('Project not found or access denied');
    });

    it('should update and return project when user is owner', async () => {
      const membershipChain = makeChain({ data: { role: 'owner' }, error: null });
      const updateChain = makeChain({ data: { ...sampleProject, name: 'Updated Name' }, error: null });
      mockFromSequence([membershipChain, updateChain]);

      const result = await queries.updateProject('proj-001', 'user-owner-111', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteProject', () => {
    it('should throw when non-owner tries to delete', async () => {
      const membershipChain = makeChain({ data: { role: 'viewer' }, error: null });
      mockFromSequence([membershipChain]);

      await expect(
        queries.deleteProject('proj-001', 'user-viewer-333')
      ).rejects.toThrow('Only the project owner can delete the project');
    });

    it('should throw when user is not a member', async () => {
      const membershipChain = makeChain({ data: null, error: { code: 'PGRST116' } });
      mockFromSequence([membershipChain]);

      await expect(
        queries.deleteProject('proj-001', 'stranger')
      ).rejects.toThrow('Project not found or access denied');
    });

    it('should succeed when user is owner', async () => {
      const membershipChain = makeChain({ data: { role: 'owner' }, error: null });
      // deleteProject: from('project_members').select().eq().eq().single()  — membership check
      // then:          from('projects').delete().eq()  — the delete
      // The delete chain resolves after .eq() with { error: null }
      const deleteChain = makeChain({ data: null, error: null });
      deleteChain.eq = jest.fn().mockResolvedValue({ error: null });
      mockFromSequence([membershipChain, deleteChain]);

      await expect(
        queries.deleteProject('proj-001', 'user-owner-111')
      ).resolves.toBeUndefined();
    });
  });
});
