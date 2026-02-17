import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, signUp, signOut, resetPassword as firebaseResetPassword } from './firebase';
import { api } from './api';
import { retrySyncPushTokenIfNeeded } from './notifications';

const MAX_PROFILE_SYNC_RETRIES = 3;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileSyncError: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  retrySyncProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserProfile(user: User, retries = MAX_PROFILE_SYNC_RETRIES): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await api.post('/api/user-profile', {
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
      });
      return true;
    } catch (error) {
      console.warn(`Profile sync attempt ${attempt}/${retries} failed:`, error);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSyncError, setProfileSyncError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // When user is already signed in (app reopen), retry push token sync
      if (firebaseUser) {
        retrySyncPushTokenIfNeeded().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  const retrySyncProfile = useCallback(async () => {
    if (user) {
      const success = await syncUserProfile(user);
      setProfileSyncError(!success);
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    const firebaseUser = await signIn(email, password);
    const synced = await syncUserProfile(firebaseUser);
    setProfileSyncError(!synced);
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const firebaseUser = await signUp(email, password, fullName);
    const synced = await syncUserProfile(firebaseUser);
    setProfileSyncError(!synced);
  };

  const logout = async () => {
    setProfileSyncError(false);
    await signOut();
  };

  const resetPassword = async (email: string) => {
    await firebaseResetPassword(email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, profileSyncError, login, register, logout, resetPassword, retrySyncProfile }}>
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
