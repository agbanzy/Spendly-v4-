-- LU-DD-3 / AUD-DD-TEAM-001 — Consolidate team_members into company_members
--
-- The deep-dive audit found two parallel member tables: company_members
-- (used by requireAdmin and tenancy checks) and team_members (used by
-- the team-management UI for permissions and department display).
-- Drift between them is inevitable because some routes write only to
-- team_members and some write only to company_members. This migration
-- begins the consolidation by:
--
--   1. Adding the team_members-only columns to company_members so
--      everything required can live in one row.
--   2. Backfilling those columns from team_members (matched by
--      company_id + LOWER(email)).
--   3. Creating company_members rows for any team_members that don't
--      have a matching one yet.
--
-- After this migration, application code can write to BOTH tables
-- (parallel-write) so the data stays in sync during a soak window.
-- A future migration will switch reads to company_members exclusively
-- and then drop team_members.
--
-- See docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md §10 LU-DD-3.

-- ============================================================
-- Add the team_members-only columns to company_members
-- ============================================================

ALTER TABLE company_members
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS department_id text,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- FK to departments — best effort; SET NULL on cascade to avoid widow rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_members_department_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE company_members
        ADD CONSTRAINT company_members_department_id_fkey
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE '[migration 0013] department FK could not be added (departments table may not exist); continuing without it';
    END;
  END IF;
END
$$;

-- ============================================================
-- Backfill columns on existing company_members rows from
-- the matching team_members row (company_id + lowercase email)
-- ============================================================

UPDATE company_members cm
SET
  name          = COALESCE(cm.name,          tm.name),
  department    = COALESCE(cm.department,    tm.department),
  department_id = COALESCE(cm.department_id, tm.department_id),
  avatar        = COALESCE(cm.avatar,        tm.avatar),
  permissions   = COALESCE(cm.permissions,   tm.permissions, '[]'::jsonb)
FROM team_members tm
WHERE LOWER(cm.email) = LOWER(tm.email)
  AND cm.company_id = tm.company_id;

-- ============================================================
-- Insert company_members rows for team_members that don't
-- have a matching company_members yet.
-- ============================================================

INSERT INTO company_members (
  id, company_id, user_id, email, role, status,
  invited_at, joined_at,
  name, department, department_id, avatar, permissions
)
SELECT
  gen_random_uuid()::text,
  tm.company_id,
  tm.user_id,
  tm.email,
  tm.role,
  tm.status,
  COALESCE(tm.joined_at, now()::text)            AS invited_at,
  tm.joined_at,
  tm.name,
  tm.department,
  tm.department_id,
  tm.avatar,
  COALESCE(tm.permissions, '[]'::jsonb)          AS permissions
FROM team_members tm
WHERE tm.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE LOWER(cm.email) = LOWER(tm.email)
      AND cm.company_id = tm.company_id
  );

-- ============================================================
-- Sanity report
-- ============================================================

DO $$
DECLARE
  cm_count integer;
  tm_count integer;
  unmatched_tm integer;
BEGIN
  SELECT count(*) INTO cm_count FROM company_members;
  SELECT count(*) INTO tm_count FROM team_members;
  SELECT count(*) INTO unmatched_tm
    FROM team_members tm
    WHERE tm.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_members cm
        WHERE LOWER(cm.email) = LOWER(tm.email)
          AND cm.company_id = tm.company_id
      );
  RAISE NOTICE '[migration 0013] After consolidation: company_members=% team_members=% unmatched_team_members=%',
    cm_count, tm_count, unmatched_tm;
END
$$;

-- ============================================================
-- Indexes for the new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS company_members_department_id_idx
  ON company_members (department_id) WHERE department_id IS NOT NULL;
