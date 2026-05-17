// S-F-01 (AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17) — role hierarchy guard.
//
// Higher rank = more powerful. Used by team-management routes to refuse
// any role assignment HIGHER than the caller's own role.
//
// Before this guard, `requireAdmin` only checked that the caller was in
// {OWNER, ADMIN} — an ADMIN could then invite a new OWNER (or promote
// any member to OWNER) and the system accepted it. The attack chain:
// ADMIN creates a second account as OWNER → logs in as the new OWNER
// → demotes the original OWNER → takes over the tenant. See
// AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17.md §AD-F-01.
//
// Kept in server/lib/ (not server/routes/team.routes.ts) so the test
// suite can import it without pulling in storage / db dependencies.

export const ROLE_RANK: Record<string, number> = {
  OWNER: 6,
  ADMIN: 5,
  MANAGER: 4,
  EDITOR: 3,
  EMPLOYEE: 2,
  VIEWER: 1,
};

export function rankOf(role: string | undefined | null): number {
  return ROLE_RANK[(role || 'EMPLOYEE').toUpperCase()] ?? 0;
}

/**
 * Refuse if `targetRole > callerRole`. Returns null when allowed, or a
 * `{ status, body }` object the route should return directly.
 */
export function checkRoleHierarchy(
  callerRole: string | undefined | null,
  targetRole: string | undefined | null,
): { status: number; body: any } | null {
  if (!targetRole) return null; // no role change attempted
  const callerRank = rankOf(callerRole);
  const targetRank = rankOf(targetRole);
  if (callerRank === 0) {
    return {
      status: 403,
      body: { error: 'Caller has no recognised role', code: 'NO_ROLE' },
    };
  }
  if (targetRank > callerRank) {
    return {
      status: 403,
      body: {
        error: `Cannot assign role '${targetRole}' that is higher than your own role '${callerRole}'`,
        code: 'ROLE_HIERARCHY_VIOLATION',
        callerRole,
        targetRole,
      },
    };
  }
  return null;
}
