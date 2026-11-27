import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_SUPER_ADMIN_EMAIL,
  normalizeRole,
  isActiveStatus,
  isPendingStatus,
  isRejectedStatus,
  isSuspendedStatus,
  getUserCompanyId,
  isSuperAdmin,
  isCompanyAdmin,
  isManager,
  canSwitchCompanies,
  canAccessCompany,
  canManageCompanies,
  canManageCompanyUsers,
  canManageClients,
  canDeleteTask,
  canViewReports,
  canAssignRole,
  getAssignableRoles,
  validateTaskAssignment,
  resolveQueryCompanyId,
  getRoleArabicLabel,
  getDefaultTabForRole,
  getAllowedTabsForRole,
  canAccessTab,
  scopeEmployeesForUser,
  scopeDepartmentsForUser,
  scopeTasksForUser,
  isTaskAssignedToUser,
} from '../../src/utils/rbac';
import { DEFAULT_SUBSIDIARY_ID, PARENT_COMPANY_ID } from '../../src/config/companies';

const superAdmin = {
  id: 'u-super',
  role: 'SUPER_ADMIN' as const,
  email: 'ceo@lumeregroup.com',
  status: 'active' as const,
  companyId: PARENT_COMPANY_ID,
};

const legacyAdmin = {
  id: 'u-legacy',
  role: 'ADMIN' as const,
  email: 'legacy@lumere.com',
  status: 'Active' as const,
  companyId: DEFAULT_SUBSIDIARY_ID,
};

const lumereAdmin = {
  id: 'u-lumere-admin',
  role: 'COMPANY_ADMIN' as const,
  email: 'admin@lumere.com',
  status: 'active' as const,
  companyId: 'lumere',
};

const nexAuraManager = {
  id: 'u-nex-mgr',
  role: 'MANAGER' as const,
  email: 'pm@nexaura.com',
  status: 'active' as const,
  companyId: 'nex-aura',
};

const ordarkEmployee = {
  id: 'u-ordark-emp',
  role: 'EMPLOYEE' as const,
  email: 'driver@ordark.com',
  status: 'active' as const,
  companyId: 'ordark',
};

const pendingUser = {
  id: 'u-pending',
  role: 'SUPER_ADMIN' as const,
  email: 'pending@lumere.com',
  status: 'pending' as const,
  companyId: 'lumere',
};

test('normalizeRole maps canonical roles, legacy ADMIN, bootstrap email, and unknown values safely', () => {
  assert.equal(normalizeRole('SUPER_ADMIN'), 'SUPER_ADMIN');
  assert.equal(normalizeRole('ADMIN'), 'SUPER_ADMIN');
  assert.equal(normalizeRole('COMPANY_ADMIN'), 'COMPANY_ADMIN');
  assert.equal(normalizeRole('MANAGER'), 'MANAGER');
  assert.equal(normalizeRole('EMPLOYEE'), 'EMPLOYEE');
  assert.equal(normalizeRole('UNKNOWN_ROLE'), 'EMPLOYEE');
  assert.equal(normalizeRole(undefined, null), 'EMPLOYEE');
  assert.equal(normalizeRole('EMPLOYEE', PRIMARY_SUPER_ADMIN_EMAIL), 'SUPER_ADMIN');
  assert.equal(normalizeRole('EMPLOYEE', '  LUMERECOMPANY@GMAIL.COM  '), 'SUPER_ADMIN');
});

test('status helpers handle case-insensitive active, pending, rejected, and suspended states', () => {
  assert.equal(isActiveStatus('active'), true);
  assert.equal(isActiveStatus('Active'), true);
  assert.equal(isActiveStatus('pending'), false);
  assert.equal(isPendingStatus('Pending'), true);
  assert.equal(isRejectedStatus('rejected'), true);
  assert.equal(isSuspendedStatus('suspended'), true);
  assert.equal(isSuspendedStatus('Inactive'), true);
});

test('getUserCompanyId preserves explicit companyId and defaults appropriately for legacy records', () => {
  assert.equal(getUserCompanyId({ companyId: 'nex-aura', role: 'EMPLOYEE', email: 'a@b.com' }), 'nex-aura');
  assert.equal(getUserCompanyId({ companyId: undefined, role: 'SUPER_ADMIN', email: 'a@b.com' }), PARENT_COMPANY_ID);
  assert.equal(getUserCompanyId({ companyId: undefined, role: 'EMPLOYEE', email: 'a@b.com' }), DEFAULT_SUBSIDIARY_ID);
  assert.equal(getUserCompanyId(null), DEFAULT_SUBSIDIARY_ID);
});

test('company switching and company management are strictly restricted to active SUPER_ADMIN', () => {
  assert.equal(isSuperAdmin(superAdmin), true);
  assert.equal(isSuperAdmin(legacyAdmin), true);
  assert.equal(isSuperAdmin(pendingUser), false);

  assert.equal(canSwitchCompanies(superAdmin), true);
  assert.equal(canManageCompanies(superAdmin), true);

  assert.equal(canSwitchCompanies(lumereAdmin), false);
  assert.equal(canManageCompanies(lumereAdmin), false);
  assert.equal(canSwitchCompanies(nexAuraManager), false);
  assert.equal(canSwitchCompanies(ordarkEmployee), false);
  assert.equal(canSwitchCompanies(pendingUser), false);

  assert.equal(isCompanyAdmin(lumereAdmin), true);
  assert.equal(isManager(nexAuraManager), true);
});

test('canAccessCompany enforces strict tenant isolation and blocks subsidiaries from parent group', () => {
  assert.equal(canAccessCompany(superAdmin, PARENT_COMPANY_ID), true);
  assert.equal(canAccessCompany(superAdmin, 'lumere'), true);
  assert.equal(canAccessCompany(superAdmin, 'nex-aura'), true);
  assert.equal(canAccessCompany(superAdmin, 'ordark'), true);

  assert.equal(canAccessCompany(lumereAdmin, 'lumere'), true);
  assert.equal(canAccessCompany(lumereAdmin, 'nex-aura'), false);
  assert.equal(canAccessCompany(lumereAdmin, 'ordark'), false);
  assert.equal(canAccessCompany(lumereAdmin, PARENT_COMPANY_ID), false);

  assert.equal(canAccessCompany(nexAuraManager, 'nex-aura'), true);
  assert.equal(canAccessCompany(nexAuraManager, 'lumere'), false);
  assert.equal(canAccessCompany(nexAuraManager, PARENT_COMPANY_ID), false);

  assert.equal(canAccessCompany(ordarkEmployee, 'ordark'), true);
  assert.equal(canAccessCompany(ordarkEmployee, 'lumere'), false);

  assert.equal(canAccessCompany(pendingUser, 'lumere'), false);
});

test('company user management, operational permissions, and reports obey 4-tier hierarchy', () => {
  assert.equal(canManageCompanyUsers(superAdmin, 'ordark'), true);
  assert.equal(canManageCompanyUsers(lumereAdmin, 'lumere'), true);
  assert.equal(canManageCompanyUsers(lumereAdmin, 'ordark'), false);
  assert.equal(canManageCompanyUsers(nexAuraManager, 'nex-aura'), false);

  assert.equal(canManageClients(nexAuraManager, 'nex-aura'), true);
  assert.equal(canManageClients(nexAuraManager, 'lumere'), false);
  assert.equal(canManageClients(ordarkEmployee, 'ordark'), false);

  assert.equal(canDeleteTask(lumereAdmin, 'lumere'), true);
  assert.equal(canDeleteTask(nexAuraManager, 'nex-aura'), false);
  assert.equal(canDeleteTask(superAdmin, 'nex-aura'), true);

  assert.equal(canViewReports(superAdmin, 'ordark'), true);
  assert.equal(canViewReports(nexAuraManager, 'nex-aura'), true);
  assert.equal(canViewReports(nexAuraManager, 'lumere'), false);
  assert.equal(canViewReports(ordarkEmployee, 'ordark'), false);
});

test('canAssignRole and getAssignableRoles prevent privilege escalation', () => {
  assert.deepEqual(getAssignableRoles(superAdmin), ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE']);
  assert.deepEqual(getAssignableRoles(lumereAdmin), ['MANAGER', 'EMPLOYEE']);
  assert.deepEqual(getAssignableRoles(nexAuraManager), []);
  assert.deepEqual(getAssignableRoles(ordarkEmployee), []);
  assert.deepEqual(getAssignableRoles(pendingUser), []);

  assert.equal(canAssignRole(superAdmin, 'SUPER_ADMIN'), true);
  assert.equal(canAssignRole(superAdmin, 'COMPANY_ADMIN'), true);
  assert.equal(canAssignRole(lumereAdmin, 'MANAGER'), true);
  assert.equal(canAssignRole(lumereAdmin, 'EMPLOYEE'), true);
  assert.equal(canAssignRole(lumereAdmin, 'COMPANY_ADMIN'), false);
  assert.equal(canAssignRole(lumereAdmin, 'SUPER_ADMIN'), false);
  assert.equal(canAssignRole(nexAuraManager, 'EMPLOYEE'), false);
});

test('validateTaskAssignment enforces same-company assignee, project company, team membership, and actor permissions', () => {
  const nexEmpActive = {
    id: 'u-nex-emp-1',
    companyId: 'nex-aura',
    status: 'active' as const,
    role: 'EMPLOYEE' as const,
    email: 'dev@nexaura.com',
  };

  const nexEmpInactive = {
    ...nexEmpActive,
    id: 'u-nex-emp-2',
    status: 'suspended' as const,
  };

  const nexProject = {
    id: 'proj-nex-1',
    companyId: 'nex-aura',
    teamMemberIds: ['u-nex-emp-1'],
  };

  const lumereProject = {
    id: 'proj-lumere-1',
    companyId: 'lumere',
    teamMemberIds: ['u-nex-emp-1'],
  };

  // Valid same-company assignment
  assert.equal(
    validateTaskAssignment({
      actor: nexAuraManager,
      taskCompanyId: 'nex-aura',
      assignee: nexEmpActive,
      project: nexProject,
    }).allowed,
    true
  );

  // SUPER_ADMIN assigning within subsidiary is allowed
  assert.equal(
    validateTaskAssignment({
      actor: superAdmin,
      taskCompanyId: 'nex-aura',
      assignee: nexEmpActive,
      project: nexProject,
    }).allowed,
    true
  );

  // Parent company cannot own operational tasks directly
  assert.equal(
    validateTaskAssignment({
      actor: superAdmin,
      taskCompanyId: PARENT_COMPANY_ID,
      assignee: nexEmpActive,
    }).allowed,
    false
  );

  // Cross-company assignee blocked
  assert.equal(
    validateTaskAssignment({
      actor: superAdmin,
      taskCompanyId: 'nex-aura',
      assignee: ordarkEmployee,
    }).allowed,
    false
  );

  // Cross-company project blocked
  assert.equal(
    validateTaskAssignment({
      actor: superAdmin,
      taskCompanyId: 'nex-aura',
      assignee: nexEmpActive,
      project: lumereProject,
    }).allowed,
    false
  );

  // Non-team-member blocked when project specifies teamMemberIds
  assert.equal(
    validateTaskAssignment({
      actor: nexAuraManager,
      taskCompanyId: 'nex-aura',
      assignee: { ...nexEmpActive, id: 'u-nex-outsider' },
      project: nexProject,
    }).allowed,
    false
  );

  // Inactive assignee blocked
  assert.equal(
    validateTaskAssignment({
      actor: nexAuraManager,
      taskCompanyId: 'nex-aura',
      assignee: nexEmpInactive,
    }).allowed,
    false
  );

  // Employee actor cannot assign tasks
  assert.equal(
    validateTaskAssignment({
      actor: ordarkEmployee,
      taskCompanyId: 'ordark',
      assignee: ordarkEmployee,
    }).allowed,
    false
  );
});

test('resolveQueryCompanyId locks non-super-admins to own company and allows group view only for SUPER_ADMIN', () => {
  assert.equal(resolveQueryCompanyId(superAdmin, PARENT_COMPANY_ID), null);
  assert.equal(resolveQueryCompanyId(superAdmin, ''), null);
  assert.equal(resolveQueryCompanyId(superAdmin, 'nex-aura'), 'nex-aura');

  assert.equal(resolveQueryCompanyId(lumereAdmin, PARENT_COMPANY_ID), 'lumere');
  assert.equal(resolveQueryCompanyId(lumereAdmin, 'ordark'), 'lumere');
  assert.equal(resolveQueryCompanyId(nexAuraManager, 'lumere'), 'nex-aura');
  assert.equal(resolveQueryCompanyId(ordarkEmployee, 'nex-aura'), 'ordark');
  assert.equal(resolveQueryCompanyId(pendingUser, 'lumere'), null);
});

test('getRoleArabicLabel returns distinct Arabic labels for all 4 roles', () => {
  assert.equal(getRoleArabicLabel('SUPER_ADMIN'), 'مدير المجموعة الأعلى');
  assert.equal(getRoleArabicLabel('COMPANY_ADMIN'), 'مدير الشركة');
  assert.equal(getRoleArabicLabel('MANAGER'), 'مدير القسم');
  assert.equal(getRoleArabicLabel('EMPLOYEE'), 'موظف');
});

test('PRIMARY_SUPER_ADMIN_EMAIL is strictly lumerecompany@gmail.com and always resolves to SUPER_ADMIN', () => {
  assert.equal(PRIMARY_SUPER_ADMIN_EMAIL, 'lumerecompany@gmail.com');
  assert.equal(
    isSuperAdmin({
      role: 'EMPLOYEE',
      email: 'lumerecompany@gmail.com',
      status: 'active',
    }),
    true
  );
  assert.equal(
    isSuperAdmin({
      role: 'EMPLOYEE',
      email: 'LUMERECOMPANY@GMAIL.COM',
      status: 'active',
    }),
    true
  );
});

test('getDefaultTabForRole lands each role on its exact hierarchy hub', () => {
  assert.equal(getDefaultTabForRole('SUPER_ADMIN', true), 'group_dashboard');
  assert.equal(getDefaultTabForRole('SUPER_ADMIN', false), 'dashboard');
  assert.equal(getDefaultTabForRole('COMPANY_ADMIN', false), 'dashboard');
  assert.equal(getDefaultTabForRole('MANAGER', false), 'departments');
  assert.equal(getDefaultTabForRole('EMPLOYEE', false), 'dashboard');
});

test('getAllowedTabsForRole and canAccessTab enforce strict 4-tier route isolation', () => {
  // Super Admin: full group + subsidiary access
  assert.equal(canAccessTab(superAdmin, 'group_dashboard'), true);
  assert.equal(canAccessTab(superAdmin, 'companies'), true);
  assert.equal(canAccessTab(superAdmin, 'settings'), true);

  // Company Admin: full company workspace, no group management
  assert.equal(canAccessTab(lumereAdmin, 'dashboard'), true);
  assert.equal(canAccessTab(lumereAdmin, 'departments'), true);
  assert.equal(canAccessTab(lumereAdmin, 'employees'), true);
  assert.equal(canAccessTab(lumereAdmin, 'settings'), true);
  assert.equal(canAccessTab(lumereAdmin, 'group_dashboard'), false);
  assert.equal(canAccessTab(lumereAdmin, 'companies'), false);

  // Manager: Department Management + department operations, no company settings/join requests/group
  assert.equal(canAccessTab(nexAuraManager, 'departments'), true);
  assert.equal(canAccessTab(nexAuraManager, 'dashboard'), true);
  assert.equal(canAccessTab(nexAuraManager, 'tasks'), true);
  assert.equal(canAccessTab(nexAuraManager, 'employees'), true);
  assert.equal(canAccessTab(nexAuraManager, 'group_dashboard'), false);
  assert.equal(canAccessTab(nexAuraManager, 'companies'), false);
  assert.equal(canAccessTab(nexAuraManager, 'join_requests'), false);
  assert.equal(canAccessTab(nexAuraManager, 'settings'), false);

  // Employee: Employee Dashboard + own tasks + calendar + notifications + profile ONLY
  assert.deepEqual(getAllowedTabsForRole('EMPLOYEE'), [
    'dashboard',
    'tasks',
    'calendar',
    'notifications',
    'profile',
  ]);
  assert.equal(canAccessTab(ordarkEmployee, 'dashboard'), true);
  assert.equal(canAccessTab(ordarkEmployee, 'tasks'), true);
  assert.equal(canAccessTab(ordarkEmployee, 'reports'), false);
  assert.equal(canAccessTab(ordarkEmployee, 'activity'), false);
  assert.equal(canAccessTab(ordarkEmployee, 'employees'), false);
  assert.equal(canAccessTab(ordarkEmployee, 'departments'), false);
  assert.equal(canAccessTab(ordarkEmployee, 'settings'), false);
  assert.equal(canAccessTab(ordarkEmployee, 'group_dashboard'), false);
  assert.equal(canAccessTab(pendingUser, 'dashboard'), false);
});

test('scopeEmployeesForUser, scopeDepartmentsForUser, and scopeTasksForUser enforce role-level data scoping', () => {
  const manager = {
    ...nexAuraManager,
    displayName: 'مدير الهندسة',
    department: 'الهندسة',
  };
  const employee = {
    ...ordarkEmployee,
    id: 'u-emp-1',
    companyId: 'nex-aura',
    department: 'الهندسة',
  };

  const allEmployees = [
    { ...manager, position: 'Manager', joinedDate: '2025-01-01' },
    { ...employee, displayName: 'مطور 1', position: 'Dev', joinedDate: '2025-01-01', managerId: manager.id },
    {
      id: 'u-emp-other',
      email: 'ops@nexaura.com',
      displayName: 'عمليات',
      role: 'EMPLOYEE' as const,
      status: 'active' as const,
      companyId: 'nex-aura',
      department: 'المبيعات',
      position: 'Sales',
      joinedDate: '2025-01-01',
    },
  ];

  const allDepartments = [
    { id: 'd-eng', companyId: 'nex-aura', name: 'الهندسة', description: 'فريق البرمجيات' },
    { id: 'd-sales', companyId: 'nex-aura', name: 'المبيعات', description: 'فريق المبيعات' },
  ];

  const allTasks = [
    {
      id: 't-1',
      companyId: 'nex-aura',
      taskId: 'NEX-1',
      title: 'تطوير واجهة',
      description: 'desc',
      createdBy: manager.id,
      createdByName: 'مدير الهندسة',
      assignedTo: 'u-emp-1',
      assignedToName: 'مطور 1',
      assignedToEmail: 'driver@ordark.com',
      department: 'الهندسة',
      priority: 'High' as const,
      status: 'In Progress' as const,
      startDate: '2025-01-01',
      deadline: '2025-02-01',
      completionPercentage: 40,
      reviewStatus: 'none' as const,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 't-2',
      companyId: 'nex-aura',
      taskId: 'NEX-2',
      title: 'صفقة مبيعات',
      description: 'desc',
      createdBy: 'u-lumere-admin',
      createdByName: 'Admin',
      assignedTo: 'u-emp-other',
      assignedToName: 'عمليات',
      assignedToEmail: 'ops@nexaura.com',
      department: 'المبيعات',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      startDate: '2025-01-01',
      deadline: '2025-02-05',
      completionPercentage: 0,
      reviewStatus: 'none' as const,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  // SUPER_ADMIN & COMPANY_ADMIN see full list
  assert.equal(scopeTasksForUser(superAdmin, allTasks, allEmployees).length, 2);
  assert.equal(scopeTasksForUser(lumereAdmin, allTasks, allEmployees).length, 2);

  // MANAGER sees only their department / team members & tasks
  assert.deepEqual(
    scopeDepartmentsForUser(manager, allDepartments).map(d => d.id),
    ['d-eng']
  );
  assert.deepEqual(
    scopeEmployeesForUser(manager, allEmployees).map(e => e.id),
    [manager.id, 'u-emp-1']
  );
  assert.deepEqual(
    scopeTasksForUser(manager, allTasks, allEmployees).map(t => t.id),
    ['t-1']
  );

  // EMPLOYEE sees only own tasks & self
  assert.deepEqual(
    scopeEmployeesForUser(employee, allEmployees).map(e => e.id),
    ['u-emp-1']
  );
  assert.deepEqual(
    scopeTasksForUser(employee, allTasks, allEmployees).map(t => t.id),
    ['t-1']
  );
});

test('employee sees tasks assigned via pre-created employee alias id, uid, coAssignees, or normalized email within same company only', () => {
  const signedInEmployee = {
    id: 'firebase-auth-uid-99',
    uid: 'firebase-auth-uid-99',
    email: 'Sara.Ali@lumere.com',
    displayName: 'سارة علي',
    role: 'EMPLOYEE' as const,
    status: 'Active' as const,
    companyId: 'lumere',
    department: 'التصميم',
    position: 'مصممة',
    joinedDate: '2025-02-01',
  };

  const preCreatedAlias = {
    id: 'auto-generated-doc-id-123',
    email: 'sara.ali@lumere.com',
    displayName: 'سارة علي',
    role: 'EMPLOYEE' as const,
    status: 'active' as const,
    companyId: 'lumere',
    department: 'التصميم',
    position: 'مصممة',
    joinedDate: '2025-01-15',
  };

  const crossCompanySameEmail = {
    id: 'other-company-doc-456',
    email: 'sara.ali@lumere.com',
    displayName: 'سارة شركة أخرى',
    role: 'EMPLOYEE' as const,
    status: 'active' as const,
    companyId: 'ordark',
    department: 'التصميم',
    position: 'مصممة',
    joinedDate: '2025-01-15',
  };

  const companyEmployees = [signedInEmployee, preCreatedAlias, crossCompanySameEmail];

  const baseTask = {
    companyId: 'lumere',
    taskId: 'TSK-100',
    title: 'تصميم الهوية',
    description: 'desc',
    createdBy: lumereAdmin.id,
    createdByName: 'Admin',
    assignedTo: 'someone-else',
    assignedToName: 'شخص آخر',
    assignedToEmail: '',
    department: 'التصميم',
    priority: 'High' as const,
    status: 'Pending' as const,
    startDate: '2025-02-01',
    deadline: '2025-02-10',
    completionPercentage: 0,
    reviewStatus: 'none' as const,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-02-01T00:00:00Z',
  };

  const candidateTasks = [
    { ...baseTask, id: 'task-by-alias-id', assignedTo: 'auto-generated-doc-id-123' },
    { ...baseTask, id: 'task-by-email', assignedTo: 'legacy-unknown-id', assignedToEmail: '  SARA.ALI@LUMERE.COM ' },
    { ...baseTask, id: 'task-by-coassignee', coAssignees: ['firebase-auth-uid-99'] },
    {
      ...baseTask,
      id: 'task-other-company-must-hide',
      companyId: 'ordark',
      assignedTo: 'other-company-doc-456',
      assignedToEmail: 'sara.ali@lumere.com',
    },
    { ...baseTask, id: 'task-unassigned-to-user', assignedTo: 'u-other-emp', assignedToEmail: 'other@lumere.com' },
  ];

  // App.tsx passes scopedEmployees to TasksView, which re-runs scopeTasksForUser
  const scopedEmps = scopeEmployeesForUser(signedInEmployee, companyEmployees);
  assert.deepEqual(
    scopedEmps.map(e => e.id),
    ['firebase-auth-uid-99', 'auto-generated-doc-id-123']
  );

  const firstPass = scopeTasksForUser(signedInEmployee, candidateTasks, companyEmployees);
  const secondPass = scopeTasksForUser(signedInEmployee, firstPass, scopedEmps);

  assert.deepEqual(
    secondPass.map(t => t.id),
    ['task-by-alias-id', 'task-by-email', 'task-by-coassignee']
  );
  assert.equal(isTaskAssignedToUser(signedInEmployee, candidateTasks[0], scopedEmps), true);
  assert.equal(isTaskAssignedToUser(signedInEmployee, candidateTasks[1], scopedEmps), true);
  assert.equal(isTaskAssignedToUser(signedInEmployee, candidateTasks[2], scopedEmps), true);
  assert.equal(isTaskAssignedToUser(signedInEmployee, candidateTasks[3], companyEmployees), false);
  assert.equal(isTaskAssignedToUser(signedInEmployee, candidateTasks[4], companyEmployees), false);
});
