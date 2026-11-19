import React, { useState } from 'react';
import { Building2, Plus, Users, CheckCircle2, TrendingUp, Edit2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Select } from '../ui/Input';
import { Department, Task, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import { canManageDepartments as checkCanManageDepartments } from '../../utils/rbac';

interface DepartmentsViewProps {
  departments: Department[];
  tasks: Task[];
  employees: User[];
  onRefreshDepartments: () => void;
  onNavigateToTasksWithDept?: (deptName: string) => void;
}

export function DepartmentsView({
  departments,
  tasks,
  employees,
  onRefreshDepartments,
}: DepartmentsViewProps) {
  const { currentUser } = useAuth();
  const { activeCompany, isGroupView, subsidiaries, defaultWriteCompanyId, getCompanyById } = useCompany();
  const { showToast } = useToast();

  const canManageDepts = checkCanManageDepartments(currentUser, defaultWriteCompanyId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [companyId, setCompanyId] = useState(defaultWriteCompanyId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headName, setHeadName] = useState('');
  const [color, setColor] = useState('#059669');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingDept(null);
    setCompanyId(defaultWriteCompanyId);
    setName('');
    setDescription('');
    setHeadName(employees[0]?.displayName || currentUser?.displayName || '');
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

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            الأقسام والوحدات التشغيلية — {activeCompany.name}
          </h2>
          <p className="text-xs text-neutral-500">
            توزيع الإدارات، قيادات الفرق، حجم الضغط التشغيلي، ومعدلات إنجاز الأعمال.
          </p>
        </div>

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

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map(dept => {
          const deptTasks = tasks.filter(t => t.department === dept.name);
          const deptEmps = employees.filter(e => e.department === dept.name);
          const completedTasks = deptTasks.filter(t => t.status === 'Completed').length;
          const rate = deptTasks.length > 0 ? Math.round((completedTasks / deptTasks.length) * 100) : 0;

          return (
            <Card key={dept.id} hover className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-2xs"
                      style={{ backgroundColor: dept.color || '#059669' }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">{dept.name}</h3>
                      <p className="text-xs text-neutral-500">
                        المسؤول: {dept.headName || 'قائد القسم'}
                        {isGroupView && dept.companyId
                          ? ` • ${getCompanyById(dept.companyId)?.name || dept.companyId}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {canManageDepts && (
                    <button
                      onClick={() => openEditModal(dept)}
                      className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="تعديل بيانات القسم"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-neutral-600 mt-3 line-clamp-2 leading-relaxed">
                  {dept.description}
                </p>
              </div>

              {/* Department Statistics */}
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <div className="grid grid-cols-3 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-neutral-50">
                    <p className="font-mono font-bold text-neutral-900">{deptEmps.length}</p>
                    <p className="text-[10px] text-neutral-400">الأعضاء</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-neutral-50">
                    <p className="font-mono font-bold text-neutral-900">{deptTasks.length}</p>
                    <p className="text-[10px] text-neutral-400">المهام</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-teal-50">
                    <p className="font-mono font-bold text-teal-800">{completedTasks}</p>
                    <p className="text-[10px] text-teal-600">المنجزة</p>
                  </div>
                </div>

                {/* Completion rate bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-500">نسبة الإنجاز</span>
                    <span className="font-bold text-emerald-700">{rate}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
              onChange={e => setCompanyId(e.target.value)}
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
            options={employees.map(emp => ({
              label: `${emp.displayName} (${emp.position || emp.role})`,
              value: emp.displayName,
            }))}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              لون الهوية والتمييز
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-xl border border-neutral-200 cursor-pointer p-0.5"
              />
              <span className="text-xs font-mono text-neutral-600">{color}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
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
