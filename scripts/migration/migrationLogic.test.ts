import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFullMigrationPlan,
  LEGACY_SUBSIDIARY_ID,
  NEX_AURA_ID,
  ORDARK_ID,
  PARENT_COMPANY_ID,
  PRIMARY_SUPER_ADMIN_EMAIL,
  verifyPostMigrationState,
} from './lib/migrationLogic';

describe('Multi-company migration logic', () => {
  const nowIso = '2026-01-15T10:00:00.000Z';

  it('creates 4 core companies, promotes legacy admin to SUPER_ADMIN in parent group, and assigns legacy records to LUMERE without dropping fields', () => {
    const collections = {
      users: [
        {
          id: 'u-admin',
          data: {
            email: PRIMARY_SUPER_ADMIN_EMAIL,
            displayName: 'Lumere Admin',
            role: 'ADMIN',
            status: 'active',
            customLegacyField: 'keep-me',
          },
        },
        {
          id: 'u-emp-1',
          data: {
            email: 'designer@lumere.com',
            displayName: 'Sara',
            role: 'EMPLOYEE',
            status: 'active',
            department: 'التصميم',
          },
        },
      ],
      departments: [{ id: 'dept-1', data: { name: 'التصميم', description: 'قسم التصميم' } }],
      clients: [{ id: 'cli-1', data: { name: 'Client A', phone: '0500', email: 'a@b.com' } }],
      projects: [{ id: 'proj-1', data: { name: 'Campaign 1', clientId: 'cli-1', status: 'in_progress' } }],
      tasks: [{ id: 'task-1', data: { title: 'Video Edit', assignedTo: 'u-emp-1', projectId: 'proj-1' } }],
      notifications: [{ id: 'notif-1', data: { userId: 'u-emp-1', title: 'Hi', read: false } }],
      activity_logs: [{ id: 'log-1', data: { actorId: 'u-admin', action: 'Task Created', target: 'Video Edit' } }],
      equipment: [{ id: 'eq-1', data: { name: 'Sony FX3', serialNumber: 'SN-1', status: 'available' } }],
      equipmentHistory: [{ id: 'eqh-1', data: { equipmentId: 'eq-1', action: 'created' } }],
    };

    const taskComments = [
      { taskId: 'task-1', comment: { id: 'c-1', data: { userId: 'u-emp-1', message: 'Working on it' } } },
    ];

    const { items, summary } = buildFullMigrationPlan({
      existingCompanies: [],
      collections,
      taskComments,
      nowIso,
    });

    assert.equal(summary.byCollection.companies.create, 4);
    assert.equal(summary.byCollection.users.merge, 2);

    const adminPatch = items.find(i => i.collection === 'users' && i.docId === 'u-admin');
    assert.equal(adminPatch?.operation, 'merge');
    assert.equal(adminPatch?.payload?.role, 'SUPER_ADMIN');
    assert.equal(adminPatch?.payload?.companyId, PARENT_COMPANY_ID);

    const empPatch = items.find(i => i.collection === 'users' && i.docId === 'u-emp-1');
    assert.equal(empPatch?.operation, 'merge');
    assert.equal(empPatch?.payload?.companyId, LEGACY_SUBSIDIARY_ID);

    const commentPatch = items.find(i => i.collection === 'tasks/task-1/comments' && i.docId === 'c-1');
    assert.equal(commentPatch?.operation, 'merge');
    assert.equal(commentPatch?.payload?.companyId, LEGACY_SUBSIDIARY_ID);

    // Apply plan in-memory and confirm idempotency on second pass
    const migratedCompanies = items
      .filter(i => i.collection === 'companies' && i.operation === 'create')
      .map(i => ({ id: i.docId, data: i.payload! }));

    const migratedCollections: Record<string, { id: string; data: Record<string, unknown> }[]> = {};
    for (const [col, docs] of Object.entries(collections)) {
      migratedCollections[col] = docs.map(d => {
        const patch = items.find(i => i.collection === col && i.docId === d.id && i.operation === 'merge');
        return { id: d.id, data: patch ? { ...d.data, ...patch.payload } : d.data };
      });
    }
    // Add seeded subsidiary departments
    for (const deptCreate of items.filter(i => i.collection === 'departments' && i.operation === 'create')) {
      migratedCollections.departments.push({ id: deptCreate.docId, data: deptCreate.payload! });
    }
    const migratedComments = taskComments.map(tc => {
      const patch = items.find(
        i => i.collection === `tasks/${tc.taskId}/comments` && i.docId === tc.comment.id && i.operation === 'merge'
      );
      return {
        taskId: tc.taskId,
        comment: { id: tc.comment.id, data: patch ? { ...tc.comment.data, ...patch.payload } : tc.comment.data },
      };
    });

    // Verify original field preserved
    const migratedAdmin = migratedCollections.users.find(u => u.id === 'u-admin');
    assert.equal(migratedAdmin?.data.customLegacyField, 'keep-me');

    // Second pass must skip everything (idempotent!)
    const secondPass = buildFullMigrationPlan({
      existingCompanies: migratedCompanies,
      collections: migratedCollections,
      taskComments: migratedComments,
      nowIso,
    });
    assert.equal(secondPass.summary.totalPlannedCreates, 0);
    assert.equal(secondPass.summary.totalPlannedMerges, 0);

    // Post-migration verification must pass
    const report = verifyPostMigrationState({
      backupCounts: {
        users: 2,
        departments: 1,
        clients: 1,
        projects: 1,
        tasks: 1,
        notifications: 1,
        activity_logs: 1,
        equipment: 1,
        equipmentHistory: 1,
      },
      companies: migratedCompanies,
      collections: migratedCollections,
      taskComments: migratedComments,
    });
    assert.equal(report.passed, true);
    assert.equal(report.issues.length, 0);
  });

  it('detects missing companyId, dropped counts, and cross-company task-project mismatches', () => {
    const companies = [
      { id: PARENT_COMPANY_ID, data: { name: 'LUMERE GROUP' } },
      { id: LEGACY_SUBSIDIARY_ID, data: { name: 'LUMERE' } },
      { id: NEX_AURA_ID, data: { name: 'NEX AURA' } },
      { id: ORDARK_ID, data: { name: 'ORDARK' } },
    ];

    const report = verifyPostMigrationState({
      backupCounts: { projects: 2 },
      companies,
      collections: {
        users: [{ id: 'u1', data: { companyId: LEGACY_SUBSIDIARY_ID } }],
        departments: [],
        clients: [],
        projects: [{ id: 'p1', data: { companyId: NEX_AURA_ID } }],
        tasks: [{ id: 't1', data: { companyId: LEGACY_SUBSIDIARY_ID, projectId: 'p1', assignedTo: 'u1' } }],
        notifications: [],
        activity_logs: [],
        equipment: [],
        equipmentHistory: [],
      },
      taskComments: [],
    });

    assert.equal(report.passed, false);
    assert.ok(report.issues.some(i => i.collection === 'projects' && i.message.includes('count dropped')));
    assert.ok(report.issues.some(i => i.collection === 'tasks' && i.message.includes('linked project')));
  });
});
