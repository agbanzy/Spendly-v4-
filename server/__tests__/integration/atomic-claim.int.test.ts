import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { bootIntegrationDb, teardownIntegrationDb, resetIntegrationDb, IntegrationTestEnv } from "./setup";

// AUD-PR-006 + AUD-DD-PAY-002 — integration test for the atomic
// claim-pattern under real concurrent transactions. The unit-level
// contract tests in lib/payout-debit-first.test.ts and
// lib/payroll-claim-pattern.test.ts model the orchestrator with a
// stub storage; this test proves the SQL itself is race-safe.
//
// The pattern under test:
//   UPDATE <table>
//   SET status = 'processing', updated_at = NOW()
//   WHERE id = $1 AND status = 'pending'
//   RETURNING *
//
// Two concurrent callers both fire the UPDATE. Postgres serialises the
// writes; the second sees status='processing' and matches zero rows.
// We assert exactly one returned row across both calls.

describe("AUD-PR-006 / AUD-DD-PAY-002 — atomic claim race", () => {
  let env: IntegrationTestEnv;
  let pool: Pool;

  beforeAll(async () => {
    env = await bootIntegrationDb();
    pool = env.pool;
  }, 60_000);

  afterAll(async () => {
    if (env) await teardownIntegrationDb(env);
  });

  beforeEach(async () => {
    await resetIntegrationDb(pool);
  });

  it("two concurrent claims on the same row produce exactly one winner (payouts)", async () => {
    // Seed a pending payout. Use a minimal column set; other NOT NULL
    // columns either have defaults or are nullable in the live schema.
    const id = "payout-race-1";
    await pool.query(`
      INSERT INTO payouts (id, type, amount, currency, status, recipient_type, recipient_id, recipient_name, provider, company_id, created_at, updated_at)
      VALUES ($1, 'expense_reimbursement', '100.00', 'USD', 'pending', 'employee', 'user-1', 'Test User', 'stripe', 'tenant-A', NOW()::text, NOW()::text)
    `, [id]);

    // Fire two UPDATEs concurrently. Both target status='pending'.
    const claim = () => pool.query(
      `UPDATE payouts
       SET status = 'processing', updated_at = NOW()::text
       WHERE id = $1 AND status IN ('pending', 'approved')
       RETURNING id, status`,
      [id],
    );

    const [a, b] = await Promise.all([claim(), claim()]);

    // Exactly one of the two UPDATEs returned a row (the winner). The
    // loser's WHERE clause matched zero rows (status was already
    // 'processing' from the winner's commit).
    const totalRows = a.rowCount! + b.rowCount!;
    expect(totalRows).toBe(1);

    // The row that did exist is in 'processing' state.
    const finalState = await pool.query(`SELECT status FROM payouts WHERE id = $1`, [id]);
    expect(finalState.rows[0].status).toBe('processing');
  });

  it("two concurrent claims on the same row produce exactly one winner (payroll_entries)", async () => {
    const id = "payroll-race-1";
    await pool.query(`
      INSERT INTO payroll_entries (
        id, employee_id, employee_name, department, salary, bonus, deductions,
        net_pay, status, pay_date, company_id
      ) VALUES (
        $1, 'emp-1', 'Test Employee', 'Eng', '5000.00', '0', '0',
        '5000.00', 'pending', '2026-04-27', 'tenant-A'
      )
    `, [id]);

    // Mirror of claimPayrollEntryForProcessing in storage.ts — same
    // shape as the payout claim.
    const claim = () => pool.query(
      `UPDATE payroll_entries
       SET status = 'processing'
       WHERE id = $1 AND company_id = $2 AND status = 'pending'
       RETURNING id, status`,
      [id, 'tenant-A'],
    );

    const [a, b] = await Promise.all([claim(), claim()]);
    const totalRows = a.rowCount! + b.rowCount!;
    expect(totalRows).toBe(1);

    const finalState = await pool.query(`SELECT status FROM payroll_entries WHERE id = $1`, [id]);
    expect(finalState.rows[0].status).toBe('processing');
  });

  it("a third claim after the first winner sees status='processing' and matches zero rows", async () => {
    const id = "payout-third-claim";
    await pool.query(`
      INSERT INTO payouts (id, type, amount, currency, status, recipient_type, recipient_id, recipient_name, provider, company_id, created_at, updated_at)
      VALUES ($1, 'expense_reimbursement', '100.00', 'USD', 'pending', 'employee', 'user-1', 'Test User', 'stripe', 'tenant-A', NOW()::text, NOW()::text)
    `, [id]);

    // First claim: succeeds (status pending → processing).
    const first = await pool.query(
      `UPDATE payouts SET status='processing' WHERE id=$1 AND status IN ('pending','approved') RETURNING id`,
      [id],
    );
    expect(first.rowCount).toBe(1);

    // Second claim AFTER the first commit: status is now 'processing',
    // so the WHERE matches zero rows.
    const second = await pool.query(
      `UPDATE payouts SET status='processing' WHERE id=$1 AND status IN ('pending','approved') RETURNING id`,
      [id],
    );
    expect(second.rowCount).toBe(0);
  });

  it("cross-tenant claim cannot acquire a row in another company", async () => {
    const id = "payroll-cross-tenant";
    await pool.query(`
      INSERT INTO payroll_entries (
        id, employee_id, employee_name, department, salary, bonus, deductions,
        net_pay, status, pay_date, company_id
      ) VALUES (
        $1, 'emp-1', 'Test Employee', 'Eng', '5000.00', '0', '0',
        '5000.00', 'pending', '2026-04-27', 'tenant-A'
      )
    `, [id]);

    // tenant-B caller tries to claim tenant-A's row. Storage layer's
    // companyId AND-clause means zero rows match.
    const result = await pool.query(
      `UPDATE payroll_entries
       SET status = 'processing'
       WHERE id = $1 AND company_id = $2 AND status = 'pending'
       RETURNING id`,
      [id, 'tenant-B'],
    );
    expect(result.rowCount).toBe(0);

    // Row remained pending — wasn't touched by the cross-tenant attempt.
    const final = await pool.query(`SELECT status FROM payroll_entries WHERE id = $1`, [id]);
    expect(final.rows[0].status).toBe('pending');
  });
});
