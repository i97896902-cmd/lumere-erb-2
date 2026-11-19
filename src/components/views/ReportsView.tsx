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

  const nowStr = new Date().toISOString().split('T')[0];

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

  // Export CSV functionality
  const exportToCSV = () => {
    const headers = ['رمز المهمة', 'عنوان المهمة', 'القسم', 'المسؤول', 'الأولوية', 'الحالة', 'تاريخ التسليم', 'نسبة الإنجاز'];
    const rows = filteredTasks.map(t => [
      t.taskId,
      `"${t.title.replace(/"/g, '""')}"`,
      t.department,
      `"${t.assignedToName}"`,
      t.priority,
      t.status,
      t.deadline,
      `${t.completionPercentage}%`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeCompany.slug || 'lumere'}_tasks_report_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h2 className="text-xl font-bold text-neutral-900">
            التقارير التحليلية — {activeCompany.name}
          </h2>
          <p className="text-xs text-neutral-500">
            {isGroupView
              ? 'مؤشرات الأداء المجمعة لكافة شركات المجموعة والأقسام.'
              : `مؤشرات الأداء الرئيسية، قياس الإنتاجية، وسرعة تسليم التكليفات في ${activeCompany.name}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value as 'all' | 'month' | 'quarter')}
            className="px-3 py-1.5 text-xs bg-white rounded-xl border border-neutral-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">كامل البيانات التاريخية</option>
            <option value="quarter">هذا الربع السنوي</option>
            <option value="month">الشهر الحالي</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            isLoading={isSavingReport}
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSaveSnapshotReport}
          >
            حفظ التقرير
          </Button>

          <Button
            size="sm"
            variant="outline"
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
        <Card className="p-4 border-r-4 border-r-emerald-600">
          <span className="text-xs font-semibold text-neutral-500">
            معدل الإنجاز العام
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-neutral-900">{completionRate}%</span>
            <span className="text-xs text-emerald-700 font-medium font-mono">
              {completedTasks}/{totalTasks} مهمة
            </span>
          </div>
        </Card>

        <Card className="p-4 border-r-4 border-r-rose-500">
          <span className="text-xs font-semibold text-neutral-500">
            نسبة التأخير
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-600">{overdueRate}%</span>
            <span className="text-xs text-rose-700 font-medium font-mono">{overdueTasks} مهام</span>
          </div>
        </Card>

        <Card className="p-4 border-r-4 border-r-blue-600">
          <span className="text-xs font-semibold text-neutral-500">
            القوة العاملة النشطة
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-neutral-900">{employees.length}</span>
            <span className="text-xs text-neutral-500">عبر {departments.length} أقسام</span>
          </div>
        </Card>

        <Card className="p-4 border-r-4 border-r-amber-500">
          <span className="text-xs font-semibold text-neutral-500">
            متوسط كثافة التكليف
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-900">
              {employees.length > 0 ? (totalTasks / employees.length).toFixed(1) : 0}
            </span>
            <span className="text-xs text-amber-700 font-medium">مهمة / موظف</span>
          </div>
        </Card>
      </div>

      {/* Leaderboard and Department Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Performance Leaderboard */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                لوحة شرف الأداء والكفاءة
              </h3>
              <p className="text-xs text-neutral-500">الترتيب حسب حجم المهام المسلّمة بجودة عالية</p>
            </div>
          </div>

          <div className="space-y-3">
            {employeeRankings.slice(0, 6).map((emp, index) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 border border-neutral-100 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-xs ${
                      index === 0
                        ? 'bg-amber-100 text-amber-800'
                        : index === 1
                        ? 'bg-neutral-200 text-neutral-800'
                        : index === 2
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {emp.photoURL ? (
                    <img
                      src={emp.photoURL}
                      alt={emp.displayName}
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold border border-emerald-200">
                      {emp.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-neutral-900">{emp.displayName}</p>
                    <p className="text-[11px] text-neutral-500">{emp.department}</p>
                  </div>
                </div>

                <div className="text-left">
                  <p className="font-bold text-neutral-900 font-mono">
                    {emp.completedCount} <span className="font-normal text-neutral-500 text-xs">منجزة</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 font-semibold font-mono">
                    {emp.rate}% نسبة النجاح
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Department Throughput Comparison */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                مصفوفة إنجاز الأقسام والوحدات
              </h3>
              <p className="text-xs text-neutral-500">حجم المخرجات ومستوى تسليم المحطات المستهدفة</p>
            </div>
          </div>

          <div className="space-y-3.5">
            {departmentBreakdown.map(dept => (
              <div key={dept.id} className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dept.color || '#059669' }}
                    />
                    <span className="text-neutral-800">{dept.name}</span>
                  </div>
                  <span className="font-mono text-neutral-600">
                    {dept.completed}/{dept.total} مكتملة ({dept.rate}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: `${dept.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
