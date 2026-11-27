import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Users,
  CheckCircle2,
  Edit2,
  Clock,
  ArrowUpLeft,
  ChevronLeft,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Select } from '../ui/Input';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Department, Task, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import {
  canCreateTask,
  canManageDepartments as checkCanManageDepartments,
  getUserCompanyId,
  scopeDepartmentsForUser,
  scopeEmployeesForUser,
  scopeTasksForUser,
} from '../../utils/rbac';
import { formatLocalDate } from '../../utils/sanitize';

interface DepartmentsViewProps {
  departments: Department[];
  tasks: Task[];
  employees: User[];
  onRefreshDepartments: () => void;
  onOpenCreateTask?: () => void;
  onSelectTask?: (taskId: string) => void;
  onNavigateToTab?: (tab: 'tasks' | 'employees' | 'reports') => void;
}

export function DepartmentsView({
  departments,
  tasks,
  employees,
  onRefreshDepartments,
  onOpenCreateTask,
  onSelectTask,
  onNavigateToTab,
}: DepartmentsViewProps) {
  const { currentUser, isManager } = useAuth();
  const { activeCompany, isGroupView, subsidiaries, defaultWriteCompanyId, getCompanyById } = useCompany();
  const { showToast } = useToast();

  const canManageDepts = checkCanManageDepartments(currentUser, defaultWriteCompanyId);
  const allowCreateTask = canCreateTask(currentUser, defaultWriteCompanyId);

  const visibleDepartments = isManager
    ? scopeDepartmentsForUser(currentUser, departments)
    : departments;
  const visibleEmployees = isManager ? scopeEmployeesForUser(currentUser, employees) : employees;
  const visibleTasks = isManager ? scopeTasksForUser(currentUser, tasks, employees) : tasks;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [companyId, setCompanyId] = useState(defaultWriteCompanyId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headName, setHeadName] = useState('');
  const [color, setColor] = useState('#059669');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scopedModalEmployees = employees.filter(emp => getUserCompanyId(emp) === companyId);

  const openAddModal = () => {
    setEditingDept(null);
    setCompanyId(defaultWriteCompanyId);
    setName('');
    setDescription('');
    const initialScoped = employees.filter(emp => getUserCompanyId(emp) === defaultWriteCompanyId);
    setHeadName(initialScoped[0]?.displayName || '');
    setColor('#059669');
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setCompanyId(dept.companyId || defaultWriteCompanyId);
    setName(dept.name);
    setDescription(dept.description);
    setHeadName(dept.headName || '');
    setColor(dept.color || '#059669');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      if (editingDept) {
        await DataService.updateDepartment(
          editingDept.id,
          {
            name: name.trim(),
            description: description.trim(),
            headName: headName.trim(),
            color,
          },
          currentUser
        );
        showToast(`تم تحديث بيانات قسم ${name}`, 'success');
      } else {
        await DataService.createDepartment(
          {
            companyId,
            name: name.trim(),
            description: description.trim(),
            headName: headName.trim(),
            color,
          },
          currentUser
        );
        showToast(`تم إنشاء قسم ${name} بنجاح`, 'success');
      }
      setIsModalOpen(false);
      onRefreshDepartments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت العملية';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nowStr = formatLocalDate();

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isManager
              ? `إدارة القسم — ${currentUser?.department || activeCompany.name}`
              : `الأقسام والوحدات التشغيلية — ${activeCompany.name}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isManager
              ? `مركز متابعة فريق القسم والمهام التنفيذية ومعدلات الإنجاز داخل ${activeCompany.name}.`
              : 'توزيع الإدارات، قيادات الفرق، حجم الضغط التشغيلي، ومعدلات إنجاز الأعمال.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManager && allowCreateTask && onOpenCreateTask && (
            <Button
              id="btn-manager-create-dept-task"
              onClick={onOpenCreateTask}
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إنشاء مهمة للقسم
            </Button>
          )}
          {canManageDepts && (
            <Button
              id="btn-add-department"
              onClick={openAddModal}
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إنشاء قسم جديد
            </Button>
          )}
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleDepartments.map(dept => {
          const deptTasks = visibleTasks.filter(t => t.department === dept.name);
          const deptEmps = visibleEmployees.filter(e => e.department === dept.name);
          const completedTasks = deptTasks.filter(t => t.status === 'Completed').length;
          const rate = deptTasks.length > 0 ? Math.round((completedTasks / deptTasks.length) * 100) : 0;

          return (
            <Card key={dept.id} hover className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 ${
                        dept.color?.startsWith('bg-') ? dept.color : ''
                      }`}
                      style={
                        dept.color?.startsWith('bg-')
                          ? undefined
                          : { backgroundColor: dept.color || '#22C55E' }
                      }
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{dept.name}</h3>
                      <p className="text-xs text-slate-500">
                        المسؤول: {dept.headName || 'قائد القسم'}
                        {isGroupView && dept.companyId
                          ? ` • ${getCompanyById(dept.companyId)?.name || dept.companyId}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {canManageDepts && (
                    <button
                      type="button"
                      onClick={() => openEditModal(dept)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                      title="تعديل بيانات القسم"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {dept.description}
                </p>
              </div>

              {/* Department Statistics */}
              <div className="pt-3.5 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 text-center text-xs gap-2">
                  <div className="p-2 rounded-xl bg-[#F8F9FA]">
                    <p className="font-mono font-bold text-slate-900 tabular-nums">{deptEmps.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">الأعضاء</p>
                  </div>
                  <div className="p-2 rounded-xl bg-[#F8F9FA]">
                    <p className="font-mono font-bold text-slate-900 tabular-nums">{deptTasks.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">المهام</p>
                  </div>
                  <div className="p-2 rounded-xl bg-cyan-50/75">
                    <p className="font-mono font-bold text-cyan-800 tabular-nums">{completedTasks}</p>
                    <p className="text-[10px] text-cyan-600 mt-0.5">المنجزة</p>
                  </div>
                </div>

                {/* Completion rate bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">نسبة الإنجاز</span>
                    <span className="font-bold text-[#15803D] tabular-nums">{rate}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22C55E] rounded-full transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Manager Operational Workspace: Department Team & Recent Tasks */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Department Tasks (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">مهام القسم الحالية</h3>
                <p className="text-xs text-slate-500">
                  التكليفات النشطة وبانتظار الاعتماد ضمن نطاق إشرافك
                </p>
              </div>
              {onNavigateToTab && (
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  onClick={() => onNavigateToTab('tasks')}
                >
                  عرض كل المهام
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              {visibleTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  لا توجد مهام مسجلة حالياً ضمن هذا القسم.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-[#F8F9FA] border-b border-slate-100 text-xs text-slate-500 font-semibold">
                      <tr>
                        <th className="px-4 py-3">المهمة</th>
                        <th className="px-4 py-3">المكلف</th>
                        <th className="px-4 py-3">الأولوية</th>
                        <th className="px-4 py-3">الحالة</th>
                        <th className="px-4 py-3">الموعد</th>
                        <th className="px-4 py-3 text-left">فتح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleTasks.slice(0, 6).map(task => {
                        const isOverdue =
                          task.deadline < nowStr &&
                          task.status !== 'Completed' &&
                          task.status !== 'Cancelled';
                        return (
                          <tr
                            key={task.id}
                            className="hover:bg-[#F8F9FA]/80 transition-colors cursor-pointer group"
                            onClick={() => onSelectTask?.(task.id)}
                          >
                            <td className="px-4 py-3 max-w-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#15803D] bg-[#E8F8EE] px-2 py-0.5 rounded-lg">
                                  {task.taskId}
                                </span>
                                <span className="font-medium text-slate-900 truncate">
                                  {task.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-700 font-medium">
                              {task.assignedToName}
                            </td>
                            <td className="px-4 py-3">
                              <PriorityBadge priority={task.priority} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={task.status} isOverdue={isOverdue} />
                            </td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-600 tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {task.deadline}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-left">
                              <ArrowUpLeft className="w-4 h-4 text-slate-400 group-hover:text-[#15803D] inline" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Department Team Members (1 col) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">فريق القسم</h3>
                <p className="text-xs text-slate-500">الأعضاء والمرؤوسون المباشرون</p>
              </div>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab('employees')}
                  className="text-xs font-semibold text-[#15803D] hover:text-[#166534] cursor-pointer"
                >
                  كامل الفريق
                </button>
              )}
            </div>

            <Card className="p-4 space-y-2.5 max-h-[360px] overflow-y-auto">
              {visibleEmployees.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  لا يوجد أعضاء مسجلون في هذا القسم حالياً
                </div>
              ) : (
                visibleEmployees.map(member => {
                  const memberTasks = visibleTasks.filter(t => t.assignedTo === member.id);
                  const memberDone = memberTasks.filter(t => t.status === 'Completed').length;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F8F9FA]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center text-xs font-bold shrink-0">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {member.position || member.department || 'عضو فريق'}
                          </p>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#15803D] tabular-nums">
                          <CheckCircle2 className="w-3 h-3" />
                          {memberDone}/{memberTasks.length}
                        </span>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> مهام
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Add / Edit Department Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? `تعديل قسم ${editingDept.name}` : 'إنشاء قسم جديد'}
        subtitle="تحديد نطاق عمل القسم ورئيس الفريق المشرف"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          {isGroupView && !editingDept && (
            <Select
              label="الشركة التابعة *"
              value={companyId}
              onChange={e => {
                const nextCompany = e.target.value;
                setCompanyId(nextCompany);
                const nextEmps = employees.filter(emp => getUserCompanyId(emp) === nextCompany);
                setHeadName(nextEmps[0]?.displayName || '');
              }}
              options={subsidiaries.map(c => ({ label: c.name, value: c.id }))}
            />
          )}

          <Input
            label="اسم القسم *"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: هندسة البرمجيات"
            required
          />

          <Textarea
            label="المهام ونطاق العمل"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="أدخل أهداف القسم ومسؤولياته الرئيسية..."
            rows={3}
          />

          <Select
            label="رئيس / قائد القسم"
            value={headName}
            onChange={e => setHeadName(e.target.value)}
            options={[
              { label: '-- بدون تحديد --', value: '' },
              ...(headName && !scopedModalEmployees.some(emp => emp.displayName === headName)
                ? [{ label: headName, value: headName }]
                : []),
              ...scopedModalEmployees.map(emp => ({
                label: `${emp.displayName} (${emp.position || emp.role})`,
                value: emp.displayName,
              })),
            ]}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              لون الهوية والتمييز
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-2xl border border-slate-200 cursor-pointer p-0.5 bg-[#F1F3F5]"
              />
              <span className="text-xs font-mono text-slate-600">{color}</span>
            </div>
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
              {editingDept ? 'حفظ التعديلات' : 'إنشاء القسم'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
