import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { Card, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { Task, User, Department, TaskPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { canCreateTask, scopeTasksForUser } from '../../utils/rbac';
import { formatLocalDate } from '../../utils/sanitize';

interface TasksViewProps {
  tasks: Task[];
  employees: User[];
  departments: Department[];
  onSelectTask: (taskId: string) => void;
  onOpenCreateTask: () => void;
  initialSearchQuery?: string;
}

export function TasksView({
  tasks,
  employees,
  departments,
  onSelectTask,
  onOpenCreateTask,
  initialSearchQuery = '',
}: TasksViewProps) {
  const { role, currentUser } = useAuth();
  const { activeCompany, isGroupView, defaultWriteCompanyId, getCompanyById } = useCompany();
  const allowCreateTask = canCreateTask(currentUser, defaultWriteCompanyId);

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [search, setSearch] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'deadline' | 'createdAt' | 'priority' | 'title'>('deadline');

  useEffect(() => {
    setSearch(initialSearchQuery);
  }, [initialSearchQuery]);

  const nowStr = formatLocalDate(new Date());

  // Restrict tasks strictly by canonical role (Employee: own tasks, Manager: department/team tasks)
  const baseTasks = useMemo(
    () => scopeTasksForUser(currentUser, tasks, employees),
    [tasks, employees, currentUser]
  );

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    return baseTasks
      .filter(t => {
        // Search query
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const matches =
            (t.title || '').toLowerCase().includes(q) ||
            (t.taskId || '').toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            (t.assignedToName || '').toLowerCase().includes(q) ||
            (t.assignedToEmail || '').toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Status
        if (statusFilter === 'Overdue') {
          if (!t.deadline || t.deadline >= nowStr || t.status === 'Completed' || t.status === 'Cancelled') {
            return false;
          }
        } else if (statusFilter !== 'All' && t.status !== statusFilter) {
          return false;
        }

        // Priority
        if (priorityFilter !== 'All' && t.priority !== priorityFilter) {
          return false;
        }

        // Department
        if (departmentFilter !== 'All' && t.department !== departmentFilter) {
          return false;
        }

        // Assignee
        if (assigneeFilter !== 'All' && t.assignedTo !== assigneeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          return (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31');
        }
        if (sortBy === 'createdAt') {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        if (sortBy === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (sortBy === 'priority') {
          const weights: Record<TaskPriority, number> = {
            Urgent: 4,
            High: 3,
            Medium: 2,
            Low: 1,
          };
          return (weights[b.priority] || 0) - (weights[a.priority] || 0);
        }
        return 0;
      });
  }, [baseTasks, search, statusFilter, priorityFilter, departmentFilter, assigneeFilter, sortBy, nowStr]);

  // Status Tab Counts
  const counts = {
    All: baseTasks.length,
    Pending: baseTasks.filter(t => t.status === 'Pending').length,
    'In Progress': baseTasks.filter(t => t.status === 'In Progress').length,
    Review: baseTasks.filter(t => t.status === 'Review').length,
    Completed: baseTasks.filter(t => t.status === 'Completed').length,
    Overdue: baseTasks.filter(
      t => Boolean(t.deadline) && t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
    ).length,
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header with Title & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {role === 'EMPLOYEE'
              ? 'مهامي التنفيذية'
              : role === 'MANAGER'
              ? `مهام القسم — ${currentUser?.department || activeCompany.name}`
              : `دليل المهام — ${activeCompany.name}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {role === 'EMPLOYEE'
              ? 'المهام والتكليفات المسندة إليك. حدّث نسب الإنجاز وارفع المخرجات للاعتماد.'
              : role === 'MANAGER'
              ? 'متابعة مهام فريق القسم، اعتماد المخرجات، ومراقبة مواعيد التسليم.'
              : 'نظرة شاملة ومفصلة على كافة المهام التشغيلية عبر الأقسام والمشاريع.'}
          </p>
        </div>

        {allowCreateTask && (
          <Button
            id="btn-tasksview-create"
            onClick={onOpenCreateTask}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إنشاء مهمة جديدة
          </Button>
        )}
      </div>

      {/* Quick Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'All', label: 'كافة المهام', count: counts.All },
          { key: 'In Progress', label: 'قيد التنفيذ', count: counts['In Progress'] },
          { key: 'Review', label: 'بانتظار الاعتماد', count: counts.Review },
          { key: 'Pending', label: 'قيد الانتظار', count: counts.Pending },
          { key: 'Completed', label: 'المكتملة', count: counts.Completed },
          { key: 'Overdue', label: 'متأخرة عن الموعد', count: counts.Overdue, isDanger: true },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === tab.key
                ? tab.isDanger
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-[#DCFCE7] text-[#14532D] border border-[#22C55E]/40'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                statusFilter === tab.key
                  ? tab.isDanger
                    ? 'bg-rose-500 text-white'
                    : 'bg-[#22C55E] text-white'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Controls Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالعنوان، رمز المهمة، أو الموظف..."
              className="w-full pr-10 pl-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
            />
          </div>

          {/* Department Filter (Supervisors only) */}
          {role !== 'EMPLOYEE' && (
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
            >
              <option value="All">كافة الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Assignee Filter (Supervisors only) */}
          {role !== 'EMPLOYEE' && (
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
            >
              <option value="All">كافة المكلفين</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
          >
            <option value="All">كافة الأولويات</option>
            <option value="Urgent">عاجل جداً (Urgent)</option>
            <option value="High">مرتفع (High)</option>
            <option value="Medium">متوسط (Medium)</option>
            <option value="Low">منخفض (Low)</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'deadline' | 'createdAt' | 'priority' | 'title')}
            className="px-4 py-2 text-xs bg-[#F1F3F5] rounded-full border border-transparent text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
          >
            <option value="deadline">الترتيب: الموعد النهائي</option>
            <option value="createdAt">الترتيب: الأحدث إضافة</option>
            <option value="priority">الترتيب: الأولوية</option>
            <option value="title">الترتيب: العنوان أ-ي</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
          <span className="tabular-nums">
            يتم عرض <strong className="text-slate-900">{filteredTasks.length}</strong> من أصل{' '}
            {baseTasks.length} مهمة
          </span>

          <div className="flex items-center gap-1 bg-[#F1F3F5] p-1 rounded-full">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض الجدول"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض البطاقات"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Task List / Content */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6" />}
          title="لا توجد مهام مطابقة للبحث"
          description="جرّب تغيير عبارة البحث أو اختيار حالة تصفية أخرى لإظهار المهام المطلوبة."
          action={
            <div className="flex items-center justify-center gap-2">
              {(search ||
                statusFilter !== 'All' ||
                priorityFilter !== 'All' ||
                departmentFilter !== 'All' ||
                assigneeFilter !== 'All') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('All');
                    setPriorityFilter('All');
                    setDepartmentFilter('All');
                    setAssigneeFilter('All');
                  }}
                >
                  إعادة ضبط الفلاتر
                </Button>
              )}
              {allowCreateTask && (
                <Button size="sm" variant="primary" onClick={onOpenCreateTask}>
                  إنشاء مهمة جديدة
                </Button>
              )}
            </div>
          }
        />
      ) : viewMode === 'table' ? (
        /* Table View */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F8F9FA] border-b border-slate-100 text-xs text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3.5">رمز وعنوان المهمة</th>
                  <th className="px-4 py-3.5">القسم / المشروع</th>
                  <th className="px-4 py-3.5">المكلف بالتنفيذ</th>
                  <th className="px-4 py-3.5">الأولوية</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-4 py-3.5">نسبة الإنجاز</th>
                  <th className="px-4 py-3.5">الموعد النهائي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map(task => {
                  const isOverdue =
                    Boolean(task.deadline) &&
                    task.deadline < nowStr &&
                    task.status !== 'Completed' &&
                    task.status !== 'Cancelled';
                  const assigneeDisplayName = task.assignedToName || task.assignedToEmail || 'غير محدد';
                  const progressPct = task.completionPercentage ?? 0;
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => onSelectTask(task.id)}
                    >
                      <td className="px-4 py-3.5 max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#15803D] bg-[#E8F8EE] px-2 py-0.5 rounded-lg shrink-0">
                            {task.taskId || `#${task.id.slice(0, 6)}`}
                          </span>
                          <span className="font-semibold text-slate-900 group-hover:text-[#15803D] transition-colors truncate">
                            {task.title}
                          </span>
                        </div>
                        {task.attachments && task.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <Paperclip className="w-3 h-3" /> {task.attachments.length} مرفق
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 font-medium">
                        <div>{task.department}</div>
                        {isGroupView && task.companyId && (
                          <div className="text-[10px] font-bold text-slate-500">
                            {getCompanyById(task.companyId)?.name || task.companyId}
                          </div>
                        )}
                        {task.projectName && (
                          <div className="text-[11px] text-[#15803D] font-semibold">{task.projectName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {task.assignedToPhoto ? (
                            <img
                              src={task.assignedToPhoto}
                              alt={assigneeDisplayName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] flex items-center justify-center font-bold">
                              {assigneeDisplayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-slate-800 font-medium truncate max-w-[120px]">
                            {assigneeDisplayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={task.status} isOverdue={isOverdue} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-24 space-y-1">
                          <div className="flex justify-end text-[10px] font-mono text-slate-500 tabular-nums">
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#F1F3F5] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#22C55E] rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono font-medium tabular-nums">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                          {task.deadline || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => {
            const isOverdue =
              Boolean(task.deadline) &&
              task.deadline < nowStr &&
              task.status !== 'Completed' &&
              task.status !== 'Cancelled';
            const assigneeDisplayName = task.assignedToName || task.assignedToEmail || 'غير محدد';
            const progressPct = task.completionPercentage ?? 0;
            return (
              <Card
                key={task.id}
                hover
                className="p-5 cursor-pointer flex flex-col justify-between space-y-3"
                onClick={() => onSelectTask(task.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-xs font-bold text-[#15803D] bg-[#E8F8EE] px-2 py-0.5 rounded-lg">
                      {task.taskId || `#${task.id.slice(0, 6)}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} isOverdue={isOverdue} />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 hover:text-[#15803D] transition-colors line-clamp-2">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                  {task.projectName && (
                    <div className="mt-2 text-[11px] text-[#15803D] font-semibold">
                      المشروع: {task.projectName}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">نسبة الإنجاز</span>
                      <span className="font-mono font-bold text-slate-700 tabular-nums">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F1F3F5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Assignee & Deadline */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {task.assignedToPhoto ? (
                        <img
                          src={task.assignedToPhoto}
                          alt={assigneeDisplayName}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] flex items-center justify-center font-bold">
                          {assigneeDisplayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                        {assigneeDisplayName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                        {task.deadline || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
