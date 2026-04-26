-- LU-DD-4 / AUD-DD-TEAM-002 — DB-backed role permissions
--
-- The deep-dive audit found that role → permission mappings were
-- hard-coded inside `server/routes/team.routes.ts` and
-- `server/routes/companies.routes.ts`, with EDITOR and VIEWER both
-- defaulting to ['CREATE_EXPENSE'] (clearly wrong for VIEWER) and the
-- `role_permissions` table sitting unused. This migration seeds the
-- canonical mappings into the database so the new `requirePermission`
-- middleware can read them at runtime.
--
-- See docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md §10 LU-DD-4.

-- Add a UNIQUE constraint on `role` so seeding can use ON CONFLICT.
-- Idempotent: ALTER TABLE ... ADD CONSTRAINT errors if it already exists,
-- so guard with a DO block that catches the duplicate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_role_unique'
  ) THEN
    -- First, dedupe any existing rows that share a role (keep the most
    -- recently updated). Rare, but defensive: the table has been live
    -- without a unique constraint.
    DELETE FROM role_permissions r1
    USING role_permissions r2
    WHERE r1.role = r2.role
      AND r1.updated_at < r2.updated_at;

    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_role_unique UNIQUE (role);
  END IF;
END
$$;

-- Seed the 6 system roles. ON CONFLICT (role) DO NOTHING preserves any
-- per-tenant customisation an operator made before this migration ran.
-- Treat these inserts as the floor: an org can override by updating
-- via the existing PUT /admin/roles/:role endpoint.

INSERT INTO role_permissions (role, permissions, description, is_system)
VALUES
  ('OWNER', '["VIEW_TREASURY","MANAGE_TREASURY","CREATE_EXPENSE","APPROVE_EXPENSE","SETTLE_PAYMENT","MANAGE_CARDS","MANAGE_TEAM","VIEW_REPORTS","MANAGE_SETTINGS"]'::jsonb,
   'Owner — full access including settings and team management', true),
  ('ADMIN', '["VIEW_TREASURY","MANAGE_TREASURY","CREATE_EXPENSE","APPROVE_EXPENSE","SETTLE_PAYMENT","MANAGE_CARDS","MANAGE_TEAM","VIEW_REPORTS","MANAGE_SETTINGS"]'::jsonb,
   'Admin — same as owner; cannot delete the company itself', true),
  ('MANAGER', '["VIEW_TREASURY","CREATE_EXPENSE","APPROVE_EXPENSE","MANAGE_CARDS","VIEW_REPORTS"]'::jsonb,
   'Manager — can approve expenses, manage cards, and view reports', true),
  ('EDITOR', '["VIEW_TREASURY","CREATE_EXPENSE","VIEW_REPORTS"]'::jsonb,
   'Editor — can submit expenses and view reports; cannot approve', true),
  ('EMPLOYEE', '["CREATE_EXPENSE"]'::jsonb,
   'Employee — can submit expenses for approval', true),
  ('VIEWER', '["VIEW_TREASURY","VIEW_REPORTS"]'::jsonb,
   'Viewer — read-only access to treasury and reports')
ON CONFLICT (role) DO NOTHING;
