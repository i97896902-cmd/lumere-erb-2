import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Client, Task, User } from '../../types';
import { DataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');
  const [clientFilter, setClientFilter] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<Project | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Form State
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

  const canManageProjects = currentUser?.role === 'ADMIN';

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
    setEditingProject(null);
    setFormName('');
    setFormDescription('');
    setFormClientId(clients[0]?.id || '');
    setFormDepartment(departments[0]?.name || 'Development');
    setFormStatus('in_progress');
    setFormPriority('High');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormDeadline(d.toISOString().split('T')[0]);
    setFormBudget('');
    setFormManagerId(currentUser?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormClientId(project.clientId);
    setFormDepartment(project.department || departments[0]?.name || 'Development');
    setFormStatus(project.status);
    setFormPriority((project.priority as any) || 'High');
    setFormStartDate(project.startDate);
    setFormDeadline(project.deadline || project.deliveryDate || '');
    setFormBudget(project.budget ? String(project.budget) : '');
    setFormManagerId(project.managerId || '');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formClientId || !currentUser) return;

    const selectedClient = clients.find(c => c.id === formClientId);
    const selectedManager = users.find(u => u.id === formManagerId);

    setIsSaving(true);
    try {
      if (editingProject) {
        await DataService.updateProject(
          editingProject.id,
          {
            name: formName.trim(),
            description: formDescription.trim(),
            clientId: formClientId,
            clientName: selectedClient?.name || editingProject.clientName,
            department: formDepartment,
            status: formStatus,
            priority: formPriority,
            startDate: formStartDate,
            deadline: formDeadline,
            budget: formBudget ? Number(formBudget) : undefined,
            managerId: formManagerId,
            managerName: selectedManager?.displayName,
          },
          currentUser
        );
      } else {
        await DataService.createProject(
          {
            name: formName.trim(),
            description: formDescription.trim(),
            clientId: formClientId,
            clientName: selectedClient?.name || 'عميل تجاري',
            department: formDepartment,
            status: formStatus,
            priority: formPriority,
            startDate: formStartDate,
            deadline: formDeadline,
            budget: formBudget ? Number(formBudget) : undefined,
            progress: 0,
            tasksCount: 0,
            completedTasksCount: 0,
            managerId: formManagerId || currentUser.id,
            managerName: selectedManager?.displayName || currentUser.displayName,
          },
          currentUser
        );
      }
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!currentUser || !canManageProjects) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع؟')) return;

    setIsDeletingId(projectId);
    try {
      await DataService.deleteProject(projectId, currentUser);
      if (selectedProjectForDetails?.id === projectId) {
        setSelectedProjectForDetails(null);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting project:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'completed':
        return { label: 'مكتمل', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'in_progress':
        return { label: 'قيد التنفيذ', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'review':
        return { label: 'مرحلة المراجعة', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'planning':
        return { label: 'تخطيط وتجهيز', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'on_hold':
        return { label: 'متوقف مؤقتاً', bg: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
      default:
        return { label: status, bg: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
    }
  };

  return (
    <div id="projects-view" className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">إدارة المشاريع</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                متابعة مشاريع Luméré، توزيع المهام التابعة لها، ومراقبة نسب الإنجاز والمواعيد النهائية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-xs text-neutral-600">
            <span>إجمالي المشاريع:</span>
            <strong className="text-neutral-900 font-semibold">{projects.length}</strong>
          </div>

          {canManageProjects && (
            <button
              id="btn-add-project"
              onClick={openAddModal}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مشروع جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-projects"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث باسم المشروع، العميل، أو القسم..."
            className="w-full pr-10 pl-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-emerald-500"
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
            className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-emerald-500"
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
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center">
          <FolderKanban className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-neutral-900 mb-1">لم يتم العثور على مشاريع</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchTerm ? 'جرب البحث بكلمات مختلفة أو إزالة عوامل التصفية.' : 'ابدأ بإنشاء أول مشروع في منصة Luméré.'}
          </p>
          {canManageProjects && !searchTerm && (
            <button
              onClick={openAddModal}
              className="mt-4 py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
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
                className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                      {project.department}
                    </span>

                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-neutral-900 line-clamp-1 mb-1">{project.name}</h3>

                  {project.description && (
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3.5 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Client & Manager */}
                  <div className="space-y-1.5 text-xs text-neutral-600 py-2.5 border-y border-neutral-100 mb-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        العميل
                      </span>
                      <span className="font-semibold text-neutral-900 truncate max-w-[180px]">
                        {project.clientName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        الموعد النهائي
                      </span>
                      <span className="font-mono text-neutral-700">{project.deadline}</span>
                    </div>

                    {project.budget && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" />
                          الميزانية
                        </span>
                        <span className="font-semibold text-emerald-800">
                          {project.budget.toLocaleString()} ر.س
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-neutral-500 font-medium">نسبة الإنجاز</span>
                      <span className="font-bold text-neutral-900 font-mono">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
                      <span>المهام المنجزة: {completedTasks.length} من {projectTasks.length}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <button
                    onClick={() => setSelectedProjectForDetails(project)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <span>عرض المهام والتفاصيل</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {onOpenCreateTask && (
                      <button
                        onClick={() => onOpenCreateTask(project.id, project.clientId)}
                        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="إضافة مهمة لهذا المشروع"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}

                    {canManageProjects && (
                      <>
                        <button
                          onClick={() => openEditModal(project)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="تعديل المشروع"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          disabled={isDeletingId === project.id}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="حذف المشروع"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-5">
                <div className="flex items-center gap-2 text-emerald-800">
                  <FolderKanban className="w-5 h-5" />
                  <h3 className="font-bold text-base text-neutral-900">
                    {editingProject ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    اسم المشروع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="مثال: البوابة الرقمية لخدمات العملاء"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">وصف وأهداف المشروع</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="شرح نطاق العمل والمخرجات المتوقعة من المشروع..."
                    className="w-full p-3 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      العميل المرتبط <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formClientId}
                      onChange={e => setFormClientId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">القسم المسؤول</label>
                    <select
                      value={formDepartment}
                      onChange={e => setFormDepartment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Media">Media</option>
                      <option value="Sales">Sales</option>
                      <option value="Photography">Photography</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">حالة المشروع</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="planning">تخطيط (Planning)</option>
                      <option value="in_progress">قيد التنفيذ (In Progress)</option>
                      <option value="review">مراجعة (Review)</option>
                      <option value="completed">مكتمل (Completed)</option>
                      <option value="on_hold">معلق (On Hold)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">الأولوية</label>
                    <select
                      value={formPriority}
                      onChange={e => setFormPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Low">منخفضة (Low)</option>
                      <option value="Medium">متوسطة (Medium)</option>
                      <option value="High">عالية (High)</option>
                      <option value="Urgent">عاجلة جداً (Urgent)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">الميزانية (ر.س)</label>
                    <input
                      type="number"
                      value={formBudget}
                      onChange={e => setFormBudget(e.target.value)}
                      placeholder="50000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">تاريخ البدء</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">الموعد النهائي</label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={e => setFormDeadline(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? 'جارِ الحفظ...' : editingProject ? 'حفظ التعديلات' : 'إنشاء المشروع'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between pb-4 border-b border-neutral-100 mb-4">
                <div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {selectedProjectForDetails.department}
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 mt-1">{selectedProjectForDetails.name}</h3>
                  <p className="text-xs text-neutral-500">العميل: {selectedProjectForDetails.clientName}</p>
                </div>
                <button
                  onClick={() => setSelectedProjectForDetails(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedProjectForDetails.description && (
                <div className="mb-4 p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-700 leading-relaxed">
                  {selectedProjectForDetails.description}
                </div>
              )}

              {/* Linked Tasks */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-neutral-800 flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-emerald-600" />
                    <span>
                      المهام التابعة لهذا المشروع (
                      {tasks.filter(t => t.projectId === selectedProjectForDetails.id).length})
                    </span>
                  </h4>

                  {onOpenCreateTask && (
                    <button
                      onClick={() => {
                        const projId = selectedProjectForDetails.id;
                        const clId = selectedProjectForDetails.clientId;
                        setSelectedProjectForDetails(null);
                        onOpenCreateTask(projId, clId);
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مهمة للمشروع</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {tasks.filter(t => t.projectId === selectedProjectForDetails.id).length === 0 ? (
                    <div className="p-6 text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                      <ListTodo className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">لا توجد مهام منشأة لهذا المشروع حتى الآن.</p>
                      {onOpenCreateTask && (
                        <button
                          onClick={() => {
                            const projId = selectedProjectForDetails.id;
                            const clId = selectedProjectForDetails.clientId;
                            setSelectedProjectForDetails(null);
                            onOpenCreateTask(projId, clId);
                          }}
                          className="mt-3 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1"
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
                          className="p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-100 flex items-center justify-between cursor-pointer transition-colors text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-neutral-400">{task.taskId}</span>
                              <strong className="text-neutral-900">{task.title}</strong>
                            </div>
                            <span className="text-[11px] text-neutral-500 mt-0.5 block">
                              المكلف: {task.assignedToName} • التسليم: {task.deadline}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-neutral-200 font-medium text-neutral-700">
                              {task.status}
                            </span>
                            <ChevronLeft className="w-3.5 h-3.5 text-neutral-400" />
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setSelectedProjectForDetails(null)}
                  className="py-2 px-4 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800"
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
