import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app = initializeApp();

const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-f456e639-5da6-4974-8a16-b2d2bbdd4686';
const PRIMARY_SUPER_ADMIN_EMAIL = 'lumerecompany@gmail.com';
const PARENT_COMPANY_ID = 'lumere-group';

const db = getFirestore(app, DATABASE_ID);
const adminAuth = getAuth(app);

type CanonicalRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';

interface CallerContext {
  uid: string;
  email: string;
  displayName: string;
  role: CanonicalRole;
  companyId: string;
}

function normalizeRole(role?: string, email?: string, emailVerified?: boolean): CanonicalRole {
  if (emailVerified && email && email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL) return 'SUPER_ADMIN';
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'SUPER_ADMIN';
  if (role === 'COMPANY_ADMIN') return 'COMPANY_ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
  return 'EMPLOYEE';
}

function isActiveStatus(status?: string): boolean {
  return (status || '').toLowerCase() === 'active';
}

async function requireCaller(request: CallableRequest): Promise<CallerContext> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const uid = request.auth.uid;
  const email = (request.auth.token.email || '').toLowerCase();
  const emailVerified = request.auth.token.email_verified === true;
  const userSnap = await db.collection('users').doc(uid).get();

  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'Caller user profile does not exist.');
  }

  const data = userSnap.data() || {};
  const role = normalizeRole(data.role, email, emailVerified);

  if (!isActiveStatus(data.status) && !(emailVerified && email === PRIMARY_SUPER_ADMIN_EMAIL)) {
    throw new HttpsError('permission-denied', 'Caller account is not active.');
  }

  return {
    uid,
    email,
    displayName: String(data.displayName || email || uid),
    role,
    companyId: String(data.companyId || (role === 'SUPER_ADMIN' ? PARENT_COMPANY_ID : 'lumere')),
  };
}

async function writeAuditLog(params: {
  companyId: string;
  caller: CallerContext;
  action: string;
  target: string;
  targetId: string;
  metadata?: string;
}) {
  await db.collection('activity_logs').add({
    companyId: params.companyId,
    actorId: params.caller.uid,
    actorName: params.caller.displayName,
    actorRole: params.caller.role,
    action: params.action,
    target: params.target,
    targetId: params.targetId,
    metadata: params.metadata || '',
    timestamp: new Date().toISOString(),
  });
}

async function syncAuthCustomClaims(uid: string, role: CanonicalRole, companyId: string) {
  try {
    await adminAuth.setCustomUserClaims(uid, { role, companyId });
  } catch (err) {
    // Non-fatal if user document was provisioned prior to first Auth sign-in
    console.warn(`Could not sync custom claims for ${uid}:`, err);
  }
}

/**
 * Syncs the authenticated caller's Firebase Auth Custom Claims from their
 * authoritative Firestore `/users/{uid}` document.
 */
export const syncMyClaims = onCall(async request => {
  const caller = await requireCaller(request);
  await syncAuthCustomClaims(caller.uid, caller.role, caller.companyId);
  return { synced: true, role: caller.role, companyId: caller.companyId };
});

/**
 * Creates a new subsidiary company under LUMERE GROUP (SUPER_ADMIN only).
 */
export const createCompany = onCall(async request => {
  const caller = await requireCaller(request);
  if (caller.role !== 'SUPER_ADMIN') {
    throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can create companies.');
  }

  const { name, arabicName, slug, description, businessSector, logo, seedSuggestedDepartments } = request.data || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 150) {
    throw new HttpsError('invalid-argument', 'Valid company name is required.');
  }
  const cleanSlug = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!cleanSlug || cleanSlug === PARENT_COMPANY_ID) {
    throw new HttpsError('invalid-argument', 'Valid unique company slug is required.');
  }

  const companyRef = db.collection('companies').doc(cleanSlug);
  const existing = await companyRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', `Company slug "${cleanSlug}" already exists.`);
  }

  const now = new Date().toISOString();
  const companyDoc = {
    name: name.trim(),
    arabicName: typeof arabicName === 'string' ? arabicName.trim() : name.trim(),
    slug: cleanSlug,
    type: 'subsidiary',
    parentCompanyId: PARENT_COMPANY_ID,
    logo: typeof logo === 'string' ? logo : '',
    description: typeof description === 'string' ? description.trim() : '',
    businessSector: typeof businessSector === 'string' ? businessSector.trim() : '',
    status: 'active',
    adminIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await companyRef.set(companyDoc);

  if (seedSuggestedDepartments === true) {
    await db
      .collection('departments')
      .doc(`${cleanSlug}-operations`)
      .set(
        {
          companyId: cleanSlug,
          name: 'العمليات والإدارة',
          description: 'إدارة العمليات اليومية وتنسيق فرق العمل.',
          color: 'bg-emerald-600',
          createdAt: now,
        },
        { merge: true }
      );
  }

  await writeAuditLog({
    companyId: cleanSlug,
    caller,
    action: 'Company Created',
    target: companyDoc.name,
    targetId: cleanSlug,
    metadata: `Subsidiary created under ${PARENT_COMPANY_ID}`,
  });

  return { company: { id: cleanSlug, ...companyDoc } };
});

/**
 * Activates or deactivates a subsidiary company (SUPER_ADMIN only).
 */
export const setCompanyStatus = onCall(async request => {
  const caller = await requireCaller(request);
  if (caller.role !== 'SUPER_ADMIN') {
    throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can update company status.');
  }

  const { companyId, status } = request.data || {};
  if (typeof companyId !== 'string' || !companyId || companyId === PARENT_COMPANY_ID) {
    throw new HttpsError('invalid-argument', 'Cannot deactivate or alter parent company status.');
  }
  if (status !== 'active' && status !== 'inactive') {
    throw new HttpsError('invalid-argument', 'Status must be active or inactive.');
  }

  const ref = db.collection('companies').doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Company not found.');
  }

  await ref.update({ status, updatedAt: new Date().toISOString() });
  await writeAuditLog({
    companyId,
    caller,
    action: 'Company Status Changed',
    target: String(snap.data()?.name || companyId),
    targetId: companyId,
    metadata: `Status updated to ${status}`,
  });

  return { ok: true };
});

/**
 * Assigns a user as COMPANY_ADMIN for a specific subsidiary and updates Custom Claims.
 */
export const assignCompanyAdmin = onCall(async request => {
  const caller = await requireCaller(request);
  if (caller.role !== 'SUPER_ADMIN') {
    throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can assign company admins.');
  }

  const { userId, companyId, companyName } = request.data || {};
  if (typeof userId !== 'string' || typeof companyId !== 'string' || companyId === PARENT_COMPANY_ID) {
    throw new HttpsError('invalid-argument', 'Valid userId and subsidiary companyId are required.');
  }

  const [userSnap, companySnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('companies').doc(companyId).get(),
  ]);

  if (!userSnap.exists) throw new HttpsError('not-found', 'Target user not found.');
  if (!companySnap.exists) throw new HttpsError('not-found', 'Target company not found.');

  const now = new Date().toISOString();
  await Promise.all([
    db.collection('users').doc(userId).update({
      role: 'COMPANY_ADMIN',
      companyId,
      companyName: companyName || companySnap.data()?.name || companyId,
      status: 'active',
      updatedAt: now,
    }),
    db.collection('companies').doc(companyId).update({
      adminIds: FieldValue.arrayUnion(userId),
      updatedAt: now,
    }),
  ]);

  await syncAuthCustomClaims(userId, 'COMPANY_ADMIN', companyId);
  await writeAuditLog({
    companyId,
    caller,
    action: 'Company Admin Assigned',
    target: String(userSnap.data()?.displayName || userId),
    targetId: userId,
    metadata: `Assigned COMPANY_ADMIN for ${companyId}`,
  });

  return { ok: true };
});

/**
 * Updates a user's role, company ownership, and Custom Claims with strict RBAC validation.
 */
export const updateUserRoleAndCompany = onCall(async request => {
  const caller = await requireCaller(request);
  const { userId, role, companyId, companyName, department, position, managerId, managerName } =
    request.data || {};

  if (typeof userId !== 'string' || typeof companyId !== 'string') {
    throw new HttpsError('invalid-argument', 'userId and companyId are required.');
  }

  const allowedRoles: CanonicalRole[] = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE'];
  if (!allowedRoles.includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role value.');
  }

  if (caller.role === 'SUPER_ADMIN') {
    // Full authority across all companies, except non-SUPER_ADMIN cannot belong to parent company
    if (role !== 'SUPER_ADMIN' && companyId === PARENT_COMPANY_ID) {
      throw new HttpsError('invalid-argument', 'Only SUPER_ADMIN may be assigned to LUMERE GROUP.');
    }
  } else if (caller.role === 'COMPANY_ADMIN') {
    if (userId === caller.uid) {
      throw new HttpsError('permission-denied', 'COMPANY_ADMIN cannot modify their own role or company.');
    }
    if (caller.companyId !== companyId) {
      throw new HttpsError('permission-denied', 'COMPANY_ADMIN cannot manage users of another company.');
    }
    if (role !== 'MANAGER' && role !== 'EMPLOYEE') {
      throw new HttpsError('permission-denied', 'COMPANY_ADMIN can only assign MANAGER or EMPLOYEE.');
    }
  } else {
    throw new HttpsError('permission-denied', 'Insufficient role to modify user roles.');
  }

  const userRef = db.collection('users').doc(userId);
  const targetSnap = await userRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target user does not exist.');
  }

  const targetData = targetSnap.data() || {};
  const targetCurrentRole = normalizeRole(
    typeof targetData.role === 'string' ? targetData.role : undefined,
    typeof targetData.email === 'string' ? targetData.email : undefined,
    true
  );

  // Prevent COMPANY_ADMIN from hijacking a user in another company OR modifying a SUPER_ADMIN / peer COMPANY_ADMIN
  if (caller.role === 'COMPANY_ADMIN') {
    if (targetData.companyId !== caller.companyId) {
      throw new HttpsError('permission-denied', 'Target user does not belong to your company.');
    }
    if (targetCurrentRole === 'SUPER_ADMIN' || targetCurrentRole === 'COMPANY_ADMIN') {
      throw new HttpsError('permission-denied', 'COMPANY_ADMIN cannot modify a SUPER_ADMIN or another COMPANY_ADMIN.');
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    role,
    companyId,
    updatedAt: now,
  };
  if (typeof companyName === 'string') updates.companyName = companyName;
  if (typeof department === 'string') updates.department = department;
  if (typeof position === 'string') updates.position = position;
  if (typeof managerId === 'string') updates.managerId = managerId;
  if (typeof managerName === 'string') updates.managerName = managerName;

  await userRef.update(updates);
  await syncAuthCustomClaims(userId, role, companyId);

  await writeAuditLog({
    companyId,
    caller,
    action: 'Employee Updated',
    target: String(targetSnap.data()?.displayName || userId),
    targetId: userId,
    metadata: `Role=${role}, Company=${companyId}`,
  });

  return { ok: true };
});
