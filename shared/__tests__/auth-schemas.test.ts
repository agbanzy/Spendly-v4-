import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  fieldErrorsFromZod,
  pinSchema,
  phoneSchema,
  otpSchema,
} from "../auth-schemas";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(loginSchema.safeParse({ email: "guru@thefinanciar.com", password: "password123" }).success).toBe(true);
  });

  it("rejects an empty email with the right message", () => {
    const errors = fieldErrorsFromZod(loginSchema, { email: "", password: "password123" });
    expect(errors.email).toBe("Email is required.");
  });

  it("rejects a malformed email", () => {
    const errors = fieldErrorsFromZod(loginSchema, { email: "notanemail", password: "password123" });
    expect(errors.email).toBe("Please enter a valid email.");
  });

  it("rejects a short password", () => {
    const errors = fieldErrorsFromZod(loginSchema, { email: "a@b.co", password: "short" });
    expect(errors.password).toBe("Password must be at least 8 characters.");
  });

  it("rejects an empty password before length", () => {
    const errors = fieldErrorsFromZod(loginSchema, { email: "a@b.co", password: "" });
    expect(errors.password).toBe("Password is required.");
  });
});

describe("signupSchema", () => {
  const validInput = {
    fullName: "Godwin Agbane",
    email: "guru@thefinanciar.com",
    password: "password123",
    confirmPassword: "password123",
    agreedToTerms: true,
  };

  it("accepts a fully-valid signup", () => {
    expect(signupSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a name shorter than 2 chars after trim", () => {
    const errors = fieldErrorsFromZod(signupSchema, { ...validInput, fullName: " A " });
    expect(errors.fullName).toBe("Name must be at least 2 characters.");
  });

  it("rejects mismatched passwords on confirmPassword", () => {
    const errors = fieldErrorsFromZod(signupSchema, { ...validInput, confirmPassword: "differentpass" });
    expect(errors.confirmPassword).toBe("Passwords do not match.");
  });

  it("rejects unticked terms", () => {
    const errors = fieldErrorsFromZod(signupSchema, { ...validInput, agreedToTerms: false });
    expect(errors.agreedToTerms).toBe("You must agree to the terms.");
  });
});

describe("fieldErrorsFromZod", () => {
  it("returns an empty object when input is valid", () => {
    expect(fieldErrorsFromZod(loginSchema, { email: "a@b.co", password: "password123" })).toEqual({});
  });

  it("dedups when the same field has multiple issues", () => {
    const errors = fieldErrorsFromZod(loginSchema, { email: "", password: "" });
    expect(errors.email).toBe("Email is required.");
    expect(errors.password).toBe("Password is required.");
  });
});

describe("pinSchema / phoneSchema / otpSchema", () => {
  it("accepts a 4-digit and a 6-digit PIN", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("123456").success).toBe(true);
  });

  it("rejects a 3-digit PIN", () => {
    expect(pinSchema.safeParse("123").success).toBe(false);
  });

  it("accepts an E.164 phone number", () => {
    expect(phoneSchema.safeParse("+2347060961678").success).toBe(true);
  });

  it("rejects a phone without the leading +", () => {
    expect(phoneSchema.safeParse("2347060961678").success).toBe(false);
  });

  it("accepts a 6-digit OTP", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
  });

  it("rejects a 5-digit OTP", () => {
    expect(otpSchema.safeParse("12345").success).toBe(false);
  });
});
