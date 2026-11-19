import { CanonicalRole, Project, Role, User } from '../types';
import { DEFAULT_SUBSIDIARY_ID, PARENT_COMPANY_ID } from '../config/companies';

export const PRIMARY_SUPER_ADMIN_EMAIL = 'lumerecompany@gmail.com';

export function normalizeRole(role?: Role | string | null, email?: string | null): CanonicalRole {
  if (email && email.trim().toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL) {
    return 'SUPER_ADMIN';
  }
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return 'SUPER_ADMIN';
    case 'COMPANY_ADMIN':
      return 'COMPANY_ADMIN';
    case 'MANAGER':
      return 'MANAGER';
    case 'EMPLOYEE':
    default:
      return 'EMPLOYEE';
  }
}

export function isActiveStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'active';
}

export function isPendingStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'pending';
}

export function isRejectedStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'rejected';
}

export function isSuspendedStatus(status?: string | null): boolean {
  const normalized = (status || '').trim().toLowerCase();
  return normalized === 'suspended' || normalized === 'inactive';
}

export function getUserCompanyId(user?: Pick<User, 'companyId' | 'role' | 'email'> | null): string {
  if (!user) return DEFAULT_SUBSIDIARY_ID;
  if (user.companyId && user.companyId.trim().length > 0) {
    return user.companyId.trim();
  }
  const role = normalizeRole(user.role, user.email);
  return role === 'SUPER_ADMIN' ? PARENT_COMPANY_ID : DEFAULT_SUBSIDIARY_ID;
}

export function isSuperAdmin(user?: Pick<User, 'role' | 'email' | 'status'> | null): boolean {
  if (!user) return false;
  return normalizeRole(user.role, user.email) === 'SUPER_ADMIN' && isActiveStatus(user.status);
}

export function isCompanyAdmin(user?: Pick<User, 'role' | 'email' | 'status'> | null): boolean {
  if (!user) return false;
  return normalizeRole(user.role, user.email) === 'COMPANY_ADMIN' && isActiveStatus(user.status);
}

export function isManager(user?: Pick<User, 'role' | 'email' | 'status'> | null): boolean {
  if (!user) return false;
  return normalizeRole(user.role, user.email) === 'MANAGER' && isActiveStatus(user.status);
}

export function canSwitchCompanies(user?: Pick<User, 'role' | 'email' | 'status'> | null): boolean {
  return isSuperAdmin(user);
}

export function canAccessCompany(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  if (!user || !isActiveStatus(user.status)) return false;
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN') return true;
  if (!targetCompanyId || targetCompanyId === PARENT_COMPANY_ID) return false;
  return getUserCompanyId(user) === targetCompanyId;
}

export function canManageCompanies(user?: Pick<User, 'role' | 'email' | 'status'> | null): boolean {
  return isSuperAdmin(user);
}

export function canManageCompanyUsers(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  if (!user || !isActiveStatus(user.status)) return false;
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'COMPANY_ADMIN') {
    return getUserCompanyId(user) === targetCompanyId;
  }
  return false;
}

export function canManageDepartments(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  return canManageCompanyUsers(user, targetCompanyId);
}

export function canManageClients(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  if (!user || !isActiveStatus(user.status)) return false;
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'COMPANY_ADMIN' || role === 'MANAGER') {
    return getUserCompanyId(user) === targetCompanyId;
  }
  return false;
}

export function canManageProjects(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  return canManageClients(user, targetCompanyId);
}

export function canCreateTask(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  return canManageClients(user, targetCompanyId);
}

export function canApproveTasks(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  return canManageClients(user, targetCompanyId);
}

export function canDeleteTask(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId: string
): boolean {
  return canManageCompanyUsers(user, targetCompanyId);
}

export function canViewReports(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId?: string
): boolean {
  if (!user || !isActiveStatus(user.status)) return false;
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'COMPANY_ADMIN' || role === 'MANAGER') {
    if (!targetCompanyId) return true;
    return getUserCompanyId(user) === targetCompanyId;
  }
  return false;
}

export function canViewActivityLogs(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  targetCompanyId?: string
): boolean {
  return canViewReports(user, targetCompanyId);
}

export function canAssignRole(
  actor: Pick<User, 'role' | 'email' | 'status'> | null | undefined,
  targetRole: CanonicalRole
): boolean {
  if (!actor || !isActiveStatus(actor.status)) return false;
  const actorRole = normalizeRole(actor.role, actor.email);
  if (actorRole === 'SUPER_ADMIN') return true;
  if (actorRole === 'COMPANY_ADMIN') {
    return targetRole === 'MANAGER' || targetRole === 'EMPLOYEE';
  }
  return false;
}

export interface TaskAssignmentValidation {
  allowed: boolean;
  reason?: string;
}

export function validateTaskAssignment(params: {
  actor: Pick<User, 'id' | 'role' | 'email' | 'status' | 'companyId'> | null | undefined;
  taskCompanyId: string;
  assignee: Pick<User, 'id' | 'companyId' | 'status' | 'role' | 'email'> | null | undefined;
  project?: Pick<Project, 'id' | 'companyId' | 'teamMemberIds'> | null;
}): TaskAssignmentValidation {
  const { actor, taskCompanyId, assignee, project } = params;

  if (!actor || !isActiveStatus(actor.status)) {
    return { allowed: false, reason: 'حساب المستخدم غير نشط أو غير مصرح له.' };
  }

  if (!taskCompanyId || taskCompanyId === PARENT_COMPANY_ID) {
    return { allowed: false, reason: 'يجب اختيار شركة تابعة صالحة لإسناد المهمة داخلها.' };
  }

  if (!canCreateTask(actor, taskCompanyId)) {
    return { allowed: false, reason: 'لا تملك صلاحية إنشاء أو إسناد مهام داخل هذه الشركة.' };
  }

  if (!assignee) {
    return { allowed: false, reason: 'يجب اختيار موظف لتنفيذ المهمة.' };
  }

  if (!isActiveStatus(assignee.status)) {
    return { allowed: false, reason: 'لا يمكن إسناد مهمة لموظف غير نشط.' };
  }

  const assigneeCompanyId = getUserCompanyId(assignee);
  if (assigneeCompanyId !== taskCompanyId) {
    return {
      allowed: false,
      reason: 'لا يمكن إسناد مهمة لموظف ينتمي إلى شركة أخرى (حماية عزل الشركات).',
    };
  }

  if (project) {
    const projectCompanyId = project.companyId || DEFAULT_SUBSIDIARY_ID;
    if (projectCompanyId !== taskCompanyId) {
      return {
        allowed: false,
        reason: 'المشروع المحدد لا ينتمي إلى نفس الشركة.',
      };
    }

    if (
      Array.isArray(project.teamMemberIds) &&
      project.teamMemberIds.length > 0 &&
      !project.teamMemberIds.includes(assignee.id)
    ) {
      return {
        allowed: false,
        reason: 'الموظف المحدد ليس من أعضاء المشروع المختار.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Resolves the effective Firestore query companyId for a user + selected active company.
 * Returns null ONLY when a SUPER_ADMIN is viewing the parent group overview (LUMERE GROUP).
 */
export function resolveQueryCompanyId(
  user: Pick<User, 'role' | 'email' | 'status' | 'companyId'> | null | undefined,
  activeCompanyId: string
): string | null {
  if (!user || !isActiveStatus(user.status)) return null;
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN') {
    if (!activeCompanyId || activeCompanyId === PARENT_COMPANY_ID) {
      return null; // Group-wide view across all subsidiaries
    }
    return activeCompanyId;
  }
  return getUserCompanyId(user);
}

export function getRoleArabicLabel(role?: Role | string | null, email?: string | null): string {
  const normalized = normalizeRole(role, email);
  switch (normalized) {
    case 'SUPER_ADMIN':
      return 'مدير المجموعة الأعلى';
    case 'COMPANY_ADMIN':
      return 'مدير الشركة';
    case 'MANAGER':
      return 'مدير قسم / مشاريع';
    case 'EMPLOYEE':
    default:
      return 'موظف';
  }
}

export function getAssignableRoles(
  actor?: Pick<User, 'role' | 'email' | 'status'> | null
): CanonicalRole[] {
  if (!actor || !isActiveStatus(actor.status)) return [];
  const role = normalizeRole(actor.role, actor.email);
  if (role === 'SUPER_ADMIN') {
    return ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE'];
  }
  if (role === 'COMPANY_ADMIN') {
    return ['MANAGER', 'EMPLOYEE'];
  }
  return [];
}
