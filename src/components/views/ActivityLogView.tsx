import React, { useState } from 'react';
import { History, Search, Filter, ShieldCheck, Clock, User } from 'lucide-react';
import { Card } from '../ui/Card';
import { ActivityLog } from '../../types';

interface ActivityLogViewProps {
  activityLogs: ActivityLog[];
}

export function ActivityLogView({ activityLogs }: ActivityLogViewProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const filteredLogs = activityLogs.filter(log => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        (log.metadata && log.metadata.toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (actionFilter !== 'All' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            سجل النشاطات وعمليات التدقيق والرقابة
          </h2>
          <p className="text-xs text-neutral-500">
            سجل تاريخي غير قابل للتعديل لكافة الإجراءات والعمليات المنفذة في نظام Luméré.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto font-mono">
          تم تسجيل {activityLogs.length} حدث ونشاط
        </span>
      </div>

      {/* Filter Bar */}
      <Card className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث في سجل النشاطات..."
            className="w-full pr-9 pl-3.5 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="All">كافة أنواع الأحداث</option>
          <option value="Task Created">إنشاء مهمة (Task Created)</option>
          <option value="Status Changed">تحديث حالة (Status Changed)</option>
          <option value="Review">مراجعة واعتماد (Review & Approval)</option>
          <option value="Comment">الملاحظات (Comments)</option>
          <option value="Employee">شؤون الموظفين (Personnel)</option>
        </select>
      </Card>

      {/* Activity Timeline List */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-neutral-50/80 border-b border-neutral-100 text-xs text-neutral-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">الوقت والتاريخ</th>
                <th className="px-4 py-3">المنفّذ</th>
                <th className="px-4 py-3">الصلاحية</th>
                <th className="px-4 py-3">الإجراء</th>
                <th className="px-4 py-3">الهدف / الموضوع</th>
                <th className="px-4 py-3">التفاصيل والبيانات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-neutral-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('ar-SA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap">
                    {log.actorName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.actorRole === 'ADMIN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {log.actorRole === 'ADMIN' ? 'مدير عام' : 'موظف'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-neutral-800 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 max-w-xs font-medium text-neutral-900 truncate">
                    {log.target}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 max-w-sm truncate">
                    {log.metadata || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
