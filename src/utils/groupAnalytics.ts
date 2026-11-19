import {
  Client,
  Company,
  CompanyPerformanceMetrics,
  Department,
  GroupOverviewStats,
  Project,
  Task,
  User,
} from '../types';
import { DEFAULT_SUBSIDIARY_ID, PARENT_COMPANY_ID } from '../config/companies';
import { isActiveStatus, isPendingStatus } from './rbac';

export function isTaskOverdue(task: Pick<Task, 'deadline' | 'status'>, referenceDate = new Date()): boolean {
  if (!task.deadline) return false;
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  const todayIso = referenceDate.toISOString().split('T')[0];
  return task.deadline < todayIso;
}

export function computeGroupOverviewStats(params: {
  companies: Company[];
  users: User[];
  departments: Department[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  referenceDate?: Date;
}): GroupOverviewStats {
  const {
    companies,
    users,
    departments,
    clients,
    projects,
    tasks,
    referenceDate = new Date(),
  } = params;

  const subsidiaries = companies.filter(c => c.type === 'subsidiary');

  const byCompany: CompanyPerformanceMetrics[] = subsidiaries.map(company => {
    const cid = company.id;
    const companyUsers = users.filter(u => (u.companyId || DEFAULT_SUBSIDIARY_ID) === cid);
    const companyDepartments = departments.filter(d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === cid);
    const companyClients = clients.filter(c => (c.companyId || DEFAULT_SUBSIDIARY_ID) === cid);
    const companyProjects = projects.filter(p => (p.companyId || DEFAULT_SUBSIDIARY_ID) === cid);
    const companyTasks = tasks.filter(t => (t.companyId || DEFAULT_SUBSIDIARY_ID) === cid);

    const activeEmployeesCount = companyUsers.filter(u => isActiveStatus(u.status)).length;
    const pendingEmployeesCount = companyUsers.filter(u => isPendingStatus(u.status)).length;
    const completedProjectsCount = companyProjects.filter(p => p.status === 'completed').length;
    const activeProjectsCount = companyProjects.filter(
      p => p.status !== 'completed' && p.status !== 'cancelled'
    ).length;

    const completedTasksCount = companyTasks.filter(t => t.status === 'Completed').length;
    const activeTasksCount = companyTasks.filter(
      t => t.status !== 'Completed' && t.status !== 'Cancelled'
    ).length;
    const overdueTasksCount = companyTasks.filter(t => isTaskOverdue(t, referenceDate)).length;
    const completionRate =
      companyTasks.length > 0 ? Math.round((completedTasksCount / companyTasks.length) * 100) : 0;

    return {
      companyId: cid,
      companyName: company.name,
      companyArabicName: company.arabicName || company.name,
      slug: company.slug,
      type: company.type,
      status: company.status,
      businessSector: company.businessSector || company.description || '',
      employeesCount: companyUsers.length,
      activeEmployeesCount,
      pendingEmployeesCount,
      departmentsCount: companyDepartments.length,
      clientsCount: companyClients.length,
      projectsCount: companyProjects.length,
      activeProjectsCount,
      completedProjectsCount,
      totalTasksCount: companyTasks.length,
      activeTasksCount,
      completedTasksCount,
      overdueTasksCount,
      completionRate,
    };
  });

  const nonParentUsers = users.filter(u => u.companyId !== PARENT_COMPANY_ID);
  const totalEmployees = users.length;
  const activeEmployees = users.filter(u => isActiveStatus(u.status)).length;
  const totalProjects = projects.length;
  const activeProjects = projects.filter(
    p => p.status !== 'completed' && p.status !== 'cancelled'
  ).length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const activeTasks = tasks.filter(
    t => t.status !== 'Completed' && t.status !== 'Cancelled'
  ).length;
  const overdueTasks = tasks.filter(t => isTaskOverdue(t, referenceDate)).length;
  const overallCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  void nonParentUsers;

  return {
    totalCompanies: companies.length,
    activeSubsidiariesCount: subsidiaries.filter(c => c.status === 'active').length,
    totalEmployees,
    activeEmployees,
    totalProjects,
    activeProjects,
    totalTasks,
    activeTasks,
    completedTasks,
    overdueTasks,
    overallCompletionRate,
    byCompany,
  };
}
