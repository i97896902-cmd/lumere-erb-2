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
} from './rbac';
import { DEFAULT_SUBSIDIARY_ID, PARENT_COMPANY_ID } from '../config/companies';

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
  assert.equal(getRoleArabicLabel('MANAGER'), 'مدير قسم / مشاريع');
  assert.equal(getRoleArabicLabel('EMPLOYEE'), 'موظف');
});
