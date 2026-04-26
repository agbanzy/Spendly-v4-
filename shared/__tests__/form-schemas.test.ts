import { describe, it, expect } from "vitest";
import {
  expenseFormSchema,
  invoiceFormSchema,
  fieldErrorsFromZod,
} from "../form-schemas";

describe("expenseFormSchema", () => {
  const valid = {
    merchant: "Stripe",
    amount: "120.50",
    category: "Software",
    note: null,
  };

  it("accepts a valid expense", () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty merchant", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, { ...valid, merchant: "" });
    expect(errors.merchant).toBe("Merchant is required.");
  });

  it("rejects empty category", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, { ...valid, category: "" });
    expect(errors.category).toBe("Category is required.");
  });

  it("rejects zero amount", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, { ...valid, amount: "0" });
    expect(errors.amount).toBe("Amount must be a positive number.");
  });

  it("rejects negative amount", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, { ...valid, amount: "-5" });
    expect(errors.amount).toBe("Amount must be a positive number.");
  });

  it("rejects non-numeric amount", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, { ...valid, amount: "abc" });
    expect(errors.amount).toBe("Amount must be a positive number.");
  });

  it("accepts numeric amount as number type", () => {
    expect(expenseFormSchema.safeParse({ ...valid, amount: 50 }).success).toBe(true);
  });
});

describe("invoiceFormSchema", () => {
  const valid = {
    client: "Acme Corp",
    clientEmail: "billing@acme.com",
    amount: 1000,
    subtotal: 1000,
    taxRate: 0,
    taxAmount: 0,
    currency: "USD",
    items: [
      { description: "Service A", quantity: 1, price: 1000 },
    ],
  };

  it("accepts a fully-valid invoice", () => {
    expect(invoiceFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty client name", () => {
    const errors = fieldErrorsFromZod(invoiceFormSchema, { ...valid, client: "" });
    expect(errors.client).toBe("Client name is required.");
  });

  it("rejects malformed client email", () => {
    const errors = fieldErrorsFromZod(invoiceFormSchema, { ...valid, clientEmail: "not-an-email" });
    expect(errors.clientEmail).toBe("Invalid email address.");
  });

  it("accepts an empty client email (optional)", () => {
    expect(invoiceFormSchema.safeParse({ ...valid, clientEmail: "" }).success).toBe(true);
  });

  it("rejects line-items that don't sum to declared subtotal (AUD-DD-FORM-019)", () => {
    const errors = fieldErrorsFromZod(invoiceFormSchema, {
      ...valid,
      subtotal: 1000,
      items: [
        { description: "Service A", quantity: 1, price: 500 },
        { description: "Service B", quantity: 2, price: 100 }, // sums to 700, declared 1000
      ],
    });
    expect(errors.items).toContain("Line-item totals do not match");
  });

  it("accepts line-items that sum to declared subtotal within 1c tolerance", () => {
    const result = invoiceFormSchema.safeParse({
      ...valid,
      subtotal: 1000,
      amount: 1000,
      items: [
        { description: "Service A", quantity: 2, price: 333.33 },
        { description: "Service B", quantity: 1, price: 333.34 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects taxAmount that doesn't equal subtotal × taxRate (AUD-DD-FORM-020)", () => {
    const errors = fieldErrorsFromZod(invoiceFormSchema, {
      ...valid,
      subtotal: 1000,
      amount: 1100,
      taxRate: 10,
      taxAmount: 50, // expected 100
    });
    expect(errors.taxAmount).toContain("Tax amount does not match");
  });

  it("accepts taxAmount that matches subtotal × taxRate", () => {
    const result = invoiceFormSchema.safeParse({
      ...valid,
      subtotal: 1000,
      amount: 1100,
      taxRate: 10,
      taxAmount: 100,
      items: [{ description: "Service", quantity: 1, price: 1000 }],
    });
    expect(result.success).toBe(true);
  });

  it("skips tax cross-validation when taxRate is 0", () => {
    expect(
      invoiceFormSchema.safeParse({
        ...valid,
        taxRate: 0,
        taxAmount: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects zero amount", () => {
    const errors = fieldErrorsFromZod(invoiceFormSchema, { ...valid, amount: 0 });
    expect(errors.amount).toBe("Amount must be a positive number.");
  });
});

describe("fieldErrorsFromZod helper", () => {
  it("returns an empty object on valid input", () => {
    expect(fieldErrorsFromZod(expenseFormSchema, {
      merchant: "x",
      amount: "10",
      category: "Software",
    })).toEqual({});
  });

  it("dedupes when the same field has multiple issues", () => {
    const errors = fieldErrorsFromZod(expenseFormSchema, {
      merchant: "",
      amount: "",
      category: "",
    });
    expect(errors.merchant).toBe("Merchant is required.");
    expect(errors.category).toBe("Category is required.");
    expect(errors.amount).toBeDefined();
  });
});
