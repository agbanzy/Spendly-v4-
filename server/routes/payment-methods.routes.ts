import express from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { paymentMethods } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { getStripeClient } from "../stripeClient";
import { paystackClient } from "../paystackClient";
import { param } from "./shared";

const router = express.Router();

// ==================== PAYMENT METHODS ====================

/**
 * GET /payment-methods — list the authenticated user's saved payment methods.
 */
router.get("/payment-methods", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .orderBy(paymentMethods.createdAt);

    // Strip sensitive authorization codes from response
    const sanitized = methods.map((m) => ({
      id: m.id,
      provider: m.provider,
      type: m.type,
      last4: m.last4,
      brand: m.brand,
      expMonth: m.expMonth,
      expYear: m.expYear,
      bankName: m.bankName,
      isDefault: m.isDefault,
      isReusable: m.isReusable,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.error("Failed to list payment methods:", error.message);
    res.status(500).json({ success: false, error: "Failed to retrieve payment methods" });
  }
});

// ==================== STRIPE ====================

/**
 * POST /payment-methods/stripe/setup-intent — create a Stripe SetupIntent
 * so the client can collect card details via Stripe Elements.
 */
router.post("/payment-methods/stripe/setup-intent", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { stripeCustomerId } = req.body;
    if (!stripeCustomerId) {
      return res.status(400).json({ success: false, error: "stripeCustomerId is required" });
    }

    const stripe = getStripeClient();
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      },
    });
  } catch (error: any) {
    console.error("Failed to create SetupIntent:", error.message);
    res.status(500).json({ success: false, error: "Failed to create setup intent" });
  }
});

/**
 * POST /payment-methods/stripe/confirm — after the client confirms the SetupIntent,
 * retrieve the payment method details and save to DB.
 */
router.post("/payment-methods/stripe/confirm", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const schema = z.object({
      setupIntentId: z.string().min(1),
      stripeCustomerId: z.string().min(1),
      companyId: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const { setupIntentId, stripeCustomerId, companyId } = parsed.data;
    const stripe = getStripeClient();

    // Retrieve the SetupIntent to get the attached payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.status !== "succeeded") {
      return res.status(400).json({ success: false, error: "SetupIntent has not succeeded yet" });
    }

    const paymentMethodId = typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      return res.status(400).json({ success: false, error: "No payment method found on SetupIntent" });
    }

    // Fetch the payment method details
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Ensure allow_redisplay is set (mandatory since March 2025)
    try {
      await stripe.paymentMethods.update(paymentMethodId, {
        allow_redisplay: "always",
      });
    } catch (updateErr: any) {
      // Non-blocking — some payment method types may not support this
      console.warn("Could not set allow_redisplay:", updateErr.message);
    }

    const now = new Date().toISOString();

    // Check if this payment method is already saved
    const existing = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.userId, userId),
          eq(paymentMethods.stripePaymentMethodId, paymentMethodId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, data: existing[0], message: "Payment method already saved" });
    }

    // Determine if this should be default (first method = default)
    const existingMethods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);

    const isDefault = existingMethods.length === 0;

    const [saved] = await db.insert(paymentMethods).values({
      userId,
      companyId: companyId ?? null,
      provider: "stripe",
      type: pm.type || "card",
      last4: pm.card?.last4 ?? null,
      brand: pm.card?.brand ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      bankName: null,
      stripePaymentMethodId: paymentMethodId,
      stripeCustomerId,
      paystackAuthorizationCode: null,
      paystackCustomerCode: null,
      isDefault,
      isReusable: true,
      metadata: {
        fingerprint: pm.card?.fingerprint,
        funding: pm.card?.funding,
        country: pm.card?.country,
      },
      createdAt: now,
      updatedAt: now,
    }).returning();

    res.json({ success: true, data: saved });
  } catch (error: any) {
    console.error("Failed to confirm Stripe payment method:", error.message);
    res.status(500).json({ success: false, error: "Failed to save payment method" });
  }
});

// ==================== PAYSTACK ====================

/**
 * POST /payment-methods/paystack/save — save a Paystack authorization
 * after a successful charge. The client should pass the authorization
 * object received from Paystack's charge.success callback/webhook.
 */
router.post("/payment-methods/paystack/save", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const schema = z.object({
      authorizationCode: z.string().min(1),
      customerCode: z.string().min(1),
      last4: z.string().optional(),
      brand: z.string().optional(),
      expMonth: z.string().or(z.number()).optional(),
      expYear: z.string().or(z.number()).optional(),
      bank: z.string().optional(),
      reusable: z.boolean().optional().default(true),
      cardType: z.string().optional(), // 'card' or 'bank_account'
      companyId: z.number().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const data = parsed.data;

    // Only save reusable authorizations
    if (!data.reusable) {
      return res.status(400).json({ success: false, error: "Authorization is not reusable and cannot be saved" });
    }

    // Check for duplicate
    const existing = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.userId, userId),
          eq(paymentMethods.paystackAuthorizationCode, data.authorizationCode)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, data: existing[0], message: "Authorization already saved" });
    }

    const now = new Date().toISOString();

    // Check if this is the first payment method (make it default)
    const existingMethods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .limit(1);

    const isDefault = existingMethods.length === 0;

    const [saved] = await db.insert(paymentMethods).values({
      userId,
      companyId: data.companyId ?? null,
      provider: "paystack",
      type: data.cardType || "card",
      last4: data.last4 ?? null,
      brand: data.brand ?? null,
      expMonth: data.expMonth != null ? Number(data.expMonth) : null,
      expYear: data.expYear != null ? Number(data.expYear) : null,
      bankName: data.bank ?? null,
      stripePaymentMethodId: null,
      stripeCustomerId: null,
      paystackAuthorizationCode: data.authorizationCode,
      paystackCustomerCode: data.customerCode,
      isDefault,
      isReusable: true,
      metadata: null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    res.json({ success: true, data: saved });
  } catch (error: any) {
    console.error("Failed to save Paystack payment method:", error.message);
    res.status(500).json({ success: false, error: "Failed to save payment method" });
  }
});

// ==================== COMMON ====================

/**
 * DELETE /payment-methods/:id — remove a saved payment method.
 */
router.delete("/payment-methods/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const id = parseInt(param(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid payment method ID" });
    }

    // Verify ownership
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
      .limit(1);

    if (!method) {
      return res.status(404).json({ success: false, error: "Payment method not found" });
    }

    // If it's a Stripe payment method, detach from customer
    if (method.provider === "stripe" && method.stripePaymentMethodId) {
      try {
        const stripe = getStripeClient();
        await stripe.paymentMethods.detach(method.stripePaymentMethodId);
      } catch (detachErr: any) {
        console.warn("Failed to detach Stripe payment method (continuing with deletion):", detachErr.message);
      }
    }

    // If it's a Paystack authorization, deactivate it
    if (method.provider === "paystack" && method.paystackAuthorizationCode) {
      try {
        await paystackClient.deactivateAuthorization(method.paystackAuthorizationCode);
      } catch (deactivateErr: any) {
        console.warn("Failed to deactivate Paystack authorization (continuing with deletion):", deactivateErr.message);
      }
    }

    // Delete from DB
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));

    // If this was the default, promote the next available method
    if (method.isDefault) {
      const [next] = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, userId))
        .limit(1);

      if (next) {
        await db
          .update(paymentMethods)
          .set({ isDefault: true, updatedAt: new Date().toISOString() })
          .where(eq(paymentMethods.id, next.id));
      }
    }

    res.json({ success: true, message: "Payment method removed" });
  } catch (error: any) {
    console.error("Failed to delete payment method:", error.message);
    res.status(500).json({ success: false, error: "Failed to remove payment method" });
  }
});

/**
 * PUT /payment-methods/:id/default — set a payment method as the default.
 */
router.put("/payment-methods/:id/default", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const id = parseInt(param(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid payment method ID" });
    }

    // Verify ownership
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
      .limit(1);

    if (!method) {
      return res.status(404).json({ success: false, error: "Payment method not found" });
    }

    const now = new Date().toISOString();

    // Unset all other defaults for this user
    await db
      .update(paymentMethods)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)));

    // Set the new default
    const [updated] = await db
      .update(paymentMethods)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(paymentMethods.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Failed to set default payment method:", error.message);
    res.status(500).json({ success: false, error: "Failed to update default payment method" });
  }
});

export default router;
