import { Unsubscribe } from 'firebase/firestore';
import {
  ActivityAction,
  ActivityLog,
  CanonicalRole,
  Client,
  Company,
  Department,
  Equipment,
  EquipmentHistory,
  Notification,
  Project,
  Role,
  Task,
  TaskComment,
  TaskStatus,
  User,
} from '../../types';
import {
  CORE_COMPANIES,
  DEFAULT_SUBSIDIARY_ID,
  PARENT_COMPANY_ID,
  SUGGESTED_DEPARTMENTS_BY_COMPANY,
} from '../../config/companies';
import { canAssignRole, getUserCompanyId, isPendingStatus, normalizeRole } from '../../utils/rbac';
import type { StoredReport } from './dataService';
import { N8nService } from '../integrations/n8nService';

const STORAGE_KEY = 'lumere_group_erp_local_store_v1';

export const DEFAULT_DIRECT_ACCESS_USER: User = {
  id: 'lumere-super-admin',
  uid: 'lumere-super-admin',
  companyId: PARENT_COMPANY_ID,
  companyName: 'LUMERE GROUP',
  email: 'lumerecompany@gmail.com',
  displayName: 'إدارة LUMERE GROUP',
  fullName: 'إدارة LUMERE GROUP',
  role: 'SUPER_ADMIN',
  department: 'الإدارة المركزية',
  position: 'مدير المجموعة الأعلى',
  jobTitle: 'مدير المجموعة الأعلى',
  phone: '',
  status: 'active',
  joinedDate: new Date().toISOString().split('T')[0],
  createdAt: new Date().toISOString(),
};

interface LocalStoreState {
  companies: Company[];
  users: User[];
  departments: Department[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  commentsByTask: Record<string, TaskComment[]>;
  equipment: Equipment[];
  equipmentHistory: EquipmentHistory[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  reports: StoredReport[];
}

type StoreKey = keyof LocalStoreState;
type Listener = () => void;

const listeners: Record<StoreKey, Set<Listener>> = {
  companies: new Set(),
  users: new Set(),
  departments: new Set(),
  clients: new Set(),
  projects: new Set(),
  tasks: new Set(),
  commentsByTask: new Set(),
  equipment: new Set(),
  equipmentHistory: new Set(),
  notifications: new Set(),
  activityLogs: new Set(),
  reports: new Set(),
};

function buildInitialDepartments(): Department[] {
  const now = new Date().toISOString();
  const list: Department[] = [];
  for (const [companyId, seeds] of Object.entries(SUGGESTED_DEPARTMENTS_BY_COMPANY)) {
    for (const seed of seeds) {
      list.push({
        id: seed.id,
        companyId,
        name: seed.name,
        description: seed.description,
        color: seed.color,
        createdAt: now,
      });
    }
  }
  return list;
}

function createInitialState(): LocalStoreState {
  return {
    companies: [...CORE_COMPANIES],
    users: [DEFAULT_DIRECT_ACCESS_USER],
    departments: buildInitialDepartments(),
    clients: [],
    projects: [],
    tasks: [],
    commentsByTask: {},
    equipment: [],
    equipmentHistory: [],
    notifications: [],
    activityLogs: [],
    reports: [],
  };
}

let cachedState: LocalStoreState | null = null;

function readState(): LocalStoreState {
  if (cachedState) return cachedState;
  const fallback = createInitialState();
  if (typeof window === 'undefined' || !window.localStorage) {
    cachedState = fallback;
    return cachedState;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedState = fallback;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
      return cachedState;
    }
    const parsed = JSON.parse(raw) as Partial<LocalStoreState>;
    cachedState = {
      companies: Array.isArray(parsed.companies) && parsed.companies.length > 0 ? parsed.companies : fallback.companies,
      users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : fallback.users,
      departments: Array.isArray(parsed.departments) ? parsed.departments : fallback.departments,
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      commentsByTask: parsed.commentsByTask && typeof parsed.commentsByTask === 'object' ? parsed.commentsByTask : {},
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      equipmentHistory: Array.isArray(parsed.equipmentHistory) ? parsed.equipmentHistory : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
    return cachedState;
  } catch {
    cachedState = fallback;
    return cachedState;
  }
}

function persistState(mutatedKeys: StoreKey[]): void {
  if (typeof window !== 'undefined' && window.localStorage && cachedState) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
    } catch {
      // Ignore quota errors
    }
  }
  for (const key of mutatedKeys) {
    listeners[key].forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('Local store listener error:', err);
      }
    });
  }
}

function subscribeKey(key: StoreKey, emit: () => void): Unsubscribe {
  listeners[key].add(emit);
  // Emit current state asynchronously on next microtask so React effects settle cleanly
  queueMicrotask(emit);
  return () => {
    listeners[key].delete(emit);
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function filterByCompany<T extends { companyId?: string }>(items: T[], companyId?: string | null): T[] {
  if (!companyId || companyId === PARENT_COMPANY_ID) return [...items];
  return items.filter(item => (item.companyId || DEFAULT_SUBSIDIARY_ID) === companyId);
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المرفوع محلياً.'));
    reader.readAsDataURL(file);
  });
}

export const LocalDataService = {
  // ==========================================
  // COMPANIES
  // ==========================================
  async getCompanies(companyId?: string | null): Promise<Company[]> {
    const state = readState();
    if (companyId && companyId !== PARENT_COMPANY_ID) {
      return state.companies.filter(c => c.id === companyId);
    }
    return [...state.companies];
  },

  subscribeCompanies(
    companyId: string | null | undefined,
    callback: (companies: Company[]) => void
  ): Unsubscribe {
    return subscribeKey('companies', () => {
      const state = readState();
      if (companyId && companyId !== PARENT_COMPANY_ID) {
        callback(state.companies.filter(c => c.id === companyId));
      } else {
        callback([...state.companies]);
      }
    });
  },

  async createCompany(
    companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User,
    seedSuggestedDepartments = false
  ): Promise<Company> {
    const state = readState();
    const now = new Date().toISOString();
    const companyId = companyData.slug.trim().toLowerCase();
    const created: Company = {
      id: companyId,
      ...companyData,
      slug: companyId,
      type: companyData.type || 'subsidiary',
      parentCompanyId: companyData.type === 'parent' ? null : PARENT_COMPANY_ID,
      status: companyData.status || 'active',
      adminIds: companyData.adminIds || [],
      createdAt: now,
      updatedAt: now,
    };

    const existingIdx = state.companies.findIndex(c => c.id === companyId);
    if (existingIdx >= 0) {
      state.companies[existingIdx] = created;
    } else {
      state.companies.push(created);
    }

    const mutated: StoreKey[] = ['companies'];
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
        if (!state.departments.some(d => d.id === seed.id)) {
          state.departments.push({
            id: seed.id,
            companyId,
            name: seed.name,
            description: seed.description,
            color: seed.color,
            createdAt: now,
          });
        }
      }
      mutated.push('departments');
    }

    persistState(mutated);

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

    return created;
  },

  async updateCompany(
    companyId: string,
    partial: Partial<Company>,
    actor: User,
    action: ActivityAction = 'Company Updated'
  ): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    state.companies = state.companies.map(c =>
      c.id === companyId ? { ...c, ...partial, updatedAt: now } : c
    );
    persistState(['companies']);

    await this.logActivity({
      companyId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      action,
      target: partial.name || companyId,
      targetId: companyId,
      timestamp: now,
      metadata: partial.status ? `تم تحديث حالة الشركة إلى ${partial.status}` : 'تم تحديث بيانات الشركة',
    });
  },

  async assignCompanyAdmin(
    userId: string,
    companyId: string,
    companyName: string | undefined,
    actor: User
  ): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    state.users = state.users.map(u =>
      u.id === userId
        ? {
            ...u,
            role: 'COMPANY_ADMIN',
            companyId,
            ...(companyName ? { companyName } : {}),
            status: 'active',
            updatedAt: now,
          }
        : u
    );
    state.companies = state.companies.map(c =>
      c.id === companyId
        ? {
            ...c,
            adminIds: Array.from(new Set([...(c.adminIds || []), userId])),
            updatedAt: now,
          }
        : c
    );
    persistState(['users', 'companies']);

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
  },

  async uploadCompanyLogo(_companyId: string, file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('حجم الشعار يتجاوز الحد الأقصى المسموح (5 ميجابايت).');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('يرجى رفع ملف صورة صالح (PNG, JPG, WebP, SVG).');
    }
    return readFileAsDataUrl(file);
  },

  async uploadTaskAttachment(_companyId: string, _taskId: string, file: File): Promise<string> {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error(`حجم الملف ${file.name} يتجاوز الحد المسموح (15 ميجابايت).`);
    }
    return readFileAsDataUrl(file);
  },

  // ==========================================
  // USERS / EMPLOYEES
  // ==========================================
  async getUsers(companyId?: string | null): Promise<User[]> {
    return filterByCompany(readState().users, companyId);
  },

  async getEmployees(companyId?: string | null): Promise<User[]> {
    return this.getUsers(companyId);
  },

  subscribeEmployees(
    callback: (users: User[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('users', () => {
      callback(filterByCompany(readState().users, companyId));
    });
  },

  async getUserById(id: string): Promise<User | null> {
    return readState().users.find(u => u.id === id) || null;
  },

  async createUser(userData: Omit<User, 'id'>, actor: User): Promise<User> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(userData.companyId, actor);
    const requestedRole = normalizeRole(userData.role);
    const safeRole: CanonicalRole = canAssignRole(actor, requestedRole) ? requestedRole : 'EMPLOYEE';

    const created: User = {
      id: makeId('usr'),
      ...userData,
      companyId: targetCompanyId,
      role: safeRole,
      createdAt: now,
      updatedAt: now,
    };
    state.users.push(created);
    persistState(['users']);

    await this.logActivity({
      companyId: targetCompanyId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      action: 'Employee Created',
      target: userData.displayName,
      targetId: created.id,
      timestamp: now,
      metadata: `${safeRole} في ${userData.department} (${targetCompanyId})`,
    });

    return created;
  },

  async saveUser(user: User): Promise<void> {
    const state = readState();
    const updated: User = {
      ...user,
      companyId: user.companyId || DEFAULT_SUBSIDIARY_ID,
      updatedAt: new Date().toISOString(),
    };
    const idx = state.users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      state.users[idx] = { ...state.users[idx], ...updated };
    } else {
      state.users.push(updated);
    }
    persistState(['users']);
  },

  async updateUser(userId: string, partial: Partial<User>, actor?: User): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    state.users = state.users.map(u =>
      u.id === userId ? { ...u, ...partial, updatedAt: now } : u
    );
    persistState(['users']);

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
  },

  // ==========================================
  // TASKS
  // ==========================================
  async getTasks(companyId?: string | null): Promise<Task[]> {
    return sortByIsoDesc(filterByCompany(readState().tasks, companyId), t => t.createdAt);
  },

  subscribeTasks(callback: (tasks: Task[]) => void, companyId?: string | null): Unsubscribe {
    return subscribeKey('tasks', () => {
      callback(sortByIsoDesc(filterByCompany(readState().tasks, companyId), t => t.createdAt));
    });
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    return readState().tasks.find(t => t.id === taskId) || null;
  },

  async createTask(
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Task> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(taskData.companyId, actor);
    const created: Task = {
      id: makeId('tsk'),
      ...taskData,
      companyId: targetCompanyId,
      createdAt: now,
      updatedAt: now,
    };
    state.tasks.unshift(created);
    persistState(['tasks']);

    await this.createNotification({
      companyId: targetCompanyId,
      userId: taskData.assignedTo,
      title: 'مهمة جديدة مسندة إليك',
      message: `تم إسناد المهمة "${taskData.title}" في قسم ${taskData.department}.`,
      type: 'task_assigned',
      relatedTaskId: created.id,
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
      targetId: created.id,
      timestamp: now,
      metadata: `مسندة إلى ${taskData.assignedToName} (${taskData.priority})`,
    });

    void N8nService.notifyTaskCreated(created);

    return created;
  },

  async updateTask(taskId: string, partial: Partial<Task>, actor: User): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    let updatedTask: Task | undefined;
    state.tasks = state.tasks.map(t => {
      if (t.id !== taskId) return t;
      updatedTask = { ...t, ...partial, updatedAt: now };
      return updatedTask;
    });
    persistState(['tasks']);

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

    if (
      updatedTask &&
      (partial.status !== undefined || partial.completionPercentage !== undefined)
    ) {
      void N8nService.notifyTaskStatusUpdated(updatedTask);
    }
  },

  async updateTaskStatus(
    task: Task,
    newStatus: TaskStatus,
    actor: User,
    reviewStatus?: 'none' | 'pending_review' | 'approved' | 'rejected'
  ): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(task.companyId, actor);
    const updates: Partial<Task> = {
      status: newStatus,
      updatedAt: now,
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(newStatus === 'Completed' ? { completedAt: now, completionPercentage: 100 } : {}),
    };

    state.tasks = state.tasks.map(t => (t.id === task.id ? { ...t, ...updates } : t));
    persistState(['tasks']);

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

    void N8nService.notifyTaskStatusUpdated({ ...task, ...updates });
  },

  async deleteTask(
    taskId: string,
    taskTitle: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    const state = readState();
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    delete state.commentsByTask[taskId];
    persistState(['tasks', 'commentsByTask']);

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
  },

  // ==========================================
  // COMMENTS
  // ==========================================
  async getComments(taskId: string): Promise<TaskComment[]> {
    const list = readState().commentsByTask[taskId] || [];
    return [...list].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  },

  async addComment(
    taskId: string,
    commentData: Omit<TaskComment, 'id' | 'createdAt'>,
    task: Task
  ): Promise<TaskComment> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = task.companyId || commentData.companyId || DEFAULT_SUBSIDIARY_ID;
    const created: TaskComment = {
      id: makeId('cmt'),
      ...commentData,
      companyId: targetCompanyId,
      createdAt: now,
    };
    state.commentsByTask[taskId] = [...(state.commentsByTask[taskId] || []), created];
    persistState(['commentsByTask']);

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

    return created;
  },

  // ==========================================
  // DEPARTMENTS
  // ==========================================
  async getDepartments(companyId?: string | null): Promise<Department[]> {
    return filterByCompany(readState().departments, companyId);
  },

  subscribeDepartments(
    callback: (departments: Department[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('departments', () => {
      callback(filterByCompany(readState().departments, companyId));
    });
  },

  async createDepartment(deptData: Omit<Department, 'id'>, actor: User): Promise<Department> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(deptData.companyId, actor);
    const created: Department = {
      id: makeId('dept'),
      ...deptData,
      companyId: targetCompanyId,
      createdAt: now,
    };
    state.departments.push(created);
    persistState(['departments']);

    await this.logActivity({
      companyId: targetCompanyId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      action: 'Department Created',
      target: deptData.name,
      targetId: created.id,
      timestamp: now,
    });

    return created;
  },

  async updateDepartment(deptId: string, partial: Partial<Department>, actor: User): Promise<void> {
    const state = readState();
    state.departments = state.departments.map(d => (d.id === deptId ? { ...d, ...partial } : d));
    persistState(['departments']);

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
  },

  async saveDepartment(dept: Department, actor: User): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(dept.companyId, actor);
    const record: Department = {
      ...dept,
      companyId: targetCompanyId,
      createdAt: dept.createdAt || now,
    };
    const idx = state.departments.findIndex(d => d.id === dept.id);
    if (idx >= 0) {
      state.departments[idx] = { ...state.departments[idx], ...record };
    } else {
      state.departments.push(record);
    }
    persistState(['departments']);

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
  },

  async deleteDepartment(
    deptId: string,
    deptName: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    const state = readState();
    state.departments = state.departments.filter(d => d.id !== deptId);
    persistState(['departments']);

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
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  async getNotifications(userId: string): Promise<Notification[]> {
    return sortByIsoDesc(
      readState().notifications.filter(n => n.userId === userId),
      n => n.createdAt
    );
  },

  subscribeNotifications(
    userId: string,
    _role: Role,
    callback: (notifs: Notification[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('notifications', () => {
      let list = readState().notifications.filter(n => n.userId === userId);
      if (companyId && companyId !== PARENT_COMPANY_ID) {
        list = list.filter(n => !n.companyId || n.companyId === companyId);
      }
      callback(sortByIsoDesc(list, n => n.createdAt));
    });
  },

  async createNotification(
    notif: Omit<Notification, 'id' | 'createdAt'> & { createdAt?: string }
  ): Promise<void> {
    const state = readState();
    state.notifications.unshift({
      id: makeId('ntf'),
      ...notif,
      companyId: notif.companyId || DEFAULT_SUBSIDIARY_ID,
      createdAt: notif.createdAt || new Date().toISOString(),
    });
    persistState(['notifications']);
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const state = readState();
    state.notifications = state.notifications.map(n => (n.id === id ? { ...n, read: true } : n));
    persistState(['notifications']);
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const state = readState();
    state.notifications = state.notifications.map(n =>
      n.userId === userId ? { ...n, read: true } : n
    );
    persistState(['notifications']);
  },

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  async getActivityLogs(companyId?: string | null): Promise<ActivityLog[]> {
    return sortByIsoDesc(filterByCompany(readState().activityLogs, companyId), l => l.timestamp).slice(0, 60);
  },

  subscribeActivityLogs(
    callback: (logs: ActivityLog[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('activityLogs', () => {
      callback(
        sortByIsoDesc(filterByCompany(readState().activityLogs, companyId), l => l.timestamp).slice(0, 60)
      );
    });
  },

  async logActivity(log: Omit<ActivityLog, 'id'>): Promise<void> {
    const state = readState();
    state.activityLogs.unshift({
      id: makeId('log'),
      ...log,
      companyId: log.companyId || DEFAULT_SUBSIDIARY_ID,
    });
    persistState(['activityLogs']);
  },

  // ==========================================
  // CLIENTS
  // ==========================================
  async getClients(companyId?: string | null): Promise<Client[]> {
    return sortByIsoDesc(filterByCompany(readState().clients, companyId), c => c.createdAt);
  },

  subscribeClients(callback: (clients: Client[]) => void, companyId?: string | null): Unsubscribe {
    return subscribeKey('clients', () => {
      callback(sortByIsoDesc(filterByCompany(readState().clients, companyId), c => c.createdAt));
    });
  },

  async getClientById(id: string): Promise<Client | null> {
    return readState().clients.find(c => c.id === id) || null;
  },

  async createClient(
    clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Client> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(clientData.companyId, actor);
    const created: Client = {
      id: makeId('cli'),
      ...clientData,
      companyId: targetCompanyId,
      status: clientData.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
    state.clients.unshift(created);
    persistState(['clients']);

    await this.logActivity({
      companyId: targetCompanyId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      action: 'Client Created',
      target: clientData.name,
      targetId: created.id,
      timestamp: now,
      metadata: `نوع العميل: ${clientData.clientType}`,
    });

    return created;
  },

  async updateClient(clientId: string, partial: Partial<Client>, actor?: User): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    state.clients = state.clients.map(c =>
      c.id === clientId ? { ...c, ...partial, updatedAt: now } : c
    );
    persistState(['clients']);

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
  },

  async deleteClient(clientId: string, actor?: User, companyId?: string): Promise<void> {
    const state = readState();
    state.clients = state.clients.filter(c => c.id !== clientId);
    persistState(['clients']);

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
  },

  // ==========================================
  // PROJECTS
  // ==========================================
  async getProjects(companyId?: string | null): Promise<Project[]> {
    return sortByIsoDesc(filterByCompany(readState().projects, companyId), p => p.createdAt);
  },

  subscribeProjects(
    callback: (projects: Project[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('projects', () => {
      callback(sortByIsoDesc(filterByCompany(readState().projects, companyId), p => p.createdAt));
    });
  },

  async getProjectById(id: string): Promise<Project | null> {
    return readState().projects.find(p => p.id === id) || null;
  },

  async createProject(
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Project> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(projectData.companyId, actor);
    const created: Project = {
      id: makeId('prj'),
      ...projectData,
      companyId: targetCompanyId,
      createdAt: now,
      updatedAt: now,
    };
    state.projects.unshift(created);
    persistState(['projects']);

    await this.logActivity({
      companyId: targetCompanyId,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      action: 'Project Created',
      target: projectData.name,
      targetId: created.id,
      timestamp: now,
      metadata: `العميل: ${projectData.clientName}`,
    });

    return created;
  },

  async updateProject(projectId: string, partial: Partial<Project>, actor?: User): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    state.projects = state.projects.map(p =>
      p.id === projectId ? { ...p, ...partial, updatedAt: now } : p
    );
    persistState(['projects']);

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
  },

  async deleteProject(projectId: string, actor?: User, companyId?: string): Promise<void> {
    const state = readState();
    state.projects = state.projects.filter(p => p.id !== projectId);
    persistState(['projects']);

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
  },

  // ==========================================
  // EQUIPMENT
  // ==========================================
  async getEquipment(companyId?: string | null): Promise<Equipment[]> {
    return sortByIsoDesc(filterByCompany(readState().equipment, companyId), e => e.createdAt);
  },

  subscribeEquipment(
    callback: (items: Equipment[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('equipment', () => {
      callback(sortByIsoDesc(filterByCompany(readState().equipment, companyId), e => e.createdAt));
    });
  },

  async createEquipment(
    equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>,
    actor: User
  ): Promise<Equipment> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(equipmentData.companyId, actor);
    const created: Equipment = {
      id: makeId('eqp'),
      ...equipmentData,
      companyId: targetCompanyId,
      createdAt: now,
      updatedAt: now,
    };
    state.equipment.unshift(created);
    state.equipmentHistory.unshift({
      id: makeId('eqh'),
      companyId: targetCompanyId,
      equipmentId: created.id,
      equipmentName: equipmentData.name,
      action: 'created',
      newStatus: equipmentData.status,
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: normalizeRole(actor.role, actor.email),
      timestamp: now,
    });
    persistState(['equipment', 'equipmentHistory']);

    return created;
  },

  // ==========================================
  // STORED REPORTS
  // ==========================================
  async saveReport(
    report: Omit<StoredReport, 'id' | 'createdAt'>,
    actor: User
  ): Promise<StoredReport> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(report.companyId, actor);
    const created: StoredReport = {
      id: makeId('rpt'),
      ...report,
      companyId: targetCompanyId,
      createdAt: now,
    };
    state.reports.unshift(created);
    persistState(['reports']);
    return created;
  },

  async getReports(companyId?: string | null): Promise<StoredReport[]> {
    return sortByIsoDesc(filterByCompany(readState().reports, companyId), r => r.createdAt).slice(0, 50);
  },

  // ==========================================
  // JOIN REQUESTS / PENDING APPROVALS
  // ==========================================
  async getPendingUsers(companyId?: string | null): Promise<User[]> {
    const all = await this.getUsers(companyId);
    return all.filter(u => isPendingStatus(u.status));
  },

  subscribePendingUsers(
    callback: (users: User[]) => void,
    companyId?: string | null
  ): Unsubscribe {
    return subscribeKey('users', () => {
      callback(filterByCompany(readState().users, companyId).filter(u => isPendingStatus(u.status)));
    });
  },

  async approveUser(
    userId: string,
    assignedRole: Role,
    actor: User,
    companyId?: string
  ): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(companyId, actor);
    const requestedRole = normalizeRole(assignedRole);
    const safeRole: CanonicalRole = canAssignRole(actor, requestedRole) ? requestedRole : 'EMPLOYEE';

    state.users = state.users.map(u =>
      u.id === userId
        ? {
            ...u,
            status: 'active',
            role: safeRole,
            companyId: targetCompanyId,
            approvedBy: actor.id,
            approvedByName: actor.displayName,
            approvedAt: now,
            updatedAt: now,
          }
        : u
    );
    persistState(['users']);

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
  },

  async rejectUser(
    userId: string,
    reason: string,
    actor: User,
    companyId?: string
  ): Promise<void> {
    const state = readState();
    const now = new Date().toISOString();
    const targetCompanyId = resolveDocCompanyId(companyId, actor);

    state.users = state.users.map(u =>
      u.id === userId
        ? {
            ...u,
            status: 'rejected',
            rejectionReason: reason,
            updatedAt: now,
          }
        : u
    );
    persistState(['users']);

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
  },
};
