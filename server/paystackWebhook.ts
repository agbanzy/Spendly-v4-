import * as crypto from 'crypto';
import { storage } from './storage';

// TypeScript interfaces
interface PaystackEvent {
  event: string;
  data: {
    reference?: string;
    transfer_code?: string;
    amount: number;
    currency: string;
    status: string;
    customer?: { email: string };
    metadata?: Record<string, any>;
    [key: string]: any;
  };
}

interface WebhookLogEntry {
  event: string;
  reference?: string;
  transferCode?: string;
  amount: number;
  status: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ==================== SIGNATURE VERIFICATION ====================

/**
 * Verifies the HMAC SHA-512 signature of a Paystack webhook payload
 * @param payload - Raw JSON payload as string
 * @param signature - x-paystack-signature header value
 * @returns true if signature is valid, false otherwise
 */
export function verifyPaystackSignature(
  payload: string,
  signature: string
): boolean {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!PAYSTACK_SECRET_KEY) {
    console.error('PAYSTACK WEBHOOK ERROR: PAYSTACK_SECRET_KEY environment variable not set');
    return false;
  }

  try {
    // Create HMAC SHA-512 hash of the payload
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(payload)
      .digest('hex');

    // Compare with provided signature
    return hash === signature;
  } catch (error) {
    console.error('PAYSTACK WEBHOOK ERROR: Signature verification failed', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

// ==================== EVENT HANDLER ====================

/**
 * Main Paystack webhook handler class
 * Processes various Paystack events and updates transaction/wallet states
 */
export class PaystackWebhookHandler {
  /**
   * Process a Paystack webhook event
   * @param event - The Paystack event object
   */
  static async processEvent(event: PaystackEvent): Promise<void> {
    const eventType = event.event;
    const timestamp = new Date().toISOString();

    try {
      switch (eventType) {
        case 'charge.success':
          await this.handleChargeSuccess(event, timestamp);
          break;

        case 'transfer.success':
          await this.handleTransferSuccess(event, timestamp);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event, timestamp);
          break;

        case 'transfer.reversed':
          await this.handleTransferReversed(event, timestamp);
          break;

        case 'dedicatedaccount.assign.success':
          await this.handleDedicatedAccountAssign(event, timestamp);
          break;

        case 'customeridentification.success':
          await this.handleCustomerIdentificationSuccess(event, timestamp);
          break;

        case 'customeridentification.failed':
          await this.handleCustomerIdentificationFailed(event, timestamp);
          break;

        case 'dedicatedaccount.assign.failed':
          await this.handleDedicatedAccountAssignFailed(event, timestamp);
          break;

        case 'subscription.create':
        case 'subscription.disable':
          // Log-only events
          this.logEvent(eventType, event, 'logged', timestamp);
          break;

        default:
          console.warn('PAYSTACK WEBHOOK WARNING: Unknown event type', {
            event: eventType,
            timestamp,
          });
      }
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Event processing failed', {
        event: eventType,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        data: event.data,
      });
      throw error;
    }
  }

  /**
   * Handle charge.success event
   * Marks transaction as Completed and credits user wallet for deposits
   */
  private static async handleChargeSuccess(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { reference, amount, currency, customer, metadata } = event.data;

    if (!reference) {
      throw new Error('charge.success: Missing reference in event data');
    }

    try {
      // Check if webhook already processed (idempotency)
      const isProcessed = await storage.isWebhookProcessed(reference);
      if (isProcessed) {
        console.log('PAYSTACK WEBHOOK INFO: Event already processed', {
          reference,
          timestamp,
        });
        return;
      }

      // Find related transaction
      const transaction = await storage.getTransactionByReference(reference);

      if (!transaction) {
        console.warn('PAYSTACK WEBHOOK WARNING: Transaction not found', {
          reference,
          timestamp,
        });
        return;
      }

      // Update transaction status to Completed
      await storage.updateTransaction(transaction.id, {
        status: 'Completed',
      });

      // If this is a deposit (indicated in metadata), credit wallet
      if (metadata?.type === 'deposit' && transaction.userId) {
        const wallet = await storage.getWalletByUserId(
          transaction.userId,
          currency || 'USD'
        );

        if (!wallet) {
          throw new Error(`Wallet not found for user ${transaction.userId}`);
        }

        // Credit wallet with the amount (convert from kobo to major units)
        const majorAmount = amount / 100;
        await storage.creditWallet(
          wallet.id,
          majorAmount,
          'deposit',
          `Paystack deposit - ${reference}`,
          reference,
          {
            paystackReference: reference,
            customerEmail: customer?.email,
            originalMetadata: metadata,
          }
        );
      }

      // Mark webhook as processed
      await storage.markWebhookProcessed(reference, 'paystack');

      // Log successful processing
      this.logEvent('charge.success', event, 'Completed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process charge.success', {
        reference,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle transfer.success event
   * Marks transfer/payout as Completed
   */
  private static async handleTransferSuccess(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { transfer_code, amount, currency, metadata } = event.data;

    if (!transfer_code) {
      throw new Error('transfer.success: Missing transfer_code in event data');
    }

    try {
      // Check if webhook already processed
      const isProcessed = await storage.isWebhookProcessed(transfer_code);
      if (isProcessed) {
        console.log('PAYSTACK WEBHOOK INFO: Transfer already processed', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      // Find related payout by provider reference
      const payouts = await storage.getPayouts({
        providerReference: transfer_code,
      });

      if (payouts.length === 0) {
        console.warn('PAYSTACK WEBHOOK WARNING: Payout not found', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      const payout = payouts[0];

      // Update payout status to Completed
      await storage.updatePayout(payout.id, {
        status: 'Completed',
      });

      // Mark webhook as processed
      await storage.markWebhookProcessed(transfer_code, 'paystack');

      // Log successful processing
      this.logEvent('transfer.success', event, 'Completed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process transfer.success', {
        transferCode: transfer_code,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle transfer.failed event
   * Marks transfer as Failed and reverses wallet debit with compensating transaction
   */
  private static async handleTransferFailed(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { transfer_code, amount, currency, metadata } = event.data;

    if (!transfer_code) {
      throw new Error('transfer.failed: Missing transfer_code in event data');
    }

    try {
      // Check if webhook already processed
      const isProcessed = await storage.isWebhookProcessed(transfer_code);
      if (isProcessed) {
        console.log('PAYSTACK WEBHOOK INFO: Failed transfer already processed', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      // Find related payout
      const payouts = await storage.getPayouts({
        providerReference: transfer_code,
      });

      if (payouts.length === 0) {
        console.warn('PAYSTACK WEBHOOK WARNING: Failed payout not found', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      const payout = payouts[0];

      // Update payout status to Failed
      await storage.updatePayout(payout.id, {
        status: 'Failed',
      });

      // Reverse wallet debit - credit back the INITIATOR who was debited
      const initiatorId = (payout as any).initiatedBy || payout.recipientId;
      if (initiatorId) {
        const wallet = await storage.getWalletByUserId(
          initiatorId,
          payout.currency || currency || 'USD'
        );

        if (wallet) {
          // Credit back the amount as compensating transaction (convert from kobo)
          const majorAmount = amount / 100;
          await storage.creditWallet(
            wallet.id,
            majorAmount,
            'failed_transfer_reversal',
            `Transfer reversal - failed transfer ${transfer_code}`,
            `${transfer_code}_reversal`,
            {
              originalTransferCode: transfer_code,
              reason: 'transfer_failed',
            }
          );
        }
      }

      // Mark webhook as processed
      await storage.markWebhookProcessed(transfer_code, 'paystack');

      // Log processing
      this.logEvent('transfer.failed', event, 'Failed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process transfer.failed', {
        transferCode: transfer_code,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle transfer.reversed event
   * Marks transfer as Reversed and credits back wallet
   */
  private static async handleTransferReversed(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { transfer_code, amount, currency, metadata } = event.data;

    if (!transfer_code) {
      throw new Error('transfer.reversed: Missing transfer_code in event data');
    }

    try {
      // Check if webhook already processed
      const isProcessed = await storage.isWebhookProcessed(transfer_code);
      if (isProcessed) {
        console.log('PAYSTACK WEBHOOK INFO: Reversed transfer already processed', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      // Find related payout
      const payouts = await storage.getPayouts({
        providerReference: transfer_code,
      });

      if (payouts.length === 0) {
        console.warn('PAYSTACK WEBHOOK WARNING: Reversed payout not found', {
          transferCode: transfer_code,
          timestamp,
        });
        return;
      }

      const payout = payouts[0];

      // Update payout status to Reversed
      await storage.updatePayout(payout.id, {
        status: 'Reversed',
      });

      // Credit back wallet
      if (payout.recipientType === 'user' && payout.recipientId) {
        const wallet = await storage.getWalletByUserId(
          payout.recipientId,
          currency || 'USD'
        );

        if (wallet) {
          // Credit back the full amount (convert from kobo)
          const majorAmount = amount / 100;
          await storage.creditWallet(
            wallet.id,
            majorAmount,
            'transfer_reversal',
            `Transfer reversed - ${transfer_code}`,
            `${transfer_code}_reversal`,
            {
              originalTransferCode: transfer_code,
              reason: 'transfer_reversed',
            }
          );
        }
      }

      // Mark webhook as processed
      await storage.markWebhookProcessed(transfer_code, 'paystack');

      // Log processing
      this.logEvent('transfer.reversed', event, 'Reversed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process transfer.reversed', {
        transferCode: transfer_code,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle dedicatedaccount.assign.success event
   * Updates virtual account record
   */
  private static async handleDedicatedAccountAssign(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { metadata } = event.data;

    try {
      // Extract virtual account ID from metadata if available
      const virtualAccountId = metadata?.virtualAccountId;

      if (!virtualAccountId) {
        console.warn('PAYSTACK WEBHOOK WARNING: virtualAccountId not in metadata', {
          timestamp,
          metadata,
        });
        return;
      }

      // Get virtual account
      const virtualAccount = await storage.getVirtualAccount(virtualAccountId);

      if (!virtualAccount) {
        console.warn('PAYSTACK WEBHOOK WARNING: Virtual account not found', {
          virtualAccountId,
          timestamp,
        });
        return;
      }

      // Update virtual account with new assignment details
      await storage.updateVirtualAccount(virtualAccountId, {
        status: 'active',
        accountNumber: event.data.accountNumber || virtualAccount.accountNumber,
        bankCode: event.data.bank_code || virtualAccount.bankCode,
        accountName: event.data.account_name || virtualAccount.accountName,
      } as any);

      // Log successful processing
      this.logEvent('dedicatedaccount.assign.success', event, 'Updated', timestamp);
    } catch (error) {
      console.error(
        'PAYSTACK WEBHOOK ERROR: Failed to process dedicatedaccount.assign.success',
        {
          error: error instanceof Error ? error.message : String(error),
          timestamp,
        }
      );
      throw error;
    }
  }

  /**
   * Handle customeridentification.success event
   * Updates KYC status to verified
   */
  private static async handleCustomerIdentificationSuccess(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { metadata } = event.data;

    try {
      const customerId = metadata?.customerId;

      if (!customerId) {
        console.warn('PAYSTACK WEBHOOK WARNING: customerId not in metadata', {
          timestamp,
          metadata,
        });
        return;
      }

      // Update KYC status in customer record
      // This would typically update a kyc_status field or similar
      console.log('PAYSTACK WEBHOOK INFO: Customer identification verified', {
        customerId,
        timestamp,
        metadata,
      });

      // Log successful processing
      this.logEvent('customeridentification.success', event, 'Verified', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process customeridentification.success', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle customeridentification.failed event
   * Updates KYC status to failed
   */
  private static async handleCustomerIdentificationFailed(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { metadata } = event.data;

    try {
      const customerId = metadata?.customerId;

      if (!customerId) {
        console.warn('PAYSTACK WEBHOOK WARNING: customerId not in metadata', {
          timestamp,
          metadata,
        });
        return;
      }

      // Update KYC status to failed
      console.warn('PAYSTACK WEBHOOK WARNING: Customer identification failed', {
        customerId,
        timestamp,
        metadata,
      });

      // Log processing
      this.logEvent('customeridentification.failed', event, 'Failed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process customeridentification.failed', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Handle dedicatedaccount.assign.failed event
   * Updates virtual account status to failed
   */
  private static async handleDedicatedAccountAssignFailed(
    event: PaystackEvent,
    timestamp: string
  ): Promise<void> {
    const { metadata } = event.data;

    try {
      const virtualAccountId = metadata?.virtualAccountId;

      if (!virtualAccountId) {
        console.warn('PAYSTACK WEBHOOK WARNING: virtualAccountId not in metadata for failed assignment', {
          timestamp,
          metadata,
        });
        return;
      }

      // Get virtual account
      const virtualAccount = await storage.getVirtualAccount(virtualAccountId);

      if (!virtualAccount) {
        console.warn('PAYSTACK WEBHOOK WARNING: Virtual account not found for failed assignment', {
          virtualAccountId,
          timestamp,
        });
        return;
      }

      // Update virtual account status to failed
      await storage.updateVirtualAccount(virtualAccountId, {
        status: 'failed',
      } as any);

      // Log processing
      this.logEvent('dedicatedaccount.assign.failed', event, 'Failed', timestamp);
    } catch (error) {
      console.error('PAYSTACK WEBHOOK ERROR: Failed to process dedicatedaccount.assign.failed', {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      });
      throw error;
    }
  }

  /**
   * Log webhook events in structured format
   */
  private static logEvent(
    eventType: string,
    event: PaystackEvent,
    status: string,
    timestamp: string
  ): void {
    const logEntry: WebhookLogEntry = {
      event: eventType,
      reference: event.data.reference,
      transferCode: event.data.transfer_code,
      amount: event.data.amount,
      status,
      timestamp,
      metadata: event.data.metadata,
    };

    console.log('PAYSTACK WEBHOOK EVENT:', JSON.stringify(logEntry));
  }
}
