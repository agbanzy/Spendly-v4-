import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  transactionSchema,
  transactionUpdateSchema,
  getSettingsForRequest,
} from "./shared";

const router = express.Router();

// ==================== TRANSACTIONS ====================

router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const userCompany = await resolveUserCompany(req);
    const transactions = await storage.getTransactions(userCompany?.companyId);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.get("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const transaction = await storage.getTransaction(param(req.params.id));
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    // SECURITY FIX: Verify the transaction belongs to the user's company
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((transaction as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.post("/transactions", requireAuth, async (req, res) => {
  try {
    const result = transactionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid transaction data", details: result.error.issues });
    }
    const { type, amount, description, fee } = result.data;

    const txnCompany = await resolveUserCompany(req);
    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || "USD";

    const transaction = await storage.createTransaction({
      type: type,
      amount: String(amount),
      fee: String(fee || 0),
      status: "completed",
      date: new Date().toISOString().split("T")[0],
      description: description || "",
      currency,
      reference: null,
      userId: (req as any).user?.uid || null,
      companyId: txnCompany?.companyId ?? null,
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.patch("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const result = transactionUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid transaction data", details: result.error.issues });
    }
    // SECURITY FIX: Verify ownership before updating
    const existing = await storage.getTransaction(param(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((existing as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const transaction = await storage.updateTransaction(param(req.params.id), result.data as any);
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

router.delete("/transactions/:id", requireAuth, async (req, res) => {
  try {
    // SECURITY FIX: Verify ownership before deleting
    const existing = await storage.getTransaction(param(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((existing as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteTransaction(param(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

export default router;
