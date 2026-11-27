import React, { useState } from 'react';
import { History, Search } from 'lucide-react';
import { Card } from '../ui/Card';
import { ActivityLog } from '../../types';
import { useCompany } from '../../context/CompanyContext';
import { getRoleArabicLabel, normalizeRole } from '../../utils/rbac';

interface ActivityLogViewProps {
  activityLogs: ActivityLog[];
}

export function ActivityLogView({ activityLogs }: ActivityLogViewProps) {
  const { activeCompany, isGroupView, getCompanyById } = useCompany();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-[#16A34A]" />
            سجل النشاطات والتدقيق — {activeCompany.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل تاريخي غير قابل للتعديل لكافة الإجراءات والعمليات المنفذة داخل النظام.
          </p>
        </div>

        <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#E8F8EE] text-[#15803D] self-start sm:self-auto font-mono tabular-nums">
          تم تسجيل {activityLogs.length} حدث ونشاط
        </span>
      </div>

      <Card className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث في سجل النشاطات..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 font-medium focus:bg-white focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
        >
          <option value="All">كافة أنواع الأحداث</option>
          <option value="Company">إدارة الشركات (Companies)</option>
          <option value="Task Created">إنشاء مهمة (Task Created)</option>
          <option value="Status Changed">تحديث حالة (Status Changed)</option>
          <option value="Review">مراجعة واعتماد (Review & Approval)</option>
          <option value="Comment">الملاحظات (Comments)</option>
          <option value="Employee">شؤون الموظفين (Personnel)</option>
        </select>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F8F9FA] border-b border-slate-100 text-xs text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3.5">الوقت والتاريخ</th>
                {isGroupView && <th className="px-4 py-3.5">الشركة</th>}
                <th className="px-4 py-3.5">المنفّذ</th>
                <th className="px-4 py-3.5">الصلاحية</th>
                <th className="px-4 py-3.5">الإجراء</th>
                <th className="px-4 py-3.5">الهدف / الموضوع</th>
                <th className="px-4 py-3.5">التفاصيل والبيانات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={isGroupView ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                    <div className="space-y-2">
                      <p>لا توجد سجلات نشاط مطابقة لمعايير البحث الحالية.</p>
                      {(search.trim() || actionFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setActionFilter('All');
                          }}
                          className="text-[#15803D] hover:text-[#166534] font-semibold underline cursor-pointer"
                        >
                          إعادة ضبط الفلاتر
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                const canonical = normalizeRole(log.actorRole);
                const roleBadgeClass =
                  canonical === 'SUPER_ADMIN'
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : canonical === 'COMPANY_ADMIN'
                    ? 'bg-blue-50 text-blue-700'
                    : canonical === 'MANAGER'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-[#F1F3F5] text-slate-700';

                return (
                  <tr key={log.id} className="hover:bg-[#F8F9FA]/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(log.timestamp).toLocaleString('ar-SA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    {isGroupView && (
                      <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-nowrap">
                        {getCompanyById(log.companyId)?.name || log.companyId || 'LUMERE GROUP'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${roleBadgeClass}`}>
                        {getRoleArabicLabel(log.actorRole)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs font-medium text-slate-900 truncate">
                      {log.target}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-sm truncate">
                      {log.metadata || '—'}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
