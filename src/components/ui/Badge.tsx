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
    Urgent: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
    High: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20',
    Low: 'bg-neutral-100 text-neutral-600 border-neutral-200 ring-neutral-500/10',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md border ring-1 whitespace-nowrap ${styles[priority]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ml-1.5 ${
          priority === 'Urgent'
            ? 'bg-rose-500'
            : priority === 'High'
            ? 'bg-amber-500'
            : priority === 'Medium'
            ? 'bg-blue-500'
            : 'bg-neutral-400'
        }`}
      />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

export function StatusBadge({ status, isOverdue }: { status: TaskStatus; isOverdue?: boolean }) {
  if (isOverdue && status !== 'Completed' && status !== 'Cancelled') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-800 border border-rose-200 animate-pulse whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 ml-1.5" />
        متأخرة
      </span>
    );
  }

  const styles: Record<TaskStatus, { bg: string; text: string; dot: string; border: string }> = {
    Pending: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
      border: 'border-slate-200',
    },
    'In Progress': {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      dot: 'bg-emerald-500',
      border: 'border-emerald-200',
    },
    Review: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      border: 'border-amber-200',
    },
    Completed: {
      bg: 'bg-teal-50',
      text: 'text-teal-800',
      dot: 'bg-teal-600',
      border: 'border-teal-200',
    },
    Rejected: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      border: 'border-rose-200',
    },
    Cancelled: {
      bg: 'bg-neutral-100',
      text: 'text-neutral-500',
      dot: 'bg-neutral-400',
      border: 'border-neutral-200',
    },
  };

  const current = styles[status] || styles.Pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${current.bg} ${current.text} ${current.border}`}
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
      ? { label: 'مدير المجموعة', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
      : normalized === 'COMPANY_ADMIN'
      ? { label: 'مدير شركة', cls: 'bg-blue-50 text-blue-900 border-blue-200' }
      : normalized === 'MANAGER'
      ? { label: 'مدير عمليات', cls: 'bg-amber-50 text-amber-900 border-amber-300' }
      : { label: 'موظف', cls: 'bg-neutral-100 text-neutral-800 border-neutral-300' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border whitespace-nowrap shrink-0 ${config.cls}`}>
      {config.label}
    </span>
  );
}
