import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { 
  auth, 
  signInWithEmail, 
  signUpWithEmail, 
  signInWithGoogle, 
  logOut, 
  onAuthChange,
  type User as FirebaseUser 
} from "./firebase";
import { apiRequest } from "./queryClient";

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
  loginWithGoogle: () => Promise<void>;
  signup: (name: string, email: string, password: string, extra?: { phoneNumber?: string; country?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapFirebaseUser(firebaseUser: FirebaseUser, serverRole?: string): User {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
    email: firebaseUser.email || "",
    role: serverRole || "",
    photoURL: firebaseUser.photoURL || undefined
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser(mapFirebaseUser(firebaseUser));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const ensureUserProfile = async (firebaseUser: FirebaseUser, extra?: { phoneNumber?: string; country?: string }): Promise<string | undefined> => {
    try {
      const res = await apiRequest("POST", "/api/user-profile", {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0],
        photoUrl: firebaseUser.photoURL || null,
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
    const userCredential = await signInWithEmail(email, password);
    const serverRole = await ensureUserProfile(userCredential.user);
    setUser(mapFirebaseUser(userCredential.user, serverRole));
  };

  const loginWithGoogle = async () => {
    const userCredential = await signInWithGoogle();
    const serverRole = await ensureUserProfile(userCredential.user);
    setUser(mapFirebaseUser(userCredential.user, serverRole));
  };

  const signup = async (name: string, email: string, password: string, extra?: { phoneNumber?: string; country?: string }) => {
    const userCredential = await signUpWithEmail(email, password, name);
    const serverRole = await ensureUserProfile(userCredential.user, extra);
    setUser(mapFirebaseUser(userCredential.user, serverRole));
  };

  const logout = async () => {
    await logOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
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
