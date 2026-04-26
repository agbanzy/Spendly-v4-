import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` is hoisted above non-mock imports, so the spy can't be
// declared at file scope (TDZ). We expose it via a separate module that
// the mock factory captures in its closure, then read it via dynamic
// import inside the tests.
vi.mock("../../utils/paymentUtils", async (importOriginal) => {
  const actual: any = await importOriginal();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { warnSpy } = await import("./payment-provider-routing.spies");
  return {
    ...actual,
    paymentLogger: {
      ...actual.paymentLogger,
      warn: warnSpy,
      info: vi.fn(),
      error: vi.fn(),
      trackOperation: actual.paymentLogger.trackOperation,
    },
  };
});

// Stub stripe/paystack so the import side-effects don't run.
vi.mock("../../stripeClient", () => ({
  getStripeClient: vi.fn(),
  getUncachableStripeClient: vi.fn(),
}));
vi.mock("../../paystackClient", () => ({
  paystackClient: {},
  validateTransferDetails: vi.fn(),
  validateStripeBankDetails: vi.fn(),
}));
vi.mock("../../storage", () => ({
  storage: {
    createPaymentIntentIndex: vi.fn(),
  },
}));

import { getPaymentProvider } from "../../paymentService";
import { warnSpy } from "./payment-provider-routing.spies";

describe("getPaymentProvider — AUD-DD-CTRY-003 logging wrapper", () => {
  beforeEach(() => {
    warnSpy.mockClear();
  });

  it("returns 'paystack' for a known Paystack country and does NOT warn", () => {
    expect(getPaymentProvider("NG")).toBe("paystack");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns 'stripe' for a known Stripe country and does NOT warn", () => {
    expect(getPaymentProvider("US")).toBe("stripe");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns 'stripe' for an unknown country AND emits a structured warn", () => {
    const result = getPaymentProvider("ZZ");
    expect(result).toBe("stripe");
    expect(warnSpy).toHaveBeenCalledOnce();
    const [event, payload] = warnSpy.mock.calls[0];
    expect(event).toBe("payment_provider_unknown_country_default");
    expect(payload).toMatchObject({
      countryCode: "ZZ",
      defaultedTo: "stripe",
    });
  });

  it("does NOT warn for an empty country code (avoid noisy log on missing input)", () => {
    getPaymentProvider("");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns once per call even on repeated unknown lookups", () => {
    getPaymentProvider("XX");
    getPaymentProvider("YY");
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
