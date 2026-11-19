import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Company } from '../types';
import {
  CORE_COMPANIES,
  DEFAULT_SUBSIDIARY_ID,
  PARENT_COMPANY_ID,
} from '../config/companies';
import { DataService } from '../services/dataService';
import { useAuth } from './AuthContext';
import {
  canSwitchCompanies,
  getUserCompanyId,
  isActiveStatus,
  resolveQueryCompanyId,
} from '../utils/rbac';

interface CompanyContextType {
  companies: Company[];
  subsidiaries: Company[];
  parentCompany: Company;
  activeCompanyId: string;
  activeCompany: Company;
  isGroupView: boolean;
  /**
   * Effective companyId passed to Firestore queries.
   * null ONLY when an active SUPER_ADMIN is viewing LUMERE GROUP (all subsidiaries).
   */
  queryCompanyId: string | null;
  /**
   * Default subsidiary ID to use when creating a company-scoped document
   * (if currently in Group View, callers must let SUPER_ADMIN choose a subsidiary).
   */
  defaultWriteCompanyId: string;
  loadingCompanies: boolean;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
  getCompanyById: (companyId?: string | null) => Company | undefined;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_ACTIVE_COMPANY_KEY = 'lumere_group_active_company_id';

function mergeWithCoreCompanies(firestoreCompanies: Company[]): Company[] {
  const map = new Map<string, Company>();
  for (const core of CORE_COMPANIES) {
    map.set(core.id, core);
  }
  for (const live of firestoreCompanies) {
    const existing = map.get(live.id);
    map.set(live.id, existing ? { ...existing, ...live, theme: live.theme || existing.theme } : live);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.type === 'parent' && b.type !== 'parent') return -1;
    if (a.type !== 'parent' && b.type === 'parent') return 1;
    return a.name.localeCompare(b.name);
  });
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(CORE_COMPANIES);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const userCanSwitch = canSwitchCompanies(currentUser);
  const assignedCompanyId = getUserCompanyId(currentUser);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_ACTIVE_COMPANY_KEY);
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
    return PARENT_COMPANY_ID;
  });

  // Subscribe to companies collection only for active authenticated users
  useEffect(() => {
    if (loading || !currentUser || !isActiveStatus(currentUser.status)) {
      setCompanies(CORE_COMPANIES);
      setLoadingCompanies(false);
      return;
    }

    setLoadingCompanies(true);
    const unsub = DataService.subscribeCompanies(
      userCanSwitch ? null : assignedCompanyId,
      fetched => {
        if (fetched.length > 0) {
          setCompanies(mergeWithCoreCompanies(fetched));
        } else {
          setCompanies(CORE_COMPANIES);
        }
        setLoadingCompanies(false);
      }
    );

    return () => unsub();
  }, [loading, currentUser, userCanSwitch, assignedCompanyId]);

  // Enforce strict company lock for non-SUPER_ADMIN users
  const activeCompanyId = useMemo(() => {
    if (!currentUser || !isActiveStatus(currentUser.status)) {
      return assignedCompanyId;
    }
    if (!userCanSwitch) {
      return assignedCompanyId;
    }
    const exists = companies.some(c => c.id === selectedCompanyId);
    return exists ? selectedCompanyId : PARENT_COMPANY_ID;
  }, [currentUser, userCanSwitch, assignedCompanyId, companies, selectedCompanyId]);

  const switchCompany = (companyId: string) => {
    // Only active SUPER_ADMIN can switch workspace context; never mutates currentUser.companyId
    if (!userCanSwitch) return;
    if (!companies.some(c => c.id === companyId)) return;
    setSelectedCompanyId(companyId);
    try {
      sessionStorage.setItem(STORAGE_ACTIVE_COMPANY_KEY, companyId);
    } catch {
      // ignore storage errors
    }
  };

  const refreshCompanies = async () => {
    if (!currentUser) return;
    try {
      const fetched = await DataService.getCompanies(userCanSwitch ? null : assignedCompanyId);
      if (fetched.length > 0) {
        setCompanies(mergeWithCoreCompanies(fetched));
      }
    } catch (err) {
      console.warn('Could not refresh companies list:', err);
    }
  };

  const parentCompany = useMemo(
    () => companies.find(c => c.type === 'parent') || CORE_COMPANIES[0],
    [companies]
  );

  const subsidiaries = useMemo(
    () => companies.filter(c => c.type === 'subsidiary'),
    [companies]
  );

  const activeCompany = useMemo(
    () => companies.find(c => c.id === activeCompanyId) || parentCompany,
    [companies, activeCompanyId, parentCompany]
  );

  const isGroupView = userCanSwitch && activeCompanyId === PARENT_COMPANY_ID;

  const queryCompanyId = useMemo(
    () => resolveQueryCompanyId(currentUser, activeCompanyId),
    [currentUser, activeCompanyId]
  );

  const defaultWriteCompanyId = useMemo(() => {
    if (queryCompanyId && queryCompanyId !== PARENT_COMPANY_ID) {
      return queryCompanyId;
    }
    return subsidiaries[0]?.id || DEFAULT_SUBSIDIARY_ID;
  }, [queryCompanyId, subsidiaries]);

  const getCompanyById = (companyId?: string | null) => {
    if (!companyId) return undefined;
    return companies.find(c => c.id === companyId);
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        subsidiaries,
        parentCompany,
        activeCompanyId,
        activeCompany,
        isGroupView,
        queryCompanyId,
        defaultWriteCompanyId,
        loadingCompanies,
        switchCompany,
        refreshCompanies,
        getCompanyById,
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
