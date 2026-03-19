import express from "express";
import { storage } from "../storage";
import {
  resolveUserCompany,
  getSettingsForRequest,
  getAuditUserName,
} from "./shared";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// ==================== SETTINGS ====================
router.get("/settings", requireAuth, async (req, res) => {
  try {
    // Try company-aware settings first (from companies table)
    const company = await resolveUserCompany(req);
    if (company?.companyId) {
      const companySettings = await storage.getCompanyAsSettings(company.companyId);
      if (companySettings) {
        return res.json(companySettings);
      }
    }
    // Fallback to legacy singleton for users without a company
    const settings = await getSettingsForRequest(req);
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    let settings;
    const company = await resolveUserCompany(req);

    // Write to companies table if user has a company
    if (company?.companyId) {
      settings = await storage.updateCompanyAsSettings(company.companyId, req.body);
      if (!settings) {
        // Company not found, fall back to singleton
        settings = await storage.updateSettings(req.body);
      }
    } else {
      settings = await storage.updateSettings(req.body);
    }

    try {
      const auditName = await getAuditUserName(req);
      await storage.createAuditLog({
        action: 'UPDATE',
        userId: (req as any).user?.uid || 'system',
        userName: auditName,
        entityType: 'settings',
        entityId: company?.companyId || 'company-settings',
        details: { updatedFields: Object.keys(req.body), companyId: company?.companyId },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        createdAt: new Date().toISOString(),
      } as any);
    } catch (e) { /* audit log failure should not block operation */ }

    res.json(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
