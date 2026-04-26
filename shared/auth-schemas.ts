import { z } from "zod";

// LU-009 / AUD-FE-005 — single source of truth for login + signup form
// validation, importable by both the web client (client/src/pages/login.tsx,
// signup.tsx) and the server when login validation is needed server-side.
//
// Drift between client and server validation has caused real bugs in fintech
// SaaS products; centralising here closes that gap. The mobile app should
// also import these schemas as it migrates to RHF + zodResolver.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordSchema = z
  .string()
  .min(1, "Password is required.")
  .min(8, "Password must be at least 8 characters.");

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .regex(emailRegex, "Please enter a valid email."),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name is required.")
      .transform((v) => v.trim())
      .pipe(z.string().min(2, "Name must be at least 2 characters.")),
    email: z
      .string()
      .min(1, "Email is required.")
      .regex(emailRegex, "Please enter a valid email."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms." }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export type SignupInput = z.infer<typeof signupSchema>;

// Pin schema — for the transaction PIN dialog (4-6 digits, server-truth on length).
export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits.");

// E.164 phone schema — used by SMS-OTP flows on both auth pages.
export const phoneSchema = z
  .string()
  .regex(/^\+\d{7,15}$/, "Please enter a valid phone number in E.164 format (e.g. +234...).");

export const otpSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit verification code.");

/**
 * Convenience helper that runs a zod schema against an arbitrary input and
 * returns a per-field error map matching the existing useState shape used by
 * login.tsx and signup.tsx. This keeps the touched/blur UX intact while
 * sourcing rules from a single schema.
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
    if (path != null && typeof errors[String(path)] === "undefined") {
      errors[String(path)] = issue.message;
    }
  }
  return errors;
}
