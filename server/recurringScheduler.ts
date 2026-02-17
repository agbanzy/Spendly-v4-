import { storage } from "./storage";
import { paystackClient } from "./paystackClient";
import { getStripeClient } from "./stripeClient";
import { getPaymentProvider, getCurrencyForCountry } from "./paymentService";

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

async function processRecurringBills() {
  try {
    const bills = await storage.getBills();
    const now = new Date().toISOString().split('T')[0];

    for (const bill of bills) {
      if (!bill.recurring) continue;
      if (bill.status !== 'Paid') continue;

      const frequency = (bill as any).frequency || 'monthly';
      const nextDueDate = computeNextDate(bill.dueDate, frequency);

      if (nextDueDate > now) continue;

      const existingBills = await storage.getBills();
      const alreadyCreated = existingBills.some(
        (b: any) => b.name === bill.name && b.dueDate === nextDueDate && b.status !== 'Paid'
      );
      if (alreadyCreated) continue;

      await storage.createBill({
        name: bill.name,
        provider: bill.provider,
        amount: bill.amount,
        dueDate: nextDueDate,
        category: bill.category,
        status: 'Unpaid',
        currency: bill.currency,
        recurring: true,
        frequency,
        userId: bill.userId,
        companyId: bill.companyId,
      } as any);

      console.log(`[Scheduler] Created recurring bill: ${bill.name} due ${nextDueDate}`);
    }
  } catch (error: any) {
    console.error('[Scheduler] Error processing recurring bills:', error.message);
  }
}

async function processRecurringPayroll() {
  try {
    const recurringEntries = await storage.getRecurringPayrollEntries();
    const now = new Date().toISOString().split('T')[0];

    for (const entry of recurringEntries) {
      if (entry.status !== 'paid' && entry.status !== 'processing' && entry.status !== 'completed') continue;

      const frequency = (entry as any).frequency || 'monthly';
      const nextPayDate = (entry as any).nextPayDate || computeNextDate(entry.payDate, frequency);

      if (nextPayDate > now) continue;

      const payroll = await storage.getPayroll((entry as any).companyId);
      const alreadyCreated = payroll.some(
        (p: any) => p.employeeId === entry.employeeId && p.payDate === nextPayDate && p.status === 'pending'
      );
      if (alreadyCreated) continue;

      const newEntry = await storage.createPayrollEntry({
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

      console.log(`[Scheduler] Created recurring payroll entry for ${entry.employeeName} on ${nextPayDate}`);
    }
  } catch (error: any) {
    console.error('[Scheduler] Error processing recurring payroll:', error.message);
  }
}

async function processScheduledPayments() {
  try {
    const now = new Date().toISOString().split('T')[0];
    const duePayments = await storage.getDueScheduledPayments(now);

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
            console.log(`[Scheduler] No account number for scheduled payment ${payment.id}, skipping`);
            continue;
          }

          const countryCode = meta.countryCode || 'US';
          const provider = getPaymentProvider(countryCode);
          const { currency } = getCurrencyForCountry(countryCode);
          let reference = '';

          if (provider === 'paystack') {
            if (!bankCode) {
              console.log(`[Scheduler] No bank code for Paystack payout ${payment.id}, skipping`);
              continue;
            }
            const recipientResponse = await paystackClient.createTransferRecipient(
              accountName,
              accountNumber,
              bankCode,
              currency
            );
            const recipientCode = recipientResponse.data?.recipient_code;
            if (!recipientCode) throw new Error('Failed to create transfer recipient');

            const transferResponse = await paystackClient.initiateTransfer(
              amount,
              recipientCode,
              `Scheduled payment - ${payment.type}`
            );
            reference = transferResponse.data?.transfer_code || '';
          } else {
            const stripe = getStripeClient();
            const payout = await stripe.payouts.create({
              amount: Math.round(amount * 100),
              currency: currency.toLowerCase(),
              method: 'standard',
              description: `Scheduled payment - ${payment.type}`,
              metadata: { scheduledPaymentId: payment.id, type: payment.type },
            });
            reference = payout.id;
          }

          await storage.createTransaction({
            type: 'Payout',
            amount: String(amount),
            fee: '0',
            status: 'Processing',
            date: new Date().toISOString().split('T')[0],
            description: `Scheduled ${payment.type} - ${payment.recipientName || 'Recipient'}`,
            currency,
          });

          console.log(`[Scheduler] Processed scheduled payment ${payment.id}, ref: ${reference}`);
        }

        const nextRunDate = computeNextDate(payment.nextRunDate, payment.frequency);
        await storage.updateScheduledPayment(payment.id, {
          lastRunDate: now,
          nextRunDate,
        });

      } catch (payErr: any) {
        console.error(`[Scheduler] Failed to process scheduled payment ${payment.id}:`, payErr.message);
        await storage.updateScheduledPayment(payment.id, {
          status: 'failed',
          metadata: { ...((payment.metadata as any) || {}), lastError: payErr.message, failedAt: new Date().toISOString() },
        } as any);
      }
    }
  } catch (error: any) {
    console.error('[Scheduler] Error processing scheduled payments:', error.message);
  }
}

export async function runRecurringScheduler() {
  console.log(`[Scheduler] Running recurring payment check at ${new Date().toISOString()}`);
  await processRecurringBills();
  await processRecurringPayroll();
  await processScheduledPayments();
  console.log(`[Scheduler] Recurring payment check complete`);
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startRecurringScheduler(intervalMs: number = 3600000) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  console.log(`[Scheduler] Starting recurring payment scheduler (interval: ${intervalMs / 1000}s)`);
  runRecurringScheduler().catch(console.error);
  schedulerInterval = setInterval(() => {
    runRecurringScheduler().catch(console.error);
  }, intervalMs);
}

export function stopRecurringScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Recurring payment scheduler stopped');
  }
}

export { computeNextDate };
