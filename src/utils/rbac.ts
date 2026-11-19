import { CanonicalRole, Department, Project, Role, TabType, Task, User } from '../types';
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
      return 'مدير القسم';
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

/**
 * Role-based default landing screen matching the 4-tier hierarchy:
 * - SUPER_ADMIN -> Group Dashboard (group_dashboard) when in Group View, or Company Dashboard inside a subsidiary
 * - COMPANY_ADMIN -> Company Dashboard (dashboard)
 * - MANAGER -> Department Management (departments)
 * - EMPLOYEE -> Employee Dashboard (dashboard)
 */
export function getDefaultTabForRole(role: CanonicalRole, isGroupView = true): TabType {
  switch (role) {
    case 'SUPER_ADMIN':
      return isGroupView ? 'group_dashboard' : 'dashboard';
    case 'COMPANY_ADMIN':
      return 'dashboard';
    case 'MANAGER':
      return 'departments';
    case 'EMPLOYEE':
    default:
      return 'dashboard';
  }
}

const ALLOWED_TABS_BY_ROLE: Record<CanonicalRole, TabType[]> = {
  SUPER_ADMIN: [
    'group_dashboard',
    'companies',
    'dashboard',
    'tasks',
    'projects',
    'clients',
    'equipment',
    'join_requests',
    'calendar',
    'employees',
    'departments',
    'reports',
    'activity',
    'notifications',
    'settings',
    'profile',
  ],
  COMPANY_ADMIN: [
    'dashboard',
    'tasks',
    'projects',
    'clients',
    'equipment',
    'join_requests',
    'calendar',
    'employees',
    'departments',
    'reports',
    'activity',
    'notifications',
    'settings',
    'profile',
  ],
  MANAGER: [
    'departments',
    'dashboard',
    'tasks',
    'projects',
    'clients',
    'equipment',
    'calendar',
    'employees',
    'reports',
    'activity',
    'notifications',
    'profile',
  ],
  EMPLOYEE: ['dashboard', 'tasks', 'calendar', 'notifications', 'profile'],
};

export function getAllowedTabsForRole(role: CanonicalRole): TabType[] {
  return [...ALLOWED_TABS_BY_ROLE[role]];
}

export function canAccessTab(
  user: Pick<User, 'role' | 'email' | 'status'> | null | undefined,
  tab: TabType
): boolean {
  if (!user || !isActiveStatus(user.status)) return false;
  const role = normalizeRole(user.role, user.email);
  return ALLOWED_TABS_BY_ROLE[role].includes(tab);
}

/**
 * Scopes employees visibility by canonical role:
 * - SUPER_ADMIN / COMPANY_ADMIN: full company/group list
 * - MANAGER: members in their department, their direct reports, or self (falls back to all if manager has no department)
 * - EMPLOYEE: self only
 */
export function scopeEmployeesForUser(
  user: (Pick<User, 'id' | 'role' | 'email' | 'status'> & { department?: string }) | null | undefined,
  employees: User[]
): User[] {
  if (!user || !isActiveStatus(user.status)) return [];
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return employees;
  if (role === 'MANAGER') {
    const dept = (user.department || '').trim().toLowerCase();
    const scoped = employees.filter(emp => {
      if (emp.id === user.id) return true;
      if (emp.managerId && emp.managerId === user.id) return true;
      if (dept && (emp.department || '').trim().toLowerCase() === dept) return true;
      return false;
    });
    return dept || scoped.length > 0 ? scoped : employees;
  }
  return employees.filter(emp => emp.id === user.id);
}

/**
 * Scopes department visibility by canonical role:
 * - SUPER_ADMIN / COMPANY_ADMIN: all departments in active scope
 * - MANAGER: their managed/assigned department(s) (falls back to all if none explicitly matched)
 * - EMPLOYEE: their assigned department only
 */
export function scopeDepartmentsForUser(
  user:
    | (Pick<User, 'id' | 'role' | 'email' | 'status'> & { department?: string; displayName?: string })
    | null
    | undefined,
  departments: Department[]
): Department[] {
  if (!user || !isActiveStatus(user.status)) return [];
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return departments;

  const deptName = (user.department || '').trim().toLowerCase();
  const displayName = (user.displayName || '').trim().toLowerCase();

  if (role === 'MANAGER') {
    const matched = departments.filter(d => {
      if (d.managerId && d.managerId === user.id) return true;
      if (deptName && d.name.trim().toLowerCase() === deptName) return true;
      if (displayName && d.headName && d.headName.trim().toLowerCase() === displayName) return true;
      return false;
    });
    return matched.length > 0 ? matched : departments;
  }

  if (!deptName) return [];
  return departments.filter(d => d.name.trim().toLowerCase() === deptName);
}

/**
 * Scopes tasks visibility by canonical role:
 * - SUPER_ADMIN / COMPANY_ADMIN: all tasks in active scope
 * - MANAGER: tasks in their department, tasks assigned to their team/self, or created by self
 * - EMPLOYEE: strictly tasks assigned to self (or co-assigned)
 */
export function scopeTasksForUser(
  user: (Pick<User, 'id' | 'role' | 'email' | 'status'> & { department?: string }) | null | undefined,
  tasks: Task[],
  employees: User[] = []
): Task[] {
  if (!user || !isActiveStatus(user.status)) return [];
  const role = normalizeRole(user.role, user.email);
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') return tasks;

  if (role === 'MANAGER') {
    const dept = (user.department || '').trim().toLowerCase();
    const teamIds = new Set(
      scopeEmployeesForUser(user, employees).map(emp => emp.id)
    );
    teamIds.add(user.id);

    if (!dept && teamIds.size <= 1) return tasks;

    return tasks.filter(task => {
      if (task.assignedTo === user.id || task.createdBy === user.id) return true;
      if (teamIds.has(task.assignedTo)) return true;
      if (dept && (task.department || '').trim().toLowerCase() === dept) return true;
      return false;
    });
  }

  return tasks.filter(
    task =>
      task.assignedTo === user.id ||
      (Array.isArray(task.coAssignees) && task.coAssignees.includes(user.id))
  );
}
