import React, { useState } from 'react';
import { Package, Plus, Search, Wrench, CheckCircle2, User as UserIcon } from 'lucide-react';
import { Card, EmptyState } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea } from '../ui/Input';
import { Equipment, EquipmentStatus, EquipmentType, Project, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import { canManageProjects } from '../../utils/rbac';

interface EquipmentViewProps {
  equipment: Equipment[];
  employees: User[];
  projects: Project[];
  onRefresh: () => void;
}

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'متاح',
  assigned: 'مسند لموظف',
  in_maintenance: 'قيد الصيانة',
  damaged: 'تالف',
  lost: 'مفقود',
  inactive: 'غير نشط',
};

const TYPE_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: 'laptop', label: 'حاسب محمول' },
  { value: 'camera', label: 'كاميرا وتصوير' },
  { value: 'screen', label: 'شاشة عرض' },
  { value: 'drone', label: 'طائرة درون' },
  { value: 'audio', label: 'معدات صوتية' },
  { value: 'lighting', label: 'معدات إضاءة' },
  { value: 'accessory', label: 'ملحقات وأدوات' },
  { value: 'other', label: 'أخرى' },
];

export function EquipmentView({ equipment, employees, projects, onRefresh }: EquipmentViewProps) {
  const { currentUser } = useAuth();
  const { activeCompany, defaultWriteCompanyId, isGroupView, subsidiaries } = useCompany();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EquipmentStatus>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentType>('laptop');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState<EquipmentStatus>('available');
  const [assignedTo, setAssignedTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState(defaultWriteCompanyId);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = canManageProjects(currentUser, defaultWriteCompanyId);

  const filtered = equipment.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.serialNumber.toLowerCase().includes(q) ||
        (item.assignedToName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim() || !serialNumber.trim()) return;

    const cid = isGroupView ? targetCompanyId : defaultWriteCompanyId;
    const assignedEmp = employees.find(u => u.id === assignedTo && u.companyId === cid);
    const linkedProj = projects.find(p => p.id === projectId && p.companyId === cid);

    setIsSubmitting(true);
    try {
      await DataService.createEquipment(
        {
          companyId: cid,
          name: name.trim(),
          type,
          serialNumber: serialNumber.trim(),
          status: assignedEmp ? 'assigned' : status,
          ...(assignedEmp
            ? {
                assignedTo: assignedEmp.id,
                assignedToName: assignedEmp.displayName,
                assignedToEmail: assignedEmp.email,
              }
            : {}),
          ...(linkedProj
            ? {
                projectId: linkedProj.id,
                projectName: linkedProj.name,
              }
            : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        currentUser
      );
      showToast(`تم تسجيل الأصل "${name.trim()}" في سجل المعدات بنجاح`, 'success');
      setIsAddOpen(false);
      setName('');
      setSerialNumber('');
      setAssignedTo('');
      setProjectId('');
      setNotes('');
      onRefresh();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل المعدة', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scopedEmployees = employees.filter(
    u => u.companyId === (isGroupView ? targetCompanyId : defaultWriteCompanyId)
  );
  const scopedProjects = projects.filter(
    p => p.companyId === (isGroupView ? targetCompanyId : defaultWriteCompanyId)
  );

  return (
    <div id="equipment-view" className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            سجل المعدات والأصول — {activeCompany.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة الأصول والمعدات المسجلة، عهدة الموظفين، وحالة الصيانة لكل شركة بشكل مستقل.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setTargetCompanyId(defaultWriteCompanyId);
              setIsAddOpen(true);
            }}
          >
            تسجيل معدة جديدة
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الرقم التسلسلي، أو الموظف..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | EquipmentStatus)}
          className="w-full sm:w-auto px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 font-medium focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
        >
          <option value="all">جميع الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="لا توجد معدات مسجلة في هذه الشركة"
          description="أضف المعدات والأصول لتتبع العهدة والصيانة وربطها بالمشاريع والموظفين."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <Card key={item.id} hover className="p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                    SN: {item.serialNumber}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    item.status === 'available'
                      ? 'text-[#16A34A]'
                      : item.status === 'in_maintenance'
                      ? 'text-amber-600'
                      : 'text-slate-600'
                  }`}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>العهدة: {item.assignedToName || 'غير مسندة'}</span>
                </div>
                {item.projectName && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                    <span>المشروع: {item.projectName}</span>
                  </div>
                )}
                {item.notes && (
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.notes}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="تسجيل معدة أو أصل جديد"
        subtitle="ربط المعدة بالشركة التابعة وتحديد حالة العهدة"
        maxWidth="md"
      >
        <form onSubmit={handleAddEquipment} className="space-y-4" dir="rtl">
          {isGroupView && (
            <Select
              label="الشركة المالكة للأصل *"
              value={targetCompanyId}
              onChange={e => {
                setTargetCompanyId(e.target.value);
                setAssignedTo('');
                setProjectId('');
              }}
              options={subsidiaries.map(c => ({ value: c.id, label: c.name }))}
            />
          )}

          <Input
            label="اسم المعدة *"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: كاميرا Sony FX3 / جهاز MacBook Pro"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="التصنيف"
              value={type}
              onChange={e => setType(e.target.value as EquipmentType)}
              options={TYPE_OPTIONS}
            />
            <Input
              label="الرقم التسلسلي *"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="SN-2026-001"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="إسناد لموظف (اختياري)"
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              options={[
                { value: '', label: '-- غير مسندة --' },
                ...scopedEmployees.map(e => ({ value: e.id, label: e.displayName })),
              ]}
            />
            <Select
              label="ربط بمشروع (اختياري)"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              options={[
                { value: '', label: '-- بدون مشروع --' },
                ...scopedProjects.map(p => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <Select
            label="الحالة"
            value={status}
            onChange={e => setStatus(e.target.value as EquipmentStatus)}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <Textarea
            label="ملاحظات إضافية"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
              onClick={() => setIsAddOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              حفظ الأصل
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
