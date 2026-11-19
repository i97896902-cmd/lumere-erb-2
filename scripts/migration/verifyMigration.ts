/**
 * Step 3: Post-Migration Integrity & Count Verification Script
 *
 * Compares live Firestore document counts and referential integrity against the
 * pre-migration backup manifest and checks 100% companyId coverage.
 *
 * Usage:
 *   npx tsx scripts/migration/verifyMigration.ts --backup-manifest backups/firestore-.../manifest.json
 */

import fs from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  COMPANY_OWNED_COLLECTIONS,
  RawDocument,
  verifyPostMigrationState,
} from './lib/migrationLogic';

function initAdminFirestore() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = saPath && fs.existsSync(saPath)
    ? cert(JSON.parse(fs.readFileSync(saPath, 'utf-8')))
    : applicationDefault();

  const app = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  });

  const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

async function runVerification() {
  const args = process.argv.slice(2);
  const manifestIdx = args.indexOf('--backup-manifest');
  const manifestPath = manifestIdx >= 0 ? args[manifestIdx + 1] : null;

  let backupCounts: Record<string, number> = {};
  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    backupCounts = manifest.counts || {};
  } else {
    console.warn('[VERIFY] No backup manifest provided; checking companyId & reference integrity only.');
  }

  const db = initAdminFirestore();
  const companiesSnap = await db.collection('companies').get();
  const companies: RawDocument[] = companiesSnap.docs.map(d => ({ id: d.id, data: d.data() }));

  const collections: Record<string, RawDocument[]> = {};
  for (const colName of COMPANY_OWNED_COLLECTIONS) {
    const snap = await db.collection(colName).get();
    collections[colName] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  }

  const taskComments: { taskId: string; comment: RawDocument }[] = [];
  for (const taskDoc of collections.tasks || []) {
    const commentsSnap = await db.collection('tasks').doc(taskDoc.id).collection('comments').get();
    for (const cDoc of commentsSnap.docs) {
      taskComments.push({
        taskId: taskDoc.id,
        comment: { id: cDoc.id, data: cDoc.data() },
      });
    }
  }

  const report = verifyPostMigrationState({
    backupCounts,
    companies,
    collections,
    taskComments,
  });

  console.log('\n[VERIFY] Report:');
  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error('[VERIFY] FAILED: One or more integrity errors detected.');
    process.exit(1);
  }
  console.log('[VERIFY] PASSED: All counts and company references verified.');
}

runVerification().catch(err => {
  console.error('[VERIFY] Failed:', err);
  process.exit(1);
});
