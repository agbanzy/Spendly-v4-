import express from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  invoiceSchema,
  invoiceUpdateSchema,
} from "./shared";
import { getStripeClient } from "../stripeClient";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";

const router = express.Router();

// ==================== PUBLIC INVOICE PAYMENT PAGE ====================
router.get("/public/invoices/:id", async (req, res) => {
  try {
    const invoice = await storage.getInvoicePublic(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const invoiceCurrency = (invoice as any).currency || 'USD';
    const virtualAccountsList = await storage.getVirtualAccounts();
    // Find a virtual account matching the invoice currency
    const companyAccount = virtualAccountsList.find(
      (a: any) => a.accountNumber && a.currency?.toUpperCase() === invoiceCurrency.toUpperCase()
    ) || virtualAccountsList.find((a: any) => a.accountNumber) || null;
    const settings = await storage.getOrganizationSettings();

    // Check if Stripe is available for online payment
    let stripePaymentAvailable = false;
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) stripePaymentAvailable = true;
    } catch {}

    res.json({
      invoice,
      companyName: (settings as any)?.companyName || settings?.name || 'Financiar',
      companyLogo: (settings as any)?.companyLogo || settings?.logo || null,
      stripePaymentAvailable,
      paymentDetails: companyAccount ? {
        bankName: companyAccount.bankName,
        accountNumber: companyAccount.accountNumber,
        accountName: companyAccount.accountName,
        currency: companyAccount.currency || invoiceCurrency,
        reference: `INV-${invoice.invoiceNumber}`,
        instructions: `Please include reference INV-${invoice.invoiceNumber} in your payment`,
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
    const amount = Math.round(parseFloat(invoice.amount as string) * 100); // cents
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
      },
    });

    res.json({ checkoutUrl: session.url });
  } catch (error: any) {
    console.error('Invoice payment session error:', error.message);
    res.status(500).json({ error: "Failed to create payment session" });
  }
});

// ==================== INVOICES ====================
router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const invoices = await storage.getInvoices(company?.companyId);
    res.json(invoices);
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
    res.json(invoice);
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
      status: 'pending',
      items: items || [],
    } as any);

    // Send invoice email to client if email provided
    if (clientEmail) {
      const settings = await storage.getOrganizationSettings();
      const companyName = (settings as any)?.companyName || settings?.name || 'Financiar';
      const appUrl = process.env.APP_URL || 'https://thefinanciar.com';

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

    res.status(201).json(invoice);
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

// Get invoice with virtual account details
router.get("/invoices/:id/payment-details", requireAuth, async (req, res) => {
  try {
    const invoice = await storage.getInvoice(param(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Get company virtual account for receiving payments
    const virtualAccountsList = await storage.getVirtualAccounts();
    const companyAccount = virtualAccountsList[0]; // Use first/primary account

    res.json({
      invoice,
      paymentDetails: companyAccount ? {
        bankName: companyAccount.bankName,
        accountNumber: companyAccount.accountNumber,
        accountName: companyAccount.accountName,
        currency: companyAccount.currency,
        reference: `INV-${invoice.invoiceNumber}`,
        instructions: `Please include reference INV-${invoice.invoiceNumber} in your payment`,
      } : null,
    });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
