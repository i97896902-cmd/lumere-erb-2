import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Paperclip,
  Send,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Trash2,
  Download,
  AlertTriangle,
  Upload,
  MessageSquare,
  FileText,
  FolderKanban,
  Building2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Task, TaskComment, TaskAttachment, TaskStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/data/dataService';
import { DEFAULT_SUBSIDIARY_ID } from '../../config/companies';
import { canApproveTasks, canDeleteTask, getRoleArabicLabel, isTaskAssignedToUser } from '../../utils/rbac';
import { formatLocalDate } from '../../utils/sanitize';

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

export function TaskDetailsModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailsModalProps) {
  const { currentUser } = useAuth();
  const { getCompanyById } = useCompany();
  const { showToast } = useToast();

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [progressVal, setProgressVal] = useState(task?.completionPercentage || 0);

  // Sync progress if task changes
  useEffect(() => {
    if (task) {
      setProgressVal(task.completionPercentage || 0);
      setConfirmingDelete(false);
      loadComments(task.id);
    }
  }, [task]);

  const loadComments = async (taskId: string) => {
    setLoadingComments(true);
    try {
      const list = await DataService.getComments(taskId);
      setComments(list);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  if (!task) return null;

  const nowStr = formatLocalDate();
  const isOverdue =
    Boolean(task.deadline) && task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';

  // Permission flags (4-tier company-scoped RBAC)
  const taskCompanyId = task.companyId || DEFAULT_SUBSIDIARY_ID;
  const taskCompany = getCompanyById(taskCompanyId);
  const assigneeDisplayName = task.assignedToName || task.assignedToEmail || 'غير محدد';
  const isAssignee = isTaskAssignedToUser(currentUser, task);
  const canApproveOrReject = canApproveTasks(currentUser, taskCompanyId);
  const canDelete = canDeleteTask(currentUser, taskCompanyId);
  const canStartOrSubmit = isAssignee || canApproveOrReject;
  const isTerminalStatus = task.status === 'Completed' || task.status === 'Cancelled';
  const canModifyProgressOrAttachments = canStartOrSubmit && !isTerminalStatus;

  // Workflow Handlers
  const handleWorkflowTransition = async (
    newStatus: TaskStatus,
    reviewStatus?: 'none' | 'pending_review' | 'approved' | 'rejected'
  ) => {
    if (!currentUser) return;
    setIsActionLoading(true);
    try {
      await DataService.updateTaskStatus(task, newStatus, currentUser, reviewStatus);
      const updated: Task = {
        ...task,
        status: newStatus,
        reviewStatus: reviewStatus || task.reviewStatus,
        completionPercentage: newStatus === 'Completed' ? 100 : task.completionPercentage,
        completedAt: newStatus === 'Completed' ? new Date().toISOString() : task.completedAt,
        updatedAt: new Date().toISOString(),
      };
      onTaskUpdated(updated);
      showToast(`تم تحديث حالة المهمة بنجاح`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحديث الحالة';
      showToast(msg, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleProgressSave = async () => {
    if (!currentUser || !canModifyProgressOrAttachments) return;
    if (progressVal === (task.completionPercentage || 0)) return;
    setIsActionLoading(true);
    try {
      await DataService.updateTask(
        task.id,
        { companyId: taskCompanyId, completionPercentage: progressVal },
        currentUser
      );
      onTaskUpdated({ ...task, completionPercentage: progressVal });
      showToast(`تم تحديث نسبة الإنجاز إلى ${progressVal}%`, 'success');
    } catch {
      showToast('تعذر حفظ نسبة الإنجاز.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    setIsSubmittingComment(true);
    try {
      const commentObj = await DataService.addComment(
        task.id,
        {
          companyId: taskCompanyId,
          taskId: task.id,
          userId: currentUser.id,
          userName: currentUser.displayName,
          userRole: currentUser.role,
          userAvatar: currentUser.photoURL,
          message: newComment.trim(),
        },
        task
      );
      setComments(prev => [...prev, commentObj]);
      setNewComment('');
      showToast('تمت إضافة التعليق بنجاح', 'success');
    } catch (err) {
      console.error('Error posting comment:', err);
      showToast('فشل نشر التعليق', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !canDelete) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setIsActionLoading(true);
    try {
      await DataService.deleteTask(task.id, task.title, currentUser, taskCompanyId);
      showToast(`تم حذف المهمة ${task.taskId}`, 'info');
      setConfirmingDelete(false);
      if (onTaskDeleted) onTaskDeleted(task.id);
      onClose();
    } catch {
      showToast('فشل حذف المهمة', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Upload file to task (Firebase Storage per company path with safe fallback)
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser || !canModifyProgressOrAttachments) return;

    const blockedExts = new Set(['exe', 'bat', 'sh', 'cmd', 'vbs', 'scr', 'js', 'msi']);
    const addedAttachments: TaskAttachment[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          showToast(`حجم الملف ${file.name} يتجاوز الحد المسموح (15 ميجابايت).`, 'error');
          continue;
        }
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (blockedExts.has(ext)) {
          showToast(`نوع الملف .${ext} محظور لدواعي أمان النظام.`, 'error');
          continue;
        }

        let fileUrl = '';
        try {
          fileUrl = await DataService.uploadTaskAttachment(taskCompanyId, task.id, file);
        } catch {
          fileUrl = URL.createObjectURL(file);
        }
        addedAttachments.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: fileUrl,
          uploaderName: currentUser.displayName,
          uploaderId: currentUser.id,
          uploadedAt: new Date().toISOString(),
        });
      }

      if (addedAttachments.length === 0) return;

      const newAttachments: TaskAttachment[] = [...(task.attachments || []), ...addedAttachments];
      await DataService.updateTask(
        task.id,
        { companyId: taskCompanyId, attachments: newAttachments },
        currentUser
      );
      onTaskUpdated({ ...task, attachments: newAttachments });
      showToast('تم رفع المرفق بنجاح', 'success');
    } catch {
      showToast('تعذر رفع الملف', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${task.taskId} — ${task.title}`}
      subtitle={`${taskCompany ? `${taskCompany.name} • ` : ''}قسم ${task.department} • تم الإنشاء بواسطة ${task.createdByName}`}
      maxWidth="3xl"
    >
      <div className="space-y-6" dir="rtl">
        {/* Project & Client Link Tag Banner */}
        {(task.projectName || task.clientName) && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-[#E8F8EE]/60 border border-[#22C55E]/20 text-xs">
            {task.projectName && (
              <span className="flex items-center gap-1.5 font-bold text-[#15803D] bg-white px-3 py-1 rounded-full border border-emerald-200/80 shadow-2xs">
                <FolderKanban className="w-3.5 h-3.5 text-[#15803D]" />
                المشروع: {task.projectName}
              </span>
            )}
            {task.clientName && (
              <span className="flex items-center gap-1.5 font-bold text-slate-800 bg-white px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                العميل: {task.clientName}
              </span>
            )}
          </div>
        )}

        {/* Status & Action Banner */}
        <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200/75 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} isOverdue={isOverdue} />
            <PriorityBadge priority={task.priority} />
            {isOverdue && (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> متأخرة عن موعد التسليم
              </span>
            )}
          </div>

          {/* Dynamic Workflow Buttons */}
          <div className="flex items-center gap-2">
            {/* 1. Pending -> In Progress */}
            {task.status === 'Pending' && canStartOrSubmit && (
              <Button
                id="btn-start-task"
                size="sm"
                variant="primary"
                leftIcon={<Play className="w-4 h-4" />}
                onClick={() => handleWorkflowTransition('In Progress')}
                isLoading={isActionLoading}
              >
                قبول وبدء المهمة
              </Button>
            )}

            {/* 2. In Progress -> Review */}
            {task.status === 'In Progress' && canStartOrSubmit && (
              <Button
                id="btn-submit-review"
                size="sm"
                variant="gold"
                leftIcon={<Send className="w-4 h-4" />}
                onClick={() => handleWorkflowTransition('Review', 'pending_review')}
                isLoading={isActionLoading}
              >
                إرسال للاعتماد والمراجعة
              </Button>
            )}

            {/* 3. Review -> Completed or Rejected */}
            {task.status === 'Review' && canApproveOrReject && (
              <>
                <Button
                  id="btn-approve-task"
                  size="sm"
                  variant="primary"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => handleWorkflowTransition('Completed', 'approved')}
                  isLoading={isActionLoading}
                >
                  اعتماد وإكمال المهمة
                </Button>
                <Button
                  id="btn-reject-task"
                  size="sm"
                  variant="danger"
                  leftIcon={<XCircle className="w-4 h-4" />}
                  onClick={() => handleWorkflowTransition('Rejected', 'rejected')}
                  isLoading={isActionLoading}
                >
                  طلب تعديلات
                </Button>
              </>
            )}

            {/* 4. Rejected -> In Progress */}
            {task.status === 'Rejected' && canStartOrSubmit && (
              <Button
                id="btn-resume-rejected-task"
                size="sm"
                variant="primary"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={() => handleWorkflowTransition('In Progress', 'none')}
                isLoading={isActionLoading}
              >
                استئناف العمل
              </Button>
            )}

            {/* Admin Delete */}
            {canDelete && (
              confirmingDelete ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleDelete}
                    isLoading={isActionLoading}
                  >
                    تأكيد الحذف
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="حذف المهمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Task Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Assignee */}
          <div className="p-4 rounded-2xl border border-slate-200/75 bg-white">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              المسؤول عن التنفيذ
            </span>
            <div className="flex items-center gap-2.5">
              {task.assignedToPhoto ? (
                <img
                  src={task.assignedToPhoto}
                  alt={assigneeDisplayName}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-bold text-xs">
                  {assigneeDisplayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{assigneeDisplayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{task.assignedToEmail}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="p-4 rounded-2xl border border-slate-200/75 bg-white">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              الجدول الزمني والموعد
            </span>
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>البدء: </span>
                <span className="font-mono font-semibold tabular-nums">{task.startDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span>التسليم: </span>
                <span className={`font-mono font-bold tabular-nums ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                  {task.deadline}
                </span>
              </div>
            </div>
          </div>

          {/* Completion Progress */}
          <div className="p-4 rounded-2xl border border-slate-200/75 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400">
                نسبة الإنجاز
              </span>
              <span className="text-xs font-mono font-bold text-[#15803D] tabular-nums">{progressVal}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={!canModifyProgressOrAttachments}
              value={progressVal}
              onChange={e => setProgressVal(Number(e.target.value))}
              onMouseUp={handleProgressSave}
              onTouchEnd={handleProgressSave}
              onKeyUp={handleProgressSave}
              className="w-full accent-[#22C55E] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500">
            نطاق العمل والتفاصيل
          </h4>
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200/75 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              المرفقات والملفات ({task.attachments?.length || 0})
            </h4>
            {canModifyProgressOrAttachments && (
              <label className="text-xs font-semibold text-[#15803D] hover:text-emerald-800 cursor-pointer flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                رفع ملف أو مخرج
                <input type="file" multiple onChange={handleAttachmentUpload} className="hidden" />
              </label>
            )}
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {task.attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/75 bg-white text-xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-[#15803D] shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-slate-900 truncate">{att.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {Math.round(att.size / 1024)} ك.ب • رُفع بواسطة {att.uploaderName}
                      </p>
                    </div>
                  </div>
                  <a
                    href={att.url}
                    download={att.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-[#15803D] hover:bg-slate-100 rounded-full transition-colors"
                    title="تحميل الملف"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] text-center text-xs text-slate-400">
              لا توجد ملفات مرفقة بهذه المهمة بعد.
            </div>
          )}
        </div>

        {/* Comments & Discussion Section */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            الملاحظات والنقاشات ({comments.length})
          </h4>

          {/* Comments List */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto pl-1">
            {loadingComments ? (
              <div className="py-4 text-center text-xs text-slate-400">جارِ تحميل الملاحظات...</div>
            ) : comments.length > 0 ? (
              comments.map(c => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200/75 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{c.userName}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {getRoleArabicLabel(c.userRole)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {new Date(c.createdAt).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                لا توجد نقاشات بعد. أضف تعليقاً أو استفساراً أدناه.
              </div>
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              id="task-comment-input"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="اكتب ملاحظة، استفساراً، أو ملاحظات الاعتماد..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
            />
            <Button
              id="btn-post-comment"
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isSubmittingComment}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              إرسال
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
