# Mobile App Revamp Plan: Payments, KYC, Onboarding & More

## Overview
Full audit and revamp of 6 critical mobile flows: onboarding, KYC, payments/bills, account funding, invites, and field validation. Goal: production-ready, easy-to-use, country-aware.

---

## Phase 1: Post-Signup Onboarding Flow
**Problem**: After signup, user lands directly on Dashboard with no profile setup, no country selection, no KYC prompt. The app doesn't know the user's country or currency.

**New Screen**: `OnboardingScreen.tsx` — 3-step wizard after signup

| Step | Title | Fields |
|------|-------|--------|
| 1 | Your Details | Phone number, Country (picker with 23 countries), Currency (auto-set from country) |
| 2 | Your Company | Company Name (required), Industry dropdown, Team Size |
| 3 | Get Verified | Prompt to start KYC or skip for now |

**Changes**:
- **New file**: `mobile/src/screens/OnboardingScreen.tsx`
- **Edit**: `AppNavigator.tsx` — add onboarding route, show OnboardingScreen when `user` exists but `onboardingComplete` is false
- **Edit**: `auth-context.tsx` — track `onboardingComplete` flag from user profile API response
- **Edit**: `api.ts` — add `PATCH /api/user-profile/:cognitoSub` call for profile completion

---

## Phase 2: Production-Ready KYC Screen
**Problem**: Server has full KYC endpoints but mobile has ZERO KYC UI. Users can't verify from mobile.

**New Screen**: `KYCScreen.tsx` — 4-step multi-page form

| Step | Title | Fields |
|------|-------|--------|
| 1 | Personal Info | First name, Last name, DOB (date picker), Gender, Nationality |
| 2 | Address | Address line 1 & 2, City, State, Country, Postal code |
| 3 | Identity | Country-specific ID type picker, ID number, BVN (Nigeria only), ID front/back photo upload |
| 4 | Review & Submit | Summary of all info, Terms checkbox, Submit button |

**Country-Specific ID Types** (from server routes.ts line 6555):
- NG: BVN, NIN, Voter's Card, Driver's License, Passport
- GH: Ghana Card, Voter's ID, Driver's License, Passport
- KE: National ID, Passport, Driver's License
- ZA: SA ID, Passport, Driver's License
- US/GB/CA/AU: Passport, Driver's License, State ID

**Document Upload**: Use `expo-image-picker` → upload to `POST /api/kyc/upload` → get URL back

**Changes**:
- **New file**: `mobile/src/screens/KYCScreen.tsx`
- **Edit**: `AppNavigator.tsx` — add KYC route in MoreStack
- **Edit**: `DashboardScreen.tsx` — KYC banner tap navigates to KYCScreen
- **Edit**: `SettingsScreen.tsx` — add "Verification Status" row linking to KYCScreen
- **Edit**: `OnboardingScreen.tsx` (step 3) — "Verify Now" button navigates to KYCScreen

---

## Phase 3: Fix Payments — Bills, Country Validation, Funding
**Problem**: Bills screen has hardcoded African providers, no country filtering, no amount validation per country. Wallet funding works but missing withdraw bank code.

### 3a. Bills & Utility Payments
**Fix** providers to be country-aware:

```
Country → Provider mapping:
NG: MTN, Glo, Airtel, 9Mobile (airtime/data), IKEDC/EKEDC (electricity), DSTV/GOtv (cable)
GH: MTN, AirtelTigo, Vodafone (airtime), ECG/GRIDCo (electricity)
KE: Safaricom, Airtel (airtime), KPLC (electricity)
ZA: Vodacom, MTN, Cell C (airtime), Eskom (electricity)
US/GB/CA: Hide utility payments (not supported via Paystack)
```

**Changes**:
- **Edit**: `BillsScreen.tsx` — make `providerOptions` dynamic based on `settings.countryCode`, hide utility actions for non-African countries, validate phone number format per country, add currency formatting per country

### 3b. Wallet Funding
**Fix**: Withdraw mutation sends empty `bankCode`. Need bank picker for Paystack countries.

**Changes**:
- **Edit**: `WalletScreen.tsx` — fetch bank list from `GET /api/kyc/paystack/banks` for African countries, add bank picker to withdraw modal, validate account number format (10 digits for NG), add minimum amount validation

### 3c. Amount Quick-Select
**Fix**: Quick amount buttons show 100/200/500 regardless of currency. Should be contextual.

**Changes**:
- **Edit**: `BillsScreen.tsx` — adjust quick amounts: NGN (100, 200, 500, 1000, 2000, 5000), USD/GBP (5, 10, 25, 50, 100), KES (100, 500, 1000, 5000)

---

## Phase 4: Invites, Field Confirmation, Endpoint Validation

### 4a. Invite Acceptance
**Problem**: No way to accept invites from mobile. Token-based acceptance needs a screen.

**Changes**:
- **New file**: `mobile/src/screens/InviteAcceptScreen.tsx` — shows invite details (company, role, inviter), Accept/Decline buttons
- **Edit**: `AppNavigator.tsx` — add deep link handling for `/invite/:token`
- **Edit**: `SettingsScreen.tsx` — show pending invitations if any

### 4b. Field Validation Consistency
**Problem**: Mobile relies on server-side validation. Forms let you submit bad data then fail.

**Changes**:
- **Edit**: `SignupScreen.tsx` — add inline field validation (red border + error text below input), password strength meter (must match Cognito: 8+ chars, uppercase, lowercase, number)
- **Edit**: All form modals (Bills, Wallet) — add real-time validation, disable submit until valid
- **Edit**: `WalletScreen.tsx` — add minimum/maximum amount validation per country

### 4c. Confirmation Dialogs
**Fix**: Destructive actions need proper confirmation with amount/details.

**Changes**:
- Already mostly done with `Alert.alert` confirmations
- **Edit**: `WalletScreen.tsx` — enhance withdrawal/send confirmation to show fee estimate and total
- **Edit**: `BillsScreen.tsx` — show currency symbol in confirmation

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `mobile/src/screens/OnboardingScreen.tsx` | **CREATE** | 1 |
| `mobile/src/screens/KYCScreen.tsx` | **CREATE** | 2 |
| `mobile/src/screens/InviteAcceptScreen.tsx` | **CREATE** | 4 |
| `mobile/src/navigation/AppNavigator.tsx` | EDIT | 1,2,4 |
| `mobile/src/lib/auth-context.tsx` | EDIT | 1 |
| `mobile/src/screens/DashboardScreen.tsx` | EDIT | 2 |
| `mobile/src/screens/SettingsScreen.tsx` | EDIT | 2,4 |
| `mobile/src/screens/BillsScreen.tsx` | EDIT | 3 |
| `mobile/src/screens/WalletScreen.tsx` | EDIT | 3,4 |
| `mobile/src/screens/SignupScreen.tsx` | EDIT | 4 |

## Execution Order
1. Phase 1 (Onboarding) → Phase 2 (KYC) → Phase 3 (Payments) → Phase 4 (Invites/Validation)
2. Test on iOS simulator after each phase
3. All new screens follow existing dark theme + color system
