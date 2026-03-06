import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COGNITO_USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;

if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
  console.error(
    'Missing Cognito configuration. EXPO_PUBLIC_COGNITO_USER_POOL_ID and EXPO_PUBLIC_COGNITO_CLIENT_ID must be set.',
    { UserPoolId: COGNITO_USER_POOL_ID, ClientId: COGNITO_CLIENT_ID }
  );
}

const poolData = {
  UserPoolId: COGNITO_USER_POOL_ID || 'MISSING_USER_POOL_ID',
  ClientId: COGNITO_CLIENT_ID || 'MISSING_CLIENT_ID',
  Storage: {
    // Use AsyncStorage as the backing store for Cognito tokens
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
    getItem: (key: string) => AsyncStorage.getItem(key),
    removeItem: (key: string) => AsyncStorage.removeItem(key),
    clear: () => AsyncStorage.clear(),
  },
};

const userPool = new CognitoUserPool(poolData as any);

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
}

export function getUserInfoFromSession(session: CognitoUserSession): CognitoUserInfo {
  const payload = session.getIdToken().decodePayload();
  return {
    sub: payload.sub,
    email: payload.email || '',
    name: payload.name || payload['cognito:username'] || payload.email?.split('@')[0] || 'User',
  };
}

// --- Sign In ---

export function signInWithEmail(email: string, password: string): Promise<CognitoUserSession> {
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
    user.signOut();
  }
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
      if (error?.message?.includes('network') || error?.message?.includes('Network') || error?.message?.includes('fetch')) {
        return 'Network error. Please check your internet connection.';
      }
      return error?.message || 'An unexpected error occurred. Please try again.';
  }
}
