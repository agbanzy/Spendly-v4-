import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage so we can control the index lookups deterministically.
vi.mock("../../storage", () => ({
  storage: {
    getPaymentIntentIndex: vi.fn(),
  },
}));

import { resolveCompanyForWebhook } from "../../lib/webhook-company-resolver";
import { storage } from "../../storage";

describe("resolveCompanyForWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress the resolver's WARN logs during tests.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses the index value when an index row is present and no metadata", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue({
      provider: "stripe",
      providerIntentId: "pi_test_1",
      companyId: "co-real",
      userId: "u-1",
      kind: "payment_intent",
    });

    const result = await resolveCompanyForWebhook("stripe", "pi_test_1");
    expect(result.companyId).toBe("co-real");
    expect(result.source).toBe("index");
    expect(result.mismatch).toBe(false);
  });

  it("uses the index value when index and metadata agree", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue({
      providerIntentId: "pi_test_2",
      companyId: "co-real",
      userId: "u-1",
      kind: "payment_intent",
    });

    const result = await resolveCompanyForWebhook("stripe", "pi_test_2", "co-real");
    expect(result.companyId).toBe("co-real");
    expect(result.source).toBe("index");
    expect(result.mismatch).toBe(false);
  });

  it("flags mismatch and uses index when metadata disagrees", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue({
      providerIntentId: "pi_attack",
      companyId: "co-victim",
      userId: "u-1",
      kind: "payment_intent",
    });

    const result = await resolveCompanyForWebhook("stripe", "pi_attack", "co-attacker");
    // Index value wins; metadata's claimed company is REJECTED.
    expect(result.companyId).toBe("co-victim");
    expect(result.source).toBe("index");
    expect(result.mismatch).toBe(true);
  });

  it("falls back to metadata when no index row exists (legacy payment)", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue(undefined);

    const result = await resolveCompanyForWebhook("stripe", "pi_legacy", "co-legacy");
    expect(result.companyId).toBe("co-legacy");
    expect(result.source).toBe("metadata-fallback");
    expect(result.mismatch).toBe(false);
  });

  it("returns null companyId with source=none when index miss + no metadata", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue(undefined);

    const result = await resolveCompanyForWebhook("paystack", "ref_abc");
    expect(result.companyId).toBeNull();
    expect(result.source).toBe("none");
    expect(result.mismatch).toBe(false);
  });

  it("treats storage errors as a soft miss and falls back to metadata", async () => {
    (storage.getPaymentIntentIndex as any).mockRejectedValue(new Error("DB down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await resolveCompanyForWebhook("stripe", "pi_db_down", "co-meta");
    expect(result.companyId).toBe("co-meta");
    expect(result.source).toBe("metadata-fallback");
    expect(result.mismatch).toBe(false);
  });

  it("returns null companyId when called without a providerIntentId", async () => {
    const result = await resolveCompanyForWebhook("stripe", "");
    expect(result.companyId).toBeNull();
    expect(result.source).toBe("none");
    // Storage should not even have been queried.
    expect((storage.getPaymentIntentIndex as any).mock.calls.length).toBe(0);
  });

  it("uses metadata fallback when called without a providerIntentId but metadata is present", async () => {
    const result = await resolveCompanyForWebhook("stripe", "", "co-meta-only");
    expect(result.companyId).toBe("co-meta-only");
    expect(result.source).toBe("metadata-fallback");
  });

  it("returns null companyId when index row exists but its companyId is null", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue({
      providerIntentId: "pi_null_co",
      companyId: null,
      userId: null,
      kind: "payment_intent",
    });

    // Even if metadata claims a companyId, the index says "the
    // server-issued mapping has no company" — we trust that.
    const result = await resolveCompanyForWebhook("stripe", "pi_null_co", "co-attacker");
    expect(result.companyId).toBeNull();
    expect(result.source).toBe("index");
    // mismatch flag requires BOTH sides be present; null index disables it.
    expect(result.mismatch).toBe(false);
  });

  it("supports paystack provider lookups", async () => {
    (storage.getPaymentIntentIndex as any).mockResolvedValue({
      provider: "paystack",
      providerIntentId: "TRF_xyz",
      companyId: "co-paystack",
      userId: "u-2",
      kind: "transfer",
    });

    const result = await resolveCompanyForWebhook("paystack", "TRF_xyz", "co-paystack");
    expect(result.companyId).toBe("co-paystack");
    expect(result.source).toBe("index");
    expect((storage.getPaymentIntentIndex as any).mock.calls[0][0]).toBe("paystack");
  });
});
