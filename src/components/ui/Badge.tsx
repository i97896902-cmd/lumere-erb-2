import React from 'react';
import { TaskPriority, TaskStatus } from '../../types';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  Urgent: 'عاجلة',
  High: 'عالية',
  Medium: 'متوسطة',
  Low: 'منخفضة',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  Pending: 'قيد الانتظار',
  'In Progress': 'قيد التنفيذ',
  Review: 'بانتظار الاعتماد',
  Completed: 'مكتملة',
  Rejected: 'تحتاج تعديل',
  Cancelled: 'ملغاة',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    Urgent: 'bg-rose-50 text-rose-700 border-rose-200/70',
    High: 'bg-amber-50 text-amber-700 border-amber-200/70',
    Medium: 'bg-sky-50 text-sky-700 border-sky-200/70',
    Low: 'bg-slate-100 text-slate-600 border-slate-200/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${styles[priority]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ml-1.5 ${
          priority === 'Urgent'
            ? 'bg-rose-500'
            : priority === 'High'
            ? 'bg-amber-500'
            : priority === 'Medium'
            ? 'bg-sky-500'
            : 'bg-slate-400'
        }`}
      />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

export function StatusBadge({ status, isOverdue }: { status: TaskStatus; isOverdue?: boolean }) {
  if (isOverdue && status !== 'Completed' && status !== 'Cancelled') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1.5" />
        متأخرة
      </span>
    );
  }

  const styles: Record<TaskStatus, { bg: string; text: string; dot: string; border: string }> = {
    Pending: {
      bg: 'bg-slate-100/80',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
      border: 'border-slate-200/80',
    },
    'In Progress': {
      bg: 'bg-[#E8F8EE]',
      text: 'text-[#15803D]',
      dot: 'bg-[#22C55E]',
      border: 'border-emerald-200/60',
    },
    Review: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      border: 'border-amber-200/70',
    },
    Completed: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-700',
      dot: 'bg-cyan-500',
      border: 'border-cyan-200/70',
    },
    Rejected: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      border: 'border-rose-200/70',
    },
    Cancelled: {
      bg: 'bg-slate-100',
      text: 'text-slate-500',
      dot: 'bg-slate-400',
      border: 'border-slate-200',
    },
  };

  const current = styles[status] || styles.Pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${current.bg} ${current.text} ${current.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ml-1.5 ${current.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const normalized = role === 'ADMIN' ? 'SUPER_ADMIN' : role;
  const config =
    normalized === 'SUPER_ADMIN'
      ? { label: 'مدير المجموعة', cls: 'bg-[#E8F8EE] text-[#15803D] border-emerald-200/60' }
      : normalized === 'COMPANY_ADMIN'
      ? { label: 'مدير شركة', cls: 'bg-sky-50 text-sky-700 border-sky-200/70' }
      : normalized === 'MANAGER'
      ? { label: 'مدير عمليات', cls: 'bg-amber-50 text-amber-700 border-amber-200/70' }
      : { label: 'موظف', cls: 'bg-slate-100 text-slate-700 border-slate-200/80' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap shrink-0 ${config.cls}`}>
      {config.label}
    </span>
  );
}
