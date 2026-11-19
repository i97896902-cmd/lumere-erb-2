import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');
const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');
const functionsPath = path.resolve(process.cwd(), 'functions/src/index.ts');

const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf8');
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');
const functionsSource = fs.readFileSync(functionsPath, 'utf8');

test('firestore.rules enforces global default deny and Custom Claims + verified bootstrap SUPER_ADMIN auth', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(firestoreRules, /request\.auth\.token\.role/);
  assert.match(firestoreRules, /request\.auth\.token\.companyId/);
  assert.match(firestoreRules, /request\.auth\.token\.email == 'lumerecompany@gmail\.com'/);
  assert.match(firestoreRules, /request\.auth\.token\.email_verified == true/);
  assert.ok(firestoreRules.includes('function isValidId(id)'));
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

test('firestore.rules enforces immutability, anti-escalation, parent protection, and cross-company assignment guards on create AND update', () => {
  // Companies cannot be hard-deleted and lumere-group cannot be deactivated
  assert.match(firestoreRules, /match \/companies\/\{companyId\}[\s\S]*?allow delete: if false;/);
  assert.ok(firestoreRules.includes("!(companyId == 'lumere-group' && request.resource.data.status == 'inactive')"));

  // Active employees cannot enumerate all companies; only SUPER_ADMIN or pending onboarding users can list subsidiaries
  assert.match(
    firestoreRules,
    /allow list: if isSuperAdmin\(\)\s*\|\|\s*\(isPendingUser\(\) && resource\.data\.type == 'subsidiary' && resource\.data\.status == 'active'\);/
  );

  // Audit trails are strictly immutable
  assert.match(firestoreRules, /match \/activity_logs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(firestoreRules, /match \/equipmentHistory\/\{historyId\}[\s\S]*?allow update, delete: if false;/);

  // Self-registration cannot self-assign admin roles or lumere-group
  assert.match(firestoreRules, /request\.resource\.data\.role == 'EMPLOYEE'/);
  assert.match(firestoreRules, /request\.resource\.data\.status == 'pending'/);
  assert.match(firestoreRules, /request\.resource\.data\.companyId != 'lumere-group'/);

  // COMPANY_ADMIN cannot modify self, SUPER_ADMIN, peer COMPANY_ADMIN, or change uid/email/companyId
  assert.ok(firestoreRules.includes("resource.data.role in ['MANAGER', 'EMPLOYEE']"));
  assert.ok(firestoreRules.includes("hasAny(['uid', 'email', 'companyId'])"));
  assert.ok(firestoreRules.includes('userId != request.auth.uid'));

  // Cross-company task assignee & project matching guards on BOTH create and update
  assert.ok(firestoreRules.includes('function assigneeMatchesCompany(assigneeUid, companyId)'));
  assert.ok(firestoreRules.includes('function projectMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('function clientMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('assigneeMatchesCompany(request.resource.data.assignedTo, request.resource.data.companyId)'));
  assert.ok(firestoreRules.includes('assigneeMatchesCompany(request.resource.data.assignedTo, resource.data.companyId)'));
  assert.ok(firestoreRules.includes('projectMatchesCompanyIfPresent(request.resource.data)'));
  assert.ok(firestoreRules.includes('clientMatchesCompanyIfPresent(request.resource.data)'));
});

test('storage.rules enforces default deny, strict company-scoped storage paths, ID validation, and split create/update vs delete rules', () => {
  assert.match(storageRules, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.ok(storageRules.includes('function isValidId(id)'));
  assert.ok(storageRules.includes('request.resource != null'));
  assert.ok(storageRules.includes('match /companies/{companyId}/logos/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/tasks/{taskId}/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/projects/{projectId}/{fileName}'));
  assert.ok(storageRules.includes('match /companies/{companyId}/avatars/{userId}/{fileName}'));
  assert.ok(storageRules.includes('request.auth.token.companyId == companyId'));
  assert.ok(storageRules.includes('request.resource.size < 5 * 1024 * 1024'));
  assert.ok(storageRules.includes('request.resource.size < 15 * 1024 * 1024'));
  // Logos are no longer readable by unrelated companies
  assert.ok(!storageRules.includes('allow read: if isSignedIn();'));
  assert.ok(storageRules.includes('allow create, update:'));
  assert.ok(storageRules.includes('allow delete:'));
});

test('Cloud Functions enforce email_verified bootstrap check and prevent COMPANY_ADMIN self or peer-admin tampering', () => {
  assert.ok(functionsSource.includes('request.auth.token.email_verified === true'));
  assert.ok(functionsSource.includes("userId === caller.uid"));
  assert.ok(functionsSource.includes("targetCurrentRole === 'SUPER_ADMIN' || targetCurrentRole === 'COMPANY_ADMIN'"));
  assert.ok(functionsSource.includes('seedSuggestedDepartments'));
});
