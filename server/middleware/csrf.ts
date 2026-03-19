import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection via custom header check.
 *
 * Since Spendly uses Bearer token auth (not cookie-based sessions for auth),
 * we protect against CSRF by requiring a custom X-Requested-With header on
 * all state-changing requests. Browsers block cross-origin custom headers
 * unless the server explicitly allows them via CORS preflight.
 *
 * This is the OWASP-recommended approach for APIs using token auth:
 * https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 *
 * Exempt paths: webhooks (no browser origin), health checks.
 */

const EXEMPT_PATHS = [
  '/api/health',
  '/api/paystack/webhook',
  '/api/kyc/stripe/webhook',
  '/api/stripe/webhook',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip safe (read-only) methods
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Skip exempt paths (webhooks use their own signature verification)
  if (EXEMPT_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  // Require X-Requested-With header on all state-changing requests
  const xRequestedWith = req.headers['x-requested-with'];
  if (!xRequestedWith) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Missing required X-Requested-With header',
    });
  }

  next();
}
