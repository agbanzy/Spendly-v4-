import { describe, it, expect, vi, beforeEach } from "vitest";

// S-F-03 (AUDIT_COUNTRY_PERSONA_ROLE_2026_05_17) — `defaultValue` option
// on isFeatureFlagOn. Caller-supplied default is returned when the row
// is missing OR on any lookup error. Used for security flags like
// `admin_per_company` where the safe default is enabled (tenant-scoped
// admin path), not disabled (legacy global-role path).

vi.mock("../../storage", () => ({
  storage: { getSystemSettings: vi.fn() },
}));

vi.mock("../../lib/logger", () => ({
  logger: { child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) },
}));

import { storage } from "../../storage";
import { isFeatureFlagOn, invalidateFeatureFlagCache } from "../../lib/feature-flags";

const mockGetSettings = storage.getSystemSettings as ReturnType<typeof vi.fn>;

describe("isFeatureFlagOn — missing row honours defaultValue", () => {
  beforeEach(() => {
    invalidateFeatureFlagCache();
    mockGetSettings.mockReset();
  });

  it("returns false when row is missing and no defaultValue is supplied (back-compat)", async () => {
    mockGetSettings.mockResolvedValue([]);
    const result = await isFeatureFlagOn("some_flag");
    expect(result).toBe(false);
  });

  it("returns true when row is missing AND defaultValue is true (S-F-03 path)", async () => {
    mockGetSettings.mockResolvedValue([]);
    const result = await isFeatureFlagOn("admin_per_company", { defaultValue: true });
    expect(result).toBe(true);
  });

  it("returns true when row exists with value='true'", async () => {
    mockGetSettings.mockResolvedValue([{ key: "admin_per_company", value: "true" }]);
    const result = await isFeatureFlagOn("admin_per_company", { defaultValue: true });
    expect(result).toBe(true);
  });

  it("returns false when row exists with value='false' (explicit operator override)", async () => {
    mockGetSettings.mockResolvedValue([{ key: "admin_per_company", value: "false" }]);
    const result = await isFeatureFlagOn("admin_per_company", { defaultValue: true });
    expect(result).toBe(false);
  });

  it("returns defaultValue on lookup error", async () => {
    mockGetSettings.mockRejectedValue(new Error("DB down"));
    const result = await isFeatureFlagOn("admin_per_company", {
      defaultValue: true,
      bypassCache: true,
    });
    expect(result).toBe(true);
  });

  it("returns false (the function-level default) on error when no defaultValue supplied", async () => {
    mockGetSettings.mockRejectedValue(new Error("DB down"));
    const result = await isFeatureFlagOn("some_flag", { bypassCache: true });
    expect(result).toBe(false);
  });

  it("caches the resolved value for the TTL window (60s)", async () => {
    mockGetSettings.mockResolvedValue([]);
    const a = await isFeatureFlagOn("admin_per_company", { defaultValue: true });
    const b = await isFeatureFlagOn("admin_per_company", { defaultValue: true });
    expect(a).toBe(true);
    expect(b).toBe(true);
    // Only one DB lookup despite two calls.
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });
});
