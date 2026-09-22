import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Task } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface CalendarViewProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}

export function CalendarView({ tasks, onSelectTask }: CalendarViewProps) {
  const { role, currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesArabic = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ];

  // Role filter
  const relevantTasks =
    role === 'EMPLOYEE' ? tasks.filter(t => t.assignedTo === currentUser?.id) : tasks;

  // Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Calendar matrix calculation
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const daysArray = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArray.push({
      day: daysInPrevMonth - i,
      monthOffset: -1,
      dateStr: new Date(year, month - 1, daysInPrevMonth - i).toISOString().split('T')[0],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push({
      day: d,
      monthOffset: 0,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  // Next month padding to fill 35 or 42 grid slots
  const remaining = 42 - daysArray.length;
  for (let n = 1; n <= remaining; n++) {
    daysArray.push({
      day: n,
      monthOffset: 1,
      dateStr: new Date(year, month + 1, n).toISOString().split('T')[0],
    });
  }

  const selectedDateTasks = relevantTasks.filter(t => t.deadline === selectedDateStr);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">تقويم وجدول المواعيد النهائية</h2>
          <p className="text-xs text-neutral-500">
            متابعة تسليمات ومحطات العمل والمواعيد النهائية لكافة المشاريع والمهام.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 shadow-2xs transition-colors cursor-pointer"
          >
            اليوم
          </button>
          <div className="flex items-center rounded-xl border border-neutral-200 bg-white p-0.5 shadow-2xs">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-neutral-900 min-w-[130px] text-center">
              {monthNamesArabic[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="الشهر القادم"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid (3 cols) */}
        <Card className="lg:col-span-3 p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center pb-2 border-b border-neutral-100 text-xs font-semibold text-neutral-400">
            <span>الأحد</span>
            <span>الإثنين</span>
            <span>الثلاثاء</span>
            <span>الأربعاء</span>
            <span>الخميس</span>
            <span>الجمعة</span>
            <span>السبت</span>
          </div>

          {/* Month Matrix */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {daysArray.map((cell, idx) => {
              const dayTasks = relevantTasks.filter(t => t.deadline === cell.dateStr);
              const isSelected = selectedDateStr === cell.dateStr;
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[84px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    cell.monthOffset !== 0
                      ? 'bg-neutral-50/40 text-neutral-300 border-transparent'
                      : isSelected
                      ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                        isToday
                          ? 'bg-emerald-700 text-white font-bold'
                          : cell.monthOffset !== 0
                          ? 'text-neutral-300'
                          : 'text-neutral-700'
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-700">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task Pills */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map(task => (
                      <div
                        key={task.id}
                        onClick={e => {
                          e.stopPropagation();
                          onSelectTask(task.id);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border transition-colors ${
                          task.priority === 'Urgent'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : task.status === 'Completed'
                            ? 'bg-teal-50 border-teal-200 text-teal-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                        title={task.title}
                      >
                        {task.taskId}: {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] text-neutral-400 font-semibold px-1">
                        +{dayTasks.length - 2} إضافية
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Selected Date Detail Drawer (1 col) */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <span className="text-[11px] font-semibold text-neutral-400">
                مهام اليوم المحدد
              </span>
              <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>

            {selectedDateTasks.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {selectedDateTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-emerald-300 transition-all cursor-pointer space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {task.taskId}
                      </span>
                      <PriorityBadge priority={task.priority} />
                    </div>

                    <h4 className="text-xs font-bold text-neutral-900 line-clamp-2">
                      {task.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
                      <span className="truncate max-w-[120px]">{task.assignedToName}</span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                <CalendarIcon className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                لا توجد مهام مستحقة في هذا اليوم.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
