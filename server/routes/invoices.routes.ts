import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  invoiceSchema,
  invoiceUpdateSchema,
  logAudit,
  getAuditUserName,
} from "./shared";
import { getStripeClient } from "../stripeClient";
import { paystackClient, getPaystackPublicKey } from "../paystackClient";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";
import { db } from "../db";

const router = express.Router();

// ==================== INVOICE PAYMENT TRACKING ====================

/**
 * In-memory invoice payment ledger.
 * In production this should be backed by a dedicated `invoice_payments` table;
 * for now we keep it in-memory so existing DB schema is untouched while the
 * full API contract is available for the frontend.
 */
interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string; // 'stripe' | 'paystack' | 'bank_transfer' | 'manual'
  reference: string;
  paidAt: string;
  metadata?: Record<string, unknown>;
}

const invoicePaymentsStore: Map<string, InvoicePayment[]> = new Map();

function getInvoicePayments(invoiceId: string): InvoicePayment[] {
  return invoicePaymentsStore.get(invoiceId) || [];
}

function addInvoicePayment(payment: InvoicePayment): InvoicePayment {
  const existing = invoicePaymentsStore.get(payment.invoiceId) || [];
  existing.push(payment);
  invoicePaymentsStore.set(payment.invoiceId, existing);
  return payment;
}

function getTotalPaid(invoiceId: string): number {
  const payments = getInvoicePayments(invoiceId);
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Determine the correct invoice status based on payments received.
 * Status flow: draft -> sent -> partially_paid -> paid -> overdue
 */
function resolveInvoiceStatus(
  invoiceAmount: number,
  totalPaid: number,
  currentStatus: string,
  dueDate: string
): string {
  if (totalPaid >= invoiceAmount) return 'paid';
  if (totalPaid > 0) return 'partially_paid';

  // Check overdue
  if (['pending', 'sent', 'partially_paid'].includes(currentStatus)) {
    const due = new Date(dueDate);
    if (due < new Date()) return 'overdue';
  }

  return currentStatus;
}

// ==================== PUBLIC INVOICE PAYMENT PAGE ====================
router.get("/public/invoices/:id", async (req, res) => {
  try {
    const invoice = await storage.getInvoicePublic(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const invoiceCurrency = (invoice as any).currency || 'USD';
    const virtualAccountsList = await storage.getVirtualAccounts();

    // Match virtual account by currency — prefer exact currency match,
    // then fallback to any account with a valid account number
    const currencyMatch = virtualAccountsList.filter(
      (a: any) => a.accountNumber && a.currency?.toUpperCase() === invoiceCurrency.toUpperCase()
    );
    const companyAccount = currencyMatch[0]
      || virtualAccountsList.find((a: any) => a.accountNumber)
      || null;

    const settings = await storage.getOrganizationSettings();

    // Check if Stripe is available for online payment
    let stripePaymentAvailable = false;
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) stripePaymentAvailable = true;
    } catch {}

    // Check if Paystack is available for inline payment (NGN, GHS, KES, ZAR)
    let paystackPaymentAvailable = false;
    let paystackPublicKey: string | null = null;
    const paystackCurrencies = ['NGN', 'GHS', 'KES', 'ZAR'];
    try {
      if (paystackCurrencies.includes(invoiceCurrency.toUpperCase())) {
        paystackPublicKey = getPaystackPublicKey();
        paystackPaymentAvailable = true;
      }
    } catch {}

    // Partial payment tracking
    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id as string);
    const amountRemaining = Math.max(0, invoiceAmount - totalPaid);

    res.json({
      invoice,
      amountPaid: totalPaid,
      amountRemaining,
      payments: getInvoicePayments(invoice.id as string),
      companyName: (settings as any)?.companyName || settings?.name || 'Financiar',
      companyLogo: (settings as any)?.companyLogo || settings?.logo || null,
      stripePaymentAvailable,
      paystackPaymentAvailable,
      paystackPublicKey,
      paymentDetails: companyAccount ? {
        bankName: companyAccount.bankName,
        accountNumber: companyAccount.accountNumber,
        accountName: companyAccount.accountName,
        currency: companyAccount.currency || invoiceCurrency,
        reference: `INV-${invoice.invoiceNumber}`,
        instructions: `Please include reference INV-${invoice.invoiceNumber} in your bank transfer. ` +
          `Pay to ${companyAccount.bankName} account ${companyAccount.accountNumber} (${companyAccount.accountName}).`,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoice details" });
  }
});

// Create Stripe Checkout Session for invoice payment (public - no auth required)
router.post("/public/invoices/:id/pay", async (req, res) => {
  try {
    const invoice = await storage.getInvoicePublic(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(503).json({ error: "Online payment is not configured" });
    }

    const stripe = getStripeClient();
    const invoiceCurrency = ((invoice as any).currency || 'USD').toLowerCase();
    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id as string);
    const amountRemaining = Math.max(0, invoiceAmount - totalPaid);

    if (amountRemaining <= 0) {
      return res.status(400).json({ error: "Invoice already fully paid" });
    }

    // Allow partial payment: use requested amount or remaining balance
    const requestedAmount = req.body.amount ? parseFloat(req.body.amount) : amountRemaining;
    const paymentAmount = Math.min(requestedAmount, amountRemaining);

    if (paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const amount = Math.round(paymentAmount * 100); // cents
    const appUrl = process.env.APP_URL || 'https://thefinanciar.com';

    const session = await (stripe.checkout.sessions.create as Function)({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: invoiceCurrency,
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `Payment to ${(await storage.getOrganizationSettings() as any)?.companyName || 'Financiar'}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/pay/${invoice.id}?payment=success`,
      cancel_url: `${appUrl}/pay/${invoice.id}?payment=cancelled`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: 'invoice_payment',
        companyId: (invoice as any).companyId || '',
        paymentAmount: String(paymentAmount),
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (error: any) {
    console.error('Invoice payment session error:', error.message);
    res.status(500).json({ error: "Failed to create payment session" });
  }
});

// Initialize Paystack inline payment for invoice (public - no auth required)
router.post("/public/invoices/:id/pay/paystack", async (req, res) => {
  try {
    const invoice = await storage.getInvoicePublic(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    const invoiceCurrency = ((invoice as any).currency || 'NGN').toUpperCase();
    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id as string);
    const amountRemaining = Math.max(0, invoiceAmount - totalPaid);

    if (amountRemaining <= 0) {
      return res.status(400).json({ error: "Invoice already fully paid" });
    }

    // Allow partial payment
    const requestedAmount = req.body.amount ? parseFloat(req.body.amount) : amountRemaining;
    const paymentAmount = Math.min(requestedAmount, amountRemaining);

    if (paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required for Paystack payment" });
    }

    const appUrl = process.env.APP_URL || 'https://thefinanciar.com';

    const txResult = await paystackClient.initializeTransaction(
      email,
      paymentAmount,
      invoiceCurrency,
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: 'invoice_payment',
        companyId: (invoice as any).companyId || '',
        paymentAmount: String(paymentAmount),
      },
      `${appUrl}/pay/${invoice.id}?payment=success`
    );

    res.json({
      authorizationUrl: txResult.data?.authorization_url,
      accessCode: txResult.data?.access_code,
      reference: txResult.data?.reference,
      publicKey: getPaystackPublicKey(),
    });
  } catch (error: any) {
    console.error('Invoice Paystack payment error:', error.message);
    res.status(500).json({ error: "Failed to initialize Paystack payment" });
  }
});

// Record a payment against an invoice (supports partial payments)
router.post("/invoices/:id/payments", requireAuth, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const company = await resolveUserCompany(req);
    if (company && !await verifyCompanyAccess(invoice.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: "Invoice is already fully paid" });
    }

    const { amount, method, reference, metadata } = req.body;
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: "Valid payment amount is required" });
    }

    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id);
    const amountRemaining = invoiceAmount - totalPaid;

    if (paymentAmount > amountRemaining + 0.01) { // small tolerance for rounding
      return res.status(400).json({
        error: "Payment amount exceeds remaining balance",
        amountRemaining,
        amountPaid: totalPaid,
      });
    }

    const invoiceCurrency = (invoice as any).currency || 'USD';

    // Record the payment
    const payment = addInvoicePayment({
      id: `ipay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      invoiceId: invoice.id,
      amount: paymentAmount,
      currency: invoiceCurrency,
      method: method || 'manual',
      reference: reference || `PAY-${invoice.invoiceNumber}-${Date.now()}`,
      paidAt: new Date().toISOString(),
      metadata,
    });

    // Recalculate totals and update invoice status
    const newTotalPaid = getTotalPaid(invoice.id);
    const newStatus = resolveInvoiceStatus(invoiceAmount, newTotalPaid, invoice.status, invoice.dueDate);

    await storage.updateInvoice(invoice.id, { status: newStatus });

    // Audit log
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    await logAudit(
      'invoice',
      invoice.id,
      'payment_recorded',
      userId,
      userName,
      { status: invoice.status, totalPaid },
      { status: newStatus, totalPaid: newTotalPaid },
      { paymentAmount, method: method || 'manual', reference: payment.reference }
    );

    res.status(201).json({
      payment,
      invoiceStatus: newStatus,
      amountPaid: newTotalPaid,
      amountRemaining: Math.max(0, invoiceAmount - newTotalPaid),
      fullyPaid: newTotalPaid >= invoiceAmount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// List all payments for an invoice
router.get("/invoices/:id/payments", requireAuth, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const company = await resolveUserCompany(req);
    if (company && !await verifyCompanyAccess(invoice.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const invoiceAmount = parseFloat(invoice.amount as string);
    const payments = getInvoicePayments(invoice.id);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount,
      amountPaid: totalPaid,
      amountRemaining: Math.max(0, invoiceAmount - totalPaid),
      status: invoice.status,
      payments,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoice payments" });
  }
});

// ==================== INVOICES ====================
router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const invoices = await storage.getInvoices(company?.companyId);

    // Enrich each invoice with payment tracking info
    const enriched = invoices.map((inv: any) => {
      const invoiceAmount = parseFloat(inv.amount as string);
      const totalPaid = getTotalPaid(inv.id);
      const amountRemaining = Math.max(0, invoiceAmount - totalPaid);

      // Auto-resolve overdue status
      const resolvedStatus = resolveInvoiceStatus(invoiceAmount, totalPaid, inv.status, inv.dueDate);

      return {
        ...inv,
        amountPaid: totalPaid,
        amountRemaining,
        paymentCount: getInvoicePayments(inv.id).length,
        ...(resolvedStatus !== inv.status ? { status: resolvedStatus } : {}),
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (company && !await verifyCompanyAccess(invoice.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Enrich with payment tracking
    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id);
    const amountRemaining = Math.max(0, invoiceAmount - totalPaid);

    res.json({
      ...invoice,
      amountPaid: totalPaid,
      amountRemaining,
      paymentCount: getInvoicePayments(invoice.id).length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

router.post("/invoices", requireAuth, async (req, res) => {
  try {
    const result = invoiceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid invoice data", details: result.error.issues });
    }
    const { client, clientEmail, amount, subtotal, taxRate, taxAmount, currency: invoiceCurrency, notes, dueDate, items } = result.data;

    // AUD-DD-FORM-019 — line-item cross-validation. If line items are
    // present, sum (quantity * price/rate/amount) and confirm it
    // matches the declared subtotal (or the top-level amount when no
    // subtotal is given). Allow a 1-cent tolerance for rounding.
    if (Array.isArray(items) && items.length > 0) {
      const computedSubtotal = items.reduce((sum: number, it: any) => {
        const qty = parseFloat(String(it.quantity ?? 1));
        const unit = parseFloat(String(it.price ?? it.rate ?? it.amount ?? 0));
        if (!Number.isFinite(qty) || !Number.isFinite(unit)) return sum;
        return sum + qty * unit;
      }, 0);
      const declared = parseFloat(String(subtotal ?? amount ?? 0));
      if (Number.isFinite(declared) && Math.abs(computedSubtotal - declared) > 0.01) {
        return res.status(400).json({
          error: 'Line-item totals do not match declared subtotal',
          computedSubtotal: Number(computedSubtotal.toFixed(2)),
          declaredSubtotal: Number(declared.toFixed(2)),
        });
      }
    }

    // AUD-DD-FORM-020 — tax cross-validation. taxAmount must equal
    // subtotal * (taxRate / 100) within a 1-cent tolerance. Skip if
    // either side is absent — taxRate=0 / taxAmount=0 trivially passes.
    const taxRateNum = parseFloat(String(taxRate ?? '0'));
    const taxAmountNum = parseFloat(String(taxAmount ?? '0'));
    const subtotalNum = parseFloat(String(subtotal ?? amount ?? 0));
    if (Number.isFinite(taxRateNum) && Number.isFinite(taxAmountNum) && Number.isFinite(subtotalNum) && taxRateNum > 0) {
      const expectedTax = subtotalNum * (taxRateNum / 100);
      if (Math.abs(expectedTax - taxAmountNum) > 0.01) {
        return res.status(400).json({
          error: 'Tax amount does not match subtotal × taxRate',
          expectedTaxAmount: Number(expectedTax.toFixed(2)),
          declaredTaxAmount: Number(taxAmountNum.toFixed(2)),
        });
      }
    }

    const currentYear = new Date().getFullYear();
    const invoiceNumber = await storage.getNextInvoiceNumber(currentYear);
    const company = await resolveUserCompany(req);

    const invoice = await storage.createInvoice({
      invoiceNumber,
      client,
      clientEmail: clientEmail || '',
      amount,
      subtotal: subtotal || amount,
      taxRate: taxRate || '0',
      taxAmount: taxAmount || '0',
      currency: invoiceCurrency || 'USD',
      notes: notes || null,
      companyId: company?.companyId || null,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      issuedDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      items: items || [],
    } as any);

    // Send invoice email to client if email provided
    if (clientEmail) {
      const settings = await storage.getOrganizationSettings();
      const companyName = (settings as any)?.companyName || settings?.name || 'Financiar';
      const appUrl = process.env.APP_URL || 'https://thefinanciar.com';

      // Update status to 'sent' since we're emailing it
      await storage.updateInvoice(invoice.id, { status: 'sent' });

      notificationService.sendInvoiceEmail({
        email: clientEmail,
        clientName: client,
        senderName: companyName,
        invoiceNumber,
        amount: parseFloat(amount),
        currency: invoiceCurrency || settings?.currency || 'USD',
        dueDate: invoice.dueDate,
        items: (items || []).map((item: any) => ({
          description: item.description || 'Service',
          quantity: item.quantity || 1,
          price: parseFloat(item.price || item.amount || 0),
        })),
        paymentLink: `${appUrl}/pay/${invoice.id}`,
      }).catch(err => console.error('Failed to send invoice email:', err));
    }

    res.status(201).json({
      ...invoice,
      amountPaid: 0,
      amountRemaining: parseFloat(amount),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.patch("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const result = invoiceUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid invoice data", details: result.error.issues });
    }
    const existing = await storage.getInvoice(param(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((existing as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const invoice = await storage.updateInvoice(param(req.params.id), result.data as any);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.delete("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const userCompany = await resolveUserCompany(req);
    if (userCompany?.companyId && !(await verifyCompanyAccess((invoice as any).companyId, userCompany.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const deleted = await storage.deleteInvoice(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

// ==================== INVOICE WITH VIRTUAL ACCOUNT ====================

// Get invoice with virtual account details — currency-aware matching
router.get("/invoices/:id/payment-details", requireAuth, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoiceCurrency = ((invoice as any).currency || 'USD').toUpperCase();

    // Get company virtual accounts and prefer currency match
    const virtualAccountsList = await storage.getVirtualAccounts();
    const currencyMatched = virtualAccountsList.filter(
      (a: any) => a.accountNumber && a.currency?.toUpperCase() === invoiceCurrency
    );
    const companyAccount = currencyMatched[0]
      || virtualAccountsList.find((a: any) => a.accountNumber)
      || null;

    // Enrich with payment tracking
    const invoiceAmount = parseFloat(invoice.amount as string);
    const totalPaid = getTotalPaid(invoice.id);

    res.json({
      invoice: {
        ...invoice,
        amountPaid: totalPaid,
        amountRemaining: Math.max(0, invoiceAmount - totalPaid),
      },
      paymentDetails: companyAccount ? {
        bankName: companyAccount.bankName,
        accountNumber: companyAccount.accountNumber,
        accountName: companyAccount.accountName,
        currency: companyAccount.currency || invoiceCurrency,
        reference: `INV-${invoice.invoiceNumber}`,
        instructions: `Please include reference INV-${invoice.invoiceNumber} in your bank transfer. ` +
          `Pay to ${companyAccount.bankName} account ${companyAccount.accountNumber} (${companyAccount.accountName}).`,
      } : null,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
