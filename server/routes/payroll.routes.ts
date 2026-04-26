import express from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { financialLimiter } from "../middleware/rateLimiter";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  payrollSchema,
  payrollUpdateSchema,
  validateAmount,
  getSettingsForRequest,
  logAudit,
  getAuditUserName,
} from "./shared";
import { getPaymentProvider } from "../paymentService";
import { getStripeClient } from "../stripeClient";
import { paystackClient } from "../paystackClient";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";
import { computeNextDate } from "../recurringScheduler";
import { db } from "../db";

const router = express.Router();

// ==================== PAYROLL ====================
router.get("/payroll", requireAuth, requireAdmin, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const payroll = await storage.getPayroll(company?.companyId);
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
});

router.get("/payroll/tax-estimate", requireAuth, async (req, res) => {
  try {
    const { country, annualSalary } = req.query;
    const salary = parseFloat(annualSalary as string) || 0;
    const countryCode = (country as string || 'US').toUpperCase();

    let tax = 0;
    const brackets: { rate: number; amount: number }[] = [];

    switch (countryCode) {
      case 'NG': {
        const tiers = [
          { limit: 300000, rate: 0.07 }, { limit: 300000, rate: 0.11 },
          { limit: 500000, rate: 0.15 }, { limit: 500000, rate: 0.19 },
          { limit: 1600000, rate: 0.21 }, { limit: Infinity, rate: 0.24 },
        ];
        let remaining = salary;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          const amt = taxable * tier.rate;
          tax += amt;
          brackets.push({ rate: tier.rate * 100, amount: amt });
          remaining -= taxable;
        }
        break;
      }
      case 'GH': {
        const tiers = [
          { limit: 4380, rate: 0 }, { limit: 1320, rate: 0.05 },
          { limit: 1560, rate: 0.10 }, { limit: 36000, rate: 0.175 },
          { limit: 196740, rate: 0.25 }, { limit: Infinity, rate: 0.30 },
        ];
        let remaining = salary;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          const amt = taxable * tier.rate;
          tax += amt;
          if (tier.rate > 0) brackets.push({ rate: tier.rate * 100, amount: amt });
          remaining -= taxable;
        }
        break;
      }
      case 'KE': {
        const monthlyGross = salary / 12;
        const tiers = [
          { limit: 24000, rate: 0.10 }, { limit: 8333, rate: 0.25 },
          { limit: 467667, rate: 0.30 }, { limit: 300000, rate: 0.325 },
          { limit: Infinity, rate: 0.35 },
        ];
        let remaining = monthlyGross;
        let monthlyTax = 0;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          monthlyTax += taxable * tier.rate;
          remaining -= taxable;
        }
        monthlyTax = Math.max(0, monthlyTax - 2400);
        tax = monthlyTax * 12;
        brackets.push({ rate: salary > 0 ? (tax / salary) * 100 : 0, amount: tax });
        break;
      }
      case 'ZA': {
        const tiers = [
          { limit: 237100, rate: 0.18 }, { limit: 133400, rate: 0.26 },
          { limit: 156600, rate: 0.31 }, { limit: 220200, rate: 0.36 },
          { limit: 356600, rate: 0.39 }, { limit: 499700, rate: 0.41 },
          { limit: Infinity, rate: 0.45 },
        ];
        let remaining = salary;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          const amt = taxable * tier.rate;
          tax += amt;
          brackets.push({ rate: tier.rate * 100, amount: amt });
          remaining -= taxable;
        }
        tax = Math.max(0, tax - 17235);
        break;
      }
      case 'US': {
        const tiers = [
          { limit: 11600, rate: 0.10 }, { limit: 35550, rate: 0.12 },
          { limit: 53375, rate: 0.22 }, { limit: 90750, rate: 0.24 },
          { limit: 40525, rate: 0.32 }, { limit: 161950, rate: 0.35 },
          { limit: Infinity, rate: 0.37 },
        ];
        let remaining = salary;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          const amt = taxable * tier.rate;
          tax += amt;
          brackets.push({ rate: tier.rate * 100, amount: amt });
          remaining -= taxable;
        }
        break;
      }
      case 'GB': {
        const tiers = [
          { limit: 12570, rate: 0 }, { limit: 37700, rate: 0.20 },
          { limit: 99730, rate: 0.40 }, { limit: Infinity, rate: 0.45 },
        ];
        let remaining = salary;
        for (const tier of tiers) {
          const taxable = Math.min(remaining, tier.limit);
          if (taxable <= 0) break;
          const amt = taxable * tier.rate;
          tax += amt;
          if (tier.rate > 0) brackets.push({ rate: tier.rate * 100, amount: amt });
          remaining -= taxable;
        }
        break;
      }
      default: {
        tax = salary * 0.20;
        brackets.push({ rate: 20, amount: tax });
      }
    }

    res.json({
      annualTax: Math.round(tax * 100) / 100,
      monthlyTax: Math.round((tax / 12) * 100) / 100,
      effectiveRate: salary > 0 ? Math.round((tax / salary) * 10000) / 100 : 0,
      brackets,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to estimate tax" });
  }
});

router.get("/payroll/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // AUD-PR-002 — fail-closed if no company context; storage-level
    // companyId AND-clause prevents cross-tenant id-guessing.
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const entry = await storage.getPayrollEntryInCompany(param(req.params.id), company.companyId);
    if (!entry) {
      return res.status(404).json({ error: "Payroll entry not found" });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payroll entry" });
  }
});

router.post("/payroll", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = payrollSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid payroll data", details: result.error.issues });
    }
    const { employeeId, employeeName, department, country, currency, salary, bonus, deductions, deductionBreakdown, payDate, recurring, frequency, email } = result.data;
    const company = await resolveUserCompany(req);
    // AUD-PR-007 — fail-closed when company resolution is missing so we
    // never write a payroll row with NULL companyId (which would be
    // visible to /payroll/process across tenants under the old code).
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const payoutDestinationId = req.body.payoutDestinationId || null;

    // Default country/currency from company settings when not provided
    let resolvedCountry = country || null;
    let resolvedCurrency = currency || null;
    if (!resolvedCountry || !resolvedCurrency) {
      const companyRecord = await storage.getCompany(company.companyId);
      if (companyRecord) {
        resolvedCountry = resolvedCountry || (companyRecord as any).country || 'US';
        resolvedCurrency = resolvedCurrency || (companyRecord as any).currency || 'USD';
      }
    }

    // Auto-populate bank details from payout destination if provided
    let bankName = req.body.bankName || null;
    let accountNumber = req.body.accountNumber || null;
    let accountName = req.body.accountName || null;
    if (payoutDestinationId) {
      const dest = await storage.getPayoutDestination(payoutDestinationId);
      if (dest) {
        bankName = bankName || dest.bankName;
        accountNumber = accountNumber || dest.accountNumber;
        accountName = accountName || dest.accountName;
      }
    }

    const salaryNum = parseFloat(salary);
    const bonusNum = parseFloat(bonus || '0');
    const deductionsNum = parseFloat(deductions || '0');
    const netPayNum = salaryNum + bonusNum - deductionsNum;
    // AUD-DD-FORM-021 — refuse negative netPay. The previous code
    // happily wrote a row where deductions exceeded salary+bonus,
    // producing impossible negative pay. The route now rejects with
    // 400 before persisting.
    if (!Number.isFinite(netPayNum) || netPayNum < 0) {
      return res.status(400).json({
        error: 'netPay would be negative — deductions cannot exceed salary + bonus',
        salary: salaryNum,
        bonus: bonusNum,
        deductions: deductionsNum,
        netPay: Number.isFinite(netPayNum) ? netPayNum : null,
      });
    }
    const actualPayDate = payDate || new Date().toISOString().split('T')[0];

    const entry = await storage.createPayrollEntry({
      employeeId: employeeId || String(Date.now()),
      employeeName,
      department: department || 'General',
      country: resolvedCountry,
      currency: resolvedCurrency,
      salary,
      bonus: bonus || '0',
      deductions: deductions || '0',
      deductionBreakdown: deductionBreakdown || null,
      netPay: String(netPayNum),
      status: 'pending',
      payDate: actualPayDate,
      recurring: recurring || false,
      frequency: recurring ? (frequency || 'monthly') : 'once',
      nextPayDate: recurring ? computeNextDate(actualPayDate, frequency || 'monthly') : null,
      companyId: company.companyId,
      email: email || null,
      bankName,
      accountNumber,
      accountName,
      payoutDestinationId,
    } as any);

    // AUD-PR-008 — audit-log emission on create.
    const actorId = (req as any).user?.uid || 'unknown';
    const actorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      entry.id,
      'created',
      actorId,
      actorName,
      undefined,
      { status: entry.status, salary: entry.salary, netPay: entry.netPay, employeeId: entry.employeeId },
      { companyId: entry.companyId, currency: entry.currency },
      (req as any).ip,
    );

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to create payroll entry" });
  }
});

router.patch("/payroll/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = payrollUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid payroll data", details: result.error.issues });
    }
    // AUD-PR-004 — companyId AND-clause at the storage layer; cross-tenant
    // ids return undefined (treat as not-found, do not leak existence).
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const entry = await storage.updatePayrollEntryInCompany(param(req.params.id), company.companyId, result.data);
    if (!entry) {
      return res.status(404).json({ error: "Payroll entry not found" });
    }
    // AUD-PR-008 — audit-log emission on update.
    const actorId = (req as any).user?.uid || 'unknown';
    const actorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      entry.id,
      'updated',
      actorId,
      actorName,
      undefined,
      result.data,
      { companyId: entry.companyId },
      (req as any).ip,
    );
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Failed to update payroll entry" });
  }
});

router.delete("/payroll/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // AUD-PR-005 — same companyId guard as PATCH.
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const deleted = await storage.deletePayrollEntryInCompany(param(req.params.id), company.companyId);
    if (!deleted) {
      return res.status(404).json({ error: "Payroll entry not found" });
    }
    // AUD-PR-008 — audit-log emission on delete.
    const actorId = (req as any).user?.uid || 'unknown';
    const actorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      param(req.params.id),
      'deleted',
      actorId,
      actorName,
      undefined,
      undefined,
      { companyId: company.companyId },
      (req as any).ip,
    );
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payroll entry" });
  }
});

router.post("/payroll/process", financialLimiter, requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    // AUD-PR-001 — fail-closed if no company context, then scope the
    // pending-entries query to the caller's tenant. The previous code
    // called storage.getPayroll() with NO companyId, which returns ALL
    // payroll rows from ALL companies — meaning a "Run payroll" click in
    // Tenant A could initiate real Stripe / Paystack transfers for
    // employees in Tenants B / C / etc.
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const entries = await storage.getPayroll(company.companyId);
    // Idempotency: only process entries that are strictly 'pending'
    // Skip any already in 'processing', 'completed', or 'paid' to prevent double-pay
    const pendingEntries = entries.filter(
      (e: any) => e.status === "pending" && e.status !== "processing" && e.status !== "completed" && e.status !== "paid"
    );

    if (pendingEntries.length === 0) {
      return res.status(400).json({ error: "No pending payroll entries to process" });
    }

    const settings = await storage.getOrganizationSettings();
    const companyName = (settings as any)?.companyName || settings?.name || 'Financiar';
    const currency = settings?.currency || 'USD';
    const payPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const results: Array<{ id: any; name: string; status: string; error?: string; reference?: string }> = [];
    let totalInitiated = 0;
    let totalFailed = 0;
    let totalNoBanking = 0;

    for (const entry of pendingEntries) {
      const salaryCheck = validateAmount(String(entry.netPay || 0));
      if (!salaryCheck.valid) {
        results.push({ id: entry.id, name: entry.employeeName, status: 'skipped', error: salaryCheck.error || 'Invalid net pay' });
        continue;
      }
      const netPayAmount = salaryCheck.parsed;

      // Get employee's payout destination — prefer linked payoutDestinationId
      let defaultDest: any = null;
      if ((entry as any).payoutDestinationId) {
        defaultDest = await storage.getPayoutDestination((entry as any).payoutDestinationId);
      }
      if (!defaultDest) {
        const destinations = await storage.getPayoutDestinations(entry.employeeId);
        defaultDest = destinations?.find((d: any) => d.isDefault) || destinations?.[0];
      }

      if (!defaultDest) {
        // No banking details — skip but don't mark as paid
        await storage.updatePayrollEntry(entry.id, { status: 'pending' } as any);
        results.push({ id: entry.id, name: entry.employeeName, status: 'needs_banking_details' });
        totalNoBanking++;
        continue;
      }

      // Initiate real transfer — use entry-level or destination-level currency
      const countryCode = (defaultDest as any).country || (entry as any).country || 'US';
      const provider = getPaymentProvider(countryCode);
      const entryCurrency = (entry as any).currency || (defaultDest as any).currency || currency;
      let reference = '';

      try {
        if (provider === 'paystack') {
          const recipientResponse = await paystackClient.createTransferRecipient(
            entry.employeeName,
            (defaultDest as any).accountNumber,
            (defaultDest as any).bankCode,
            entryCurrency
          );
          const recipientCode = recipientResponse.data?.recipient_code;
          if (!recipientCode) throw new Error('Failed to create transfer recipient');

          const transferResponse = await paystackClient.initiateTransfer(
            netPayAmount,
            recipientCode,
            `Salary - ${entry.employeeName} - ${payPeriod}`
          );
          reference = transferResponse.data?.transfer_code || transferResponse.data?.reference || '';
        } else {
          const stripe = getStripeClient();
          const bankToken = await stripe.tokens.create({
            bank_account: {
              country: countryCode,
              currency: currency.toLowerCase(),
              account_holder_name: entry.employeeName,
              account_holder_type: 'individual',
              routing_number: (defaultDest as any).routingNumber || (defaultDest as any).sortCode || '',
              account_number: (defaultDest as any).accountNumber,
            } as any,
          });

          const payout = await stripe.payouts.create({
            amount: Math.round(netPayAmount * 100),
            currency: currency.toLowerCase(),
            method: 'standard',
            description: `Salary - ${entry.employeeName}`,
            destination: bankToken.id,
            metadata: { payrollId: String(entry.id), type: 'payroll' },
          });
          reference = payout.id;
        }

        // Mark as processing (webhook will confirm completion)
        await storage.updatePayrollEntry(entry.id, { status: 'processing', payoutId: reference } as any);

        // Create transaction
        await storage.createTransaction({
          type: "payout",
          amount: String(netPayAmount),
          fee: "0",
          status: 'processing',
          date: new Date().toISOString().split('T')[0],
          description: `Salary payment - ${entry.employeeName}`,
          currency,
          reference,
          userId: (req as any).user?.uid || null,
        });

        // Send payslip email
        if (entry.email) {
          notificationService.sendPayslipEmail({
            email: entry.email,
            employeeName: entry.employeeName,
            payPeriod,
            grossSalary: parseFloat(String(entry.salary || (entry as any).grossSalary || 0)),
            deductions: parseFloat(String(entry.deductions || 0)),
            netPay: netPayAmount,
            currency,
            paymentDate: new Date().toLocaleDateString(),
            companyName,
          }).catch(err => console.error('Failed to send payslip:', err));
        }

        results.push({ id: entry.id, name: entry.employeeName, status: 'processing', reference });
        totalInitiated++;
      } catch (payErr: any) {
        console.error(`Payroll payout failed for ${entry.employeeName}:`, payErr.message);
        await storage.updatePayrollEntry(entry.id, { status: 'failed' } as any);
        results.push({ id: entry.id, name: entry.employeeName, status: 'failed', error: payErr.message });
        totalFailed++;
      }
    }

    const totalPaid = results
      .filter(r => r.status === 'processing')
      .reduce((sum, r) => {
        const entry = pendingEntries.find(e => e.id === r.id);
        return sum + parseFloat(String(entry?.netPay || 0));
      }, 0);

    // AUD-PR-008 — audit-log emission at run-payroll boundary. Records
    // the bulk action with the per-entry counts so investigators can
    // reconstruct what a "Run payroll" click did.
    const actorId = (req as any).user?.uid || 'unknown';
    const actorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      `bulk-${company.companyId}-${Date.now()}`,
      'bulk-process',
      actorId,
      actorName,
      undefined,
      { initiated: totalInitiated, failed: totalFailed, needsBankingDetails: totalNoBanking },
      { companyId: company.companyId, totalAmount: totalPaid, entryIds: pendingEntries.map(e => e.id) },
      (req as any).ip,
    );

    res.json({
      message: `Payroll processing complete: ${totalInitiated} initiated, ${totalFailed} failed, ${totalNoBanking} need banking details`,
      results,
      summary: {
        total: pendingEntries.length,
        initiated: totalInitiated,
        failed: totalFailed,
        needsBankingDetails: totalNoBanking,
        totalAmount: totalPaid,
      },
    });
  } catch (error: any) {
    console.error('Payroll process error:', error);
    res.status(500).json({ error: "Failed to process payroll" });
  }
});

// Pay individual employee — initiates REAL bank transfer via Stripe/Paystack
router.post("/payroll/:id/pay", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    // AUD-PR-002 — scoped fetch. Cross-tenant ids surface as 404 to avoid
    // leaking which payroll IDs exist in other companies.
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const entry = await storage.getPayrollEntryInCompany(param(req.params.id), company.companyId);
    if (!entry) {
      return res.status(404).json({ error: "Payroll entry not found" });
    }

    if (entry.status !== "pending") {
      return res.status(400).json({ error: "Payroll entry is not pending" });
    }

    const netPayAmount = parseFloat(String(entry.netPay || 0));
    if (netPayAmount <= 0) {
      return res.status(400).json({ error: "Invalid net pay amount" });
    }

    // AUD-PR-006 — atomic claim. Two concurrent /pay calls on the same id
    // can't both proceed: only the caller whose UPDATE sees status='pending'
    // wins. The second gets undefined and we return 409.
    const claimed = await storage.claimPayrollEntryForProcessing(entry.id, company.companyId);
    if (!claimed) {
      return res.status(409).json({ error: "Payroll entry was claimed by another process or is no longer pending" });
    }

    // AUD-PR-008 — audit-log emission at the claim boundary. We log the
    // pending → processing transition before the external transfer so
    // there's a record of the intent even if the process is killed before
    // the provider call completes.
    const actorId = (req as any).user?.uid || 'unknown';
    const actorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      entry.id,
      'pay-claimed',
      actorId,
      actorName,
      { status: 'pending' },
      { status: 'processing', netPay: entry.netPay },
      { companyId: company.companyId, employeeId: entry.employeeId },
      (req as any).ip,
    );

    const settings = await storage.getOrganizationSettings();
    const currency = settings?.currency || 'USD';
    const companyName = (settings as any)?.companyName || settings?.name || 'Financiar';

    // --- DETERMINE PAYOUT DESTINATION ---
    // Check if employee has payout destinations configured
    const destinations = await storage.getPayoutDestinations(entry.employeeId);
    const defaultDest = destinations?.find((d: any) => d.isDefault) || destinations?.[0];

    let providerResult: any = null;
    let payoutStatus = 'processing';

    if (defaultDest) {
      // Employee has banking details — initiate real transfer
      const countryCode = (defaultDest as any).countryCode || 'US';
      const provider = getPaymentProvider(countryCode);

      try {
        if (provider === 'paystack') {
          // Paystack transfer
          const recipientResponse = await paystackClient.createTransferRecipient(
            entry.employeeName,
            (defaultDest as any).accountNumber,
            (defaultDest as any).bankCode,
            currency
          );
          const recipientCode = recipientResponse.data?.recipient_code;
          if (!recipientCode) throw new Error('Failed to create transfer recipient');

          const transferResponse = await paystackClient.initiateTransfer(
            netPayAmount,
            recipientCode,
            `Salary payment - ${entry.employeeName} - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
          );

          providerResult = {
            provider: 'paystack',
            transferCode: transferResponse.data?.transfer_code,
            reference: transferResponse.data?.reference,
            status: transferResponse.data?.status || 'pending',
          };
        } else {
          // Stripe payout
          const stripe = getStripeClient();
          const bankToken = await stripe.tokens.create({
            bank_account: {
              country: countryCode,
              currency: currency.toLowerCase(),
              account_holder_name: entry.employeeName,
              account_holder_type: 'individual',
              routing_number: (defaultDest as any).routingNumber || (defaultDest as any).sortCode || '',
              account_number: (defaultDest as any).accountNumber,
            } as any,
          });

          const payout = await stripe.payouts.create({
            amount: Math.round(netPayAmount * 100),
            currency: currency.toLowerCase(),
            method: 'standard',
            description: `Salary - ${entry.employeeName}`,
            destination: bankToken.id,
            metadata: {
              payrollId: String(entry.id),
              employeeName: entry.employeeName,
              type: 'payroll',
            },
          });

          providerResult = {
            provider: 'stripe',
            payoutId: payout.id,
            status: payout.status,
          };
        }
        payoutStatus = 'processing';
      } catch (payErr: any) {
        console.error(`Payroll payout failed for ${entry.employeeName}:`, payErr.message);
        // Mark as failed but don't block the response
        payoutStatus = 'failed';
        providerResult = { error: payErr.message };
      }
    } else {
      // No banking details — mark as needs_setup
      payoutStatus = 'needs_banking_details';
    }

    // Update payroll entry status
    const finalStatus = payoutStatus === 'failed' ? 'failed' :
      payoutStatus === 'needs_banking_details' ? 'pending' : 'processing';
    const updated = await storage.updatePayrollEntry(param(req.params.id), {
      status: finalStatus,
      ...(providerResult ? { payoutId: providerResult.transferCode || providerResult.payoutId } : {}),
    } as any);

    // Create transaction record with appropriate status
    await storage.createTransaction({
      type: "payout",
      amount: String(netPayAmount),
      fee: "0",
      status: payoutStatus === 'processing' ? 'Processing' : (payoutStatus === 'failed' ? 'Failed' : 'Pending'),
      date: new Date().toISOString().split('T')[0],
      description: `Salary payment - ${entry.employeeName}`,
      currency,
      reference: providerResult?.transferCode || providerResult?.payoutId || `PAY-${entry.id}-${Date.now()}`,
      userId: (req as any).user?.uid || null,
    });

    // Only send payslip email when payout was actually initiated
    if (payoutStatus === 'processing' && entry.email) {
      const payPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      notificationService.sendPayslipEmail({
        email: entry.email,
        employeeName: entry.employeeName,
        payPeriod,
        grossSalary: parseFloat(String(entry.salary || (entry as any).grossSalary || 0)),
        deductions: parseFloat(String(entry.deductions || 0)),
        netPay: netPayAmount,
        currency,
        paymentDate: new Date().toLocaleDateString(),
        companyName,
      }).catch(err => console.error('Failed to send payslip:', err));
    }

    if (payoutStatus === 'needs_banking_details') {
      return res.status(400).json({
        error: "Employee has no banking details configured",
        message: `Please add payout destination for ${entry.employeeName} before processing payment`,
        entry: updated,
      });
    }

    if (payoutStatus === 'failed') {
      return res.status(502).json({
        error: "Payment provider transfer failed",
        detail: providerResult?.error,
        entry: updated,
      });
    }

    res.json({
      message: "Payment initiated successfully",
      status: 'processing',
      provider: providerResult?.provider,
      reference: providerResult?.transferCode || providerResult?.payoutId,
      entry: updated,
    });
  } catch (error: any) {
    console.error('Payroll pay error:', error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// ==================== PAYROLL BATCH PAYOUT ====================

const batchPayoutSchema = z.object({
  payrollIds: z.array(z.string().min(1)).min(1).max(50),
  initiatedBy: z.string().optional(),
});

router.post("/payroll/batch-payout", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const parsed = batchPayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid batch payout data", details: parsed.error.issues });
    }
    const { payrollIds } = parsed.data;
    // Never trust client-supplied initiator identity
    const initiatedBy = (req as any).user?.uid || 'unknown';

    // AUD-PR-003 — fail-closed if no company context, then resolve the
    // requested ids through a scoped lookup. Any client-supplied id that
    // belongs to a different tenant is silently dropped (returned in
    // results[] as a 'skipped' entry rather than echoed as 'created').
    const company = await resolveUserCompany(req);
    if (!company?.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const ownedEntries = await storage.getPayrollEntriesByIdsInCompany(payrollIds, company.companyId);
    const ownedById = new Map<string, typeof ownedEntries[number]>();
    for (const e of ownedEntries) ownedById.set(e.id, e);

    const results: any[] = [];

    for (const payrollId of payrollIds) {
      try {
        const entry = ownedById.get(payrollId);
        if (!entry) {
          // Either the id doesn't exist or it belongs to another tenant —
          // either way, refuse without leaking which.
          results.push({ payrollId, status: 'skipped', reason: 'not-found-or-cross-tenant' });
          continue;
        }
        if (entry.status === 'paid') continue;

        // AUD-PR-011 — refuse to create a payout when netPay is missing
        // or non-positive instead of silently falling back to gross
        // salary (which would skip tax / deduction policy). Skip with a
        // clear reason; admin must fix the entry first.
        const netPay = entry.netPay;
        if (!netPay || parseFloat(String(netPay)) <= 0) {
          results.push({
            payrollId,
            status: 'skipped',
            reason: 'invalid-netpay',
            netPay: netPay ?? null,
          });
          continue;
        }

        // Get employee's payout destination
        const destinations = await storage.getPayoutDestinations(entry.employeeId);
        const defaultDestination = destinations.find(d => d.isDefault) || destinations[0];

        const settings = await getSettingsForRequest(req);
        const currency = settings.currency || 'USD';

        // Wrap payout creation + payroll update in a DB transaction
        // to prevent orphaned payouts without payroll linkage
        const payout = await db.transaction(async () => {
          const payout = await storage.createPayout({
            type: 'payroll',
            amount: netPay,
            currency,
            status: 'pending',
            recipientType: 'employee',
            recipientId: entry.employeeId,
            recipientName: entry.employeeName,
            destinationId: defaultDestination?.id,
            provider: defaultDestination?.provider || 'stripe',
            relatedEntityType: 'payroll',
            relatedEntityId: entry.id,
            initiatedBy,
          });

          await storage.updatePayrollEntry(entry.id, {
            status: 'processing',
            payoutId: payout.id,
          } as any);

          return payout;
        });

        results.push({ payrollId, payoutId: payout.id, status: 'created' });
      } catch (err: any) {
        results.push({ payrollId, error: err.message });
      }
    }

    // AUD-PR-008 — audit-log emission for batch-payout. Captures the
    // result-by-id matrix so investigators can see exactly which IDs
    // generated payouts and which were skipped.
    const batchActorName = await getAuditUserName(req);
    await logAudit(
      'payroll',
      `batch-${company.companyId}-${Date.now()}`,
      'batch-payout',
      initiatedBy,
      batchActorName,
      undefined,
      { results },
      { companyId: company.companyId, requestedIds: payrollIds, ownedCount: ownedEntries.length },
      (req as any).ip,
    );

    res.json({ results });
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'payout');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
