import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { idTokenVerifier, isCognitoConfigured } from '../cognito-verifier';
import { isFeatureFlagOn } from '../lib/feature-flags';

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        cognitoSub: string;
        email: string;
        displayName?: string;
        role?: string;
      };
      adminUser?: {
        id: string;
        username: string;
        email: string;
        role: string;
      };
      // LU-DD-1: when admin_per_company is on, we attach the company
      // context the admin authorised under so downstream handlers can
      // scope queries without a second `resolveUserCompany` round-trip.
      adminCompany?: {
        companyId: string;
        role: string;
      };
    }
  }
}

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

/**
 * Middleware to verify Cognito ID token from Authorization header
 * Expected header format: "Authorization: Bearer <cognito_id_token>"
 * SECURITY: Fail-closed in production - rejects all requests if Cognito not configured
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify Cognito ID token
    if (!idTokenVerifier || !isCognitoConfigured) {
      // SECURITY: Fail-closed — reject all requests if Cognito is not configured
      console.error('SECURITY: Cognito not configured - rejecting request');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service not configured'
      });
    }

    try {
      const payload = await idTokenVerifier.verify(token);

      // Attach verified user info to request
      req.user = {
        uid: payload.sub,
        cognitoSub: payload.sub,
        email: (payload.email as string) || '',
        displayName: (payload.name as string) || (payload['cognito:username'] as string),
      };

      next();
    } catch (verifyError) {
      console.error('Cognito token verification failed:', verifyError);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Failed to authenticate token'
    });
  }
}

/**
 * Resolve the user's role inside their active company by reading the
 * `companyMembers` table. Honors the `X-Company-Id` header to disambiguate
 * users with multiple memberships, otherwise picks the first active row.
 *
 * Returns `null` when the user has no active membership.
 *
 * Also returns the per-member `permissions` jsonb (an additive override on
 * top of the role's default permissions) so `requirePermission` can merge
 * them in a single round-trip.
 */
async function resolveActiveCompanyRole(
  cognitoSub: string,
  headerCompanyId: string | undefined,
): Promise<{ companyId: string; role: string; memberPermissions: string[] } | null> {
  const memberships = await storage.getUserCompanies(cognitoSub);
  if (!memberships || memberships.length === 0) return null;

  const pickPermissions = (m: any): string[] => {
    const raw = m?.permissions;
    if (!Array.isArray(raw)) return [];
    return raw.filter((p: unknown): p is string => typeof p === 'string');
  };

  if (headerCompanyId) {
    const match = memberships.find((m) => m.companyId === headerCompanyId);
    if (match) {
      return {
        companyId: match.companyId,
        role: match.role,
        memberPermissions: pickPermissions(match),
      };
    }
  }
  const first = memberships[0];
  return {
    companyId: first.companyId,
    role: first.role,
    memberPermissions: pickPermissions(first),
  };
}

// LU-DD-4 / AUD-DD-TEAM-002 — Permission cache. Role → permissions
// rarely changes, but `requirePermission` runs on every gated request.
// 60-second TTL matches the feature-flag cache and keeps the hot path off
// the database. Invalidated explicitly when an admin edits a role via
// PUT /admin/roles/:role (see `invalidateRolePermissionsCache`).
const ROLE_PERMS_CACHE_TTL_MS = 60_000;
type RoleCacheEntry = { permissions: string[] | null; expiresAt: number };
const rolePermissionsCache = new Map<string, RoleCacheEntry>();

async function getCachedRolePermissions(role: string): Promise<string[] | null> {
  const hit = rolePermissionsCache.get(role);
  if (hit && hit.expiresAt > Date.now()) return hit.permissions;
  const fresh = await storage.getPermissionsForRole(role);
  rolePermissionsCache.set(role, {
    permissions: fresh,
    expiresAt: Date.now() + ROLE_PERMS_CACHE_TTL_MS,
  });
  return fresh;
}

/**
 * Test/ops helper — drop the role-permissions cache so a permission edit
 * is visible to subsequent requests immediately. Called by the
 * PUT /admin/roles/:role route after a successful update; also exported
 * for unit tests.
 */
export function invalidateRolePermissionsCache(role?: string): void {
  if (role) rolePermissionsCache.delete(role);
  else rolePermissionsCache.clear();
}

/**
 * Test helper — pre-seed the cache with a known value, bypassing the DB
 * lookup. Only intended for unit tests.
 */
export function _setRolePermissionsForTesting(role: string, permissions: string[] | null): void {
  rolePermissionsCache.set(role, {
    permissions,
    expiresAt: Date.now() + ROLE_PERMS_CACHE_TTL_MS,
  });
}

/**
 * Middleware factory: gate an endpoint on a specific permission.
 *
 * LU-DD-4 / AUD-DD-TEAM-002 — replaces the historical pattern of using
 * `requireAdmin` (which only checks role membership in OWNER/ADMIN) for
 * actions that semantically only need a finer-grained permission such as
 * VIEW_REPORTS or APPROVE_EXPENSE.
 *
 * Effective permissions = role's permissions (from `role_permissions`) ∪
 * per-member overrides (from `companyMembers.permissions`). The union
 * lets an org grant an EDITOR access to APPROVE_EXPENSE without changing
 * everyone's role.
 *
 * Like `requireAdmin`, this middleware verifies the Cognito token first
 * and resolves the user's active company-membership row. Pass the
 * `X-Company-Id` header to disambiguate when the user is in multiple
 * companies.
 *
 * Usage:
 *   router.get('/admin/audit-logs', requirePermission('VIEW_REPORTS'), handler);
 */
export function requirePermission(name: string) {
  return async function permissionGate(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ') || !idTokenVerifier || !isCognitoConfigured) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token required',
        });
      }

      const token = authHeader.split('Bearer ')[1];
      let cognitoSub: string;
      try {
        const payload = await idTokenVerifier.verify(token);
        cognitoSub = payload.sub;
      } catch {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired authentication token',
        });
      }

      const headerCompanyId = req.headers['x-company-id'] as string | undefined;
      const active = await resolveActiveCompanyRole(cognitoSub, headerCompanyId);
      if (!active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No active company membership',
        });
      }

      const rolePerms = await getCachedRolePermissions(active.role);
      const effective = new Set<string>([
        ...(rolePerms ?? []),
        ...active.memberPermissions,
      ]);

      if (!effective.has(name)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Missing required permission: ${name}`,
          requiredPermission: name,
        });
      }

      // Attach context so downstream handlers don't need to re-resolve.
      req.adminCompany = { companyId: active.companyId, role: active.role };
      return next();
    } catch (error) {
      console.error('requirePermission error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware that gates admin endpoints.
 *
 * LU-DD-1 / AUD-DD-MT-004 — `requireAdmin` now supports two paths,
 * gated by the `admin_per_company` feature flag in `system_settings`:
 *
 *   - Flag OFF (legacy, default): consult `users.role` (a global, user-
 *     level field). A user who is OWNER/ADMIN there is granted admin on
 *     every admin route, regardless of which company they currently sit
 *     in. This is the historical behaviour and is preserved unchanged
 *     until the flag flips on tenant-by-tenant.
 *
 *   - Flag ON: consult `companyMembers.role` for the user's active
 *     company. The user must be OWNER or ADMIN in *that* company. This
 *     closes the cross-tenant admin escalation where an OWNER of
 *     company A could touch admin endpoints scoped to company B.
 *
 * Either path attaches `req.adminUser`. The new path also attaches
 * `req.adminCompany` so downstream handlers know which company the
 * authorisation was granted under (and can scope storage calls without
 * an extra `resolveUserCompany` lookup).
 *
 * Cognito token verification is required regardless of the flag.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || !idTokenVerifier || !isCognitoConfigured) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication requires a valid Cognito token',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    let cognitoSub: string;
    try {
      const payload = await idTokenVerifier.verify(token);
      cognitoSub = payload.sub;
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication requires a valid Cognito token',
      });
    }

    const userProfile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (!userProfile) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No user profile found for this token',
      });
    }

    const perCompany = await isFeatureFlagOn('admin_per_company');

    if (perCompany) {
      // ---- New path: company-membership role decides admin access ----
      const headerCompanyId = req.headers['x-company-id'] as string | undefined;
      const active = await resolveActiveCompanyRole(cognitoSub, headerCompanyId);
      if (!active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No active company membership',
        });
      }
      if (!ADMIN_ROLES.has(active.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient privileges in this company',
        });
      }
      // Construct an adminUser from the user-profile + active company role
      // so downstream handlers (which read req.adminUser) keep working.
      req.adminUser = {
        id: (userProfile as any).id,
        username: (userProfile as any).displayName || userProfile.email,
        email: userProfile.email,
        role: active.role,
      };
      // Only expose the public shape on req.adminCompany; memberPermissions
      // is an internal helper for requirePermission's union math.
      req.adminCompany = { companyId: active.companyId, role: active.role };
      return next();
    }

    // ---- Legacy path: user.role decides admin access (unchanged) ----
    const adminUser = await storage.getUserByEmail(userProfile.email);
    if (adminUser && ADMIN_ROLES.has(adminUser.role)) {
      req.adminUser = {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
      };
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient privileges',
    });
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin credentials',
    });
  }
}

/**
 * Middleware to check if user owns the resource they're trying to access
 * Compares cognitoSub from token with cognitoSub in request params
 */
export function requireOwnership(req: Request, res: Response, next: NextFunction) {
  const { cognitoSub } = req.params;

  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.cognitoSub !== cognitoSub) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own resources'
    });
  }

  next();
}

/**
 * Optional authentication middleware - attaches user if token present, but doesn't require it
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without user
    }

    const token = authHeader.split('Bearer ')[1];

    if (!idTokenVerifier || !isCognitoConfigured) {
      return next(); // Cognito not configured, continue without verification
    }

    // Try to verify Cognito ID token (but don't fail if invalid)
    try {
      const payload = await idTokenVerifier.verify(token);
      req.user = {
        uid: payload.sub,
        cognitoSub: payload.sub,
        email: (payload.email as string) || '',
        displayName: (payload.name as string) || (payload['cognito:username'] as string),
      };
    } catch (verifyError) {
      // Invalid token, but that's okay for optional auth
      console.debug('Optional auth: Invalid token, continuing without user');
    }

    next();
  } catch (error) {
    // Error in optional auth shouldn't block the request
    console.error('Optional auth error:', error);
    next();
  }
}

/**
 * Middleware to enforce transaction PIN on sensitive financial operations.
 * PIN is MANDATORY — if user has no PIN set, they must set one first.
 * Expected header: "x-transaction-pin: <6-digit-pin>"
 * Must be used AFTER requireAuth (needs req.user).
 */
export async function requirePin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const profile = await storage.getUserProfileByCognitoSub(req.user.uid);

    // If no PIN is set, user must set one before performing sensitive actions
    if (!profile?.transactionPinHash || !profile?.transactionPinEnabled) {
      return res.status(403).json({
        error: 'Transaction PIN setup required',
        code: 'PIN_SETUP_REQUIRED',
        requiresPinSetup: true,
      });
    }

    const pin = req.headers['x-transaction-pin'] as string;
    if (!pin) {
      return res.status(403).json({
        error: 'Transaction PIN required',
        code: 'PIN_REQUIRED',
        requiresPin: true,
      });
    }

    // Validate PIN format
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(403).json({
        error: 'Invalid PIN format',
        code: 'PIN_INVALID',
        requiresPin: true,
      });
    }

    // Verify PIN against stored hash
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(pin, profile.transactionPinHash);
    if (!valid) {
      return res.status(403).json({
        error: 'Invalid transaction PIN',
        code: 'PIN_INVALID',
        requiresPin: true,
      });
    }

    next();
  } catch (error) {
    console.error('PIN verification error:', error);
    return res.status(500).json({ error: 'PIN verification failed' });
  }
}
