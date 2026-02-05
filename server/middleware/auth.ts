import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        firebaseUid: string;
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

// Firebase Admin auth - optional import (graceful fallback if not configured)
let firebaseAuth: any = null;
let isFirebaseConfigured = false;
try {
  const firebaseAdmin = require('../firebase-admin');
  firebaseAuth = firebaseAdmin.auth;
  isFirebaseConfigured = firebaseAdmin.isFirebaseInitialized;
} catch (error) {
  console.warn('Firebase Admin not available - token verification disabled');
}

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Middleware to verify Firebase ID token from Authorization header
 * Expected header format: "Authorization: Bearer <firebase_id_token>"
 * SECURITY: Fail-closed in production - rejects all requests if Firebase not configured
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

    // Verify Firebase ID token with Firebase Admin SDK
    if (!firebaseAuth || !isFirebaseConfigured) {
      // SECURITY: In production, fail-closed if Firebase not configured
      if (!isDevelopment) {
        console.error('SECURITY: Firebase Admin not configured in production - rejecting request');
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Authentication service not configured'
        });
      }
      // Only in development: bypass with warning and extract user from token payload
      console.warn('DEV MODE: Firebase Admin not configured - bypassing token verification');
      
      // Try to decode the token payload (not verified, but useful for dev)
      try {
        const [, payloadBase64] = token.split('.');
        if (payloadBase64) {
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
          req.user = {
            uid: payload.user_id || payload.sub || 'dev-user',
            firebaseUid: payload.user_id || payload.sub || 'dev-user',
            email: payload.email || 'dev@example.com',
            displayName: payload.name || 'Dev User',
          };
        }
      } catch (e) {
        // If token parsing fails, set a default dev user
        req.user = {
          uid: 'dev-user',
          firebaseUid: 'dev-user',
          email: 'dev@example.com',
          displayName: 'Dev User',
        };
      }
      return next();
    }

    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);

      // Attach verified user info to request
      req.user = {
        uid: decodedToken.uid,
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name,
      };

      next();
    } catch (verifyError) {
      console.error('Firebase token verification failed:', verifyError);
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
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for admin user ID in header or session
    const adminUserId = req.headers['x-admin-user-id'] as string;

    if (!adminUserId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required'
      });
    }

    // Fetch admin user from database
    const users = await storage.getUsers();
    const adminUser = users.find(u => u.id === adminUserId);

    if (!adminUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid admin credentials'
      });
    }

    // Verify admin role
    if (!['OWNER', 'ADMIN'].includes(adminUser.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin privileges required'
      });
    }

    // Attach admin user to request
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
 * Compares firebaseUid from token with firebaseUid in request
 */
export function requireOwnership(req: Request, res: Response, next: NextFunction) {
  const { firebaseUid } = req.params;

  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.firebaseUid !== firebaseUid) {
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

    if (!firebaseAuth) {
      return next(); // Firebase not configured, continue without verification
    }

    // Try to verify Firebase ID token (but don't fail if invalid)
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      req.user = {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name,
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
