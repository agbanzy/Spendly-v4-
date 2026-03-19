import { describe, it, expect, vi } from 'vitest';
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from '../../lib/api-response';

/**
 * Creates a mock Express Response object for testing.
 * Tracks status code and JSON body for assertions.
 */
function createMockRes() {
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
  return res;
}

// ============================================================================
// apiSuccess
// ============================================================================
describe('apiSuccess', () => {
  it('returns 200 with success true and data by default', () => {
    const res = createMockRes();
    apiSuccess(res, { id: 1, name: 'Test' });
    expect(res._status).toBe(200);
    expect(res._json).toEqual({ success: true, data: { id: 1, name: 'Test' } });
  });

  it('accepts a custom status code', () => {
    const res = createMockRes();
    apiSuccess(res, { created: true }, 201);
    expect(res._status).toBe(201);
    expect(res._json).toEqual({ success: true, data: { created: true } });
  });

  it('handles null data', () => {
    const res = createMockRes();
    apiSuccess(res, null);
    expect(res._json).toEqual({ success: true, data: null });
  });

  it('handles array data', () => {
    const res = createMockRes();
    apiSuccess(res, [1, 2, 3]);
    expect(res._json).toEqual({ success: true, data: [1, 2, 3] });
  });

  it('handles string data', () => {
    const res = createMockRes();
    apiSuccess(res, 'ok');
    expect(res._json).toEqual({ success: true, data: 'ok' });
  });
});

// ============================================================================
// apiError
// ============================================================================
describe('apiError', () => {
  it('returns 400 with success false and error message by default', () => {
    const res = createMockRes();
    apiError(res, 'Validation failed');
    expect(res._status).toBe(400);
    expect(res._json).toEqual({ success: false, error: 'Validation failed' });
  });

  it('accepts a custom status code', () => {
    const res = createMockRes();
    apiError(res, 'Rate limited', 429);
    expect(res._status).toBe(429);
    expect(res._json).toEqual({ success: false, error: 'Rate limited' });
  });
});

// ============================================================================
// apiNotFound
// ============================================================================
describe('apiNotFound', () => {
  it('returns 404 with default "Resource not found" message', () => {
    const res = createMockRes();
    apiNotFound(res);
    expect(res._status).toBe(404);
    expect(res._json).toEqual({ success: false, error: 'Resource not found' });
  });

  it('uses custom entity name in the message', () => {
    const res = createMockRes();
    apiNotFound(res, 'Transaction');
    expect(res._json).toEqual({ success: false, error: 'Transaction not found' });
  });
});

// ============================================================================
// apiUnauthorized
// ============================================================================
describe('apiUnauthorized', () => {
  it('returns 401 with default "Unauthorized" message', () => {
    const res = createMockRes();
    apiUnauthorized(res);
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('uses custom message', () => {
    const res = createMockRes();
    apiUnauthorized(res, 'Token expired');
    expect(res._json).toEqual({ success: false, error: 'Token expired' });
  });
});

// ============================================================================
// apiForbidden
// ============================================================================
describe('apiForbidden', () => {
  it('returns 403 with default "Access denied" message', () => {
    const res = createMockRes();
    apiForbidden(res);
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ success: false, error: 'Access denied' });
  });

  it('uses custom message', () => {
    const res = createMockRes();
    apiForbidden(res, 'Insufficient permissions');
    expect(res._json).toEqual({ success: false, error: 'Insufficient permissions' });
  });
});

// ============================================================================
// apiServerError
// ============================================================================
describe('apiServerError', () => {
  it('returns 500 with default "Internal server error" message', () => {
    const res = createMockRes();
    apiServerError(res);
    expect(res._status).toBe(500);
    expect(res._json).toEqual({ success: false, error: 'Internal server error' });
  });

  it('uses custom message', () => {
    const res = createMockRes();
    apiServerError(res, 'Database connection failed');
    expect(res._json).toEqual({ success: false, error: 'Database connection failed' });
  });
});

// ============================================================================
// Response shape consistency
// ============================================================================
describe('Response shape consistency', () => {
  it('all success responses include success: true and data key', () => {
    const res = createMockRes();
    apiSuccess(res, 'test');
    expect(res._json).toHaveProperty('success', true);
    expect(res._json).toHaveProperty('data');
    expect(res._json).not.toHaveProperty('error');
  });

  it('all error responses include success: false and error key', () => {
    const fns = [
      () => { const r = createMockRes(); apiError(r, 'e'); return r; },
      () => { const r = createMockRes(); apiNotFound(r); return r; },
      () => { const r = createMockRes(); apiUnauthorized(r); return r; },
      () => { const r = createMockRes(); apiForbidden(r); return r; },
      () => { const r = createMockRes(); apiServerError(r); return r; },
    ];

    for (const fn of fns) {
      const r = fn();
      expect(r._json).toHaveProperty('success', false);
      expect(r._json).toHaveProperty('error');
      expect(r._json).not.toHaveProperty('data');
    }
  });
});
