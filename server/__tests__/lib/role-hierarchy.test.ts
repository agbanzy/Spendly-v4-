import { describe, it, expect } from "vitest";
import { ROLE_RANK, rankOf, checkRoleHierarchy } from "../../lib/role-hierarchy";

// S-F-01 (AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17) — contract tests for
// the role-hierarchy guard added to POST/PATCH/DELETE /team. The guard
// closes the primary attack chain (AD-F-01): an ADMIN inviting a new
// OWNER as a self-promotion step.
//
// The helpers live in server/lib/role-hierarchy.ts so this test file
// can import them without pulling in storage / db (which the route
// module does). Full route-level behaviour is tracked under
// AUD-PR-009 follow-up (integration suite, npm run test:integration).

describe("ROLE_RANK ordering", () => {
  it("orders OWNER highest, VIEWER lowest", () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MANAGER);
    expect(ROLE_RANK.MANAGER).toBeGreaterThan(ROLE_RANK.EDITOR);
    expect(ROLE_RANK.EDITOR).toBeGreaterThan(ROLE_RANK.EMPLOYEE);
    expect(ROLE_RANK.EMPLOYEE).toBeGreaterThan(ROLE_RANK.VIEWER);
    expect(ROLE_RANK.VIEWER).toBeGreaterThan(0);
  });

  it("matches the schema's UserRole enum coverage", () => {
    expect(Object.keys(ROLE_RANK).sort()).toEqual(
      ["ADMIN", "EDITOR", "EMPLOYEE", "MANAGER", "OWNER", "VIEWER"],
    );
  });
});

describe("rankOf — case + null safety", () => {
  it("returns the rank for a known role", () => {
    expect(rankOf("OWNER")).toBe(ROLE_RANK.OWNER);
    expect(rankOf("admin")).toBe(ROLE_RANK.ADMIN);
    expect(rankOf("MaNaGeR")).toBe(ROLE_RANK.MANAGER);
  });

  it("defaults to EMPLOYEE rank for empty / null / undefined input", () => {
    expect(rankOf("")).toBe(ROLE_RANK.EMPLOYEE);
    expect(rankOf(null)).toBe(ROLE_RANK.EMPLOYEE);
    expect(rankOf(undefined)).toBe(ROLE_RANK.EMPLOYEE);
  });

  it("returns 0 for an unknown role string (defence-in-depth)", () => {
    expect(rankOf("SUPER_DUPER_ADMIN")).toBe(0);
    expect(rankOf("god")).toBe(0);
  });
});

describe("checkRoleHierarchy — the actual guard", () => {
  it("returns null (allowed) when no target role is supplied (no-op PATCH)", () => {
    expect(checkRoleHierarchy("ADMIN", undefined)).toBeNull();
    expect(checkRoleHierarchy("ADMIN", null)).toBeNull();
    expect(checkRoleHierarchy("ADMIN", "")).toBeNull();
  });

  it("returns null when caller is the SAME rank as target", () => {
    expect(checkRoleHierarchy("ADMIN", "ADMIN")).toBeNull();
    expect(checkRoleHierarchy("OWNER", "OWNER")).toBeNull();
  });

  it("returns null when caller is HIGHER than target", () => {
    expect(checkRoleHierarchy("OWNER", "ADMIN")).toBeNull();
    expect(checkRoleHierarchy("OWNER", "VIEWER")).toBeNull();
    expect(checkRoleHierarchy("ADMIN", "EMPLOYEE")).toBeNull();
    expect(checkRoleHierarchy("MANAGER", "EDITOR")).toBeNull();
  });

  it("BLOCKS the AD-F-01 attack chain: ADMIN cannot grant OWNER", () => {
    const result = checkRoleHierarchy("ADMIN", "OWNER");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    expect(result?.body.code).toBe("ROLE_HIERARCHY_VIOLATION");
    expect(result?.body.callerRole).toBe("ADMIN");
    expect(result?.body.targetRole).toBe("OWNER");
  });

  it("BLOCKS upgrade attempts down the hierarchy too", () => {
    expect(checkRoleHierarchy("MANAGER", "ADMIN")?.status).toBe(403);
    expect(checkRoleHierarchy("EDITOR", "MANAGER")?.status).toBe(403);
    expect(checkRoleHierarchy("EMPLOYEE", "EDITOR")?.status).toBe(403);
    expect(checkRoleHierarchy("VIEWER", "EMPLOYEE")?.status).toBe(403);
  });

  it("returns 403 with NO_ROLE code when caller has unknown / no role", () => {
    const result = checkRoleHierarchy("MYSTERY_ROLE", "VIEWER");
    expect(result?.status).toBe(403);
    expect(result?.body.code).toBe("NO_ROLE");
  });

  it("case-insensitively matches roles (lowercase input safe)", () => {
    expect(checkRoleHierarchy("admin", "owner")?.status).toBe(403);
    expect(checkRoleHierarchy("owner", "admin")).toBeNull();
  });
});

// Mirror of the demote-outranking-member check from PATCH /team/:id.
// Same helper, called with (callerRole, originalMember.role).
describe("checkRoleHierarchy — reverse check (cannot modify a higher-rank member)", () => {
  it("ADMIN cannot demote OWNER (caller-vs-current-role check)", () => {
    // The route does: checkRoleHierarchy(callerRole, originalMember.role)
    // i.e. treats the current role as the "target" of the policy guard.
    // If current role > caller, the guard fires.
    const result = checkRoleHierarchy("ADMIN", "OWNER");
    expect(result?.status).toBe(403);
  });

  it("OWNER can modify ANY other member", () => {
    expect(checkRoleHierarchy("OWNER", "ADMIN")).toBeNull();
    expect(checkRoleHierarchy("OWNER", "OWNER")).toBeNull();
    expect(checkRoleHierarchy("OWNER", "EMPLOYEE")).toBeNull();
  });

  it("ADMIN can modify any non-OWNER member", () => {
    expect(checkRoleHierarchy("ADMIN", "ADMIN")).toBeNull();
    expect(checkRoleHierarchy("ADMIN", "MANAGER")).toBeNull();
    expect(checkRoleHierarchy("ADMIN", "VIEWER")).toBeNull();
  });
});
