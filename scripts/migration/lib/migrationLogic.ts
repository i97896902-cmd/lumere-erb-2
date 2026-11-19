export const PARENT_COMPANY_ID = 'lumere-group';
export const LEGACY_SUBSIDIARY_ID = 'lumere';
export const NEX_AURA_ID = 'nex-aura';
export const ORDARK_ID = 'ordark';
export const PRIMARY_SUPER_ADMIN_EMAIL = 'lumerecompany@gmail.com';

export const COMPANY_OWNED_COLLECTIONS = [
  'users',
  'departments',
  'clients',
  'projects',
  'tasks',
  'notifications',
  'activity_logs',
  'equipment',
  'equipmentHistory',
] as const;

export type CompanyOwnedCollection = (typeof COMPANY_OWNED_COLLECTIONS)[number];

export interface RawDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface MigrationPlanItem {
  collection: string;
  docId: string;
  operation: 'create' | 'merge' | 'skip';
  payload?: Record<string, unknown>;
  reason: string;
}

export interface MigrationSummary {
  totalPlannedCreates: number;
  totalPlannedMerges: number;
  totalSkipped: number;
  byCollection: Record<string, { create: number; merge: number; skip: number }>;
}

export interface VerificationIssue {
  severity: 'error' | 'warning';
  collection: string;
  docId?: string;
  message: string;
}

export interface VerificationReport {
  passed: boolean;
  checkedCollections: number;
  totalDocumentsChecked: number;
  issues: VerificationIssue[];
}

export function buildCoreCompaniesSeed(nowIso: string): RawDocument[] {
  return [
    {
      id: PARENT_COMPANY_ID,
      data: {
        name: 'LUMERE GROUP',
        arabicName: 'مجموعة لومير القابضة',
        slug: 'lumere-group',
        type: 'parent',
        parentCompanyId: null,
        logo: '',
        description: 'الإدارة المركزية لمجموعة لومير القابضة والإشراف التنفيذي على كافة الشركات التابعة.',
        businessSector: 'الإدارة المركزية والقابضة',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    },
    {
      id: LEGACY_SUBSIDIARY_ID,
      data: {
        name: 'LUMERE',
        arabicName: 'لومير للإعلام والتسويق',
        slug: 'lumere',
        type: 'subsidiary',
        parentCompanyId: PARENT_COMPANY_ID,
        logo: '',
        description: 'شركة متخصصة في الإعلام، التسويق الإبداعي، الإعلان، والإنتاج المرئي.',
        businessSector: 'الإعلام والتسويق والإعلان',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    },
    {
      id: NEX_AURA_ID,
      data: {
        name: 'NEX AURA',
        arabicName: 'نيكس أورا للتقنية والبرمجيات',
        slug: 'nex-aura',
        type: 'subsidiary',
        parentCompanyId: PARENT_COMPANY_ID,
        logo: '',
        description: 'شركة تطوير البرمجيات والحلول التقنية وتصميم الأنظمة الرقمية.',
        businessSector: 'تطوير البرمجيات والتقنية',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    },
    {
      id: ORDARK_ID,
      data: {
        name: 'ORDARK',
        arabicName: 'أوردارك للتوصيل واللوجستيات',
        slug: 'ordark',
        type: 'subsidiary',
        parentCompanyId: PARENT_COMPANY_ID,
        logo: '',
        description: 'شركة التوصيل والخدمات اللوجستية وإدارة الأسطول والتوزيع.',
        businessSector: 'التوصيل واللوجستيات',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    },
  ];
}

export function buildSubsidiaryDepartmentsSeed(nowIso: string): RawDocument[] {
  return [
    // NEX AURA departments
    {
      id: 'nex-aura-software-dev',
      data: {
        companyId: NEX_AURA_ID,
        name: 'تطوير البرمجيات',
        description: 'هندسة الحلول البرمجية وإدارة معمارية الأنظمة المؤسسية.',
        color: 'bg-blue-700',
        createdAt: nowIso,
      },
    },
    {
      id: 'nex-aura-frontend',
      data: {
        companyId: NEX_AURA_ID,
        name: 'تطوير الواجهات الأمامية',
        description: 'تطوير تطبيقات الويب التفاعلية وتجارب المستخدم الحديثة.',
        color: 'bg-sky-600',
        createdAt: nowIso,
      },
    },
    {
      id: 'nex-aura-backend',
      data: {
        companyId: NEX_AURA_ID,
        name: 'تطوير الأنظمة الخلفية',
        description: 'بناء واجهات البرمجة وقواعد البيانات والبنية السحابية.',
        color: 'bg-indigo-600',
        createdAt: nowIso,
      },
    },
    {
      id: 'nex-aura-ui-ux',
      data: {
        companyId: NEX_AURA_ID,
        name: 'تصميم تجربة وواجهة المستخدم UI/UX',
        description: 'البحث التفاعلي وتصميم نماذج المنتجات الرقمية وتجربة المستخدم.',
        color: 'bg-cyan-600',
        createdAt: nowIso,
      },
    },
    {
      id: 'nex-aura-qa',
      data: {
        companyId: NEX_AURA_ID,
        name: 'ضمان الجودة QA',
        description: 'اختبار البرمجيات والتحقق من الموثوقية والأداء قبل الإطلاق.',
        color: 'bg-slate-700',
        createdAt: nowIso,
      },
    },
    // ORDARK departments
    {
      id: 'ordark-operations',
      data: {
        companyId: ORDARK_ID,
        name: 'العمليات اللوجستية',
        description: 'تخطيط العمليات اليومية وإدارة سلاسل الإمداد ومؤشرات التوصيل.',
        color: 'bg-amber-700',
        createdAt: nowIso,
      },
    },
    {
      id: 'ordark-dispatch',
      data: {
        companyId: ORDARK_ID,
        name: 'التوجيه والمتابعة',
        description: 'توزيع الطلبات وجدولة المسارات ومتابعة الأسطول لحظياً.',
        color: 'bg-orange-600',
        createdAt: nowIso,
      },
    },
    {
      id: 'ordark-drivers',
      data: {
        companyId: ORDARK_ID,
        name: 'السائقون والتوصيل',
        description: 'إدارة فريق السائقين الميداني وتنفيذ عمليات التسليم للعملاء.',
        color: 'bg-yellow-700',
        createdAt: nowIso,
      },
    },
    {
      id: 'ordark-customer-support',
      data: {
        companyId: ORDARK_ID,
        name: 'خدمة العملاء',
        description: 'دعم العملاء والرد على استفسارات الشحنات ومعالجة البلاغات.',
        color: 'bg-stone-700',
        createdAt: nowIso,
      },
    },
  ];
}

/**
 * Computes an idempotent, non-destructive migration plan for a single document.
 * Never deletes existing fields or changes document IDs.
 */
export function planDocumentMigration(
  collection: string,
  doc: RawDocument,
  nowIso: string
): MigrationPlanItem {
  const existingCompanyId =
    typeof doc.data.companyId === 'string' && doc.data.companyId.trim().length > 0
      ? doc.data.companyId.trim()
      : null;

  if (collection === 'users') {
    const email = typeof doc.data.email === 'string' ? doc.data.email.trim().toLowerCase() : '';
    const existingRole = typeof doc.data.role === 'string' ? doc.data.role : '';
    const isPrimarySuperAdmin = email === PRIMARY_SUPER_ADMIN_EMAIL || existingRole === 'ADMIN';

    const patch: Record<string, unknown> = {};
    if (!existingCompanyId) {
      patch.companyId = isPrimarySuperAdmin ? PARENT_COMPANY_ID : LEGACY_SUBSIDIARY_ID;
      patch.companyName = isPrimarySuperAdmin ? 'LUMERE GROUP' : 'LUMERE';
    }
    if (existingRole === 'ADMIN' || (email === PRIMARY_SUPER_ADMIN_EMAIL && existingRole !== 'SUPER_ADMIN')) {
      patch.role = 'SUPER_ADMIN';
    }
    if (!doc.data.uid) {
      patch.uid = doc.id;
    }

    if (Object.keys(patch).length === 0) {
      return {
        collection,
        docId: doc.id,
        operation: 'skip',
        reason: 'User document already has companyId and canonical role.',
      };
    }

    patch.updatedAt = nowIso;
    return {
      collection,
      docId: doc.id,
      operation: 'merge',
      payload: patch,
      reason: `Attach ${patch.companyId ? `companyId=${String(patch.companyId)}` : 'metadata'} without altering existing fields.`,
    };
  }

  if (existingCompanyId) {
    return {
      collection,
      docId: doc.id,
      operation: 'skip',
      reason: `Document already belongs to companyId=${existingCompanyId}.`,
    };
  }

  return {
    collection,
    docId: doc.id,
    operation: 'merge',
    payload: {
      companyId: LEGACY_SUBSIDIARY_ID,
      updatedAt: doc.data.updatedAt || nowIso,
    },
    reason: `Assign legacy record to subsidiary ${LEGACY_SUBSIDIARY_ID}.`,
  };
}

export function buildFullMigrationPlan(params: {
  existingCompanies: RawDocument[];
  collections: Record<string, RawDocument[]>;
  taskComments: { taskId: string; comment: RawDocument }[];
  nowIso: string;
}): { items: MigrationPlanItem[]; summary: MigrationSummary } {
  const { existingCompanies, collections, taskComments, nowIso } = params;
  const items: MigrationPlanItem[] = [];

  const existingCompanyIds = new Set(existingCompanies.map(c => c.id));
  for (const seedCompany of buildCoreCompaniesSeed(nowIso)) {
    if (existingCompanyIds.has(seedCompany.id)) {
      items.push({
        collection: 'companies',
        docId: seedCompany.id,
        operation: 'skip',
        reason: 'Company document already exists.',
      });
    } else {
      items.push({
        collection: 'companies',
        docId: seedCompany.id,
        operation: 'create',
        payload: seedCompany.data,
        reason: `Create core ${String(seedCompany.data.type)} company ${String(seedCompany.data.name)}.`,
      });
    }
  }

  // Migrate existing records across all company-owned collections
  for (const colName of COMPANY_OWNED_COLLECTIONS) {
    const docs = collections[colName] || [];
    for (const doc of docs) {
      items.push(planDocumentMigration(colName, doc, nowIso));
    }
  }

  // Seed default departments for NEX AURA and ORDARK only if not already created
  const existingDeptIds = new Set((collections.departments || []).map(d => d.id));
  for (const deptSeed of buildSubsidiaryDepartmentsSeed(nowIso)) {
    if (existingDeptIds.has(deptSeed.id)) {
      items.push({
        collection: 'departments',
        docId: deptSeed.id,
        operation: 'skip',
        reason: 'Subsidiary department already exists.',
      });
    } else {
      items.push({
        collection: 'departments',
        docId: deptSeed.id,
        operation: 'create',
        payload: deptSeed.data,
        reason: `Seed suggested department for ${String(deptSeed.data.companyId)}.`,
      });
    }
  }

  // Migrate task comments subcollection
  const taskCompanyMap = new Map<string, string>();
  for (const taskDoc of collections.tasks || []) {
    const cid =
      typeof taskDoc.data.companyId === 'string' && taskDoc.data.companyId.trim().length > 0
        ? taskDoc.data.companyId.trim()
        : LEGACY_SUBSIDIARY_ID;
    taskCompanyMap.set(taskDoc.id, cid);
  }

  for (const { taskId, comment } of taskComments) {
    const commentCompanyId =
      typeof comment.data.companyId === 'string' && comment.data.companyId.trim().length > 0
        ? comment.data.companyId.trim()
        : null;
    if (commentCompanyId) {
      items.push({
        collection: `tasks/${taskId}/comments`,
        docId: comment.id,
        operation: 'skip',
        reason: 'Comment already has companyId.',
      });
    } else {
      const targetCompanyId = taskCompanyMap.get(taskId) || LEGACY_SUBSIDIARY_ID;
      items.push({
        collection: `tasks/${taskId}/comments`,
        docId: comment.id,
        operation: 'merge',
        payload: { companyId: targetCompanyId },
        reason: `Assign comment to parent task companyId=${targetCompanyId}.`,
      });
    }
  }

  const byCollection: Record<string, { create: number; merge: number; skip: number }> = {};
  let totalPlannedCreates = 0;
  let totalPlannedMerges = 0;
  let totalSkipped = 0;

  for (const item of items) {
    const bucketKey = item.collection.includes('/comments') ? 'task_comments' : item.collection;
    if (!byCollection[bucketKey]) {
      byCollection[bucketKey] = { create: 0, merge: 0, skip: 0 };
    }
    byCollection[bucketKey][item.operation]++;
    if (item.operation === 'create') totalPlannedCreates++;
    if (item.operation === 'merge') totalPlannedMerges++;
    if (item.operation === 'skip') totalSkipped++;
  }

  return {
    items,
    summary: {
      totalPlannedCreates,
      totalPlannedMerges,
      totalSkipped,
      byCollection,
    },
  };
}

export function verifyPostMigrationState(params: {
  backupCounts: Record<string, number>;
  companies: RawDocument[];
  collections: Record<string, RawDocument[]>;
  taskComments: { taskId: string; comment: RawDocument }[];
}): VerificationReport {
  const { backupCounts, companies, collections, taskComments } = params;
  const issues: VerificationIssue[] = [];
  let totalDocumentsChecked = 0;

  const companyIds = new Set(companies.map(c => c.id));
  for (const requiredId of [PARENT_COMPANY_ID, LEGACY_SUBSIDIARY_ID, NEX_AURA_ID, ORDARK_ID]) {
    if (!companyIds.has(requiredId)) {
      issues.push({
        severity: 'error',
        collection: 'companies',
        docId: requiredId,
        message: `Required core company "${requiredId}" is missing.`,
      });
    }
  }

  // Check count preservation (no records lost during migration)
  for (const colName of COMPANY_OWNED_COLLECTIONS) {
    const expectedMin = backupCounts[colName] ?? 0;
    const actualDocs = collections[colName] || [];
    if (actualDocs.length < expectedMin) {
      issues.push({
        severity: 'error',
        collection: colName,
        message: `Document count dropped from backup (${expectedMin}) to current (${actualDocs.length}).`,
      });
    }

    for (const doc of actualDocs) {
      totalDocumentsChecked++;
      const cid = doc.data.companyId;
      if (typeof cid !== 'string' || cid.trim().length === 0) {
        issues.push({
          severity: 'error',
          collection: colName,
          docId: doc.id,
          message: 'Missing companyId field.',
        });
      } else if (!companyIds.has(cid)) {
        issues.push({
          severity: 'error',
          collection: colName,
          docId: doc.id,
          message: `Invalid companyId "${cid}" does not exist in companies collection.`,
        });
      }
    }
  }

  // Cross-collection referential integrity: tasks -> assignee & project must share companyId
  const userCompanyById = new Map<string, string>();
  for (const u of collections.users || []) {
    if (typeof u.data.companyId === 'string') {
      userCompanyById.set(u.id, u.data.companyId);
    }
  }

  const projectCompanyById = new Map<string, string>();
  for (const p of collections.projects || []) {
    if (typeof p.data.companyId === 'string') {
      projectCompanyById.set(p.id, p.data.companyId);
    }
  }

  for (const task of collections.tasks || []) {
    const taskCompanyId = typeof task.data.companyId === 'string' ? task.data.companyId : '';
    const assignedTo = typeof task.data.assignedTo === 'string' ? task.data.assignedTo : '';
    const projectId = typeof task.data.projectId === 'string' ? task.data.projectId : '';

    if (assignedTo && userCompanyById.has(assignedTo)) {
      const assigneeCompany = userCompanyById.get(assignedTo);
      if (assigneeCompany !== taskCompanyId && assigneeCompany !== PARENT_COMPANY_ID) {
        issues.push({
          severity: 'warning',
          collection: 'tasks',
          docId: task.id,
          message: `Task companyId (${taskCompanyId}) differs from assignee (${assignedTo}) companyId (${assigneeCompany}).`,
        });
      }
    }

    if (projectId && projectCompanyById.has(projectId)) {
      const projCompany = projectCompanyById.get(projectId);
      if (projCompany !== taskCompanyId) {
        issues.push({
          severity: 'error',
          collection: 'tasks',
          docId: task.id,
          message: `Task companyId (${taskCompanyId}) differs from linked project (${projectId}) companyId (${projCompany}).`,
        });
      }
    }
  }

  for (const { taskId, comment } of taskComments) {
    totalDocumentsChecked++;
    const cid = comment.data.companyId;
    if (typeof cid !== 'string' || !companyIds.has(cid)) {
      issues.push({
        severity: 'error',
        collection: `tasks/${taskId}/comments`,
        docId: comment.id,
        message: 'Comment is missing a valid companyId.',
      });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return {
    passed: !hasErrors,
    checkedCollections: COMPANY_OWNED_COLLECTIONS.length + 2,
    totalDocumentsChecked,
    issues,
  };
}
