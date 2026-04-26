import { z } from "zod";

// LU-009 Phase 2 / AUD-DD-FORM-005 — single source of truth for the
// mutating-form input schemas. Importable by both the web client and the
// server, so client-side validation matches what the server will accept
// (or reject) at submit time.
//
// These schemas describe FORM INPUT shape (what the user types), not
// database shape (which is enforced by Drizzle's createInsertSchema).
// Form input often has different optionality (e.g. `subtotal` is required
// in DB but the form computes it from line items) and different types
// (e.g. amount can be number OR string, normalised to string for the API).
//
// To avoid drift, server/routes/shared.ts re-exports these schemas. There
// is exactly one definition per shape.

export const expenseFormSchema = z.object({
  merchant: z.string().min(1, "Merchant is required."),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(
      z.string().refine((s) => {
        const n = parseFloat(s);
        return Number.isFinite(n) && n > 0;
      }, "Amount must be a positive number."),
    ),
  category: z.string().min(1, "Category is required."),
  note: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  expenseType: z.enum(["spent", "request"]).optional().default("request"),
  attachments: z.array(z.string()).optional().default([]),
  taggedReviewers: z.array(z.string()).optional().default([]),
  // userId / user are stamped by the server from the JWT; the client
  // doesn't need to fill them.
  userId: z.string().optional(),
  user: z.string().optional(),
});
export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

const invoiceLineItemSchema = z.object({
  description: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

export const invoiceFormSchema = z
  .object({
    client: z.string().min(1, "Client name is required."),
    clientEmail: z
      .string()
      .email("Invalid email address.")
      .optional()
      .or(z.literal("")),
    amount: z
      .union([z.string(), z.number()])
      .transform((v) => String(v))
      .pipe(
        z.string().refine((s) => {
          const n = parseFloat(s);
          return Number.isFinite(n) && n > 0;
        }, "Amount must be a positive number."),
      ),
    subtotal: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null && v !== "" ? String(v) : undefined)),
    taxRate: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null && v !== "" ? String(v) : "0")),
    taxAmount: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null && v !== "" ? String(v) : "0")),
    currency: z.string().optional().default("USD"),
    notes: z.string().optional(),
    dueDate: z.string().optional(),
    items: z.array(invoiceLineItemSchema).optional().default([]),
  })
  .refine(
    (data) => {
      // AUD-DD-FORM-019 (client side): if line items are present, the
      // computed subtotal must match the declared subtotal/amount within
      // a 1-cent tolerance. Server enforces the same.
      if (!Array.isArray(data.items) || data.items.length === 0) return true;
      const computed = data.items.reduce((sum, it) => {
        const qty = parseFloat(String(it.quantity ?? 1));
        const unit = parseFloat(String(it.price ?? it.amount ?? 0));
        if (!Number.isFinite(qty) || !Number.isFinite(unit)) return sum;
        return sum + qty * unit;
      }, 0);
      const declared = parseFloat(String(data.subtotal ?? data.amount ?? 0));
      if (!Number.isFinite(declared)) return true;
      return Math.abs(computed - declared) <= 0.01;
    },
    {
      path: ["items"],
      message:
        "Line-item totals do not match the declared subtotal. Adjust line items or subtotal.",
    },
  )
  .refine(
    (data) => {
      // AUD-DD-FORM-020 (client side): tax cross-validation.
      const taxRateNum = parseFloat(String(data.taxRate ?? "0"));
      const taxAmountNum = parseFloat(String(data.taxAmount ?? "0"));
      const subtotalNum = parseFloat(String(data.subtotal ?? data.amount ?? 0));
      if (
        !Number.isFinite(taxRateNum) ||
        !Number.isFinite(taxAmountNum) ||
        !Number.isFinite(subtotalNum) ||
        taxRateNum <= 0
      ) {
        return true;
      }
      const expected = subtotalNum * (taxRateNum / 100);
      return Math.abs(expected - taxAmountNum) <= 0.01;
    },
    {
      path: ["taxAmount"],
      message:
        "Tax amount does not match subtotal × taxRate. Recompute or adjust the rate.",
    },
  );
export type InvoiceFormInput = z.infer<typeof invoiceFormSchema>;

/**
 * Helper: run a Zod schema against arbitrary input and return a
 * field-keyed error map matching the existing useState error UX in
 * client forms. Mirrors the helper in shared/auth-schemas.ts.
 */
export function fieldErrorsFromZod<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): Partial<Record<string, string>> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path[0];
    const key = path != null ? String(path) : "_";
    if (errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}
