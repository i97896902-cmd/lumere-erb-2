import React, { useState, useMemo } from 'react';
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
import { Card, EmptyState } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Task, User, Department, TaskPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { canCreateTask, scopeTasksForUser } from '../../utils/rbac';

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

  const nowStr = new Date().toISOString().split('T')[0];

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
          const q = search.toLowerCase();
          const matches =
            t.title.toLowerCase().includes(q) ||
            t.taskId.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.assignedToName.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Status
        if (statusFilter === 'Overdue') {
          if (t.deadline >= nowStr || t.status === 'Completed' || t.status === 'Cancelled') {
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
          return a.deadline.localeCompare(b.deadline);
        }
        if (sortBy === 'createdAt') {
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'priority') {
          const weights: Record<TaskPriority, number> = {
            Urgent: 4,
            High: 3,
            Medium: 2,
            Low: 1,
          };
          return weights[b.priority] - weights[a.priority];
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
      t => t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
    ).length,
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header with Title & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            {role === 'EMPLOYEE'
              ? 'مهامي التنفيذية'
              : role === 'MANAGER'
              ? `مهام القسم — ${currentUser?.department || activeCompany.name}`
              : `دليل المهام — ${activeCompany.name}`}
          </h2>
          <p className="text-xs text-neutral-500">
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-neutral-200">
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
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === tab.key
                ? tab.isDanger
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                statusFilter === tab.key
                  ? tab.isDanger
                    ? 'bg-rose-200/80 text-rose-900'
                    : 'bg-emerald-200/80 text-emerald-900'
                  : 'bg-neutral-200/70 text-neutral-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Controls Bar */}
      <Card className="p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالعنوان، رمز المهمة، أو الموظف..."
              className="w-full pr-9 pl-3.5 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Department Filter (Supervisors only) */}
          {role !== 'EMPLOYEE' && (
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="All">كافة الأقسام</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="deadline">الترتيب: الموعد النهائي</option>
            <option value="createdAt">الترتيب: الأحدث إضافة</option>
            <option value="priority">الترتيب: الأولوية</option>
            <option value="title">الترتيب: العنوان أ-ي</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
          <span>
            يتم عرض <strong className="text-neutral-800">{filteredTasks.length}</strong> من أصل{' '}
            {baseTasks.length} مهمة
          </span>

          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="عرض الجدول"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white text-neutral-900 shadow-2xs font-bold' : 'text-neutral-500 hover:text-neutral-800'
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
            allowCreateTask && (
              <Button size="sm" variant="primary" onClick={onOpenCreateTask}>
                إنشاء مهمة جديدة
              </Button>
            )
          }
        />
      ) : viewMode === 'table' ? (
        /* Table View */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-neutral-50/80 border-b border-neutral-100 text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">رمز وعنوان المهمة</th>
                  <th className="px-4 py-3">القسم / المشروع</th>
                  <th className="px-4 py-3">المكلف بالتنفيذ</th>
                  <th className="px-4 py-3">الأولوية</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">نسبة الإنجاز</th>
                  <th className="px-4 py-3">الموعد النهائي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredTasks.map(task => {
                  const isOverdue =
                    task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                      onClick={() => onSelectTask(task.id)}
                    >
                      <td className="px-4 py-3.5 max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                            {task.taskId}
                          </span>
                          <span className="font-medium text-neutral-900 group-hover:text-emerald-700 transition-colors truncate">
                            {task.title}
                          </span>
                        </div>
                        {task.attachments && task.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5">
                            <Paperclip className="w-3 h-3" /> {task.attachments.length} مرفق
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-neutral-600 font-medium">
                        <div>{task.department}</div>
                        {isGroupView && task.companyId && (
                          <div className="text-[10px] font-bold text-neutral-500">
                            {getCompanyById(task.companyId)?.name || task.companyId}
                          </div>
                        )}
                        {task.projectName && (
                          <div className="text-[11px] text-emerald-700 font-semibold">{task.projectName}</div>
                        )}
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
                          <span className="text-xs text-neutral-800 font-medium truncate max-w-[120px]">
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
                      <td className="px-4 py-3.5">
                        <div className="w-24 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                            <span>{task.completionPercentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${task.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono font-medium">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-neutral-700'}>
                          {task.deadline}
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
              task.deadline < nowStr && task.status !== 'Completed' && task.status !== 'Cancelled';
            return (
              <Card
                key={task.id}
                hover
                className="p-4 cursor-pointer flex flex-col justify-between space-y-3"
                onClick={() => onSelectTask(task.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                      {task.taskId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} isOverdue={isOverdue} />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 hover:text-emerald-700 transition-colors line-clamp-2">
                    {task.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                  {task.projectName && (
                    <div className="mt-2 text-[11px] text-emerald-700 font-semibold">
                      المشروع: {task.projectName}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-100 space-y-2.5 text-xs">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">نسبة الإنجاز</span>
                      <span className="font-mono font-bold text-neutral-700">
                        {task.completionPercentage}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${task.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Assignee & Deadline */}
                  <div className="flex items-center justify-between">
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
                      <span className="text-xs font-medium text-neutral-700 truncate max-w-[120px]">
                        {task.assignedToName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-500">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                        {task.deadline}
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
