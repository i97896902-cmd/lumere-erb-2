import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Card, EmptyState } from '../ui/Card';
import { Button } from '../ui/Button';
import { RoleBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Input';
import { User, Task, Department, Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';

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
  onSelectTask,
  onRefreshEmployees,
}: EmployeesViewProps) {
  const { role, currentUser } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selectedEmp, setSelectedEmp] = useState<User | null>(null);

  // Add/Edit Employee Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<Role>('EMPLOYEE');
  const [formDept, setFormDept] = useState(departments[0]?.name || 'Development');
  const [formPosition, setFormPosition] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    return true;
  });

  const openAddModal = () => {
    setEditingEmp(null);
    setFormName('');
    setFormEmail('');
    setFormRole('EMPLOYEE');
    setFormDept(departments[0]?.name || 'Development');
    setFormPosition('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: User) => {
    setEditingEmp(emp);
    setFormName(emp.displayName);
    setFormEmail(emp.email);
    setFormRole(emp.role);
    setFormDept(emp.department);
    setFormPosition(emp.position || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      if (editingEmp) {
        // Update employee
        await DataService.updateUser(
          editingEmp.id,
          {
            displayName: formName.trim(),
            role: formRole,
            department: formDept,
            position: formPosition.trim(),
          },
          currentUser
        );
        showToast(`تم تحديث بيانات العضو ${formName}`, 'success');
      } else {
        // Create new user profile in Firestore
        await DataService.createUser(
          {
            email: formEmail.trim(),
            displayName: formName.trim(),
            role: formRole,
            department: formDept,
            position: formPosition.trim(),
            status: 'Active',
            joinedDate: new Date().toISOString().split('T')[0],
            photoURL: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256`,
          },
          currentUser
        );
        showToast(`تمت إضافة العضو ${formName} بنجاح إلى Luméré`, 'success');
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
    if (!currentUser || role !== 'ADMIN') return;
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await DataService.updateUser(emp.id, { status: newStatus }, currentUser);
      showToast(`تم تغيير حالة العضو إلى ${newStatus === 'Active' ? 'نشط' : 'معطل'}`, 'info');
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
          <h2 className="text-xl font-bold text-neutral-900">دليل فريق عمل Luméré</h2>
          <p className="text-xs text-neutral-500">
            أعضاء الفريق ومسؤولياتهم، توزيع الأقسام، ومعدلات الأداء وإنجاز المهام.
          </p>
        </div>

        {role === 'ADMIN' && (
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
      <Card className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، البريد، أو المسمى الوظيفي..."
            className="w-full pr-9 pl-3.5 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="All">كافة الأقسام</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Grid of Employees */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(emp => {
          const empTasks = tasks.filter(t => t.assignedTo === emp.id);
          const activeTasks = empTasks.filter(
            t => t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Review'
          ).length;
          const completedTasks = empTasks.filter(t => t.status === 'Completed').length;
          const completionRate =
            empTasks.length > 0 ? Math.round((completedTasks / empTasks.length) * 100) : 0;

          return (
            <Card key={emp.id} hover className="p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.photoURL}
                      alt={emp.displayName}
                      className="w-11 h-11 rounded-full object-cover border border-neutral-200 shadow-2xs"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-neutral-900">{emp.displayName}</h3>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            emp.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-300'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-neutral-500 font-medium">
                        {emp.position || 'عضو بالفريق'}
                      </p>
                    </div>
                  </div>

                  <RoleBadge role={emp.role} />
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{emp.department}</span>
                  </div>
                </div>
              </div>

              {/* Task Performance Metrics */}
              <div className="pt-3 border-t border-neutral-100 space-y-2">
                <div className="grid grid-cols-3 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-neutral-50">
                    <p className="font-mono font-bold text-neutral-900">{empTasks.length}</p>
                    <p className="text-[10px] text-neutral-400">إجمالي المهام</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-emerald-50">
                    <p className="font-mono font-bold text-emerald-800">{activeTasks}</p>
                    <p className="text-[10px] text-emerald-600">نشطة</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-teal-50">
                    <p className="font-mono font-bold text-teal-800">{completedTasks}</p>
                    <p className="text-[10px] text-teal-600">منجزة</p>
                  </div>
                </div>

                {/* Performance Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-neutral-500">
                    <span>معدل الإنجاز</span>
                    <span className="font-bold text-emerald-700">{completionRate}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Admin Actions */}
                {role === 'ADMIN' && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(emp)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      title="تعديل البيانات"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> تعديل
                    </button>
                    <button
                      onClick={() => toggleStatus(emp)}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                        emp.status === 'Active'
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={emp.status === 'Active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    >
                      {emp.status === 'Active' ? (
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

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? `تعديل بيانات ${editingEmp.displayName}` : 'إضافة عضو جديد إلى Luméré'}
        subtitle="تحديد الصلاحيات والأقسام وبيانات التواصل"
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
            placeholder="sara@lumere.internal"
            required
          />

          <Input
            label="المسمى الوظيفي"
            value={formPosition}
            onChange={e => setFormPosition(e.target.value)}
            placeholder="مثال: مهندس برمجيات أول"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="الدور والصلاحية *"
              value={formRole}
              onChange={e => setFormRole(e.target.value as Role)}
              options={[
                { label: 'موظف (Employee)', value: 'EMPLOYEE' },
                { label: 'مدير عام (Admin)', value: 'ADMIN' },
              ]}
            />

            <Select
              label="القسم *"
              value={formDept}
              onChange={e => setFormDept(e.target.value)}
              options={departments.map(d => ({ label: d.name, value: d.name }))}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
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
