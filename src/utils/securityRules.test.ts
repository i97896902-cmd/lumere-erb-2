import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');
const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');

const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf8');
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');

test('firestore.rules enforces global default deny and Custom Claims + bootstrap SUPER_ADMIN auth', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(firestoreRules, /request\.auth\.token\.role/);
  assert.match(firestoreRules, /request\.auth\.token\.companyId/);
  assert.match(firestoreRules, /request\.auth\.token\.email == 'lumerecompany@gmail\.com'/);
  assert.match(firestoreRules, /request\.auth\.token\.email_verified == true/);
});

test('firestore.rules covers every multi-company collection', () => {
  const requiredMatches = [
    'match /companies/{companyId}',
    'match /users/{userId}',
    'match /departments/{departmentId}',
    'match /clients/{clientId}',
    'match /projects/{projectId}',
    'match /tasks/{taskId}',
    'match /comments/{commentId}',
    'match /notifications/{notificationId}',
    'match /activity_logs/{logId}',
    'match /equipment/{equipmentId}',
    'match /equipmentHistory/{historyId}',
    'match /reports/{reportId}',
  ];

  for (const matchDecl of requiredMatches) {
    assert.ok(
      firestoreRules.includes(matchDecl),
      `Expected firestore.rules to contain ${matchDecl}`
    );
  }
});

test('firestore.rules enforces immutability, anti-escalation, and cross-company assignment guards', () => {
  // Companies cannot be hard-deleted
  assert.match(firestoreRules, /match \/companies\/\{companyId\}[\s\S]*?allow delete: if false;/);

  // Audit trails are strictly immutable
  assert.match(firestoreRules, /match \/activity_logs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(firestoreRules, /match \/equipmentHistory\/\{historyId\}[\s\S]*?allow update, delete: if false;/);

  // Self-registration cannot self-assign admin roles or lumere-group
  assert.match(firestoreRules, /request\.resource\.data\.role == 'EMPLOYEE'/);
  assert.match(firestoreRules, /request\.resource\.data\.status == 'pending'/);
  assert.match(firestoreRules, /request\.resource\.data\.companyId != 'lumere-group'/);

  // Cross-company task assignee & project matching guards
  assert.ok(firestoreRules.includes('function assigneeMatchesCompany(assigneeUid, companyId)'));
  assert.ok(firestoreRules.includes('function projectMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('assigneeMatchesCompany(request.resource.data.assignedTo, request.resource.data.companyId)'));
  assert.ok(firestoreRules.includes('projectMatchesCompanyIfPresent(request.resource.data)'));
});

test('storage.rules enforces default deny and strict company-scoped storage paths', () => {
  assert.match(storageRules, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.ok(storageRules.includes('match /companies/{companyId}/logos/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/tasks/{taskId}/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/projects/{projectId}/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/avatars/{userId}/{fileName}'));
  assert.ok(storageRules.includes('request.auth.token.companyId == companyId'));
  assert.ok(storageRules.includes('request.resource.size < 5 * 1024 * 1024'));
  assert.ok(storageRules.includes('request.resource.size < 15 * 1024 * 1024'));
});
