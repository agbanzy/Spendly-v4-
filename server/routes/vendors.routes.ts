import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  vendorSchema,
  vendorUpdateSchema,
  getSettingsForRequest,
} from "./shared";
import { mapPaymentError } from "../utils/paymentUtils";

const router = express.Router();

// ==================== VENDORS ====================
router.get("/vendors", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const vendors = await storage.getVendors(company?.companyId);
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

router.get("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const vendor = await storage.getVendor(param(req.params.id));
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    if (company && !await verifyCompanyAccess(vendor.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendor" });
  }
});

router.post("/vendors", requireAuth, async (req, res) => {
  try {
    const result = vendorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid vendor data", details: result.error.issues });
    }
    const { name, email, phone, address, category } = result.data;
    const company = await resolveUserCompany(req);

    const vendor = await storage.createVendor({
      name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      category: category || 'Other',
      currency: req.body.currency || 'USD',
      status: 'active',
      totalPaid: '0',
      pendingPayments: '0',
      lastPayment: null,
      companyId: company?.companyId || null,
      paymentTerms: req.body.paymentTerms || null,
      taxId: req.body.taxId || null,
      notes: req.body.notes || null,
    });

    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: "Failed to create vendor" });
  }
});

router.patch("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const result = vendorUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid vendor data", details: result.error.issues });
    }
    const vendor = await storage.updateVendor(param(req.params.id), result.data as any);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: "Failed to update vendor" });
  }
});

router.delete("/vendors/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteVendor(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vendor" });
  }
});

// ==================== VENDOR PAYMENT ====================

router.post("/vendors/:id/pay", requireAuth, async (req, res) => {
  try {
    const { amount, description, initiatedBy, invoiceId } = req.body;

    const vendor = await storage.getVendor(param(req.params.id));
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Get vendor's payout destination
    const destinations = await storage.getPayoutDestinations(undefined, vendor.id);
    const defaultDestination = destinations.find(d => d.isDefault) || destinations[0];

    if (!defaultDestination) {
      return res.status(400).json({ error: "Vendor has no payout destination configured" });
    }

    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || 'USD';

    // Create payout
    const payout = await storage.createPayout({
      type: 'vendor_payment',
      amount: amount.toString(),
      currency,
      status: 'pending',
      recipientType: 'vendor',
      recipientId: vendor.id,
      recipientName: vendor.name,
      destinationId: defaultDestination.id,
      provider: defaultDestination.provider,
      relatedEntityType: invoiceId ? 'invoice' : undefined,
      relatedEntityId: invoiceId,
      initiatedBy,
    });

    res.status(201).json(payout);
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
