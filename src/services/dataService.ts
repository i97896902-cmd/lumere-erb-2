import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  User,
  Task,
  Department,
  Notification,
  ActivityLog,
  TaskComment,
  TaskStatus,
  Role,
  Client,
  Project,
  Equipment,
  EquipmentHistory,
  EquipmentStatus,
} from '../types';

const USERS_COLLECTION = 'users';
const TASKS_COLLECTION = 'tasks';
const DEPARTMENTS_COLLECTION = 'departments';
const NOTIFICATIONS_COLLECTION = 'notifications';
const ACTIVITY_COLLECTION = 'activity_logs';
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const EQUIPMENT_COLLECTION = 'equipment';
const EQUIPMENT_HISTORY_COLLECTION = 'equipmentHistory';

export const DataService = {
  // USERS
  async getUsers(): Promise<User[]> {
    try {
      const snap = await getDocs(collection(db, USERS_COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, USERS_COLLECTION);
    }
  },

  async getEmployees(): Promise<User[]> {
    return this.getUsers();
  },

  subscribeEmployees(callback: (users: User[]) => void): Unsubscribe {
    const q = collection(db, USERS_COLLECTION);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        callback(list);
      },
      err => {
        console.warn('Realtime employees listener fallback:', err);
        this.getEmployees().then(callback).catch(console.error);
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
      const docRef = await addDoc(collection(db, USERS_COLLECTION), {
        ...userData,
        createdAt: now,
        updatedAt: now,
      });

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Employee Created',
        target: userData.displayName,
        targetId: docRef.id,
        timestamp: now,
        metadata: `${userData.role} in ${userData.department}`,
      });

      return { id: docRef.id, ...userData, createdAt: now, updatedAt: now };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, USERS_COLLECTION);
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      await setDoc(doc(db, USERS_COLLECTION, user.id), {
        ...user,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
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
        await this.logActivity({
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
          action: 'Employee Updated',
          target: partial.displayName || `Employee #${userId.slice(-4)}`,
          targetId: userId,
          timestamp: now,
          metadata: 'Personnel record modified',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    }
  },

  // TASKS
  async getTasks(): Promise<Task[]> {
    try {
      const snap = await getDocs(query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, TASKS_COLLECTION);
    }
  },

  subscribeTasks(callback: (tasks: Task[]) => void): Unsubscribe {
    const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        callback(list);
      },
      err => {
        console.warn('Realtime task listener fell back to manual fetch:', err);
        this.getTasks().then(callback).catch(console.error);
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

  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, actor: User): Promise<Task> {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
        ...taskData,
        createdAt: now,
        updatedAt: now,
      });

      const newTask: Task = {
        id: docRef.id,
        ...taskData,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Notify Assignee
      await this.createNotification({
        userId: taskData.assignedTo,
        title: 'New Task Assigned',
        message: `You were assigned task "${taskData.title}" in ${taskData.department}.`,
        type: 'task_assigned',
        relatedTaskId: docRef.id,
        read: false,
        createdAt: now,
      });

      // 2. Activity Log
      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Task Created',
        target: taskData.title,
        targetId: docRef.id,
        timestamp: now,
        metadata: `Assigned to ${taskData.assignedToName} (${taskData.priority} priority)`,
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
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Task Updated',
        target: partial.title || `Task #${taskId.slice(-4)}`,
        targetId: taskId,
        timestamp: now,
        metadata: partial.status ? `Status changed to ${partial.status}` : 'Task details updated',
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

      // Notifications
      if (newStatus === 'Review') {
        // Notify creator / manager that employee submitted task
        await this.createNotification({
          userId: task.createdBy,
          title: 'Task Ready for Review',
          message: `${actor.displayName} submitted "${task.title}" for review.`,
          type: 'task_approved',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      } else if (newStatus === 'Completed') {
        await this.createNotification({
          userId: task.assignedTo,
          title: 'Task Approved & Completed',
          message: `Great work! "${task.title}" has been approved as completed.`,
          type: 'task_approved',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      } else if (newStatus === 'Rejected') {
        await this.createNotification({
          userId: task.assignedTo,
          title: 'Task Needs Revision',
          message: `"${task.title}" was reviewed and requires updates.`,
          type: 'task_rejected',
          relatedTaskId: task.id,
          read: false,
          createdAt: now,
        });
      }

      // Activity log
      let action: 'Task Status Changed' | 'Task Completed' | 'Task Rejected' = 'Task Status Changed';
      if (newStatus === 'Completed') action = 'Task Completed';
      if (newStatus === 'Rejected') action = 'Task Rejected';

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action,
        target: task.title,
        targetId: task.id,
        timestamp: now,
        metadata: `Transitioned from ${task.status} to ${newStatus}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${TASKS_COLLECTION}/${task.id}`);
    }
  },

  async deleteTask(taskId: string, taskTitle: string, actor: User): Promise<void> {
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Task Updated',
        target: taskTitle,
        targetId: taskId,
        timestamp: new Date().toISOString(),
        metadata: 'Task removed by administrator',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${TASKS_COLLECTION}/${taskId}`);
    }
  },

  // COMMENTS
  async getComments(taskId: string): Promise<TaskComment[]> {
    try {
      const snap = await getDocs(
        query(collection(db, TASKS_COLLECTION, taskId, 'comments'), orderBy('createdAt', 'asc'))
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskComment));
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
      const docRef = await addDoc(collection(db, TASKS_COLLECTION, taskId, 'comments'), {
        ...commentData,
        createdAt: now,
      });

      // Notify task assignee if commenter isn't assignee, or notify creator
      const recipientId = commentData.userId === task.assignedTo ? task.createdBy : task.assignedTo;
      if (recipientId && recipientId !== commentData.userId) {
        await this.createNotification({
          userId: recipientId,
          title: `New Comment on "${task.title.slice(0, 30)}..."`,
          message: `${commentData.userName}: ${commentData.message.slice(0, 60)}...`,
          type: 'comment_added',
          relatedTaskId: taskId,
          read: false,
          createdAt: now,
        });
      }

      await this.logActivity({
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
        ...commentData,
        createdAt: now,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${TASKS_COLLECTION}/${taskId}/comments`);
    }
  },

  // DEPARTMENTS
  async getDepartments(): Promise<Department[]> {
    try {
      const snap = await getDocs(collection(db, DEPARTMENTS_COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, DEPARTMENTS_COLLECTION);
    }
  },

  subscribeDepartments(callback: (departments: Department[]) => void): Unsubscribe {
    const q = collection(db, DEPARTMENTS_COLLECTION);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Department));
        callback(list);
      },
      err => {
        console.warn('Realtime departments listener fallback:', err);
        this.getDepartments().then(callback).catch(console.error);
      }
    );
  },

  async createDepartment(deptData: Omit<Department, 'id'>, actor: User): Promise<Department> {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, DEPARTMENTS_COLLECTION), {
        ...deptData,
        createdAt: now,
      });

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Department Created',
        target: deptData.name,
        targetId: docRef.id,
        timestamp: now,
      });

      return { id: docRef.id, ...deptData, createdAt: now };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, DEPARTMENTS_COLLECTION);
    }
  },

  async updateDepartment(deptId: string, partial: Partial<Department>, actor: User): Promise<void> {
    try {
      await updateDoc(doc(db, DEPARTMENTS_COLLECTION, deptId), partial);
      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
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
      await setDoc(doc(db, DEPARTMENTS_COLLECTION, dept.id), {
        ...dept,
        createdAt: dept.createdAt || now,
      }, { merge: true });

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Department Created',
        target: dept.name,
        targetId: dept.id,
        timestamp: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${DEPARTMENTS_COLLECTION}/${dept.id}`);
    }
  },

  async deleteDepartment(deptId: string, deptName: string, actor: User): Promise<void> {
    try {
      await deleteDoc(doc(db, DEPARTMENTS_COLLECTION, deptId));
      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Employee Updated',
        target: deptName,
        targetId: deptId,
        timestamp: new Date().toISOString(),
        metadata: 'Department deleted',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${DEPARTMENTS_COLLECTION}/${deptId}`);
    }
  },

  // NOTIFICATIONS
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const snap = await getDocs(
        query(
          collection(db, NOTIFICATIONS_COLLECTION),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(30)
        )
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
    } catch (err) {
      // Fallback in case index is creating
      try {
        const snap = await getDocs(
          query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId), limit(30))
        );
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, NOTIFICATIONS_COLLECTION);
      }
    }
  },

  subscribeNotifications(
    userId: string,
    role: Role,
    callback: (notifs: Notification[]) => void
  ): Unsubscribe {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId), limit(30));
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(list);
      },
      err => {
        console.warn('Realtime notifications listener fallback:', err);
        this.getNotifications(userId).then(callback).catch(console.error);
      }
    );
  },

  async createNotification(notif: Omit<Notification, 'id' | 'createdAt'> & { createdAt?: string }): Promise<void> {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
        ...notif,
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
        query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId), where('read', '==', false))
      );
      for (const d of snap.docs) {
        await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, d.id), { read: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, NOTIFICATIONS_COLLECTION);
    }
  },

  // ACTIVITY LOGS
  async getActivityLogs(): Promise<ActivityLog[]> {
    try {
      const snap = await getDocs(
        query(collection(db, ACTIVITY_COLLECTION), orderBy('timestamp', 'desc'), limit(50))
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
    } catch (err) {
      try {
        const snap = await getDocs(query(collection(db, ACTIVITY_COLLECTION), limit(50)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
        return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, ACTIVITY_COLLECTION);
      }
    }
  },

  subscribeActivityLogs(callback: (logs: ActivityLog[]) => void): Unsubscribe {
    const q = query(collection(db, ACTIVITY_COLLECTION), limit(50));
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callback(list);
      },
      err => {
        console.warn('Realtime activity logs listener fallback:', err);
        this.getActivityLogs().then(callback).catch(console.error);
      }
    );
  },

  async logActivity(log: Omit<ActivityLog, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, ACTIVITY_COLLECTION), log);
    } catch (err) {
      console.warn('Non-blocking activity log write failed:', err);
    }
  },

  // CLIENTS
  async getClients(): Promise<Client[]> {
    try {
      const snap = await getDocs(query(collection(db, CLIENTS_COLLECTION), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
    } catch (err) {
      // Fallback in case index is pending
      try {
        const fallbackSnap = await getDocs(collection(db, CLIENTS_COLLECTION));
        return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, CLIENTS_COLLECTION);
      }
    }
  },

  subscribeClients(callback: (clients: Client[]) => void): Unsubscribe {
    const q = collection(db, CLIENTS_COLLECTION);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        callback(list);
      },
      err => {
        console.warn('Realtime clients listener fallback:', err);
        this.getClients().then(callback).catch(console.error);
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

  async createClient(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, actor: User): Promise<Client> {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
        ...clientData,
        status: clientData.status || 'active',
        createdAt: now,
        updatedAt: now,
      });

      const newClient: Client = {
        id: docRef.id,
        ...clientData,
        status: clientData.status || 'active',
        createdAt: now,
        updatedAt: now,
      };

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Client Created',
        target: clientData.name,
        targetId: docRef.id,
        timestamp: now,
        metadata: `نوع العميل: ${clientData.clientType}`,
      });

      return newClient;
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
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
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

  async deleteClient(clientId: string, actor?: User): Promise<void> {
    try {
      await deleteDoc(doc(db, CLIENTS_COLLECTION, clientId));
      if (actor) {
        await this.logActivity({
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
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

  // PROJECTS
  async getProjects(): Promise<Project[]> {
    try {
      const snap = await getDocs(query(collection(db, PROJECTS_COLLECTION), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (err) {
      try {
        const fallbackSnap = await getDocs(collection(db, PROJECTS_COLLECTION));
        return fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      } catch (err2) {
        handleFirestoreError(err2, OperationType.LIST, PROJECTS_COLLECTION);
      }
    }
  },

  subscribeProjects(callback: (projects: Project[]) => void): Unsubscribe {
    const q = collection(db, PROJECTS_COLLECTION);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        callback(list);
      },
      err => {
        console.warn('Realtime projects listener fallback:', err);
        this.getProjects().then(callback).catch(console.error);
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

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>, actor: User): Promise<Project> {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
        ...projectData,
        createdAt: now,
        updatedAt: now,
      });

      const newProject: Project = {
        id: docRef.id,
        ...projectData,
        createdAt: now,
        updatedAt: now,
      };

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'Project Created',
        target: projectData.name,
        targetId: docRef.id,
        timestamp: now,
        metadata: `العميل: ${projectData.clientName}`,
      });

      return newProject;
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
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
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

  async deleteProject(projectId: string, actor?: User): Promise<void> {
    try {
      await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
      if (actor) {
        await this.logActivity({
          actorId: actor.id,
          actorName: actor.displayName,
          actorRole: actor.role,
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

  // JOIN REQUESTS / PENDING APPROVALS
  async getPendingUsers(): Promise<User[]> {
    try {
      const snap = await getDocs(query(collection(db, USERS_COLLECTION), where('status', '==', 'pending')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    } catch (err) {
      const allUsers = await this.getUsers();
      return allUsers.filter(u => u.status === 'pending');
    }
  },

  subscribePendingUsers(callback: (users: User[]) => void): Unsubscribe {
    const q = collection(db, USERS_COLLECTION);
    return onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        const pending = list.filter(u => u.status === 'pending');
        callback(pending);
      },
      err => {
        console.warn('Pending users listener error:', err);
        this.getPendingUsers().then(callback).catch(console.error);
      }
    );
  },

  async approveUser(userId: string, assignedRole: Role, actor: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        status: 'active',
        role: 'EMPLOYEE',
        approvedBy: actor.id,
        approvedByName: actor.displayName,
        approvedAt: now,
        updatedAt: now,
      });

      // Send in-app notification to approved user
      await this.createNotification({
        userId,
        title: 'تمت الموافقة على انضمامك إلى Luméré',
        message: 'مرحباً بك في فريق Luméré! تمت الموافقة على حسابك كموظف.',
        type: 'join_approved',
        read: false,
      });

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'User Approved',
        target: `الموظف #${userId.slice(-4)}`,
        targetId: userId,
        timestamp: now,
        metadata: `تم التعيين برتبة: ${assignedRole}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    }
  },

  async rejectUser(userId: string, reason: string, actor: User): Promise<void> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: now,
      });

      await this.logActivity({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
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
