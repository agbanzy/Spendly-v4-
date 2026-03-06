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

const isDevelopment = process.env.NODE_ENV === 'development';

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
      // SECURITY: In production, fail-closed if Cognito not configured
      if (!isDevelopment) {
        console.error('SECURITY: Cognito not configured in production - rejecting request');
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Authentication service not configured'
        });
      }
      // Only in development: bypass with warning and extract user from token payload
      console.warn('DEV MODE: Cognito not configured - bypassing token verification');

      // Try to decode the token payload (not verified, but useful for dev)
      try {
        const [, payloadBase64] = token.split('.');
        if (payloadBase64) {
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
          req.user = {
            uid: payload.sub || payload.user_id || 'dev-user',
            cognitoSub: payload.sub || payload.user_id || 'dev-user',
            email: payload.email || 'dev@example.com',
            displayName: payload.name || payload['cognito:username'] || 'Dev User',
          };
        }
      } catch (e) {
        // If token parsing fails, set a default dev user
        req.user = {
          uid: 'dev-user',
          cognitoSub: 'dev-user',
          email: 'dev@example.com',
          displayName: 'Dev User',
        };
      }
      return next();
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
          const users = await storage.getUsers();
          const adminUser = users.find(u => u.email === userProfile.email || u.id === userProfile.id?.toString());
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

    // SECURITY: Header-based admin auth ONLY in development
    if (!isDevelopment) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication requires a valid Cognito token'
      });
    }

    // DEV ONLY: Fallback to header-based auth for local testing
    console.warn('DEV MODE: Using x-admin-user-id header for admin auth');
    const adminUserId = req.headers['x-admin-user-id'] as string;

    if (!adminUserId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required'
      });
    }

    const users = await storage.getUsers();
    const adminUser = users.find(u => u.id === adminUserId);

    if (!adminUser || !['OWNER', 'ADMIN'].includes(adminUser.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin privileges required'
      });
    }

    req.adminUser = {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role,
    };

    next();
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
