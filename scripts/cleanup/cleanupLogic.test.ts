import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfficialLaunchCleanupPlan,
  verifyPostCleanupState,
} from './lib/cleanupLogic';
import {
  LEGACY_SUBSIDIARY_ID,
  NEX_AURA_ID,
  ORDARK_ID,
  PARENT_COMPANY_ID,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from '../migration/lib/migrationLogic';

describe('Official Launch Controlled Database Cleanup Safety Suite', () => {
  it('preserves all 4 core companies, central SUPER_ADMIN (Firestore + Auth), company logos, and uncertain docs while cleaning operational records cleanly', () => {
    const companies = [
      { id: PARENT_COMPANY_ID, data: { name: 'LUMERE GROUP', type: 'parent', status: 'active' } },
      { id: LEGACY_SUBSIDIARY_ID, data: { name: 'LUMERE', type: 'subsidiary', status: 'active' } },
      { id: NEX_AURA_ID, data: { name: 'NEX AURA', type: 'subsidiary', status: 'active' } },
      { id: ORDARK_ID, data: { name: 'ORDARK', type: 'subsidiary', status: 'active' } },
    ];
    const admins = [{ id: 'uid-super-admin', data: { role: 'SUPER_ADMIN' } }];

    const collections = {
      users: [
        {
          id: 'uid-super-admin',
          data: {
            uid: 'uid-super-admin',
            email: PRIMARY_SUPER_ADMIN_EMAIL,
            displayName: 'Central Admin',
            role: 'SUPER_ADMIN',
            companyId: PARENT_COMPANY_ID,
            status: 'active',
          },
        },
        {
          id: 'uid-emp-old-1',
          data: {
            uid: 'uid-emp-old-1',
            email: 'old.emp@lumere.com',
            displayName: 'Old Employee',
            role: 'EMPLOYEE',
            companyId: LEGACY_SUBSIDIARY_ID,
            status: 'active',
          },
        },
        {
          id: 'uid-mgr-old-2',
          data: {
            uid: 'uid-mgr-old-2',
            email: 'old.mgr@lumere.com',
            displayName: 'Old Manager',
            role: 'MANAGER',
            companyId: LEGACY_SUBSIDIARY_ID,
            status: 'active',
          },
        },
        {
          id: 'uid-ambiguous-doc',
          data: {
            note: 'unknown record without role or email',
          },
        },
      ],
      departments: [
        {
          id: 'dept-lumere-marketing',
          data: {
            companyId: LEGACY_SUBSIDIARY_ID,
            name: 'التسويق',
            managerId: 'uid-mgr-old-2',
            managerName: 'Old Manager',
          },
        },
        {
          id: 'dept-nex-dev',
          data: {
            companyId: NEX_AURA_ID,
            name: 'تطوير البرمجيات',
          },
        },
      ],
      clients: [{ id: 'cli-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, name: 'Old Client' } }],
      projects: [{ id: 'prj-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, name: 'Old Campaign' } }],
      tasks: [{ id: 'tsk-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, title: 'Old Task', assignedTo: 'uid-emp-old-1' } }],
      notifications: [{ id: 'ntf-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, userId: 'uid-emp-old-1', title: 'Hi' } }],
      activity_logs: [{ id: 'log-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, action: 'Task Created' } }],
      equipment: [
        {
          id: 'eq-cam-1',
          data: {
            companyId: LEGACY_SUBSIDIARY_ID,
            name: 'Sony FX3',
            status: 'assigned',
            assignedTo: 'uid-emp-old-1',
            projectId: 'prj-old-1',
          },
        },
      ],
      equipmentHistory: [{ id: 'eqh-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, equipmentId: 'eq-cam-1', action: 'assigned' } }],
      reports: [{ id: 'rpt-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, title: 'Old Report' } }],
      attendance: [{ id: 'att-old-1', data: { companyId: LEGACY_SUBSIDIARY_ID, userId: 'uid-emp-old-1' } }],
    };

    const taskComments = [
      { taskId: 'tsk-old-1', comment: { id: 'cmt-1', data: { userId: 'uid-emp-old-1', message: 'Old comment' } } },
    ];

    const authUsers = [
      { uid: 'uid-super-admin', email: PRIMARY_SUPER_ADMIN_EMAIL, customClaims: { role: 'SUPER_ADMIN' } },
      { uid: 'uid-emp-old-1', email: 'old.emp@lumere.com', customClaims: { role: 'EMPLOYEE' } },
      { uid: 'uid-unmatched-auth', email: 'external@example.com' },
    ];

    const storagePaths = [
      'companies/lumere/logos/logo.png',
      'companies/lumere/tasks/tsk-old-1/file.pdf',
      'companies/lumere/projects/prj-old-1/brief.pdf',
      'companies/lumere/avatars/uid-emp-old-1/avatar.jpg',
      'companies/lumere/avatars/uid-super-admin/admin.jpg',
      'companies/nex-aura/misc/unknown-file.bin',
    ];

    const plan = buildOfficialLaunchCleanupPlan({
      companies,
      admins,
      collections,
      taskComments,
      authUsers,
      storagePaths,
    });

    // Core companies & admins preserved
    for (const cid of [PARENT_COMPANY_ID, LEGACY_SUBSIDIARY_ID, NEX_AURA_ID, ORDARK_ID]) {
      const item = plan.firestoreItems.find(i => i.collection === 'companies' && i.docId === cid);
      assert.equal(item?.action, 'preserve_system');
    }
    assert.equal(
      plan.firestoreItems.find(i => i.collection === 'users' && i.docId === 'uid-super-admin')?.action,
      'preserve_admin'
    );

    // Ambiguous doc NEVER deleted
    assert.equal(
      plan.firestoreItems.find(i => i.collection === 'users' && i.docId === 'uid-ambiguous-doc')?.action,
      'preserve_uncertain'
    );

    // Verified old employees & operational docs deleted
    assert.equal(
      plan.firestoreItems.find(i => i.collection === 'users' && i.docId === 'uid-emp-old-1')?.action,
      'delete_operational'
    );
    assert.equal(
      plan.firestoreItems.find(i => i.collection === 'tasks/tsk-old-1/comments' && i.docId === 'cmt-1')?.action,
      'delete_operational'
    );

    // Department and equipment sanitized rather than destroyed
    const deptItem = plan.firestoreItems.find(i => i.collection === 'departments' && i.docId === 'dept-lumere-marketing');
    assert.equal(deptItem?.action, 'sanitize_assignments');
    assert.equal(deptItem?.sanitizePatch?.managerId, '');

    const eqItem = plan.firestoreItems.find(i => i.collection === 'equipment' && i.docId === 'eq-cam-1');
    assert.equal(eqItem?.action, 'sanitize_assignments');
    assert.equal(eqItem?.sanitizePatch?.status, 'available');

    // Auth cleanup: deletes ONLY verified employee, preserves SUPER_ADMIN and unmatched Auth account
    assert.equal(plan.authItems.find(a => a.uid === 'uid-super-admin')?.action, 'preserve_admin_auth');
    assert.equal(plan.authItems.find(a => a.uid === 'uid-emp-old-1')?.action, 'delete_auth_account');
    assert.equal(plan.authItems.find(a => a.uid === 'uid-unmatched-auth')?.action, 'preserve_uncertain_auth');

    // Storage cleanup: preserves logos, admin avatar, and unknown paths; deletes ONLY operational files of deleted records
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('/logos/'))?.action, 'preserve_company_asset');
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('tsk-old-1'))?.action, 'delete_storage_object');
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('prj-old-1'))?.action, 'delete_storage_object');
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('uid-emp-old-1'))?.action, 'delete_storage_object');
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('uid-super-admin'))?.action, 'preserve_uncertain_storage');
    assert.equal(plan.storageItems.find(s => s.objectPath.includes('unknown-file.bin'))?.action, 'preserve_uncertain_storage');

    // Simulate applying plan and run post-cleanup integrity verification
    const postUsers = collections.users.filter(
      u => plan.firestoreItems.find(i => i.collection === 'users' && i.docId === u.id)?.action !== 'delete_operational'
    );
    const postDepts = collections.departments.map(d => {
      const p = plan.firestoreItems.find(i => i.collection === 'departments' && i.docId === d.id);
      return p?.action === 'sanitize_assignments' ? { id: d.id, data: { ...d.data, ...p.sanitizePatch } } : d;
    });
    const postEq = collections.equipment.map(e => {
      const p = plan.firestoreItems.find(i => i.collection === 'equipment' && i.docId === e.id);
      return p?.action === 'sanitize_assignments' ? { id: e.id, data: { ...e.data, ...p.sanitizePatch } } : e;
    });

    const verification = verifyPostCleanupState({
      companies,
      users: postUsers,
      departments: postDepts,
      equipment: postEq,
      remainingOperationalCounts: {
        clients: 0,
        projects: 0,
        tasks: 0,
        notifications: 0,
        activity_logs: 0,
        equipmentHistory: 0,
        reports: 0,
        attendance: 0,
      },
    });
    assert.equal(verification.passed, true);
    assert.deepEqual(verification.issues, []);
  });

  it('fails post-cleanup verification if a core company or SUPER_ADMIN is missing or orphaned references remain', () => {
    const verification = verifyPostCleanupState({
      companies: [{ id: PARENT_COMPANY_ID, data: { name: 'LUMERE GROUP' } }],
      users: [],
      departments: [{ id: 'd1', data: { managerId: 'deleted-uid' } }],
      equipment: [{ id: 'e1', data: { assignedTo: 'deleted-uid' } }],
      remainingOperationalCounts: { tasks: 2 },
    });
    assert.equal(verification.passed, false);
    assert.ok(verification.issues.some(m => m.includes('lumere')));
    assert.ok(verification.issues.some(m => m.includes('SUPER_ADMIN')));
    assert.ok(verification.issues.some(m => m.includes('deleted managerId')));
    assert.ok(verification.issues.some(m => m.includes('deleted assignee')));
    assert.ok(verification.issues.some(m => m.includes('tasks')));
  });
});
