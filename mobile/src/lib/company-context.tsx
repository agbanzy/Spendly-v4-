import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useAuth } from './auth-context';

// ==================== TYPES ====================

export interface Company {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  logo: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  country: string | null;
  currency: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  role: string; // user's role in this company
  membershipId: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;
  email: string;
  role: string;
  status: string;
  invitedAt: string;
  joinedAt: string | null;
}

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  isLoading: boolean;
  error: string | null;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
  createCompany: (data: CreateCompanyData) => Promise<Company>;
  userRole: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageTeam: boolean;
  canManagePayroll: boolean;
  canManageInvoices: boolean;
}

interface CreateCompanyData {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  country?: string;
  currency?: string;
}

const ACTIVE_COMPANY_KEY = 'spendly_active_company_id';

// ==================== CONTEXT ====================

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0] || null;

  // Derived role-based permissions
  const userRole = activeCompany?.role || null;
  const isOwner = userRole === 'OWNER';
  const isAdmin = userRole === 'ADMIN' || isOwner;
  const isManager = userRole === 'MANAGER' || isAdmin;
  const canManageTeam = isManager;
  const canManagePayroll = isAdmin;
  const canManageInvoices = isManager;

  const fetchCompanies = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setActiveCompanyId(null);
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const result = await api.get<Company[]>('/api/companies');
      setCompanies(result);

      // Restore last active company from storage
      const storedId = await AsyncStorage.getItem(ACTIVE_COMPANY_KEY);
      if (storedId && result.find((c) => c.id === storedId)) {
        setActiveCompanyId(storedId);
      } else if (result.length > 0) {
        setActiveCompanyId(result[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load companies');
      // Don't block the app — set empty
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // When active company changes, persist to storage and update API header
  useEffect(() => {
    if (activeCompanyId) {
      AsyncStorage.setItem(ACTIVE_COMPANY_KEY, activeCompanyId);
      // The api.ts will read from getActiveCompanyId()
    }
  }, [activeCompanyId]);

  const switchCompany = useCallback(async (companyId: string) => {
    const target = companies.find((c) => c.id === companyId);
    if (!target) throw new Error('Company not found');
    setActiveCompanyId(companyId);
  }, [companies]);

  const refreshCompanies = useCallback(async () => {
    setIsLoading(true);
    await fetchCompanies();
  }, [fetchCompanies]);

  const createCompany = useCallback(async (data: CreateCompanyData): Promise<Company> => {
    const newCompany = await api.post<Company>('/api/companies', data as unknown as Record<string, unknown>);
    await fetchCompanies();
    setActiveCompanyId(newCompany.id);
    return newCompany;
  }, [fetchCompanies]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        isLoading,
        error,
        switchCompany,
        refreshCompanies,
        createCompany,
        userRole,
        isOwner,
        isAdmin,
        isManager,
        canManageTeam,
        canManagePayroll,
        canManageInvoices,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

// Utility to get the active company ID for API headers
export async function getActiveCompanyId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_COMPANY_KEY);
}
