import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  signIn,
  signUp,
  signOut,
  resetPassword as cognitoResetPassword,
  getSession,
  getIdToken,
  getUserInfoFromSession,
  getCognitoErrorMessage,
  hydrateStorage,
  type CognitoUserInfo,
} from './cognito';
import { api } from './api';
import { retrySyncPushTokenIfNeeded } from './notifications';

interface MobileUser {
  sub: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface UserProfile {
  onboardingCompleted: boolean;
  onboardingStep: number;
  country?: string;
  currency?: string;
  kycStatus?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: MobileUser | null;
  loading: boolean;
  profileSyncError: boolean;
  onboardingComplete: boolean;
  userProfile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  retrySyncProfile: () => Promise<void>;
  completeOnboarding: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapCognitoUser(info: CognitoUserInfo): MobileUser {
  return {
    sub: info.sub,
    email: info.email,
    displayName: info.name,
    photoURL: info.photoURL,
  };
}

async function syncUserProfile(userInfo: CognitoUserInfo): Promise<UserProfile | null> {
  try {
    const profile = await api.post<UserProfile>('/api/user-profile', {
      cognitoSub: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      photoUrl: userInfo.photoURL,
    });
    return profile;
  } catch (error: any) {
    console.warn('Profile sync failed:', error?.message || error);
    return null;
  }
}

async function fetchUserProfile(cognitoSub: string): Promise<UserProfile | null> {
  try {
    return await api.get<UserProfile>(`/api/user-profile/${cognitoSub}`);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSyncError, setProfileSyncError] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await hydrateStorage();
        const session = await getSession();
        if (session && session.isValid()) {
          // Store the (potentially refreshed) token in AsyncStorage
          // so apiRequest() can read it for authenticated calls
          await getIdToken();

          const userInfo = getUserInfoFromSession(session);
          const mobileUser = mapCognitoUser(userInfo);
          setUser(mobileUser);

          // Fetch profile to check onboarding status
          const profile = await fetchUserProfile(userInfo.sub);
          if (profile) {
            setUserProfile(profile);
            setOnboardingComplete(!!profile.onboardingCompleted);
          }

          // Retry push token sync on app reopen
          retrySyncPushTokenIfNeeded().catch(() => {});
        }
      } catch {
        // No valid session
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profile = await fetchUserProfile(user.sub);
      if (profile) {
        setUserProfile(profile);
        setOnboardingComplete(!!profile.onboardingCompleted);
      }
    }
  }, [user]);

  const retrySyncProfile = useCallback(async () => {
    if (user) {
      const session = await getSession();
      if (session) {
        const userInfo = getUserInfoFromSession(session);
        const profile = await syncUserProfile(userInfo);
        setProfileSyncError(!profile);
        if (profile) {
          setUserProfile(profile);
          setOnboardingComplete(!!profile.onboardingCompleted);
        }
      }
    }
  }, [user]);

  const completeOnboarding = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const session = await signIn(email, password);
      // Ensure token is stored in AsyncStorage before any API calls
      await getIdToken();
      const userInfo = getUserInfoFromSession(session);
      const profile = await syncUserProfile(userInfo);
      setProfileSyncError(!profile);
      if (profile) {
        setUserProfile(profile);
        setOnboardingComplete(!!profile.onboardingCompleted);
      }
      // Set user LAST — this triggers CompanyProvider and other consumers
      setUser(mapCognitoUser(userInfo));
    } catch (error: any) {
      throw new Error(getCognitoErrorMessage(error));
    }
  };

  const register = async (email: string, password: string, fullName?: string) => {
    try {
      await signUp(email, password, fullName);
      // Auto-confirm Lambda auto-verifies, so sign in immediately
      const session = await signIn(email, password);
      // Ensure token is stored in AsyncStorage before any API calls
      await getIdToken();
      const userInfo = getUserInfoFromSession(session);
      const profile = await syncUserProfile(userInfo);
      setProfileSyncError(!profile);
      if (profile) {
        setUserProfile(profile);
      }
      // New users haven't completed onboarding
      setOnboardingComplete(false);
      // Set user LAST — this triggers CompanyProvider and other consumers
      setUser(mapCognitoUser(userInfo));
    } catch (error: any) {
      throw new Error(getCognitoErrorMessage(error));
    }
  };

  const logout = async () => {
    setProfileSyncError(false);
    setOnboardingComplete(false);
    setUserProfile(null);
    await signOut();
    setUser(null);
  };

  const resetPasswordHandler = async (email: string) => {
    try {
      await cognitoResetPassword(email);
    } catch (error: any) {
      throw new Error(getCognitoErrorMessage(error));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profileSyncError,
      onboardingComplete,
      userProfile,
      login,
      register,
      logout,
      resetPassword: resetPasswordHandler,
      retrySyncProfile,
      completeOnboarding,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
