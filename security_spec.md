# Security Specification: Luméré Group Multi-Company ERP

## 1. Core Multi-Tenant & RBAC Invariants
1. **Default Deny**: Every Firestore collection and Firebase Storage bucket path denies unauthenticated and unauthorized reads/writes by default.
2. **Strict Company Isolation**: Every company-owned document (`users`, `departments`, `clients`, `projects`, `tasks`, `tasks/{taskId}/comments`, `notifications`, `activity_logs`, `equipment`, `equipmentHistory`, `reports`) must carry a valid `companyId`. Non-`SUPER_ADMIN` users may only read or query documents where `companyId == currentUserCompanyId()`.
3. **4-Tier Role Hierarchy**:
   - `SUPER_ADMIN`: Full access across `LUMERE GROUP` and all subsidiaries. Verified via Firebase Auth Custom Claims (`request.auth.token.role == 'SUPER_ADMIN'`), `/admins/{uid}`, or verified bootstrap email `lumerecompany@gmail.com` (`email_verified == true`).
   - `COMPANY_ADMIN`: Administrative control strictly limited to their own `companyId`; can assign `MANAGER` or `EMPLOYEE` roles only; cannot modify themselves, `SUPER_ADMIN`, or peer `COMPANY_ADMIN` accounts; cannot create companies or cross company boundaries.
   - `MANAGER`: Operational management (`clients`, `projects`, `tasks`, `equipment`, `reports`) strictly within their own `companyId`.
   - `EMPLOYEE`: Read-only access to their own company workspace; can only progress assigned tasks (`In Progress` -> `Review`) and post comments/attachments on tasks inside their own company.
4. **No Cross-Company Assignment**: Creating **and updating** a task requires `assignee.companyId == task.companyId` and (if linked to a project) `project.companyId == task.companyId`. Projects linked to a client must match `client.companyId == project.companyId`.
5. **Immutable Audit Trails**: `activity_logs` and `equipmentHistory` forbid `update` and `delete` for all roles, including `SUPER_ADMIN`, and require `actorId == request.auth.uid` on create.
6. **Non-Destructive Company Lifecycle**: `companies` documents forbid client deletion (`allow delete: if false;`), forbid deactivating `lumere-group`, and archive subsidiaries via `status: 'inactive'`.
7. **Storage Path Isolation**: Uploads are scoped under `/companies/{companyId}/...` with ID format validation, MIME type allow-lists, size ceilings (5MB images, 15MB attachments), and explicit `delete` authorization separate from `create, update`.

## 2. Multi-Tenant "Dirty Dozen" Attack Scenarios
1. **Cross-Company Read Attack**: A `COMPANY_ADMIN` or `EMPLOYEE` from `ordark` attempts to `get` or `list` tasks, clients, or users belonging to `nex-aura`. -> **DENIED**.
2. **CompanyId Tampering Attack**: An active `EMPLOYEE` or `COMPANY_ADMIN` attempts to change their own `companyId` from `ordark` to `lumere` or `lumere-group`. -> **DENIED**.
3. **Role Escalation Attack**: A `COMPANY_ADMIN` attempts to promote themselves or another user to `SUPER_ADMIN`, or modify a peer `COMPANY_ADMIN`/`SUPER_ADMIN`, or an `EMPLOYEE` attempts to self-register as `COMPANY_ADMIN`. -> **DENIED**.
4. **Cross-Company Task Assignment (Create & Update)**: A `MANAGER` in `lumere` attempts to create or reassign a `lumere` task to an employee whose `companyId` is `nex-aura`. -> **DENIED**.
5. **Cross-Company Project/Client Link**: A task references a `projectId` owned by another company, or a project references a `clientId` owned by another company. -> **DENIED**.
6. **Skip-Review Task Completion**: An `EMPLOYEE` attempts to set their own task directly to `Completed`. -> **DENIED**.
7. **Parent Company Deletion/Deactivation**: Attempting to delete `/companies/lumere-group` or set `status: 'inactive'`. -> **DENIED**.
8. **Activity Log Tampering / Spoofing**: Attempting to modify/delete an `activity_logs` entry or create a log with another user's `actorId`. -> **DENIED**.
9. **Cross-Company Notification Injection**: A user from `ordark` attempts to write a notification with `companyId: 'lumere'`. -> **DENIED**.
10. **Storage Cross-Company Access**: A user from `nex-aura` attempts to read, upload, or delete files under `/companies/lumere/...` (including logos, tasks, projects, avatars). -> **DENIED**.
11. **Oversized / Executable Upload**: Uploading an `.exe` or >15MB payload to Firebase Storage. -> **DENIED**.
12. **Out-of-Range Progress / Payload Poisoning**: Writing `completionPercentage: -20` or `250`, oversized strings, or malformed path IDs. -> **DENIED**.

## 3. Phase 3 Red Team Audit & Hardening Delta
The following vulnerabilities were identified during the Phase 3 security audit and patched:
1. **`firestore.rules` — Task Update Assignee Loophole**: `tasks/{taskId}` `allow update` previously verified `projectMatchesCompanyIfPresent` but omitted `assigneeMatchesCompany(request.resource.data.assignedTo, resource.data.companyId)`, allowing an operational manager to reassign an existing task to a user from another company. **Patched.**
2. **`firestore.rules` — `COMPANY_ADMIN` Peer/Super-Admin Tampering**: `users/{userId}` `allow update` allowed a `COMPANY_ADMIN` to update any user doc sharing their `companyId` without checking `resource.data.role in ['MANAGER', 'EMPLOYEE']` or blocking `uid`/`email` edits. **Patched.**
3. **`firestore.rules` — Company Enumeration & Parent Deactivation**: `companies/{companyId}` `allow list`/`get` previously allowed any active employee to list all active subsidiaries, and `allow update` did not explicitly block setting `lumere-group` to `inactive`. **Patched** so active non-`SUPER_ADMIN` users can only read their own company while pending onboarding users can still select active subsidiaries, and `lumere-group` cannot be deactivated.
4. **`firestore.rules` — Document ID Validation & String Bounds**: Added `isValidId(id)` regex validation across single-document writes, `clientMatchesCompanyIfPresent`, and `.size()` caps on user, client, project, task, equipment, notification, report, and log string fields. **Patched.**
5. **`storage.rules` — Logo Enumeration & Delete Null-Resource Bug**: Scoped `/companies/{companyId}/logos/{fileName}` reads to `isSuperAdmin() || belongsToCompany(companyId)`, added `isValidId` checks, and split `allow write` into `allow create, update` (checking `request.resource != null`) and explicit `allow delete`. **Patched.**
6. **`functions/src/index.ts` — Unverified Email Bootstrap & `COMPANY_ADMIN` Peer Guard**: Enforced `request.auth.token.email_verified === true` before elevating `PRIMARY_SUPER_ADMIN_EMAIL` in `requireCaller`, blocked `COMPANY_ADMIN` from modifying themselves or targeting `SUPER_ADMIN`/`COMPANY_ADMIN` users in `updateUserRoleAndCompany`, and added optional `seedSuggestedDepartments` support in `createCompany`. **Patched.**
7. **Production Auth Guard (`VITE_DISABLE_AUTH`)**: Converted `AUTH_DISABLED` in `src/context/AuthContext.tsx` from a hardcoded constant to `import.meta.env.VITE_DISABLE_AUTH !== 'false'` and documented `VITE_DISABLE_AUTH=false` as a mandatory production deployment setting in `.env.example`. **Patched.**
