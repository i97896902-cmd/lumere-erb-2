# Security Specification: Luméré Group Multi-Company ERP

## 1. Core Multi-Tenant & RBAC Invariants
1. **Default Deny**: Every Firestore collection and Firebase Storage bucket path denies unauthenticated and unauthorized reads/writes by default.
2. **Strict Company Isolation**: Every company-owned document (`users`, `departments`, `clients`, `projects`, `tasks`, `tasks/{taskId}/comments`, `notifications`, `activity_logs`, `equipment`, `equipmentHistory`, `reports`) must carry a valid `companyId`. Non-`SUPER_ADMIN` users may only read or query documents where `companyId == currentUserCompanyId()`.
3. **4-Tier Role Hierarchy**:
   - `SUPER_ADMIN`: Full access across `LUMERE GROUP` and all subsidiaries. Verified via Firebase Auth Custom Claims (`request.auth.token.role == 'SUPER_ADMIN'`), `/admins/{uid}`, or verified bootstrap email `lumerecompany@gmail.com`.
   - `COMPANY_ADMIN`: Administrative control strictly limited to their own `companyId`; can assign `MANAGER` or `EMPLOYEE` roles only; cannot create companies or escalate to `SUPER_ADMIN` or `COMPANY_ADMIN` for another company.
   - `MANAGER`: Operational management (`clients`, `projects`, `tasks`, `equipment`, `reports`) strictly within their own `companyId`.
   - `EMPLOYEE`: Read-only access to their own company workspace; can only progress assigned tasks (`In Progress` -> `Review`) and post comments/attachments on tasks inside their own company.
4. **No Cross-Company Assignment**: Creating or updating a task requires `assignee.companyId == task.companyId` and (if linked to a project) `project.companyId == task.companyId`.
5. **Immutable Audit Trails**: `activity_logs` and `equipmentHistory` forbid `update` and `delete` for all roles, including `SUPER_ADMIN`, and require `actorId == request.auth.uid` on create.
6. **Non-Destructive Company Lifecycle**: `companies` documents forbid client deletion (`allow delete: if false;`) and must be archived via `status: 'inactive'`.
7. **Storage Path Isolation**: Uploads are scoped under `/companies/{companyId}/...` with MIME type and file size ceilings (5MB images, 15MB attachments).

## 2. Multi-Tenant "Dirty Dozen" Attack Scenarios
1. **Cross-Company Read Attack**: A `COMPANY_ADMIN` or `EMPLOYEE` from `ordark` attempts to `get` or `list` tasks, clients, or users belonging to `nex-aura`. -> **DENIED**.
2. **CompanyId Tampering Attack**: An active `EMPLOYEE` or `COMPANY_ADMIN` attempts to change their own `companyId` from `ordark` to `lumere` or `lumere-group`. -> **DENIED**.
3. **Role Escalation Attack**: A `COMPANY_ADMIN` attempts to promote themselves or another user to `SUPER_ADMIN`, or an `EMPLOYEE` attempts to self-register as `COMPANY_ADMIN`. -> **DENIED**.
4. **Cross-Company Task Assignment**: A `MANAGER` in `lumere` attempts to assign a `lumere` task to an employee whose `companyId` is `nex-aura`. -> **DENIED**.
5. **Cross-Company Project Link**: A task in `nex-aura` references a `projectId` owned by `ordark`. -> **DENIED**.
6. **Skip-Review Task Completion**: An `EMPLOYEE` attempts to set their own task directly to `Completed`. -> **DENIED**.
7. **Parent Company Deletion/Deactivation**: Attempting to delete `/companies/lumere-group` or set it inactive. -> **DENIED**.
8. **Activity Log Tampering / Spoofing**: Attempting to modify/delete an `activity_logs` entry or create a log with another user's `actorId`. -> **DENIED**.
9. **Cross-Company Notification Injection**: A user from `ordark` attempts to write a notification with `companyId: 'lumere'`. -> **DENIED**.
10. **Storage Cross-Company Access**: A user from `nex-aura` attempts to read or upload to `/companies/lumere/tasks/{taskId}/...`. -> **DENIED**.
11. **Oversized / Executable Upload**: Uploading an `.exe` or >15MB payload to Firebase Storage. -> **DENIED**.
12. **Out-of-Range Progress Payload**: Writing `completionPercentage: -20` or `completionPercentage: 250` on a task. -> **DENIED**.
