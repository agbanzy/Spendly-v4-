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

// Mock storage
vi.mock('../../storage', () => ({
  storage: {
    getUserProfileByCognitoSub: vi.fn(),
    getUserByEmail: vi.fn(),
  },
}));

import { requireAuth, requireOwnership } from '../../middleware/auth';
import { idTokenVerifier } from '../../cognito-verifier';

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
