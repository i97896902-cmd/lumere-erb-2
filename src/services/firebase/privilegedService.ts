import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../lib/firebase';
import { CanonicalRole, Company, CompanyStatus, User } from '../../types';
import { DataService } from '../data/dataService';
import { canAssignRole, canManageCompanies, canManageCompanyUsers } from '../../utils/rbac';

export interface PrivilegedActionResult<T = void> {
  data?: T;
  executedVia: 'cloud_function' | 'firestore_rules_fallback';
  claimsSynced: boolean;
}

function isFunctionsUnavailableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code || '';
  const message = (err as { message?: string })?.message || '';
  return (
    code.includes('not-found') ||
    code.includes('unavailable') ||
    code.includes('internal') ||
    code.includes('unauthenticated') ||
    /CORS|Failed to fetch|network|404/i.test(message)
  );
}

/**
 * PrivilegedService routes sensitive administrative operations through Firebase Cloud Functions
 * so Firebase Auth Custom Claims (`role`, `companyId`) are updated server-side.
 *
 * When Cloud Functions are not yet deployed in the Firebase project, authorized SUPER_ADMIN /
 * COMPANY_ADMIN users fall back cleanly to Firestore Security Rules–enforced writes and report
 * `claimsSynced: false` so operators know Custom Claims will sync once Functions are deployed.
 */
export const PrivilegedService = {
  async createCompany(
    payload: {
      name: string;
      arabicName?: string;
      slug: string;
      description: string;
      businessSector?: string;
      logo?: string;
      seedSuggestedDepartments?: boolean;
    },
    actor: User
  ): Promise<PrivilegedActionResult<Company>> {
    if (!canManageCompanies(actor)) {
      throw new Error('عملية إنشاء الشركات محصورة بمدير المجموعة الأعلى (SUPER_ADMIN).');
    }

    if (!auth.currentUser) {
      const created = await DataService.createCompany(
        {
          name: payload.name,
          arabicName: payload.arabicName,
          slug: payload.slug,
          type: 'subsidiary',
          parentCompanyId: 'lumere-group',
          logo: payload.logo || '',
          description: payload.description,
          businessSector: payload.businessSector,
          status: 'active',
        },
        actor,
        payload.seedSuggestedDepartments
      );
      return { data: created, executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }

    try {
      const fn = httpsCallable<typeof payload, { company: Company }>(functions, 'createCompany');
      const res = await fn(payload);
      return { data: res.data.company, executedVia: 'cloud_function', claimsSynced: true };
    } catch (err) {
      if (!isFunctionsUnavailableError(err)) throw err;
      const created = await DataService.createCompany(
        {
          name: payload.name,
          arabicName: payload.arabicName,
          slug: payload.slug,
          type: 'subsidiary',
          parentCompanyId: 'lumere-group',
          logo: payload.logo || '',
          description: payload.description,
          businessSector: payload.businessSector,
          status: 'active',
        },
        actor,
        payload.seedSuggestedDepartments
      );
      return { data: created, executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }
  },

  async setCompanyStatus(
    companyId: string,
    status: CompanyStatus,
    actor: User
  ): Promise<PrivilegedActionResult> {
    if (!canManageCompanies(actor)) {
      throw new Error('تغيير حالة الشركات محصور بمدير المجموعة الأعلى (SUPER_ADMIN).');
    }

    if (!auth.currentUser) {
      await DataService.updateCompany(companyId, { status }, actor, 'Company Status Changed');
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }

    try {
      const fn = httpsCallable<{ companyId: string; status: CompanyStatus }, { ok: boolean }>(
        functions,
        'setCompanyStatus'
      );
      await fn({ companyId, status });
      return { executedVia: 'cloud_function', claimsSynced: true };
    } catch (err) {
      if (!isFunctionsUnavailableError(err)) throw err;
      await DataService.updateCompany(companyId, { status }, actor, 'Company Status Changed');
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }
  },

  async assignCompanyAdmin(
    params: {
      userId: string;
      companyId: string;
      companyName?: string;
    },
    actor: User
  ): Promise<PrivilegedActionResult> {
    if (!canManageCompanies(actor)) {
      throw new Error('تعيين مدير شركة محصور بمدير المجموعة الأعلى (SUPER_ADMIN).');
    }

    if (!auth.currentUser) {
      await DataService.assignCompanyAdmin(params.userId, params.companyId, params.companyName, actor);
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }

    try {
      const fn = httpsCallable<typeof params, { ok: boolean }>(functions, 'assignCompanyAdmin');
      await fn(params);
      return { executedVia: 'cloud_function', claimsSynced: true };
    } catch (err) {
      if (!isFunctionsUnavailableError(err)) throw err;
      await DataService.assignCompanyAdmin(params.userId, params.companyId, params.companyName, actor);
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }
  },

  async updateUserRoleAndCompany(
    params: {
      userId: string;
      role: CanonicalRole;
      companyId: string;
      companyName?: string;
      department?: string;
      position?: string;
      managerId?: string;
      managerName?: string;
    },
    actor: User
  ): Promise<PrivilegedActionResult> {
    if (!canManageCompanyUsers(actor, params.companyId) || !canAssignRole(actor, params.role)) {
      throw new Error('لا تملك الصلاحية لتعديل دور أو شركة هذا المستخدم.');
    }

    if (!auth.currentUser) {
      await DataService.updateUser(
        params.userId,
        {
          role: params.role,
          companyId: params.companyId,
          ...(params.companyName ? { companyName: params.companyName } : {}),
          ...(params.department !== undefined ? { department: params.department } : {}),
          ...(params.position !== undefined ? { position: params.position } : {}),
          ...(params.managerId !== undefined ? { managerId: params.managerId } : {}),
          ...(params.managerName !== undefined ? { managerName: params.managerName } : {}),
        },
        actor
      );
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }

    try {
      const fn = httpsCallable<typeof params, { ok: boolean }>(
        functions,
        'updateUserRoleAndCompany'
      );
      await fn(params);
      return { executedVia: 'cloud_function', claimsSynced: true };
    } catch (err) {
      if (!isFunctionsUnavailableError(err)) throw err;
      await DataService.updateUser(
        params.userId,
        {
          role: params.role,
          companyId: params.companyId,
          ...(params.companyName ? { companyName: params.companyName } : {}),
          ...(params.department !== undefined ? { department: params.department } : {}),
          ...(params.position !== undefined ? { position: params.position } : {}),
          ...(params.managerId !== undefined ? { managerId: params.managerId } : {}),
          ...(params.managerName !== undefined ? { managerName: params.managerName } : {}),
        },
        actor
      );
      return { executedVia: 'firestore_rules_fallback', claimsSynced: false };
    }
  },

  async syncCurrentUserClaims(): Promise<boolean> {
    if (!auth.currentUser) return false;
    try {
      const fn = httpsCallable<Record<string, never>, { synced: boolean }>(functions, 'syncMyClaims');
      const res = await fn({});
      return Boolean(res.data?.synced);
    } catch {
      return false;
    }
  },
};
