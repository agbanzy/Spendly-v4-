import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { idTokenVerifier, isCognitoConfigured } from '../cognito-verifier';

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
    }
  }
}

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
 * Middleware to verify admin user session
 * Checks if user has admin privileges (OWNER or ADMIN role)
 *
 * SECURITY: First tries Cognito token auth (preferred), then falls back
 * to x-admin-user-id header for backward compatibility (dev only).
 * In production, Cognito token is strongly preferred.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Preferred: Use Cognito token to identify admin
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && idTokenVerifier && isCognitoConfigured) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const payload = await idTokenVerifier.verify(token);
        // Look up user by Cognito sub
        const userProfile = await storage.getUserProfileByCognitoSub(payload.sub);
        if (userProfile) {
          const adminUser = await storage.getUserByEmail(userProfile.email);
          if (adminUser && ['OWNER', 'ADMIN'].includes(adminUser.role)) {
            req.adminUser = {
              id: adminUser.id,
              username: adminUser.username,
              email: adminUser.email,
              role: adminUser.role,
            };
            return next();
          }
        }
      } catch (verifyError) {
        // Token invalid, fall through to header-based auth
      }
    }

    // SECURITY: No valid admin token found — reject
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authentication requires a valid Cognito token'
    });
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin credentials'
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
