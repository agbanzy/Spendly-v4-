import type { Express, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { getStripeClient } from './stripeClient';
import { storage } from './storage';
import { paymentLogger } from './utils/paymentUtils';
import { resolveCompanyForWebhook } from './lib/webhook-company-resolver';

// ==================== TYPES ====================

interface StripeWebhookLogEntry {
  event: string;
  eventId: string;
  amount?: number;
  currency?: string;
  status: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ==================== STRIPE WEBHOOK HANDLER ====================

/**
 * Stripe webhook handler class
 * Processes various Stripe events and updates transaction/wallet/card/payout states.
 * Modelled after PaystackWebhookHandler for consistency.
 */
export class StripeWebhookHandler {
  /**
   * Process a verified Stripe event
   * @param event - The Stripe event object (already signature-verified)
   */
  static async processEvent(event: Stripe.Event): Promise<void> {
    // Cast to string to handle Connect/Issuing/Treasury events not in the
    // standard Stripe.Event.type union (e.g. transfer.paid, transfer.failed).
    const eventType: string = event.type;
    const eventId = event.id;
    const timestamp = new Date().toISOString();

    try {
      switch (eventType) {
        // ---- Payment Intent Events ----
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event, timestamp);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event, timestamp);
          break;

        // ---- Checkout Session Events (Invoice Payments) ----
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event, timestamp);
          break;

        // ---- Charge / Refund Events ----
        case 'charge.refunded':
          await this.handleChargeRefunded(event, timestamp);
          break;

        // ---- Stripe Issuing Events ----
        case 'issuing_authorization.request':
          await this.handleIssuingAuthorizationRequest(event, timestamp);
          break;

        case 'issuing_transaction.created':
          await this.handleIssuingTransactionCreated(event, timestamp);
          break;

        // ---- Stripe Transfer Events (Connect payouts) ----
        case 'transfer.paid':
          await this.handleTransferPaid(event, timestamp);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event, timestamp);
          break;

        case 'transfer.reversed':
          await this.handleTransferReversed(event, timestamp);
          break;

        // ---- Stripe Payout Events ----
        case 'payout.paid':
          await this.handlePayoutPaid(event, timestamp);
          break;

        case 'payout.failed':
          await this.handlePayoutFailed(event, timestamp);
          break;

        // AUD-PR-010 / AUD-DB-010 Phase 1 — Stripe Connect Express
        // account lifecycle events. account.updated fires when the
        // recipient finishes (or fails) onboarding. We map the
        // account.id back to the local payout_destination row and
        // update its stripe_connect_onboarding_status.
        case 'account.updated':
          await this.handleAccountUpdated(event, timestamp);
          break;

        // ---- Treasury Events ----
        case 'treasury.received_credit.created':
          await this.handleTreasuryReceivedCredit(event, timestamp);
          break;

        case 'treasury.outbound_payment.posted':
          await this.handleTreasuryOutboundPosted(event, timestamp);
          break;

        default:
          console.warn('STRIPE WEBHOOK WARNING: Unhandled event type', {
            event: eventType,
            eventId,
            timestamp,
          });
          break;
      }
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Event processing failed', {
        event: eventType,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== PAYMENT INTENT HANDLERS ====================

  /**
   * Handle payment_intent.succeeded
   * Credits wallet if walletId is in metadata, otherwise credits company balance
   * and creates a transaction record.
   */
  private static async handlePaymentIntentSucceeded(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const eventId = event.id;
    const amount = paymentIntent.amount / 100;
    const currency = paymentIntent.currency.toUpperCase();
    const reference = paymentIntent.id;
    const metadata = paymentIntent.metadata || {};

    try {
      // Idempotency: check if already processed
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'payment_intent.succeeded', reference });
        return;
      }

      paymentLogger.info('payment_intent_succeeded', { reference, amount, currency, metadata });

      const userId = metadata.userId;
      // LU-DD-2: companyId is read from the server-issued payment_intent_index
      // (keyed by paymentIntent.id), with metadata.companyId as a fallback for
      // in-flight events created before the index started being written.
      // Mismatches between the two are logged as security alerts inside the
      // resolver and the index value wins.
      const companyResolution = await resolveCompanyForWebhook('stripe', paymentIntent.id, metadata.companyId);
      const companyId = companyResolution.companyId;
      const walletId = metadata.walletId;
      const purpose = metadata.purpose || metadata.type;

      if (walletId) {
        // Purpose-based wallet crediting (e.g. wallet_funding, card_funding, deposit)
        const creditType = purpose === 'wallet_funding' ? 'deposit' : (purpose || 'card_funding');
        await storage.creditWallet(
          walletId,
          amount,
          creditType,
          `Stripe payment - ${reference}`,
          reference,
          {
            provider: 'stripe',
            paymentIntentId: paymentIntent.id,
            userId,
            companyId,
            purpose,
          }
        );

        paymentLogger.info('wallet_credited', { walletId, amount, currency, reference, purpose: creditType });
      } else {
        // Fallback: credit company balance directly
        const balances = await storage.getBalances(companyId || undefined);
        const balanceField = currency.toLowerCase() === 'usd' ? 'usd'
          : currency.toLowerCase() === 'ngn' ? 'ngn'
          : currency.toLowerCase() === 'eur' ? 'eur'
          : currency.toLowerCase() === 'gbp' ? 'gbp'
          : 'usd';
        const currentAmount = parseFloat(String((balances as any)[balanceField] || 0));
        await storage.updateBalances(
          { [balanceField]: String(currentAmount + amount) } as any,
          companyId || undefined
        );

        paymentLogger.info('company_balance_credited', { amount, currency, companyId });
      }

      // Create a transaction record
      await storage.createTransaction({
        type: 'funding',
        amount: String(amount),
        fee: '0',
        status: 'completed',
        description: `Card payment via Stripe - ${reference}`,
        currency,
        date: new Date().toISOString().split('T')[0],
        reference,
        userId: userId || null,
        companyId: companyId || null,
      });

      // Also update any existing pending transaction with this reference
      await storage.updateTransactionByReference(reference, { status: 'Completed' });

      // Mark webhook as processed
      await storage.markWebhookProcessed(eventId, 'stripe', 'payment_intent.succeeded', {
        reference,
        amount,
        currency,
        walletId,
      });

      this.logEvent('payment_intent.succeeded', eventId, 'Completed', timestamp, { amount, currency, reference });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process payment_intent.succeeded', {
        reference,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle payment_intent.payment_failed
   * Logs the failure and updates any related transaction to 'failed'.
   */
  private static async handlePaymentIntentFailed(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const eventId = event.id;
    const reference = paymentIntent.id;
    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
    const metadata = paymentIntent.metadata || {};

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'payment_intent.payment_failed', reference });
        return;
      }

      paymentLogger.warn('payment_intent_failed', {
        reference,
        failureMessage,
        errorCode: paymentIntent.last_payment_error?.code,
        metadata,
      });

      // Update any existing transaction with this reference to Failed
      const transaction = await storage.getTransactionByReference(reference);
      if (transaction) {
        await storage.updateTransaction(transaction.id, { status: 'failed' });
        paymentLogger.info('transaction_marked_failed', { transactionId: transaction.id, reference });
      }

      // Also try by reference directly
      await storage.updateTransactionByReference(reference, { status: 'failed' });

      await storage.markWebhookProcessed(eventId, 'stripe', 'payment_intent.payment_failed', {
        reference,
        failureMessage,
      });

      this.logEvent('payment_intent.payment_failed', eventId, 'Failed', timestamp, {
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency?.toUpperCase(),
        reference,
        failureMessage,
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process payment_intent.payment_failed', {
        reference,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== CHECKOUT SESSION HANDLER (Invoice Payments) ====================

  /**
   * Handle checkout.session.completed
   * Marks invoice as paid when Stripe Checkout Session completes.
   */
  private static async handleCheckoutSessionCompleted(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const eventId = event.id;
    const metadata = session.metadata || {};

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'checkout.session.completed' });
        return;
      }

      // Only handle invoice payments
      if (metadata.type !== 'invoice_payment' || !metadata.invoiceId) {
        paymentLogger.info('checkout_session_not_invoice', { eventId, metadata });
        await storage.markWebhookProcessed(eventId, 'stripe', 'checkout.session.completed', { skipped: true });
        return;
      }

      const invoiceId = metadata.invoiceId;
      const amount = (session.amount_total || 0) / 100;
      const currency = session.currency?.toUpperCase() || 'USD';
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as any)?.id || session.id;

      paymentLogger.info('checkout_session_invoice_paid', {
        invoiceId,
        invoiceNumber: metadata.invoiceNumber,
        amount,
        currency,
        paymentIntentId,
      });

      // Mark invoice as paid
      await storage.updateInvoice(invoiceId, {
        status: 'paid',
      } as any);

      // LU-DD-2: resolve companyId from the index, fall back to metadata
      const checkoutCompanyResolution = await resolveCompanyForWebhook('stripe', paymentIntentId, metadata.companyId);
      const checkoutCompanyId = checkoutCompanyResolution.companyId;

      // Credit company wallet if companyId resolved
      if (checkoutCompanyId) {
        const companyWallets = await storage.getWallets(checkoutCompanyId);
        const matchingWallet = companyWallets.find((w: any) => w.currency?.toUpperCase() === currency);
        if (matchingWallet) {
          await storage.creditWallet(
            matchingWallet.id,
            amount,
            'invoice_payment',
            `Invoice ${metadata.invoiceNumber} paid via Stripe`,
            paymentIntentId,
            { invoiceId, invoiceNumber: metadata.invoiceNumber }
          );
        }
      }

      // Create transaction record
      await storage.createTransaction({
        type: 'invoice_payment',
        amount: String(amount),
        fee: '0',
        status: 'completed',
        description: `Invoice ${metadata.invoiceNumber} paid via Stripe`,
        currency,
        date: new Date().toISOString(),
        reference: paymentIntentId,
        userId: null,
        companyId: checkoutCompanyId || null,
      });

      await storage.markWebhookProcessed(eventId, 'stripe', 'checkout.session.completed', {
        invoiceId,
        amount,
        currency,
        paymentIntentId,
      });

      this.logEvent('checkout.session.completed', eventId, 'Completed', timestamp, { amount, currency });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process checkout.session.completed', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== REFUND HANDLER ====================

  /**
   * Handle charge.refunded
   * Finds the original transaction, creates a refund record,
   * and if a wallet was credited, debits it back.
   */
  private static async handleChargeRefunded(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    const eventId = event.id;
    const chargeId = charge.id;
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : (charge.payment_intent as any)?.id || null;
    const refundedAmount = (charge.amount_refunded || 0) / 100;
    const currency = charge.currency.toUpperCase();
    const metadata = charge.metadata || {};

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'charge.refunded', chargeId });
        return;
      }

      paymentLogger.info('charge_refunded', { chargeId, paymentIntentId, refundedAmount, currency });

      // Try to find original transaction by payment intent ID or charge ID
      let originalTransaction = paymentIntentId
        ? await storage.getTransactionByReference(paymentIntentId)
        : undefined;
      if (!originalTransaction) {
        originalTransaction = await storage.getTransactionByReference(chargeId);
      }

      // LU-DD-2: refund company resolved from index by paymentIntentId,
      // falling back to metadata.companyId or the original transaction's
      // companyId (the linked txn was itself written from a verified
      // webhook, so trusting it is safe).
      const refundCompanyResolution = paymentIntentId
        ? await resolveCompanyForWebhook('stripe', paymentIntentId, metadata.companyId)
        : { companyId: metadata.companyId ?? null, source: 'metadata-fallback' as const, mismatch: false };
      const refundCompanyId = refundCompanyResolution.companyId || originalTransaction?.companyId || null;

      // Create a refund transaction record
      const refundReference = `refund_${chargeId}`;
      await storage.createTransaction({
        type: 'refund',
        amount: String(refundedAmount),
        fee: '0',
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        description: `Stripe refund - ${chargeId}`,
        currency,
        reference: refundReference,
        userId: metadata.userId || originalTransaction?.userId || null,
        companyId: refundCompanyId,
      });

      // If the original payment credited a wallet, debit it back
      const walletId = metadata.walletId;
      const userId = metadata.userId || originalTransaction?.userId;

      if (walletId) {
        // Direct wallet ID from metadata
        try {
          await storage.debitWallet(
            walletId,
            refundedAmount,
            'refund',
            `Refund for charge ${chargeId}`,
            refundReference,
            { originalChargeId: chargeId, originalPaymentIntentId: paymentIntentId }
          );
          paymentLogger.info('wallet_debited_for_refund', { walletId, amount: refundedAmount, chargeId });
        } catch (debitError) {
          console.error('STRIPE WEBHOOK ERROR: Failed to debit wallet for refund', {
            walletId,
            chargeId,
            error: debitError instanceof Error ? debitError.message : String(debitError),
          });
        }
      } else if (userId) {
        // Try to find wallet by userId
        try {
          const userWallet = await storage.getWalletByUserId(userId, currency);
          if (userWallet) {
            await storage.debitWallet(
              userWallet.id,
              refundedAmount,
              'refund',
              `Refund for charge ${chargeId}`,
              refundReference,
              { originalChargeId: chargeId, originalPaymentIntentId: paymentIntentId }
            );
            paymentLogger.info('wallet_debited_for_refund', { walletId: userWallet.id, amount: refundedAmount, chargeId });
          }
        } catch (debitError) {
          console.error('STRIPE WEBHOOK ERROR: Failed to debit wallet for refund (by userId)', {
            userId,
            chargeId,
            error: debitError instanceof Error ? debitError.message : String(debitError),
          });
        }
      } else {
        // Fallback: debit company balance — reuse the resolution computed
        // above to keep the index value as the authoritative source.
        try {
          const companyId = refundCompanyId || undefined;
          const balances = await storage.getBalances(companyId);
          const balanceField = currency.toLowerCase() === 'usd' ? 'usd'
            : currency.toLowerCase() === 'ngn' ? 'ngn'
            : currency.toLowerCase() === 'eur' ? 'eur'
            : currency.toLowerCase() === 'gbp' ? 'gbp'
            : 'usd';
          const currentAmount = parseFloat(String((balances as any)[balanceField] || 0));
          await storage.updateBalances(
            { [balanceField]: String(Math.max(0, currentAmount - refundedAmount)) } as any,
            companyId
          );
          paymentLogger.info('company_balance_debited_for_refund', { amount: refundedAmount, currency, companyId });
        } catch (balanceError) {
          console.error('STRIPE WEBHOOK ERROR: Failed to debit company balance for refund', {
            chargeId,
            error: balanceError instanceof Error ? balanceError.message : String(balanceError),
          });
        }
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'charge.refunded', {
        chargeId,
        refundedAmount,
        currency,
      });

      this.logEvent('charge.refunded', eventId, 'Completed', timestamp, {
        amount: refundedAmount,
        currency,
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process charge.refunded', {
        chargeId,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== ISSUING HANDLERS ====================

  /**
   * Handle issuing_authorization.request
   * Logs the authorization request and checks card limits (informational).
   * Stripe handles the actual approve/decline via issuing settings.
   */
  private static async handleIssuingAuthorizationRequest(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const authorization = event.data.object as any;
    const eventId = event.id;
    const cardId = authorization.card?.id;
    const requestedAmount = (authorization.pending_request?.amount || 0) / 100;
    const currency = authorization.pending_request?.currency || 'usd';
    const merchantName = authorization.merchant_data?.name || 'Unknown';

    paymentLogger.info('issuing_auth_request', { cardId, amount: requestedAmount, merchantName, currency });

    // Find card in DB for limit checking (informational only)
    const allCards = await storage.getCards();
    const dbCard = allCards.find((c: any) => c.stripeCardId === cardId);

    if (dbCard) {
      const cardBalance = parseFloat(String(dbCard.balance || 0));
      const cardLimit = parseFloat(String(dbCard.limit || 0));

      paymentLogger.info('issuing_auth_check', {
        cardId,
        dbCardId: dbCard.id,
        txAmount: requestedAmount,
        cardBalance,
        cardLimit,
        approved: cardLimit === 0 || requestedAmount <= cardLimit,
      });
    } else {
      paymentLogger.warn('issuing_auth_card_not_found', { stripeCardId: cardId, merchantName });
    }

    // No idempotency marking needed for authorization requests (informational)
    this.logEvent('issuing_authorization.request', eventId, 'Logged', timestamp, {
      amount: requestedAmount,
      currency: currency.toUpperCase(),
    });
  }

  /**
   * Handle issuing_transaction.created
   * Records a card transaction and updates the card balance.
   */
  private static async handleIssuingTransactionCreated(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const transaction = event.data.object as any;
    const eventId = event.id;
    const stripeCardId = transaction.card;
    const amount = Math.abs(transaction.amount) / 100;
    const currency = transaction.currency?.toUpperCase() || 'USD';
    const merchantName = transaction.merchant_data?.name || 'Unknown';
    const merchantCategory = transaction.merchant_data?.category || '';

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'issuing_transaction.created', stripeCardId });
        return;
      }

      paymentLogger.info('issuing_transaction_created', { stripeCardId, amount, currency, merchantName });

      // Find card in DB by Stripe card ID
      const allCards = await storage.getCards();
      const dbCard = allCards.find((c: any) => c.stripeCardId === stripeCardId);

      if (dbCard) {
        const currentBalance = parseFloat(String(dbCard.balance || 0));
        const newBalance = Math.max(0, currentBalance - amount);

        // Update card balance
        await storage.updateCard(dbCard.id, {
          balance: newBalance,
        } as any);

        // Create card transaction record
        await storage.createCardTransaction({
          cardId: dbCard.id,
          companyId: dbCard.companyId || null,
          amount: String(amount),
          currency,
          merchant: merchantName,
          category: merchantCategory,
          description: `Purchase at ${merchantName}`,
          status: 'completed',
          date: new Date().toISOString(),
        });

        paymentLogger.info('card_balance_updated', {
          cardId: dbCard.id,
          oldBalance: currentBalance,
          newBalance,
          merchant: merchantName,
        });
      } else {
        paymentLogger.warn('issuing_transaction_card_not_found', {
          stripeCardId,
          merchantName,
          amount,
        });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'issuing_transaction.created', {
        stripeCardId,
        amount,
        merchantName,
      });

      this.logEvent('issuing_transaction.created', eventId, 'Completed', timestamp, {
        amount,
        currency,
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process issuing_transaction.created', {
        stripeCardId,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== TRANSFER HANDLERS ====================

  /**
   * Handle transfer.paid
   * Updates transaction and payout status to Completed.
   */
  private static async handleTransferPaid(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const transfer = event.data.object as any;
    const eventId = event.id;
    const reference = transfer.id;

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'transfer.paid', reference });
        return;
      }

      paymentLogger.info('transfer_paid', { reference, amount: (transfer.amount || 0) / 100 });

      // Update transaction status
      await storage.updateTransactionByReference(reference, { status: 'Completed' });

      // Find and update payout if exists
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'transfer.paid', { reference });

      this.logEvent('transfer.paid', eventId, 'Completed', timestamp, {
        amount: (transfer.amount || 0) / 100,
        currency: transfer.currency?.toUpperCase(),
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process transfer.paid', {
        reference,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle transfer.failed
   * Marks transfer as Failed and reverses wallet debit with compensating credit.
   */
  private static async handleTransferFailed(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const transfer = event.data.object as any;
    const eventId = event.id;
    const reference = transfer.id;
    const failureMessage = transfer.failure_message || 'Transfer failed';

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'transfer.failed', reference });
        return;
      }

      paymentLogger.warn('transfer_failed', { reference, failureMessage });

      // Update transaction status
      await storage.updateTransactionByReference(reference, { status: 'failed' });

      // Find and update payout if exists, then refund wallet
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        const payout = payouts[0];

        await storage.updatePayout(payout.id, {
          status: 'failed',
          failureReason: failureMessage,
        });

        // Refund the wallet balance if initiatedBy user has a wallet
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
              paymentLogger.info('wallet_refunded_transfer_failed', {
                walletId: userWallet.id,
                amount: payout.amount,
                reference,
              });
            }
          } catch (refundError) {
            console.error('STRIPE WEBHOOK ERROR: Failed to refund wallet for transfer', {
              reference,
              error: refundError instanceof Error ? refundError.message : String(refundError),
            });
          }
        }
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'transfer.failed', {
        reference,
        failureMessage,
      });

      this.logEvent('transfer.failed', eventId, 'Failed', timestamp, {
        amount: (transfer.amount || 0) / 100,
        currency: transfer.currency?.toUpperCase(),
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process transfer.failed', {
        reference,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle transfer.reversed
   * Marks transfer as Reversed and updates payout.
   */
  private static async handleTransferReversed(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const transfer = event.data.object as any;
    const eventId = event.id;
    const reference = transfer.id;

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'transfer.reversed', reference });
        return;
      }

      paymentLogger.info('transfer_reversed', { reference });

      // Update transaction status
      await storage.updateTransactionByReference(reference, { status: 'Reversed' });

      // Find and update payout if exists
      const payouts = await storage.getPayouts({ providerReference: reference });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'failed',
          failureReason: 'Transfer reversed',
        });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'transfer.reversed', { reference });

      this.logEvent('transfer.reversed', eventId, 'Reversed', timestamp, {
        amount: (transfer.amount || 0) / 100,
        currency: transfer.currency?.toUpperCase(),
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process transfer.reversed', {
        reference,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== PAYOUT HANDLERS ====================

  /**
   * Handle payout.paid
   * Updates payout status to completed.
   */
  private static async handlePayoutPaid(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    const eventId = event.id;
    const payoutId = payout.id;
    const amount = (payout.amount || 0) / 100;
    const currency = payout.currency?.toUpperCase() || 'USD';

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'payout.paid', payoutId });
        return;
      }

      paymentLogger.info('payout_paid', { payoutId, amount, currency });

      // Find payout by providerReference
      const payouts = await storage.getPayouts({ providerReference: payoutId });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
        paymentLogger.info('payout_status_updated', { dbPayoutId: payouts[0].id, status: 'completed' });
      } else {
        paymentLogger.warn('payout_not_found_in_db', { payoutId });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'payout.paid', {
        payoutId,
        amount,
        currency,
      });

      this.logEvent('payout.paid', eventId, 'Completed', timestamp, { amount, currency });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process payout.paid', {
        payoutId,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle payout.failed
   * Updates payout status to failed with failure reason.
   */
  private static async handlePayoutFailed(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const payout = event.data.object as Stripe.Payout;
    const eventId = event.id;
    const payoutId = payout.id;
    const amount = (payout.amount || 0) / 100;
    const currency = payout.currency?.toUpperCase() || 'USD';
    const failureCode = payout.failure_code || 'unknown';
    const failureMessage = payout.failure_message || 'Payout failed';

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'payout.failed', payoutId });
        return;
      }

      paymentLogger.warn('payout_failed', { payoutId, amount, currency, failureCode, failureMessage });

      // Find payout by providerReference
      const payouts = await storage.getPayouts({ providerReference: payoutId });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'failed',
          failureReason: `${failureCode}: ${failureMessage}`,
        });
        paymentLogger.info('payout_status_updated', { dbPayoutId: payouts[0].id, status: 'failed', failureCode });
      } else {
        paymentLogger.warn('payout_not_found_in_db', { payoutId });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'payout.failed', {
        payoutId,
        amount,
        currency,
        failureCode,
        failureMessage,
      });

      this.logEvent('payout.failed', eventId, 'Failed', timestamp, {
        amount,
        currency,
        metadata: { failureCode, failureMessage },
      });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process payout.failed', {
        payoutId,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== STRIPE CONNECT (AUD-PR-010 / AUD-DB-010 Phase 1) ====================

  /**
   * Handle account.updated.
   *
   * Maps Stripe's lifecycle (charges_enabled, payouts_enabled,
   * requirements.disabled_reason) to our four-state
   * stripe_connect_onboarding_status:
   *   - verified:   payouts_enabled === true (onboarding complete)
   *   - restricted: requirements.disabled_reason set (Stripe wants
   *                 more info; recipient must revisit Express)
   *   - disabled:   account.deleted === true OR detail explicitly
   *                 says permanently disabled
   *   - pending:    everything else (still in onboarding)
   *
   * If the acct_* id doesn't map to a payout_destinations row we
   * silently no-op — Stripe sends account.updated for any account
   * on the platform, including ones we no longer track.
   */
  private static async handleAccountUpdated(
    event: Stripe.Event,
    timestamp: string,
  ): Promise<void> {
    const account = event.data.object as Stripe.Account;
    const accountId = account.id;

    const destination = await storage.getPayoutDestinationByStripeAccount(accountId);
    if (!destination) {
      // Not one of ours — Stripe sends webhooks for the entire
      // platform; ignore accounts we don't track.
      paymentLogger.info('stripe_connect_account_unknown', { accountId, eventId: event.id });
      return;
    }

    let status: 'pending' | 'verified' | 'restricted' | 'disabled';
    if ((account as any).deleted === true) {
      status = 'disabled';
    } else if (account.payouts_enabled === true) {
      status = 'verified';
    } else if (account.requirements?.disabled_reason) {
      status = 'restricted';
    } else {
      status = 'pending';
    }

    await storage.updateStripeConnectStatus(accountId, status);

    paymentLogger.info('stripe_connect_account_status_changed', {
      accountId,
      destinationId: destination.id,
      status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      disabledReason: account.requirements?.disabled_reason ?? null,
    });
  }

  // ==================== TREASURY HANDLERS ====================

  /**
   * Handle treasury.received_credit.created
   * Credits the virtual account balance and linked wallet.
   */
  private static async handleTreasuryReceivedCredit(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const credit = event.data.object as any;
    const eventId = event.id;
    const financialAccountId = credit.financial_account;
    const amount = (credit.amount || 0) / 100;
    const currency = credit.currency?.toUpperCase() || 'USD';
    const description = credit.description || 'Incoming transfer';

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'treasury.received_credit.created' });
        return;
      }

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
          reference: `treasury-${credit.id}`,
          userId: virtualAccount.userId || null,
        });
      } else {
        paymentLogger.warn('treasury_virtual_account_not_found', { financialAccountId });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'treasury.received_credit.created', {
        financialAccountId,
        amount,
        currency,
      });

      this.logEvent('treasury.received_credit.created', eventId, 'Completed', timestamp, { amount, currency });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process treasury.received_credit.created', {
        financialAccountId,
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle treasury.outbound_payment.posted
   * Updates payout status to completed.
   */
  private static async handleTreasuryOutboundPosted(
    event: Stripe.Event,
    timestamp: string
  ): Promise<void> {
    const payment = event.data.object as any;
    const eventId = event.id;
    const financialAccountId = payment.financial_account;
    const amount = (payment.amount || 0) / 100;

    try {
      const isProcessed = await storage.isWebhookProcessed(eventId);
      if (isProcessed) {
        paymentLogger.info('stripe_webhook_duplicate', { eventId, eventType: 'treasury.outbound_payment.posted' });
        return;
      }

      paymentLogger.info('treasury_outbound_posted', { financialAccountId, amount, paymentId: payment.id });

      // Update payout status if exists
      const payouts = await storage.getPayouts({ providerReference: payment.id });
      if (payouts.length > 0) {
        await storage.updatePayout(payouts[0].id, {
          status: 'completed',
          processedAt: new Date().toISOString(),
        });
      }

      await storage.markWebhookProcessed(eventId, 'stripe', 'treasury.outbound_payment.posted', {
        paymentId: payment.id,
        amount,
      });

      this.logEvent('treasury.outbound_payment.posted', eventId, 'Completed', timestamp, { amount });
    } catch (error) {
      console.error('STRIPE WEBHOOK ERROR: Failed to process treasury.outbound_payment.posted', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  // ==================== LOGGING ====================

  /**
   * Log webhook events in structured format
   */
  private static logEvent(
    eventType: string,
    eventId: string,
    status: string,
    timestamp: string,
    extra?: Record<string, any>
  ): void {
    const logEntry: StripeWebhookLogEntry = {
      event: eventType,
      eventId,
      status,
      timestamp,
      amount: extra?.amount,
      currency: extra?.currency,
      metadata: extra?.metadata,
    };

    console.log('STRIPE WEBHOOK EVENT:', JSON.stringify(logEntry));
  }
}

// ==================== ROUTE REGISTRATION ====================

/**
 * Register the Stripe webhook route on the Express app.
 *
 * IMPORTANT: This must be called BEFORE app.use(express.json()) so the
 * raw body is available for signature verification. The route uses
 * express.raw() as inline middleware to preserve the raw Buffer payload.
 *
 * @param app - Express application instance
 */
export function registerStripeWebhooks(app: Express): void {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        // ---- Config validation ----
        const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!process.env.STRIPE_SECRET_KEY) {
          console.error('STRIPE WEBHOOK ERROR: STRIPE_SECRET_KEY not configured');
          return res.status(500).json({ error: 'Webhook configuration error' });
        }

        if (!stripeWebhookSecret) {
          console.error('STRIPE WEBHOOK ERROR: STRIPE_WEBHOOK_SECRET not configured');
          return res.status(500).json({ error: 'Webhook configuration error' });
        }

        // ---- Signature verification ----
        const sig = req.headers['stripe-signature'];
        if (!sig) {
          console.error('STRIPE WEBHOOK ERROR: Missing stripe-signature header');
          return res.status(401).json({ error: 'Missing signature' });
        }

        let event: Stripe.Event;
        const stripe = getStripeClient();
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
        } catch (err: any) {
          console.error('STRIPE WEBHOOK ERROR: Signature verification failed', err.message);
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const eventId = event.id;
        const eventType = event.type;

        // ---- Idempotency check (DB-level) ----
        const alreadyProcessed = await storage.isWebhookProcessed(eventId);
        if (alreadyProcessed) {
          console.log(`STRIPE WEBHOOK INFO: Event ${eventId} (${eventType}) already processed`);
          return res.status(200).json({ received: true });
        }

        console.log(JSON.stringify({
          level: 'info',
          event: 'stripe_webhook_received',
          type: eventType,
          eventId,
          timestamp: new Date().toISOString(),
        }));

        // Acknowledge receipt immediately, then process asynchronously
        res.status(200).json({ received: true });

        // Process event asynchronously to avoid Stripe timeouts
        StripeWebhookHandler.processEvent(event).catch((err) => {
          console.error(JSON.stringify({
            level: 'error',
            event: 'stripe_webhook_processing_failed',
            type: eventType,
            eventId,
            error: err.message,
            timestamp: new Date().toISOString(),
          }));
        });
      } catch (error: any) {
        console.error('STRIPE WEBHOOK ERROR: Top-level handler failure', error.message);
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
          res.status(400).json({ error: 'Webhook processing failed' });
        }
      }
    }
  );
}
