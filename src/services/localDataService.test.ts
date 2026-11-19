import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalDataService, DEFAULT_DIRECT_ACCESS_USER } from './localDataService';
import { PARENT_COMPANY_ID } from '../config/companies';
import type { User } from '../types';

test('Full CRUD, Workflow, Multi-Company Isolation & RBAC Integration Suite', async () => {
  const superAdmin = DEFAULT_DIRECT_ACCESS_USER;

  // =========================================================================
  // 1. COMPANY MANAGEMENT (Create, Edit, Deactivate, Reactivate)
  // =========================================================================
  const initialCompanies = await LocalDataService.getCompanies(null);
  const initialIds = initialCompanies.map(c => c.id);
  assert.ok(initialIds.includes('lumere-group'));
  assert.ok(initialIds.includes('lumere'));
  assert.ok(initialIds.includes('nex-aura'));
  assert.ok(initialIds.includes('ordark'));

  const newCompany = await LocalDataService.createCompany(
    {
      name: 'LUMERE STUDIO',
      arabicName: 'لومير ستوديو للإنتاج',
      slug: 'lumere-studio',
      type: 'subsidiary',
      parentCompanyId: PARENT_COMPANY_ID,
      logo: '',
      description: 'استوديو تصوير ومونتاج',
      businessSector: 'الإنتاج الفني',
      status: 'active',
    },
    superAdmin,
    true
  );
  assert.equal(newCompany.id, 'lumere-studio');

  // Edit & toggle status (deactivate -> reactivate)
  await LocalDataService.updateCompany('lumere-studio', { description: 'وصف محدث', status: 'inactive' }, superAdmin, 'Company Status Changed');
  let fetchedStudio = (await LocalDataService.getCompanies('lumere-studio'))[0];
  assert.equal(fetchedStudio.status, 'inactive');
  assert.equal(fetchedStudio.description, 'وصف محدث');

  await LocalDataService.updateCompany('lumere-studio', { status: 'active' }, superAdmin, 'Company Status Changed');
  fetchedStudio = (await LocalDataService.getCompanies('lumere-studio'))[0];
  assert.equal(fetchedStudio.status, 'active');

  // =========================================================================
  // 2. DEPARTMENTS CRUD (Create, Edit, Delete)
  // =========================================================================
  const studioDepts = await LocalDataService.getDepartments('lumere-studio');
  assert.ok(studioDepts.length >= 1);
  assert.ok(studioDepts.every(d => d.companyId === 'lumere-studio'));

  const createdDept = await LocalDataService.createDepartment(
    {
      companyId: 'nex-aura',
      name: 'أمن المعلومات',
      description: 'تدقيق وحماية الأنظمة السحابية',
      color: 'bg-emerald-700',
    },
    superAdmin
  );
  await LocalDataService.updateDepartment(createdDept.id, { companyId: 'nex-aura', description: 'وصف محدث للأمن السيبراني' }, superAdmin);
  assert.ok((await LocalDataService.getDepartments('nex-aura')).some(d => d.id === createdDept.id && d.description.includes('السيبراني')));
  await LocalDataService.deleteDepartment(createdDept.id, createdDept.name, superAdmin, 'nex-aura');
  assert.equal((await LocalDataService.getDepartments('nex-aura')).some(d => d.id === createdDept.id), false);

  // =========================================================================
  // 3. EMPLOYEE MANAGEMENT (Create, Assign Manager, Edit, Suspend, Join Approval)
  // =========================================================================
  const nexManager = await LocalDataService.createUser(
    {
      uid: 'uid-nex-mgr',
      companyId: 'nex-aura',
      companyName: 'NEX AURA',
      email: 'mgr@nexaura.io',
      displayName: 'خالد السبيعي',
      role: 'MANAGER',
      department: 'تطوير البرمجيات',
      position: 'مدير الهندسة',
      phone: '0550001111',
      status: 'active',
      joinedDate: '2026-01-01',
    },
    superAdmin
  );

  const nexEmp = await LocalDataService.createUser(
    {
      uid: 'uid-nex-1',
      companyId: 'nex-aura',
      companyName: 'NEX AURA',
      email: 'dev@nexaura.io',
      displayName: 'طارق المطيري',
      role: 'EMPLOYEE',
      department: 'تطوير البرمجيات',
      position: 'مهندس برمجيات',
      managerId: nexManager.id,
      managerName: nexManager.displayName,
      phone: '0551112233',
      status: 'active',
      joinedDate: '2026-01-01',
    },
    superAdmin
  );

  // Suspend & reactivate employee
  await LocalDataService.updateUser(nexEmp.id, { companyId: 'nex-aura', status: 'suspended', position: 'مهندس برمجيات أول' }, superAdmin);
  let loadedEmp = await LocalDataService.getUserById(nexEmp.id);
  assert.equal(loadedEmp?.status, 'suspended');
  assert.equal(loadedEmp?.position, 'مهندس برمجيات أول');
  assert.equal(loadedEmp?.managerId, nexManager.id);

  await LocalDataService.updateUser(nexEmp.id, { companyId: 'nex-aura', status: 'active' }, superAdmin);
  loadedEmp = await LocalDataService.getUserById(nexEmp.id);
  assert.equal(loadedEmp?.status, 'active');

  // Pending join request -> approve & reject
  const pendingUser = await LocalDataService.createUser(
    {
      uid: 'uid-pending-1',
      companyId: 'ordark',
      email: 'driver@ordark.io',
      displayName: 'سائق جديد',
      role: 'EMPLOYEE',
      department: 'السائقون والتوصيل',
      position: 'سائق',
      status: 'pending',
      joinedDate: '2026-01-10',
    },
    superAdmin
  );
  assert.ok((await LocalDataService.getPendingUsers('ordark')).some(u => u.id === pendingUser.id));
  await LocalDataService.approveUser(pendingUser.id, 'EMPLOYEE', superAdmin, 'ordark');
  assert.equal((await LocalDataService.getUserById(pendingUser.id))?.status, 'active');

  // Anti-escalation check: COMPANY_ADMIN cannot create SUPER_ADMIN
  const companyAdminActor: User = {
    id: 'ca-ordark',
    uid: 'ca-ordark',
    companyId: 'ordark',
    email: 'admin@ordark.io',
    displayName: 'مدير أوردارك',
    role: 'COMPANY_ADMIN',
    department: 'العمليات اللوجستية',
    position: 'مدير الشركة',
    status: 'active',
    joinedDate: '2026-01-01',
  };
  const escalatedAttempt = await LocalDataService.createUser(
    {
      uid: 'uid-attempt',
      companyId: 'ordark',
      email: 'attempt@ordark.io',
      displayName: 'محاولة ترقية',
      role: 'SUPER_ADMIN',
      department: 'العمليات اللوجستية',
      position: 'موظف',
      status: 'active',
      joinedDate: '2026-01-01',
    },
    companyAdminActor
  );
  assert.equal(escalatedAttempt.role, 'EMPLOYEE');

  // =========================================================================
  // 4. CLIENTS, PROJECTS, TASKS, WORKFLOW, COMMENTS, ATTACHMENTS & ISOLATION
  // =========================================================================
  const nexClient = await LocalDataService.createClient(
    {
      companyId: 'nex-aura',
      name: 'شركة المدار التقنية',
      clientType: 'company',
      phone: '0509998877',
      email: 'info@madar.sa',
      address: 'الرياض',
      status: 'active',
    },
    superAdmin
  );
  await LocalDataService.updateClient(nexClient.id, { companyId: 'nex-aura', address: 'الرياض - العليا' }, superAdmin);
  assert.equal((await LocalDataService.getClientById(nexClient.id))?.address, 'الرياض - العليا');

  const nexProject = await LocalDataService.createProject(
    {
      companyId: 'nex-aura',
      name: 'منصة التجارة السحابية',
      description: 'تطوير منصة B2B متكاملة',
      clientId: nexClient.id,
      clientName: nexClient.name,
      department: 'تطوير البرمجيات',
      status: 'in_progress',
      startDate: '2026-02-01',
      deliveryDate: '2026-06-01',
    },
    superAdmin
  );
  await LocalDataService.updateProject(nexProject.id, { companyId: 'nex-aura', progress: 50 }, superAdmin);
  assert.equal((await LocalDataService.getProjectById(nexProject.id))?.progress, 50);

  const nexTask = await LocalDataService.createTask(
    {
      companyId: 'nex-aura',
      taskId: 'TSK-901',
      title: 'بناء واجهة API للطلبات',
      description: 'تنفيذ نقاط النهاية الآمنة',
      department: 'تطوير البرمجيات',
      priority: 'High',
      status: 'Pending',
      assignedTo: nexEmp.id,
      assignedToName: nexEmp.displayName,
      assignedToEmail: nexEmp.email,
      createdBy: superAdmin.id,
      createdByName: superAdmin.displayName,
      startDate: '2026-02-05',
      deadline: '2026-03-15',
      completionPercentage: 0,
      reviewStatus: 'none',
      projectId: nexProject.id,
      projectName: nexProject.name,
      clientId: nexClient.id,
      clientName: nexClient.name,
    },
    superAdmin
  );

  // Full workflow: Pending -> In Progress -> Review -> Rejected -> In Progress -> Review -> Completed
  await LocalDataService.updateTaskStatus(nexTask, 'In Progress', nexEmp);
  assert.equal((await LocalDataService.getTaskById(nexTask.id))?.status, 'In Progress');

  await LocalDataService.updateTaskStatus({ ...nexTask, status: 'In Progress' }, 'Review', nexEmp, 'pending_review');
  assert.equal((await LocalDataService.getTaskById(nexTask.id))?.status, 'Review');

  await LocalDataService.updateTaskStatus({ ...nexTask, status: 'Review' }, 'Rejected', nexManager, 'rejected');
  assert.equal((await LocalDataService.getTaskById(nexTask.id))?.status, 'Rejected');

  await LocalDataService.updateTaskStatus({ ...nexTask, status: 'Rejected' }, 'In Progress', nexEmp, 'none');
  await LocalDataService.updateTaskStatus({ ...nexTask, status: 'In Progress' }, 'Review', nexEmp, 'pending_review');
  await LocalDataService.updateTaskStatus({ ...nexTask, status: 'Review' }, 'Completed', nexManager, 'approved');
  const completedTask = await LocalDataService.getTaskById(nexTask.id);
  assert.equal(completedTask?.status, 'Completed');
  assert.equal(completedTask?.completionPercentage, 100);

  // Comments & Notifications
  const comment = await LocalDataService.addComment(
    nexTask.id,
    {
      companyId: 'nex-aura',
      taskId: nexTask.id,
      userId: nexEmp.id,
      userName: nexEmp.displayName,
      userRole: nexEmp.role,
      message: 'تم رفع التوثيق الكامل لواجهة API',
    },
    nexTask
  );
  assert.equal((await LocalDataService.getComments(nexTask.id)).length, 1);
  assert.equal(comment.companyId, 'nex-aura');

  const empNotifs = await LocalDataService.getNotifications(nexEmp.id);
  assert.ok(empNotifs.length >= 2);
  await LocalDataService.markAllNotificationsAsRead(nexEmp.id);
  assert.ok((await LocalDataService.getNotifications(nexEmp.id)).every(n => n.read === true));

  // =========================================================================
  // 5. EQUIPMENT, REPORTS, ACTIVITY LOGS & CROSS-COMPANY ISOLATION
  // =========================================================================
  const eq = await LocalDataService.createEquipment(
    {
      companyId: 'nex-aura',
      name: 'MacBook Pro M4',
      type: 'laptop',
      serialNumber: 'MBP-2026-01',
      status: 'assigned',
      assignedTo: nexEmp.id,
      assignedToName: nexEmp.displayName,
      projectId: nexProject.id,
      projectName: nexProject.name,
    },
    superAdmin
  );
  assert.ok((await LocalDataService.getEquipment('nex-aura')).some(e => e.id === eq.id));
  assert.equal((await LocalDataService.getEquipment('ordark')).some(e => e.id === eq.id), false);

  const report = await LocalDataService.saveReport(
    {
      companyId: 'nex-aura',
      title: 'تقرير الأداء الشهري - NEX AURA',
      period: 'monthly',
      generatedBy: superAdmin.id,
      generatedByName: superAdmin.displayName,
      metrics: { tasks: 1, completionRate: 100 },
    },
    superAdmin
  );
  assert.ok((await LocalDataService.getReports('nex-aura')).some(r => r.id === report.id));
  assert.equal((await LocalDataService.getReports('ordark')).some(r => r.id === report.id), false);

  // Zero cross-company leakage verified across all collections
  assert.equal((await LocalDataService.getUsers('ordark')).some(u => u.id === nexEmp.id), false);
  assert.equal((await LocalDataService.getClients('ordark')).some(c => c.id === nexClient.id), false);
  assert.equal((await LocalDataService.getProjects('ordark')).some(p => p.id === nexProject.id), false);
  assert.equal((await LocalDataService.getTasks('ordark')).some(t => t.id === nexTask.id), false);
  assert.equal((await LocalDataService.getTasks('lumere')).some(t => t.id === nexTask.id), false);

  // Consolidated LUMERE GROUP view sees NEX AURA records
  assert.equal((await LocalDataService.getTasks(null)).some(t => t.id === nexTask.id), true);

  // Cleanup delete tests (task, project, client)
  await LocalDataService.deleteTask(nexTask.id, nexTask.title, superAdmin, 'nex-aura');
  assert.equal(await LocalDataService.getTaskById(nexTask.id), null);
  await LocalDataService.deleteProject(nexProject.id, superAdmin, 'nex-aura');
  assert.equal(await LocalDataService.getProjectById(nexProject.id), null);
  await LocalDataService.deleteClient(nexClient.id, superAdmin, 'nex-aura');
  assert.equal(await LocalDataService.getClientById(nexClient.id), null);

  // Activity logs recorded cleanly under nex-aura
  const nexLogs = await LocalDataService.getActivityLogs('nex-aura');
  assert.ok(nexLogs.length >= 5);
  assert.ok(nexLogs.every(l => l.companyId === 'nex-aura'));
});
