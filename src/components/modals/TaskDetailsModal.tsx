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
import { DataService } from '../../services/dataService';
import { DEFAULT_SUBSIDIARY_ID } from '../../config/companies';
import { canApproveTasks, canDeleteTask, getRoleArabicLabel } from '../../utils/rbac';

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
  const [progressVal, setProgressVal] = useState(task?.completionPercentage || 0);

  // Sync progress if task changes
  useEffect(() => {
    if (task) {
      setProgressVal(task.completionPercentage || 0);
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

  const nowStr = new Date().toISOString().split('T')[0];
  const isOverdue =
    task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';

  // Permission flags (4-tier company-scoped RBAC)
  const taskCompanyId = task.companyId || DEFAULT_SUBSIDIARY_ID;
  const taskCompany = getCompanyById(taskCompanyId);
  const isAssignee = currentUser?.id === task.assignedTo;
  const canApproveOrReject = canApproveTasks(currentUser, taskCompanyId);
  const canDelete = canDeleteTask(currentUser, taskCompanyId);
  const canStartOrSubmit = isAssignee || canApproveOrReject;

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
    if (!currentUser) return;
    setIsActionLoading(true);
    try {
      await DataService.updateTask(task.id, { completionPercentage: progressVal }, currentUser);
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
    if (!window.confirm(`هل أنت متأكد من حذف المهمة ${task.taskId} نهائياً؟`)) return;

    setIsActionLoading(true);
    try {
      await DataService.deleteTask(task.id, task.title, currentUser, taskCompanyId);
      showToast(`تم حذف المهمة ${task.taskId}`, 'info');
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
    if (!files || files.length === 0 || !currentUser) return;

    const newAttachments: TaskAttachment[] = [...(task.attachments || [])];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileUrl = URL.createObjectURL(file);
      try {
        fileUrl = await DataService.uploadTaskAttachment(taskCompanyId, task.id, file);
      } catch {
        // Fallback if Firebase Storage rules are not yet deployed
      }
      newAttachments.push({
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

    try {
      await DataService.updateTask(task.id, { attachments: newAttachments }, currentUser);
      onTaskUpdated({ ...task, attachments: newAttachments });
      showToast('تم رفع المرفق بنجاح', 'success');
    } catch {
      showToast('تعذر رفع الملف', 'error');
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
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-xs">
            {task.projectName && (
              <span className="flex items-center gap-1.5 font-bold text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                <FolderKanban className="w-3.5 h-3.5 text-emerald-700" />
                المشروع: {task.projectName}
              </span>
            )}
            {task.clientName && (
              <span className="flex items-center gap-1.5 font-bold text-neutral-800 bg-white px-2.5 py-1 rounded-lg border border-neutral-200 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-neutral-600" />
                العميل: {task.clientName}
              </span>
            )}
          </div>
        )}

        {/* Status & Action Banner */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="حذف المهمة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Task Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Assignee */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-white">
            <span className="text-[11px] font-semibold text-neutral-400 block mb-1.5">
              المسؤول عن التنفيذ
            </span>
            <div className="flex items-center gap-2.5">
              {task.assignedToPhoto ? (
                <img
                  src={task.assignedToPhoto}
                  alt={task.assignedToName}
                  className="w-8 h-8 rounded-full object-cover border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  {task.assignedToName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-900 truncate">{task.assignedToName}</p>
                <p className="text-[10px] text-neutral-500 truncate">{task.assignedToEmail}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-white">
            <span className="text-[11px] font-semibold text-neutral-400 block mb-1.5">
              الجدول الزمني والموعد
            </span>
            <div className="space-y-1 text-xs text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>البدء: </span>
                <span className="font-mono font-semibold">{task.startDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-500" />
                <span>التسليم: </span>
                <span className={`font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-neutral-900'}`}>
                  {task.deadline}
                </span>
              </div>
            </div>
          </div>

          {/* Completion Progress */}
          <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-neutral-400">
                نسبة الإنجاز
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700">{progressVal}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={task.status === 'Completed'}
              value={progressVal}
              onChange={e => setProgressVal(Number(e.target.value))}
              onMouseUp={handleProgressSave}
              onTouchEnd={handleProgressSave}
              className="w-full accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-neutral-500">
            نطاق العمل والتفاصيل
          </h4>
          <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-neutral-400" />
              المرفقات والملفات ({task.attachments?.length || 0})
            </h4>
            <label className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              رفع ملف أو مخرج
              <input type="file" multiple onChange={handleAttachmentUpload} className="hidden" />
            </label>
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {task.attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200 bg-white text-xs hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-neutral-900 truncate">{att.name}</p>
                      <p className="text-[10px] text-neutral-400">
                        {Math.round(att.size / 1024)} ك.ب • رُفع بواسطة {att.uploaderName}
                      </p>
                    </div>
                  </div>
                  <a
                    href={att.url}
                    download={att.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-neutral-500 hover:text-emerald-700 hover:bg-neutral-100 rounded-lg transition-colors"
                    title="تحميل الملف"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
              لا توجد ملفات مرفقة بهذه المهمة بعد.
            </div>
          )}
        </div>

        {/* Comments & Discussion Section */}
        <div className="space-y-3 pt-2 border-t border-neutral-100">
          <h4 className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
            الملاحظات والنقاشات ({comments.length})
          </h4>

          {/* Comments List */}
          <div className="space-y-3 max-h-60 overflow-y-auto pl-1">
            {loadingComments ? (
              <div className="py-4 text-center text-xs text-neutral-400">جارِ تحميل الملاحظات...</div>
            ) : comments.length > 0 ? (
              comments.map(c => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900">{c.userName}</span>
                      <span className="text-[10px] text-neutral-400 font-semibold">
                        {getRoleArabicLabel(c.userRole)}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(c.createdAt).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-neutral-400">
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
              className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
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
