import {
  LEGACY_SUBSIDIARY_ID,
  NEX_AURA_ID,
  ORDARK_ID,
  PARENT_COMPANY_ID,
  PRIMARY_SUPER_ADMIN_EMAIL,
  RawDocument,
} from '../../migration/lib/migrationLogic';

export const REQUIRED_CORE_COMPANY_IDS = [
  PARENT_COMPANY_ID,
  LEGACY_SUBSIDIARY_ID,
  NEX_AURA_ID,
  ORDARK_ID,
] as const;

export const PRESERVED_SYSTEM_COLLECTIONS = [
  'companies',
  'admins',
  'settings',
  'system_config',
] as const;

export const ALLOWED_CLEANUP_COLLECTIONS = [
  'users',
  'departments',
  'clients',
  'projects',
  'tasks',
  'notifications',
  'activity_logs',
  'equipment',
  'equipmentHistory',
  'reports',
  'attendance',
] as const;

export type CleanupActionType =
  | 'delete_operational'
  | 'sanitize_assignments'
  | 'preserve_system'
  | 'preserve_admin'
  | 'preserve_config'
  | 'preserve_uncertain';

export interface CleanupPlanItem {
  collection: string;
  docId: string;
  action: CleanupActionType;
  reason: string;
  sanitizePatch?: Record<string, unknown>;
}

export interface AuthUserSummary {
  uid: string;
  email?: string;
  customClaims?: Record<string, unknown>;
}

export interface AuthCleanupItem {
  uid: string;
  email?: string;
  action: 'delete_auth_account' | 'preserve_admin_auth' | 'preserve_uncertain_auth';
  reason: string;
}

export interface StorageCleanupItem {
  objectPath: string;
  action: 'delete_storage_object' | 'preserve_company_asset' | 'preserve_uncertain_storage';
  reason: string;
}

export interface LaunchCleanupPlan {
  inventory: Record<string, number>;
  firestoreItems: CleanupPlanItem[];
  authItems: AuthCleanupItem[];
  storageItems: StorageCleanupItem[];
  summary: {
    totalInventoryDocs: number;
    plannedDeletes: number;
    plannedSanitizations: number;
    preservedSystemAndAdmin: number;
    preservedUncertain: number;
    plannedAuthDeletes: number;
    preservedAuthAccounts: number;
    plannedStorageDeletes: number;
    preservedStorageObjects: number;
  };
}

export interface PostCleanupVerification {
  passed: boolean;
  issues: string[];
}

export function isProtectedAdminUser(
  doc: RawDocument,
  adminMapIds: Set<string>
): boolean {
  const email = typeof doc.data.email === 'string' ? doc.data.email.trim().toLowerCase() : '';
  const role = typeof doc.data.role === 'string' ? doc.data.role.trim().toUpperCase() : '';
  if (email === PRIMARY_SUPER_ADMIN_EMAIL) return true;
  if (adminMapIds.has(doc.id)) return true;
  if (typeof doc.data.uid === 'string' && adminMapIds.has(doc.data.uid)) return true;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  return false;
}

export function buildOfficialLaunchCleanupPlan(params: {
  companies: RawDocument[];
  admins: RawDocument[];
  collections: Record<string, RawDocument[]>;
  taskComments: { taskId: string; comment: RawDocument }[];
  authUsers: AuthUserSummary[];
  storagePaths: string[];
}): LaunchCleanupPlan {
  const { companies, admins, collections, taskComments, authUsers, storagePaths } = params;

  const inventory: Record<string, number> = {
    companies: companies.length,
    admins: admins.length,
    task_comments: taskComments.length,
  };
  for (const col of ALLOWED_CLEANUP_COLLECTIONS) {
    inventory[col] = (collections[col] || []).length;
  }

  const firestoreItems: CleanupPlanItem[] = [];
  const adminMapIds = new Set(admins.map(a => a.id));

  // 1. Always preserve all company configurations and admin map records
  for (const company of companies) {
    firestoreItems.push({
      collection: 'companies',
      docId: company.id,
      action: 'preserve_system',
      reason: 'Core/configured company record must be preserved for official launch.',
    });
  }
  for (const adminDoc of admins) {
    firestoreItems.push({
      collection: 'admins',
      docId: adminDoc.id,
      action: 'preserve_system',
      reason: 'System administrator registry document must be preserved.',
    });
  }

  // 2. Classify users carefully — NEVER delete central admins or unclassifiable profiles
  const deletedUserIds = new Set<string>();
  const protectedAdminUids = new Set<string>(adminMapIds);
  const protectedAdminEmails = new Set<string>([PRIMARY_SUPER_ADMIN_EMAIL]);

  for (const userDoc of collections.users || []) {
    const email = typeof userDoc.data.email === 'string' ? userDoc.data.email.trim().toLowerCase() : '';
    const role = typeof userDoc.data.role === 'string' ? userDoc.data.role.trim().toUpperCase() : '';
    const uid = typeof userDoc.data.uid === 'string' && userDoc.data.uid.trim() ? userDoc.data.uid.trim() : userDoc.id;

    if (isProtectedAdminUser(userDoc, adminMapIds)) {
      protectedAdminUids.add(userDoc.id);
      protectedAdminUids.add(uid);
      if (email) protectedAdminEmails.add(email);
      firestoreItems.push({
        collection: 'users',
        docId: userDoc.id,
        action: 'preserve_admin',
        reason: 'Verified central SUPER_ADMIN account must be preserved.',
      });
      continue;
    }

    const isKnownNonAdminRole = ['EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN'].includes(role);
    const hasIdentityMetadata = Boolean(email || userDoc.data.displayName);
    if (isKnownNonAdminRole && hasIdentityMetadata) {
      deletedUserIds.add(userDoc.id);
      deletedUserIds.add(uid);
      firestoreItems.push({
        collection: 'users',
        docId: userDoc.id,
        action: 'delete_operational',
        reason: `Verified pre-launch ${role} employee profile scheduled for official reset.`,
      });
    } else {
      firestoreItems.push({
        collection: 'users',
        docId: userDoc.id,
        action: 'preserve_uncertain',
        reason: 'User document lacks confident role/ownership classification; preserved for manual audit.',
      });
    }
  }

  // 3. Departments: preserve company department structure, sanitize old employee manager assignments
  for (const deptDoc of collections.departments || []) {
    const companyId = typeof deptDoc.data.companyId === 'string' ? deptDoc.data.companyId.trim() : '';
    if (!companyId) {
      firestoreItems.push({
        collection: 'departments',
        docId: deptDoc.id,
        action: 'preserve_uncertain',
        reason: 'Department missing companyId; preserved for manual verification.',
      });
      continue;
    }

    const hasOldAssignment =
      Boolean(deptDoc.data.managerId) || Boolean(deptDoc.data.managerName) || Boolean(deptDoc.data.headName);
    if (hasOldAssignment) {
      firestoreItems.push({
        collection: 'departments',
        docId: deptDoc.id,
        action: 'sanitize_assignments',
        reason: 'Preserve company department structure while clearing pre-launch employee manager assignment.',
        sanitizePatch: {
          managerId: '',
          managerName: '',
          headName: '',
          employeesCount: 0,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          completionRate: 0,
        },
      });
    } else {
      firestoreItems.push({
        collection: 'departments',
        docId: deptDoc.id,
        action: 'preserve_config',
        reason: 'Clean company department configuration preserved.',
      });
    }
  }

  // 4. Equipment: preserve asset catalog while clearing old operational employee/project assignments
  for (const eqDoc of collections.equipment || []) {
    const hasName = typeof eqDoc.data.name === 'string' && eqDoc.data.name.trim().length > 0;
    if (!hasName) {
      firestoreItems.push({
        collection: 'equipment',
        docId: eqDoc.id,
        action: 'preserve_uncertain',
        reason: 'Equipment record missing name metadata; preserved for manual review.',
      });
      continue;
    }
    const hasAssignment =
      Boolean(eqDoc.data.assignedTo) || Boolean(eqDoc.data.projectId) || eqDoc.data.status === 'assigned';
    if (hasAssignment) {
      firestoreItems.push({
        collection: 'equipment',
        docId: eqDoc.id,
        action: 'sanitize_assignments',
        reason: 'Clear pre-launch employee/project equipment assignment and reset status to available.',
        sanitizePatch: {
          status: 'available',
          assignedTo: '',
          assignedToName: '',
          assignedToEmail: '',
          projectId: '',
          projectName: '',
        },
      });
    } else {
      firestoreItems.push({
        collection: 'equipment',
        docId: eqDoc.id,
        action: 'preserve_config',
        reason: 'Unassigned equipment asset record preserved.',
      });
    }
  }

  // 5. Operational collections scheduled for clean official reset
  const deletedTaskIds = new Set<string>();
  const deletedProjectIds = new Set<string>();

  const operationalDeleteCols: Array<{
    col: (typeof ALLOWED_CLEANUP_COLLECTIONS)[number];
    requiredKey: string;
    label: string;
  }> = [
    { col: 'clients', requiredKey: 'name', label: 'Pre-launch client record' },
    { col: 'projects', requiredKey: 'name', label: 'Pre-launch project record' },
    { col: 'tasks', requiredKey: 'title', label: 'Pre-launch task record' },
    { col: 'notifications', requiredKey: 'userId', label: 'Pre-launch notification record' },
    { col: 'activity_logs', requiredKey: 'action', label: 'Pre-launch operational activity log' },
    { col: 'equipmentHistory', requiredKey: 'equipmentId', label: 'Pre-launch equipment history record' },
    { col: 'reports', requiredKey: 'title', label: 'Pre-launch generated report snapshot' },
    { col: 'attendance', requiredKey: 'userId', label: 'Pre-launch attendance record' },
  ];

  for (const { col, requiredKey, label } of operationalDeleteCols) {
    for (const doc of collections[col] || []) {
      const hasExpectedField =
        typeof doc.data[requiredKey] === 'string' && String(doc.data[requiredKey]).trim().length > 0;
      if (!hasExpectedField) {
        firestoreItems.push({
          collection: col,
          docId: doc.id,
          action: 'preserve_uncertain',
          reason: `Document in ${col} missing expected "${requiredKey}" field; preserved for manual audit.`,
        });
        continue;
      }

      if (col === 'tasks') deletedTaskIds.add(doc.id);
      if (col === 'projects') deletedProjectIds.add(doc.id);

      firestoreItems.push({
        collection: col,
        docId: doc.id,
        action: 'delete_operational',
        reason: `${label} scheduled for official launch reset.`,
      });
    }
  }

  // 6. Task comments subcollections belonging to deleted tasks
  for (const { taskId, comment } of taskComments) {
    if (deletedTaskIds.has(taskId)) {
      firestoreItems.push({
        collection: `tasks/${taskId}/comments`,
        docId: comment.id,
        action: 'delete_operational',
        reason: `Comment belongs to deleted task ${taskId}.`,
      });
    } else {
      firestoreItems.push({
        collection: `tasks/${taskId}/comments`,
        docId: comment.id,
        action: 'preserve_uncertain',
        reason: `Parent task ${taskId} was not classified for deletion; preserving comment.`,
      });
    }
  }

  // 7. Firebase Auth Cleanup Classification (ONLY verified non-admin deleted employees)
  const authItems: AuthCleanupItem[] = [];
  for (const authUser of authUsers) {
    const email = (authUser.email || '').trim().toLowerCase();
    const claimRole =
      typeof authUser.customClaims?.role === 'string'
        ? authUser.customClaims.role.toUpperCase()
        : '';

    if (
      protectedAdminUids.has(authUser.uid) ||
      (email && protectedAdminEmails.has(email)) ||
      claimRole === 'SUPER_ADMIN' ||
      claimRole === 'ADMIN'
    ) {
      authItems.push({
        uid: authUser.uid,
        email: authUser.email,
        action: 'preserve_admin_auth',
        reason: 'Protected SUPER_ADMIN Firebase Auth account must never be deleted.',
      });
      continue;
    }

    if (deletedUserIds.has(authUser.uid)) {
      authItems.push({
        uid: authUser.uid,
        email: authUser.email,
        action: 'delete_auth_account',
        reason: 'Auth account matches verified deleted pre-launch employee profile.',
      });
    } else {
      authItems.push({
        uid: authUser.uid,
        email: authUser.email,
        action: 'preserve_uncertain_auth',
        reason: 'Auth account has no verified deletable employee match; preserved safely.',
      });
    }
  }

  // 8. Firebase Storage Cleanup Classification (NEVER touch company logos!)
  const storageItems: StorageCleanupItem[] = [];
  for (const objectPath of storagePaths) {
    if (/^companies\/[^/]+\/logos\//.test(objectPath)) {
      storageItems.push({
        objectPath,
        action: 'preserve_company_asset',
        reason: 'Company branding logo must be preserved.',
      });
      continue;
    }

    const taskMatch = objectPath.match(/^companies\/[^/]+\/tasks\/([^/]+)\//);
    if (taskMatch && deletedTaskIds.has(taskMatch[1])) {
      storageItems.push({
        objectPath,
        action: 'delete_storage_object',
        reason: `Task attachment belongs exclusively to deleted task ${taskMatch[1]}.`,
      });
      continue;
    }

    const projectMatch = objectPath.match(/^companies\/[^/]+\/projects\/([^/]+)\//);
    if (projectMatch && deletedProjectIds.has(projectMatch[1])) {
      storageItems.push({
        objectPath,
        action: 'delete_storage_object',
        reason: `Project file belongs exclusively to deleted project ${projectMatch[1]}.`,
      });
      continue;
    }

    const avatarMatch = objectPath.match(/^companies\/[^/]+\/avatars\/([^/]+)\//);
    if (avatarMatch && deletedUserIds.has(avatarMatch[1]) && !protectedAdminUids.has(avatarMatch[1])) {
      storageItems.push({
        objectPath,
        action: 'delete_storage_object',
        reason: `User avatar belongs exclusively to deleted employee ${avatarMatch[1]}.`,
      });
      continue;
    }

    storageItems.push({
      objectPath,
      action: 'preserve_uncertain_storage',
      reason: 'Storage object not proven to belong exclusively to a deleted operational record; preserved.',
    });
  }

  const totalInventoryDocs = Object.values(inventory).reduce((sum, count) => sum + count, 0);
  const plannedDeletes = firestoreItems.filter(i => i.action === 'delete_operational').length;
  const plannedSanitizations = firestoreItems.filter(i => i.action === 'sanitize_assignments').length;
  const preservedSystemAndAdmin = firestoreItems.filter(
    i => i.action === 'preserve_system' || i.action === 'preserve_admin' || i.action === 'preserve_config'
  ).length;
  const preservedUncertain = firestoreItems.filter(i => i.action === 'preserve_uncertain').length;

  return {
    inventory,
    firestoreItems,
    authItems,
    storageItems,
    summary: {
      totalInventoryDocs,
      plannedDeletes,
      plannedSanitizations,
      preservedSystemAndAdmin,
      preservedUncertain,
      plannedAuthDeletes: authItems.filter(a => a.action === 'delete_auth_account').length,
      preservedAuthAccounts: authItems.filter(a => a.action !== 'delete_auth_account').length,
      plannedStorageDeletes: storageItems.filter(s => s.action === 'delete_storage_object').length,
      preservedStorageObjects: storageItems.filter(s => s.action !== 'delete_storage_object').length,
    },
  };
}

export function verifyPostCleanupState(params: {
  companies: RawDocument[];
  users: RawDocument[];
  departments: RawDocument[];
  equipment: RawDocument[];
  remainingOperationalCounts: Record<string, number>;
}): PostCleanupVerification {
  const { companies, users, departments, equipment, remainingOperationalCounts } = params;
  const issues: string[] = [];

  const companyIds = new Set(companies.map(c => c.id));
  for (const requiredId of REQUIRED_CORE_COMPANY_IDS) {
    if (!companyIds.has(requiredId)) {
      issues.push(`Required core company "${requiredId}" is missing after cleanup.`);
    }
  }

  const hasSuperAdmin = users.some(u => {
    const role = typeof u.data.role === 'string' ? u.data.role.toUpperCase() : '';
    const email = typeof u.data.email === 'string' ? u.data.email.toLowerCase() : '';
    return role === 'SUPER_ADMIN' || email === PRIMARY_SUPER_ADMIN_EMAIL;
  });
  if (!hasSuperAdmin) {
    issues.push('No central SUPER_ADMIN account remains in users collection.');
  }

  const remainingUserIds = new Set(users.map(u => u.id));
  for (const dept of departments) {
    if (typeof dept.data.managerId === 'string' && dept.data.managerId && !remainingUserIds.has(dept.data.managerId)) {
      issues.push(`Department ${dept.id} still references deleted managerId ${dept.data.managerId}.`);
    }
  }

  for (const eq of equipment) {
    if (typeof eq.data.assignedTo === 'string' && eq.data.assignedTo && !remainingUserIds.has(eq.data.assignedTo)) {
      issues.push(`Equipment ${eq.id} still references deleted assignee ${eq.data.assignedTo}.`);
    }
  }

  for (const [col, count] of Object.entries(remainingOperationalCounts)) {
    if (count > 0) {
      issues.push(`Operational collection "${col}" still contains ${count} remaining record(s).`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
