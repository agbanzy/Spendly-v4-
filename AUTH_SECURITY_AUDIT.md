# 🔐 Authentication & Onboarding Security Audit

**Date**: February 4, 2026
**Scope**: Signup, Login, Onboarding, KYC, Session Management
**Status**: ⚠️ **CRITICAL SECURITY ISSUES FOUND**

---

## 📊 Executive Summary

**Total Issues Found**: 12 (4 Critical, 5 High, 3 Medium)
**Security Rating**: 🔴 **VULNERABLE** - Immediate Action Required
**Production Ready**: ❌ **NO** - Must fix critical issues first

### Critical Findings
1. 🔴 No Session Management for Admin Users
2. 🔴 No Authentication Middleware - Endpoints Unprotected
3. 🔴 KYC Auto-Approval Trusts Client Data
4. 🔴 No Rate Limiting - Brute Force Vulnerable

---

## 🚨 CRITICAL SECURITY ISSUES

### 1. **No Session Management for Admin Login** 🔴 CRITICAL
**Severity**: CRITICAL
**File**: `server/routes.ts` (Lines 4726-4775)
**Endpoint**: `POST /api/admin/login`

**Problem**:
```typescript
// Admin login returns user data without creating session or token
res.json({
  success: true,
  user: userWithoutPassword,  // ❌ No token, no session!
});
```

**Client-Side Storage** ([client/src/pages/admin-login.tsx:28](client/src/pages/admin-login.tsx#L28)):
```typescript
localStorage.setItem("adminUser", JSON.stringify(user));
// ❌ Vulnerable to XSS attacks!
// ❌ No token expiration!
// ❌ No secure HttpOnly cookies!
```

**Vulnerabilities**:
- ❌ No JWT or session token issued
- ❌ localStorage vulnerable to XSS attacks
- ❌ No token expiration (stays forever until logout)
- ❌ No session invalidation on password change
- ❌ No concurrent session management
- ❌ Can't revoke access server-side

**Attack Scenarios**:
1. **XSS Attack**: Attacker injects script → steals localStorage → gains admin access
2. **Session Hijacking**: User data never expires, can be copied and reused indefinitely
3. **No Logout Enforcement**: Even after "logout", stolen credentials work forever

**Impact**: 🔴 Complete admin account takeover possible

**Fix Required**:
- Implement JWT tokens with expiration
- Use HttpOnly cookies for token storage
- Add refresh token mechanism
- Implement server-side session invalidation

---

### 2. **No Authentication Middleware** 🔴 CRITICAL
**Severity**: CRITICAL
**File**: `server/index.ts`, `server/routes.ts`

**Problem**:
```typescript
// NO authentication middleware in server setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// ❌ No auth middleware!

// Admin endpoints unprotected:
app.get("/api/admin/users", async (req, res) => {
  // ❌ No authentication check!
  const users = await storage.getUsers();
  res.json(users);  // Anyone can access!
});
```

**Unprotected Endpoints Found**:
1. ❌ `GET /api/admin/users` - Lists all admin users (Line 4778)
2. ❌ `PATCH /api/user-profile/:firebaseUid` - Update any user profile (Line 2924)
3. ❌ `GET /api/user-settings/:firebaseUid` - Access any user settings (Line 2938)
4. ❌ `PATCH /api/kyc/:id` - Update any KYC submission (Line 3221)
5. ❌ `POST /api/wallets` - Create wallets for any user (Line 3783)
6. ❌ `POST /api/wallet/payout` - Initiate payouts (Line 2082)

**Attack Scenarios**:
1. **Data Exposure**: Anyone can call `/api/admin/users` and get all admin accounts
2. **Profile Tampering**: Attacker can update any user's profile with their firebaseUid
3. **Unauthorized Payouts**: Anyone can initiate payouts without authentication
4. **KYC Manipulation**: Attackers can approve their own KYC or modify others

**Impact**: 🔴 Complete system compromise, data breach, financial loss

**Fix Required**:
- Create authentication middleware to verify JWT/Firebase token
- Protect ALL authenticated endpoints
- Implement role-based access control (RBAC)

---

### 3. **KYC Auto-Approval Trusts Client Data** 🔴 CRITICAL
**Severity**: CRITICAL
**File**: `server/routes.ts` (Lines 3107-3108)
**Endpoint**: `POST /api/kyc`

**Problem**:
```typescript
// Server trusts client-provided verification flags
const isAutoApproved = data.bvnVerified || data.stripeVerified;  // ❌ Client controls this!
const kycStatus = isAutoApproved ? 'approved' : 'pending_review';

// Auto-creates virtual account based on client flag
if (isAutoApproved) {
  // ❌ Creates virtual account without server-side verification
  virtualAccount = await storage.createVirtualAccount({...});
}
```

**Client Request** ([client/src/pages/onboarding.tsx](client/src/pages/onboarding.tsx)):
```typescript
const response = await fetch('/api/kyc', {
  method: 'POST',
  body: JSON.stringify({
    bvnVerified: true,  // ❌ Attacker sets this to true!
    stripeVerified: true,  // ❌ Instant approval!
    // ... other data
  })
});
```

**Attack Scenario**:
1. Attacker opens browser DevTools
2. Modifies request to set `bvnVerified: true`
3. Submits fake KYC data
4. Gets instantly approved without verification
5. Virtual account created with fake identity
6. Uses account for fraudulent activities

**Impact**: 🔴 Identity fraud, money laundering, regulatory violations

**Fix Required**:
- NEVER trust client-provided verification flags
- Store verification session IDs instead (Stripe session ID, BVN reference)
- Verify these IDs server-side before approving
- Use webhook callbacks for verification status

---

### 4. **No Rate Limiting on Authentication** 🔴 CRITICAL
**Severity**: CRITICAL
**Files**: `server/index.ts`, `server/routes.ts`

**Problem**:
```typescript
// No rate limiting middleware in server setup
// ❌ Unlimited login attempts allowed!

app.post("/api/admin/login", async (req, res) => {
  // Attacker can try millions of passwords
});
```

**Vulnerable Endpoints**:
1. ❌ `POST /api/admin/login` - Brute force admin passwords
2. ❌ `POST /api/auth/track-login` - Spam login tracking
3. ❌ `POST /api/auth/send-verification` - Email bombing
4. ❌ `POST /api/kyc/paystack/resolve-bvn` - BVN enumeration attack
5. ❌ `POST /api/wallet/payout` - Financial endpoint abuse

**Attack Scenarios**:
1. **Brute Force**: Try 1 million passwords against admin account in hours
2. **Credential Stuffing**: Test leaked passwords from other breaches
3. **Email Bombing**: Flood user with verification emails
4. **BVN Enumeration**: Systematically check all BVN numbers
5. **DoS Attack**: Overwhelm server with requests

**Impact**: 🔴 Account compromise, service downtime, data breach

**Fix Required**:
- Implement rate limiting (express-rate-limit)
- Limit login attempts: 5 per 15 minutes per IP
- Add account lockout after failed attempts
- Implement CAPTCHA after 3 failed attempts

---

## ⚠️ HIGH SEVERITY ISSUES

### 5. **Weak Password Policy** 🟠 HIGH
**Severity**: HIGH
**File**: `client/src/pages/signup.tsx` (Line 44-51)

**Problem**:
```typescript
// Minimal password validation
if (formData.password.length < 6) {  // ❌ Only 6 characters!
  setErrors({ password: "Password must be at least 6 characters" });
  return;
}
```

**Current Policy**:
- ❌ Minimum 6 characters (too weak!)
- ❌ No uppercase requirement
- ❌ No lowercase requirement
- ❌ No number requirement
- ❌ No special character requirement
- ❌ No common password check
- ❌ No breach database check

**Weak Passwords Allowed**:
- `123456` ✅ Accepted (most common password!)
- `password` ✅ Accepted
- `qwerty` ✅ Accepted
- `abc123` ✅ Accepted

**Fix Required**:
```typescript
// Recommended policy:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Not in common passwords list
- Check against Have I Been Pwned API
```

---

### 6. **No Password Hashing for Firebase Users** 🟠 HIGH
**Severity**: HIGH
**File**: `server/routes.ts`

**Problem**:
Firebase handles user passwords, but **admin users** in the database use bcrypt (Line 4742).

**Inconsistency**:
- Firebase users: Handled by Firebase (secure) ✅
- Admin users: bcrypt hashing (Line 4742) ✅
- But: Admin user creation endpoint missing! ❌

**Missing Functionality**:
```typescript
// No endpoint found for creating admin users!
// How are admin accounts created?
app.post("/api/admin/create", async (req, res) => {
  // ❌ This endpoint doesn't exist!
});
```

**Issue**: If admin users are created directly in database without hashing, passwords are stored in plaintext!

**Fix Required**:
- Create secure admin user creation endpoint
- Always hash passwords with bcrypt (cost factor: 12)
- Never allow plaintext password storage

---

### 7. **Session Timeout Not Enforced** 🟠 HIGH
**Severity**: HIGH
**File**: `shared/schema.ts` (Line 356)

**Problem**:
```typescript
// Schema has sessionTimeout field
sessionTimeout: integer("session_timeout").default(3600),  // 1 hour

// But it's NEVER enforced anywhere in the code!
// ❌ No middleware checks session expiry
// ❌ No automatic logout
```

**Impact**: Users remain logged in forever, increasing compromise risk

**Fix Required**:
- Implement session timeout checking
- Auto-logout after inactivity
- Refresh tokens for active users

---

### 8. **No CSRF Protection** 🟠 HIGH
**Severity**: HIGH
**Files**: `server/index.ts`, `server/routes.ts`

**Problem**:
```typescript
// No CSRF middleware
// ❌ All POST/PUT/PATCH/DELETE endpoints vulnerable!

app.post("/api/wallet/payout", async (req, res) => {
  // Attacker can trick user into submitting this form
  // User's cookies sent automatically
  // Payout executed without user consent!
});
```

**Attack Scenario**:
1. User logs into Spendly
2. Visits malicious website
3. Site contains hidden form:
   ```html
   <form action="https://spendlymanager.com/api/wallet/payout" method="POST">
     <input name="amount" value="10000">
     <input name="recipientAccount" value="attacker_account">
   </form>
   <script>document.forms[0].submit();</script>
   ```
4. User's session cookies sent automatically
5. Payout executed to attacker's account!

**Fix Required**:
- Implement CSRF tokens (csurf middleware)
- Use SameSite=Strict cookies
- Verify origin header

---

### 9. **Insecure File Upload** 🟠 HIGH
**Severity**: HIGH
**File**: `server/routes.ts` (Lines 3235-3255)
**Endpoint**: `POST /api/kyc/upload`

**Problem**:
```typescript
// File upload validation
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalFilename}`);  // ❌ Trusts original filename!
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {  // ❌ Only checks mimetype header!
      cb(null, true);
    }
  }
});
```

**Vulnerabilities**:
1. ❌ **Filename Injection**: Original filename can contain `../../etc/passwd`
2. ❌ **Mimetype Spoofing**: Attacker renames `malware.exe` to `document.pdf`, changes mimetype header
3. ❌ **No Magic Number Validation**: Doesn't verify actual file content
4. ❌ **No Virus Scanning**: Uploaded files not scanned for malware
5. ❌ **Public Directory**: Files stored in `uploads/` might be publicly accessible

**Attack Scenarios**:
1. **Path Traversal**: Upload file to system directories
2. **Malware Distribution**: Upload virus disguised as PDF
3. **XSS**: Upload HTML file with JavaScript, trick user into opening it
4. **RCE**: Upload PHP/JSP file if directory is executable

**Fix Required**:
- Validate file magic numbers (first bytes)
- Generate random UUIDs for filenames
- Store files outside web root
- Implement virus scanning (ClamAV)
- Serve files through CDN with proper headers

---

## 🟡 MEDIUM SEVERITY ISSUES

### 10. **Email Enumeration Vulnerability** 🟡 MEDIUM
**Severity**: MEDIUM
**File**: `client/src/pages/login.tsx`, `client/src/pages/forgot-password.tsx`

**Problem**:
```typescript
// Different error messages reveal if email exists
if (error.code === 'auth/user-not-found') {
  setError("No account found with this email");  // ❌ Email doesn't exist
} else if (error.code === 'auth/wrong-password') {
  setError("Incorrect password");  // ❌ Email exists!
}
```

**Attack**: Attacker can enumerate valid email addresses
1. Try `attacker@test.com` → "No account found" → Email not registered
2. Try `victim@company.com` → "Incorrect password" → Email IS registered!
3. Build database of valid emails for phishing attacks

**Fix**: Use generic error message:
```typescript
setError("Invalid email or password");  // ✅ Doesn't reveal which is wrong
```

---

### 11. **No Two-Factor Authentication (2FA)** 🟡 MEDIUM
**Severity**: MEDIUM
**File**: `shared/schema.ts` (Lines 356-357)

**Problem**:
```typescript
// Schema supports 2FA
twoFactorEnabled: boolean("two_factor_enabled").default(false),
twoFactorSecret: text("two_factor_secret"),

// But NO implementation found in codebase!
// ❌ No 2FA setup endpoint
// ❌ No 2FA verification during login
// ❌ No backup codes generation
```

**Impact**: Accounts vulnerable to password-only compromise

**Fix Required**:
- Implement TOTP 2FA (Google Authenticator, Authy)
- Add 2FA setup flow
- Verify TOTP code during login
- Generate backup recovery codes

---

### 12. **Transaction PIN Not Implemented** 🟡 MEDIUM
**Severity**: MEDIUM
**File**: `shared/schema.ts` (Lines 364-365)

**Problem**:
```typescript
// Schema supports transaction PIN
transactionPinHash: text("transaction_pin_hash"),
transactionPinEnabled: boolean("transaction_pin_enabled").default(false),

// But NO implementation!
// ❌ Payouts don't require PIN verification
// ❌ Transfers don't require PIN verification
```

**Current Flow**:
```typescript
app.post("/api/wallet/payout", async (req, res) => {
  // ❌ No PIN verification!
  await paymentService.initiateTransfer(...);
});
```

**Impact**: If account is compromised, attacker can immediately transfer all funds

**Fix Required**:
- Implement PIN setup endpoint
- Require PIN for all financial transactions
- Add PIN rate limiting (3 attempts)
- Account lockout after failed attempts

---

## 📋 COMPREHENSIVE ISSUE MATRIX

| # | Issue | Severity | Impact | Likelihood | Fix Difficulty |
|---|-------|----------|--------|------------|----------------|
| 1 | No Session Management | 🔴 Critical | High | High | Hard |
| 2 | No Auth Middleware | 🔴 Critical | Critical | High | Medium |
| 3 | KYC Trusts Client | 🔴 Critical | Critical | Medium | Medium |
| 4 | No Rate Limiting | 🔴 Critical | High | High | Easy |
| 5 | Weak Password Policy | 🟠 High | Medium | High | Easy |
| 6 | Password Hashing Gaps | 🟠 High | High | Low | Medium |
| 7 | No Session Timeout | 🟠 High | Medium | Medium | Easy |
| 8 | No CSRF Protection | 🟠 High | High | Medium | Easy |
| 9 | Insecure File Upload | 🟠 High | High | Medium | Hard |
| 10 | Email Enumeration | 🟡 Medium | Low | High | Easy |
| 11 | No 2FA | 🟡 Medium | High | Medium | Hard |
| 12 | No Transaction PIN | 🟡 Medium | High | Medium | Medium |

---

## ✅ POSITIVE FINDINGS

**What's Working Well**:

1. ✅ **Firebase Authentication**: Properly integrated for user auth
2. ✅ **Zod Validation**: Input validation on most endpoints
3. ✅ **Password Hashing**: Admin passwords use bcrypt
4. ✅ **HTTPS**: Production environment should use SSL
5. ✅ **XSS Prevention**: Email templates sanitized (after our fixes)
6. ✅ **KYC Integration**: Stripe Identity and Paystack BVN properly integrated
7. ✅ **Separation of Concerns**: Admin and user auth separated
8. ✅ **Security Notifications**: Login alerts implemented

---

## 🔧 RECOMMENDED FIXES (Priority Order)

### Phase 1: Critical (Deploy BEFORE Production)

1. **Implement JWT Authentication**
   - Add JWT middleware
   - Issue access & refresh tokens
   - HttpOnly cookies for tokens
   - Estimated time: 2-3 days

2. **Add Authentication Middleware**
   - Protect all authenticated endpoints
   - Role-based access control
   - Estimated time: 1 day

3. **Fix KYC Auto-Approval**
   - Verify session IDs server-side
   - Use webhook callbacks
   - Estimated time: 1 day

4. **Add Rate Limiting**
   - Install express-rate-limit
   - Configure per-endpoint limits
   - Estimated time: 4 hours

### Phase 2: High (First Week of Production)

5. **Strengthen Password Policy**
   - Minimum 8 characters
   - Complexity requirements
   - Common password check
   - Estimated time: 2 hours

6. **Implement Session Timeout**
   - Auto-logout after inactivity
   - Token refresh mechanism
   - Estimated time: 4 hours

7. **Add CSRF Protection**
   - Install csurf middleware
   - Update client to send tokens
   - Estimated time: 4 hours

8. **Secure File Uploads**
   - Magic number validation
   - UUID filenames
   - Virus scanning
   - Estimated time: 1 day

### Phase 3: Medium (First Month)

9. **Fix Email Enumeration**
   - Generic error messages
   - Estimated time: 1 hour

10. **Implement 2FA**
    - TOTP setup flow
    - Verification during login
    - Backup codes
    - Estimated time: 3 days

11. **Add Transaction PIN**
    - PIN setup endpoint
    - Verification for transfers
    - Estimated time: 2 days

---

## 🚫 DO NOT DEPLOY TO PRODUCTION WITHOUT:

- [ ] JWT authentication implemented
- [ ] Authentication middleware protecting endpoints
- [ ] KYC auto-approval fixed (server-side verification)
- [ ] Rate limiting on all auth endpoints
- [ ] Password policy strengthened
- [ ] CSRF protection enabled
- [ ] File upload secured

---

## 📞 Next Steps

1. **Review this audit** with your security team
2. **Prioritize fixes** based on Phase 1-3 above
3. **Implement critical fixes** before production deployment
4. **Security testing** after fixes applied
5. **Penetration testing** by third party
6. **Security training** for development team

---

**Prepared by**: Claude Code Security Audit
**Date**: February 4, 2026
**Next Review**: After fixes applied
