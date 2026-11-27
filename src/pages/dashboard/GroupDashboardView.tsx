import React, { useMemo } from 'react';
import {
  Building2,
  Users,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Globe,
  BarChart3,
  History,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ActivityLog, Client, Company, Department, Project, Task, User } from '../../types';
import { computeGroupOverviewStats } from '../../utils/groupAnalytics';
import { getCompanyInitials } from '../../config/companies';

interface GroupDashboardViewProps {
  companies: Company[];
  employees: User[];
  departments: Department[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  activityLogs: ActivityLog[];
  onEnterCompany: (companyId: string) => void;
  onOpenCompaniesManagement: () => void;
  onOpenReports: () => void;
}

export function GroupDashboardView({
  companies,
  employees,
  departments,
  clients,
  projects,
  tasks,
  activityLogs,
  onEnterCompany,
  onOpenCompaniesManagement,
  onOpenReports,
}: GroupDashboardViewProps) {
  const stats = useMemo(
    () =>
      computeGroupOverviewStats({
        companies,
        users: employees,
        departments,
        clients,
        projects,
        tasks,
      }),
    [companies, employees, departments, clients, projects, tasks]
  );

  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach(c => map.set(c.id, c.name));
    return map;
  }, [companies]);

  const kpis = [
    {
      label: 'إجمالي الشركات',
      value: stats.totalCompanies,
      sub: `${stats.activeSubsidiariesCount} شركة تابعة نشطة`,
      icon: Globe,
      accent: 'text-[#16A34A] bg-[#E8F8EE]',
    },
    {
      label: 'إجمالي الموظفين',
      value: stats.totalEmployees,
      sub: `${stats.activeEmployees} موظف نشط`,
      icon: Users,
      accent: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'إجمالي المشاريع',
      value: stats.totalProjects,
      sub: `${stats.activeProjects} مشروع قيد التنفيذ`,
      icon: FolderKanban,
      accent: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'المهام النشطة',
      value: stats.activeTasks,
      sub: `${stats.completedTasks} منجزة · ${stats.overallCompletionRate}% إنجاز`,
      icon: CheckCircle2,
      accent: 'text-cyan-700 bg-cyan-50',
    },
    {
      label: 'المهام المتأخرة',
      value: stats.overdueTasks,
      sub: `من أصل ${stats.totalTasks} مهمة`,
      icon: AlertTriangle,
      accent: stats.overdueTasks > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-600 bg-[#F1F3F5]',
    },
  ];

  return (
    <div id="group-dashboard-view" className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            لوحة تحكم مجموعة LUMERE GROUP
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            نظرة تنفيذية موحدة على كافة الشركات التابعة ومؤشرات الأداء التشغيلية في الوقت الحقيقي.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
            leftIcon={<BarChart3 className="w-4 h-4" />}
            onClick={onOpenReports}
          >
            التقارير المجمعة
          </Button>
          <Button
            id="btn-manage-companies"
            size="sm"
            variant="primary"
            leftIcon={<Building2 className="w-4 h-4" />}
            onClick={onOpenCompaniesManagement}
          >
            إدارة الشركات
          </Button>
        </div>
      </div>

      {/* Group KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4 sm:p-5 rounded-2xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
                    {kpi.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${kpi.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 tabular-nums">{kpi.sub}</p>
            </Card>
          );
        })}
      </div>

      {/* Subsidiaries Performance Comparison Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">مقارنة أداء الشركات التابعة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إحصائيات مباشرة لكل شركة مع إمكانية الدخول المباشر إلى مساحة عملها الإدارية.
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {stats.byCompany.length} شركات تابعة مسجلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F8F9FA] border-b border-slate-100 text-slate-500">
              <tr>
                <th className="py-3.5 px-4 font-semibold">الشركة</th>
                <th className="py-3.5 px-3 font-semibold">القطاع</th>
                <th className="py-3.5 px-3 font-semibold text-center">الموظفون</th>
                <th className="py-3.5 px-3 font-semibold text-center">المشاريع</th>
                <th className="py-3.5 px-3 font-semibold text-center">المهام (نشط / منجز)</th>
                <th className="py-3.5 px-3 font-semibold text-center">المتأخرة</th>
                <th className="py-3.5 px-4 font-semibold">نسبة الإنجاز</th>
                <th className="py-3.5 px-4 font-semibold text-left">إدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.byCompany.map(metric => {
                const companyObj = companies.find(c => c.id === metric.companyId);
                const accent = companyObj?.theme?.primary || '#22C55E';
                return (
                  <tr
                    key={metric.companyId}
                    className="hover:bg-[#F8F9FA]/80 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {companyObj?.logo ? (
                          <img
                            src={companyObj.logo}
                            alt={metric.companyName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200/80 shrink-0"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                            style={{ backgroundColor: accent }}
                          >
                            {getCompanyInitials(metric.companyName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{metric.companyName}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {metric.companyArabicName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">{metric.businessSector}</td>
                    <td className="py-3.5 px-3 text-center font-mono tabular-nums font-semibold text-slate-900">
                      {metric.employeesCount}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono tabular-nums font-semibold text-slate-900">
                      {metric.projectsCount}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono tabular-nums">
                      <span className="text-slate-800 font-semibold">{metric.activeTasksCount}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-[#16A34A] font-semibold">{metric.completedTasksCount}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono tabular-nums">
                      <span
                        className={
                          metric.overdueTasksCount > 0
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-500'
                        }
                      >
                        {metric.overdueTasksCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${metric.completionRate}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                        <span className="font-mono tabular-nums font-bold text-slate-700 w-9 text-left">
                          {metric.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-left">
                      <button
                        type="button"
                        onClick={() => onEnterCompany(metric.companyId)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:border-[#22C55E] hover:text-[#15803D] text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>الدخول للشركة</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom Split: Per-Company Snapshot + Group Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-Company Quick Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.byCompany.map(metric => {
            const companyObj = companies.find(c => c.id === metric.companyId);
            const accent = companyObj?.theme?.primary || '#22C55E';
            return (
              <Card key={metric.companyId} hover className="p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{metric.companyName}</h3>
                    <span
                      className={`text-[11px] font-semibold ${
                        metric.status === 'active' ? 'text-[#16A34A]' : 'text-rose-600'
                      }`}
                    >
                      {metric.status === 'active' ? 'نشطة' : 'متوقفة'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {metric.businessSector}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400">الأقسام</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900">
                        {metric.departmentsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">العملاء</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900">
                        {metric.clientsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">المشاريع النشطة</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900">
                        {metric.activeProjectsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">طلبات معلقة</p>
                      <p className="font-mono tabular-nums font-bold text-amber-600">
                        {metric.pendingEmployeesCount}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEnterCompany(metric.companyId)}
                  className="w-full py-2 px-4 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  <span>إدارة {metric.companyName}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </Card>
            );
          })}
        </div>

        {/* Consolidated Recent Activity */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#16A34A]" />
              آخر أنشطة المجموعة
            </h3>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {activityLogs.slice(0, 8).length} أحداث
            </span>
          </div>

          <div className="mt-3.5 space-y-3 flex-1 overflow-y-auto max-h-[340px]">
            {activityLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <Clock className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                لا توجد أنشطة مسجلة حتى الآن.
              </div>
            ) : (
              activityLogs.slice(0, 8).map(log => (
                <div
                  key={log.id}
                  className="pb-3 border-b border-slate-100 last:border-0 last:pb-0 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 truncate">{log.actorName}</span>
                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                      {companyNameMap.get(log.companyId || '') || log.companyId || 'LUMERE'}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 truncate">
                    {log.action} · <span className="font-medium text-slate-800">{log.target}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    {new Date(log.timestamp).toLocaleDateString('ar-SA', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
