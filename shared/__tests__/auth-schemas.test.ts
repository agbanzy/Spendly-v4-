import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  fieldErrorsFromZod,
  pinSchema,
  phoneSchema,
  otpSchema,
  forgotPasswordResetSchema,
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3Schema,
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

describe("forgotPasswordResetSchema (LU-009 Phase 2)", () => {
  const valid = { code: "123456", newPassword: "newpass123", confirmPassword: "newpass123" };

  it("accepts a valid code + matching passwords", () => {
    expect(forgotPasswordResetSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-numeric code", () => {
    const errors = fieldErrorsFromZod(forgotPasswordResetSchema, { ...valid, code: "12a456" });
    expect(errors.code).toBe("Enter the 6-digit code from your email.");
  });

  it("rejects a code shorter than 6 digits", () => {
    const errors = fieldErrorsFromZod(forgotPasswordResetSchema, { ...valid, code: "12345" });
    expect(errors.code).toBe("Enter the 6-digit code from your email.");
  });

  it("rejects passwords that don't match", () => {
    const errors = fieldErrorsFromZod(forgotPasswordResetSchema, {
      code: "123456",
      newPassword: "newpass123",
      confirmPassword: "different1",
    });
    expect(errors.confirmPassword).toBe("Passwords do not match.");
  });

  it("rejects a new password under 8 characters", () => {
    const errors = fieldErrorsFromZod(forgotPasswordResetSchema, {
      code: "123456",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(errors.newPassword).toBe("Password must be at least 8 characters.");
  });

  it("requires the confirmPassword field", () => {
    const errors = fieldErrorsFromZod(forgotPasswordResetSchema, {
      code: "123456",
      newPassword: "newpass123",
      confirmPassword: "",
    });
    expect(errors.confirmPassword).toBe("Please confirm your new password.");
  });
});

describe("onboardingStep1Schema (LU-009 Phase 2)", () => {
  it("accepts a personal account without business fields", () => {
    expect(onboardingStep1Schema.safeParse({ isBusinessAccount: false }).success).toBe(true);
  });

  it("accepts a business account with name + type", () => {
    expect(
      onboardingStep1Schema.safeParse({
        isBusinessAccount: true,
        businessName: "Acme Co",
        businessType: "llc",
      }).success,
    ).toBe(true);
  });

  it("rejects a business account with missing name", () => {
    const errors = fieldErrorsFromZod(onboardingStep1Schema, {
      isBusinessAccount: true,
      businessName: "",
      businessType: "llc",
    });
    expect(errors.businessName).toBe("Business name is required.");
  });

  it("rejects a business account with missing type", () => {
    const errors = fieldErrorsFromZod(onboardingStep1Schema, {
      isBusinessAccount: true,
      businessName: "Acme Co",
      businessType: "",
    });
    expect(errors.businessType).toBe("Please select a business type.");
  });

  it("trims and rejects a 1-character business name", () => {
    const errors = fieldErrorsFromZod(onboardingStep1Schema, {
      isBusinessAccount: true,
      businessName: "  A  ",
      businessType: "llc",
    });
    expect(errors.businessName).toBe("Business name must be at least 2 characters.");
  });
});

describe("onboardingStep2Schema (LU-009 Phase 2)", () => {
  const valid = {
    firstName: "Godwin",
    lastName: "Agbane",
    country: "NG",
    phoneNumber: "+2347060961678",
    dateOfBirth: "1995-01-15",
  };

  it("accepts valid profile data", () => {
    expect(onboardingStep2Schema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing first name", () => {
    const errors = fieldErrorsFromZod(onboardingStep2Schema, { ...valid, firstName: "" });
    expect(errors.firstName).toBe("First name is required.");
  });

  it("rejects an invalid phone number", () => {
    const errors = fieldErrorsFromZod(onboardingStep2Schema, { ...valid, phoneNumber: "abc" });
    expect(errors.phoneNumber).toBe("Please enter a valid phone number.");
  });

  it("rejects an unparseable date of birth", () => {
    const errors = fieldErrorsFromZod(onboardingStep2Schema, { ...valid, dateOfBirth: "not-a-date" });
    expect(errors.dateOfBirth).toBe("Please enter a valid date.");
  });

  it("rejects an empty country", () => {
    const errors = fieldErrorsFromZod(onboardingStep2Schema, { ...valid, country: "" });
    expect(errors.country).toBe("Please select a country.");
  });
});

describe("onboardingStep3Schema (LU-009 Phase 2)", () => {
  const valid = {
    idNumber: "12345678901",
    addressLine1: "10 Awolowo Road",
    city: "Lagos",
  };

  it("accepts valid identity + address", () => {
    expect(onboardingStep3Schema.safeParse(valid).success).toBe(true);
  });

  it("rejects an ID number under 5 chars", () => {
    const errors = fieldErrorsFromZod(onboardingStep3Schema, { ...valid, idNumber: "12" });
    expect(errors.idNumber).toBe("ID number looks too short.");
  });

  it("rejects a single-character address", () => {
    const errors = fieldErrorsFromZod(onboardingStep3Schema, { ...valid, addressLine1: "ab" });
    expect(errors.addressLine1).toBe("Please enter a valid address.");
  });

  it("rejects a single-character city", () => {
    const errors = fieldErrorsFromZod(onboardingStep3Schema, { ...valid, city: "L" });
    expect(errors.city).toBe("Please enter a valid city.");
  });
});
