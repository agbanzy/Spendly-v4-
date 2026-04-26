import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for auth middleware.
 *
 * We mock the Cognito verifier and storage to isolate middleware logic.
 * Tests focus on the requireAuth and requireOwnership functions.
 */

// Mock the cognito-verifier module
vi.mock('../../cognito-verifier', () => ({
  idTokenVerifier: {
    verify: vi.fn(),
  },
  isCognitoConfigured: true,
}));

// Mock storage — extended in this PR with getUserCompanies + getSystemSettings
// for the LU-DD-1 requireAdmin per-company-role path.
vi.mock('../../storage', () => ({
  storage: {
    getUserProfileByCognitoSub: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserCompanies: vi.fn(),
    getSystemSettings: vi.fn().mockResolvedValue([]),
  },
}));

import { requireAuth, requireAdmin, requireOwnership } from '../../middleware/auth';
import { idTokenVerifier } from '../../cognito-verifier';
import { storage } from '../../storage';
import { _setFeatureFlagForTesting, invalidateFeatureFlagCache } from '../../lib/feature-flags';

function createMocks(overrides: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  user?: any;
} = {}) {
  const req: any = {
    headers: overrides.headers || {},
    params: overrides.params || {},
    user: overrides.user || undefined,
  };

  const res: any = {
    _status: 0,
    _json: null as any,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: any) {
      res._json = body;
      return res;
    },
  };

  const next = vi.fn();
  return { req, res, next };
}

// ============================================================================
// requireAuth
// ============================================================================
describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request with no Authorization header', async () => {
    const { req, res, next } = createMocks({ headers: {} });
    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json.message).toContain('No authentication token');
  });

  it('rejects request with Authorization header that does not start with Bearer', async () => {
    const { req, res, next } = createMocks({
      headers: { authorization: 'Basic abc123' },
    });
    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('calls next and attaches user on valid token', async () => {
    (idTokenVerifier.verify as any).mockResolvedValue({
      sub: 'user-sub-123',
      email: 'test@example.com',
      name: 'Test User',
    });

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer valid-token' },
    });

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      uid: 'user-sub-123',
      cognitoSub: 'user-sub-123',
      email: 'test@example.com',
      displayName: 'Test User',
    });
  });

  it('returns 401 when token verification fails', async () => {
    (idTokenVerifier.verify as any).mockRejectedValue(new Error('Token expired'));

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer expired-token' },
    });

    // Suppress console.error for this test
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json.message).toContain('Invalid or expired');

    vi.restoreAllMocks();
  });

  it('uses cognito:username as displayName fallback when name is not present', async () => {
    (idTokenVerifier.verify as any).mockResolvedValue({
      sub: 'user-sub-456',
      email: 'user@test.com',
      'cognito:username': 'johndoe',
    });

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer valid-token' },
    });

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user.displayName).toBe('johndoe');
  });
});

// ============================================================================
// requireAuth with Cognito not configured
// ============================================================================
describe('requireAuth: Cognito not configured', () => {
  it('returns 503 when Cognito is not configured (fail-closed)', async () => {
    // Temporarily override the module mock
    const cognitoMod = await import('../../cognito-verifier');
    const origConfigured = cognitoMod.isCognitoConfigured;
    (cognitoMod as any).isCognitoConfigured = false;

    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer some-token' },
    });

    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(503);
    expect(res._json.message).toContain('Authentication service not configured');

    // Restore
    (cognitoMod as any).isCognitoConfigured = origConfigured;
    vi.restoreAllMocks();
  });
});

// ============================================================================
// requireOwnership
// ============================================================================
describe('requireOwnership', () => {
  it('calls next when user owns the resource', () => {
    const { req, res, next } = createMocks({
      params: { cognitoSub: 'user-123' },
      user: { uid: 'user-123', cognitoSub: 'user-123', email: 'test@test.com' },
    });

    requireOwnership(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user does not own the resource', () => {
    const { req, res, next } = createMocks({
      params: { cognitoSub: 'other-user-456' },
      user: { uid: 'user-123', cognitoSub: 'user-123', email: 'test@test.com' },
    });

    requireOwnership(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json.message).toContain('only access your own resources');
  });

  it('returns 401 when no user is on the request', () => {
    const { req, res, next } = createMocks({
      params: { cognitoSub: 'user-123' },
    });

    requireOwnership(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});

// ============================================================================
// requireAdmin — LU-DD-1 / AUD-DD-MT-004
// ============================================================================
//
// Two-path middleware gated by the `admin_per_company` feature flag:
//   - Flag OFF (default): consults the legacy global users.role
//   - Flag ON: consults companyMembers.role for the user's active company
//
// Tests exercise both paths plus the shared Cognito-token gate.
describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateFeatureFlagCache();
  });

  // ---- shared token gate ----

  it('returns 401 with no Authorization header (both paths)', async () => {
    _setFeatureFlagForTesting('admin_per_company', false);
    const { req, res, next } = createMocks({ headers: {} });
    await requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('returns 401 when Cognito verification throws', async () => {
    _setFeatureFlagForTesting('admin_per_company', false);
    (idTokenVerifier.verify as any).mockRejectedValue(new Error('expired'));

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer bad' },
    });
    await requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  it('returns 401 when no user profile is found for the cognitoSub', async () => {
    _setFeatureFlagForTesting('admin_per_company', false);
    (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'unknown' });
    (storage.getUserProfileByCognitoSub as any).mockResolvedValue(undefined);

    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer ok' },
    });
    await requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });

  // ---- legacy path (flag OFF) ----

  describe('legacy path (admin_per_company=false)', () => {
    beforeEach(() => {
      _setFeatureFlagForTesting('admin_per_company', false);
    });

    it('grants admin when users.role is OWNER', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'admin-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p1', email: 'admin@a.com', displayName: 'Admin A' });
      (storage.getUserByEmail as any).mockResolvedValue({ id: 'u1', username: 'admin', email: 'admin@a.com', role: 'OWNER' });

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.adminUser).toEqual({ id: 'u1', username: 'admin', email: 'admin@a.com', role: 'OWNER' });
      expect(req.adminCompany).toBeUndefined();
    });

    it('rejects when users.role is EMPLOYEE', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'emp-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p2', email: 'emp@a.com' });
      (storage.getUserByEmail as any).mockResolvedValue({ id: 'u2', username: 'emp', email: 'emp@a.com', role: 'EMPLOYEE' });

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
    });

    it('does NOT consult companyMembers when flag is off', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'mixed-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p3', email: 'mixed@a.com' });
      (storage.getUserByEmail as any).mockResolvedValue({ id: 'u3', username: 'mixed', email: 'mixed@a.com', role: 'OWNER' });
      // EMPLOYEE in their company would block in flag-on mode, but flag is off:
      (storage.getUserCompanies as any).mockResolvedValue([{ companyId: 'co-x', role: 'EMPLOYEE' }]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      // getUserCompanies should not have been used in legacy path
      expect((storage.getUserCompanies as any).mock.calls.length).toBe(0);
    });
  });

  // ---- new path (flag ON) ----

  describe('per-company path (admin_per_company=true)', () => {
    beforeEach(() => {
      _setFeatureFlagForTesting('admin_per_company', true);
    });

    it('grants admin when companyMembers.role is OWNER in active company', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'admin-2' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p4', email: 'owner@b.com', displayName: 'Owner B' });
      (storage.getUserCompanies as any).mockResolvedValue([{ companyId: 'co-b', role: 'OWNER', userId: 'admin-2' }]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.adminUser?.role).toBe('OWNER');
      expect(req.adminCompany).toEqual({ companyId: 'co-b', role: 'OWNER' });
    });

    it('rejects when companyMembers.role is EMPLOYEE even though users.role is OWNER', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'mixed-2' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p5', email: 'mixed@b.com' });
      // The legacy-mode escalation that flag-on closes:
      (storage.getUserByEmail as any).mockResolvedValue({ id: 'u5', username: 'mixed', email: 'mixed@b.com', role: 'OWNER' });
      (storage.getUserCompanies as any).mockResolvedValue([{ companyId: 'co-b', role: 'EMPLOYEE', userId: 'mixed-2' }]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
      expect(res._json.message).toContain('Insufficient privileges');
    });

    it('rejects with 403 when user has no company membership', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'orphan-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p6', email: 'orphan@x.com' });
      (storage.getUserCompanies as any).mockResolvedValue([]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
      expect(res._json.message).toContain('No active company membership');
    });

    it('honours X-Company-Id when the user is in multiple companies', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'multi-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p7', email: 'multi@x.com' });
      (storage.getUserCompanies as any).mockResolvedValue([
        { companyId: 'co-1', role: 'EMPLOYEE', userId: 'multi-1' },
        { companyId: 'co-2', role: 'OWNER', userId: 'multi-1' },
      ]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t', 'x-company-id': 'co-2' },
      });
      await requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.adminCompany?.companyId).toBe('co-2');
      expect(req.adminCompany?.role).toBe('OWNER');
    });

    it('falls back to first membership when X-Company-Id is missing', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'multi-2' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p8', email: 'multi2@x.com' });
      (storage.getUserCompanies as any).mockResolvedValue([
        { companyId: 'co-3', role: 'ADMIN', userId: 'multi-2' },
        { companyId: 'co-4', role: 'OWNER', userId: 'multi-2' },
      ]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t' },
      });
      await requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.adminCompany?.companyId).toBe('co-3');
    });

    it('rejects when X-Company-Id points to a company the user is not in', async () => {
      (idTokenVerifier.verify as any).mockResolvedValue({ sub: 'spoof-1' });
      (storage.getUserProfileByCognitoSub as any).mockResolvedValue({ id: 'p9', email: 's@x.com' });
      (storage.getUserCompanies as any).mockResolvedValue([
        { companyId: 'co-real', role: 'OWNER', userId: 'spoof-1' },
      ]);

      const { req, res, next } = createMocks({
        headers: { authorization: 'Bearer t', 'x-company-id': 'co-victim' },
      });
      await requireAdmin(req, res, next);
      // Should fall back to the user's actual first membership, not honour the spoof.
      expect(next).toHaveBeenCalledOnce();
      expect(req.adminCompany?.companyId).toBe('co-real');
    });
  });
});
