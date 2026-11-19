/**
 * Rollback Script: Restores pre-migration documents from a verified backup manifest.
 *
 * Defaults to DRY-RUN mode. Pass --apply to execute restoration.
 * Never deletes newly created documents unless explicitly desired; restores
 * backed-up documents to their exact pre-migration state.
 *
 * Usage:
 *   npx tsx scripts/migration/rollbackMigration.ts --backup-manifest backups/firestore-.../manifest.json [--apply]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COMPANY_OWNED_COLLECTIONS } from './lib/migrationLogic';

const DEFAULT_PROJECT_ID = 'lumere-erb';

function initAdminFirestore() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = saPath && fs.existsSync(saPath)
    ? cert(JSON.parse(fs.readFileSync(saPath, 'utf-8')))
    : applicationDefault();

  const app = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
  });

  const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || '';
  return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

async function runRollback() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const manifestIdx = args.indexOf('--backup-manifest');
  const manifestPath = manifestIdx >= 0 ? args[manifestIdx + 1] : null;

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error('[ROLLBACK] ABORTED: Provide --backup-manifest <path>.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const backupDir = path.dirname(manifestPath);

  // Verify checksums before rollback
  for (const [fileName, expectedSha] of Object.entries(manifest.checksums || {})) {
    const content = fs.readFileSync(path.join(backupDir, fileName), 'utf-8');
    const actualSha = crypto.createHash('sha256').update(content).digest('hex');
    if (actualSha !== expectedSha) {
      console.error(`[ROLLBACK] ABORTED: Checksum mismatch for ${fileName}.`);
      process.exit(1);
    }
  }
  console.log('[ROLLBACK] Backup checksums verified.');

  if (!apply) {
    console.log('[ROLLBACK] DRY-RUN complete. Counts ready to restore:', manifest.counts);
    return;
  }

  const db = initAdminFirestore();
  for (const colName of COMPANY_OWNED_COLLECTIONS) {
    const filePath = path.join(backupDir, `${colName}.json`);
    if (!fs.existsSync(filePath)) continue;
    const docs: { id: string; data: Record<string, unknown> }[] = JSON.parse(
      fs.readFileSync(filePath, 'utf-8')
    );

    const BATCH_SIZE = 400;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.set(db.collection(colName).doc(doc.id), doc.data);
      }
      await batch.commit();
    }
    console.log(`[ROLLBACK] Restored ${colName}: ${docs.length} documents`);
  }

  console.log('[ROLLBACK] Restoration finished cleanly.');
}

runRollback().catch(err => {
  console.error('[ROLLBACK] Failed:', err);
  process.exit(1);
});
