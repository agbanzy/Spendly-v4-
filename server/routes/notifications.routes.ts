import express from "express";
import { param, resolveUserCompany, logAudit, getAuditUserName, header } from "./shared";
import { requireAuth } from "../middleware/auth";
import { authLimiter, sensitiveLimiter, emailLimiter } from "../middleware/rateLimiter";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";

const router = express.Router();

// ==================== NOTIFICATIONS API ====================

// Get all notifications for a user
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const notifications = await storage.getNotifications(userId);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch notifications" });
  }
});

// Get unread notification count
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const notifications = await storage.getNotifications(userId);
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ count: unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch unread count" });
  }
});

// Mark notification as read
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(param(req.params.id));
    const notification = await storage.markNotificationRead(id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to mark notification as read" });
  }
});

// Mark all notifications as read
router.post("/notifications/mark-all-read", requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to mark all notifications as read" });
  }
});

// Delete notification
router.delete("/notifications/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(param(req.params.id));
    const deleted = await storage.deleteNotification(id);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete notification" });
  }
});

// Test email delivery - sends a test email via AWS SES
router.post("/notifications/test-email", emailLimiter, requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    // Default to the verified SES sender email for self-test
    const targetEmail = email || process.env.AWS_SES_FROM_EMAIL;
    if (!targetEmail) {
      return res.status(400).json({ error: "Email address is required (or set AWS_SES_FROM_EMAIL)" });
    }

    const result = await notificationService.sendWelcomeEmail({
      email: targetEmail,
      name: 'Test User',
    });

    if (result.success) {
      res.json({ success: true, message: `Test email sent to ${targetEmail}` });
    } else {
      // Check for SES sandbox error and provide helpful guidance
      const isSandboxError = result.error?.includes('not verified');
      res.status(isSandboxError ? 400 : 500).json({
        success: false,
        error: result.error || 'Failed to send test email',
        hint: isSandboxError
          ? 'AWS SES is in sandbox mode. Only verified email addresses can receive emails. Verify the recipient in the AWS SES console, or request production access.'
          : undefined
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
});

// Send test notification
router.post("/notifications/send", requireAuth, async (req, res) => {
  try {
    const { userId, type, title, message, data, channels } = req.body;
    if (!userId || !title || !message) {
      return res.status(400).json({ error: "userId, title, and message are required" });
    }
    await notificationService.send({
      userId,
      type: type || 'system_alert',
      title,
      message,
      data,
      channels: channels || ['in_app', 'push'],
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send notification" });
  }
});

// ==================== NOTIFICATION SETTINGS API ====================

// Get notification settings
router.get("/notification-settings", requireAuth, async (req, res) => {
  try {
    // SECURITY: Use authenticated user's ID, not query parameter
    const userId = req.user!.cognitoSub;
    const settings = await storage.getNotificationSettings(userId);
    if (!settings) {
      // Create default settings
      const now = new Date().toISOString();
      const newSettings = await storage.createNotificationSettings({
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        email: null,
        phone: null,
        pushToken: null,
        expenseNotifications: true,
        paymentNotifications: true,
        billNotifications: true,
        budgetNotifications: true,
        securityNotifications: true,
        marketingNotifications: false,
        createdAt: now,
        updatedAt: now,
      });
      return res.json(newSettings);
    }
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch notification settings" });
  }
});

// Update notification settings
router.patch("/notification-settings", requireAuth, async (req, res) => {
  try {
    // SECURITY: Use authenticated user's ID, ignore client-sent userId
    const userId = req.user!.cognitoSub;
    const { userId: _ignoredUserId, ...settingsData } = req.body;

    let settings: any = await storage.getNotificationSettings(userId);
    if (!settings) {
      const now = new Date().toISOString();
      settings = await storage.createNotificationSettings({
        userId,
        emailEnabled: settingsData.emailEnabled ?? true,
        smsEnabled: settingsData.smsEnabled ?? false,
        pushEnabled: settingsData.pushEnabled ?? true,
        inAppEnabled: settingsData.inAppEnabled ?? true,
        email: settingsData.email || null,
        phone: settingsData.phone || null,
        pushToken: settingsData.pushToken || null,
        expenseNotifications: settingsData.expenseNotifications ?? true,
        paymentNotifications: settingsData.paymentNotifications ?? true,
        billNotifications: settingsData.billNotifications ?? true,
        budgetNotifications: settingsData.budgetNotifications ?? true,
        securityNotifications: settingsData.securityNotifications ?? true,
        marketingNotifications: settingsData.marketingNotifications ?? false,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      settings = await storage.updateNotificationSettings(userId, settingsData);
    }

    res.json(settings || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update notification settings" });
  }
});

// ==================== PUSH TOKENS API ====================

// Register push token
router.post("/push-tokens", requireAuth, async (req, res) => {
  try {
    // SECURITY: Use authenticated user's ID
    const userId = req.user!.cognitoSub;
    const { token, platform, deviceId } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ error: "token and platform are required" });
    }

    // Deactivate existing tokens for this device
    if (deviceId) {
      const existingTokens = await storage.getPushTokens(userId);
      for (const t of existingTokens) {
        if (t.deviceId === deviceId && t.token !== token) {
          await storage.deactivatePushToken(t.token);
        }
      }
    }

    const now = new Date().toISOString();
    const pushToken = await storage.createPushToken({
      userId,
      token,
      platform,
      deviceId: deviceId || null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    res.json(pushToken);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to register push token" });
  }
});

// Delete push token
router.delete("/push-tokens/:token", requireAuth, async (req, res) => {
  try {
    const token = param(req.params.token);
    const deleted = await storage.deletePushToken(token);
    if (!deleted) {
      return res.status(404).json({ error: "Push token not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete push token" });
  }
});

// ==================== NOTIFICATION API ENDPOINTS ====================

// Track user login (called from frontend after Cognito auth)
router.post("/auth/track-login", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.cognitoSub;
    const { email, displayName } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    // Get user settings to check if login alerts are enabled
    const settings = await storage.getNotificationSettings(userId);

    if (settings?.securityNotifications) {
      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      notificationService.sendLoginAlertEmail({
        email,
        name: displayName || email.split('@')[0],
        loginTime: new Date().toLocaleString(),
        ipAddress: ipAddress?.split(',')[0],
        device: userAgent,
      }).catch(err => console.error('Failed to send login alert:', err));
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to track login" });
  }
});

router.post("/auth/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Always return 200 with generic message to prevent account enumeration
    res.json({
      success: true,
      message: "If an account exists with this email, you may proceed with password reset."
    });
  } catch (error: any) {
    // Still return 200 with generic message to prevent enumeration via error timing
    res.json({
      success: true,
      message: "If an account exists with this email, you may proceed with password reset."
    });
  }
});

// Send password reset confirmation (called after successful reset)
router.post("/auth/password-reset-success", async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const result = await notificationService.sendPasswordResetSuccess({
      email,
      name: name || email.split('@')[0],
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send confirmation" });
  }
});

// Send email verification
router.post("/auth/send-verification", emailLimiter, async (req, res) => {
  try {
    const { email, name, verificationLink } = req.body;

    if (!email || !verificationLink) {
      return res.status(400).json({ error: "email and verificationLink are required" });
    }

    const result = await notificationService.sendEmailVerification({
      email,
      name: name || email.split('@')[0],
      verificationLink,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send verification" });
  }
});

// Send transaction SMS alert
router.post("/notifications/transaction-sms", requireAuth, async (req, res) => {
  try {
    const { phone, type, amount, currency, description, balance } = req.body;

    if (!phone || !type || !amount || !currency) {
      return res.status(400).json({ error: "phone, type, amount, and currency are required" });
    }

    const result = await notificationService.sendTransactionAlertSms({
      phone,
      type,
      amount: parseFloat(amount),
      currency,
      description: description || 'Transaction',
      balance: balance ? parseFloat(balance) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send SMS" });
  }
});

// Resend invoice email
router.post("/invoices/:id/send", requireAuth, emailLimiter, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (!invoice.clientEmail) {
      return res.status(400).json({ error: "Invoice has no client email" });
    }

    const settings = await storage.getOrganizationSettings();
    const companyName = (settings as any)?.companyName || settings?.name || 'Financiar';
    const appUrl = process.env.APP_URL || 'https://thefinanciar.com';

    const items = Array.isArray(invoice.items) ? invoice.items : [];

    const result = await notificationService.sendInvoiceEmail({
      email: invoice.clientEmail,
      clientName: invoice.client,
      senderName: companyName,
      invoiceNumber: invoice.invoiceNumber,
      amount: parseFloat(invoice.amount),
      currency: settings?.currency || 'USD',
      dueDate: invoice.dueDate,
      items: items.map((item: any) => ({
        description: item.description || 'Service',
        quantity: item.quantity || 1,
        price: parseFloat(item.price || item.amount || 0),
      })),
      paymentLink: `${appUrl}/pay/${invoice.id}`,
    });

    res.json({ success: result.success, message: result.success ? 'Invoice sent successfully' : result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send invoice" });
  }
});

export default router;
