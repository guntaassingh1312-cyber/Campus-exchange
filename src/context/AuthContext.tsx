import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  apiFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  type UserProfile,
} from '../lib/api';
import { auth, googleAuthProvider } from '../lib/firebase';

interface RegisterPayload {
  fullName: string;
  studentId: string;
  institutionalEmail: string;
  department: string;
  academicYear: string;
  hostelBlock?: string;
  password: string;
  referralCode?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  loginWithStudentId: (
    studentId: string,
    password: string,
    remember?: boolean
  ) => Promise<UserProfile>;
  registerStudent: (payload: RegisterPayload) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithStudentId = async (
    studentId: string,
    password: string,
    remember = true
  ): Promise<UserProfile> => {
    const data = await apiFetch<{ token: string; user: UserProfile }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ studentId, password }),
      }
    );
    setStoredToken(data.token, remember);
    setUser(data.user);
    return data.user;
  };

  const registerStudent = async (
    payload: RegisterPayload
  ): Promise<UserProfile> => {
    const data = await apiFetch<{ token: string; user: UserProfile }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    setStoredToken(data.token, true);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (): Promise<UserProfile> => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const data = await apiFetch<{ token: string; user: UserProfile }>(
      '/api/auth/firebase',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }
    );
    setStoredToken(data.token, true);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    clearStoredToken();
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase sign-out if signed in with Student ID only
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithStudentId,
        registerStudent,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
