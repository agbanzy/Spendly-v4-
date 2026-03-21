/**
 * Barrel index — registers all domain route modules on the Express app.
 *
 * Each domain module exports an express.Router with paths relative to /api.
 * This file mounts them all under the /api prefix and handles
 * non-router registrations (SMS auth, legacy webhooks, etc.).
 */
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { registerSmsAuthRoutes } from "../sms-auth";
import { verifyPaystackSignature, PaystackWebhookHandler } from "../paystackWebhook";
import { registerStripeWebhooks } from "../webhookHandlers";

// Domain routers
import healthRouter from "./health.routes";
import balancesRouter from "./balances.routes";
import expensesRouter from "./expenses.routes";
import transactionsRouter from "./transactions.routes";
import billsRouter from "./bills.routes";
import budgetsRouter from "./budgets.routes";
import cardsRouter from "./cards.routes";
import accountsRouter from "./accounts.routes";
import companiesRouter from "./companies.routes";
import teamRouter from "./team.routes";
import reportsRouter from "./reports.routes";
import payrollRouter from "./payroll.routes";
import invoicesRouter from "./invoices.routes";
import vendorsRouter from "./vendors.routes";
import settingsRouter from "./settings.routes";
import paymentsRouter from "./payments.routes";
import analyticsRouter from "./analytics.routes";
import kycRouter from "./kyc.routes";
import notificationsRouter from "./notifications.routes";
import adminRouter from "./admin.routes";
import walletsRouter from "./wallets.routes";
import payoutsRouter from "./payouts.routes";
import webhooksRouter from "./webhooks.routes";
import scheduledRouter from "./scheduled.routes";
import paymentMethodsRouter from "./payment-methods.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== SMS AUTH (Cognito Custom Auth) ====================
  registerSmsAuthRoutes(app);

  // ==================== PRIMARY WEBHOOKS (must be before JSON body parser) ====================
  // Paystack webhook needs raw body for signature verification
  app.post("/api/paystack/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
      }

      const payload = typeof req.body === 'string' ? req.body : req.body.toString('utf8');

      if (!verifyPaystackSignature(payload, signature)) {
        console.error('[WEBHOOK] Invalid Paystack signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = JSON.parse(payload);
      console.log(JSON.stringify({ level: 'info', event: 'paystack_webhook_received', type: event.event, reference: event.data?.reference, timestamp: new Date().toISOString() }));

      // Acknowledge immediately, process async
      res.status(200).json({ received: true });

      // Process event asynchronously
      PaystackWebhookHandler.processEvent(event).catch(err => {
        console.error(JSON.stringify({ level: 'error', event: 'paystack_webhook_processing_failed', type: event.event, error: err.message, timestamp: new Date().toISOString() }));
      });
    } catch (error: any) {
      console.error('[WEBHOOK] Paystack webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  // Stripe webhooks (registered directly on app for raw body handling)
  registerStripeWebhooks(app);

  // ==================== DOMAIN ROUTERS ====================
  // All mounted under /api prefix
  app.use("/api", healthRouter);
  app.use("/api", balancesRouter);
  app.use("/api", expensesRouter);
  app.use("/api", transactionsRouter);
  app.use("/api", billsRouter);
  app.use("/api", budgetsRouter);
  app.use("/api", cardsRouter);
  app.use("/api", accountsRouter);
  app.use("/api", companiesRouter);
  app.use("/api", teamRouter);
  app.use("/api", reportsRouter);
  app.use("/api", payrollRouter);
  app.use("/api", invoicesRouter);
  app.use("/api", vendorsRouter);
  app.use("/api", settingsRouter);
  app.use("/api", paymentsRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", kycRouter);
  app.use("/api", notificationsRouter);
  app.use("/api", adminRouter);
  app.use("/api", walletsRouter);
  app.use("/api", payoutsRouter);
  app.use("/api", webhooksRouter);

  app.use("/api", scheduledRouter);
  app.use("/api", paymentMethodsRouter);

  // ==================== API 404 CATCH-ALL (must be last) ====================
  app.all("/api/{*rest}", (_req, res) => {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  });

  return httpServer;
}
