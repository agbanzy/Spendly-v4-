import { describe, it, expect } from "vitest";
import { computeNextDate } from "../../utils/recurring-dates";

// AUD-DD-BILL-007 / AUD-DD-BILL-008 — regression tests for the
// month-end and leap-year edge cases that the original raw-Date
// implementation got wrong.

describe("computeNextDate", () => {
  describe("monthly", () => {
    it("handles the Jan 31 → Feb edge correctly (28-day month)", () => {
      // Old behaviour: Jan 31 + 1 month → Mar 3 (overflow)
      // New behaviour: clamps to Feb 28 / 29.
      expect(computeNextDate("2026-01-31", "monthly")).toBe("2026-02-28");
    });

    it("clamps to Feb 29 in a leap year", () => {
      expect(computeNextDate("2024-01-31", "monthly")).toBe("2024-02-29");
    });

    it("handles the Mar 31 → Apr edge (30-day month)", () => {
      expect(computeNextDate("2026-03-31", "monthly")).toBe("2026-04-30");
    });

    it("preserves day-of-month for normal cases", () => {
      expect(computeNextDate("2026-04-15", "monthly")).toBe("2026-05-15");
    });

    it("handles December → January year rollover", () => {
      expect(computeNextDate("2026-12-15", "monthly")).toBe("2027-01-15");
    });
  });

  describe("yearly", () => {
    it("Feb 29 (leap) + 1 year clamps to Feb 28 (non-leap)", () => {
      // Old behaviour: Feb 29 2024 + 1 year → Mar 1 2025 (overflow)
      // New behaviour: Feb 28 2025.
      expect(computeNextDate("2024-02-29", "yearly")).toBe("2025-02-28");
    });

    it("preserves date for normal cases", () => {
      expect(computeNextDate("2026-04-26", "yearly")).toBe("2027-04-26");
    });
  });

  describe("weekly", () => {
    it("adds 7 days", () => {
      expect(computeNextDate("2026-04-26", "weekly")).toBe("2026-05-03");
    });

    it("handles month boundary", () => {
      expect(computeNextDate("2026-04-29", "weekly")).toBe("2026-05-06");
    });
  });

  describe("quarterly", () => {
    it("adds 3 months for normal cases", () => {
      expect(computeNextDate("2026-01-15", "quarterly")).toBe("2026-04-15");
    });

    it("clamps when target month has fewer days", () => {
      // Nov 30 + 3 months → Feb 28 / 29 (depending on year)
      expect(computeNextDate("2026-11-30", "quarterly")).toBe("2027-02-28");
    });

    it("rolls year boundary correctly", () => {
      expect(computeNextDate("2026-12-15", "quarterly")).toBe("2027-03-15");
    });
  });

  describe("default (unknown frequency)", () => {
    it("treats unknown frequency as monthly", () => {
      expect(computeNextDate("2026-01-31", "biennial-as-typo")).toBe("2026-02-28");
    });
  });

  describe("input format handling", () => {
    it("accepts a YYYY-MM-DD date string", () => {
      expect(computeNextDate("2026-04-15", "monthly")).toBe("2026-05-15");
    });

    it("accepts an ISO timestamp and ignores the time component", () => {
      expect(computeNextDate("2026-04-15T18:30:00.000Z", "monthly")).toBe("2026-05-15");
    });
  });
});
