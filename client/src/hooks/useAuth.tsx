import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { nmcApi, getStoredAuth, setStoredAuth, clearStoredAuth } from '@/services/nmcApi';

export type UserRole = 'admin' | 'reviewer' | null;

interface AuthContextType {
  role: UserRole;
  token: string | null;
  reviewerKey: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Strictly true only for 'reviewer' role. Used to gate decision submission. */
  isReviewer: boolean;
  /** True for both admin and reviewer — gates read access to review queue, CMM, audit, analytics, materials. */
  canViewReviewQueue: boolean;
  /** True only for reviewer — can submit Accept/Reject/Different/Override decisions. */
  canSubmitDecisions: boolean;
  isLoading: boolean;
  loginAdmin: (password: string) => Promise<void>;
  loginReviewer: (reviewerKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reviewerKey, setReviewerKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      const stored = getStoredAuth();
      if (stored.token && stored.role) {
        try {
          const res = await nmcApi.auth.verifyToken(stored.token);
          if (res.valid) {
            setToken(stored.token);
            setRole(res.role as UserRole);
            setReviewerKey(stored.reviewerKey || null);
          } else {
            clearStoredAuth();
          }
        } catch {
          // Token expired or invalid — clear and require re-login
          clearStoredAuth();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loginAdmin = async (password: string) => {
    const res = await nmcApi.auth.adminLogin(password);
    setStoredAuth(res.token, 'admin');
    setToken(res.token);
    setRole('admin');
  };

  const loginReviewer = async (key: string) => {
    const res = await nmcApi.auth.reviewerLogin(key);
    setStoredAuth(res.token, 'reviewer', key);
    setToken(res.token);
    setRole('reviewer');
    setReviewerKey(key);
  };

  const logout = () => {
    clearStoredAuth();
    setRole(null);
    setToken(null);
    setReviewerKey(null);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        token,
        reviewerKey,
        isAuthenticated: !!token && !!role,
        isAdmin: role === 'admin',
        // isReviewer is STRICTLY reviewer — used to gate decision submission UI
        isReviewer: role === 'reviewer',
        // canViewReviewQueue: ONLY reviewer can access review queue (admin must use reviewer key)
        canViewReviewQueue: role === 'reviewer',
        // canSubmitDecisions: ONLY reviewer can Accept/Reject/Different/Override
        canSubmitDecisions: role === 'reviewer',
        isLoading,
        loginAdmin,
        loginReviewer,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
