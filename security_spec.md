# Security Specification: Luméré Task Management System

## 1. Data Invariants
1. Only authenticated users can access the database.
2. Admins are verified against `/admins/{adminId}` or by bootstrap user `i97896902@gmail.com`.
3. Users cannot elevate their own role (`role: "ADMIN"`) without admin privileges.
4. Employees can only update task status through the prescribed workflow (`In Progress` -> `Review`).
5. Employees cannot directly approve tasks to `Completed`; only Managers or Admins can mark tasks as `Completed` or `Rejected`.
6. Tasks cannot be created with past deadlines earlier than start date.
7. Activity logs are write-once (immutable) and cannot be modified or deleted.
8. Comments must have valid taskId and author matching the authenticated user.
9. Notifications can only be marked as read by the recipient (`resource.data.userId == request.auth.uid`) or by Admin.
10. Department creation and deletion are restricted to Admins.

## 2. The "Dirty Dozen" Payloads
1. **Self-Escalation Attack**: Employee attempts to update their own role from `EMPLOYEE` to `ADMIN`.
2. **Ghost Assignee Attack**: Task created with arbitrary or maliciously long assignedTo string.
3. **Orphaned Sub-collection Attack**: Inserting a comment into a non-existent task.
4. **Skip-Review Completion**: Employee attempts to update task status directly from `Pending` or `In Progress` to `Completed`.
5. **Activity Log Mutation Attack**: An employee attempts to delete or alter a logged audit event.
6. **Notification Snooping**: An employee attempts to list/read private notifications of another employee.
7. **Cross-Department Task Hijacking**: Unauthorized modification of tasks outside permissions.
8. **Department Deletion Attack**: Non-admin attempts to delete the Development or Finance department.
9. **Identity Spoofing in Comments**: A user posts a comment claiming to be an Admin UID.
10. **Huge Payload / Denial-of-Wallet Attack**: Storing a 5MB text block in the task description.
11. **Negative Percentage Attack**: Setting `completionPercentage` to -50 or 200.
12. **Immutable Field Tampering**: Attempting to alter `createdAt` or `taskId` on an existing task.
