/**
 * Controlled Official Launch Database Cleanup Script for Lumere Group Multi-Company ERP.
 *
 * SAFETY GUARANTEES:
 * 1. Defaults strictly to DRY-RUN mode. Never deletes without ALL THREE flags:
 *      --apply --backup-manifest <path> --confirm-approval LAUNCH_CLEANUP_APPROVED
 * 2. Verifies SHA-256 checksums of every file in the backup manifest before any mutation.
 * 3. Uses an explicit collection allowlist and preserves all core companies, system configs,
 *    and central SUPER_ADMIN accounts (Firestore + Auth + Storage logos).
 * 4. Preserves and reports any ambiguous document rather than guessing.
 * 5. Writes a complete JSON audit report of inventory, plan, and execution results.
 *
 * Usage:
 *   Dry-run preview:
 *     npx tsx scripts/cleanup/cleanupForLaunch.ts --dry-run
 *   Approved execution (ONLY after verified backup & operator approval):
 *     npx tsx scripts/cleanup/cleanupForLaunch.ts \
 *       --backup-manifest backups/firestore-.../manifest.json \
 *       --confirm-approval LAUNCH_CLEANUP_APPROVED \
 *       --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { RawDocument } from '../migration/lib/migrationLogic';
import {
  ALLOWED_CLEANUP_COLLECTIONS,
  AuthUserSummary,
  buildOfficialLaunchCleanupPlan,
  verifyPostCleanupState,
} from './lib/cleanupLogic';

const APPROVAL_TOKEN = 'LAUNCH_CLEANUP_APPROVED';

function initAdminServices() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential =
    saPath && fs.existsSync(saPath)
      ? cert(JSON.parse(fs.readFileSync(saPath, 'utf-8')))
      : applicationDefault();

  const app = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  });

  const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

  return { db, auth, storage };
}

function verifyBackupManifest(manifestPath: string) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found at: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const backupDir = path.dirname(manifestPath);
  const checksums = manifest.checksums || {};
  const entries = Object.entries(checksums);
  if (entries.length === 0) {
    throw new Error('Backup manifest contains no file checksums.');
  }

  for (const [fileName, expectedSha] of entries) {
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file missing: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const actualSha = crypto.createHash('sha256').update(content).digest('hex');
    if (actualSha !== expectedSha) {
      throw new Error(`Backup checksum mismatch for ${fileName}.`);
    }
  }
  return manifest;
}

async function runControlledCleanup() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const manifestIdx = args.indexOf('--backup-manifest');
  const manifestPath = manifestIdx >= 0 ? args[manifestIdx + 1] : null;
  const approvalIdx = args.indexOf('--confirm-approval');
  const approvalToken = approvalIdx >= 0 ? args[approvalIdx + 1] : null;

  if (apply) {
    if (!manifestPath) {
      console.error('[CLEANUP] ABORTED: --apply requires --backup-manifest <path>.');
      process.exit(1);
    }
    if (approvalToken !== APPROVAL_TOKEN) {
      console.error(`[CLEANUP] ABORTED: --apply requires --confirm-approval ${APPROVAL_TOKEN}.`);
      process.exit(1);
    }
    verifyBackupManifest(manifestPath);
    console.log('[CLEANUP] Backup manifest and SHA-256 checksums verified.');
  }

  const { db, auth, storage } = initAdminServices();

  // Read live inventory from allowlisted collections only
  const [companiesSnap, adminsSnap] = await Promise.all([
    db.collection('companies').get(),
    db.collection('admins').get(),
  ]);

  const companies: RawDocument[] = companiesSnap.docs.map(d => ({ id: d.id, data: d.data() }));
  const admins: RawDocument[] = adminsSnap.docs.map(d => ({ id: d.id, data: d.data() }));
  const collections: Record<string, RawDocument[]> = {};

  for (const colName of ALLOWED_CLEANUP_COLLECTIONS) {
    const snap = await db.collection(colName).get();
    collections[colName] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  }

  const taskComments: { taskId: string; comment: RawDocument }[] = [];
  for (const taskDoc of collections.tasks || []) {
    const cSnap = await db.collection('tasks').doc(taskDoc.id).collection('comments').get();
    for (const c of cSnap.docs) {
      taskComments.push({ taskId: taskDoc.id, comment: { id: c.id, data: c.data() } });
    }
  }

  // List Firebase Auth users (paginated)
  const authUsers: AuthUserSummary[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await auth.listUsers(1000, pageToken);
    for (const u of listRes.users) {
      authUsers.push({
        uid: u.uid,
        email: u.email,
        customClaims: u.customClaims as Record<string, unknown> | undefined,
      });
    }
    pageToken = listRes.pageToken;
  } while (pageToken);

  // List Storage files under companies/
  let storagePaths: string[] = [];
  try {
    const [files] = await storage.bucket().getFiles({ prefix: 'companies/' });
    storagePaths = files.map(f => f.name);
  } catch (err) {
    console.warn('[CLEANUP] Storage listing skipped or unavailable:', err);
  }

  const plan = buildOfficialLaunchCleanupPlan({
    companies,
    admins,
    collections,
    taskComments,
    authUsers,
    storagePaths,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `cleanup-report-${apply ? 'applied' : 'dryrun'}-${timestamp}.json`);

  console.log('\n================ OFFICIAL LAUNCH CLEANUP PREVIEW ================');
  console.log('Mode:', apply ? 'APPLY (DESTRUCTIVE)' : 'DRY-RUN (NO CHANGES)');
  console.log('Inventory:', plan.inventory);
  console.log('Summary:', plan.summary);

  if (!apply) {
    fs.writeFileSync(reportPath, JSON.stringify({ mode: 'dry-run', plan }, null, 2), 'utf-8');
    console.log(`[CLEANUP] Dry-run plan written to: ${reportPath}`);
    console.log('[CLEANUP] No records were modified or deleted.');
    return;
  }

  // Execute Firestore deletions & sanitizations in safe batches (<= 400 ops)
  const BATCH_SIZE = 400;
  const mutatingItems = plan.firestoreItems.filter(
    i => i.action === 'delete_operational' || i.action === 'sanitize_assignments'
  );

  let appliedDeletes = 0;
  let appliedSanitizations = 0;

  for (let i = 0; i < mutatingItems.length; i += BATCH_SIZE) {
    const chunk = mutatingItems.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of chunk) {
      const ref = db.collection(item.collection).doc(item.docId);
      if (item.action === 'delete_operational') {
        batch.delete(ref);
        appliedDeletes++;
      } else if (item.action === 'sanitize_assignments' && item.sanitizePatch) {
        batch.set(ref, { ...item.sanitizePatch, updatedAt: new Date().toISOString() }, { merge: true });
        appliedSanitizations++;
      }
    }
    await batch.commit();
  }

  // Execute verified Auth deletions
  let deletedAuthCount = 0;
  for (const authItem of plan.authItems) {
    if (authItem.action === 'delete_auth_account') {
      await auth.deleteUser(authItem.uid);
      deletedAuthCount++;
    }
  }

  // Execute verified Storage deletions
  let deletedStorageCount = 0;
  const bucket = storage.bucket();
  for (const storageItem of plan.storageItems) {
    if (storageItem.action === 'delete_storage_object') {
      await bucket.file(storageItem.objectPath).delete({ ignoreNotFound: true });
      deletedStorageCount++;
    }
  }

  // Post-cleanup referential integrity verification
  const [postCompanies, postUsers, postDepts, postEq, postTasks, postProjects, postClients] =
    await Promise.all([
      db.collection('companies').get(),
      db.collection('users').get(),
      db.collection('departments').get(),
      db.collection('equipment').get(),
      db.collection('tasks').get(),
      db.collection('projects').get(),
      db.collection('clients').get(),
    ]);

  const verification = verifyPostCleanupState({
    companies: postCompanies.docs.map(d => ({ id: d.id, data: d.data() })),
    users: postUsers.docs.map(d => ({ id: d.id, data: d.data() })),
    departments: postDepts.docs.map(d => ({ id: d.id, data: d.data() })),
    equipment: postEq.docs.map(d => ({ id: d.id, data: d.data() })),
    remainingOperationalCounts: {
      tasks: postTasks.size,
      projects: postProjects.size,
      clients: postClients.size,
    },
  });

  const finalReport = {
    mode: 'apply',
    executedAt: new Date().toISOString(),
    backupManifest: manifestPath,
    appliedDeletes,
    appliedSanitizations,
    deletedAuthCount,
    deletedStorageCount,
    verification,
    planSummary: plan.summary,
  };

  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), 'utf-8');
  console.log('[CLEANUP] Final execution report written to:', reportPath);
  console.log('[CLEANUP] Post-cleanup verification:', verification);

  if (!verification.passed) {
    process.exit(1);
  }
}

runControlledCleanup().catch(err => {
  console.error('[CLEANUP] Failed:', err);
  process.exit(1);
});
