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
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-6 text-white border border-neutral-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {dashboardRoleBadge}
              </span>
              <span className="text-xs text-neutral-400">
                {new Date().toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white font-sans">
              أهلاً بعودتك، {currentUser?.displayName}
            </h1>
            <p className="mt-1 text-xs text-neutral-300 max-w-xl leading-relaxed">
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
                  className="bg-white/10 hover:bg-white/15 text-white border-white/20"
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold border-emerald-400"
                >
                  إنشاء مهمة جديدة
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Decorative subtle ambient glow */}
        <div className="absolute top-0 left-0 -ml-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 -mb-16 w-48 h-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <Card className="p-4 border-r-4 border-r-neutral-900 border-l-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              إجمالي المهام
            </span>
            <span className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">{totalTasks}</span>
            <span className="text-[11px] text-neutral-400">مهمة نشطة</span>
          </div>
        </Card>

        {/* In Progress */}
        <Card className="p-4 border-r-4 border-r-emerald-500 border-l-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              قيد التنفيذ
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Hourglass className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-900">{inProgressTasks}</span>
            <span className="text-[11px] text-emerald-700 font-medium">جارية</span>
          </div>
        </Card>

        {/* Waiting for Review */}
        <Card className="p-4 border-r-4 border-r-amber-500 border-l-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              بانتظار المراجعة
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-900">{reviewTasks}</span>
            <span className="text-[11px] text-amber-700 font-medium">للاعتماد</span>
          </div>
        </Card>

        {/* Completed */}
        <Card className="p-4 border-r-4 border-r-teal-600 border-l-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              المكتملة
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-900">{completedTasks}</span>
            <span className="text-[11px] text-teal-700 font-medium">{completionRate}% نسبة الإنجاز</span>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="p-4 border-r-4 border-r-rose-500 border-l-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">
              تجاوزت الموعد
            </span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{overdueCount}</span>
            <span className="text-[11px] text-rose-600 font-medium">تحتاج تدخلاً</span>
          </div>
        </Card>

        {/* Total Employees (or Pending for Employee) */}
        {isSupervisor ? (
          <Card className="p-4 border-r-4 border-r-blue-500 border-l-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">
                فريق العمل
              </span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-900">{activeEmployees}</span>
              <span className="text-[11px] text-neutral-400">/ {totalEmployees} موظف</span>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-r-4 border-r-slate-400 border-l-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">
                قيد الانتظار
              </span>
              <span className="p-1.5 rounded-lg bg-slate-50 text-slate-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800">{pendingTasks}</span>
              <span className="text-[11px] text-neutral-400">لم تبدأ بعد</span>
            </div>
          </Card>
        )}
      </div>

      {/* Actionable Overdue Alert */}
      {overdueCount > 0 && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                يوجد {overdueCount} {overdueCount === 1 ? 'مهمة تجاوزت' : 'مهام تجاوزت'} موعد التسليم المحدد
              </h4>
              <p className="text-xs text-rose-700">
                يرجى مراجعة المعوقات وإعطاء أولوية قصوى لإنجاز هذه المهام.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overdueTasksList.slice(0, 2).map(ot => (
              <button
                key={ot.id}
                onClick={() => onSelectTask(ot.id)}
                className="text-xs font-semibold bg-white text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100/60 transition-colors truncate max-w-[150px]"
              >
                {ot.taskId}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateToTab('tasks')}
              className="text-rose-900 border-rose-300"
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
              <h3 className="text-sm font-bold text-neutral-900">توزيع حالات المهام</h3>
              <p className="text-xs text-neutral-500">حالة تدفق العمل اللحظي</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {completionRate}% منجز
            </span>
          </div>

          <div className="space-y-3">
            {/* Progress Stack Bar */}
            <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                className="bg-teal-600 h-full"
                title={`مكتمل: ${completedTasks}`}
              />
              <div
                style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%` }}
                className="bg-emerald-500 h-full"
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
              <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50/50 border border-teal-100">
                <span className="flex items-center gap-1.5 text-teal-900 font-medium">
                  <span className="w-2 h-2 rounded-full bg-teal-600" /> مكتمل
                </span>
                <span className="font-bold text-teal-950">{completedTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <span className="flex items-center gap-1.5 text-emerald-900 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> قيد التنفيذ
                </span>
                <span className="font-bold text-emerald-950">{inProgressTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                <span className="flex items-center gap-1.5 text-amber-900 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> مراجعة
                </span>
                <span className="font-bold text-amber-950">{reviewTasks}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex items-center gap-1.5 text-slate-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> انتظار
                </span>
                <span className="font-bold text-slate-900">{pendingTasks}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Chart 2: Priority Spectrum */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">مستويات الأولوية</h3>
              <p className="text-xs text-neutral-500">توزيع درجة الأهمية والاستعجال</p>
            </div>
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {priorityCounts.Urgent} عاجلة
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'عاجلة جداً (Urgent)', count: priorityCounts.Urgent, color: 'bg-rose-500', bar: 'bg-rose-500' },
              { label: 'عالية (High)', count: priorityCounts.High, color: 'bg-amber-500', bar: 'bg-amber-500' },
              { label: 'متوسطة (Medium)', count: priorityCounts.Medium, color: 'bg-blue-500', bar: 'bg-blue-500' },
              { label: 'منخفضة (Low)', count: priorityCounts.Low, color: 'bg-neutral-400', bar: 'bg-neutral-400' },
            ].map(item => {
              const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-neutral-700">{item.label}</span>
                    <span className="text-neutral-500">
                      {item.count} مهمة ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
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
                <h3 className="text-sm font-bold text-neutral-900">
                  {isManager ? 'أداء القسم' : 'إنتاجية الأقسام'}
                </h3>
                <p className="text-xs text-neutral-500">معدل الإنجاز لكل إدارة</p>
              </div>
              <button
                onClick={() => onNavigateToTab('reports')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
              >
                التفاصيل
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pl-1">
              {relevantDepartments.slice(0, 5).map(dept => {
                const deptTasks = relevantTasks.filter(t => t.department === dept.name);
                const deptCompleted = deptTasks.filter(t => t.status === 'Completed').length;
                const rate = deptTasks.length > 0 ? Math.round((deptCompleted / deptTasks.length) * 100) : 0;

                return (
                  <div key={dept.id} className="p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color || '#059669' }}
                        />
                        <span className="text-xs font-bold text-neutral-800">{dept.name}</span>
                      </div>
                      <span className="text-xs font-mono font-semibold text-neutral-700">
                        {deptCompleted}/{deptTasks.length} ({rate}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
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
                <h3 className="text-sm font-bold text-neutral-900">مواعيد التسليم القادمة</h3>
                <p className="text-xs text-neutral-500">أقرب مهامك المسندة</p>
              </div>
              <button
                onClick={() => onNavigateToTab('tasks')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
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
                      className="w-full text-right p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/60 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">{task.title}</p>
                        <p className="text-[11px] text-neutral-500 truncate">{task.taskId}</p>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold shrink-0 ${
                          isOverdue ? 'text-rose-600' : 'text-neutral-600'
                        }`}
                      >
                        {task.deadline}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-neutral-400">
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
              <h3 className="text-base font-bold text-neutral-900">
                {role === 'EMPLOYEE'
                  ? 'أحدث مهامي التنفيذية'
                  : isManager
                  ? 'أحدث مهام القسم'
                  : 'أحدث المهام التنفيذية'}
              </h3>
              <p className="text-xs text-neutral-500">آخر التكليفات والمخرجات المرفوعة</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => onNavigateToTab('tasks')}
            >
              عرض كافة المهام
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-neutral-50/80 border-b border-neutral-100 text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">رمز وعنوان المهمة</th>
                    <th className="px-4 py-3">المكلف</th>
                    <th className="px-4 py-3">الأولوية</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3">الموعد النهائي</th>
                    <th className="px-4 py-3 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {relevantTasks.slice(0, 5).map(task => {
                    const isOverdue =
                      task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-neutral-50/80 transition-colors group cursor-pointer"
                        onClick={() => onSelectTask(task.id)}
                      >
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded">
                              {task.taskId}
                            </span>
                            <span className="font-medium text-neutral-900 truncate">
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400 mt-0.5 block">
                            {task.department} {task.projectName ? `• ${task.projectName}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {task.assignedToPhoto ? (
                              <img
                                src={task.assignedToPhoto}
                                alt={task.assignedToName}
                                className="w-6 h-6 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                                {task.assignedToName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-neutral-700 font-medium truncate max-w-[110px]">
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
                        <td className="px-4 py-3.5 text-xs text-neutral-600 font-mono">
                          {task.deadline}
                        </td>
                        <td className="px-4 py-3.5 text-left">
                          <span className="inline-flex p-1 text-neutral-400 group-hover:text-emerald-700 transition-colors">
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
                <h3 className="text-base font-bold text-neutral-900">سجل العمليات المباشر</h3>
                <p className="text-xs text-neutral-500">التحديثات والأنشطة اللحظية</p>
              </div>
              <button
                onClick={() => onNavigateToTab('activity')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                كامل السجل
              </button>
            </div>

            <Card className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
              {activityLogs.length > 0 ? (
                activityLogs.slice(0, 7).map((log, idx) => (
                  <div key={log.id || idx} className="flex gap-3 text-xs">
                    <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0 mt-0.5">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-800">
                        <span className="font-bold text-neutral-900">{log.actorName}</span>{' '}
                        <span className="text-neutral-500 font-normal">
                          ({getRoleArabicLabel(log.actorRole)})
                        </span>{' '}
                        قام بـ {log.action}:{' '}
                        <span className="font-semibold text-neutral-800 truncate">
                          &quot;{log.target}&quot;
                        </span>
                      </p>
                      {log.metadata && (
                        <p className="text-[11px] text-neutral-500 mt-0.5">{log.metadata}</p>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-1 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-neutral-400 text-xs">
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
