import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Power,
  Shield,
  Upload,
  ArrowLeft,
  Eye,
  Users,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Client, Company, Department, Project, Task, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/data/dataService';
import { PrivilegedService } from '../../services/firebase/privilegedService';
import { computeGroupOverviewStats } from '../../utils/groupAnalytics';
import { createCompanySlug, getCompanyInitials, PARENT_COMPANY_ID } from '../../config/companies';

interface CompaniesManagementViewProps {
  companies: Company[];
  employees: User[];
  departments: Department[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  onEnterCompany: (companyId: string) => void;
  onRefreshAll: () => void;
}

export function CompaniesManagementView({
  companies,
  employees,
  departments,
  clients,
  projects,
  tasks,
  onEnterCompany,
  onRefreshAll,
}: CompaniesManagementViewProps) {
  const { currentUser, isSuperAdmin } = useAuth();
  const { refreshCompanies } = useCompany();
  const { showToast } = useToast();

  // Add / Edit Company Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [slug, setSlug] = useState('');
  const [businessSector, setBusinessSector] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [seedSuggestedDepts, setSeedSuggestedDepts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Assign Admin Modal
  const [adminTargetCompany, setAdminTargetCompany] = useState<Company | null>(null);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('');
  const [isAssigningAdmin, setIsAssigningAdmin] = useState(false);

  // Details Modal
  const [detailsCompany, setDetailsCompany] = useState<Company | null>(null);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'employees' | 'projects' | 'tasks'>(
    'overview'
  );

  const metricsMap = useMemo(() => {
    const overview = computeGroupOverviewStats({
      companies,
      users: employees,
      departments,
      clients,
      projects,
      tasks,
    });
    const map = new Map(overview.byCompany.map(m => [m.companyId, m]));
    return map;
  }, [companies, employees, departments, clients, projects, tasks]);

  if (!isSuperAdmin) {
    return (
      <div dir="rtl">
        <Card className="p-8 text-center">
          <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">صلاحية محصورة بإدارة المجموعة</h3>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الشركات التابعة متاحة حصراً لحساب مدير المجموعة الأعلى (SUPER_ADMIN).
          </p>
        </Card>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingCompany(null);
    setName('');
    setArabicName('');
    setSlug('');
    setBusinessSector('');
    setDescription('');
    setLogoUrl('');
    setLogoFile(null);
    setSeedSuggestedDepts(true);
    setIsFormOpen(true);
  };

  const openEditModal = (company: Company) => {
    setEditingCompany(company);
    setName(company.name);
    setArabicName(company.arabicName || '');
    setSlug(company.slug);
    setBusinessSector(company.businessSector || '');
    setDescription(company.description || '');
    setLogoUrl(company.logo || '');
    setLogoFile(null);
    setIsFormOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim()) return;

    setIsSaving(true);
    try {
      const targetSlug = editingCompany ? editingCompany.slug : slug.trim() || createCompanySlug(name);
      let finalLogo = logoUrl;
      if (logoFile) {
        finalLogo = await DataService.uploadCompanyLogo(targetSlug, logoFile);
      }

      if (editingCompany) {
        await DataService.updateCompany(
          editingCompany.id,
          {
            name: name.trim(),
            arabicName: arabicName.trim(),
            businessSector: businessSector.trim(),
            description: description.trim(),
            logo: finalLogo,
          },
          currentUser
        );
        showToast(`تم تحديث بيانات شركة ${name.trim()} بنجاح`, 'success');
      } else {
        await PrivilegedService.createCompany(
          {
            name: name.trim(),
            arabicName: arabicName.trim() || name.trim(),
            slug: targetSlug,
            businessSector: businessSector.trim(),
            description: description.trim(),
            logo: finalLogo,
            seedSuggestedDepartments: seedSuggestedDepts,
          },
          currentUser
        );
        showToast(`تم إنشاء الشركة التابعة ${name.trim()} بنجاح`, 'success');
      }

      await refreshCompanies();
      onRefreshAll();
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ بيانات الشركة';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCompanyStatus = async (company: Company) => {
    if (!currentUser || company.id === PARENT_COMPANY_ID) return;
    const nextStatus = company.status === 'active' ? 'inactive' : 'active';
    try {
      await PrivilegedService.setCompanyStatus(company.id, nextStatus, currentUser);
      showToast(
        `تم ${nextStatus === 'active' ? 'تفعيل' : 'تعطيل'} شركة ${company.name} بنجاح`,
        'info'
      );
      await refreshCompanies();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر تغيير حالة الشركة', 'error');
    }
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !adminTargetCompany || !selectedAdminUserId) return;

    setIsAssigningAdmin(true);
    try {
      const res = await PrivilegedService.assignCompanyAdmin(
        {
          userId: selectedAdminUserId,
          companyId: adminTargetCompany.id,
          companyName: adminTargetCompany.name,
        },
        currentUser
      );
      showToast(
        res.claimsSynced
          ? `تم تعيين مدير شركة لـ ${adminTargetCompany.name} ومزامنة صلاحيات Firebase Claims بنجاح`
          : `تم تعيين مدير شركة لـ ${adminTargetCompany.name} في Firestore بنجاح`,
        'success'
      );
      setAdminTargetCompany(null);
      setSelectedAdminUserId('');
      await refreshCompanies();
      onRefreshAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'تعذر تعيين مدير الشركة', 'error');
    } finally {
      setIsAssigningAdmin(false);
    }
  };

  const detailsEmployees = detailsCompany
    ? employees.filter(e => e.companyId === detailsCompany.id)
    : [];
  const detailsProjects = detailsCompany
    ? projects.filter(p => p.companyId === detailsCompany.id)
    : [];
  const detailsTasks = detailsCompany
    ? tasks.filter(t => t.companyId === detailsCompany.id)
    : [];

  return (
    <div id="companies-management-view" className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">إدارة شركات LUMERE GROUP</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إضافة شركات تابعة جديدة، تحديث الهوية والشعارات، تعيين مدراء الشركات، والتحكم بحالة التفعيل.
          </p>
        </div>

        <Button
          id="btn-add-company"
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
        >
          إضافة شركة تابعة
        </Button>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(company => {
          const isParent = company.type === 'parent';
          const metrics = metricsMap.get(company.id);
          const accent = company.theme?.primary || '#22C55E';
          const companyAdmins = employees.filter(
            e =>
              e.companyId === company.id &&
              (e.role === 'COMPANY_ADMIN' || company.adminIds?.includes(e.id))
          );

          return (
            <Card key={company.id} hover className="p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {company.logo ? (
                      <img
                        src={company.logo}
                        alt={company.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200/80 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: accent }}
                      >
                        {getCompanyInitials(company.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {company.name}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-500">
                          · {isParent ? 'الشركة الأم' : 'شركة تابعة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {company.arabicName || company.businessSector}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      company.status === 'active' ? 'text-[#16A34A]' : 'text-rose-600'
                    }`}
                  >
                    {company.status === 'active' ? 'نشطة' : 'معطّلة'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {company.description || 'لا يوجد وصف مسجل بعد.'}
                </p>

                {/* Real Metrics Row */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
                      {isParent ? employees.length : metrics?.employeesCount ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500">الموظفون</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
                      {isParent ? projects.length : metrics?.projectsCount ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500">المشاريع</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
                      {isParent ? tasks.length : metrics?.totalTasksCount ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500">المهام</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums text-sm font-bold text-[#16A34A]">
                      {isParent
                        ? tasks.length > 0
                          ? Math.round(
                              (tasks.filter(t => t.status === 'Completed').length / tasks.length) *
                                100
                            )
                          : 0
                        : metrics?.completionRate ?? 0}
                      %
                    </p>
                    <p className="text-[10px] text-slate-500">الإنجاز</p>
                  </div>
                </div>

                {!isParent && (
                  <div className="mt-3 text-[11px] text-slate-500">
                    مدراء الشركة:{' '}
                    <span className="font-semibold text-slate-800">
                      {companyAdmins.length > 0
                        ? companyAdmins.map(a => a.displayName).join('، ')
                        : 'لم يُعيَّن مدير شركة بعد'}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(company)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:bg-[#F1F3F5] hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    تعديل
                  </button>

                  {!isParent && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailsCompany(company);
                          setDetailsTab('overview');
                        }}
                        className="px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:bg-[#F1F3F5] hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        التفاصيل
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAdminTargetCompany(company);
                          setSelectedAdminUserId(employees[0]?.id || '');
                        }}
                        className="px-2.5 py-1.5 rounded-full text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        تعيين مدير
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleCompanyStatus(company)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                          company.status === 'active'
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-[#16A34A] hover:bg-[#E8F8EE]'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {company.status === 'active' ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onEnterCompany(company.id)}
                  className="px-4 py-2 rounded-full bg-[#18181B] hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{isParent ? 'لوحة المجموعة' : 'الدخول للشركة'}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Company Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCompany ? `تعديل بيانات ${editingCompany.name}` : 'إضافة شركة تابعة جديدة'}
        subtitle="تسجيل وتحديث الهوية المؤسسية للشركات التابعة لمجموعة LUMERE GROUP"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCompany} className="space-y-4" dir="rtl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="اسم الشركة (إنجليزي / رسمي) *"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (!editingCompany) setSlug(createCompanySlug(e.target.value));
              }}
              placeholder="مثال: LUMERE STUDIO"
              required
            />
            <Input
              label="الاسم بالعربية"
              value={arabicName}
              onChange={e => setArabicName(e.target.value)}
              placeholder="مثال: لومير للإنتاج الفني"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المعرّف المختصر (Slug) *"
              value={slug}
              disabled={Boolean(editingCompany)}
              onChange={e => setSlug(createCompanySlug(e.target.value))}
              placeholder="lumere-studio"
              required
            />
            <Input
              label="النشاط / القطاع"
              value={businessSector}
              onChange={e => setBusinessSector(e.target.value)}
              placeholder="مثال: التطوير التقني / الخدمات اللوجستية"
            />
          </div>

          <Textarea
            label="وصف الشركة ونطاق أعمالها"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="نبذة مختصرة عن خدمات الشركة ومسؤولياتها ضمن المجموعة..."
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              شعار الشركة (Firebase Storage)
            </label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F1F3F5] hover:bg-slate-200/70 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[#16A34A]" />
                <span>{logoFile ? logoFile.name : 'اختيار صورة الشعار'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setLogoFile(e.target.files?.[0] || null)}
                />
              </label>
              {logoUrl && !logoFile && (
                <img
                  src={logoUrl}
                  alt="شعار الشركة"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                />
              )}
            </div>
          </div>

          {!editingCompany && (
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={seedSuggestedDepts}
                onChange={e => setSeedSuggestedDepts(e.target.checked)}
                className="rounded accent-[#22C55E] text-[#22C55E] focus:ring-[#22C55E]"
              />
              <span>إنشاء قسم افتراضي أساسي تلقائياً داخل الشركة الجديدة</span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
              onClick={() => setIsFormOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingCompany ? 'حفظ التعديلات' : 'إنشاء الشركة'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Company Admin Modal */}
      <Modal
        isOpen={Boolean(adminTargetCompany)}
        onClose={() => setAdminTargetCompany(null)}
        title={`تعيين مدير شركة — ${adminTargetCompany?.name || ''}`}
        subtitle="منح صلاحية COMPANY_ADMIN لإدارة الموظفين والمشاريع والمهام داخل هذه الشركة فقط"
        maxWidth="md"
      >
        <form onSubmit={handleAssignAdmin} className="space-y-4" dir="rtl">
          <Select
            label="اختر الموظف لتعيينه كمدير للشركة *"
            value={selectedAdminUserId}
            onChange={e => setSelectedAdminUserId(e.target.value)}
            options={
              employees.length > 0
                ? employees.map(emp => ({
                    value: emp.id,
                    label: `${emp.displayName} (${emp.email})`,
                  }))
                : [{ value: '', label: 'لا يوجد موظفون مسجلون حالياً' }]
            }
          />
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
              onClick={() => setAdminTargetCompany(null)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isAssigningAdmin}
              disabled={!selectedAdminUserId}
            >
              تأكيد التعيين
            </Button>
          </div>
        </form>
      </Modal>

      {/* Company Details Modal */}
      <Modal
        isOpen={Boolean(detailsCompany)}
        onClose={() => setDetailsCompany(null)}
        title={detailsCompany ? `${detailsCompany.name} — تفاصيل الشركة` : ''}
        subtitle={detailsCompany?.arabicName || detailsCompany?.businessSector || ''}
        maxWidth="2xl"
      >
        {detailsCompany && (
          <div className="space-y-4" dir="rtl">
            <div className="flex items-center gap-1 p-1.5 bg-[#F1F3F5] rounded-full">
              {(
                [
                  { id: 'overview', label: 'نظرة عامة', icon: Building2 },
                  { id: 'employees', label: `الموظفون (${detailsEmployees.length})`, icon: Users },
                  { id: 'projects', label: `المشاريع (${detailsProjects.length})`, icon: FolderKanban },
                  { id: 'tasks', label: `المهام (${detailsTasks.length})`, icon: CheckSquare },
                ] as const
              ).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailsTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      detailsTab === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {detailsTab === 'overview' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed">{detailsCompany.description}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                    <p className="text-slate-500 text-[11px]">الموظفون</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {detailsEmployees.length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                    <p className="text-slate-500 text-[11px]">المشاريع</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {detailsProjects.length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                    <p className="text-slate-500 text-[11px]">المهام</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {detailsTasks.length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                    <p className="text-slate-500 text-[11px]">الحالة</p>
                    <p className="text-sm font-bold text-[#16A34A] mt-1">
                      {detailsCompany.status === 'active' ? 'نشطة' : 'معطّلة'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detailsTab === 'employees' && (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {detailsEmployees.length === 0 ? (
                  <p className="py-8 text-center text-slate-400">لا يوجد موظفون في هذه الشركة بعد.</p>
                ) : (
                  detailsEmployees.map(emp => (
                    <div key={emp.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{emp.displayName}</p>
                        <p className="text-[11px] text-slate-500">
                          {emp.position || emp.department} · {emp.email}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">{emp.role}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailsTab === 'projects' && (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {detailsProjects.length === 0 ? (
                  <p className="py-8 text-center text-slate-400">لا توجد مشاريع مسجلة لهذه الشركة.</p>
                ) : (
                  detailsProjects.map(proj => (
                    <div key={proj.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{proj.name}</p>
                        <p className="text-[11px] text-slate-500">العميل: {proj.clientName}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">{proj.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailsTab === 'tasks' && (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {detailsTasks.length === 0 ? (
                  <p className="py-8 text-center text-slate-400">لا توجد مهام مسجلة لهذه الشركة.</p>
                ) : (
                  detailsTasks.map(t => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">
                          <span className="font-mono text-[#16A34A] ml-1.5">{t.taskId}</span>
                          {t.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          المكلف: {t.assignedToName} · التسليم: {t.deadline}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">{t.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
                onClick={() => setDetailsCompany(null)}
              >
                إغلاق
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const cid = detailsCompany.id;
                  setDetailsCompany(null);
                  onEnterCompany(cid);
                }}
              >
                الدخول لإدارة {detailsCompany.name}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
