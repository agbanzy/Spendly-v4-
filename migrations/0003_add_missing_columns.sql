-- =====================================================
-- Financiar Database Migration: Add Missing Columns
-- Generated: 2026-03-09
-- Fixes: scheduler errors for missing approved_by (bills) and payout_destination_id (payroll_entries)
-- =====================================================

-- Bills: Add approval tracking columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_at text;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS reviewer_comments text;

-- Payroll entries: Add payout_destination_id
ALTER TABLE payroll_entries ADD COLUMN IF NOT EXISTS payout_destination_id text;
