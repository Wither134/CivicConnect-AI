import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.js';
import { isDemoRoleSwitcherEnabled } from '../config/security.js';

export type UserRole = 'visitor' | 'citizen' | 'staff' | 'admin' | 'super_admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string | null;
  departmentName?: string | null;
  mfaEnabled?: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  isDemoPreviewActive: boolean;
  loginCitizen: (email: string, pass: string) => Promise<void>;
  registerCitizen: (name: string, email: string, pass: string) => Promise<void>;
  initiateStaffLogin: (email: string, pass: string) => Promise<{ requiresMfa: boolean; tempToken: string }>;
  completeMfaLogin: (tempToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRoleDemo: (role: UserRole) => Promise<void>;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('civicfix_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [isDemoPreviewActive, setIsDemoPreviewActive] = useState<boolean>(false);

  // Restore current user session
  const checkSession = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: AuthUser | null }>('/auth/me');
      if (res && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err: any) {
      if (err.status === 401 && err.code === 'SESSION_IDLE_TIMEOUT') {
        setIsSessionExpired(true);
      }
      setUser(null);
      localStorage.removeItem('civicfix_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginCitizen = async (email: string, pass: string) => {
    setIsDemoPreviewActive(false);
    const res = await apiRequest<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    localStorage.setItem('civicfix_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const registerCitizen = async (name: string, email: string, pass: string) => {
    setIsDemoPreviewActive(false);
    const res = await apiRequest<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass })
    });
    localStorage.setItem('civicfix_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const initiateStaffLogin = async (email: string, pass: string) => {
    return await apiRequest<{ requiresMfa: boolean; tempToken: string }>('/auth/staff-login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
  };

  const completeMfaLogin = async (tempToken: string, code: string) => {
    setIsDemoPreviewActive(false);
    const res = await apiRequest<{ token: string; user: AuthUser }>('/auth/mfa-verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code })
    });
    localStorage.setItem('civicfix_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    setIsDemoPreviewActive(false);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('civicfix_token');
    setToken(null);
    setUser(null);
  };

  // Demo shortcut STRICTLY for local developer UI layout preview.
  // Never active in production; never grants backend bearer tokens or actual permissions.
  const switchRoleDemo = async (role: UserRole) => {
    if (!isDemoRoleSwitcherEnabled()) {
      console.warn('Security gate active: Demo role switcher is disabled. Set VITE_ENABLE_DEMO_ROLE_SWITCHER=true in local development to preview roles.');
      return;
    }

    if (role === 'visitor') {
      setIsDemoPreviewActive(false);
      await logout();
      return;
    }

    // Set UI preview state WITHOUT granting backend bearer tokens.
    // Any privileged API call without authentic session credentials will be rejected with HTTP 401/403.
    setIsDemoPreviewActive(true);
    setUser({
      id: `preview-${role}`,
      name: role === 'citizen' ? 'Ramesh K. (Preview)' : role === 'staff' ? 'Arun K. (Preview)' : role === 'admin' ? 'Priya N. (Preview)' : 'Vikram S. (Preview)',
      email: `${role}.preview@civicconnect.local`,
      role: role,
      departmentName: role === 'staff' ? 'Electrical & Lighting' : undefined,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isSessionExpired,
        isDemoPreviewActive,
        loginCitizen,
        registerCitizen,
        initiateStaffLogin,
        completeMfaLogin,
        logout,
        switchRoleDemo,
        dismissSessionExpired: () => setIsSessionExpired(false)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

