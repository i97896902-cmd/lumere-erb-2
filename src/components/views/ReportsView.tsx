import React, { useState } from 'react';
import {
  Download,
  Printer,
  Building2,
  Award,
  Save,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Task, User, Department } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';
import { escapeCsvCell, formatLocalDate } from '../../utils/sanitize';

interface ReportsViewProps {
  tasks: Task[];
  employees: User[];
  departments: Department[];
}

export function ReportsView({ tasks, employees, departments }: ReportsViewProps) {
  const { currentUser } = useAuth();
  const { activeCompany, activeCompanyId, isGroupView } = useCompany();
  const { showToast } = useToast();
  const [timeframe, setTimeframe] = useState<'all' | 'month' | 'quarter'>('all');
  const [isSavingReport, setIsSavingReport] = useState(false);

  const nowStr = formatLocalDate();

  // Filter tasks by timeframe if selected
  const filteredTasks = tasks.filter(t => {
    if (timeframe === 'all') return true;
    const taskDate = new Date(t.createdAt);
    const now = new Date();
    if (timeframe === 'month') {
      return (
        taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear()
      );
    }
    if (timeframe === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const taskQuarter = Math.floor(taskDate.getMonth() / 3);
      return currentQuarter === taskQuarter && taskDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'Completed').length;
  const overdueTasks = filteredTasks.filter(
    t => t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
  ).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  // Employee Performance Rankings
  const employeeRankings = employees
    .map(emp => {
      const empTasks = filteredTasks.filter(t => t.assignedTo === emp.id);
      const empDone = empTasks.filter(t => t.status === 'Completed').length;
      const empOverdue = empTasks.filter(
        t => t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
      ).length;
      const rate = empTasks.length > 0 ? Math.round((empDone / empTasks.length) * 100) : 0;
      return {
        ...emp,
        totalAssigned: empTasks.length,
        completedCount: empDone,
        overdueCount: empOverdue,
        rate,
      };
    })
    .sort((a, b) => b.completedCount - a.completedCount || b.rate - a.rate);

  // Department Breakdown
  const departmentBreakdown = departments.map(dept => {
    const deptTasks = filteredTasks.filter(t => t.department === dept.name);
    const deptCompleted = deptTasks.filter(t => t.status === 'Completed').length;
    const deptOverdue = deptTasks.filter(
      t => t.deadline < nowStr && t.status !== 'Completed' && t.status !== 'Cancelled'
    ).length;
    const rate = deptTasks.length > 0 ? Math.round((deptCompleted / deptTasks.length) * 100) : 0;
    return {
      ...dept,
      total: deptTasks.length,
      completed: deptCompleted,
      overdue: deptOverdue,
      rate,
    };
  });

  // Export CSV functionality (RFC 4180 + formula-injection hardened)
  const exportToCSV = () => {
    const headers = [
      'رمز المهمة',
      'عنوان المهمة',
      'القسم',
      'المسؤول',
      'الأولوية',
      'الحالة',
      'تاريخ التسليم',
      'نسبة الإنجاز',
    ];
    const rows = filteredTasks.map(t => [
      escapeCsvCell(t.taskId),
      escapeCsvCell(t.title),
      escapeCsvCell(t.department),
      escapeCsvCell(t.assignedToName),
      escapeCsvCell(t.priority),
      escapeCsvCell(t.status),
      escapeCsvCell(t.deadline),
      escapeCsvCell(`${t.completionPercentage}%`),
    ]);

    const csvContent =
      '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeCompany.slug || 'lumere'}_tasks_report_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير تقرير CSV بنجاح', 'success');
  };

  const handleSaveSnapshotReport = async () => {
    if (!currentUser) return;
    setIsSavingReport(true);
    try {
      await DataService.saveReport(
        {
          companyId: activeCompanyId,
          title: `تقرير الأداء — ${activeCompany.name} (${timeframe})`,
          period: timeframe,
          generatedBy: currentUser.id,
          generatedByName: currentUser.displayName,
          metrics: {
            totalTasks,
            completedTasks,
            overdueTasks,
            completionRate,
            employeesCount: employees.length,
          },
        },
        currentUser
      );
      showToast('تم حفظ نسخة التقرير في قاعدة بيانات التقارير بنجاح', 'success');
    } catch {
      showToast('تعذر حفظ نسخة التقرير في Firestore', 'error');
    } finally {
      setIsSavingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            التقارير التحليلية — {activeCompany.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isGroupView
              ? 'مؤشرات الأداء المجمعة لكافة شركات المجموعة والأقسام.'
              : `مؤشرات الأداء الرئيسية، قياس الإنتاجية، وسرعة تسليم التكليفات في ${activeCompany.name}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value as 'all' | 'month' | 'quarter')}
            className="px-4 py-2 text-xs bg-white rounded-full border border-slate-200/80 text-slate-700 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          >
            <option value="all">كامل البيانات التاريخية</option>
            <option value="quarter">هذا الربع السنوي</option>
            <option value="month">الشهر الحالي</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
            isLoading={isSavingReport}
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSaveSnapshotReport}
          >
            حفظ التقرير
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            طباعة
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={exportToCSV}
          >
            تصدير تقرير CSV
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border-r-[3px] border-r-[#22C55E]">
          <span className="text-xs font-semibold text-slate-500">
            معدل الإنجاز العام
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{completionRate}%</span>
            <span className="text-xs text-[#15803D] font-semibold font-mono tabular-nums">
              {completedTasks}/{totalTasks} مهمة
            </span>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-r-[3px] border-r-rose-500">
          <span className="text-xs font-semibold text-slate-500">
            نسبة التأخير
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-600 tabular-nums">{overdueRate}%</span>
            <span className="text-xs text-rose-600 font-semibold font-mono tabular-nums">{overdueTasks} مهام</span>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-r-[3px] border-r-blue-500">
          <span className="text-xs font-semibold text-slate-500">
            القوة العاملة النشطة
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{employees.length}</span>
            <span className="text-xs text-slate-500 tabular-nums">عبر {departments.length} أقسام</span>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-r-[3px] border-r-amber-500">
          <span className="text-xs font-semibold text-slate-500">
            متوسط كثافة التكليف
          </span>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-800 tabular-nums">
              {employees.length > 0 ? (totalTasks / employees.length).toFixed(1) : 0}
            </span>
            <span className="text-xs text-amber-700 font-semibold">مهمة / موظف</span>
          </div>
        </Card>
      </div>

      {/* Leaderboard and Department Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Leaderboard */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                لوحة شرف الأداء والكفاءة
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">الترتيب حسب حجم المهام المسلّمة بجودة عالية</p>
            </div>
          </div>

          <div className="space-y-3">
            {employeeRankings.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد بيانات موظفين لعرض الترتيب في النطاق المحدد.
              </div>
            ) : (
              employeeRankings.slice(0, 6).map((emp, index) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8F9FA] text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-xs tabular-nums ${
                        index === 0
                          ? 'bg-amber-100 text-amber-800'
                          : index === 1
                          ? 'bg-slate-200 text-slate-800'
                          : index === 2
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-white text-slate-500 border border-slate-200/80'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {emp.photoURL ? (
                      <img
                        src={emp.photoURL}
                        alt={emp.displayName}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] flex items-center justify-center font-bold">
                        {emp.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-slate-900">{emp.displayName}</p>
                      <p className="text-[11px] text-slate-500">{emp.department}</p>
                    </div>
                  </div>

                  <div className="text-left">
                    <p className="font-bold text-slate-900 font-mono tabular-nums">
                      {emp.completedCount} <span className="font-normal text-slate-500 text-xs">منجزة</span>
                    </p>
                    <p className="text-[10px] text-[#15803D] font-semibold font-mono tabular-nums">
                      {emp.rate}% نسبة النجاح
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Department Throughput Comparison */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#16A34A]" />
                مصفوفة إنجاز الأقسام والوحدات
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">حجم المخرجات ومستوى تسليم المحطات المستهدفة</p>
            </div>
          </div>

          <div className="space-y-4">
            {departmentBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد أقسام مسجلة في النطاق المحدد بعد.
              </div>
            ) : (
              departmentBreakdown.map(dept => (
                <div key={dept.id} className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: dept.color || '#22C55E' }}
                      />
                      <span className="text-slate-800">{dept.name}</span>
                    </div>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {dept.completed}/{dept.total} مكتملة ({dept.rate}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
                      style={{ width: `${dept.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
