import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { queryClient } from "./queryClient";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle as cognitoSignInWithGoogle,
  signOut as cognitoSignOut,
  checkAuthState,
  getUserInfoFromSession,
  getCognitoErrorMessage,
  exchangeCodeForTokens,
  storeOAuthSession,
  type CognitoUserInfo,
} from "./cognito";
import { apiRequest } from "./queryClient";
import { clearPinCache } from "./pin-cache";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (idToken: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  handleOAuthCallback: (code: string) => Promise<{ isNewUser: boolean }>;
  signup: (name: string, email: string, password: string, extra?: { phoneNumber?: string; country?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapCognitoUser(userInfo: CognitoUserInfo, serverRole?: string): User {
  return {
    id: userInfo.sub,
    name: userInfo.name,
    email: userInfo.email,
    role: serverRole || "",
    photoURL: userInfo.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // AUD-FE-002: clear SMS-login token if past its 15-minute TTL.
    try {
      const expiresAt = Number(localStorage.getItem('sms_id_token_expires_at') ?? '0');
      if (expiresAt && Date.now() > expiresAt) {
        localStorage.removeItem('sms_id_token');
        localStorage.removeItem('sms_id_token_expires_at');
      }
    } catch {
      // localStorage unavailable — ignore
    }

    // Check for existing Cognito session on mount
    const initAuth = async () => {
      try {
        const session = await checkAuthState();
        if (session && session.isValid()) {
          const userInfo = getUserInfoFromSession(session);
          setUser(mapCognitoUser(userInfo));
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const ensureUserProfile = async (
    userInfo: CognitoUserInfo,
    extra?: { phoneNumber?: string; country?: string }
  ): Promise<string | undefined> => {
    try {
      const res = await apiRequest("POST", "/api/user-profile", {
        cognitoSub: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name,
        photoUrl: userInfo.photoURL || null,
        ...(extra?.phoneNumber ? { phoneNumber: extra.phoneNumber } : {}),
        ...(extra?.country ? { country: extra.country } : {}),
      });
      const serverProfile = await res.json();
      return serverProfile?.role || undefined;
    } catch (error) {
      console.error("Failed to sync user profile:", error);
      return undefined;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const session = await signInWithEmail(email, password);
      const userInfo = getUserInfoFromSession(session);
      const serverRole = await ensureUserProfile(userInfo);
      setUser(mapCognitoUser(userInfo, serverRole));
    } catch (error: any) {
      throw new Error(getCognitoErrorMessage(error));
    }
  };

  const loginWithToken = async (idToken: string) => {
    try {
      // Decode JWT payload (server already verified it)
      const [, payloadBase64] = idToken.split('.');
      const payload = JSON.parse(atob(payloadBase64));
      const userInfo: CognitoUserInfo = {
        sub: payload.sub,
        email: payload.email || payload.phone_number || '',
        name: payload.name || payload['cognito:username'] || payload.email?.split('@')[0] || 'User',
        photoURL: payload.picture || undefined,
      };
      // Store token for API calls.
      // AUD-FE-002: cap the SMS token at 15 minutes so a stale token left on a
      // shared device doesn't extend session life indefinitely. Cognito tokens
      // themselves remain valid per Cognito's TTL; this is a client-side
      // freshness guard for the SMS-OTP-only login path.
      const SMS_TOKEN_TTL_MS = 15 * 60 * 1000;
      localStorage.setItem('sms_id_token', idToken);
      localStorage.setItem('sms_id_token_expires_at', String(Date.now() + SMS_TOKEN_TTL_MS));
      const serverRole = await ensureUserProfile(userInfo);
      setUser(mapCognitoUser(userInfo, serverRole));
    } catch (error: any) {
      throw new Error('Failed to process SMS login token');
    }
  };

  const loginWithGoogle = async () => {
    // Redirect to Cognito Hosted UI — user returns via /auth/callback
    cognitoSignInWithGoogle();
  };

  const handleOAuthCallback = async (code: string): Promise<{ isNewUser: boolean }> => {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = storeOAuthSession(tokens);

    // Sync with server — check if profile already exists
    let isNewUser = false;
    try {
      const res = await fetch(`/api/user-profile/${userInfo.sub}`, {
        headers: { Authorization: `Bearer ${tokens.id_token}` },
        credentials: 'include',
      });
      if (res.status === 404) {
        isNewUser = true;
      }
    } catch {
      isNewUser = true;
    }

    const serverRole = await ensureUserProfile(userInfo);
    setUser(mapCognitoUser(userInfo, serverRole));
    return { isNewUser };
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    extra?: { phoneNumber?: string; country?: string }
  ) => {
    try {
      await signUpWithEmail(email, password, name);
      // Auto-confirm Lambda auto-verifies the user, so sign in immediately
      const session = await signInWithEmail(email, password);
      const userInfo = getUserInfoFromSession(session);
      const serverRole = await ensureUserProfile(userInfo, extra);
      setUser(mapCognitoUser(userInfo, serverRole));
    } catch (error: any) {
      throw new Error(getCognitoErrorMessage(error));
    }
  };

  const logout = async () => {
    clearPinCache();
    cognitoSignOut();
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithToken,
      loginWithGoogle,
      handleOAuthCallback,
      signup,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
