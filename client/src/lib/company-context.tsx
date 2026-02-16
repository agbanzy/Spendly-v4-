import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

interface Company {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  logo: string | null;
  industry: string | null;
  country: string;
  currency: string;
  status: string;
  role: string;
  membershipId: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  switchCompany: (companyId: string) => void;
  currentCompanyId: string | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && companies.length > 0) {
      const storedCompanyId = localStorage.getItem("spendly-active-company");
      
      if (storedCompanyId && companies.some(c => c.id === storedCompanyId)) {
        setCurrentCompanyId(storedCompanyId);
      } else {
        const firstCompanyId = companies[0].id;
        setCurrentCompanyId(firstCompanyId);
        localStorage.setItem("spendly-active-company", firstCompanyId);
      }
    }
  }, [isLoading, companies]);

  const switchCompany = (companyId: string) => {
    setCurrentCompanyId(companyId);
    localStorage.setItem("spendly-active-company", companyId);
    queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
    queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
  };

  const currentCompany = currentCompanyId
    ? companies.find(c => c.id === currentCompanyId) || null
    : null;

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        isLoading,
        switchCompany,
        currentCompanyId,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
