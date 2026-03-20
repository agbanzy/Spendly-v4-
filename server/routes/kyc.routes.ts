import express from "express";
import fs from "fs";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requireOwnership } from "../middleware/auth";
import { sensitiveLimiter } from "../middleware/rateLimiter";
import { notificationService } from "../services/notification-service";
import { paymentService, getCurrencyForCountry } from "../paymentService";
import { getStripeClient } from "../stripeClient";
import { paystackClient } from "../paystackClient";
import { mapPaymentError, paymentLogger } from "../utils/paymentUtils";
import { validateUploadedFile } from "../utils/fileValidation";
import { getPrimaryIdForCountry, getProviderForCountry, getCurrencyForCountry as getCountryCurrency } from "@shared/constants";
import {
  param,
  resolveUserCompany,
  upload,
} from "./shared";

const router = express.Router();

// ==================== KYC REQUIREMENTS PER COUNTRY ====================

export interface KycRequirement {
  primaryId: string;
  requiresDocument: boolean;
  requiresProofOfAddress: boolean;
  autoVerifiable: boolean;
  additionalDocs?: string[];
}

export const KYC_REQUIREMENTS: Record<string, KycRequirement> = {
  // Africa — Paystack
  NG: { primaryId: 'BVN', requiresDocument: false, requiresProofOfAddress: false, autoVerifiable: true },
  GH: { primaryId: 'Ghana Card', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  ZA: { primaryId: 'SA ID', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  KE: { primaryId: 'National ID', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  EG: { primaryId: 'National ID', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  RW: { primaryId: 'National ID', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  CI: { primaryId: 'CNI', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },

  // North America — Stripe
  US: { primaryId: 'SSN', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false, additionalDocs: ['W-9'] },
  CA: { primaryId: 'SIN', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },

  // Oceania
  AU: { primaryId: 'TFN', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },

  // UK
  GB: { primaryId: 'NI Number', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },

  // Europe
  DE: { primaryId: 'Personalausweis', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  FR: { primaryId: 'CNI', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  ES: { primaryId: 'DNI/NIE', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  IT: { primaryId: 'Carta d\'Identita', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  NL: { primaryId: 'BSN', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  BE: { primaryId: 'National Register Number', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  AT: { primaryId: 'Personalausweis', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  CH: { primaryId: 'ID/Passport', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  SE: { primaryId: 'Personnummer', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  NO: { primaryId: 'Fodselsnummer', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  DK: { primaryId: 'CPR-nummer', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  FI: { primaryId: 'Henkilotunnus', requiresDocument: true, requiresProofOfAddress: false, autoVerifiable: false },
  IE: { primaryId: 'PPS Number', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
  PT: { primaryId: 'Cartao de Cidadao', requiresDocument: true, requiresProofOfAddress: true, autoVerifiable: false },
};

/** Get KYC requirements for a country. Falls back to strict defaults. */
export function getKycRequirements(countryCode: string): KycRequirement {
  return KYC_REQUIREMENTS[countryCode.toUpperCase()] || {
    primaryId: 'Passport',
    requiresDocument: true,
    requiresProofOfAddress: true,
    autoVerifiable: false,
  };
}

// ==================== ID FORMAT VALIDATION PER COUNTRY ====================

export interface IdValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate ID number format based on country-specific rules.
 * Returns { valid: true } or { valid: false, error: '...' }.
 */
export function validateIdFormat(countryCode: string, idNumber: string): IdValidationResult {
  const country = countryCode.toUpperCase();
  const stripped = idNumber.replace(/[\s-]/g, '');

  switch (country) {
    case 'NG': {
      // BVN: exactly 11 digits
      if (!/^\d{11}$/.test(stripped)) {
        return { valid: false, error: 'BVN must be exactly 11 digits' };
      }
      return { valid: true };
    }

    case 'ZA': {
      // SA ID: 13 digits + Luhn checksum
      if (!/^\d{13}$/.test(stripped)) {
        return { valid: false, error: 'South African ID must be exactly 13 digits' };
      }
      // Luhn checksum validation
      let sum = 0;
      for (let i = 0; i < 13; i++) {
        let digit = parseInt(stripped[i], 10);
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      if (sum % 10 !== 0) {
        return { valid: false, error: 'South African ID has an invalid checksum' };
      }
      return { valid: true };
    }

    case 'US': {
      // SSN: XXX-XX-XXXX format, no all-zeros segments
      const ssnPattern = /^(\d{3})-?(\d{2})-?(\d{4})$/;
      const match = stripped.match(/^(\d{3})(\d{2})(\d{4})$/);
      const dashMatch = idNumber.match(ssnPattern);
      if (!match && !dashMatch) {
        return { valid: false, error: 'SSN must be in XXX-XX-XXXX format (9 digits)' };
      }
      const parts = match || [null, dashMatch![1], dashMatch![2], dashMatch![3]];
      if (parts[1] === '000' || parts[2] === '00' || parts[3] === '0000') {
        return { valid: false, error: 'SSN cannot have all-zero segments' };
      }
      // SSN area number cannot be 666 or 900-999
      const area = parseInt(parts[1]!, 10);
      if (area === 666 || area >= 900) {
        return { valid: false, error: 'SSN contains an invalid area number' };
      }
      return { valid: true };
    }

    case 'GB': {
      // NI Number: 2 letters + 6 digits + 1 letter
      // First letter cannot be D, F, I, Q, U, V
      // Second letter cannot be D, F, I, O, Q, U, V
      const niPattern = /^([A-Z]{2})(\d{6})([A-D])$/i;
      const niMatch = stripped.toUpperCase().match(niPattern);
      if (!niMatch) {
        return { valid: false, error: 'NI Number must be 2 letters + 6 digits + 1 letter (A-D)' };
      }
      const invalidFirst = /^[DFIQUV]/;
      const invalidSecond = /^.[DFIOQU V]/;
      if (invalidFirst.test(niMatch[1])) {
        return { valid: false, error: 'NI Number first letter cannot be D, F, I, Q, U, or V' };
      }
      if (/[DFIOQUV]/.test(niMatch[1][1])) {
        return { valid: false, error: 'NI Number second letter cannot be D, F, I, O, Q, U, or V' };
      }
      // Prefixes BG, GB, NK, KN, TN, NT, ZZ are not valid
      const invalidPrefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];
      if (invalidPrefixes.includes(niMatch[1])) {
        return { valid: false, error: 'NI Number has an invalid prefix' };
      }
      return { valid: true };
    }

    case 'GH': {
      // Ghana Card: GHA-XXXXXXXXX-X format or alphanumeric up to 15 chars
      if (stripped.length < 10 || stripped.length > 15) {
        return { valid: false, error: 'Ghana Card number must be 10-15 characters' };
      }
      if (!/^[A-Z0-9]+$/i.test(stripped)) {
        return { valid: false, error: 'Ghana Card number must be alphanumeric' };
      }
      return { valid: true };
    }

    case 'KE': {
      // Kenya National ID: 6-8 digits
      if (!/^\d{6,8}$/.test(stripped)) {
        return { valid: false, error: 'Kenya National ID must be 6-8 digits' };
      }
      return { valid: true };
    }

    case 'EG': {
      // Egypt National ID: exactly 14 digits
      if (!/^\d{14}$/.test(stripped)) {
        return { valid: false, error: 'Egypt National ID must be exactly 14 digits' };
      }
      return { valid: true };
    }

    case 'RW': {
      // Rwanda National ID: 16 digits
      if (!/^\d{16}$/.test(stripped)) {
        return { valid: false, error: 'Rwanda National ID must be exactly 16 digits' };
      }
      return { valid: true };
    }

    case 'CA': {
      // SIN: 9 digits, Luhn checksum
      if (!/^\d{9}$/.test(stripped)) {
        return { valid: false, error: 'SIN must be exactly 9 digits' };
      }
      // Luhn check
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        let digit = parseInt(stripped[i], 10);
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      if (sum % 10 !== 0) {
        return { valid: false, error: 'SIN has an invalid checksum' };
      }
      return { valid: true };
    }

    case 'AU': {
      // TFN: 8 or 9 digits
      if (!/^\d{8,9}$/.test(stripped)) {
        return { valid: false, error: 'TFN must be 8 or 9 digits' };
      }
      return { valid: true };
    }

    case 'SE': {
      // Personnummer: YYYYMMDD-XXXX (12 digits total)
      if (!/^\d{12}$/.test(stripped) && !/^\d{8}\d{4}$/.test(stripped)) {
        return { valid: false, error: 'Personnummer must be 12 digits (YYYYMMDDXXXX)' };
      }
      return { valid: true };
    }

    case 'NO': {
      // Fodselsnummer: 11 digits
      if (!/^\d{11}$/.test(stripped)) {
        return { valid: false, error: 'Fodselsnummer must be exactly 11 digits' };
      }
      return { valid: true };
    }

    case 'DK': {
      // CPR-nummer: 10 digits (DDMMYYXXXX)
      if (!/^\d{10}$/.test(stripped)) {
        return { valid: false, error: 'CPR-nummer must be exactly 10 digits' };
      }
      return { valid: true };
    }

    case 'FI': {
      // Henkilotunnus: DDMMYYXNNNC (11 chars)
      if (stripped.length !== 11) {
        return { valid: false, error: 'Henkilotunnus must be exactly 11 characters' };
      }
      return { valid: true };
    }

    case 'IE': {
      // PPS Number: 7 digits + 1-2 letters
      if (!/^\d{7}[A-Z]{1,2}$/i.test(stripped)) {
        return { valid: false, error: 'PPS Number must be 7 digits followed by 1-2 letters' };
      }
      return { valid: true };
    }

    case 'NL': {
      // BSN: 9 digits, 11-check
      if (!/^\d{9}$/.test(stripped)) {
        return { valid: false, error: 'BSN must be exactly 9 digits' };
      }
      // 11-check: 9*d1 + 8*d2 + ... + 2*d8 - 1*d9 must be divisible by 11 and not 0
      let checksum = 0;
      for (let i = 0; i < 8; i++) {
        checksum += (9 - i) * parseInt(stripped[i], 10);
      }
      checksum -= parseInt(stripped[8], 10);
      if (checksum % 11 !== 0 || checksum === 0) {
        return { valid: false, error: 'BSN has an invalid checksum' };
      }
      return { valid: true };
    }

    default: {
      // Generic validation: at least 3 chars, no more than 20
      if (stripped.length < 3) {
        return { valid: false, error: 'ID number must be at least 3 characters' };
      }
      if (stripped.length > 20) {
        return { valid: false, error: 'ID number must be 20 characters or fewer' };
      }
      return { valid: true };
    }
  }
}

// ==================== BVN VERIFICATION WITH CONFIDENCE SCORING ====================

export type BvnConfidence = 'high' | 'medium' | 'low';

export interface BvnVerificationResult {
  verified: boolean;
  confidence: BvnConfidence;
  nameMatch: boolean;
  phoneMatch: boolean | null;
  details: string;
}

/**
 * Normalize a name for comparison: lowercase, trim, collapse whitespace,
 * remove hyphens, and strip accents.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if name A contains name B or vice-versa (partial match).
 * Handles multi-part names where submitted name may be a subset of BVN name.
 */
function namesMatch(bvnName: string, submittedName: string): boolean {
  const a = normalizeName(bvnName);
  const b = normalizeName(submittedName);

  // Exact match
  if (a === b) return true;

  // Contains match (handles compound names)
  if (a.includes(b) || b.includes(a)) return true;

  // Token-based: check if all tokens in the shorter name appear in the longer
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  const [shorter, longer] = tokensA.length <= tokensB.length
    ? [tokensA, tokensB]
    : [tokensB, tokensA];

  if (shorter.length > 0 && shorter.every(t => longer.some(l => l.includes(t) || t.includes(l)))) {
    return true;
  }

  return false;
}

/**
 * Normalize phone number for comparison: strip spaces, dashes, and leading country code.
 */
function normalizePhone(phone: string, countryDial: string = '+234'): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  // Strip country code prefix if present
  if (cleaned.startsWith(countryDial)) {
    cleaned = '0' + cleaned.slice(countryDial.length);
  } else if (cleaned.startsWith(countryDial.replace('+', ''))) {
    cleaned = '0' + cleaned.slice(countryDial.length - 1);
  }
  return cleaned;
}

/**
 * Verify BVN data against submitted user data and return a confidence-scored result.
 */
export function verifyBvnMatch(
  bvnData: { first_name?: string; last_name?: string; phone_number?: string; mobile?: string; formatted_dob?: string },
  submitted: { firstName: string; lastName: string; phoneNumber?: string },
): BvnVerificationResult {
  const bvnFirst = bvnData.first_name || '';
  const bvnLast = bvnData.last_name || '';
  const bvnPhone = bvnData.phone_number || bvnData.mobile || '';

  const firstNameMatch = namesMatch(bvnFirst, submitted.firstName);
  const lastNameMatch = namesMatch(bvnLast, submitted.lastName);
  const nameMatch = firstNameMatch && lastNameMatch;

  // Phone match (null = not available for comparison)
  let phoneMatch: boolean | null = null;
  if (bvnPhone && submitted.phoneNumber) {
    const normalizedBvn = normalizePhone(bvnPhone);
    const normalizedSubmitted = normalizePhone(submitted.phoneNumber);
    phoneMatch = normalizedBvn === normalizedSubmitted
      || normalizedBvn.endsWith(normalizedSubmitted.slice(-10))
      || normalizedSubmitted.endsWith(normalizedBvn.slice(-10));
  }

  // Determine confidence
  let confidence: BvnConfidence;
  const details: string[] = [];

  if (nameMatch && phoneMatch === true) {
    confidence = 'high';
    details.push('Full name and phone number match');
  } else if (nameMatch && phoneMatch === null) {
    // Name matches, phone not available for comparison
    confidence = 'high';
    details.push('Full name match (phone not available from BVN)');
  } else if (nameMatch && phoneMatch === false) {
    confidence = 'medium';
    details.push('Name matches but phone number differs');
  } else if ((firstNameMatch || lastNameMatch) && phoneMatch === true) {
    confidence = 'medium';
    details.push(`Partial name match (${firstNameMatch ? 'first' : 'last'} name) with phone match`);
  } else if (firstNameMatch || lastNameMatch) {
    confidence = 'low';
    details.push(`Only ${firstNameMatch ? 'first' : 'last'} name matches`);
  } else {
    confidence = 'low';
    details.push('No name match');
  }

  return {
    verified: confidence === 'high',
    confidence,
    nameMatch,
    phoneMatch,
    details: details.join('; '),
  };
}

// ==================== KYC & ONBOARDING API ====================

// Get user profile by Cognito Sub
router.get("/user-profile/:cognitoSub", requireAuth, requireOwnership, async (req, res) => {
  try {
    const cognitoSub = param(req.params.cognitoSub);
    const profile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch profile" });
  }
});

// Create user profile
router.post("/user-profile", requireAuth, async (req, res) => {
  try {
    const { cognitoSub, email, displayName, photoUrl, phoneNumber, country } = req.body;
    if (!cognitoSub || !email) {
      return res.status(400).json({ error: "cognitoSub and email are required" });
    }
    // SECURITY: Ensure user can only create their own profile
    if (cognitoSub !== req.user!.cognitoSub) {
      return res.status(403).json({ error: "Cannot create profile for another user" });
    }

    const existing = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (existing) {
      if ((phoneNumber || country) && (!existing.phoneNumber || !existing.country)) {
        const updated = await storage.updateUserProfile(cognitoSub, {
          ...(phoneNumber && !existing.phoneNumber ? { phoneNumber } : {}),
          ...(country && !existing.country ? { country } : {}),
        });
        if (updated) return res.json(updated);
      }
      return res.json(existing);
    }

    const now = new Date().toISOString();
    const profile = await storage.createUserProfile({
      cognitoSub,
      email,
      displayName: displayName || null,
      photoUrl: photoUrl || null,
      phoneNumber: phoneNumber || null,
      dateOfBirth: null,
      nationality: null,
      address: null,
      city: null,
      state: null,
      country: country || null,
      postalCode: null,
      kycStatus: 'not_started',
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Create notification settings for the new user with their email
    try {
      const now2 = new Date().toISOString();
      await storage.createNotificationSettings({
        userId: cognitoSub,
        emailEnabled: true,
        smsEnabled: !!phoneNumber,
        pushEnabled: true,
        inAppEnabled: true,
        email: email,
        phone: phoneNumber || null,
        pushToken: null,
        expenseNotifications: true,
        paymentNotifications: true,
        billNotifications: true,
        budgetNotifications: true,
        securityNotifications: true,
        marketingNotifications: false,
        createdAt: now2,
        updatedAt: now2,
      });
    } catch (nsErr) {
      console.error('Failed to create notification settings:', nsErr);
    }

    // Send welcome email to new user
    notificationService.sendWelcomeEmail({
      email,
      name: displayName || email.split('@')[0],
    }).catch(err => console.error('Failed to send welcome email:', err));

    res.status(201).json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create profile" });
  }
});

// ==================== UNIFIED ONBOARDING ====================
// Handles profile, KYC, company settings, virtual account, and subscription in one call
router.post("/onboarding/complete", requireAuth, async (req, res) => {
  try {
    const cognitoSub = (req as any).user?.cognitoSub;
    if (!cognitoSub) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      firstName, lastName, country, phoneNumber, dateOfBirth,
      isBusinessAccount, businessName, businessType, businessIndustry, teamSize,
      idNumber, addressLine1, city, state, postalCode,
    } = req.body;

    if (!firstName || !lastName || !country || !phoneNumber || !dateOfBirth || !idNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Derive currency and ID type from country
    const currencyInfo = getCountryCurrency(country);
    const idConfig = getPrimaryIdForCountry(country);
    const provider = getProviderForCountry(country);
    const now = new Date().toISOString();

    // Get or create user profile
    let profile = await storage.getUserProfileByCognitoSub(cognitoSub);
    const userEmail = profile?.email || (req as any).user?.email || '';
    const displayName = `${firstName} ${lastName}`.trim();
    const fullAddress = [addressLine1, city, state, postalCode, country].filter(Boolean).join(', ');

    if (profile) {
      profile = await storage.updateUserProfile(cognitoSub, {
        displayName,
        phoneNumber,
        dateOfBirth,
        country,
        address: fullAddress,
        city,
        state,
        postalCode,
        onboardingCompleted: true,
        onboardingStep: 4,
        kycStatus: 'pending_review',
        updatedAt: now,
      }) || profile;
    } else {
      profile = await storage.createUserProfile({
        cognitoSub,
        email: userEmail,
        displayName,
        phoneNumber,
        dateOfBirth,
        country,
        address: fullAddress,
        city,
        state,
        postalCode,
        onboardingCompleted: true,
        onboardingStep: 4,
        kycStatus: 'pending_review',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create KYC submission
    let isAutoApproved = false;
    const upperCountry = country.toUpperCase();

    // Validate ID format based on country
    const idValidation = validateIdFormat(upperCountry, idNumber);
    if (!idValidation.valid) {
      return res.status(400).json({ error: idValidation.error });
    }

    let bvnVerification: BvnVerificationResult | null = null;

    // For NG + BVN: auto-verify via Paystack with confidence scoring
    if (upperCountry === 'NG' && idConfig.key === 'bvn' && idNumber) {
      try {
        const bvnResult = await paystackClient.resolveBVN(idNumber);
        if (bvnResult && bvnResult.status && bvnResult.data) {
          bvnVerification = verifyBvnMatch(bvnResult.data, { firstName, lastName, phoneNumber });
          if (bvnVerification.confidence === 'high') {
            isAutoApproved = true;
          } else if (bvnVerification.confidence === 'medium') {
            // Flag for manual review with details
            paymentLogger.warn('bvn_medium_confidence', {
              bvn: `***${idNumber.slice(-4)}`,
              confidence: bvnVerification.confidence,
              details: bvnVerification.details,
            });
          } else {
            paymentLogger.warn('bvn_low_confidence', {
              bvn: `***${idNumber.slice(-4)}`,
              confidence: bvnVerification.confidence,
              details: bvnVerification.details,
            });
          }
        }
      } catch (bvnErr: any) {
        console.error('BVN verification failed (non-blocking):', bvnErr.message);
      }
    }

    const kycStatus = isAutoApproved ? 'approved' : 'pending_review';

    // Create KYC record
    try {
      await storage.createKycSubmission({
        userProfileId: profile.id,
        firstName,
        lastName,
        dateOfBirth,
        nationality: upperCountry,
        phoneNumber,
        country: upperCountry,
        addressLine1: addressLine1 || '',
        city: city || '',
        state: state || '',
        postalCode: postalCode || '',
        idType: idConfig.key.toUpperCase(),
        idNumber,
        status: kycStatus,
        reviewNotes: bvnVerification
          ? `BVN confidence: ${bvnVerification.confidence} — ${bvnVerification.details}`
          : null,
        reviewedBy: isAutoApproved ? 'system_bvn' : null,
        reviewedAt: isAutoApproved ? now : null,
        submittedAt: now,
        ...(isBusinessAccount ? {
          isBusinessAccount: true,
          businessName: businessName || '',
          businessType: businessType || '',
        } : {}),
        createdAt: now,
        updatedAt: now,
      });
    } catch (kycErr: any) {
      console.error('KYC submission creation failed:', kycErr.message);
    }

    // Update profile KYC status
    if (isAutoApproved) {
      await storage.updateUserProfile(cognitoSub, { kycStatus: 'approved' });
    }

    // Resolve company context
    const companyContext = await resolveUserCompany(req);
    let virtualAccountResult: any = null;

    // Update company settings
    if (companyContext?.companyId) {
      try {
        await storage.updateCompanyAsSettings(companyContext.companyId, {
          currency: currencyInfo.currency,
          countryCode: upperCountry,
          paymentProvider: provider,
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        } as any);
      } catch (settingsErr: any) {
        console.error('Company settings update failed:', settingsErr.message);
      }

      // Create virtual account — only if KYC is approved or auto-verified
      // If pending, the account will be created later when KYC is approved (via admin action or webhook)
      if (kycStatus === 'approved') {
        try {
          const DVA_COUNTRIES = ['NG', 'GH'];
          if (provider === 'paystack' && DVA_COUNTRIES.includes(upperCountry)) {
            const dvaResult = await paymentService.createVirtualAccount(
              userEmail, firstName, lastName, upperCountry, phoneNumber,
              upperCountry === 'NG' ? idNumber : undefined
            );
            virtualAccountResult = {
              accountNumber: dvaResult.accountNumber,
              bankName: dvaResult.bankName || 'Wema Bank',
              accountName: dvaResult.accountName || displayName,
              status: dvaResult.status === 'active' || dvaResult.status === 'assigned' ? 'active' : 'pending',
            };

            // Save to DB
            await storage.createVirtualAccount({
              userId: cognitoSub,
              companyId: companyContext.companyId,
              name: `${displayName} Account`,
              accountNumber: virtualAccountResult.accountNumber,
              bankName: virtualAccountResult.bankName,
              bankCode: dvaResult.bankCode || '',
              accountName: virtualAccountResult.accountName,
              currency: currencyInfo.currency,
              countryCode: upperCountry,
              provider: 'paystack',
              providerAccountId: dvaResult.customerCode || '',
              status: virtualAccountResult.status,
              type: 'dedicated',
              createdAt: now,
            } as any);
          } else if (provider === 'stripe') {
            const treasuryResult = await paymentService.createStripeFinancialAccount({
              supportedCurrencies: [currencyInfo.currency],
            });
            const abaAddress = (treasuryResult.financialAddresses || []).find(
              (addr: any) => addr.type === 'aba' && addr.aba
            );
            virtualAccountResult = {
              accountNumber: abaAddress?.aba?.account_number || `pending_${treasuryResult.id}`,
              bankName: 'Stripe Treasury',
              accountName: displayName,
              status: treasuryResult.status === 'open' ? 'active' : 'pending',
            };

            await storage.createVirtualAccount({
              userId: cognitoSub,
              companyId: companyContext.companyId,
              name: `${displayName} Account`,
              accountNumber: virtualAccountResult.accountNumber,
              bankName: 'Stripe Treasury',
              bankCode: abaAddress?.aba?.routing_number || '',
              accountName: displayName,
              currency: currencyInfo.currency,
              countryCode: upperCountry,
              provider: 'stripe',
              providerAccountId: treasuryResult.id,
              status: virtualAccountResult.status,
              type: 'treasury',
              createdAt: now,
            } as any);
          }
        } catch (vaErr: any) {
          console.error('Virtual account creation failed (non-blocking):', vaErr.message);
        }
      } else {
        console.log(`Virtual account creation deferred — KYC status is '${kycStatus}' for user ${cognitoSub}`);
      }

      // Create subscription (3-month trial)
      let subscription: any = null;
      try {
        const trialEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        subscription = await storage.createSubscription({
          companyId: companyContext.companyId,
          status: 'trialing',
          provider,
          trialStartDate: now,
          trialEndDate: trialEnd,
          quantity: 1,
          unitPrice: 500,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        });
      } catch (subErr: any) {
        console.error('Subscription creation failed:', subErr.message);
      }

      // Create notification settings
      try {
        const existingNotif = await storage.getNotificationSettings(cognitoSub);
        if (!existingNotif) {
          await storage.createNotificationSettings({
            userId: cognitoSub,
            emailEnabled: true,
            smsEnabled: !!phoneNumber,
            pushEnabled: true,
            inAppEnabled: true,
            email: userEmail,
            phone: phoneNumber || null,
            pushToken: null,
            expenseNotifications: true,
            paymentNotifications: true,
            billNotifications: true,
            budgetNotifications: true,
            securityNotifications: true,
            marketingNotifications: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (nsErr) {
        console.error('Notification settings creation failed:', nsErr);
      }

      // Send welcome email
      notificationService.sendWelcomeEmail({
        email: userEmail,
        name: displayName,
      }).catch(err => console.error('Failed to send welcome email:', err));

      res.json({
        profile,
        virtualAccount: virtualAccountResult,
        subscription: subscription ? {
          status: subscription.status,
          trialEndDate: subscription.trialEndDate,
        } : null,
        kycStatus,
        kycPendingVirtualAccount: kycStatus !== 'approved' && !virtualAccountResult,
        bvnVerification: bvnVerification ? {
          confidence: bvnVerification.confidence,
          nameMatch: bvnVerification.nameMatch,
          phoneMatch: bvnVerification.phoneMatch,
        } : undefined,
        currency: currencyInfo,
      });
    } else {
      // No company context — still return profile info
      res.json({
        profile,
        virtualAccount: null,
        subscription: null,
        kycStatus,
        kycPendingVirtualAccount: kycStatus !== 'approved',
        currency: currencyInfo,
      });
    }
  } catch (error: any) {
    console.error('Onboarding complete error:', error);
    res.status(500).json({ error: error.message || "Failed to complete onboarding" });
  }
});

// Update user profile
router.patch("/user-profile/:cognitoSub", requireAuth, requireOwnership, async (req, res) => {
  try {
    const cognitoSub = param(req.params.cognitoSub);
    const profile = await storage.updateUserProfile(cognitoSub, req.body);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// Get user settings (notification preferences, etc.)
router.get("/user-settings/:cognitoSub", requireAuth, requireOwnership, async (req, res) => {
  try {
    const cognitoSub = param(req.params.cognitoSub);
    const profile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Read notification preferences from notificationSettings table (single source of truth)
    const notifSettings = await storage.getNotificationSettings(cognitoSub);

    // Return user-specific settings (preferences from userProfiles, notifications from notificationSettings)
    res.json({
      emailNotifications: notifSettings?.emailEnabled ?? profile.emailNotifications ?? true,
      pushNotifications: notifSettings?.pushEnabled ?? profile.pushNotifications ?? true,
      smsNotifications: notifSettings?.smsEnabled ?? profile.smsNotifications ?? false,
      expenseAlerts: notifSettings?.expenseNotifications ?? profile.expenseAlerts ?? true,
      budgetWarnings: notifSettings?.budgetNotifications ?? profile.budgetWarnings ?? true,
      paymentReminders: notifSettings?.paymentNotifications ?? profile.paymentReminders ?? true,
      weeklyDigest: notifSettings?.weeklyDigest ?? profile.weeklyDigest ?? true,
      preferredCurrency: profile.preferredCurrency ?? 'USD',
      preferredLanguage: profile.preferredLanguage ?? 'en',
      preferredTimezone: profile.preferredTimezone ?? 'America/Los_Angeles',
      preferredDateFormat: profile.preferredDateFormat ?? 'MM/DD/YYYY',
      darkMode: profile.darkMode ?? false,
      twoFactorEnabled: profile.twoFactorEnabled ?? false,
      transactionPinEnabled: profile.transactionPinEnabled ?? false,
      sessionTimeout: profile.sessionTimeout ?? 30,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user settings" });
  }
});

// Update user settings
router.patch("/user-settings/:cognitoSub", requireAuth, requireOwnership, async (req, res) => {
  try {
    const cognitoSub = param(req.params.cognitoSub);

    // Notification fields map from API names to notificationSettings column names
    const notifFieldMap: Record<string, string> = {
      emailNotifications: 'emailEnabled',
      pushNotifications: 'pushEnabled',
      smsNotifications: 'smsEnabled',
      expenseAlerts: 'expenseNotifications',
      budgetWarnings: 'budgetNotifications',
      paymentReminders: 'paymentNotifications',
      weeklyDigest: 'weeklyDigest',
    };

    // Preference fields stay on userProfiles
    const profileFields = [
      'preferredCurrency', 'preferredLanguage', 'preferredTimezone',
      'preferredDateFormat', 'darkMode', 'sessionTimeout',
      'transactionPinEnabled', 'twoFactorEnabled'
    ];

    // Split updates: notification fields → notificationSettings, preferences → userProfiles
    const notifUpdates: Record<string, any> = {};
    const profileUpdates: Record<string, any> = {};

    for (const [apiKey, dbKey] of Object.entries(notifFieldMap)) {
      if (req.body[apiKey] !== undefined) {
        notifUpdates[dbKey] = req.body[apiKey];
        // Also write to userProfiles for backward compat during transition
        profileUpdates[apiKey] = req.body[apiKey];
      }
    }

    for (const key of profileFields) {
      if (req.body[key] !== undefined) {
        profileUpdates[key] = req.body[key];
      }
    }

    // Update userProfiles (preferences + deprecated notification fields for backward compat)
    let profile;
    if (Object.keys(profileUpdates).length > 0) {
      profile = await storage.updateUserProfile(cognitoSub, profileUpdates);
    } else {
      profile = await storage.getUserProfileByCognitoSub(cognitoSub);
    }
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update notificationSettings (single source of truth for notification preferences)
    if (Object.keys(notifUpdates).length > 0) {
      const existing = await storage.getNotificationSettings(cognitoSub);
      if (existing) {
        await storage.updateNotificationSettings(cognitoSub, notifUpdates);
      } else {
        // Create notificationSettings row if it doesn't exist yet
        await storage.createNotificationSettings({
          userId: cognitoSub,
          ...notifUpdates,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
      }
    }

    // Read back notification settings for response
    const notifSettings = await storage.getNotificationSettings(cognitoSub);

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        emailNotifications: notifSettings?.emailEnabled ?? profile.emailNotifications,
        pushNotifications: notifSettings?.pushEnabled ?? profile.pushNotifications,
        smsNotifications: notifSettings?.smsEnabled ?? profile.smsNotifications,
        expenseAlerts: notifSettings?.expenseNotifications ?? profile.expenseAlerts,
        budgetWarnings: notifSettings?.budgetNotifications ?? profile.budgetWarnings,
        paymentReminders: notifSettings?.paymentNotifications ?? profile.paymentReminders,
        weeklyDigest: notifSettings?.weeklyDigest ?? profile.weeklyDigest,
        preferredCurrency: profile.preferredCurrency,
        preferredLanguage: profile.preferredLanguage,
        preferredTimezone: profile.preferredTimezone,
        preferredDateFormat: profile.preferredDateFormat,
        darkMode: profile.darkMode,
        twoFactorEnabled: profile.twoFactorEnabled,
        transactionPinEnabled: profile.transactionPinEnabled,
        sessionTimeout: profile.sessionTimeout,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user settings" });
  }
});

// Get KYC requirements for a specific country (public — used by frontend during onboarding)
// IMPORTANT: This route MUST be defined before /kyc/:userProfileId to avoid param collision
router.get("/kyc/requirements/:countryCode", async (req, res) => {
  try {
    const countryCode = param(req.params.countryCode).toUpperCase();
    const requirements = getKycRequirements(countryCode);
    const idConfig = getPrimaryIdForCountry(countryCode);

    res.json({
      country: countryCode,
      requirements,
      idConfig,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch KYC requirements" });
  }
});

// Get KYC submission — enhanced with country requirements and missing documents
router.get("/kyc/:userProfileId", requireAuth, async (req, res) => {
  try {
    const userProfileId = param(req.params.userProfileId);
    const submission = await storage.getKycSubmission(userProfileId);
    if (!submission) {
      return res.status(404).json({ error: "KYC submission not found" });
    }

    // Determine what documents are still needed based on country requirements
    const country = ((submission as any).country || '').toUpperCase();
    const requirements = getKycRequirements(country);
    const missingDocuments: string[] = [];

    if (requirements.requiresDocument && !(submission as any).idFrontUrl) {
      missingDocuments.push('ID document photo (front)');
    }
    if (requirements.requiresProofOfAddress && !(submission as any).proofOfAddressUrl) {
      missingDocuments.push('Proof of address document');
    }
    if ((submission as any).isBusinessAccount && !(submission as any).businessDocumentUrl) {
      missingDocuments.push('Business registration document');
    }
    if (requirements.additionalDocs) {
      for (const doc of requirements.additionalDocs) {
        missingDocuments.push(doc);
      }
    }

    res.json({
      ...submission,
      countryRequirements: requirements,
      missingDocuments: missingDocuments.length > 0 ? missingDocuments : [],
      isComplete: missingDocuments.length === 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch KYC submission" });
  }
});

// KYC submission validation schema
// Helper to coerce falsy values to undefined for optional string fields
const optionalString = z.preprocess(
  (val) => (val === false || val === '' || val === null || val === undefined) ? undefined : String(val),
  z.string().optional()
);

// Helper to coerce any value to string for required string fields
const requiredString = (fieldName: string) => z.preprocess(
  (val) => {
    if (val === false || val === null || val === undefined || val === '') return '';
    return String(val);
  },
  z.string().min(1, `${fieldName} is required`)
);

const kycSubmissionSchema = z.object({
  cognitoSub: requiredString("Cognito Sub"),
  email: requiredString("Email"),
  firstName: requiredString("First name"),
  lastName: requiredString("Last name"),
  middleName: optionalString,
  dateOfBirth: requiredString("Date of birth"),
  gender: optionalString,
  nationality: requiredString("Nationality"),
  phoneNumber: requiredString("Phone number"),
  alternatePhone: optionalString,
  addressLine1: requiredString("Address"),
  addressLine2: optionalString,
  city: requiredString("City"),
  state: requiredString("State"),
  country: requiredString("Country"),
  postalCode: requiredString("Postal code"),
  idType: requiredString("ID type"),
  idNumber: requiredString("ID number"),
  idExpiryDate: optionalString,
  idFrontUrl: optionalString,
  idBackUrl: optionalString,
  selfieUrl: optionalString,
  proofOfAddressUrl: optionalString,
  isBusinessAccount: z.union([z.boolean(), z.string()]).optional().default(false).transform(v => v === true || v === 'true'),
  businessName: optionalString,
  businessType: optionalString,
  businessRegistrationNumber: optionalString,
  businessAddress: optionalString,
  businessDocumentUrl: optionalString,
  // Frontend form fields that may be passed
  acceptTerms: z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === 'true'),
  accountType: optionalString,
  bvnNumber: optionalString,
});

// Submit KYC (also aliased as /kyc/submit)
const handleKycSubmission = async (req: any, res: any) => {
  try {
    const parseResult = kycSubmissionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      const errorPath = firstError?.path?.join('.') || 'unknown';
      const errorMessage = firstError?.message || "Invalid request data";
      console.error('KYC validation error:', { path: errorPath, message: errorMessage, received: (firstError as any)?.received });
      return res.status(400).json({ error: `${errorMessage} (field: ${errorPath})` });
    }

    const data = parseResult.data;

    // SECURITY: Always use cognitoSub from authenticated token, never from client
    const cognitoSub = (req as any).user?.cognitoSub;
    if (!cognitoSub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Prevent duplicate submissions — check for existing active KYC
    const existingProfile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (existingProfile) {
      const existingKyc = await storage.getKycSubmission(existingProfile.id);
      if (existingKyc) {
        if (existingKyc.status === 'approved') {
          return res.status(409).json({ error: 'Your identity is already verified. No resubmission needed.' });
        }
        if (existingKyc.status === 'pending_review') {
          return res.status(409).json({ error: 'You already have a verification in review. Please wait for the result before resubmitting.' });
        }
        // If rejected or other status, allow resubmission — we'll update the existing record
      }
    }

    // SERVER-SIDE VALIDATION: ID type, expiry, age
    const VALID_ID_TYPES_BY_COUNTRY: Record<string, string[]> = {
      NG: ['BVN', 'NIN', 'VOTERS_CARD', 'DRIVERS_LICENSE', 'INTERNATIONAL_PASSPORT'],
      GH: ['GHANA_CARD', 'VOTERS_ID', 'DRIVERS_LICENSE', 'PASSPORT'],
      ZA: ['SOUTH_AFRICAN_ID', 'PASSPORT', 'DRIVERS_LICENSE'],
      KE: ['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE'],
      US: ['SSN', 'DRIVERS_LICENSE', 'PASSPORT', 'STATE_ID'],
      GB: ['PASSPORT', 'DRIVERS_LICENSE'],
      CA: ['PASSPORT', 'DRIVERS_LICENSE'],
      AU: ['PASSPORT', 'DRIVERS_LICENSE'],
    };
    const upperCountry = data.country?.toUpperCase();
    const validTypes = VALID_ID_TYPES_BY_COUNTRY[upperCountry];
    if (validTypes && !validTypes.includes(data.idType.toUpperCase())) {
      return res.status(400).json({ error: `Invalid ID type '${data.idType}' for ${upperCountry}. Valid: ${validTypes.join(', ')}` });
    }

    if (data.idExpiryDate) {
      const expiryDate = new Date(data.idExpiryDate);
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({ error: 'Invalid ID expiry date format' });
      }
      if (expiryDate < new Date()) {
        return res.status(400).json({ error: 'ID document has expired. Please provide a valid, non-expired ID.' });
      }
    }

    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({ error: 'Invalid date of birth format' });
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      return res.status(400).json({ error: 'You must be at least 18 years old.' });
    }
    if (age > 120) {
      return res.status(400).json({ error: 'Invalid date of birth.' });
    }

    // Get user profile by cognitoSub to get the profile ID, or create if not exists
    let userProfile = await storage.getUserProfileByCognitoSub(cognitoSub);
    if (!userProfile) {
      // Auto-create user profile from KYC submission data
      const now = new Date().toISOString();
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const fullAddress = [data.addressLine1, data.addressLine2, data.city, data.state, data.postalCode, data.country]
        .filter(Boolean)
        .join(', ');

      userProfile = await storage.createUserProfile({
        cognitoSub: cognitoSub,
        email: data.email,
        displayName: fullName,
        phoneNumber: data.phoneNumber,
        address: fullAddress,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        createdAt: now,
        updatedAt: now,
        kycStatus: 'pending',
        onboardingCompleted: false,
        onboardingStep: 5,
      });
    }

    const now = new Date().toISOString();

    // Validate ID format based on country
    const idFormatCheck = validateIdFormat(data.country?.toUpperCase() || '', data.idNumber);
    if (!idFormatCheck.valid) {
      return res.status(400).json({ error: idFormatCheck.error });
    }

    // Also validate BVN format if provided separately
    if (data.bvnNumber && data.country?.toUpperCase() === 'NG') {
      const bvnFormatCheck = validateIdFormat('NG', data.bvnNumber);
      if (!bvnFormatCheck.valid) {
        return res.status(400).json({ error: `BVN: ${bvnFormatCheck.error}` });
      }
    }

    // Check country-specific document requirements
    const countryReqs = getKycRequirements(data.country?.toUpperCase() || '');
    const missingDocs: string[] = [];
    if (countryReqs.requiresDocument && !data.idFrontUrl) {
      missingDocs.push('ID document photo (front)');
    }
    if (countryReqs.requiresProofOfAddress && !data.proofOfAddressUrl) {
      missingDocs.push('Proof of address document');
    }
    if (countryReqs.additionalDocs) {
      // Additional docs are noted but not blocking at this stage — flagged in response
    }
    // Note: missingDocs are included in response but don't block submission
    // This allows partial submissions that can be completed later

    // SECURITY: Server-side verification — NEVER trust client-sent flags
    let isAutoApproved = false;
    let kycBvnVerification: BvnVerificationResult | null = null;

    // For Nigerian users with BVN, verify server-side via Paystack with confidence scoring
    if (data.bvnNumber && data.country?.toUpperCase() === 'NG') {
      try {
        const bvnResult = await paystackClient.resolveBVN(data.bvnNumber);
        if (bvnResult && bvnResult.status && bvnResult.data) {
          kycBvnVerification = verifyBvnMatch(bvnResult.data, {
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
          });

          if (kycBvnVerification.confidence === 'high') {
            isAutoApproved = true;
          } else if (kycBvnVerification.confidence === 'medium') {
            paymentLogger.warn('bvn_medium_confidence', {
              bvn: `***${data.bvnNumber.slice(-4)}`,
              confidence: kycBvnVerification.confidence,
              details: kycBvnVerification.details,
            });
          } else {
            paymentLogger.warn('bvn_low_confidence', {
              bvn: `***${data.bvnNumber.slice(-4)}`,
              confidence: kycBvnVerification.confidence,
              details: kycBvnVerification.details,
            });
          }
        }
      } catch (bvnErr) {
        paymentLogger.warn('bvn_verification_failed', { error: (bvnErr as Error).message });
        // Fall through to pending_review — safe default
      }
    }

    // For Stripe-supported countries, check if there's a completed Stripe Identity session
    const STRIPE_COUNTRIES = ['US', 'GB', 'CA', 'DE', 'FR', 'AU', 'NL', 'IE', 'AT', 'BE', 'ES', 'IT', 'PT', 'FI', 'SE', 'DK', 'NO', 'NZ', 'SG', 'JP'];
    if (!isAutoApproved && STRIPE_COUNTRIES.includes(data.country?.toUpperCase())) {
      try {
        // Check if user has a verified Stripe Identity session
        const kycRecord = await storage.getKycSubmission(userProfile.id);
        // If there's an existing approved session, trust it
        const hasVerifiedSession = kycRecord && (kycRecord as any).status === 'approved' && (kycRecord as any).reviewedBy === 'stripe_identity';
        if (hasVerifiedSession) {
          isAutoApproved = true;
        }
      } catch (stripeErr) {
        paymentLogger.warn('stripe_verification_check_failed', { error: (stripeErr as Error).message });
      }
    }

    const kycStatus = isAutoApproved ? 'approved' : 'pending_review';

    const kycData = {
      userProfileId: userProfile.id,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || null,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender || null,
      nationality: data.nationality,
      phoneNumber: data.phoneNumber,
      alternatePhone: data.alternatePhone || null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      city: data.city,
      state: data.state,
      country: data.country,
      postalCode: data.postalCode,
      idType: data.idType,
      idNumber: data.idNumber,
      idExpiryDate: data.idExpiryDate || null,
      idFrontUrl: data.idFrontUrl || null,
      idBackUrl: data.idBackUrl || null,
      selfieUrl: data.selfieUrl || null,
      proofOfAddressUrl: data.proofOfAddressUrl || null,
      isBusinessAccount: data.isBusinessAccount,
      businessName: data.businessName || null,
      businessType: data.businessType || null,
      businessRegistrationNumber: data.businessRegistrationNumber || null,
      businessAddress: data.businessAddress || null,
      businessDocumentUrl: data.businessDocumentUrl || null,
      status: kycStatus,
      reviewNotes: kycBvnVerification
        ? `BVN confidence: ${kycBvnVerification.confidence} — ${kycBvnVerification.details}`
        : (isAutoApproved ? 'Auto-approved via server-side provider verification' : null),
      reviewedBy: isAutoApproved ? (kycBvnVerification ? 'system_bvn' : 'system') : null,
      reviewedAt: isAutoApproved ? now : null,
      submittedAt: now,
      updatedAt: now,
    };

    // If there's a rejected submission, update it instead of creating a new one
    const existingKyc = await storage.getKycSubmission(userProfile.id);
    let submission;
    if (existingKyc && existingKyc.status === 'rejected') {
      submission = await storage.updateKycSubmission(existingKyc.id, kycData);
    } else {
      submission = await storage.createKycSubmission({
        ...kycData,
        createdAt: now,
      });
    }

    // Update user profile KYC status using cognitoSub
    await storage.updateUserProfile(cognitoSub, {
      kycStatus: kycStatus,
      onboardingCompleted: true,
      onboardingStep: 5,
    });

    // Auto-create company if user doesn't have one yet
    const existingCompanies = await storage.getUserCompanies(cognitoSub);
    if (existingCompanies.length === 0) {
      try {
        const companyName = data.isBusinessAccount && data.businessName
          ? data.businessName
          : `${data.firstName}'s Company`;
        let slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `company-${Date.now()}`;
        const existingSlug = await storage.getCompanyBySlug(slug);
        if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`;

        const country = (data.country || 'US').toUpperCase();
        const currencyConfig = getCurrencyForCountry(country);
        const isAfrican = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI', 'TZ', 'UG'].includes(country);

        const newCompany = await storage.createCompany({
          name: companyName,
          slug,
          ownerId: cognitoSub,
          industry: data.businessType || null,
          country,
          currency: currencyConfig.currency,
          status: 'active',
          email: data.email,
          phone: data.phoneNumber || null,
          address: data.addressLine1 || null,
          city: data.city || null,
          state: data.state || null,
          postalCode: data.postalCode || null,
          countryCode: country,
          region: isAfrican ? 'Africa' : 'North America',
          paymentProvider: isAfrican ? 'paystack' : 'stripe',
        });

        await storage.createCompanyMember({
          companyId: newCompany.id,
          userId: cognitoSub,
          email: data.email,
          role: 'OWNER',
          status: 'active',
          invitedAt: now,
          joinedAt: now,
        });

        // Link user profile to company
        await storage.updateUserProfile(cognitoSub, {
          companyId: newCompany.id,
        });

        // Create wallet for this company
        const existingWallet = await storage.getWalletByUserId(cognitoSub);
        if (!existingWallet) {
          await storage.createWallet({
            userId: cognitoSub,
            companyId: newCompany.id,
            currency: currencyConfig.currency,
            type: 'business',
            balance: '0',
            availableBalance: '0',
            pendingBalance: '0',
            status: 'active',
          });
        }

        console.log(`Auto-created company '${companyName}' (${newCompany.id}) for user ${cognitoSub}`);
      } catch (companyErr: any) {
        console.error('Auto-create company failed (non-blocking):', companyErr.message);
      }
    }

    // Auto-create virtual account ONLY if KYC is approved/auto-verified
    // If KYC is pending_review, virtual account creation is deferred until approval
    const DVA_SUPPORTED_COUNTRIES = ['NG', 'GH', 'US', 'GB', 'CA', 'DE', 'FR', 'AU', 'NL', 'IE', 'AT', 'BE', 'ES', 'IT', 'PT', 'FI', 'SE', 'DK', 'NO', 'NZ', 'SG', 'JP'];
    let virtualAccount: any = null;
    const kycPendingVirtualAccount = !isAutoApproved && DVA_SUPPORTED_COUNTRIES.includes(data.country?.toUpperCase());
    if (kycPendingVirtualAccount) {
      console.log(`Virtual account creation deferred — KYC pending review for user ${cognitoSub} (${data.country})`);
    }
    if (isAutoApproved && DVA_SUPPORTED_COUNTRIES.includes(data.country?.toUpperCase())) {
      try {
        // Check if user already has a virtual account
        const existingAccounts = await storage.getVirtualAccounts();
        const userAccount = existingAccounts.find((a: any) => a.userId === cognitoSub);

        if (!userAccount) {
          // Create virtual account via payment provider
          const result = await paymentService.createVirtualAccount(
            userProfile.email,
            data.firstName,
            data.lastName,
            data.country
          );

          // Store in database
          virtualAccount = await storage.createVirtualAccount({
            userId: cognitoSub,
            name: result.accountName || `${data.firstName} ${data.lastName}`,
            accountNumber: result.accountNumber || '',
            bankName: result.bankName || 'Financiar',
            bankCode: result.bankCode || 'FINANCIAR',
            routingNumber: null,
            swiftCode: null,
            country: data.country || 'US',
            currency: getCurrencyForCountry(data.country).currency,
            balance: '0',
            type: 'personal',
            status: 'active',
            createdAt: new Date().toISOString(),
            provider: 'system',
            accountName: null,
            providerAccountId: null,
            providerCustomerCode: null,
            companyId: null,
          });

          // Create wallet for this user if not exists
          const existingWallet = await storage.getWalletByUserId(cognitoSub);
          if (!existingWallet) {
            await storage.createWallet({
              userId: cognitoSub,
              currency: getCurrencyForCountry(data.country).currency,
              type: 'personal',
              balance: '0',
              availableBalance: '0',
              pendingBalance: '0',
              status: 'active',
              virtualAccountId: virtualAccount.id,
            });
          }
        } else {
          virtualAccount = userAccount;
        }
      } catch (vaError: any) {
        console.error('Failed to create virtual account:', vaError.message);
        // Don't fail the KYC submission if virtual account creation fails
      }
    }

    res.status(201).json({
      ...submission,
      virtualAccount,
      autoApproved: isAutoApproved,
      kycPendingVirtualAccount,
      bvnVerification: kycBvnVerification ? {
        confidence: kycBvnVerification.confidence,
        nameMatch: kycBvnVerification.nameMatch,
        phoneMatch: kycBvnVerification.phoneMatch,
      } : undefined,
      missingDocuments: missingDocs.length > 0 ? missingDocs : undefined,
      countryRequirements: countryReqs,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit KYC" });
  }
};

router.post("/kyc", sensitiveLimiter, requireAuth, handleKycSubmission);
router.post("/kyc/submit", sensitiveLimiter, requireAuth, handleKycSubmission);

// Update KYC submission
router.patch("/kyc/:id", requireAuth, async (req, res) => {
  try {
    const id = param(req.params.id);
    const cognitoSub = (req as any).user?.cognitoSub;

    // Verify ownership - fetch existing submission first
    const existing = await storage.getKycSubmission(id);
    if (!existing) {
      return res.status(404).json({ error: "KYC submission not found" });
    }

    // Only allow owner to update their own KYC, or admin
    const userProfile = await storage.getUserProfileByCognitoSub(cognitoSub);
    const isOwner = userProfile && existing.userProfileId === userProfile.id;
    const isAdmin = (req as any).user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to update this KYC submission" });
    }

    // Only allow certain fields to be updated by regular users
    const allowedUserFields = ['firstName', 'lastName', 'middleName', 'dateOfBirth', 'gender',
      'nationality', 'phoneNumber', 'alternatePhone', 'addressLine1', 'addressLine2',
      'city', 'state', 'country', 'postalCode', 'idType', 'idNumber', 'idExpiryDate',
      'idFrontUrl', 'idBackUrl', 'selfieUrl', 'proofOfAddressUrl',
      'businessName', 'businessType', 'businessRegistrationNumber', 'businessAddress', 'businessDocumentUrl'];

    const adminOnlyFields = ['status', 'reviewedBy', 'reviewedAt', 'reviewNotes'];

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (isAdmin && adminOnlyFields.includes(key)) {
        updateData[key] = value;
      } else if (allowedUserFields.includes(key)) {
        updateData[key] = value;
      }
      // Silently ignore disallowed fields
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const submission = await storage.updateKycSubmission(id, updateData);
    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update KYC submission" });
  }
});

// Upload KYC document with multer error handling
router.post("/kyc/upload", requireAuth, (req, res) => {
  upload.single('document')(req, res, (err: any) => {
    if (err) {
      const message = err.message || "Failed to upload document";
      if (message.includes("Invalid file type")) {
        return res.status(400).json({ error: message });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "File size exceeds 5MB limit" });
      }
      return res.status(400).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate magic bytes to prevent MIME spoofing
    if (!validateUploadedFile(req.file.path, req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid file content. Only JPEG, PNG, and PDF files are allowed." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  });
});

// ==================== STRIPE IDENTITY KYC ====================

// Create Stripe Identity verification session
router.post("/kyc/stripe/create-session", requireAuth, async (req, res) => {
  try {
    const { userId, email, returnUrl } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    const stripe = getStripeClient();

    // Create Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        userId,
        email,
      },
      options: {
        document: {
          allowed_types: ['passport', 'driving_license', 'id_card'],
          require_id_number: true,
          require_matching_selfie: true,
        },
      },
      return_url: returnUrl || `${req.protocol}://${req.get('host')}/onboarding?step=verification`,
    });

    res.json({
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret,
      url: verificationSession.url,
      status: verificationSession.status,
    });
  } catch (error: any) {
    console.error('Stripe Identity error:', error);
    res.status(500).json({ error: error.message || "Failed to create verification session" });
  }
});

// Check Stripe Identity verification status
router.get("/kyc/stripe/status/:sessionId", requireAuth, async (req, res) => {
  try {
    const sessionId = param(req.params.sessionId);

    const stripe = getStripeClient();

    const verificationSession = await (stripe as any).identity.verificationSessions.retrieve(sessionId);

    res.json({
      id: verificationSession.id,
      status: verificationSession.status,
      lastError: verificationSession.last_error,
      verifiedOutputs: verificationSession.verified_outputs,
    });
  } catch (error: any) {
    console.error('Stripe Identity status error:', error);
    res.status(500).json({ error: error.message || "Failed to get verification status" });
  }
});

// Stripe Identity webhook handler
router.post("/kyc/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripe = getStripeClient();

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.log('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle verification events
    if (event.type === 'identity.verification_session.verified') {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      if (userId) {
        // Update KYC status to approved
        await storage.updateUserProfile(userId, {
          kycStatus: 'approved',
          updatedAt: new Date().toISOString(),
        });
      }
    } else if (event.type === 'identity.verification_session.requires_input') {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      if (userId) {
        await storage.updateUserProfile(userId, {
          kycStatus: 'pending_review',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Stripe Identity webhook error:', error);
    res.status(500).json({ error: error.message || "Webhook processing failed" });
  }
});

// ==================== PAYSTACK KYC (BVN VERIFICATION) ====================

// Resolve BVN (Bank Verification Number) - Nigeria
router.post("/kyc/paystack/resolve-bvn", requireAuth, async (req, res) => {
  try {
    const { bvn, accountNumber, bankCode, firstName, lastName } = req.body;
    if (!bvn) {
      return res.status(400).json({ error: "BVN is required" });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    // Resolve BVN
    const response = await fetch(`https://api.paystack.co/bvn/match`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bvn,
        account_number: accountNumber,
        bank_code: bankCode,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    const data = await response.json();

    if (data.status) {
      res.json({
        success: true,
        verified: data.data?.is_blacklisted === false,
        data: {
          firstName: data.data?.first_name,
          lastName: data.data?.last_name,
          dateOfBirth: data.data?.dob,
          mobile: data.data?.mobile,
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.message || "BVN verification failed"
      });
    }
  } catch (error: any) {
    console.error('Paystack BVN error:', error);
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Validate account with Paystack
router.post("/kyc/paystack/validate-account", requireAuth, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: "Account number and bank code are required" });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const data = await response.json();

    if (data.status) {
      res.json({
        success: true,
        accountName: data.data?.account_name,
        accountNumber: data.data?.account_number,
        bankId: data.data?.bank_id,
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.message || "Account validation failed"
      });
    }
  } catch (error: any) {
    console.error('Paystack account validation error:', error);
    const mapped = mapPaymentError(error, 'payment');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

// Get list of banks (for BVN verification)
router.get("/kyc/paystack/banks", async (req, res) => {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    const response = await fetch('https://api.paystack.co/bank', {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const data = await response.json();

    if (data.status) {
      res.json({
        success: true,
        banks: data.data?.map((bank: any) => ({
          id: bank.id,
          name: bank.name,
          code: bank.code,
          slug: bank.slug,
          country: bank.country,
        })),
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.message || "Failed to fetch banks from provider"
      });
    }
  } catch (error: any) {
    const mapped = mapPaymentError(error, 'paystack-banks');
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
