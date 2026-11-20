import React, { useState, useEffect, useMemo } from 'react';
import { Upload, X, FileText, AlertCircle, Building, FolderKanban, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Task, User, Department, TaskPriority, TaskAttachment, Project, Client } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import { DEFAULT_SUBSIDIARY_ID } from '../../config/companies';
import { getUserCompanyId, isActiveStatus, validateTaskAssignment } from '../../utils/rbac';
import { formatLocalDate } from '../../utils/sanitize';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: User[];
  departments: Department[];
  projects?: Project[];
  clients?: Client[];
  defaultProjectId?: string;
  defaultClientId?: string;
  onTaskCreated: (task: Task) => void;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  employees,
  departments,
  projects = [],
  clients = [],
  defaultProjectId = '',
  defaultClientId = '',
  onTaskCreated,
}: CreateTaskModalProps) {
  const { currentUser } = useAuth();
  const { isGroupView, subsidiaries, defaultWriteCompanyId, activeCompany } = useCompany();
  const { showToast } = useToast();

  const [targetCompanyId, setTargetCompanyId] = useState(defaultWriteCompanyId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [clientId, setClientId] = useState(defaultClientId);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [startDate, setStartDate] = useState(() => formatLocalDate());
  const [deadline, setDeadline] = useState(() =>
    formatLocalDate(new Date(Date.now() + 7 * 86400000))
  );
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scoped entities for the selected subsidiary (prevents cross-company assignment)
  const scopedEmployees = useMemo(
    () =>
      employees.filter(
        emp => isActiveStatus(emp.status) && getUserCompanyId(emp) === targetCompanyId
      ),
    [employees, targetCompanyId]
  );

  const scopedDepartments = useMemo(
    () => departments.filter(d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === targetCompanyId),
    [departments, targetCompanyId]
  );

  const scopedProjects = useMemo(
    () => projects.filter(p => (p.companyId || DEFAULT_SUBSIDIARY_ID) === targetCompanyId),
    [projects, targetCompanyId]
  );

  const scopedClients = useMemo(
    () => clients.filter(c => (c.companyId || DEFAULT_SUBSIDIARY_ID) === targetCompanyId),
    [clients, targetCompanyId]
  );

  // Sync defaults when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    let resolvedCompany = defaultWriteCompanyId;

    if (defaultProjectId) {
      const p = projects.find(item => item.id === defaultProjectId);
      if (p) {
        resolvedCompany = p.companyId || defaultWriteCompanyId;
        setProjectId(defaultProjectId);
        setClientId(p.clientId);
        if (p.department) setDepartment(p.department);
      }
    } else if (defaultClientId) {
      const c = clients.find(item => item.id === defaultClientId);
      if (c?.companyId) resolvedCompany = c.companyId;
      setClientId(defaultClientId);
      setProjectId('');
    } else {
      setProjectId('');
      setClientId('');
    }
    setTargetCompanyId(resolvedCompany);
  }, [isOpen, defaultProjectId, defaultClientId, projects, clients, defaultWriteCompanyId]);

  // Keep department and assignee aligned with target company
  useEffect(() => {
    if (!isOpen) return;
    if (scopedDepartments.length > 0 && !scopedDepartments.some(d => d.name === department)) {
      setDepartment(scopedDepartments[0].name);
    } else if (scopedDepartments.length === 0 && !department) {
      setDepartment('عام');
    }
    if (scopedEmployees.length > 0 && !scopedEmployees.some(e => e.id === assignedToId)) {
      setAssignedToId(scopedEmployees[0].id);
    } else if (scopedEmployees.length === 0) {
      setAssignedToId('');
    }
    if (projectId && !scopedProjects.some(p => p.id === projectId)) {
      setProjectId('');
    }
    if (clientId && !scopedClients.some(c => c.id === clientId)) {
      setClientId('');
    }
  }, [isOpen, targetCompanyId, scopedDepartments, scopedEmployees, scopedProjects, scopedClients, department, assignedToId, projectId, clientId]);

  const handleProjectChange = (selectedProjId: string) => {
    setProjectId(selectedProjId);
    if (selectedProjId) {
      const proj = scopedProjects.find(p => p.id === selectedProjId);
      if (proj) {
        setClientId(proj.clientId);
        if (proj.department) setDepartment(proj.department);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: TaskAttachment[] = [];
    const newPending: Array<{ id: string; file: File }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 15 * 1024 * 1024) {
        showToast(`حجم الملف ${file.name} يتجاوز الحد المسموح (15 ميجابايت).`, 'error');
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['exe', 'bat', 'sh', 'cmd', 'vbs', 'scr'].includes(ext || '')) {
        showToast(`نوع الملف .${ext} محظور لدواعي أمان النظام.`, 'error');
        continue;
      }

      const id = Math.random().toString(36).substring(2, 9);
      newPending.push({ id, file });
      newAttachments.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: URL.createObjectURL(file),
        uploaderName: currentUser?.displayName || 'مستخدم',
        uploaderId: currentUser?.id,
        uploadedAt: new Date().toISOString(),
      });
    }

    setPendingFiles(prev => [...prev, ...newPending]);
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target?.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(a => a.id !== id);
    });
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('عنوان المهمة مطلوب.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('وصف المهمة ومعايير القبول مطلوبة.');
      return;
    }
    if (!assignedToId) {
      setErrorMsg('يرجى اختيار الموظف المكلف بالمهمة داخل هذه الشركة.');
      return;
    }
    if (!deadline) {
      setErrorMsg('الموعد النهائي للتسليم مطلوب.');
      return;
    }
    if (startDate && deadline && deadline < startDate) {
      setErrorMsg('لا يمكن أن يكون موعد التسليم قبل تاريخ بدء المهمة.');
      return;
    }
    if (!currentUser) return;

    const assignedEmp = scopedEmployees.find(e => e.id === assignedToId);
    const selectedProj = scopedProjects.find(p => p.id === projectId);
    const selectedClient =
      scopedClients.find(c => c.id === clientId) ||
      (selectedProj ? scopedClients.find(c => c.id === selectedProj.clientId) : undefined);

    // Enforce strict multi-company assignment guard
    const validation = validateTaskAssignment({
      actor: currentUser,
      taskCompanyId: targetCompanyId,
      assignee: assignedEmp,
      project: selectedProj,
    });
    if (!validation.allowed || !assignedEmp) {
      setErrorMsg(validation.reason || 'تعذر التحقق من صلاحية الإسناد لهذه الشركة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskIdCode = `TSK-${Math.floor(100 + Math.random() * 900)}`;

      // Attempt Firebase Storage upload per company path, falling back safely if Storage rules aren't deployed yet
      const finalAttachments: TaskAttachment[] = [];
      for (const att of attachments) {
        const pending = pendingFiles.find(p => p.id === att.id);
        if (pending) {
          try {
            const storageUrl = await DataService.uploadTaskAttachment(
              targetCompanyId,
              taskIdCode,
              pending.file
            );
            if (att.url.startsWith('blob:')) {
              URL.revokeObjectURL(att.url);
            }
            finalAttachments.push({ ...att, url: storageUrl });
          } catch {
            finalAttachments.push(att);
          }
        } else {
          finalAttachments.push(att);
        }
      }

      const created = await DataService.createTask(
        {
          companyId: targetCompanyId,
          taskId: taskIdCode,
          title: title.trim(),
          description: description.trim(),
          createdBy: currentUser.id,
          createdByName: currentUser.displayName,
          assignedTo: assignedEmp.id,
          assignedToName: assignedEmp.displayName,
          assignedToEmail: assignedEmp.email,
          assignedToPhoto: assignedEmp.photoURL,
          department: department || scopedDepartments[0]?.name || 'عام',
          priority,
          status: 'Pending',
          startDate,
          deadline,
          completionPercentage: 0,
          reviewStatus: 'none',
          attachments: finalAttachments,
          commentsCount: 0,
          projectId: projectId || undefined,
          projectName: selectedProj?.name || undefined,
          clientId: clientId || selectedProj?.clientId || undefined,
          clientName: selectedClient?.name || selectedProj?.clientName || undefined,
        },
        currentUser
      );

      showToast(
        `تم إنشاء المهمة ${taskIdCode} بنجاح وإسنادها إلى ${assignedEmp.displayName}!`,
        'success'
      );
      onTaskCreated(created);
      onClose();

      setTitle('');
      setDescription('');
      setProjectId('');
      setClientId('');
      setAttachments([]);
      setPendingFiles([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء المهمة';
      setErrorMsg(msg);
      showToast('حدث خطأ أثناء إنشاء المهمة. يرجى التحقق من الحقول.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إنشاء مهمة عمل جديدة"
      subtitle={`مساحة العمل: ${isGroupView ? 'اختيار الشركة التابعة' : activeCompany.name}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Subsidiary selector when in Group View */}
        {isGroupView && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>الشركة التابعة المستهدفة *</span>
            </label>
            <select
              id="task-company-select"
              value={targetCompanyId}
              onChange={e => setTargetCompanyId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs bg-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              {subsidiaries.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.arabicName ? `— ${c.arabicName}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <Input
          id="task-title-input"
          label="عنوان المهمة *"
          placeholder="مثال: تطوير نظام التصميم الرقمي أو تسليم حملة العميل"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />

        {/* Project and Client Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-emerald-600" />
              <span>المشروع المرتبط (اختياري)</span>
            </label>
            <select
              id="task-project-select"
              value={projectId}
              onChange={e => handleProjectChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs bg-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">-- بدون ربط بمشروع محدد --</option>
              {scopedProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.clientName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              <span>العميل المرتبط (اختياري)</span>
            </label>
            <select
              id="task-client-select"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-xs bg-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">-- بدون ربط بعميل محدد --</option>
              {scopedClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <Textarea
          id="task-desc-input"
          label="الوصف التفصيلي ومعايير القبول والتسليم *"
          rows={3}
          placeholder="حدد المخرجات المتوقعة، المعايير، الروابط، والمواصفات التشغيلية..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
        />

        {/* Department & Employee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="task-dept-select"
            label="القسم المسؤول *"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            options={
              scopedDepartments.length > 0
                ? scopedDepartments.map(d => ({ label: d.name, value: d.name }))
                : [{ label: 'عام', value: 'عام' }]
            }
          />

          <Select
            id="task-assignee-select"
            label="الموظف المكلف (من نفس الشركة) *"
            value={assignedToId}
            onChange={e => setAssignedToId(e.target.value)}
            options={
              scopedEmployees.length > 0
                ? scopedEmployees.map(emp => ({
                    label: `${emp.displayName} (${emp.position || emp.department})`,
                    value: emp.id,
                  }))
                : [{ label: 'لا يوجد موظفون نشطون في هذه الشركة', value: '' }]
            }
          />
        </div>

        {/* Priority, Start Date, Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            id="task-priority-select"
            label="الأولوية *"
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            options={[
              { label: 'عاجلة جداً (Urgent)', value: 'Urgent' },
              { label: 'عالية (High)', value: 'High' },
              { label: 'متوسطة (Medium)', value: 'Medium' },
              { label: 'منخفضة (Low)', value: 'Low' },
            ]}
          />

          <Input
            id="task-start-date"
            type="date"
            label="تاريخ البدء *"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
          />

          <Input
            id="task-deadline"
            type="date"
            label="الموعد النهائي *"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            required
          />
        </div>

        {/* Attachments Section */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
            المرفقات والملفات الداعمة (PDF, صور, مستندات, جداول)
          </label>
          <div className="border border-dashed border-neutral-300 rounded-xl p-4 text-center hover:bg-neutral-50/50 transition-colors">
            <input
              type="file"
              id="file-upload-input"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload-input"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload className="w-6 h-6 text-neutral-400 mb-1" />
              <span className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                انقر لرفع المستندات والملفات
              </span>
              <span className="text-[11px] text-neutral-400">
                PDF, PNG, JPG, DOCX, XLSX حتى 15 ميجابايت
              </span>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-neutral-800 truncate">{att.name}</span>
                    <span className="text-[10px] text-neutral-400">
                      ({Math.round(att.size / 1024)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            id="btn-submit-create-task"
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
          >
            إنشاء وإسناد المهمة
          </Button>
        </div>
      </form>
    </Modal>
  );
}
