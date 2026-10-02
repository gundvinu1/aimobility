'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { CompanyDto, CompanySummaryDto, CompanySettingsDto, CompanyMemberDto } from '@ai-mos/types';
import { useAuth } from '@/lib/auth/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ─── API fetch helper with company context header ─────────────────────────────
async function companyFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
  companyId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(companyId ? { 'x-company-id': companyId } : {}),
  };
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });
  const json = await res.json() as unknown;
  if (!res.ok) {
    const err = json as { error?: { message: string }; message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed: ${res.status}`);
  }
  return json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CompanyContextValue {
  companies: CompanySummaryDto[];
  activeCompany: CompanySummaryDto | null;
  isLoading: boolean;
  error: string | null;
  setActiveCompany: (_company: CompanySummaryDto) => void;
  refreshCompanies: () => Promise<void>;
  // API methods
  createCompany: (_data: Record<string, unknown>) => Promise<CompanyDto>;
  getCompany: (_id: string) => Promise<CompanyDto>;
  updateCompany: (_id: string, _data: Record<string, unknown>) => Promise<CompanyDto>;
  getSettings: (_id: string) => Promise<CompanySettingsDto>;
  updateSettings: (_id: string, _data: Record<string, unknown>) => Promise<CompanySettingsDto>;
  getMembers: (_id: string) => Promise<CompanyMemberDto[]>;
  updateMember: (_companyId: string, _userId: string, _data: Record<string, unknown>) => Promise<CompanyMemberDto>;
  removeMember: (_companyId: string, _userId: string) => Promise<void>;
  createInvitation: (_companyId: string, _data: { email: string; role?: string }) => Promise<{ invitation: unknown; developmentToken?: string }>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState<CompanySummaryDto[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<CompanySummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCompanies = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await companyFetch<CompanySummaryDto[]>('/v1/companies', {}, accessToken);
      setCompanies(list);

      // Determine active company:
      // 1. Check URL pathname for /companies/{companyId}
      let targetId: string | null = null;
      if (typeof window !== 'undefined') {
        const match = window.location.pathname.match(/\/companies\/([a-zA-Z0-9_-]+)/);
        if (match && match[1] && match[1] !== 'new') {
          targetId = match[1];
        } else {
          targetId = localStorage.getItem('aimos_active_company_id');
        }
      }

      if (targetId) {
        const found = list.find((c) => c.id === targetId);
        if (found) {
          setActiveCompanyState(found);
          if (typeof window !== 'undefined') {
            localStorage.setItem('aimos_active_company_id', found.id);
          }
          return;
        }
      }

      // If activeCompany is already set, update reference from refreshed list
      if (activeCompany) {
        const current = list.find((c) => c.id === activeCompany.id);
        if (current) {
          setActiveCompanyState(current);
          return;
        }
      }

      // Auto-select first company if available
      if (list.length > 0) {
        setActiveCompanyState(list[0] ?? null);
        if (typeof window !== 'undefined' && list[0]) {
          localStorage.setItem('aimos_active_company_id', list[0].id);
        }
      } else {
        setActiveCompanyState(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, activeCompany]);

  useEffect(() => {
    if (isAuthenticated) void refreshCompanies();
    else {
      setCompanies([]);
      setActiveCompanyState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aimos_active_company_id');
      }
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveCompany = useCallback((company: CompanySummaryDto) => {
    setActiveCompanyState(company);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aimos_active_company_id', company.id);
    }
  }, []);

  const createCompany = useCallback(async (data: Record<string, unknown>): Promise<CompanyDto> => {
    const result = await companyFetch<{ company: CompanyDto }>('/v1/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }, accessToken ?? undefined);
    await refreshCompanies();
    return result.company;
  }, [accessToken, refreshCompanies]);

  const getCompany = useCallback(async (id: string): Promise<CompanyDto> => {
    return companyFetch<CompanyDto>(`/v1/companies/${id}`, {}, accessToken ?? undefined, id);
  }, [accessToken]);

  const updateCompany = useCallback(async (id: string, data: Record<string, unknown>): Promise<CompanyDto> => {
    return companyFetch<CompanyDto>(`/v1/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, accessToken ?? undefined, id);
  }, [accessToken]);

  const getSettings = useCallback(async (id: string): Promise<CompanySettingsDto> => {
    return companyFetch<CompanySettingsDto>(`/v1/companies/${id}/settings`, {}, accessToken ?? undefined, id);
  }, [accessToken]);

  const updateSettings = useCallback(async (id: string, data: Record<string, unknown>): Promise<CompanySettingsDto> => {
    return companyFetch<CompanySettingsDto>(`/v1/companies/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, accessToken ?? undefined, id);
  }, [accessToken]);

  const getMembers = useCallback(async (id: string): Promise<CompanyMemberDto[]> => {
    return companyFetch<CompanyMemberDto[]>(`/v1/companies/${id}/members`, {}, accessToken ?? undefined, id);
  }, [accessToken]);

  const updateMember = useCallback(async (companyId: string, userId: string, data: Record<string, unknown>): Promise<CompanyMemberDto> => {
    return companyFetch<CompanyMemberDto>(`/v1/companies/${companyId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, accessToken ?? undefined, companyId);
  }, [accessToken]);

  const removeMember = useCallback(async (companyId: string, userId: string): Promise<void> => {
    await companyFetch<void>(`/v1/companies/${companyId}/members/${userId}`, {
      method: 'DELETE',
    }, accessToken ?? undefined, companyId);
  }, [accessToken]);

  const createInvitation = useCallback(async (companyId: string, data: { email: string; role?: string }) => {
    return companyFetch<{ invitation: unknown; developmentToken?: string }>(`/v1/companies/${companyId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, accessToken ?? undefined, companyId);
  }, [accessToken]);

  return (
    <CompanyContext.Provider value={{
      companies,
      activeCompany,
      isLoading,
      error,
      setActiveCompany,
      refreshCompanies,
      createCompany,
      getCompany,
      updateCompany,
      getSettings,
      updateSettings,
      getMembers,
      updateMember,
      removeMember,
      createInvitation,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}
