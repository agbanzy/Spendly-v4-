import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, signUp, signOut, resetPassword as firebaseResetPassword } from './firebase';
import { api } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserProfile(user: User) {
  try {
    await api.post('/api/user-profile', {
      firebaseUid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoURL,
    });
  } catch {
    // Profile sync is best-effort; don't block auth flow
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const firebaseUser = await signIn(email, password);
    await syncUserProfile(firebaseUser);
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const firebaseUser = await signUp(email, password, fullName);
    await syncUserProfile(firebaseUser);
  };

  const logout = async () => {
    await signOut();
  };

  const resetPassword = async (email: string) => {
    await firebaseResetPassword(email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, resetPassword }}>
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
