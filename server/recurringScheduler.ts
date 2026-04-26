import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { paystackClient } from "./paystackClient";
import { getStripeClient } from "./stripeClient";
import { getPaymentProvider, getCurrencyForCountry } from "./paymentService";
import { logger as baseLogger } from "./lib/logger";

// LU-002 / LU-003 / AUD-BE-001 / AUD-BE-004
// Scheduler hardened to (a) acquire a Postgres advisory lock per tick so only
// one ECS instance runs at a time, and (b) use pino instead of console for
// structured operational logging.

const logger = baseLogger.child({ module: "recurring-scheduler" });
const SCHEDULER_LOCK_NAME = "financiar.recurring-scheduler";

function computeNextDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate);
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Run `fn` only if this instance can acquire the named Postgres advisory lock.
 * Returns null when another instance holds the lock; otherwise returns the
 * function result. The lock is automatically released when the surrounding
 * transaction commits or rolls back.
 */
async function withSchedulerLock<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  return await db.transaction(async (tx) => {
    const result = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${name})::int) AS acquired`
    );
    const acquired = (result.rows[0] as any)?.acquired === true;
    if (!acquired) {
      logger.debug({ schedulerName: name }, "Lock not acquired — another instance is running");
      return null;
    }
    return await fn();
  });
}

async function processRecurringBills() {
  let bills;
  try {
    bills = await storage.getBills();
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch bills");
    return;
  }

  const now = new Date().toISOString().split('T')[0];
  const allBills = bills;

  for (const bill of bills) {
    try {
      if (!bill.recurring) continue;
      if (bill.status?.toLowerCase() !== 'paid') continue;

      const frequency = (bill as any).frequency || 'monthly';
      const nextDueDate = computeNextDate(bill.dueDate, frequency);

      if (nextDueDate > now) continue;

      // In-memory pre-check (fast path); the DB unique index `bills_recurring_dedup_unique`
      // (migration 0008) is the authoritative dedup if two instances slip past the lock.
      const alreadyCreated = allBills.some(
        (b: any) =>
          b.name === bill.name &&
          b.dueDate === nextDueDate &&
          (b.companyId ?? null) === ((bill as any).companyId ?? null) &&
          b.status?.toLowerCase() !== 'paid'
      );
      if (alreadyCreated) continue;

      try {
        await storage.createBill({
          name: bill.name,
          provider: bill.provider,
          amount: bill.amount,
          dueDate: nextDueDate,
          category: bill.category,
          status: 'unpaid',
          currency: bill.currency,
          recurring: true,
          frequency,
          userId: bill.userId,
          companyId: bill.companyId,
        } as any);
        logger.info({ billName: bill.name, dueDate: nextDueDate, companyId: (bill as any).companyId }, "Created recurring bill");
      } catch (createErr: any) {
        // Race winner already inserted — DB unique constraint rejects duplicate.
        if (typeof createErr?.message === 'string' && /bills_recurring_dedup_unique/.test(createErr.message)) {
          logger.info({ billName: bill.name, dueDate: nextDueDate }, "Dedup constraint rejected duplicate recurring bill (expected under contention)");
          continue;
        }
        throw createErr;
      }
    } catch (error: any) {
      logger.error({ err: error, billId: bill.id, billName: bill.name }, "Error processing recurring bill");
    }
  }
}

async function processRecurringPayroll() {
  let recurringEntries;
  try {
    recurringEntries = await storage.getRecurringPayrollEntries();
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch recurring payroll entries");
    return;
  }

  const now = new Date().toISOString().split('T')[0];

  for (const entry of recurringEntries) {
    try {
      if (entry.status !== 'paid' && entry.status !== 'processing' && entry.status !== 'completed') continue;

      const frequency = (entry as any).frequency || 'monthly';
      const nextPayDate = (entry as any).nextPayDate || computeNextDate(entry.payDate, frequency);

      if (nextPayDate > now) continue;

      const payroll = await storage.getPayroll((entry as any).companyId);
      const alreadyCreated = payroll.some(
        (p: any) => p.employeeId === entry.employeeId && p.payDate === nextPayDate && p.status === 'pending'
      );
      if (alreadyCreated) continue;

      await storage.createPayrollEntry({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        department: entry.department,
        salary: entry.salary,
        bonus: entry.bonus || '0',
        deductions: entry.deductions || '0',
        netPay: entry.netPay,
        status: 'pending',
        payDate: nextPayDate,
        bankName: entry.bankName,
        accountNumber: entry.accountNumber,
        accountName: entry.accountName,
        recurring: true,
        frequency,
        nextPayDate: computeNextDate(nextPayDate, frequency),
        companyId: (entry as any).companyId,
        email: (entry as any).email,
      } as any);

      await storage.updatePayrollEntry(entry.id, {
        nextPayDate: computeNextDate(nextPayDate, frequency),
      } as any);

      logger.info({ employeeName: entry.employeeName, nextPayDate }, "Created recurring payroll entry");
    } catch (error: any) {
      logger.error({ err: error, entryId: entry.id, employeeName: entry.employeeName }, "Error processing recurring payroll entry");
    }
  }
}

async function processScheduledPayments() {
  let duePayments;
  const now = new Date().toISOString().split('T')[0];

  try {
    duePayments = await storage.getDueScheduledPayments(now);
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch due scheduled payments");
    return;
  }

  for (const payment of duePayments) {
    try {
      const amount = parseFloat(String(payment.amount));
      if (amount <= 0) continue;

      if (payment.type === 'payout' || payment.type === 'transfer') {
        const meta = (payment.metadata || {}) as any;
        const recipientDetails = meta.recipientDetails || {};
        const accountNumber = recipientDetails.accountNumber || payment.recipientId;
        const bankCode = recipientDetails.bankCode;
        const accountName = recipientDetails.accountName || payment.recipientName || 'Recipient';

        if (!accountNumber) {
          logger.warn({ paymentId: payment.id }, "No account number for scheduled payment, skipping");
          continue;
        }

        const countryCode = meta.countryCode || 'US';
        const provider = getPaymentProvider(countryCode);
        const { currency } = getCurrencyForCountry(countryCode);
        let reference = '';

        // FIX P4: Debit balance BEFORE initiating external transfer to prevent fund leaks
        const balances = await storage.getBalances();
        let balanceField: string;
        if (currency === 'USD') {
          balanceField = 'usd';
        } else {
          balanceField = 'local';
        }
        const currentBalance = parseFloat(String((balances as any)[balanceField] || 0));
        if (currentBalance < amount) {
          throw new Error(`Insufficient balance for scheduled payment: need ${amount} ${currency}, have ${currentBalance}`);
        }
        await storage.updateBalances({ [balanceField]: String(currentBalance - amount) });

        if (provider === 'paystack') {
          if (!bankCode) {
            await storage.updateBalances({ [balanceField]: String(currentBalance) });
            logger.warn({ paymentId: payment.id }, "No bank code for Paystack payout, refunded balance and skipped");
            continue;
          }
          const recipientResponse = await paystackClient.createTransferRecipient(
            accountName,
            accountNumber,
            bankCode,
            currency
          );
          const recipientCode = recipientResponse.data?.recipient_code;
          if (!recipientCode) {
            await storage.updateBalances({ [balanceField]: String(currentBalance) });
            throw new Error('Failed to create transfer recipient');
          }

          try {
            const transferResponse = await paystackClient.initiateTransfer(
              amount,
              recipientCode,
              `Scheduled payment - ${payment.type}`
            );
            reference = transferResponse.data?.transfer_code || '';
            // LU-DD-2: index the scheduled-payment-driven Paystack transfer
            if (reference) {
              await storage.createPaymentIntentIndex({
                provider: 'paystack',
                providerIntentId: reference,
                kind: 'transfer',
                companyId: (payment as any).companyId ?? null,
                userId: null,
                metadataCompanyId: (payment as any).companyId ?? null,
                metadata: { scheduledPaymentId: payment.id, type: payment.type, source: 'scheduler' },
              } as any).catch((err: any) =>
                logger.warn({ err, reference }, 'payment_intent_index write failed for scheduled Paystack transfer'),
              );
            }
          } catch (transferErr: any) {
            await storage.updateBalances({ [balanceField]: String(currentBalance) });
            throw transferErr;
          }
        } else {
          try {
            const stripe = getStripeClient();
            const payout = await stripe.payouts.create({
              amount: Math.round(amount * 100),
              currency: currency.toLowerCase(),
              method: 'standard',
              description: `Scheduled payment - ${payment.type}`,
              metadata: {
                scheduledPaymentId: payment.id,
                type: payment.type,
                // LU-DD-2: include companyId in Stripe metadata as the
                // fallback path; the index row below is the authoritative
                // source.
                ...((payment as any).companyId ? { companyId: (payment as any).companyId } : {}),
              },
            });
            reference = payout.id;
            // LU-DD-2: index the scheduled-payment-driven Stripe payout
            await storage.createPaymentIntentIndex({
              provider: 'stripe',
              providerIntentId: payout.id,
              kind: 'payout',
              companyId: (payment as any).companyId ?? null,
              userId: null,
              metadataCompanyId: (payment as any).companyId ?? null,
              metadata: { scheduledPaymentId: payment.id, type: payment.type, source: 'scheduler' },
            } as any).catch((err: any) =>
              logger.warn({ err, payoutId: payout.id }, 'payment_intent_index write failed for scheduled Stripe payout'),
            );
          } catch (stripeErr: any) {
            await storage.updateBalances({ [balanceField]: String(currentBalance) });
            throw stripeErr;
          }
        }

        await storage.createTransaction({
          type: 'Payout',
          amount: String(amount),
          fee: '0',
          status: 'Processing',
          date: new Date().toISOString().split('T')[0],
          description: `Scheduled ${payment.type} - ${payment.recipientName || 'Recipient'}`,
          currency,
          userId: null,
          reference: reference || null,
        });

        logger.info({ paymentId: payment.id, reference }, "Processed scheduled payment");
      }

      const nextRunDate = computeNextDate(payment.nextRunDate, payment.frequency);
      await storage.updateScheduledPayment(payment.id, {
        lastRunDate: now,
        nextRunDate,
      });

    } catch (payErr: any) {
      logger.error({ err: payErr, paymentId: payment.id }, "Failed to process scheduled payment");
      try {
        await storage.updateScheduledPayment(payment.id, {
          status: 'failed',
          metadata: { ...((payment.metadata as any) || {}), lastError: payErr.message, failedAt: new Date().toISOString() },
        } as any);
      } catch (updateErr: any) {
        logger.error({ err: updateErr, paymentId: payment.id }, "Failed to mark payment as failed");
      }
    }
  }
}

export async function runRecurringScheduler() {
  const startedAt = Date.now();
  await withSchedulerLock(SCHEDULER_LOCK_NAME, async () => {
    logger.info({ at: new Date().toISOString() }, "Starting recurring scheduler tick");
    await processRecurringBills();
    await processRecurringPayroll();
    await processScheduledPayments();
    logger.info({ durationMs: Date.now() - startedAt }, "Scheduler tick complete");
  });
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startRecurringScheduler(intervalMs: number = 3600000) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  logger.info({ intervalMs }, "Starting recurring payment scheduler");
  runRecurringScheduler().catch((err) => logger.error({ err }, "Initial scheduler tick failed"));
  schedulerInterval = setInterval(() => {
    runRecurringScheduler().catch((err) => logger.error({ err }, "Scheduler tick failed"));
  }, intervalMs);
}

export function stopRecurringScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("Recurring payment scheduler stopped");
  }
}

export { computeNextDate };
