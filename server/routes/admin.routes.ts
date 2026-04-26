import express from "express";
import { param, resolveUserCompany, logAudit, getAuditUserName, header } from "./shared";
import { requireAuth, requireAdmin, requirePin, invalidateRolePermissionsCache } from "../middleware/auth";
import { authLimiter, sensitiveLimiter } from "../middleware/rateLimiter";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";
import { logger as baseLogger } from "../lib/logger";

const adminLogger = baseLogger.child({ module: "admin-routes" });

const router = express.Router();

// ==================== ADMIN ROUTES ====================

// Get audit logs
// AUD-DD-MT-002: previously called getAuditLogs() with no companyId,
// returning every audit log across every tenant to any admin caller.
// Now scopes to the caller's company.
router.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    if (!company) {
      return res.status(403).json({ error: "No active company membership" });
    }
    const logs = await storage.getAuditLogs(company.companyId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
  }
});

// Create audit log
router.post("/admin/audit-logs", requireAdmin, async (req, res) => {
  try {
    const { userId, userName, action, entityType, entityId, details, ipAddress, userAgent } = req.body;
    if (!userId || !userName || !action || !entityType) {
      return res.status(400).json({ error: "userId, userName, action, and entityType are required" });
    }
    const log = await storage.createAuditLog({
      userId,
      userName,
      action,
      entityType,
      entityId: entityId || null,
      details: details || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      createdAt: new Date().toISOString(),
      companyId: null,
    });
    res.status(201).json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create audit log" });
  }
});

// Get organization settings
router.get("/admin/organization", requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getOrganizationSettings();
    res.json(settings || {
      id: '1',
      name: 'My Organization',
      currency: 'USD',
      timezone: 'UTC',
      fiscalYearStart: 'January',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch organization settings" });
  }
});

// Update organization settings
router.put("/admin/organization", requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    const settings = await storage.updateOrganizationSettings({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update organization settings" });
  }
});

// Get system settings
router.get("/admin/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch system settings" });
  }
});

// Update system setting
router.put("/admin/settings/:key", requireAdmin, async (req, res) => {
  try {
    const key = param(req.params.key);
    const { value, description, category } = req.body;
    const setting = await storage.updateSystemSetting(key, {
      value,
      description,
      category,
      updatedAt: new Date().toISOString(),
    });
    res.json(setting);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update system setting" });
  }
});

// Get security settings
router.get("/admin/security", requireAdmin, async (req, res) => {
  try {
    const allSettings = await storage.getSystemSettings();
    const securitySettings = allSettings.filter((s) => s.category === "security");

    const defaults: Record<string, any> = {
      requireMfa: false,
      sessionTimeout: "30",
      passwordMinLength: "8",
      passwordRequireUppercase: true,
      passwordRequireNumber: true,
      passwordRequireSpecial: true,
      maxLoginAttempts: "5",
      lockoutDuration: "30",
      allowApiKeys: true,
      auditLogRetention: "90",
    };

    for (const setting of securitySettings) {
      if (setting.value != null) {
        try {
          defaults[setting.key] = JSON.parse(setting.value);
        } catch {
          defaults[setting.key] = setting.value;
        }
      }
    }

    res.json(defaults);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch security settings" });
  }
});

// Update security settings
router.put("/admin/security", requireAdmin, async (req, res) => {
  try {
    const settings = req.body;

    for (const key of Object.keys(settings)) {
      await storage.updateSystemSetting(key, {
        value: JSON.stringify(settings[key]),
        category: "security",
      });
    }

    res.json({ success: true, ...settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update security settings" });
  }
});

// Get role permissions
router.get("/admin/roles", requireAdmin, async (req, res) => {
  try {
    const roles = await storage.getRolePermissions();
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch role permissions" });
  }
});

// Update role permissions
router.put("/admin/roles/:role", requireAdmin, async (req, res) => {
  try {
    const role = param(req.params.role);
    const { permissions, description } = req.body;
    const updated = await storage.updateRolePermissions(role, {
      permissions,
      description,
      updatedAt: new Date().toISOString(),
    });
    // LU-DD-4 — drop the role's cached permissions so subsequent
    // requirePermission checks see the new mapping immediately rather
    // than after the 60s TTL expires.
    invalidateRolePermissionsCache(role);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update role permissions" });
  }
});

// ==================== ADMIN UTILITIES ====================

// Get all users (admin)
router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const usersList = await storage.getUsers();
    res.json(usersList);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});

// Update user (admin)
router.put("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const user = await storage.updateUser(param(req.params.id), req.body);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

// Delete user (admin)
router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteUser(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});

// ====================================================================
// LU-008 / AUD-BE-003 — Database purge: two-admin out-of-band approval
// ====================================================================
//
// The previous endpoint allowed any single admin to wipe all customer data
// behind a single 'CONFIRM_PURGE' string and recorded `userId: 'system'` in
// audit_logs. It is replaced by a two-step flow:
//
//   POST /admin/purge-database/initiate
//     → admin A (with PIN) creates a 30-minute pending intent
//     → out-of-band notification sent to all admins
//
//   POST /admin/purge-database/approve/:intentId
//     → admin B (with PIN) — must differ from initiator
//     → executes the purge and records BOTH identities in audit_logs
//
// A master feature flag in system_settings ('allow_purge_endpoint') gates the
// flow entirely; it defaults to 'false' in production and must be flipped
// directly in the database to enable the endpoint at all.
//
// The legacy endpoint returns 410 Gone.

const PURGE_INTENT_ACTION = 'purge_database';
const PURGE_INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function isPurgeAllowed(): Promise<boolean> {
  try {
    const all = await storage.getSystemSettings();
    const row = all.find((s: any) => s.key === 'allow_purge_endpoint');
    return (row as any)?.value === 'true';
  } catch (err) {
    adminLogger.error({ err }, 'Failed to read allow_purge_endpoint flag');
    return false;
  }
}

async function notifyAllAdminsOutOfBand(subject: string, body: string): Promise<void> {
  // Best-effort notification — don't block the request if email/SMS is down.
  try {
    const users = await storage.getUsers();
    const admins = users.filter((u: any) => u.role === 'OWNER' || u.role === 'ADMIN');
    for (const admin of admins as any[]) {
      const userId = admin.id;
      if (!userId) continue;
      try {
        await notificationService.send({
          userId,
          type: 'system_alert',
          title: subject,
          message: body,
          channels: ['email', 'in_app'],
        } as any);
      } catch (err) {
        adminLogger.warn({ err, adminId: userId }, 'Failed to notify admin of destructive action');
      }
    }
  } catch (err) {
    adminLogger.error({ err }, 'Failed to enumerate admins for out-of-band notification');
  }
}

// Step 1: initiate — admin A asks to purge.
router.post("/admin/purge-database/initiate", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    if (!(await isPurgeAllowed())) {
      return res.status(403).json({
        error: 'Database purge endpoint is disabled. Set system_settings.allow_purge_endpoint = true to enable (requires direct DB intervention).',
      });
    }

    const { tablesToPreserve } = req.body ?? {};
    const initiator = req.user!;

    const intent = await storage.createPendingDestructiveAction({
      action: PURGE_INTENT_ACTION,
      initiatedBy: initiator.cognitoSub,
      expiresAt: new Date(Date.now() + PURGE_INTENT_TTL_MS).toISOString(),
      payload: { tablesToPreserve: tablesToPreserve ?? null },
    } as any);

    await storage.createAuditLog({
      action: 'database_purge_initiated',
      userId: initiator.cognitoSub,
      userName: initiator.email || initiator.displayName || initiator.cognitoSub,
      entityType: 'database',
      entityId: intent.id,
      details: { intentId: intent.id, tablesToPreserve: tablesToPreserve ?? null, expiresAt: intent.expiresAt },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      createdAt: new Date().toISOString(),
      companyId: null,
    } as any);

    await notifyAllAdminsOutOfBand(
      'CRITICAL: database purge initiated',
      `Admin ${initiator.email || initiator.cognitoSub} has initiated a full database purge. Approval from a SECOND admin is required within 30 minutes. Intent ID: ${intent.id}.`,
    );

    adminLogger.warn({ intentId: intent.id, initiatedBy: initiator.cognitoSub }, 'Database purge intent created');

    return res.json({ intentId: intent.id, expiresAt: intent.expiresAt });
  } catch (error: any) {
    adminLogger.error({ err: error }, 'Failed to initiate database purge');
    return res.status(500).json({ error: error?.message ?? 'Failed to initiate purge' });
  }
});

// Step 2: approve — admin B (different from initiator) executes.
router.post("/admin/purge-database/approve/:intentId", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    if (!(await isPurgeAllowed())) {
      return res.status(403).json({ error: 'Database purge endpoint is disabled.' });
    }

    const intent = await storage.getPendingDestructiveAction(param(req.params.intentId));
    if (!intent) {
      return res.status(404).json({ error: 'Intent not found' });
    }
    if (intent.action !== PURGE_INTENT_ACTION) {
      return res.status(400).json({ error: 'Intent does not target the purge action' });
    }
    if (intent.executedAt) {
      return res.status(409).json({ error: 'Intent already executed' });
    }
    if (intent.expiresAt < new Date().toISOString()) {
      return res.status(410).json({ error: 'Intent expired' });
    }

    const approver = req.user!;
    if (intent.initiatedBy === approver.cognitoSub) {
      return res.status(403).json({ error: 'Two distinct admins are required (initiator and approver must differ)' });
    }

    const tablesToPreserve = (intent.payload as any)?.tablesToPreserve ?? undefined;
    const result = await storage.purgeDatabase(tablesToPreserve);

    const now = new Date().toISOString();
    await storage.markPendingDestructiveActionApproved(intent.id, {
      approvedBy: approver.cognitoSub,
      approvedAt: now,
      executedAt: now,
    });

    await storage.createAuditLog({
      action: 'database_purge_executed',
      userId: approver.cognitoSub,
      userName: approver.email || approver.displayName || approver.cognitoSub,
      entityType: 'database',
      entityId: intent.id,
      details: {
        intentId: intent.id,
        initiatedBy: intent.initiatedBy,
        approvedBy: approver.cognitoSub,
        purgedTables: result.purgedTables,
      },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      createdAt: now,
      companyId: null,
    } as any);

    adminLogger.warn({ intentId: intent.id, initiatedBy: intent.initiatedBy, approvedBy: approver.cognitoSub, purgedTables: result.purgedTables.length }, 'Database purge executed');

    return res.json(result);
  } catch (error: any) {
    adminLogger.error({ err: error }, 'Failed to approve/execute database purge');
    return res.status(500).json({ error: error?.message ?? 'Failed to approve purge' });
  }
});

// Legacy endpoint returns 410 with migration guidance.
router.post("/admin/purge-database", requireAuth, requireAdmin, async (_req, res) => {
  return res.status(410).json({
    error: 'This endpoint has been replaced. Use POST /api/admin/purge-database/initiate followed by POST /api/admin/purge-database/approve/:intentId. See LU-008 in the audit docs.',
  });
});

// Admin settings
router.get("/admin/admin-settings", requireAdmin, async (req, res) => {
  try {
    const settings = await storage.getAdminSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch admin settings" });
  }
});

router.put("/admin/admin-settings/:key", requireAdmin, async (req, res) => {
  try {
    const { value, description } = req.body;
    const setting = await storage.setAdminSetting(param(req.params.key), value, description);
    res.json(setting);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update admin setting" });
  }
});

// Single admin enforcement
router.post("/admin/set-single-admin", requireAdmin, async (req, res) => {
  try {
    const { adminUserId } = req.body;

    // Get all users
    const allUsers = await storage.getUsers();

    // Demote all other admins/owners to MANAGER
    for (const user of allUsers) {
      if (user.id !== adminUserId && (user.role === 'OWNER' || user.role === 'ADMIN')) {
        await storage.updateUser(user.id, { role: 'MANAGER' });
      }
    }

    // Promote specified user to OWNER
    const adminUser = await storage.updateUser(adminUserId, { role: 'OWNER' });

    // Set admin setting
    await storage.setAdminSetting('single_admin_id', adminUserId, 'The single admin user ID');
    await storage.setAdminSetting('single_admin_enforced', 'true', 'Whether single admin is enforced');

    res.json({ success: true, admin: adminUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to set single admin" });
  }
});

// ==================== ADMIN USER MANAGEMENT ====================

// Seed admin user (one-time setup — rate-limited, only works if no admin exists)
router.post("/admin/seed", authLimiter, async (req, res) => {
  try {
    const bcrypt = await import('bcryptjs');

    // Check if admin already exists
    const existingUsers = await storage.getUsers();
    const adminExists = existingUsers.some(u => u.role === 'OWNER' || u.username === 'admin');

    if (adminExists) {
      return res.status(400).json({ error: "Admin user already exists" });
    }

    // Create admin user with optional custom credentials
    const { username: customUsername, password: customPassword, email: customEmail, name: customName } = req.body || {};
    const adminUsername = customUsername || 'admin';
    const adminPassword = customPassword || 'Admin@123';
    const adminEmail = customEmail || 'info@thefinanciar.com';
    const adminName = customName || 'System Administrator';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = await storage.createUser({
      username: adminUsername,
      password: hashedPassword,
      name: adminName,
      email: adminEmail,
      role: 'OWNER',
      department: 'Administration',
    });

    res.status(201).json({
      message: "Admin user created successfully",
      username: adminUsername,
      note: 'Please change the password after first login'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create admin user" });
  }
});

// Admin login — supports both password-based and Cognito token-based auth
router.post("/admin/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const authHeader = req.headers.authorization;

    let authenticatedUser: any = null;

    // Method 1: Cognito Bearer token (preferred for Cognito-authenticated users)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { CognitoJwtVerifier } = await import('aws-jwt-verify');
        const poolId = process.env.COGNITO_USER_POOL_ID;
        const clientId = process.env.COGNITO_CLIENT_ID;
        if (poolId && clientId) {
          const verifier = CognitoJwtVerifier.create({ userPoolId: poolId, tokenUse: 'id', clientId });
          const token = authHeader.split('Bearer ')[1];
          const payload = await verifier.verify(token);
          const userProfile = await storage.getUserProfileByCognitoSub(payload.sub);
          if (userProfile) {
            // Check users table first, fall back to userProfile
            const existingUser = await storage.getUserByEmail(userProfile.email);
            if (existingUser && ['OWNER', 'ADMIN'].includes(existingUser.role)) {
              authenticatedUser = existingUser;
            } else {
              // Allow any Cognito user with OWNER role in their profile to access admin
              const profile = userProfile as any;
              if (profile.role === 'OWNER' || profile.role === 'ADMIN') {
                authenticatedUser = {
                  id: profile.id,
                  username: profile.email,
                  name: profile.displayName || profile.firstName || profile.email,
                  email: profile.email,
                  role: profile.role || 'OWNER',
                  department: 'Administration',
                };
              }
            }
          }
        }
      } catch (tokenErr: any) {
        console.error('Admin Cognito token verification failed:', tokenErr.message);
      }
    }

    // Method 2: Username + password (legacy local auth)
    if (!authenticatedUser && username && password) {
      const bcrypt = await import('bcryptjs');
      const users = await storage.getUsers();
      const user = users.find(u => u.username === username || u.email === username);

      if (user) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (isValidPassword && ['OWNER', 'ADMIN'].includes(user.role)) {
          authenticatedUser = user;
        }
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = authenticatedUser;

    // Send login alert email if user has email
    if (authenticatedUser.email) {
      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      notificationService.sendLoginAlertEmail({
        email: authenticatedUser.email,
        name: (authenticatedUser as any).displayName || authenticatedUser.name || authenticatedUser.username,
        loginTime: new Date().toLocaleString(),
        ipAddress: ipAddress?.split(',')[0],
        device: userAgent,
      }).catch(err => console.error('Failed to send login alert:', err));
    }

    res.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

// Admin session verification - validates stored admin session is still valid
router.post("/admin/verify-session", requireAuth, async (req, res) => {
  try {
    // SECURITY FIX: Use the authenticated user's identity, not client-supplied userId
    const cognitoSub = req.user!.cognitoSub;
    const userProfile = await storage.getUserProfileByCognitoSub(cognitoSub);
    const userId = userProfile?.id || (req.body.userId as string);

    if (!userId) {
      return res.status(400).json({ valid: false, error: "User ID is required" });
    }

    const users = await storage.getUsers();
    const user = users.find(u => u.id === userId || u.id === String(userId) || u.email === userProfile?.email);

    if (!user) {
      return res.status(401).json({ valid: false, error: "User not found" });
    }

    if (!['OWNER', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ valid: false, error: "Admin privileges revoked" });
    }

    // Return sanitized user info (no password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({ valid: true, user: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: "Session verification failed" });
  }
});

// ==================== AUDIT LOG ENDPOINTS ====================

// Get audit logs with optional filtering
router.get("/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId, limit = 50 } = req.query;
    const logs = await storage.getAuditLogs();

    let filtered = logs;

    // Filter by entity type if provided
    if (entityType) {
      filtered = filtered.filter(log => log.entityType === entityType);
    }

    // Filter by entity ID if provided
    if (entityId) {
      filtered = filtered.filter(log => log.entityId === entityId);
    }

    // Apply limit
    const limitNum = Math.min(parseInt(limit as string) || 50, 1000);
    filtered = filtered.slice(0, limitNum);

    res.json(filtered);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'audit');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

// Get audit trail for a specific entity
router.get("/audit-logs/:entityType/:entityId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const logs = await storage.getAuditLogs();

    const filtered = logs.filter(
      log => log.entityType === entityType && log.entityId === entityId
    );

    res.json(filtered);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'audit');
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

export default router;
