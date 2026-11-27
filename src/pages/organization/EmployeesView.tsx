import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Mail,
  Building2,
  Edit2,
  UserCheck,
  UserX,
  Layers,
  UserCog,
} from 'lucide-react';
import { Card, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RoleBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { User, Task, Department, CanonicalRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/data/dataService';
import { PrivilegedService } from '../../services/firebase/privilegedService';
import { DEFAULT_SUBSIDIARY_ID } from '../../config/companies';
import {
  canManageCompanyUsers,
  getAssignableRoles,
  getRoleArabicLabel,
  getUserCompanyId,
  isActiveStatus,
  isTaskAssignedToUser,
  normalizeRole,
} from '../../utils/rbac';

interface EmployeesViewProps {
  employees: User[];
  tasks: Task[];
  departments: Department[];
  onSelectTask: (taskId: string) => void;
  onRefreshEmployees: () => void;
}

export function EmployeesView({
  employees,
  tasks,
  departments,
  onRefreshEmployees,
}: EmployeesViewProps) {
  const { currentUser, isSuperAdmin } = useAuth();
  const {
    companies,
    subsidiaries,
    activeCompany,
    isGroupView,
    defaultWriteCompanyId,
    getCompanyById,
  } = useCompany();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');

  // Add/Edit Employee Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<CanonicalRole>('EMPLOYEE');
  const [formCompanyId, setFormCompanyId] = useState(defaultWriteCompanyId);
  const [formDept, setFormDept] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formManagerId, setFormManagerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageCurrentScope = canManageCompanyUsers(currentUser, defaultWriteCompanyId);
  const assignableRoles = useMemo(() => getAssignableRoles(currentUser), [currentUser]);

  const scopedFormDepartments = useMemo(
    () => departments.filter(d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === formCompanyId),
    [departments, formCompanyId]
  );

  const scopedManagers = useMemo(
    () =>
      employees.filter(u => {
        if (editingEmp && u.id === editingEmp.id) return false;
        const r = normalizeRole(u.role, u.email);
        const sameCompany = getUserCompanyId(u) === formCompanyId;
        return isActiveStatus(u.status) && (r === 'SUPER_ADMIN' || (sameCompany && (r === 'COMPANY_ADMIN' || r === 'MANAGER')));
      }),
    [employees, formCompanyId, editingEmp]
  );

  const filteredEmployees = employees.filter(emp => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        emp.displayName.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.position && emp.position.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (deptFilter !== 'All' && emp.department !== deptFilter) return false;
    if (isGroupView && companyFilter !== 'All' && getUserCompanyId(emp) !== companyFilter) {
      return false;
    }
    return true;
  });

  const openAddModal = () => {
    const initialCompany = defaultWriteCompanyId;
    const companyDepts = departments.filter(
      d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === initialCompany
    );
    setEditingEmp(null);
    setFormName('');
    setFormEmail('');
    setFormRole('EMPLOYEE');
    setFormCompanyId(initialCompany);
    setFormDept(companyDepts[0]?.name || departments[0]?.name || 'عام');
    setFormPosition('');
    setFormManagerId('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: User) => {
    setEditingEmp(emp);
    setFormName(emp.displayName);
    setFormEmail(emp.email);
    setFormRole(normalizeRole(emp.role, emp.email));
    setFormCompanyId(getUserCompanyId(emp));
    setFormDept(emp.department || '');
    setFormPosition(emp.position || '');
    setFormManagerId(emp.managerId || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !currentUser) return;

    const targetCompany = getCompanyById(formCompanyId);
    const chosenRole: CanonicalRole = assignableRoles.includes(formRole) ? formRole : 'EMPLOYEE';
    const selectedManager = employees.find(u => u.id === formManagerId);

    setIsSubmitting(true);
    try {
      if (editingEmp) {
        const prevRole = normalizeRole(editingEmp.role, editingEmp.email);
        const prevCompanyId = getUserCompanyId(editingEmp);
        const roleOrCompanyChanged = prevRole !== chosenRole || prevCompanyId !== formCompanyId;

        if (roleOrCompanyChanged) {
          await PrivilegedService.updateUserRoleAndCompany(
            {
              userId: editingEmp.id,
              role: chosenRole,
              companyId: formCompanyId,
              companyName: targetCompany?.name,
              department: formDept,
              position: formPosition.trim(),
              managerId: selectedManager?.id || '',
              managerName: selectedManager?.displayName || '',
            },
            currentUser
          );
          if (editingEmp.displayName !== formName.trim()) {
            await DataService.updateUser(
              editingEmp.id,
              { companyId: formCompanyId, displayName: formName.trim(), fullName: formName.trim() },
              currentUser
            );
          }
        } else {
          await DataService.updateUser(
            editingEmp.id,
            {
              companyId: formCompanyId,
              displayName: formName.trim(),
              fullName: formName.trim(),
              department: formDept,
              position: formPosition.trim(),
              managerId: selectedManager?.id || '',
              managerName: selectedManager?.displayName || '',
            },
            currentUser
          );
        }
        showToast(`تم تحديث بيانات العضو ${formName}`, 'success');
      } else {
        await DataService.createUser(
          {
            companyId: formCompanyId,
            companyName: targetCompany?.name,
            email: formEmail.trim(),
            displayName: formName.trim(),
            fullName: formName.trim(),
            role: chosenRole,
            department: formDept || 'عام',
            position: formPosition.trim(),
            ...(selectedManager
              ? { managerId: selectedManager.id, managerName: selectedManager.displayName }
              : {}),
            status: 'active',
            joinedDate: new Date().toISOString().split('T')[0],
          },
          currentUser
        );
        showToast(`تمت إضافة العضو ${formName} بنجاح إلى ${targetCompany?.name || activeCompany.name}`, 'success');
      }
      setIsModalOpen(false);
      onRefreshEmployees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت العملية';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (emp: User) => {
    const empCompanyId = getUserCompanyId(emp);
    if (!currentUser || !canManageCompanyUsers(currentUser, empCompanyId)) return;
    const currentlyActive = isActiveStatus(emp.status);
    const newStatus = currentlyActive ? 'suspended' : 'active';
    try {
      await DataService.updateUser(emp.id, { companyId: empCompanyId, status: newStatus }, currentUser);
      showToast(`تم تغيير حالة العضو إلى ${newStatus === 'active' ? 'نشط' : 'موقوف'}`, 'info');
      onRefreshEmployees();
    } catch {
      showToast('تعذر تحديث حالة الموظف', 'error');
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            دليل فريق العمل — {activeCompany.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            أعضاء الفريق ومسؤولياتهم، التوزيع حسب الشركات والأقسام، ومعدلات الأداء وإنجاز المهام.
          </p>
        </div>

        {canManageCurrentScope && (
          <Button
            id="btn-add-employee"
            onClick={openAddModal}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إضافة عضو جديد
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <Card className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، البريد، أو المسمى الوظيفي..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isGroupView && (
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 font-medium focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
            >
              <option value="All">كافة شركات المجموعة</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 font-medium focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          >
            <option value="All">كافة الأقسام</option>
            {Array.from(new Set(departments.map(d => d.name))).map(deptName => (
              <option key={deptName} value={deptName}>
                {deptName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Grid of Employees */}
      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="لا يوجد موظفون مطابقون"
          description="لا توجد سجلات موظفين مطابقة لمعايير التصفية الحالية داخل نطاق الشركة المحددة."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => {
            const empTasks = tasks.filter(t =>
              isTaskAssignedToUser({ ...emp, status: 'active' }, t, employees)
            );
            const activeTasks = empTasks.filter(
              t => t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Review'
            ).length;
            const completedTasks = empTasks.filter(t => t.status === 'Completed').length;
            const completionRate =
              empTasks.length > 0 ? Math.round((completedTasks / empTasks.length) * 100) : 0;
            const empActive = isActiveStatus(emp.status);
            const empCompanyId = getUserCompanyId(emp);
            const empCompany = getCompanyById(empCompanyId);
            const canEditEmp = canManageCompanyUsers(currentUser, empCompanyId);
            const empInitials = (emp.displayName || emp.email || 'EM').slice(0, 2).toUpperCase();

            return (
              <Card key={emp.id} hover className="p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {emp.photoURL ? (
                        <img
                          src={emp.photoURL}
                          alt={emp.displayName}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200/80 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-bold text-xs shrink-0">
                          {empInitials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {emp.displayName}
                          </h3>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              empActive ? 'bg-[#22C55E]' : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate">
                          {emp.position || 'عضو بالفريق'}
                        </p>
                      </div>
                    </div>

                    <RoleBadge role={emp.role} />
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                      <span className="font-semibold text-slate-800">
                        {empCompany?.name || emp.companyName || empCompanyId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-mono">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{emp.department || 'عام'}</span>
                    </div>
                    {emp.managerName && (
                      <div className="flex items-center gap-2">
                        <UserCog className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>المدير المباشر: {emp.managerName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Performance Metrics */}
                <div className="pt-3.5 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-3 text-center text-xs gap-2">
                    <div className="p-2 rounded-xl bg-[#F8F9FA]">
                      <p className="font-mono font-bold text-slate-900 tabular-nums">{empTasks.length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">إجمالي المهام</p>
                    </div>
                    <div className="p-2 rounded-xl bg-[#E8F8EE]">
                      <p className="font-mono font-bold text-[#15803D] tabular-nums">{activeTasks}</p>
                      <p className="text-[10px] text-[#16A34A] mt-0.5">نشطة</p>
                    </div>
                    <div className="p-2 rounded-xl bg-cyan-50/75">
                      <p className="font-mono font-bold text-cyan-800 tabular-nums">{completedTasks}</p>
                      <p className="text-[10px] text-cyan-600 mt-0.5">منجزة</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>معدل الإنجاز</span>
                      <span className="font-bold text-[#15803D] tabular-nums">{completionRate}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] rounded-full transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>

                  {canEditEmp && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => openEditModal(emp)}
                        className="px-2.5 py-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-[#F1F3F5] text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        title="تعديل البيانات والصلاحيات"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> تعديل
                      </button>
                      <button
                        onClick={() => toggleStatus(emp)}
                        className={`px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                          empActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-[#16A34A] hover:bg-[#E8F8EE]'
                        }`}
                        title={empActive ? 'تجميد الحساب' : 'تنشيط الحساب'}
                      >
                        {empActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5" /> تجميد
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" /> تنشيط
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? `تعديل بيانات ${editingEmp.displayName}` : 'إضافة عضو جديد'}
        subtitle="تحديد الشركة، الدور الوظيفي، القسم، وبيانات التواصل"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <Input
            label="الاسم الكامل *"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="مثال: سارة العبدالله"
            required
          />

          <Input
            label="البريد الإلكتروني *"
            type="email"
            value={formEmail}
            disabled={!!editingEmp}
            onChange={e => setFormEmail(e.target.value)}
            placeholder="member@company.com"
            required
          />

          <Input
            label="المسمى الوظيفي"
            value={formPosition}
            onChange={e => setFormPosition(e.target.value)}
            placeholder="مثال: مهندس برمجيات أول"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isSuperAdmin ? (
              <Select
                label="الشركة *"
                value={formCompanyId}
                onChange={e => {
                  const nextCid = e.target.value;
                  setFormCompanyId(nextCid);
                  const nextDepts = departments.filter(
                    d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === nextCid
                  );
                  if (nextDepts.length > 0 && !nextDepts.some(d => d.name === formDept)) {
                    setFormDept(nextDepts[0].name);
                  }
                  setFormManagerId('');
                }}
                options={(formRole === 'SUPER_ADMIN' ? companies : subsidiaries).map(c => ({
                  label: c.name,
                  value: c.id,
                }))}
              />
            ) : (
              <Input label="الشركة" value={activeCompany.name} disabled />
            )}

            <Select
              label="الدور والصلاحية *"
              value={formRole}
              onChange={e => setFormRole(e.target.value as CanonicalRole)}
              options={
                assignableRoles.length > 0
                  ? assignableRoles.map(r => ({
                      label: getRoleArabicLabel(r),
                      value: r,
                    }))
                  : [{ label: getRoleArabicLabel('EMPLOYEE'), value: 'EMPLOYEE' }]
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="القسم *"
              value={formDept}
              onChange={e => setFormDept(e.target.value)}
              options={
                scopedFormDepartments.length > 0
                  ? scopedFormDepartments.map(d => ({ label: d.name, value: d.name }))
                  : departments.length > 0
                  ? Array.from(new Set(departments.map(d => d.name))).map(n => ({
                      label: n,
                      value: n,
                    }))
                  : [{ label: 'عام', value: 'عام' }]
              }
            />

            <Select
              label="المدير المباشر (اختياري)"
              value={formManagerId}
              onChange={e => setFormManagerId(e.target.value)}
              options={[
                { label: '-- بدون مدير مباشر --', value: '' },
                ...scopedManagers.map(m => ({
                  label: `${m.displayName} (${getRoleArabicLabel(m.role)})`,
                  value: m.id,
                })),
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
              onClick={() => setIsModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingEmp ? 'حفظ التعديلات' : 'إضافة العضو'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
