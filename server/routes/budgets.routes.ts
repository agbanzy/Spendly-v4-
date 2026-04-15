import express from "express";
import { storage } from "../storage";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  budgetSchema,
  budgetUpdateSchema,
  getSettingsForRequest,
} from "./shared";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// ==================== BUDGETS ====================
router.get("/budgets", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const budgets = await storage.getBudgets(company?.companyId);
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

router.get("/budgets/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const budget = await storage.getBudget(param(req.params.id));
    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }
    if (company && !await verifyCompanyAccess(budget.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

router.post("/budgets", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const result = budgetSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid budget data", details: result.error.issues });
    }
    const { name, category, limit, period } = result.data;

    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || 'USD';

    const budget = await storage.createBudget({
      name,
      category,
      limit,
      spent: '0',
      currency,
      period: (period || 'monthly') as any,
      companyId: company?.companyId ?? null,
    });

    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.patch("/budgets/:id", requireAuth, async (req, res) => {
  try {
    const result = budgetUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid budget data", details: result.error.issues });
    }
    const existing = await storage.getBudget(param(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: "Budget not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((existing as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const budget = await storage.updateBudget(param(req.params.id), result.data as any);
    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/budgets/:id", requireAuth, async (req, res) => {
  try {
    const budget = await storage.getBudget(param(req.params.id));
    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((budget as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteBudget(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Budget not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
