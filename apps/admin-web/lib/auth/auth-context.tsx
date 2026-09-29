'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CurrentUserDto } from '@ai-mos/types';

// ─── Storage keys ───────────────────────────────────────────────────────────
// Access token in memory only (never persisted) — most secure approach
// Refresh token in sessionStorage (tab-scoped, cleared on close)
// ADR-005 documents this decision.
const ACCESS_TOKEN_KEY = 'amos_at';
const REFRESH_TOKEN_KEY = 'amos_rt';

// ─── API helper ─────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });

  const json = (await res.json()) as
    | { success: boolean; data?: T; error?: { message: string } }
    | T;

  if (!res.ok) {
    const errJson = json as { success: boolean; error?: { message: string } };
    throw new Error(errJson.error?.message ?? `Request failed: ${res.status}`);
  }

  // Handle both:
  //   { success: true, data: { ... } }  — standard envelope
  //   { user, tokens, refreshToken }    — direct object (auth endpoints)
  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) {
    return wrapped.data as T;
  }
  return json as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface AuthState {
  user: CurrentUserDto | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On mount: try to restore session via refresh token
  useEffect(() => {
    void restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreSession = useCallback(async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const data = await apiFetch<{ tokens: { accessToken: string }; refreshToken: string }>(
        '/v1/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
      );

      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

      const user = await apiFetch<CurrentUserDto>('/v1/auth/me', { method: 'GET' }, data.tokens.accessToken);

      setState({ user, accessToken: data.tokens.accessToken, isLoading: false, isAuthenticated: true });
    } catch {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: CurrentUserDto; tokens: { accessToken: string }; refreshToken: string }>(
      '/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setState({ user: data.user, accessToken: data.tokens.accessToken, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (form: { email: string; password: string; firstName: string; lastName: string }) => {
    const data = await apiFetch<{ user: CurrentUserDto; tokens: { accessToken: string }; refreshToken: string }>(
      '/v1/auth/register',
      { method: 'POST', body: JSON.stringify(form) },
    );
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setState({ user: data.user, accessToken: data.tokens.accessToken, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken && state.accessToken) {
        await apiFetch('/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }, state.accessToken);
      }
    } catch { /* ignore */ } finally {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
    }
  }, [state.accessToken]);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    try {
      const data = await apiFetch<{ tokens: { accessToken: string }; refreshToken: string }>(
        '/v1/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
      );
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      setState((s) => ({ ...s, accessToken: data.tokens.accessToken }));
      return true;
    } catch {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshTokens }}>
      {children}
    </AuthContext.Provider>
  );
}
