import React from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Hourglass,
  ArrowUpLeft,
  ChevronLeft,
  TrendingUp,
  Activity,
  Plus,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Task, User, Department, ActivityLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import {
  canCreateTask,
  canViewActivityLogs,
  canViewReports,
  getRoleArabicLabel,
  isActiveStatus,
  scopeDepartmentsForUser,
  scopeEmployeesForUser,
  scopeTasksForUser,
} from '../../utils/rbac';

interface DashboardViewProps {
  tasks: Task[];
  employees: User[];
  departments: Department[];
  activityLogs: ActivityLog[];
  onSelectTask: (taskId: string) => void;
  onOpenCreateTask: () => void;
  onNavigateToTab: (tab: 'tasks' | 'employees' | 'reports' | 'activity' | 'departments') => void;
}

export function DashboardView({
  tasks,
  employees,
  departments,
  activityLogs,
  onSelectTask,
  onOpenCreateTask,
  onNavigateToTab,
}: DashboardViewProps) {
  const { role, currentUser, isSuperAdmin, isCompanyAdmin, isManager } = useAuth();
  const { activeCompany, defaultWriteCompanyId, isGroupView } = useCompany();
  const isSupervisor = isSuperAdmin || isCompanyAdmin || isManager;
  const allowCreateTask = canCreateTask(currentUser, defaultWriteCompanyId);
  const allowReports = canViewReports(currentUser, defaultWriteCompanyId);
  const allowActivity = canViewActivityLogs(currentUser, defaultWriteCompanyId);

  // Scope tasks, team members, and departments strictly by canonical role
  const relevantTasks = scopeTasksForUser(currentUser, tasks, employees);
  const relevantEmployees = scopeEmployeesForUser(currentUser, employees);
  const relevantDepartments = scopeDepartmentsForUser(currentUser, departments);

  // Metric calculations
  const totalEmployees = relevantEmployees.length;
  const activeEmployees = relevantEmployees.filter(e => isActiveStatus(e.status)).length;

  const totalTasks = relevantTasks.length;
  const pendingTasks = relevantTasks.filter(t => t.status === 'Pending').length;
  const inProgressTasks = relevantTasks.filter(t => t.status === 'In Progress').length;
  const reviewTasks = relevantTasks.filter(t => t.status === 'Review').length;
  const completedTasks = relevantTasks.filter(t => t.status === 'Completed').length;

  const nowStr = new Date().toISOString().split('T')[0];
  const overdueTasksList = relevantTasks.filter(
    t => t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
  );
  const overdueCount = overdueTasksList.length;

  const upcomingEmployeeTasks = relevantTasks
    .filter(t => t.status !== 'Completed' && t.status !== 'Cancelled')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Priority breakdown
  const priorityCounts = {
    Urgent: relevantTasks.filter(t => t.priority === 'Urgent').length,
    High: relevantTasks.filter(t => t.priority === 'High').length,
    Medium: relevantTasks.filter(t => t.priority === 'Medium').length,
    Low: relevantTasks.filter(t => t.priority === 'Low').length,
  };

  const dashboardRoleBadge =
    role === 'SUPER_ADMIN'
      ? isGroupView
        ? `${activeCompany.name} • عرض المجموعة`
        : `${activeCompany.name} • لوحة الشركة`
      : role === 'COMPANY_ADMIN'
      ? `${activeCompany.name} • لوحة تحكم الشركة`
      : role === 'MANAGER'
      ? `${currentUser?.department || activeCompany.name} • إدارة القسم`
      : `${activeCompany.name} • لوحة الموظف`;

  const dashboardSubtitle =
    role === 'MANAGER'
      ? `لوحة متابعة قسم ${currentUser?.department || activeCompany.name} — متابعة فريق القسم والمهام التنفيذية ومؤشرات الإنجاز.`
      : isSupervisor
      ? `لوحة الرقابة التشغيلية لـ ${activeCompany.name} — متابعة الموظفين والمشاريع والمهام ومؤشرات الأداء اللحظية.`
      : 'لوحة الموظف الشخصية — متابعة مهامك المسندة، نسب الإنجاز، مواعيد التسليم، وإرسال المخرجات للاعتماد.';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Light Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-medium">
            <span className="font-semibold text-slate-500">{dashboardRoleBadge}</span>
            <span aria-hidden="true">•</span>
            <span>
              {new Date().toLocaleDateString('ar-SA', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 font-sans">
            أهلاً، {currentUser?.displayName}
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
            {dashboardSubtitle}
          </p>
        </div>

        {(allowCreateTask || isManager) && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {isManager && (
              <Button
                id="btn-go-department-management"
                onClick={() => onNavigateToTab('departments')}
                variant="outline"
                className="bg-[#E8F8EE] hover:bg-[#DCFCE7] text-[#15803D] border-transparent"
              >
                إدارة القسم
              </Button>
            )}
            {allowCreateTask && (
              <Button
                id="btn-quick-create-task"
                onClick={onOpenCreateTask}
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                إنشاء مهمة جديدة
              </Button>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <Card className="p-4 rounded-2xl border-r-[3px] border-r-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              إجمالي المهام
            </span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalTasks}</span>
            <span className="text-[11px] text-slate-400">مهمة نشطة</span>
          </div>
        </Card>

        {/* In Progress */}
        <Card className="p-4 rounded-2xl border-r-[3px] border-r-[#22C55E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              قيد التنفيذ
            </span>
            <span className="w-8 h-8 rounded-xl bg-[#E8F8EE] text-[#15803D] flex items-center justify-center">
              <Hourglass className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{inProgressTasks}</span>
            <span className="text-[11px] text-[#15803D] font-semibold">جارية</span>
          </div>
        </Card>

        {/* Waiting for Review */}
        <Card className="p-4 rounded-2xl border-r-[3px] border-r-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              بانتظار المراجعة
            </span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{reviewTasks}</span>
            <span className="text-[11px] text-amber-600 font-semibold">للاعتماد</span>
          </div>
        </Card>

        {/* Completed */}
        <Card className="p-4 rounded-2xl border-r-[3px] border-r-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              المكتملة
            </span>
            <span className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{completedTasks}</span>
            <span className="text-[11px] text-cyan-700 font-semibold tabular-nums">{completionRate}% نسبة الإنجاز</span>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="p-4 rounded-2xl border-r-[3px] border-r-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              تجاوزت الموعد
            </span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600 tabular-nums">{overdueCount}</span>
            <span className="text-[11px] text-rose-600 font-semibold">تحتاج تدخلاً</span>
          </div>
        </Card>

        {/* Total Employees (or Pending for Employee) */}
        {isSupervisor ? (
          <Card className="p-4 rounded-2xl border-r-[3px] border-r-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                فريق العمل
              </span>
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{activeEmployees}</span>
              <span className="text-[11px] text-slate-400 tabular-nums">/ {totalEmployees} موظف</span>
            </div>
          </Card>
        ) : (
          <Card className="p-4 rounded-2xl border-r-[3px] border-r-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                قيد الانتظار
              </span>
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{pendingTasks}</span>
              <span className="text-[11px] text-slate-400">لم تبدأ بعد</span>
            </div>
          </Card>
        )}
      </div>

      {/* Actionable Overdue Alert */}
      {overdueCount > 0 && (
        <div className="rounded-3xl bg-rose-50/75 border border-rose-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                يوجد {overdueCount} {overdueCount === 1 ? 'مهمة تجاوزت' : 'مهام تجاوزت'} موعد التسليم المحدد
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                يرجى مراجعة المعوقات وإعطاء أولوية قصوى لإنجاز هذه المهام.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {overdueTasksList.slice(0, 2).map(ot => (
              <button
                key={ot.id}
                onClick={() => onSelectTask(ot.id)}
                className="text-xs font-mono font-bold bg-white text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full hover:bg-rose-100/60 transition-colors truncate max-w-[150px] cursor-pointer"
              >
                {ot.taskId}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateToTab('tasks')}
              className="bg-rose-100/80 hover:bg-rose-200/70 text-rose-800 border-transparent"
            >
              عرض المهام المتأخرة
            </Button>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Tasks by Status */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">توزيع حالات المهام</h3>
              <p className="text-xs text-slate-400">حالة تدفق العمل اللحظي</p>
            </div>
            <span className="text-xs font-mono font-bold text-[#15803D] bg-[#E8F8EE] px-2.5 py-0.5 rounded-full tabular-nums">
              {completionRate}% منجز
            </span>
          </div>

          <div className="space-y-3">
            {/* Progress Stack Bar */}
            <div className="h-2.5 w-full bg-[#F1F3F5] rounded-full overflow-hidden flex">
              <div
                style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                className="bg-cyan-500 h-full"
                title={`مكتمل: ${completedTasks}`}
              />
              <div
                style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%` }}
                className="bg-[#22C55E] h-full"
                title={`قيد التنفيذ: ${inProgressTasks}`}
              />
              <div
                style={{ width: `${totalTasks > 0 ? (reviewTasks / totalTasks) * 100 : 0}%` }}
                className="bg-amber-500 h-full"
                title={`مراجعة: ${reviewTasks}`}
              />
              <div
                style={{ width: `${totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0}%` }}
                className="bg-slate-400 h-full"
                title={`قيد الانتظار: ${pendingTasks}`}
              />
            </div>

            {/* Legend with counts */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-cyan-50/60 border border-cyan-100">
                <span className="flex items-center gap-1.5 text-cyan-900 font-medium">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" /> مكتمل
                </span>
                <span className="font-bold text-cyan-950 tabular-nums">{completedTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#E8F8EE]/60 border border-emerald-100">
                <span className="flex items-center gap-1.5 text-[#14532D] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> قيد التنفيذ
                </span>
                <span className="font-bold text-[#14532D] tabular-nums">{inProgressTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/60 border border-amber-100">
                <span className="flex items-center gap-1.5 text-amber-900 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> مراجعة
                </span>
                <span className="font-bold text-amber-950 tabular-nums">{reviewTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200/75">
                <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> انتظار
                </span>
                <span className="font-bold text-slate-900 tabular-nums">{pendingTasks}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Chart 2: Priority Spectrum */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">مستويات الأولوية</h3>
              <p className="text-xs text-slate-400">توزيع درجة الأهمية والاستعجال</p>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full tabular-nums">
              {priorityCounts.Urgent} عاجلة
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'عاجلة جداً (Urgent)', count: priorityCounts.Urgent, color: 'bg-rose-500', bar: 'bg-rose-500' },
              { label: 'عالية (High)', count: priorityCounts.High, color: 'bg-amber-500', bar: 'bg-amber-500' },
              { label: 'متوسطة (Medium)', count: priorityCounts.Medium, color: 'bg-blue-500', bar: 'bg-blue-500' },
              { label: 'منخفضة (Low)', count: priorityCounts.Low, color: 'bg-slate-400', bar: 'bg-slate-400' },
            ].map(item => {
              const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-500 tabular-nums">
                      {item.count} مهمة ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#F1F3F5] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Chart 3: Department Performance (Supervisors) OR Upcoming Deadlines (Employee) */}
        {allowReports ? (
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isManager ? 'أداء القسم' : 'إنتاجية الأقسام'}
                </h3>
                <p className="text-xs text-slate-400">معدل الإنجاز لكل إدارة</p>
              </div>
              <button
                onClick={() => onNavigateToTab('reports')}
                className="text-xs text-[#15803D] hover:text-emerald-800 font-semibold cursor-pointer"
              >
                التفاصيل
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pl-1">
              {relevantDepartments.slice(0, 5).map(dept => {
                const deptTasks = relevantTasks.filter(t => t.department === dept.name);
                const deptCompleted = deptTasks.filter(t => t.status === 'Completed').length;
                const rate = deptTasks.length > 0 ? Math.round((deptCompleted / deptTasks.length) * 100) : 0;

                return (
                  <div key={dept.id} className="p-3 rounded-2xl border border-slate-100 bg-[#F8F9FA] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color || '#22C55E' }}
                        />
                        <span className="text-xs font-bold text-slate-800">{dept.name}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                        {deptCompleted}/{deptTasks.length} ({rate}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] rounded-full"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">مواعيد التسليم القادمة</h3>
                <p className="text-xs text-slate-400">أقرب مهامك المسندة</p>
              </div>
              <button
                onClick={() => onNavigateToTab('tasks')}
                className="text-xs text-[#15803D] hover:text-emerald-800 font-semibold cursor-pointer"
              >
                كل مهامي
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pl-1">
              {upcomingEmployeeTasks.length > 0 ? (
                upcomingEmployeeTasks.map(task => {
                  const isOverdue = task.deadline < nowStr;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className="w-full text-right p-3 rounded-2xl border border-slate-100 bg-[#F8F9FA] hover:bg-[#E8F8EE]/60 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{task.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{task.taskId}</p>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold shrink-0 tabular-nums ${
                          isOverdue ? 'text-rose-600' : 'text-slate-600'
                        }`}
                      >
                        {task.deadline}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  لا توجد مهام نشطة قريبة الموعد حالياً
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Bottom Grid: Recent Tasks & Recent Activity (Activity hidden for Employee) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className={`${allowActivity ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {role === 'EMPLOYEE'
                  ? 'أحدث مهامي التنفيذية'
                  : isManager
                  ? 'أحدث مهام القسم'
                  : 'أحدث المهام التنفيذية'}
              </h3>
              <p className="text-xs text-slate-400">آخر التكليفات والمخرجات المرفوعة</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => onNavigateToTab('tasks')}
              className="text-[#15803D] hover:bg-[#E8F8EE]"
            >
              عرض كافة المهام
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-[#F8F9FA] border-b border-slate-100 text-xs text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">رمز وعنوان المهمة</th>
                    <th className="px-4 py-3.5">المكلف</th>
                    <th className="px-4 py-3.5">الأولوية</th>
                    <th className="px-4 py-3.5">الحالة</th>
                    <th className="px-4 py-3.5">الموعد النهائي</th>
                    <th className="px-4 py-3.5 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relevantTasks.slice(0, 5).map(task => {
                    const isOverdue =
                      task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => onSelectTask(task.id)}
                      >
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#15803D] bg-[#E8F8EE] px-2 py-0.5 rounded-lg shrink-0">
                              {task.taskId}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {task.department} {task.projectName ? `• ${task.projectName}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {task.assignedToPhoto ? (
                              <img
                                src={task.assignedToPhoto}
                                alt={task.assignedToName}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] flex items-center justify-center font-bold">
                                {task.assignedToName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[110px]">
                              {task.assignedToName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={task.status} isOverdue={isOverdue} />
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 font-mono tabular-nums">
                          {task.deadline}
                        </td>
                        <td className="px-4 py-3.5 text-left">
                          <span className="inline-flex p-1.5 rounded-full text-slate-400 group-hover:text-[#15803D] group-hover:bg-[#E8F8EE] transition-colors">
                            <ArrowUpLeft className="w-4 h-4" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Live Recent Activity Feed (Supervisors Only) */}
        {allowActivity && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">سجل العمليات المباشر</h3>
                <p className="text-xs text-slate-400">التحديثات والأنشطة اللحظية</p>
              </div>
              <button
                onClick={() => onNavigateToTab('activity')}
                className="text-xs font-semibold text-[#15803D] hover:text-emerald-800 cursor-pointer"
              >
                كامل السجل
              </button>
            </div>

            <Card className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
              {activityLogs.length > 0 ? (
                activityLogs.slice(0, 7).map((log, idx) => (
                  <div key={log.id || idx} className="flex gap-3 text-xs">
                    <div className="w-8 h-8 rounded-full bg-[#F1F3F5] flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 leading-relaxed">
                        <span className="font-bold text-slate-900">{log.actorName}</span>{' '}
                        <span className="text-slate-400 font-normal">
                          ({getRoleArabicLabel(log.actorRole)})
                        </span>{' '}
                        قام بـ {log.action}:{' '}
                        <span className="font-semibold text-slate-900 truncate">
                          &quot;{log.target}&quot;
                        </span>
                      </p>
                      {log.metadata && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.metadata}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 font-mono tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد عمليات مسجلة حتى الآن
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
