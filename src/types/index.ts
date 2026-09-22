export type Role = 'ADMIN' | 'EMPLOYEE';

export type UserStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'suspended'
  | 'Active'
  | 'Inactive'
  | 'Suspended';

export interface User {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  fullName?: string;
  photoURL?: string;
  role: Role;
  department: string;
  position: string;
  jobTitle?: string;
  phone?: string;
  status: UserStatus;
  joinedDate: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  assignedTasksCount?: number;
  completedTasksCount?: number;
  overdueTasksCount?: number;
  completionRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ClientType =
  | 'company'
  | 'restaurant'
  | 'cafe'
  | 'store'
  | 'individual'
  | 'other'
  | 'corporate';

export type ClientStatus = 'active' | 'inactive';

export interface Client {
  id: string;
  name: string; // اسم العميل
  phone: string; // رقم الهاتف
  email: string; // البريد الإلكتروني
  company?: string; // اسم الشركة
  companyName?: string; // اسم الشركة إن وجد
  clientType: ClientType; // نوع العميل: شركة، مطعم، كافيه، متجر، فرد، أخرى
  address: string; // العنوان
  notes?: string; // ملاحظات
  assignedEmployeeId?: string; // الموظف المسؤول
  assignedEmployeeName?: string;
  assignedEmployeeIds?: string[]; // الموظفون المسؤولون
  createdAt: string; // تاريخ الإضافة
  updatedAt?: string;
  status?: ClientStatus;
  projectsCount?: number;
  tasksCount?: number;
  activeTasksCount?: number;
}

export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'review'
  | 'planning'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export interface Project {
  id: string;
  name: string; // اسم المشروع
  clientId: string; // العميل (مطلوب)
  clientName: string; // اسم العميل
  description: string; // وصف المشروع
  projectType?: string; // نوع المشروع
  department?: string; // القسم المسؤول
  priority?: TaskPriority | string; // الأولوية
  status: ProjectStatus; // حالة المشروع
  startDate: string; // تاريخ البداية
  deliveryDate: string; // موعد/تاريخ التسليم
  deadline?: string; // موعد التسليم
  projectManagerId?: string; // مدير المشروع
  projectManagerName?: string;
  managerId?: string;
  managerName?: string;
  teamMemberIds?: string[]; // الموظفون المشاركون (أعضاء المشروع)
  completionPercentage?: number; // نسبة الإنجاز
  progress?: number; // نسبة التقدم
  budget?: number; // الميزانية إن وجدت
  files?: TaskAttachment[];
  notes?: string;
  tasksCount?: number;
  completedTasksCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type EquipmentType =
  | 'laptop'
  | 'camera'
  | 'screen'
  | 'drone'
  | 'audio'
  | 'lighting'
  | 'accessory'
  | 'other';

export type EquipmentStatus =
  | 'available'
  | 'assigned'
  | 'in_maintenance'
  | 'damaged'
  | 'lost'
  | 'inactive';

export interface Equipment {
  id: string;
  name: string; // اسم المعدة
  type: EquipmentType | string; // النوع
  serialNumber: string; // الرقم التسلسلي
  assetId?: string; // رقم الأصل
  description?: string; // الوصف
  status: EquipmentStatus; // الحالة
  assignedTo?: string; // الموظف المسند إليه (User ID)
  assignedToName?: string; // اسم الموظف المسند إليه
  assignedToEmail?: string;
  projectId?: string; // المشروع المرتبطة به
  projectName?: string; // اسم المشروع المرتبط
  purchaseDate?: string; // تاريخ الشراء
  receivedDate?: string; // تاريخ الاستلام
  value?: number; // القيمة
  notes?: string; // الملاحظات
  photoURL?: string; // صورة المعدة
  createdAt: string;
  updatedAt: string;
}

export type EquipmentHistoryAction =
  | 'created'
  | 'assigned'
  | 'returned'
  | 'maintenance_in'
  | 'maintenance_out'
  | 'status_change'
  | 'updated';

export interface EquipmentHistory {
  id: string;
  equipmentId: string;
  equipmentName: string;
  action: EquipmentHistoryAction;
  assignedToId?: string;
  assignedToName?: string;
  returnedById?: string;
  returnedByName?: string;
  projectId?: string;
  projectName?: string;
  previousStatus?: EquipmentStatus;
  newStatus?: EquipmentStatus;
  notes?: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  timestamp: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TaskStatus = 'Pending' | 'In Progress' | 'Review' | 'Completed' | 'Rejected' | 'Cancelled';

export type TaskReviewStatus = 'none' | 'pending_review' | 'approved' | 'rejected';

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploaderName: string;
  uploaderId?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  taskId: string;
  title: string;
  description: string;
  createdBy: string;
  createdByName: string;
  assignedTo: string; // primary assignee UID
  assignedToName: string;
  assignedToEmail: string;
  assignedToPhoto?: string;
  coAssignees?: string[]; // optional additional employee IDs
  department: string;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  completedAt?: string;
  completionPercentage: number; // 0 - 100
  reviewStatus: TaskReviewStatus;
  clientId?: string; // العميل المرتبط
  clientName?: string;
  projectId?: string; // المشروع المرتبط
  projectName?: string;
  attachments?: TaskAttachment[];
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole: Role;
  userAvatar?: string;
  message: string;
  attachmentName?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  headName?: string;
  managerId?: string;
  managerName?: string;
  color?: string;
  employeesCount?: number;
  totalTasks?: number;
  completedTasks?: number;
  pendingTasks?: number;
  overdueTasks?: number;
  completionRate?: number;
  createdAt?: string;
}

export type NotificationType =
  | 'task_assigned'
  | 'deadline_approaching'
  | 'task_rejected'
  | 'task_approved'
  | 'comment_added'
  | 'task_reassigned'
  | 'join_approved'
  | 'join_rejected'
  | 'client_created'
  | 'project_created'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedTaskId?: string;
  relatedProjectId?: string;
  relatedClientId?: string;
  read: boolean;
  createdAt: string;
}

export type ActivityAction =
  | 'Task Created'
  | 'Task Updated'
  | 'Task Assigned'
  | 'Task Status Changed'
  | 'Task Completed'
  | 'Task Rejected'
  | 'Employee Created'
  | 'Employee Updated'
  | 'Client Created'
  | 'Client Updated'
  | 'Client Deleted'
  | 'Project Created'
  | 'Project Updated'
  | 'Project Deleted'
  | 'User Approved'
  | 'User Rejected'
  | 'Department Created'
  | 'Department Updated'
  | 'Comment Added'
  | 'File Uploaded'
  | 'User Login'
  | 'User Logout';

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: ActivityAction;
  target: string;
  targetId: string;
  timestamp: string;
  metadata?: string;
}

export interface TaskFilterOptions {
  searchQuery: string;
  status: TaskStatus | 'All';
  priority: TaskPriority | 'All';
  department: string | 'All';
  assignedTo: string | 'All';
  clientId?: string | 'All';
  projectId?: string | 'All';
  dateFilter: 'all' | 'today' | 'this_week' | 'overdue';
}
