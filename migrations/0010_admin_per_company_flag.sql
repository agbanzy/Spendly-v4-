-- LU-DD-1 / AUD-DD-MT-004 — Admin role check at company-membership level
--
-- Adds the `admin_per_company` feature flag (default 'false') so the new
-- middleware behaviour can be staged tenant-by-tenant. The legacy path
-- continues to consult `users.role` (a global, user-level field) until the
-- flag flips on; afterwards `requireAdmin` consults `companyMembers.role`
-- for the user's active company.
--
-- See docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md §10 (LU-DD-1) for
-- the full design rationale.

-- ============================================================
-- Feature flag (default OFF)
-- ============================================================

INSERT INTO system_settings (key, value, value_type, category, description, is_public)
SELECT 'admin_per_company',
       'false',
       'boolean',
       'security',
       'When true, requireAdmin middleware verifies the user is OWNER/ADMIN in their active company (companyMembers.role) instead of consulting the global users.role. Flip this on per environment after running the backfill below and verifying.',
       false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'admin_per_company');

-- ============================================================
-- Backfill: ensure that any user who is OWNER or ADMIN globally
-- (legacy users.role) is at least the same role in every company
-- they belong to. Without this, flipping the flag would lock
-- some legitimate admins out.
--
-- Only PROMOTES (never demotes). Match is by email (the legacy
-- users table stores email; companyMembers.email is canonical
-- per-company contact).
-- ============================================================

UPDATE company_members cm
SET role = u.role
FROM users u
WHERE LOWER(cm.email) = LOWER(u.email)
  AND u.role IN ('OWNER', 'ADMIN')
  AND cm.role NOT IN ('OWNER', 'ADMIN')
  AND cm.status = 'active';

-- Sanity report (visible in migration output):
DO $$
DECLARE
  promoted_count integer;
BEGIN
  SELECT COUNT(*) INTO promoted_count
    FROM company_members cm
    JOIN users u ON LOWER(cm.email) = LOWER(u.email)
    WHERE u.role IN ('OWNER', 'ADMIN') AND cm.role IN ('OWNER', 'ADMIN');
  RAISE NOTICE '[migration 0010] admin_per_company: % company_members rows aligned with users.role at OWNER/ADMIN level', promoted_count;
END
$$;
