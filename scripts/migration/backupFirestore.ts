/**
 * Step 1: Full Non-Destructive Firestore Backup Script
 *
 * Exports all Lumere ERP collections (including nested task comments) to a
 * timestamped directory with a SHA-256 checksum manifest BEFORE running any migration.
 *
 * Usage (operator workstation with Firebase Admin credentials):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   npx tsx scripts/migration/backupFirestore.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { COMPANY_OWNED_COLLECTIONS } from './lib/migrationLogic';

const ALL_COLLECTIONS = ['companies', 'admins', ...COMPANY_OWNED_COLLECTIONS, 'attendance'];

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

async function runBackup() {
  const db = initAdminFirestore();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'backups', `firestore-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const counts: Record<string, number> = {};
  const checksums: Record<string, string> = {};

  console.log(`[BACKUP] Starting export to ${backupDir}...`);

  for (const colName of ALL_COLLECTIONS) {
    const snap = await db.collection(colName).get();
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    counts[colName] = docs.length;

    const payload = JSON.stringify(docs, null, 2);
    const filePath = path.join(backupDir, `${colName}.json`);
    fs.writeFileSync(filePath, payload, 'utf-8');
    checksums[`${colName}.json`] = crypto.createHash('sha256').update(payload).digest('hex');
    console.log(`[BACKUP] Exported ${colName}: ${docs.length} documents`);
  }

  // Export task comments subcollections
  const tasksSnap = await db.collection('tasks').get();
  const allComments: { taskId: string; id: string; data: Record<string, unknown> }[] = [];
  for (const taskDoc of tasksSnap.docs) {
    const commentsSnap = await db.collection('tasks').doc(taskDoc.id).collection('comments').get();
    for (const cDoc of commentsSnap.docs) {
      allComments.push({ taskId: taskDoc.id, id: cDoc.id, data: cDoc.data() });
    }
  }
  counts.task_comments = allComments.length;
  const commentsPayload = JSON.stringify(allComments, null, 2);
  fs.writeFileSync(path.join(backupDir, 'task_comments.json'), commentsPayload, 'utf-8');
  checksums['task_comments.json'] = crypto.createHash('sha256').update(commentsPayload).digest('hex');
  console.log(`[BACKUP] Exported task_comments: ${allComments.length} documents`);

  const manifest = {
    createdAt: new Date().toISOString(),
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    databaseId: process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
    backupDir,
    counts,
    checksums,
  };

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n[BACKUP] Completed successfully.`);
  console.log(`[BACKUP] Manifest path: ${manifestPath}`);
}

runBackup().catch(err => {
  console.error('[BACKUP] Failed:', err);
  process.exit(1);
});
