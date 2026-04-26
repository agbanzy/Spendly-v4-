import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};

export const isCognitoConfigured = !!(poolData.UserPoolId && poolData.ClientId);

let userPool: CognitoUserPool;
try {
  if (!isCognitoConfigured) {
    console.error('Cognito environment variables missing (VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID). Auth will not work.');
  }
  userPool = new CognitoUserPool(poolData);
} catch (e) {
  console.error('Failed to initialize CognitoUserPool:', e);
  userPool = null as any;
}

// --- Session & Token Management ---

export function getCurrentUser(): CognitoUser | null {
  return userPool.getCurrentUser();
}

export function getSession(): Promise<CognitoUserSession | null> {
  const user = getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) return reject(err);
      resolve(session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  try {
    const session = await getSession();
    if (session && session.isValid()) {
      return session.getIdToken().getJwtToken();
    }
    return null;
  } catch {
    return null;
  }
}

// --- User Info from Token ---

export interface CognitoUserInfo {
  sub: string;
  email: string;
  name: string;
  photoURL?: string;
}

export function getUserInfoFromSession(session: CognitoUserSession): CognitoUserInfo {
  const payload = session.getIdToken().decodePayload();
  return {
    sub: payload.sub,
    email: payload.email || '',
    name: payload.name || payload['cognito:username'] || payload.email?.split('@')[0] || 'User',
    photoURL: payload.picture || undefined,
  };
}

// --- Sign In ---

function assertConfigured() {
  if (!isCognitoConfigured || !userPool) {
    throw new Error('Authentication service is not configured. Please contact support.');
  }
}

export function signInWithEmail(email: string, password: string): Promise<CognitoUserSession> {
  assertConfigured();
  const user = new CognitoUser({ Username: email, Pool: userPool });
  const authDetails = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => {
        reject(new Error('NewPasswordRequired'));
      },
    });
  });
}

// --- Sign Up ---

export function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<CognitoUser> {
  assertConfigured();
  const attributes = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: displayName }),
  ];
  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributes, [], (err, result) => {
      if (err) return reject(err);
      resolve(result!.user);
    });
  });
}

// --- Confirm Sign Up (verification code) ---

export function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// --- Resend Confirmation Code ---

export function resendConfirmationCode(email: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.resendConfirmationCode((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// --- Forgot Password ---

export function forgotPassword(email: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

// --- Sign Out ---

export function signOut(): void {
  const user = getCurrentUser();
  if (user) {
    // Global sign-out: invalidates all tokens server-side via Cognito
    user.globalSignOut({
      onSuccess: () => {},
      onFailure: () => {
        // Fall back to local sign-out if global fails (e.g. network error)
        user.signOut();
      },
    });
  }
  // Clear SMS login token + AUD-FE-002 expiry sentinel
  localStorage.removeItem('sms_id_token');
  localStorage.removeItem('sms_id_token_expires_at');
}

// --- Google OAuth (Cognito Hosted UI redirect) ---

export function signInWithGoogle(): void {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!domain || !clientId) {
    throw new Error('Google sign-in is not configured. Please contact support.');
  }
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
  window.location.href = `https://${domain}/oauth2/authorize?identity_provider=Google&response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid+email+profile`;
}

// --- OAuth Token Exchange (for Hosted UI callback) ---

export interface OAuthTokens {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!domain || !clientId) {
    throw new Error('Authentication service is not configured. Please contact support.');
  }
  const redirectUri = window.location.origin + '/auth/callback';

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`https://${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Token exchange failed: ${errBody}`);
  }

  return res.json();
}

export function storeOAuthSession(tokens: OAuthTokens): CognitoUserInfo {
  // Decode the ID token to get user info
  const [, payloadBase64] = tokens.id_token.split('.');
  const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));

  const userInfo: CognitoUserInfo = {
    sub: payload.sub,
    email: payload.email || '',
    name: payload.name || payload['cognito:username'] || payload.email?.split('@')[0] || 'User',
    photoURL: payload.picture || undefined,
  };

  // Store tokens in localStorage so CognitoUserPool can find the session
  // Cognito JS SDK stores sessions under a specific key pattern
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const username = payload['cognito:username'] || payload.sub;
  const keyPrefix = `CognitoIdentityServiceProvider.${clientId}`;

  localStorage.setItem(`${keyPrefix}.LastAuthUser`, username);
  localStorage.setItem(`${keyPrefix}.${username}.idToken`, tokens.id_token);
  localStorage.setItem(`${keyPrefix}.${username}.accessToken`, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(`${keyPrefix}.${username}.refreshToken`, tokens.refresh_token);
  }
  localStorage.setItem(`${keyPrefix}.${username}.clockDrift`, '0');

  return userInfo;
}

// --- Auth State Check ---

export async function checkAuthState(): Promise<CognitoUserSession | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

// --- Error Message Mapping ---

export function getCognitoErrorMessage(error: any): string {
  const name = error?.name || error?.code || '';
  switch (name) {
    case 'UserNotFoundException':
      return 'No account found with this email address.';
    case 'NotAuthorizedException':
      return 'Invalid email or password.';
    case 'UserNotConfirmedException':
      return 'Please verify your email address before signing in.';
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return 'Too many attempts. Please try again later.';
    case 'InvalidParameterException':
      return 'Invalid input. Please check your details.';
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'InvalidPasswordException':
      return 'Password does not meet requirements. Use at least 8 characters with uppercase, lowercase, and numbers.';
    case 'CodeMismatchException':
      return 'Invalid verification code. Please try again.';
    case 'ExpiredCodeException':
      return 'Verification code has expired. Please request a new one.';
    default:
      return error?.message || 'An unexpected error occurred. Please try again.';
  }
}
