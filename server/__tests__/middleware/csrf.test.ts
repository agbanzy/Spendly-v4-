import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrfProtection } from '../../middleware/csrf';

/**
 * Creates mock Express req/res/next for testing middleware.
 */
function createMocks(overrides: {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
} = {}) {
  const req: any = {
    method: overrides.method || 'POST',
    path: overrides.path || '/api/transactions',
    headers: overrides.headers || {},
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
// Safe methods bypass CSRF
// ============================================================================
describe('CSRF: Safe methods', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('skips CSRF check for %s requests', (method) => {
    const { req, res, next } = createMocks({ method });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBe(0); // no error status set
  });
});

// ============================================================================
// Exempt paths bypass CSRF
// ============================================================================
describe('CSRF: Exempt paths', () => {
  const exemptPaths = [
    '/api/health',
    '/api/paystack/webhook',
    '/api/kyc/stripe/webhook',
    '/api/stripe/webhook',
  ];

  it.each(exemptPaths)('skips CSRF check for exempt path: %s', (path) => {
    const { req, res, next } = createMocks({ method: 'POST', path });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('skips CSRF for paths that start with an exempt prefix', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/health/detailed',
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// State-changing requests require X-Requested-With header
// ============================================================================
describe('CSRF: State-changing requests', () => {
  it('blocks POST without X-Requested-With header', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/transactions',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json.error).toBe('Forbidden');
    expect(res._json.message).toContain('X-Requested-With');
  });

  it('blocks PUT without X-Requested-With header', () => {
    const { req, res, next } = createMocks({
      method: 'PUT',
      path: '/api/accounts/123',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('blocks DELETE without X-Requested-With header', () => {
    const { req, res, next } = createMocks({
      method: 'DELETE',
      path: '/api/accounts/123',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('blocks PATCH without X-Requested-With header', () => {
    const { req, res, next } = createMocks({
      method: 'PATCH',
      path: '/api/accounts/123',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('allows POST with X-Requested-With header', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/transactions',
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows any value for X-Requested-With header (just needs to be present)', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/transactions',
      headers: { 'x-requested-with': 'SpendlyApp' },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// Non-exempt paths must have header
// ============================================================================
describe('CSRF: Non-exempt paths', () => {
  it('requires header on /api/transfers', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/transfers',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  it('requires header on /api/payroll (not a webhook path)', () => {
    const { req, res, next } = createMocks({
      method: 'POST',
      path: '/api/payroll',
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });
});
