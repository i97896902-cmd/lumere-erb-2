import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Client, Task, User } from '../../types';
import { DataService } from '../../services/data/dataService';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_SUBSIDIARY_ID } from '../../config/companies';
import { canCreateTask, canManageProjects as checkCanManageProjects } from '../../utils/rbac';
import { formatLocalDate } from '../../utils/sanitize';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Building,
  Calendar,
  DollarSign,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  Briefcase,
  AlertCircle,
  ListTodo,
} from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  users: User[];
  departments: Array<{ id: string; name: string }>;
  onRefresh?: () => void;
  onOpenCreateTask?: (defaultProjectId?: string, defaultClientId?: string) => void;
  onSelectTask?: (task: Task) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  clients,
  tasks,
  users,
  departments,
  onRefresh,
  onOpenCreateTask,
  onSelectTask,
}) => {
  const { currentUser } = useAuth();
  const { activeCompany, isGroupView, subsidiaries, defaultWriteCompanyId, getCompanyById } = useCompany();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');
  const [clientFilter, setClientFilter] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<Project | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen && !selectedProjectForDetails) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        else if (selectedProjectForDetails) setSelectedProjectForDetails(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, selectedProjectForDetails]);

  // Form State
  const [formCompanyId, setFormCompanyId] = useState(defaultWriteCompanyId);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formStatus, setFormStatus] = useState<Project['status']>('in_progress');
  const [formPriority, setFormPriority] = useState<Project['priority']>('High');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formManagerId, setFormManagerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canManageProjects = checkCanManageProjects(currentUser, defaultWriteCompanyId);

  const scopedFormClients = useMemo(
    () => clients.filter(c => (c.companyId || DEFAULT_SUBSIDIARY_ID) === formCompanyId),
    [clients, formCompanyId]
  );

  const scopedFormDepartments = useMemo(
    () =>
      departments.filter(
        d => ((d as { companyId?: string }).companyId || DEFAULT_SUBSIDIARY_ID) === formCompanyId
      ),
    [departments, formCompanyId]
  );

  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term)) ||
      (p.clientName && p.clientName.toLowerCase().includes(term)) ||
      (p.department && p.department.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesClient = clientFilter === 'all' || p.clientId === clientFilter;

    return matchesSearch && matchesStatus && matchesClient;
  });

  const openAddModal = () => {
    const initialCompany = defaultWriteCompanyId;
    const companyClients = clients.filter(
      c => (c.companyId || DEFAULT_SUBSIDIARY_ID) === initialCompany
    );
    const companyDepts = departments.filter(
      d => ((d as { companyId?: string }).companyId || DEFAULT_SUBSIDIARY_ID) === initialCompany
    );
    setEditingProject(null);
    setFormCompanyId(initialCompany);
    setFormName('');
    setFormDescription('');
    setFormClientId(companyClients[0]?.id || '');
    setFormDepartment(companyDepts[0]?.name || 'عام');
    setFormStatus('in_progress');
    setFormPriority('High');
    setFormStartDate(formatLocalDate(new Date()));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormDeadline(formatLocalDate(d));
    setFormBudget('');
    setFormManagerId(currentUser?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormCompanyId(project.companyId || defaultWriteCompanyId);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormClientId(project.clientId);
    setFormDepartment(project.department || departments[0]?.name || 'عام');
    setFormStatus(project.status);
    setFormPriority((project.priority as Project['priority']) || 'High');
    setFormStartDate(project.startDate);
    setFormDeadline(project.deadline || project.deliveryDate || '');
    setFormBudget(project.budget ? String(project.budget) : '');
    setFormManagerId(project.managerId || '');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !currentUser) return;
    if (!formClientId) {
      showToast('يرجى اختيار عميل تابع لنفس الشركة (أو إضافة عميل أولاً).', 'error');
      return;
    }

    const selectedClient = scopedFormClients.find(c => c.id === formClientId) || clients.find(c => c.id === formClientId);
    const selectedManager = users.find(u => u.id === formManagerId);
    const parsedBudget = formBudget.trim() !== '' && !Number.isNaN(Number(formBudget)) ? Number(formBudget) : undefined;

    setIsSaving(true);
    try {
      if (editingProject) {
        await DataService.updateProject(
          editingProject.id,
          {
            companyId: editingProject.companyId,
            name: formName.trim(),
            description: formDescription.trim(),
            clientId: formClientId,
            clientName: selectedClient?.name || editingProject.clientName,
            department: formDepartment,
            status: formStatus,
            priority: formPriority,
            startDate: formStartDate,
            deadline: formDeadline,
            ...(parsedBudget !== undefined ? { budget: parsedBudget } : {}),
            ...(formManagerId ? { managerId: formManagerId } : {}),
            ...(selectedManager?.displayName ? { managerName: selectedManager.displayName } : {}),
          },
          currentUser
        );
        showToast(`تم تحديث المشروع "${formName.trim()}" بنجاح`, 'success');
      } else {
        await DataService.createProject(
          {
            companyId: formCompanyId,
            name: formName.trim(),
            description: formDescription.trim(),
            clientId: formClientId,
            clientName: selectedClient?.name || 'عميل تجاري',
            department: formDepartment || 'عام',
            status: formStatus,
            priority: formPriority,
            startDate: formStartDate,
            deliveryDate: formDeadline,
            deadline: formDeadline,
            ...(parsedBudget !== undefined ? { budget: parsedBudget } : {}),
            progress: 0,
            tasksCount: 0,
            completedTasksCount: 0,
            managerId: formManagerId || currentUser.id,
            managerName: selectedManager?.displayName || currentUser.displayName,
          },
          currentUser
        );
        showToast(`تم إنشاء المشروع "${formName.trim()}" بنجاح`, 'success');
      }
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error saving project:', err);
      showToast('تعذر حفظ المشروع. تأكد من انتماء العميل لنفس الشركة وصلاحياتك.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteProject = async (project: Project) => {
    if (!currentUser || !canManageProjects) return;
    if (confirmDeleteId !== project.id) {
      setConfirmDeleteId(project.id);
      return;
    }

    setIsDeletingId(project.id);
    try {
      await DataService.deleteProject(project.id, currentUser, project.companyId);
      setConfirmDeleteId(null);
      if (selectedProjectForDetails?.id === project.id) {
        setSelectedProjectForDetails(null);
      }
      showToast(`تم حذف المشروع "${project.name}"`, 'info');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting project:', err);
      showToast('تعذر حذف المشروع. يتطلب الحذف صلاحية مدير شركة أو مدير مجموعة.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return { label: 'مكتمل', bg: 'bg-[#E8F8EE] text-[#15803D] border-transparent' };
      case 'in_progress':
        return { label: 'قيد التنفيذ', bg: 'bg-sky-50 text-sky-700 border-sky-200/70' };
      case 'review':
        return { label: 'مرحلة المراجعة', bg: 'bg-amber-50 text-amber-700 border-amber-200/70' };
      case 'planning':
        return { label: 'تخطيط وتجهيز', bg: 'bg-purple-50 text-purple-700 border-purple-200/70' };
      case 'on_hold':
        return { label: 'متوقف مؤقتاً', bg: 'bg-[#F1F3F5] text-slate-600 border-transparent' };
      default:
        return { label: status, bg: 'bg-[#F1F3F5] text-slate-600 border-transparent' };
    }
  };

  return (
    <div id="projects-view" className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F8EE] flex items-center justify-center text-[#15803D] shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                إدارة المشاريع — {activeCompany.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة المشاريع وتوزيع المهام التابعة لها ومراقبة نسب الإنجاز والمواعيد النهائية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F1F3F5] text-xs text-slate-600">
            <span>إجمالي المشاريع:</span>
            <strong className="text-slate-900 font-bold tabular-nums">{projects.length}</strong>
          </div>

          {canManageProjects && (
            <button
              id="btn-add-project"
              onClick={openAddModal}
              className="py-2.5 px-5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مشروع جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-projects"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث باسم المشروع، العميل، أو القسم..."
            className="w-full pr-10 pl-4 py-2 rounded-full bg-[#F1F3F5] border border-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs bg-[#F1F3F5] border border-transparent rounded-full px-4 py-2 text-slate-700 focus:bg-white focus:outline-none focus:border-[#22C55E] transition-all"
          >
            <option value="all">كافة الحالات</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="planning">تخطيط وتجهيز</option>
            <option value="review">مرحلة المراجعة</option>
            <option value="completed">مكتمل</option>
            <option value="on_hold">متوقف مؤقتاً</option>
          </select>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="text-xs bg-[#F1F3F5] border border-transparent rounded-full px-4 py-2 text-slate-700 focus:bg-white focus:outline-none focus:border-[#22C55E] transition-all"
          >
            <option value="all">كافة العملاء</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/75 p-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">لم يتم العثور على مشاريع</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm ? 'جرب البحث بكلمات مختلفة أو إزالة عوامل التصفية.' : 'ابدأ بإنشاء أول مشروع في منصة Luméré.'}
          </p>
          {canManageProjects && !searchTerm && (
            <button
              onClick={openAddModal}
              className="mt-4 py-2.5 px-5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إنشاء مشروع الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'Completed');
            const progress =
              projectTasks.length > 0
                ? Math.round((completedTasks.length / projectTasks.length) * 100)
                : project.progress || 0;
            const badge = getStatusBadge(project.status);

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-200/75 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300/90 hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-[#15803D] bg-[#E8F8EE] px-2.5 py-0.5 rounded-full">
                        {project.department}
                      </span>
                      {isGroupView && project.companyId && (
                        <span className="text-[11px] font-bold text-slate-600 bg-[#F1F3F5] px-2.5 py-0.5 rounded-full">
                          {getCompanyById(project.companyId)?.name || project.companyId}
                        </span>
                      )}
                    </div>

                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">{project.name}</h3>

                  {project.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3.5 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Client & Manager */}
                  <div className="space-y-2 text-xs text-slate-600 py-3 border-y border-slate-100 mb-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        العميل
                      </span>
                      <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {project.clientName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        الموعد النهائي
                      </span>
                      <span className="font-mono text-slate-700 tabular-nums">{project.deadline}</span>
                    </div>

                    {project.budget && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" />
                          الميزانية
                        </span>
                        <span className="font-bold text-[#15803D] tabular-nums">
                          {project.budget.toLocaleString()} ر.س
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">نسبة الإنجاز</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F1F3F5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#22C55E] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 tabular-nums">
                      <span>المهام المنجزة: {completedTasks.length} من {projectTasks.length}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedProjectForDetails(project)}
                    className="text-xs font-semibold text-[#15803D] hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>عرض المهام والتفاصيل</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {onOpenCreateTask && canCreateTask(currentUser, project.companyId || defaultWriteCompanyId) && (
                      <button
                        type="button"
                        onClick={() => onOpenCreateTask(project.id, project.clientId)}
                        className="p-1.5 rounded-full text-[#15803D] hover:bg-[#E8F8EE] transition-colors cursor-pointer"
                        title="إضافة مهمة لهذا المشروع"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}

                    {canManageProjects && (
                      <>
                        <button
                          onClick={() => openEditModal(project)}
                          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="تعديل المشروع"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === project.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteProject(project)}
                              disabled={isDeletingId === project.id}
                              className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded-full bg-[#F1F3F5] text-slate-600 text-[11px] font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDeleteProject(project)}
                            disabled={isDeletingId === project.id}
                            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف المشروع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={editingProject ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5 text-[#15803D]">
                  <span className="w-9 h-9 rounded-2xl bg-[#E8F8EE] flex items-center justify-center">
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingProject ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="إغلاق"
                  className="w-8 h-8 rounded-full bg-[#F1F3F5] text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
                {isGroupView && !editingProject && (
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">
                      الشركة التابعة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCompanyId}
                      onChange={e => {
                        const nextCompanyId = e.target.value;
                        setFormCompanyId(nextCompanyId);
                        const nextClients = clients.filter(
                          c => (c.companyId || DEFAULT_SUBSIDIARY_ID) === nextCompanyId
                        );
                        const nextDepts = departments.filter(
                          d => ((d as { companyId?: string }).companyId || DEFAULT_SUBSIDIARY_ID) === nextCompanyId
                        );
                        setFormClientId(nextClients[0]?.id || '');
                        setFormDepartment(nextDepts[0]?.name || 'عام');
                      }}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    >
                      {subsidiaries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.arabicName ? `— ${c.arabicName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">
                    اسم المشروع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="مثال: البوابة الرقمية لخدمات العملاء"
                    className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">وصف وأهداف المشروع</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="شرح نطاق العمل والمخرجات المتوقعة من المشروع..."
                    className="w-full p-3.5 rounded-2xl bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">
                      العميل المرتبط <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formClientId}
                      onChange={e => setFormClientId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    >
                      {scopedFormClients.length === 0 ? (
                        <option value="">-- لا يوجد عملاء في هذه الشركة (أضف عميلاً أولاً) --</option>
                      ) : (
                        scopedFormClients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.company ? `(${c.company})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">القسم المسؤول</label>
                    <select
                      value={formDepartment}
                      onChange={e => setFormDepartment(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    >
                      {scopedFormDepartments.length > 0 ? (
                        scopedFormDepartments.map(d => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))
                      ) : (
                        <option value="عام">عام</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">حالة المشروع</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    >
                      <option value="planning">تخطيط (Planning)</option>
                      <option value="in_progress">قيد التنفيذ (In Progress)</option>
                      <option value="review">مراجعة (Review)</option>
                      <option value="completed">مكتمل (Completed)</option>
                      <option value="on_hold">معلق (On Hold)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">الأولوية</label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    >
                      <option value="Low">منخفضة (Low)</option>
                      <option value="Medium">متوسطة (Medium)</option>
                      <option value="High">عالية (High)</option>
                      <option value="Urgent">عاجلة جداً (Urgent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">الميزانية (ر.س)</label>
                    <input
                      type="number"
                      value={formBudget}
                      onChange={e => setFormBudget(e.target.value)}
                      placeholder="50000"
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">تاريخ البدء</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1.5">الموعد النهائي</label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={e => setFormDeadline(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'جارِ الحفظ...' : editingProject ? 'حفظ التعديلات' : 'إنشاء المشروع'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="py-2.5 px-5 rounded-full bg-[#E8F8EE] hover:bg-[#DCFCE7] text-[#15803D] font-semibold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Details Modal (Shows linked tasks) */}
      <AnimatePresence>
        {selectedProjectForDetails && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`تفاصيل المشروع ${selectedProjectForDetails.name}`}
            onClick={() => setSelectedProjectForDetails(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <span className="text-[11px] font-semibold text-[#15803D] bg-[#E8F8EE] px-2.5 py-0.5 rounded-full">
                    {selectedProjectForDetails.department}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedProjectForDetails.name}</h3>
                  <p className="text-xs text-slate-500">العميل: {selectedProjectForDetails.clientName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProjectForDetails(null)}
                  aria-label="إغلاق"
                  className="w-8 h-8 rounded-full bg-[#F1F3F5] text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedProjectForDetails.description && (
                <div className="mb-4 p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-100 text-xs text-slate-700 leading-relaxed">
                  {selectedProjectForDetails.description}
                </div>
              )}

              {/* Linked Tasks */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-[#15803D]" />
                    <span>
                      المهام التابعة لهذا المشروع (
                      {tasks.filter(t => t.projectId === selectedProjectForDetails.id).length})
                    </span>
                  </h4>

                  {onOpenCreateTask &&
                    canCreateTask(
                      currentUser,
                      selectedProjectForDetails.companyId || defaultWriteCompanyId
                    ) && (
                    <button
                      type="button"
                      onClick={() => {
                        const projId = selectedProjectForDetails.id;
                        const clId = selectedProjectForDetails.clientId;
                        setSelectedProjectForDetails(null);
                        onOpenCreateTask(projId, clId);
                      }}
                      className="text-xs font-semibold text-[#15803D] hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مهمة للمشروع</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {tasks.filter(t => t.projectId === selectedProjectForDetails.id).length === 0 ? (
                    <div className="p-6 text-center bg-[#F8F9FA] rounded-2xl border border-dashed border-slate-200">
                      <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">لا توجد مهام منشأة لهذا المشروع حتى الآن.</p>
                      {onOpenCreateTask &&
                        canCreateTask(
                          currentUser,
                          selectedProjectForDetails.companyId || defaultWriteCompanyId
                        ) && (
                        <button
                          type="button"
                          onClick={() => {
                            const projId = selectedProjectForDetails.id;
                            const clId = selectedProjectForDetails.clientId;
                            setSelectedProjectForDetails(null);
                            onOpenCreateTask(projId, clId);
                          }}
                          className="mt-3 py-2 px-4 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إنشاء أول مهمة للمشروع</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    tasks
                      .filter(t => t.projectId === selectedProjectForDetails.id)
                      .map(task => (
                        <div
                          key={task.id}
                          onClick={() => {
                            if (onSelectTask) {
                              setSelectedProjectForDetails(null);
                              onSelectTask(task);
                            }
                          }}
                          className="p-3.5 rounded-2xl bg-[#F8F9FA] hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between cursor-pointer transition-colors text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-[#15803D] bg-[#E8F8EE] px-1.5 py-0.5 rounded-md">{task.taskId}</span>
                              <strong className="text-slate-900">{task.title}</strong>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-0.5 block">
                              المكلف: {task.assignedToName} • التسليم: {task.deadline}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-medium text-slate-700">
                              {task.status}
                            </span>
                            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedProjectForDetails(null)}
                  className="py-2 px-5 rounded-full bg-[#18181B] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
