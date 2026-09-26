import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { nmcApi, getStoredAuth, setStoredAuth, clearStoredAuth } from '@/services/nmcApi';

export type UserRole = 'admin' | 'reviewer' | null;

interface AuthContextType {
  role: UserRole;
  token: string | null;
  reviewerKey: string | null;
  reviewerName: string | null;
  reviewerCpse: string | null;
  reviewerId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Strictly true only for 'reviewer' role. Used to gate decision submission. */
  isReviewer: boolean;
  /** True for both admin and reviewer — gates read access to review queue, CMM, audit, analytics, materials. */
  canViewReviewQueue: boolean;
  /** True only for reviewer — can submit routine Gate 1/2 decisions. */
  canSubmitDecisions: boolean;
  /** True only for admin — national executive override authority to arbitrate conflicts. */
  canOverride: boolean;
  isLoading: boolean;
  loginAdmin: (password: string) => Promise<void>;
  loginReviewer: (
    credentials: { reviewerId?: string; password?: string } | string,
    reviewerName?: string,
    reviewerCpse?: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reviewerKey, setReviewerKey] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState<string | null>(null);
  const [reviewerCpse, setReviewerCpse] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
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
            setReviewerName(res.reviewer_name || stored.reviewerName || null);
            setReviewerCpse(res.cpse_code || stored.reviewerCpse || null);
            setReviewerId(res.reviewer_id || stored.reviewerId || null);
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

  const loginReviewer = async (
    credentials: { reviewerId?: string; password?: string } | string,
    name?: string,
    cpse?: string
  ) => {
    const isObj = typeof credentials === 'object';
    const key = isObj ? (credentials.password || '') : credentials;
    const reqPayload = isObj
      ? { reviewer_id: credentials.reviewerId, password: credentials.password }
      : { reviewer_key: credentials };

    const res = await nmcApi.auth.reviewerLogin(reqPayload);
    const finalName = res.reviewer_name || name || 'Rajesh Kumar';
    const finalCpse = res.cpse_code || cpse || 'HPCL';
    const finalId = res.reviewer_id || (isObj ? credentials.reviewerId : undefined) || 'HPCL-REV-001';
    setStoredAuth(res.token, 'reviewer', key, finalName, finalCpse, finalId);
    setToken(res.token);
    setRole('reviewer');
    setReviewerKey(key);
    setReviewerName(finalName);
    setReviewerCpse(finalCpse);
    setReviewerId(finalId);
  };

  const logout = () => {
    clearStoredAuth();
    setRole(null);
    setToken(null);
    setReviewerKey(null);
    setReviewerName(null);
    setReviewerCpse(null);
    setReviewerId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        token,
        reviewerKey,
        reviewerName,
        reviewerCpse,
        reviewerId,
        isAuthenticated: !!token && !!role,
        isAdmin: role === 'admin',
        // isReviewer is STRICTLY reviewer — used to gate decision submission UI
        isReviewer: role === 'reviewer',
        // canViewReviewQueue: both admin and reviewer can view the review queue (admin in read-only mode, reviewer with decision actions)
        canViewReviewQueue: role === 'reviewer' || role === 'admin',
        // canSubmitDecisions: ONLY reviewer can Accept/Reject/Different routine matches
        canSubmitDecisions: role === 'reviewer',
        // canOverride: Admin has national executive override authority for conflict resolution
        canOverride: role === 'admin',
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
