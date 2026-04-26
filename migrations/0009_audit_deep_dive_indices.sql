-- Audit deep-dive 2026-04-26 — supporting indices for newly-scoped queries.
-- Companion to docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md.

-- AUD-DD-MT-006: audit_logs.company_id was added to the schema previously
-- but never indexed. Now that admin/audit-logs is scoped by companyId, this
-- index makes the query plan O(log n) instead of a full scan.
CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx
  ON audit_logs (company_id);

-- AUD-DD-TXN-005: composite indices for common report and dashboard queries
-- against transactions. The single-column indices that already exist are
-- preserved; these add efficient scans for typical filter pairs.
CREATE INDEX IF NOT EXISTS transactions_company_date_active_idx
  ON transactions (company_id, date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS transactions_status_type_idx
  ON transactions (status, type);

-- AUD-DD-INV-001 follow-up: soft-delete filtering on invoices benefits from a
-- partial index analogous to the one on transactions.
CREATE INDEX IF NOT EXISTS invoices_company_due_active_idx
  ON invoices (company_id, due_date)
  WHERE deleted_at IS NULL;
