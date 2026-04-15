import express from "express";
import { storage } from "../storage";
import { paymentService } from "../paymentService";
import { getStripeClient } from "../stripeClient";
import { mapPaymentError, paymentLogger } from "../utils/paymentUtils";
import { IdempotencyCache } from "../utils/idempotencyCache";

const router = express.Router();

// ==================== PAYSTACK WEBHOOK ====================
// TTL-bounded idempotency cache — prevents unbounded memory growth
// Entries expire after 1 hour, max 10,000 entries (evicts oldest on overflow)
const processedPaystackReferences = new IdempotencyCache(10000, 60 * 60 * 1000);

// Legacy Paystack webhook removed — primary webhook is /api/paystack/webhook
// registered at top of registerRoutes() using PaystackWebhookHandler with HMAC verification.

/* LEGACY_WEBHOOK_REMOVED: ~320 lines of dead code deleted.
   Original route: POST /api/paystack/webhook-legacy
   Handled: charge.success, dedicatedaccount.assign.success,
   charge.success (dedicated_nuban), transfer.success, transfer.failed/reversed
   All now handled by PaystackWebhookHandler in paystackWebhook.ts */

// [REMOVED] Legacy dead-code webhook handler was here (4850-5172)
// Now using paystackWebhook.ts PaystackWebhookHandler exclusively.

// Dead code removed — see comment above

// ==================== PAYSTACK CALLBACK ====================
router.get("/paystack/callback", async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference || typeof reference !== 'string') {
      return res.redirect('/dashboard?payment=failed');
    }

    // In-memory idempotency check
    if (processedPaystackReferences.has(reference)) {
      console.log(`Paystack callback: reference ${reference} already processed (memory)`);
      return res.redirect('/dashboard?payment=success');
    }

    // DB-level idempotency check — prevent double-crediting if webhook already handled this
    const alreadyProcessed = await storage.isWebhookProcessed(`paystack_callback:${reference}`);
    if (alreadyProcessed) {
      console.log(`Paystack callback: reference ${reference} already processed (DB)`);
      processedPaystackReferences.add(reference);
      return res.redirect('/dashboard?payment=success');
    }

    const verification = await paymentService.verifyPayment(reference, 'paystack');

    if (verification.status === 'success') {
      processedPaystackReferences.add(reference);

      // SECURITY FIX: Do NOT credit balance here — the Paystack webhook handler
      // (paystackWebhook.ts) is the authoritative source for crediting.
      // Crediting in both callback AND webhook causes double-credit.
      // The callback only confirms the redirect; actual crediting happens via webhook.

      res.redirect('/dashboard?payment=success');
    } else {
      res.redirect('/dashboard?payment=failed');
    }
  } catch (error: any) {
    console.error('Paystack callback error:', error);
    res.redirect('/dashboard?payment=failed');
  }
});

// ==================== STRIPE WEBHOOK ====================
// TTL-bounded idempotency cache — prevents unbounded memory growth
const processedStripeEvents = new IdempotencyCache(10000, 60 * 60 * 1000);

router.post("/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // SECURITY: Reject webhook if secret key is not configured
    if (!stripeSecretKey) {
      console.error('Stripe webhook rejected: STRIPE_SECRET_KEY not configured');
      return res.status(500).json({ error: "Webhook configuration error" });
    }

    // SECURITY: Reject webhook if webhook secret is not configured
    if (!stripeWebhookSecret) {
      console.error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: "Webhook configuration error" });
    }

    // SECURITY: Require stripe-signature header
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      console.error('Stripe webhook rejected: Missing stripe-signature header');
      return res.status(401).json({ error: "Missing signature" });
    }

    // Verify signature using Stripe SDK
    let event: any;
    const stripe = getStripeClient();
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(401).json({ error: "Invalid signature" });
    }

    const eventId = event.id;
    const eventType = event.type;

    // Idempotency check — in-memory fast path + DB authoritative check
    if (processedStripeEvents.has(eventId)) {
      console.log(`Stripe event ${eventId} already processed (memory)`);
      return res.status(200).json({ received: true });
    }
    const alreadyProcessedInDb = await storage.isWebhookProcessed(eventId);
    if (alreadyProcessedInDb) {
      console.log(`Stripe event ${eventId} already processed (DB)`);
      processedStripeEvents.add(eventId);
      return res.status(200).json({ received: true });
    }

    // Handle transfer events
    if (eventType === 'transfer.paid') {
      processedStripeEvents.add(eventId);
      const transfer = event.data.object;
      const reference = transfer.id;

      console.log(`Stripe transfer completed: ${reference}`);

      // Update transaction status
      await storage.updateTransactionByReference(reference, {
        status: 'completed',
      });

      // Find and update payout if exists
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
      }
    }

    if (eventType === 'transfer.failed') {
      processedStripeEvents.add(eventId);
      const transfer = event.data.object;
      const reference = transfer.id;
      const failureMessage = transfer.failure_message || 'Transfer failed';

      console.log(`Stripe transfer failed: ${reference} - ${failureMessage}`);

      // Update transaction status
      await storage.updateTransactionByReference(reference, {
        status: 'failed',
      });

      // Find and update payout if exists
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'failed',
          failureReason: failureMessage,
        });

        // Refund the wallet balance if initiatedBy user has a wallet
        const payout = payouts[0];
        if (payout.initiatedBy) {
          try {
            const userWallet = await storage.getWalletByUserId(payout.initiatedBy, payout.currency);
            if (userWallet) {
              await storage.creditWallet(
                userWallet.id,
                parseFloat(String(payout.amount)),
                'transfer_refund',
                `Refund for failed transfer ${reference}`,
                `refund-${reference}`,
                { originalReference: reference, failureReason: failureMessage }
              );
              console.log(`Wallet ${userWallet.id} refunded for failed transfer ${reference}`);
            }
          } catch (refundError) {
            console.error(`Failed to refund wallet for transfer ${reference}:`, refundError);
          }
        }
      }
    }

    if (eventType === 'transfer.reversed') {
      processedStripeEvents.add(eventId);
      const transfer = event.data.object;
      const reference = transfer.id;

      console.log(`Stripe transfer reversed: ${reference}`);

      // Update transaction status
      await storage.updateTransactionByReference(reference, {
        status: 'reversed',
      });

      // Find and update payout if exists
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'failed',
          failureReason: 'Transfer reversed',
        });
      }
    }

    // Handle payment intent events (for card payments)
    if (eventType === 'payment_intent.succeeded') {
      processedStripeEvents.add(eventId);
      const paymentIntent = event.data.object;
      const amount = paymentIntent.amount / 100;
      const currency = paymentIntent.currency.toUpperCase();
      const reference = paymentIntent.id;

      console.log(`Stripe payment succeeded: ${reference} - ${currency} ${amount}`);

      // Credit wallet if metadata contains wallet info
      if (paymentIntent.metadata?.walletId) {
        await storage.creditWallet(
          paymentIntent.metadata.walletId,
          amount,
          'card_funding',
          `Card payment via Stripe - ${reference}`,
          reference,
          { provider: 'stripe', paymentIntentId: paymentIntent.id }
        );
      } else {
        // Fallback: credit company balance
        const balances = await storage.getBalances();
        const currentUsd = parseFloat(String(balances.usd || 0));
        await storage.updateBalances({ usd: String(currentUsd + amount) });

        await storage.createTransaction({
          type: 'funding',
          amount: String(amount),
          fee: '0',
          status: 'completed',
          description: `Card payment via Stripe - ${reference}`,
          currency,
          date: new Date().toISOString().split('T')[0],
          reference: null,
          userId: null,
        });
      }

      // SECURITY FIX: Mark in DB to prevent double-crediting on retry/restart
      await storage.markWebhookProcessed(eventId, 'stripe', 'payment_intent.succeeded');
    }

    // ==================== STRIPE ISSUING EVENTS ====================

    // Real-time card authorization decision
    if (eventType === 'issuing_authorization.request') {
      processedStripeEvents.add(eventId);
      const authorization = event.data.object;
      const cardId = authorization.card?.id;
      const requestedAmount = authorization.pending_request?.amount || 0;
      const currency = authorization.pending_request?.currency || 'usd';
      const merchantName = authorization.merchant_data?.name || 'Unknown';

      paymentLogger.info('issuing_auth_request', { cardId, amount: requestedAmount / 100, merchantName });

      // Find the card in our DB
      const allCards = await storage.getCards();
      const dbCard = allCards.find((c: any) => c.stripeCardId === cardId);

      if (dbCard) {
        // Check if card is active and within spending limits
        const cardBalance = parseFloat(String(dbCard.balance || 0));
        const cardLimit = parseFloat(String(dbCard.limit || 0));
        const txAmount = requestedAmount / 100;

        // Auto-approve if within limit (Stripe handles the actual approval via issuing settings)
        paymentLogger.info('issuing_auth_check', {
          cardId, txAmount, cardBalance, cardLimit,
          approved: cardLimit === 0 || txAmount <= cardLimit
        });
      }
    }

    // Card transaction completed (purchase settled)
    if (eventType === 'issuing_transaction.created') {
      processedStripeEvents.add(eventId);
      const transaction = event.data.object;
      const cardId = transaction.card;
      const amount = Math.abs(transaction.amount) / 100;
      const currency = transaction.currency?.toUpperCase() || 'USD';
      const merchantName = transaction.merchant_data?.name || 'Unknown';
      const merchantCategory = transaction.merchant_data?.category || '';

      paymentLogger.info('issuing_transaction_created', { cardId, amount, merchantName });

      // Find card in DB and update balance
      const allCards = await storage.getCards();
      const dbCard = allCards.find((c: any) => c.stripeCardId === cardId);

      if (dbCard) {
        const currentBalance = parseFloat(String(dbCard.balance || 0));
        const newBalance = Math.max(0, currentBalance - amount);

        await storage.updateCard(dbCard.id, {
          balance: newBalance,
        } as any);

        // Create card transaction record
        await storage.createCardTransaction({
          cardId: dbCard.id,
          companyId: dbCard.companyId || null,
          amount: String(amount),
          currency: dbCard.currency || 'USD',
          merchant: merchantName,
          category: merchantCategory,
          description: `Purchase at ${merchantName}`,
          status: 'completed',
          date: new Date().toISOString(),
        });

        paymentLogger.info('card_balance_updated', { cardId: dbCard.id, oldBalance: currentBalance, newBalance, merchant: merchantName });
      }
    }

    // ==================== STRIPE TREASURY EVENTS ====================

    // Incoming money received in Treasury financial account
    if (eventType === 'treasury.received_credit.created') {
      processedStripeEvents.add(eventId);
      const credit = event.data.object;
      const financialAccountId = credit.financial_account;
      const amount = (credit.amount || 0) / 100;
      const currency = credit.currency?.toUpperCase() || 'USD';
      const description = credit.description || 'Incoming transfer';

      paymentLogger.info('treasury_received_credit', { financialAccountId, amount, currency });

      // Find the virtual account linked to this financial account
      const allAccounts = await storage.getVirtualAccounts();
      const virtualAccount = allAccounts.find((a: any) =>
        a.accountNumber === financialAccountId || a.bankCode === financialAccountId
      );

      if (virtualAccount) {
        // Update virtual account balance
        const currentBalance = parseFloat(String(virtualAccount.balance || 0));
        const newBalance = currentBalance + amount;
        await storage.updateVirtualAccount(virtualAccount.id, { balance: String(newBalance) } as any);

        // Credit the user's wallet if linked
        if (virtualAccount.userId) {
          const userWallet = await storage.getWalletByUserId(virtualAccount.userId, currency);
          if (userWallet) {
            await storage.creditWallet(
              userWallet.id,
              amount,
              'virtual_account_funding',
              `Treasury deposit: ${description}`,
              `treasury-${credit.id}`,
              { financialAccountId, treasuryCreditId: credit.id }
            );
          }
        }

        // Create transaction record
        await storage.createTransaction({
          type: 'funding',
          amount: String(amount),
          fee: '0',
          status: 'completed',
          description: `Virtual account deposit: ${description}`,
          currency,
          date: new Date().toISOString(),
          reference: null,
          userId: null,
        });
      }
    }

    // Outbound payment from Treasury completed
    if (eventType === 'treasury.outbound_payment.posted') {
      processedStripeEvents.add(eventId);
      const payment = event.data.object;
      const financialAccountId = payment.financial_account;
      const amount = (payment.amount || 0) / 100;

      paymentLogger.info('treasury_outbound_posted', { financialAccountId, amount });

      // Update payout status if exists
      const payouts = await storage.getPayouts({ providerReference: payment.id });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
