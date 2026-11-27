import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Check,
  Plus,
  AlertTriangle,
  Send,
  Sparkles,
  Volume2,
  Radio,
  Calendar,
  User as UserIcon,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Card, EmptyState } from '../ui/Card';
import { Button } from '../ui/Button';
import { Notification, Task, User } from '../../types';
import {
  DeadlinePushService,
  DeadlineServiceStatus,
  DeadlineCheckResult,
} from '../../services/deadlinePushService';
import { useToast } from '../../context/ToastContext';

interface NotificationsViewProps {
  notifications: Notification[];
  tasks: Task[];
  currentUser?: User | null;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectTask: (taskId: string) => void;
}

export function NotificationsView({
  notifications,
  tasks,
  currentUser,
  onMarkRead,
  onMarkAllRead,
  onSelectTask,
}: NotificationsViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'notifications' | 'deadlines'>('notifications');
  const [serviceStatus, setServiceStatus] = useState<DeadlineServiceStatus>(
    DeadlinePushService.getStatus()
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  // Subscribe to DeadlinePushService status changes
  useEffect(() => {
    const unsub = DeadlinePushService.subscribeStatus(newStatus => {
      setServiceStatus(newStatus);
    });
    return () => unsub();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const approachingTasks = DeadlinePushService.getApproachingTasks(tasks);

  // Manual Trigger: Check deadlines now
  const handleRunDeadlineCheck = async () => {
    setIsScanning(true);
    try {
      const result: DeadlineCheckResult = await DeadlinePushService.checkApproachingDeadlines(
        tasks,
        currentUser,
        true // force check ignoring recent throttle
      );

      const summary = `تم فحص ${result.tasksEvaluated} مهمة نشطة: ${result.approachingCount} مهمة تقترب من الموعد، ${result.overdueCount} مهمة متأخرة. تم إرسال ${result.notificationsTriggered} إشعار فوري.`;
      setScanSummary(summary);
      showToast(summary, result.approachingCount > 0 ? 'info' : 'success');
    } catch (err) {
      showToast('خطأ أثناء فحص المواعيد النهائية', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Request browser push permissions
  const handleRequestPushPermission = async () => {
    const perm = await DeadlinePushService.requestBrowserPushPermission();
    if (perm === 'granted') {
      showToast('تم تفعيل إشعارات المتصفح الفورية بنجاح!', 'success');
      DeadlinePushService.triggerTestPush();
    } else if (perm === 'denied') {
      showToast('تم حظر إشعارات المتصفح في إعدادات المتصفح', 'info');
    }
  };

  // Manual test push for a specific approaching task
  const handleTriggerTaskPush = async (task: Task) => {
    try {
      const calc = DeadlinePushService.calculateDeadlineInfo(task.deadline);
      await DeadlinePushService.checkApproachingDeadlines([task], currentUser, true);
      showToast(`تم إرسال إشعار فوري لمهمة "${task.title}" (${calc.humanReadableDiff})`, 'info');
    } catch {
      showToast('تعذر إرسال التنبيه الفوري للمهمة', 'error');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#16A34A]" />
            التنبيهات وإشعارات المواعيد النهائية (Push Alerts)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مراقبة ذكية تحسب الفرق الزمني بين اللحظة الراهنة وتاريخ تسليم المهمة لتنبيه الموظفين تلقائياً.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && activeTab === 'notifications' && (
            <Button
              size="sm"
              variant="outline"
              className="bg-[#E8F8EE] border-transparent text-[#15803D] hover:bg-[#DCFCE7]"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={onMarkAllRead}
            >
              تحديد الكل كمقروء
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            isLoading={isScanning}
            leftIcon={<Radio className="w-4 h-4" />}
            onClick={handleRunDeadlineCheck}
          >
            فحص المواعيد الآن
          </Button>
        </div>
      </div>

      {/* Automated Deadline Push Service Status Banner */}
      <Card className="p-5 sm:p-6 bg-[#16181A] text-white border-none shadow-sm rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#22C55E] font-mono">
                خدمة فحص وتنبيه المواعيد التلقائية نشطة
              </span>
              <span className="text-[10px] bg-white/10 text-neutral-300 px-2.5 py-0.5 rounded-full font-mono tabular-nums">
                معدل الفحص: كل {serviceStatus.settings.checkIntervalSeconds} ثانية
              </span>
            </div>

            <p className="text-xs text-neutral-300">
              حساب مستمر للفرق الزمني بين تاريخ اليوم والموعد النهائي بهامش تحذير{' '}
              <span className="text-amber-300 font-semibold tabular-nums">{serviceStatus.settings.thresholdHours} ساعة</span>.
              يرسل تنبيهات داخل النظام وإشعارات سطح المكتب (Desktop Push) للمكلف بالتنفيذ.
            </p>

            {scanSummary && (
              <p className="text-[11px] text-[#4ADE80] bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60 inline-block font-mono">
                {scanSummary}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {serviceStatus.browserPermission === 'granted' ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#4ADE80] text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                إشعارات المتصفح مفعلة
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white border-white/15 hover:bg-white/15 text-xs cursor-pointer"
                leftIcon={<Bell className="w-3.5 h-3.5 text-amber-400" />}
                onClick={handleRequestPushPermission}
              >
                تفعيل تنبيهات المتصفح
              </Button>
            )}

            <button
              type="button"
              onClick={() => DeadlinePushService.playGentleChime()}
              title="تجربة نغمة التنبيه الهادئة"
              aria-label="تجربة نغمة التنبيه الهادئة"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-white/10 text-center sm:text-right">
          <div>
            <p className="text-[10px] text-neutral-400 font-medium">مهام توشك على الانتهاء</p>
            <p className="text-lg font-bold text-amber-400 font-mono tabular-nums">{approachingTasks.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 font-medium">مهام نشطة قيد المراقبة</p>
            <p className="text-lg font-bold text-white font-mono tabular-nums">
              {tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 font-medium">مهام متأخرة تجاوزت الموعد</p>
            <p className="text-lg font-bold text-rose-400 font-mono tabular-nums">
              {approachingTasks.filter(item => item.calc.isOverdue).length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 font-medium">آخر فحص تلقائي</p>
            <p className="text-xs text-neutral-200 font-mono mt-1 tabular-nums">
              {serviceStatus.lastCheckedAt
                ? new Date(serviceStatus.lastCheckedAt).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'الآن'}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === 'notifications'
              ? 'text-[#15803D] border-b-2 border-[#22C55E]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          سجل التنبيهات ({notifications.length})
          {unreadCount > 0 && (
            <span className="mr-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#22C55E] text-white font-bold tabular-nums">
              {unreadCount} جديدة
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deadlines')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === 'deadlines'
              ? 'text-[#15803D] border-b-2 border-[#22C55E]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          قائمة مراقبة المواعيد الحرجة ({approachingTasks.length})
          {approachingTasks.length > 0 && (
            <span className="mr-1.5 px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold tabular-nums">
              {approachingTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content: Notifications Stream */}
      {activeTab === 'notifications' && (
        <>
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-6 h-6" />}
              title="لا توجد تنبيهات حالياً!"
              description="أنت على اطلاع تام بكافة المستجدات. عندما تقترب مهامك من موعد التسليم، ستظهر التنبيهات هنا فورياً."
            />
          ) : (
            <Card className="p-0 overflow-hidden divide-y divide-slate-100">
              {notifications.map(n => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (n.relatedTaskId) onSelectTask(n.relatedTaskId);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMarkRead(n.id);
                      if (n.relatedTaskId) onSelectTask(n.relatedTaskId);
                    }
                  }}
                  className={`p-4 sm:p-5 flex items-start gap-3.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer ${
                    !n.read ? 'bg-[#E8F8EE]/25' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'task_assigned' && (
                      <div className="w-9 h-9 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                    {n.type === 'task_approved' && (
                      <div className="w-9 h-9 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {n.type === 'deadline_approaching' && (
                      <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                    )}
                    {n.type !== 'task_assigned' &&
                      n.type !== 'task_approved' &&
                      n.type !== 'deadline_approaching' && (
                        <div className="w-9 h-9 rounded-full bg-[#F1F3F5] text-slate-600 flex items-center justify-center">
                          <Bell className="w-4 h-4" />
                        </div>
                      )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                        {n.type === 'deadline_approaching' && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700">
                            إنذار موعد تسليم
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-mono tabular-nums">
                          {new Date(n.createdAt).toLocaleDateString('ar-SA', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          {new Date(n.createdAt).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!n.read && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-4 ring-[#DCFCE7]" />
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>

                    {n.relatedTaskId && (
                      <span className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-semibold text-[#15803D] bg-[#E8F8EE] px-3 py-1 rounded-full">
                        عرض تفاصيل المهمة
                        <ArrowLeft className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Tab Content: Approaching Deadlines Watchlist */}
      {activeTab === 'deadlines' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            محسوبة بدقة بناءً على الفرق الزمني بين اليوم والموعد النهائي المحدد.
            المهام المتبقي عليها أقل من {serviceStatus.settings.thresholdHours} ساعة تنشئ إشعارات فورية تلقائياً.
          </p>

          {approachingTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">لا توجد مهام في دائرة الخطر</h3>
              <p className="text-xs text-slate-500 mt-1">
                كافة المهام النشطة لديها متسع زمني كافٍ يتجاوز حد التنبيه ({serviceStatus.settings.thresholdHours} ساعة).
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approachingTasks.map(({ task, calc }) => (
                <Card
                  key={task.id}
                  hover
                  className={`p-5 transition-all cursor-pointer ${
                    calc.isOverdue
                      ? 'border-rose-200 bg-rose-50/15'
                      : calc.urgency === 'due_today'
                      ? 'border-amber-200 bg-amber-50/15'
                      : ''
                  }`}
                  onClick={() => onSelectTask(task.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400">{task.taskId}</span>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mt-0.5">
                        {task.title}
                      </h4>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono shrink-0 ${
                        calc.isOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : calc.urgency === 'due_today'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[#DCFCE7] text-[#15803D]'
                      }`}
                    >
                      {calc.humanReadableDiff}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        التسليم: <strong className="text-slate-700">{task.deadline}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {task.assignedToName || 'غير مسندة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Send className="w-3 h-3 text-slate-500" />}
                        onClick={() => handleTriggerTaskPush(task)}
                        title="إرسال إشعار فوري فوري لهذه المهمة"
                      >
                        إرسال تنبيه
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectTask(task.id)}
                      >
                        التفاصيل
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
