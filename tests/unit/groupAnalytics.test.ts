import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGroupOverviewStats, isTaskOverdue } from '../../src/utils/groupAnalytics';
import { CORE_COMPANIES, PARENT_COMPANY_ID } from '../../src/config/companies';
import { Client, Department, Project, Task, User } from '../../src/types';

const refDate = new Date('2026-05-15T12:00:00.000Z');

test('isTaskOverdue detects past deadlines for open tasks and ignores completed/cancelled tasks', () => {
  assert.equal(isTaskOverdue({ deadline: '2026-05-14', status: 'In Progress' }, refDate), true);
  assert.equal(isTaskOverdue({ deadline: '2026-05-15', status: 'In Progress' }, refDate), false);
  assert.equal(isTaskOverdue({ deadline: '2026-05-20', status: 'Pending' }, refDate), false);
  assert.equal(isTaskOverdue({ deadline: '2026-05-01', status: 'Completed' }, refDate), false);
  assert.equal(isTaskOverdue({ deadline: '2026-05-01', status: 'Cancelled' }, refDate), false);
  assert.equal(isTaskOverdue({ deadline: '', status: 'Pending' }, refDate), false);
});

test('computeGroupOverviewStats returns zeroed metrics on empty datasets and excludes parent from subsidiary breakdown', () => {
  const stats = computeGroupOverviewStats({
    companies: CORE_COMPANIES,
    users: [],
    departments: [],
    clients: [],
    projects: [],
    tasks: [],
    referenceDate: refDate,
  });

  assert.equal(stats.totalCompanies, 4);
  assert.equal(stats.activeSubsidiariesCount, 3);
  assert.equal(stats.totalEmployees, 0);
  assert.equal(stats.totalProjects, 0);
  assert.equal(stats.totalTasks, 0);
  assert.equal(stats.overallCompletionRate, 0);
  assert.equal(stats.byCompany.length, 3);
  assert.equal(stats.byCompany.some(c => c.companyId === PARENT_COMPANY_ID), false);
});

test('computeGroupOverviewStats aggregates multi-company metrics accurately across LUMERE, NEX AURA, and ORDARK', () => {
  const users: User[] = [
    {
      id: 'u-1',
      displayName: 'Super Admin',
      email: 'lumerecompany@gmail.com',
      role: 'SUPER_ADMIN',
      department: 'Executive',
      position: 'CEO',
      joinedDate: '2026-01-01',
      status: 'active',
      companyId: PARENT_COMPANY_ID,
    },
    {
      id: 'u-2',
      displayName: 'Lumere Legacy User',
      email: 'media@lumere.com',
      role: 'EMPLOYEE',
      department: 'Media Production',
      position: 'Editor',
      joinedDate: '2026-01-10',
      status: 'Active',
      // Intentionally omitted companyId -> defaults to 'lumere'
    },
    {
      id: 'u-3',
      displayName: 'Lumere Pending',
      email: 'new@lumere.com',
      role: 'EMPLOYEE',
      department: 'Marketing',
      position: 'Specialist',
      joinedDate: '2026-05-01',
      status: 'pending',
      companyId: 'lumere',
    },
    {
      id: 'u-4',
      displayName: 'Nex Aura Dev',
      email: 'dev@nexaura.com',
      role: 'COMPANY_ADMIN',
      department: 'Software Development',
      position: 'Engineering Director',
      joinedDate: '2026-02-01',
      status: 'active',
      companyId: 'nex-aura',
    },
    {
      id: 'u-5',
      displayName: 'Ordark Ops',
      email: 'ops@ordark.com',
      role: 'MANAGER',
      department: 'Operations',
      position: 'Operations Manager',
      joinedDate: '2026-03-01',
      status: 'active',
      companyId: 'ordark',
    },
  ];

  const departments: Department[] = [
    { id: 'd-1', name: 'Marketing', description: 'Marketing & Growth', companyId: 'lumere' },
    { id: 'd-2', name: 'Software Development', description: 'Core Engineering', companyId: 'nex-aura' },
    { id: 'd-3', name: 'Dispatch', description: 'Dispatch & Fleet Routing', companyId: 'ordark' },
  ];

  const clients: Client[] = [
    {
      id: 'c-1',
      name: 'Brand A',
      phone: '01000000001',
      email: 'contact@branda.com',
      clientType: 'company',
      address: 'Cairo',
      createdAt: '2026-01-15',
      companyId: 'lumere',
    },
    {
      id: 'c-2',
      name: 'Tech B',
      phone: '01000000002',
      email: 'contact@techb.com',
      clientType: 'corporate',
      address: 'Riyadh',
      createdAt: '2026-02-15',
      companyId: 'nex-aura',
    },
  ];

  const projects: Project[] = [
    {
      id: 'p-1',
      name: 'Campaign Q2',
      clientId: 'c-1',
      clientName: 'Brand A',
      description: 'Seasonal media campaign',
      status: 'in_progress',
      startDate: '2026-04-01',
      deliveryDate: '2026-06-01',
      createdAt: '2026-04-01',
      updatedAt: '2026-05-01',
      companyId: 'lumere',
    },
    {
      id: 'p-2',
      name: 'Mobile ERP',
      clientId: 'c-2',
      clientName: 'Tech B',
      description: 'Mobile companion rollout',
      status: 'completed',
      startDate: '2026-01-01',
      deliveryDate: '2026-04-15',
      createdAt: '2026-01-01',
      updatedAt: '2026-04-15',
      companyId: 'nex-aura',
    },
    {
      id: 'p-3',
      name: 'Fleet Expansion',
      clientId: 'c-3',
      clientName: 'Logistics C',
      description: 'New regional fleet hubs',
      status: 'in_progress',
      startDate: '2026-05-01',
      deliveryDate: '2026-08-01',
      createdAt: '2026-05-01',
      updatedAt: '2026-05-10',
      companyId: 'ordark',
    },
  ];

  const tasks: Task[] = [
    {
      id: 't-1',
      taskId: 'TSK-101',
      title: 'Edit promo video',
      description: 'Cut final reel',
      createdBy: 'u-1',
      createdByName: 'Super Admin',
      department: 'Media Production',
      assignedTo: 'u-2',
      assignedToName: 'Lumere Legacy User',
      assignedToEmail: 'media@lumere.com',
      priority: 'High',
      status: 'Completed',
      startDate: '2026-05-01',
      deadline: '2026-05-10',
      completionPercentage: 100,
      reviewStatus: 'approved',
      createdAt: '2026-05-01',
      updatedAt: '2026-05-10',
      companyId: 'lumere',
    },
    {
      id: 't-2',
      taskId: 'TSK-102',
      title: 'Publish campaign',
      description: 'Social rollout',
      createdBy: 'u-1',
      createdByName: 'Super Admin',
      department: 'Marketing',
      assignedTo: 'u-2',
      assignedToName: 'Lumere Legacy User',
      assignedToEmail: 'media@lumere.com',
      priority: 'Urgent',
      status: 'In Progress',
      startDate: '2026-05-02',
      deadline: '2026-05-12', // Overdue
      completionPercentage: 50,
      reviewStatus: 'none',
      createdAt: '2026-05-02',
      updatedAt: '2026-05-11',
      companyId: 'lumere',
    },
    {
      id: 't-3',
      taskId: 'TSK-201',
      title: 'Deploy API v2',
      description: 'Zero downtime deploy',
      createdBy: 'u-4',
      createdByName: 'Nex Aura Dev',
      department: 'Software Development',
      assignedTo: 'u-4',
      assignedToName: 'Nex Aura Dev',
      assignedToEmail: 'dev@nexaura.com',
      priority: 'High',
      status: 'Completed',
      startDate: '2026-05-01',
      deadline: '2026-05-10',
      completionPercentage: 100,
      reviewStatus: 'approved',
      createdAt: '2026-05-01',
      updatedAt: '2026-05-10',
      companyId: 'nex-aura',
    },
    {
      id: 't-4',
      taskId: 'TSK-301',
      title: 'Optimize Cairo dispatch',
      description: 'Zone balancing',
      createdBy: 'u-5',
      createdByName: 'Ordark Ops',
      department: 'Dispatch',
      assignedTo: 'u-5',
      assignedToName: 'Ordark Ops',
      assignedToEmail: 'ops@ordark.com',
      priority: 'Medium',
      status: 'Pending',
      startDate: '2026-05-10',
      deadline: '2026-05-25',
      completionPercentage: 0,
      reviewStatus: 'none',
      createdAt: '2026-05-10',
      updatedAt: '2026-05-10',
      companyId: 'ordark',
    },
  ];

  const stats = computeGroupOverviewStats({
    companies: CORE_COMPANIES,
    users,
    departments,
    clients,
    projects,
    tasks,
    referenceDate: refDate,
  });

  assert.equal(stats.totalEmployees, 5);
  assert.equal(stats.activeEmployees, 4);
  assert.equal(stats.totalProjects, 3);
  assert.equal(stats.activeProjects, 2);
  assert.equal(stats.totalTasks, 4);
  assert.equal(stats.completedTasks, 2);
  assert.equal(stats.activeTasks, 2);
  assert.equal(stats.overdueTasks, 1);
  assert.equal(stats.overallCompletionRate, 50);

  const lumereStats = stats.byCompany.find(c => c.companyId === 'lumere');
  const nexAuraStats = stats.byCompany.find(c => c.companyId === 'nex-aura');
  const ordarkStats = stats.byCompany.find(c => c.companyId === 'ordark');

  assert.ok(lumereStats);
  assert.equal(lumereStats.employeesCount, 2);
  assert.equal(lumereStats.activeEmployeesCount, 1);
  assert.equal(lumereStats.pendingEmployeesCount, 1);
  assert.equal(lumereStats.overdueTasksCount, 1);
  assert.equal(lumereStats.completionRate, 50);

  assert.ok(nexAuraStats);
  assert.equal(nexAuraStats.completedProjectsCount, 1);
  assert.equal(nexAuraStats.activeProjectsCount, 0);
  assert.equal(nexAuraStats.completionRate, 100);

  assert.ok(ordarkStats);
  assert.equal(ordarkStats.activeProjectsCount, 1);
  assert.equal(ordarkStats.activeTasksCount, 1);
  assert.equal(ordarkStats.overdueTasksCount, 0);
  assert.equal(ordarkStats.completionRate, 0);
});
