import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  arrayUnion,
  query,
  where,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  User,
  Task,
  Department,
  Notification,
  ActivityLog,
  ActivityAction,
  TaskComment,
  TaskStatus,
  Role,
  CanonicalRole,
  Client,
  Project,
  Equipment,
  EquipmentHistory,
  Company,
} from '../types';
import {
  DEFAULT_SUBSIDIARY_ID,
  PARENT_COMPANY_ID,
  SUGGESTED_DEPARTMENTS_BY_COMPANY,
} from '../config/companies';
import { canAssignRole, getUserCompanyId, isPendingStatus, normalizeRole } from '../utils/rbac';
import { LocalDataService } from './localDataService';

const COMPANIES_COLLECTION = 'companies';
const USERS_COLLECTION = 'users';
const TASKS_COLLECTION = 'tasks';
const DEPARTMENTS_COLLECTION = 'departments';
const NOTIFICATIONS_COLLECTION = 'notifications';
const ACTIVITY_COLLECTION = 'activity_logs';
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const EQUIPMENT_COLLECTION = 'equipment';
const EQUIPMENT_HISTORY_COLLECTION = 'equipmentHistory';
const REPORTS_COLLECTION = 'reports';

export interface StoredReport {
  id: string;
  companyId: string;
  title: string;
  period: string;
  generatedBy: string;
  generatedByName: string;
  metrics: Record<string, number | string>;
  createdAt: string;
}

function buildCompanyScopedQuery(collectionName: string, companyId?: string | null, maxDocs?: number) {
  const colRef = collection(db, collectionName);
  const constraints = [];
  if (companyId && companyId !== PARENT_COMPANY_ID) {
    constraints.push(where('companyId', '==', companyId));
  }
  if (maxDocs) {
    constraints.push(limit(maxDocs));
  }
  return constraints.length > 0 ? query(colRef, ...constraints) : colRef;
}

function sortByIsoDesc<T>(items: T[], selector: (item: T) => string | undefined): T[] {
  return [...items].sort(
    (a, b) => new Date(selector(b) || 0).getTime() - new Date(selector(a) || 0).getTime()
  );
}

function resolveDocCompanyId(explicitCompanyId: string | undefined, actor?: User): string {
  if (explicitCompanyId && explicitCompanyId.trim().length > 0 && explicitCompanyId !== PARENT_COMPANY_ID) {
    return explicitCompanyId.trim();
  }
  if (actor) {
    const actorCid = getUserCompanyId(actor);
    if (actorCid !== PARENT_COMPANY_ID) return actorCid;
  }
  return DEFAULT_SUBSIDIARY_ID;
}

export const FirestoreDataService = {
  // ==========================================
  // COMPANIES
  // ==========================================
  async getCompanies(companyId?: string | null): Promise<Company[]> {
    try {
      if (companyId && companyId !== PARENT_COMPANY_ID) {
        const snap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId));
        return snap.exists() ? [{ id: snap.id, ...snap.data() } as Company] : [];
      }
      const snap = await getDocs(collection(db, COMPANIES_COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COMPANIES_COLLECTION);
    }
  },

  subscribeCompanies(
    companyId: string | null | undefined,
    callback: (companies: Company[]) => void
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    if (companyId && companyId !== PARENT_COMPANY_ID) {
      const refDoc = doc(db, COMPANIES_COLLECTION, companyId);
      return onSnapshot(
        refDoc,
        snap => {
          callback(snap.exists() ? [{ id: snap.id, ...snap.data() } as Company] : []);
        },
        err => {
          if (!auth.currentUser) return;
          console.warn('Company doc listener warning:', err);
          callback([]);
        }
      );
    }

    return onSnapshot(
      collection(db, COMPANIES_COLLECTION),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
        callback(list);
      },
      err => {
        if (!auth.currentUser) return;
        console.warn('Companies collection listener warning:', err);
        callback([]);
      }
    );
  },

  async createCompany(
    companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User,
    seedSuggestedDepartments = false
  ): Promise<Company> {
    try {
      const now = new Date().toISOString();
      const companyId = companyData.slug.trim().toLowerCase();
      const payload: Omit<Company, 'id'> = {
        ...companyData,
        slug: companyId,
        type: companyData.type || 'subsidiary',
        parentCompanyId: companyData.type === 'parent' ? null : PARENT_COMPANY_ID,
        status: companyData.status || 'active',
        adminIds: companyData.adminIds || [],
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, COMPANIES_COLLECTION, companyId), payload);

      if (seedSuggestedDepartments) {
        const seeds = SUGGESTED_DEPARTMENTS_BY_COMPANY[companyId] || [
          {
            id: `${companyId}-operations`,
            name: 'العمليات والإدارة',
            description: 'إدارة العمليات اليومية وتنسيق فرق العمل.',
            color: 'bg-emerald-600',
          },
        ];
        for (const seed of seeds) {
          await setDoc(
            doc(db, DEPARTMENTS_COLLECTION, seed.id),
            {
              companyId,
              name: seed.name,
              description: seed.description,
              color: seed.color,
              createdAt: now,
            },
            { merge: true }
          );
        }
      }

      await this.logActivity({
        companyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Company Created',
        target: companyData.name,
        targetId: companyId,
        timestamp: now,
        metadata: `تم إنشاء الشركة التابعة ${companyData.name}`,
      });

      return { id: companyId, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, COMPANIES_COLLECTION);
    }
  },

  async updateCompany(
    companyId: string,
    partial: Partial<Company>,
    actor: User,
    action: ActivityAction = 'Company Updated'
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(db, COMPANIES_COLLECTION, companyId),
        {
          ...partial,
          updatedAt: now,
        },
        { merge: true }
      );

      await this.logActivity({
        companyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action,
        target: partial.name || companyId,
        targetId: companyId,
        timestamp: now,
        metadata: partial.status ? `حالة الشركة: ${partial.status}` : 'تم تحديث بيانات الشركة',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COMPANIES_COLLECTION}/${companyId}`);
    }
  },

  async assignCompanyAdmin(
    userId: string,
    companyId: string,
    companyName: string | undefined,
    actor: User
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        role: 'COMPANY_ADMIN',
        companyId,
        ...(companyName ? { companyName } : {}),
        status: 'active',
        updatedAt: now,
      });

      await setDoc(
        doc(db, COMPANIES_COLLECTION, companyId),
        {
          adminIds: arrayUnion(userId),
          updatedAt: now,
        },
        { merge: true }
      );

      await this.logActivity({
        companyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Company Admin Assigned',
        target: companyName || companyId,
        targetId: userId,
        timestamp: now,
        metadata: `تم تعيين مدير شركة للشركة ${companyId}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COMPANIES_COLLECTION}/${companyId}`);
    }
  },

  async uploadCompanyLogo(companyId: string, file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('حجم الشعار يتجاوز الحد الأقصى المسموح (5 ميجابايت).');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('يرجى رفع ملف صورة صالح (PNG, JPG, WebP, SVG).');
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `companies/${companyId}/logos/${Date.now()}-${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  },

  async uploadTaskAttachment(companyId: string, taskId: string, file: File): Promise<string> {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error(`حجم الملف ${file.name} يتجاوز الحد المسموح (15 ميجابايت).`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(
      storage,
      `companies/${companyId}/tasks/${taskId}/${Date.now()}-${safeName}`
    );
    await uploadBytes(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    return getDownloadURL(storageRef);
  },

  // ==========================================
  // USERS / EMPLOYEES
  // ==========================================
  async getUsers(companyId?: string | null): Promise<User[]> {
    try {
      const q = buildCompanyScopedQuery(USERS_COLLECTION, companyId);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
    }
  },

  async getEmployees(companyId?: string | null): Promise<User[]> {
    return this.getUsers(companyId);
  },

  subscribeEmployees(
    callback: (users: User[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(USERS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        callback(list);
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
        }
        console.warn('Realtime employees listener fallback:', err);
        this.getEmployees(companyId).then(callback).catch(console.error);
      }
    );
  },

  async getUserById(id: string): Promise<User | null> {
    try {
      const snap = await getDoc(doc(db, USERS_COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as User;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${USERS_COLLECTION}/${id}`);
    }
  },

  async createUser(userData: Omit<User, 'id'>, actor: User): Promise<User> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(userData.companyId, actor);
      const requestedRole = normalizeRole(userData.role);
      const safeRole: CanonicalRole = canAssignRole(actor, requestedRole)
        ? requestedRole
        : 'EMPLOYEE';

      const payload: Omit<User, 'id'> = {
        ...userData,
        companyId: targetCompanyId,
        role: safeRole,
        createdAt: now,
        updatedAt: now,
      };
      const docRef = await addDoc(collection(db, USERS_COLLECTION), payload);

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Employee Created',
        target: userData.displayName,
        targetId: docRef.id,
        timestamp: now,
        metadata: `${safeRole} في ${userData.department} (${targetCompanyId})`,
      });

      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, USERS_COLLECTION);
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      await setDoc(
        doc(db, USERS_COLLECTION, user.id),
        {
          ...user,
          companyId: user.companyId || DEFAULT_SUBSIDIARY_ID,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${USERS_COLLECTION}/${user.id}`);
    }
  },

  async updateUser(userId: string, partial: Partial<User>, actor?: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        ...partial,
        updatedAt: now,
      });

      if (actor) {
        const companyId = resolveDocCompanyId(partial.companyId, actor);
        await this.logActivity({
          companyId,
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: normalizeRole(actor.role, actor.email),
          action: 'Employee Updated',
          target: partial.displayName || `Employee #${userId.slice(-4)}`,
          targetId: userId,
          timestamp: now,
          metadata: 'تم تحديث بيانات الموظف',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    }
  },

  // ==========================================
  // TASKS
  // ==========================================
  async getTasks(companyId?: string | null): Promise<Task[]> {
    try {
      const q = buildCompanyScopedQuery(TASKS_COLLECTION, companyId);
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      return sortByIsoDesc(list, t => t.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, TASKS_COLLECTION);
    }
  },

  subscribeTasks(
    callback: (tasks: Task[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(TASKS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        callback(sortByIsoDesc(list, t => t.createdAt));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, TASKS_COLLECTION);
        }
        console.warn('Realtime task listener fell back to manual fetch:', err);
        this.getTasks(companyId).then(callback).catch(console.error);
      }
    );
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const snap = await getDoc(doc(db, TASKS_COLLECTION, taskId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Task;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  async createTask(
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Task> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(taskData.companyId, actor);
      const cleanPayload = Object.fromEntries(
        Object.entries({
          ...taskData,
          companyId: targetCompanyId,
          createdAt: now,
          updatedAt: now,
        }).filter(([, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, TASKS_COLLECTION), cleanPayload);

      const newTask: Task = {
        id: docRef.id,
        ...taskData,
        companyId: targetCompanyId,
        createdAt: now,
        updatedAt: now,
      };

      await this.createNotification({
        companyId: targetCompanyId,
        userId: taskData.assignedTo,
        title: 'مهمة جديدة مسندة إليك',
        message: `تم إسناد المهمة "${taskData.title}" في قسم ${taskData.department}.`,
        type: 'task_assigned',
        relatedTaskId: docRef.id,
        read: false,
        createdAt: now,
      });

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Task Created',
        target: taskData.title,
        targetId: docRef.id,
        timestamp: now,
        metadata: `مسندة إلى ${taskData.assignedToName} (${taskData.priority})`,
      });

      return newTask;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, TASKS_COLLECTION);
    }
  },

  async updateTask(taskId: string, partial: Partial<Task>, actor: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
        ...partial,
        updatedAt: now,
      });

      await this.logActivity({
        companyId: resolveDocCompanyId(partial.companyId, actor),
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Task Updated',
        target: partial.title || `Task #${taskId.slice(-4)}`,
        targetId: taskId,
        timestamp: now,
        metadata: partial.status ? `تحديث الحالة إلى ${partial.status}` : 'تم تحديث تفاصيل المهمة',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  async updateTaskStatus(
    task: Task,
    newStatus: TaskStatus,
    actor: User,
    reviewStatus?: 'none' | 'pending_review' | 'approved' | 'rejected'
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(task.companyId, actor);
      const updates: Partial<Task> = {
        status: newStatus,
        updatedAt: now,
      };

      if (reviewStatus) {
        updates.reviewStatus = reviewStatus;
      }

      if (newStatus === 'Completed') {
        updates.completedAt = now;
        updates.completionPercentage = 100;
      }

      await updateDoc(doc(db, TASKS_COLLECTION, task.id), updates);

      if (newStatus === 'Review') {
        await this.createNotification({
          companyId: targetCompanyId,
          userId: task.createdBy,
          title: 'مهمة جاهزة للمراجعة',
          message: `قام ${actor.displayName} بتسليم "${task.title}" للمراجعة.`,
          type: 'task_approved',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      } else if (newStatus === 'Completed') {
        await this.createNotification({
          companyId: targetCompanyId,
          userId: task.assignedTo,
          title: 'تم اعتماد وإنجاز المهمة',
          message: `تم اعتماد "${task.title}" كمهمة مكتملة.`,
          type: 'task_approved',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      } else if (newStatus === 'Rejected') {
        await this.createNotification({
          companyId: targetCompanyId,
          userId: task.assignedTo,
          title: 'المهمة تحتاج تعديل',
          message: `تمت مراجعة "${task.title}" وتحتاج إلى تعديلات إضافية.`,
          type: 'task_rejected',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      }

      let action: 'Task Status Changed' | 'Task Completed' | 'Task Rejected' = 'Task Status Changed';
      if (newStatus === 'Completed') action = 'Task Completed';
      if (newStatus === 'Rejected') action = 'Task Rejected';

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action,
        target: task.title,
        targetId: task.id,
        timestamp: now,
        metadata: `تغيير الحالة من ${task.status} إلى ${newStatus}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TASKS_COLLECTION}/${task.id}`);
    }
  },

  async deleteTask(
    taskId: string,
    taskTitle: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
      await this.logActivity({
        companyId: resolveDocCompanyId(companyId, actor),
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Task Updated',
        target: taskTitle,
        targetId: taskId,
        timestamp: new Date().toISOString(),
        metadata: 'تم حذف المهمة بواسطة الإدارة',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  // ==========================================
  // COMMENTS
  // ==========================================
  async getComments(taskId: string): Promise<TaskComment[]> {
    try {
      const snap = await getDocs(collection(db, TASKS_COLLECTION, taskId, 'comments'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskComment));
      return list.sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `${TASKS_COLLECTION}/${taskId}/comments`);
    }
  },

  async addComment(
    taskId: string,
    commentData: Omit<TaskComment, 'id' | 'createdAt'>,
    task: Task
  ): Promise<TaskComment> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = task.companyId || commentData.companyId || DEFAULT_SUBSIDIARY_ID;
      const payload = {
        ...commentData,
        companyId: targetCompanyId,
        createdAt: now,
      };
      const docRef = await addDoc(collection(db, TASKS_COLLECTION, taskId, 'comments'), payload);

      const recipientId = commentData.userId === task.assignedTo ? task.createdBy : task.assignedTo;
      if (recipientId && recipientId !== commentData.userId) {
        await this.createNotification({
          companyId: targetCompanyId,
          userId: recipientId,
          title: `تعليق جديد على "${task.title.slice(0, 30)}"`,
          message: `${commentData.userName}: ${commentData.message.slice(0, 60)}`,
          type: 'comment_added',
          relatedTaskId: taskId,
          read: false,
          createdAt: now,
        });
      }

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: commentData.userId,
        actorName: commentData.userName,
        actorRole: commentData.userRole,
        action: 'Comment Added',
        target: task.title,
        targetId: taskId,
        timestamp: now,
      });

      return {
        id: docRef.id,
        ...payload,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${TASKS_COLLECTION}/${taskId}/comments`);
    }
  },

  // ==========================================
  // DEPARTMENTS
  // ==========================================
  async getDepartments(companyId?: string | null): Promise<Department[]> {
    try {
      const q = buildCompanyScopedQuery(DEPARTMENTS_COLLECTION, companyId);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, DEPARTMENTS_COLLECTION);
    }
  },

  subscribeDepartments(
    callback: (departments: Department[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(DEPARTMENTS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
        callback(list);
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, DEPARTMENTS_COLLECTION);
        }
        console.warn('Realtime departments listener fallback:', err);
        this.getDepartments(companyId).then(callback).catch(console.error);
      }
    );
  },

  async createDepartment(deptData: Omit<Department, 'id'>, actor: User): Promise<Department> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(deptData.companyId, actor);
      const payload = {
        ...deptData,
        companyId: targetCompanyId,
        createdAt: now,
      };
      const docRef = await addDoc(collection(db, DEPARTMENTS_COLLECTION), payload);

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Department Created',
        target: deptData.name,
        targetId: docRef.id,
        timestamp: now,
      });

      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, DEPARTMENTS_COLLECTION);
    }
  },

  async updateDepartment(deptId: string, partial: Partial<Department>, actor: User): Promise<void> {
    try {
      await updateDoc(doc(db, DEPARTMENTS_COLLECTION, deptId), partial);
      await this.logActivity({
        companyId: resolveDocCompanyId(partial.companyId, actor),
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Department Updated',
        target: partial.name || `Department #${deptId.slice(-4)}`,
        targetId: deptId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${DEPARTMENTS_COLLECTION}/${deptId}`);
    }
  },

  async saveDepartment(dept: Department, actor: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(dept.companyId, actor);
      await setDoc(
        doc(db, DEPARTMENTS_COLLECTION, dept.id),
        {
          ...dept,
          companyId: targetCompanyId,
          createdAt: dept.createdAt || now,
        },
        { merge: true }
      );

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Department Created',
        target: dept.name,
        targetId: dept.id,
        timestamp: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${DEPARTMENTS_COLLECTION}/${dept.id}`);
    }
  },

  async deleteDepartment(
    deptId: string,
    deptName: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, DEPARTMENTS_COLLECTION, deptId));
      await this.logActivity({
        companyId: resolveDocCompanyId(companyId, actor),
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Department Updated',
        target: deptName,
        targetId: deptId,
        timestamp: new Date().toISOString(),
        metadata: 'تم حذف القسم',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${DEPARTMENTS_COLLECTION}/${deptId}`);
    }
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const snap = await getDocs(
        query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId), limit(30))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      return sortByIsoDesc(list, n => n.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, NOTIFICATIONS_COLLECTION);
    }
  },

  subscribeNotifications(
    userId: string,
    _role: Role,
    callback: (notifs: Notification[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      limit(40)
    );
    return onSnapshot(
      q,
      snap => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        if (companyId && companyId !== PARENT_COMPANY_ID) {
          list = list.filter(n => !n.companyId || n.companyId === companyId);
        }
        callback(sortByIsoDesc(list, n => n.createdAt));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, NOTIFICATIONS_COLLECTION);
        }
        console.warn('Realtime notifications listener fallback:', err);
        this.getNotifications(userId).then(callback).catch(console.error);
      }
    );
  },

  async createNotification(
    notif: Omit<Notification, 'id' | 'createdAt'> & { createdAt?: string }
  ): Promise<void> {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
        ...notif,
        companyId: notif.companyId || DEFAULT_SUBSIDIARY_ID,
        createdAt: notif.createdAt || new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, NOTIFICATIONS_COLLECTION);
    }
  },

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${NOTIFICATIONS_COLLECTION}/${id}`);
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const snap = await getDocs(
        query(
          collection(db, NOTIFICATIONS_COLLECTION),
          where('userId', '==', userId),
          where('read', '==', false)
        )
      );
      for (const d of snap.docs) {
        await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, d.id), { read: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, NOTIFICATIONS_COLLECTION);
    }
  },

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  async getActivityLogs(companyId?: string | null): Promise<ActivityLog[]> {
    try {
      const q = buildCompanyScopedQuery(ACTIVITY_COLLECTION, companyId, 60);
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
      return sortByIsoDesc(list, l => l.timestamp);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, ACTIVITY_COLLECTION);
    }
  },

  subscribeActivityLogs(
    callback: (logs: ActivityLog[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(ACTIVITY_COLLECTION, companyId, 60);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
        callback(sortByIsoDesc(list, l => l.timestamp));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, ACTIVITY_COLLECTION);
        }
        console.warn('Realtime activity logs listener fallback:', err);
        this.getActivityLogs(companyId).then(callback).catch(console.error);
      }
    );
  },

  async logActivity(log: Omit<ActivityLog, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, ACTIVITY_COLLECTION), {
        ...log,
        companyId: log.companyId || DEFAULT_SUBSIDIARY_ID,
      });
    } catch (err) {
      console.warn('Non-blocking activity log write failed:', err);
    }
  },

  // ==========================================
  // CLIENTS
  // ==========================================
  async getClients(companyId?: string | null): Promise<Client[]> {
    try {
      const q = buildCompanyScopedQuery(CLIENTS_COLLECTION, companyId);
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      return sortByIsoDesc(list, c => c.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, CLIENTS_COLLECTION);
    }
  },

  subscribeClients(
    callback: (clients: Client[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(CLIENTS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        callback(sortByIsoDesc(list, c => c.createdAt));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, CLIENTS_COLLECTION);
        }
        console.warn('Realtime clients listener fallback:', err);
        this.getClients(companyId).then(callback).catch(console.error);
      }
    );
  },

  async getClientById(id: string): Promise<Client | null> {
    try {
      const snap = await getDoc(doc(db, CLIENTS_COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Client;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${CLIENTS_COLLECTION}/${id}`);
    }
  },

  async createClient(
    clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Client> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(clientData.companyId, actor);
      const payload = {
        ...clientData,
        companyId: targetCompanyId,
        status: clientData.status || 'active',
        createdAt: now,
        updatedAt: now,
      };
      const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), payload);

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Client Created',
        target: clientData.name,
        targetId: docRef.id,
        timestamp: now,
        metadata: `نوع العميل: ${clientData.clientType}`,
      });

      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, CLIENTS_COLLECTION);
    }
  },

  async updateClient(clientId: string, partial: Partial<Client>, actor?: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), {
        ...partial,
        updatedAt: now,
      });

      if (actor) {
        await this.logActivity({
          companyId: resolveDocCompanyId(partial.companyId, actor),
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: normalizeRole(actor.role, actor.email),
          action: 'Client Updated',
          target: partial.name || `عميل #${clientId.slice(-4)}`,
          targetId: clientId,
          timestamp: now,
          metadata: 'تم تحديث بيانات العميل',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${CLIENTS_COLLECTION}/${clientId}`);
    }
  },

  async deleteClient(clientId: string, actor?: User, companyId?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, CLIENTS_COLLECTION, clientId));
      if (actor) {
        await this.logActivity({
          companyId: resolveDocCompanyId(companyId, actor),
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: normalizeRole(actor.role, actor.email),
          action: 'Client Deleted',
          target: `عميل #${clientId.slice(-4)}`,
          targetId: clientId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${CLIENTS_COLLECTION}/${clientId}`);
    }
  },

  // ==========================================
  // PROJECTS
  // ==========================================
  async getProjects(companyId?: string | null): Promise<Project[]> {
    try {
      const q = buildCompanyScopedQuery(PROJECTS_COLLECTION, companyId);
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      return sortByIsoDesc(list, p => p.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, PROJECTS_COLLECTION);
    }
  },

  subscribeProjects(
    callback: (projects: Project[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(PROJECTS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        callback(sortByIsoDesc(list, p => p.createdAt));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, PROJECTS_COLLECTION);
        }
        console.warn('Realtime projects listener fallback:', err);
        this.getProjects(companyId).then(callback).catch(console.error);
      }
    );
  },

  async getProjectById(id: string): Promise<Project | null> {
    try {
      const snap = await getDoc(doc(db, PROJECTS_COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Project;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${PROJECTS_COLLECTION}/${id}`);
    }
  },

  async createProject(
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Project> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(projectData.companyId, actor);
      const payload = {
        ...projectData,
        companyId: targetCompanyId,
        createdAt: now,
        updatedAt: now,
      };
      const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), payload);

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'Project Created',
        target: projectData.name,
        targetId: docRef.id,
        timestamp: now,
        metadata: `العميل: ${projectData.clientName}`,
      });

      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, PROJECTS_COLLECTION);
    }
  },

  async updateProject(projectId: string, partial: Partial<Project>, actor?: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
        ...partial,
        updatedAt: now,
      });

      if (actor) {
        await this.logActivity({
          companyId: resolveDocCompanyId(partial.companyId, actor),
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: normalizeRole(actor.role, actor.email),
          action: 'Project Updated',
          target: partial.name || `مشروع #${projectId.slice(-4)}`,
          targetId: projectId,
          timestamp: now,
          metadata: 'تم تحديث بيانات المشروع',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${PROJECTS_COLLECTION}/${projectId}`);
    }
  },

  async deleteProject(projectId: string, actor?: User, companyId?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
      if (actor) {
        await this.logActivity({
          companyId: resolveDocCompanyId(companyId, actor),
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: normalizeRole(actor.role, actor.email),
          action: 'Project Deleted',
          target: `مشروع #${projectId.slice(-4)}`,
          targetId: projectId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${PROJECTS_COLLECTION}/${projectId}`);
    }
  },

  // ==========================================
  // EQUIPMENT & EQUIPMENT HISTORY (Company-Scoped)
  // ==========================================
  async getEquipment(companyId?: string | null): Promise<Equipment[]> {
    try {
      const q = buildCompanyScopedQuery(EQUIPMENT_COLLECTION, companyId);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, EQUIPMENT_COLLECTION);
    }
  },

  subscribeEquipment(
    callback: (items: Equipment[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(EQUIPMENT_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
        callback(sortByIsoDesc(list, e => e.createdAt));
      },
      err => {
        if (!auth.currentUser) return;
        console.warn('Equipment listener warning:', err);
        callback([]);
      }
    );
  },

  async createEquipment(
    equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Equipment> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(equipmentData.companyId, actor);
      const payload = {
        ...equipmentData,
        companyId: targetCompanyId,
        createdAt: now,
        updatedAt: now,
      };
      const docRef = await addDoc(collection(db, EQUIPMENT_COLLECTION), payload);

      await addDoc(collection(db, EQUIPMENT_HISTORY_COLLECTION), {
        companyId: targetCompanyId,
        equipmentId: docRef.id,
        equipmentName: equipmentData.name,
        action: 'created',
        newStatus: equipmentData.status,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        timestamp: now,
      } satisfies Omit<EquipmentHistory, 'id'>);

      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, EQUIPMENT_COLLECTION);
    }
  },

  // ==========================================
  // STORED REPORTS (Company-Scoped)
  // ==========================================
  async saveReport(
    report: Omit<StoredReport, 'id' | 'createdAt'>,
    actor: User
  ): Promise<StoredReport> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(report.companyId, actor);
      const payload = {
        ...report,
        companyId: targetCompanyId,
        createdAt: now,
      };
      const docRef = await addDoc(collection(db, REPORTS_COLLECTION), payload);
      return { id: docRef.id, ...payload };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, REPORTS_COLLECTION);
    }
  },

  async getReports(companyId?: string | null): Promise<StoredReport[]> {
    try {
      const q = buildCompanyScopedQuery(REPORTS_COLLECTION, companyId, 50);
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredReport));
      return sortByIsoDesc(list, r => r.createdAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, REPORTS_COLLECTION);
    }
  },

  // ==========================================
  // JOIN REQUESTS / PENDING APPROVALS
  // ==========================================
  async getPendingUsers(companyId?: string | null): Promise<User[]> {
    try {
      const allUsers = await this.getUsers(companyId);
      return allUsers.filter(u => isPendingStatus(u.status));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
    }
  },

  subscribePendingUsers(
    callback: (users: User[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const q = buildCompanyScopedQuery(USERS_COLLECTION, companyId);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        callback(list.filter(u => isPendingStatus(u.status)));
      },
      err => {
        if (!auth.currentUser) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
        }
        console.warn('Pending users listener error:', err);
        this.getPendingUsers(companyId).then(callback).catch(console.error);
      }
    );
  },

  async approveUser(
    userId: string,
    assignedRole: Role,
    actor: User,
    companyId?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(companyId, actor);
      const requestedRole = normalizeRole(assignedRole);
      const safeRole: CanonicalRole = canAssignRole(actor, requestedRole)
        ? requestedRole
        : 'EMPLOYEE';

      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        status: 'active',
        role: safeRole,
        companyId: targetCompanyId,
        approvedBy: actor.id,
        approvedByName: actor.displayName,
        approvedAt: now,
        updatedAt: now,
      });

      await this.createNotification({
        companyId: targetCompanyId,
        userId,
        title: 'تمت الموافقة على انضمامك إلى المنظومة',
        message: `مرحباً بك في الفريق! تمت الموافقة على حسابك وتم تفعيل صلاحياتك.`,
        type: 'join_approved',
        read: false,
      });

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'User Approved',
        target: `الموظف #${userId.slice(-4)}`,
        targetId: userId,
        timestamp: now,
        metadata: `تم التعيين برتبة: ${safeRole} في الشركة: ${targetCompanyId}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    }
  },

  async rejectUser(
    userId: string,
    reason: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const targetCompanyId = resolveDocCompanyId(companyId, actor);
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: now,
      });

      await this.logActivity({
        companyId: targetCompanyId,
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: normalizeRole(actor.role, actor.email),
        action: 'User Rejected',
        target: `مستخدم #${userId.slice(-4)}`,
        targetId: userId,
        timestamp: now,
        metadata: `السبب: ${reason || 'لم يتم تحديد سبب'}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    }
  },
};

type DataServiceContract = typeof FirestoreDataService;

/**
 * Runtime DataService router:
 * - Uses FirestoreDataService whenever a Firebase Auth session is active.
 * - Uses LocalDataService when login is disabled (direct access mode) so every
 *   multi-company operation works end-to-end without Firestore permission errors.
 */
export const DataService: DataServiceContract = new Proxy(FirestoreDataService, {
  get(_target, prop, _receiver) {
    const activeService = (auth.currentUser ? FirestoreDataService : LocalDataService) as unknown as Record<
      PropertyKey,
      unknown
    >;
    const value = activeService[prop];
    return typeof value === 'function' ? value.bind(activeService) : value;
  },
});
