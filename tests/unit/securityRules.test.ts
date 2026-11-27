import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');
const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const functionsPath = path.resolve(process.cwd(), 'functions/src/index.ts');

const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf8');
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, unknown>;
  firestore: Record<string, { schema: string; description: string }>;
};
const functionsSource = fs.readFileSync(functionsPath, 'utf8');

test('firestore.rules enforces global default deny, verified email writes, and verified bootstrap SUPER_ADMIN auth', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(firestoreRules, /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(firestoreRules, /request\.auth\.token\.role/);
  assert.match(firestoreRules, /request\.auth\.token\.companyId/);
  assert.match(firestoreRules, /request\.auth\.token\.email == 'lumerecompany@gmail\.com'/);
  assert.match(firestoreRules, /function isBootstrapSuperAdmin\(\)\s*\{\s*return isVerifiedUser\(\)\s*&& request\.auth\.token\.email == 'lumerecompany@gmail\.com';\s*\}/);
  assert.ok(firestoreRules.includes('function isValidId(id)'));
});

test('firestore.rules covers every multi-company collection and stays 100% synced with firebase-blueprint.json', () => {
  const requiredMatches = [
    'match /admins/{adminId}',
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

  // Every collection path in firebase-blueprint.json must be secured in firestore.rules
  const blueprintPaths = Object.keys(blueprint.firestore);
  assert.ok(blueprintPaths.includes('/reports/{reportId}'), 'Expected blueprint to declare /reports/{reportId}');
  assert.equal(blueprintPaths.length, 13);
  for (const bpPath of blueprintPaths) {
    const leafSegment = bpPath.split('/').slice(-2).join('/');
    assert.ok(
      firestoreRules.includes(`match /${leafSegment}`),
      `Expected firestore.rules to contain match block for blueprint path ${bpPath}`
    );
  }
});

test('firestore.rules defines standalone isValid[Entity] blueprints with strict hasOnly key allowlists and bounded arrays', () => {
  const requiredValidators = [
    'function isValidCompany(data)',
    'function isValidUser(data)',
    'function isValidDepartment(data)',
    'function isValidClient(data)',
    'function isValidProject(data)',
    'function isValidTask(data)',
    'function isValidComment(data)',
    'function isValidNotification(data)',
    'function isValidActivityLog(data)',
    'function isValidEquipment(data)',
    'function isValidEquipmentHistory(data)',
    'function isValidReport(data)',
  ];

  for (const validator of requiredValidators) {
    assert.ok(
      firestoreRules.includes(validator),
      `Expected standalone validator ${validator}`
    );
  }

  // Total array guarding with explicit max bounds and first-element type checks
  assert.ok(firestoreRules.includes('function isOptionalBoundedStringList(data, key, maxItems)'));
  assert.ok(firestoreRules.includes('function isOptionalBoundedMapList(data, key, maxItems)'));
  assert.ok(firestoreRules.includes("isOptionalBoundedStringList(data, 'adminIds', 50)"));
  assert.ok(firestoreRules.includes("isOptionalBoundedStringList(data, 'teamMemberIds', 100)"));
  assert.ok(firestoreRules.includes("isOptionalBoundedStringList(data, 'coAssignees', 20)"));
  assert.ok(firestoreRules.includes("isOptionalBoundedMapList(data, 'attachments', 20)"));

  // No blanket open reads/writes anywhere
  assert.ok(!/allow\s+(read|get|list|write|create|update|delete)\s*:\s*if\s+true\s*;/.test(firestoreRules));
  assert.ok(!/allow\s+(read|list)\s*:\s*if\s+isSignedIn\(\)\s*;/.test(firestoreRules));
});

test('firestore.rules splits allow get (with isValidId) vs allow list and enforces isVerifiedUser on all writes', () => {
  // No combined `allow read:` outside global default-deny `allow read, write: if false;`
  const combinedReadMatches = firestoreRules.match(/allow read:/g) || [];
  assert.equal(combinedReadMatches.length, 0, 'All collections should split allow get and allow list');

  // Every mutable collection enforces isVerifiedUser() on create, update, delete
  const verifiedWriteCount = (firestoreRules.match(/allow (create|update|delete): if isVerifiedUser\(\)/g) || []).length;
  assert.ok(verifiedWriteCount >= 30, `Expected at least 30 verified write gates, found ${verifiedWriteCount}`);
});

test('firestore.rules enforces immutability, anti-escalation, terminal task locking, and cross-company relational guards', () => {
  // Companies cannot be hard-deleted, slug matches companyId on create, and lumere-group cannot be deactivated or demoted from parent
  assert.match(firestoreRules, /match \/companies\/\{companyId\}[\s\S]*?allow delete: if false;/);
  assert.ok(firestoreRules.includes('request.resource.data.slug == companyId'));
  assert.ok(firestoreRules.includes("!(companyId == 'lumere-group' && request.resource.data.status == 'inactive')"));
  assert.ok(firestoreRules.includes("!(companyId == 'lumere-group' && request.resource.data.type != 'parent')"));

  // Active employees cannot enumerate all companies; only SUPER_ADMIN or pending onboarding users can list subsidiaries
  assert.match(
    firestoreRules,
    /allow list: if isSuperAdmin\(\)\s*\|\|\s*\(isPendingUser\(\) && resource\.data\.type == 'subsidiary' && resource\.data\.status == 'active'\);/
  );

  // Pending onboarding users cannot list parent holding company departments
  assert.ok(firestoreRules.includes("(isPendingUser() && resource.data.companyId != 'lumere-group')"));

  // Audit trails are strictly immutable
  assert.match(firestoreRules, /match \/activity_logs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(firestoreRules, /match \/equipmentHistory\/\{historyId\}[\s\S]*?allow update, delete: if false;/);

  // Immutable timestamps & creator metadata
  assert.ok(firestoreRules.includes('function isImmutableField(key)'));
  assert.ok(firestoreRules.includes("isImmutableField('createdAt')"));
  assert.ok(firestoreRules.includes("isImmutableField('createdBy')"));
  assert.ok(firestoreRules.includes("isImmutableField('generatedBy')"));

  // Self-registration cannot self-assign admin roles or lumere-group
  assert.match(firestoreRules, /request\.resource\.data\.role == 'EMPLOYEE'/);
  assert.match(firestoreRules, /request\.resource\.data\.status == 'pending'/);
  assert.match(firestoreRules, /request\.resource\.data\.companyId != 'lumere-group'/);

  // Self-update uses strict affectedKeys().hasOnly allowlist (no shadow fields or privilege fields)
  assert.match(
    firestoreRules,
    /isCurrentUser\(userId\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'displayName'[\s\S]*?'updatedAt'[\s\S]*?\]\)/
  );

  // COMPANY_ADMIN cannot modify self, SUPER_ADMIN, peer COMPANY_ADMIN, change uid/email/companyId, or spoof approvedBy
  assert.ok(firestoreRules.includes("resource.data.role in ['MANAGER', 'EMPLOYEE']"));
  assert.ok(firestoreRules.includes("hasAny(['uid', 'email', 'companyId'])"));
  assert.ok(firestoreRules.includes('request.resource.data.approvedBy == request.auth.uid'));
  assert.ok(firestoreRules.includes('userId != request.auth.uid'));

  // Tasks: employee cannot reopen Completed/Cancelled tasks or self-approve reviewStatus
  assert.ok(firestoreRules.includes("!(resource.data.status in ['Completed', 'Cancelled'])"));
  assert.ok(firestoreRules.includes("request.resource.data.reviewStatus in ['none', 'pending_review']"));

  // Cross-company task assignee, equipment assignee, project, client, equipmentHistory, and notification recipient guards
  assert.ok(firestoreRules.includes('function assigneeMatchesCompany(assigneeUid, companyId)'));
  assert.ok(firestoreRules.includes('function assigneeMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('function recipientMatchesCompanyOrSuperAdmin(recipientUid, companyId)'));
  assert.ok(firestoreRules.includes('function projectMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('function clientMatchesCompanyIfPresent(data)'));
  assert.ok(firestoreRules.includes('function equipmentMatchesCompany(equipmentId, companyId)'));
  assert.ok(firestoreRules.includes('assigneeMatchesCompany(request.resource.data.assignedTo, request.resource.data.companyId)'));
  assert.ok(firestoreRules.includes('assigneeMatchesCompany(request.resource.data.assignedTo, resource.data.companyId)'));
  assert.ok(firestoreRules.includes('recipientMatchesCompanyOrSuperAdmin(request.resource.data.userId, request.resource.data.companyId)'));
  assert.ok(firestoreRules.includes('equipmentMatchesCompany(request.resource.data.equipmentId, request.resource.data.companyId)'));

  // Notifications must start unread and only allow toggling read on update
  assert.ok(firestoreRules.includes('request.resource.data.read == false'));
  assert.match(firestoreRules, /match \/notifications\/\{notificationId\}[\s\S]*?affectedKeys\(\)\.hasOnly\(\['read'\]\)/);

  // Comments subcollection verifies parent task existence (Master Gate)
  assert.match(
    firestoreRules,
    /match \/comments\/\{commentId\}[\s\S]*?exists\(\/databases\/\$\(database\)\/documents\/tasks\/\$\(taskId\)\)/
  );
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
  assert.ok(!storageRules.includes('allow read: if isSignedIn();'));
  assert.ok(storageRules.includes('allow create, update:'));
  assert.ok(storageRules.includes('allow delete:'));
});

test('Cloud Functions enforce email_verified bootstrap check and prevent COMPANY_ADMIN self or peer-admin tampering', () => {
  assert.ok(functionsSource.includes('request.auth.token.email_verified === true'));
  assert.ok(functionsSource.includes('userId === caller.uid'));
  assert.ok(functionsSource.includes("targetCurrentRole === 'SUPER_ADMIN' || targetCurrentRole === 'COMPANY_ADMIN'"));
  assert.ok(functionsSource.includes('seedSuggestedDepartments'));
});
