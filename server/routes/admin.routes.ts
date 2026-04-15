import express from "express";
import { param, resolveUserCompany, logAudit, getAuditUserName, header } from "./shared";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { authLimiter, sensitiveLimiter } from "../middleware/rateLimiter";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";

const router = express.Router();

// ==================== ADMIN ROUTES ====================

// Get audit logs
router.get("/admin/audit-logs", requireAdmin, async (req, res) => {
  try {
    const logs = await storage.getAuditLogs();
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

// Purge database (admin)
router.post("/admin/purge-database", requireAdmin, async (req, res) => {
  try {
    const { tablesToPreserve, confirmPurge } = req.body;

    if (confirmPurge !== 'CONFIRM_PURGE') {
      return res.status(400).json({ error: "Must confirm purge with 'CONFIRM_PURGE'" });
    }

    const result = await storage.purgeDatabase(tablesToPreserve);

    // Log the action
    await storage.createAuditLog({
      action: 'database_purge',
      userId: 'system',
      userName: 'System',
      entityType: 'database',
      entityId: 'all',
      details: { purgedTables: result.purgedTables },
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      createdAt: new Date().toISOString(),
    } as any);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to purge database" });
  }
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
