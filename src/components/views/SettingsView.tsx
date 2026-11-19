import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Database,
  Building,
  CheckCircle2,
  RefreshCw,
  Bell,
  Lock,
  Radio,
  Clock,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { PrivilegedService } from '../../services/privilegedService';
import {
  DeadlinePushService,
  DeadlineServiceSettings,
} from '../../services/deadlinePushService';

interface SettingsViewProps {
  onRefreshAllData: () => void;
}

export function SettingsView({ onRefreshAllData }: SettingsViewProps) {
  const { isSuperAdmin, isCompanyAdmin, refreshCurrentUser } = useAuth();
  const { activeCompany } = useCompany();
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState(activeCompany.name);
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState('7');
  const [requireReview, setRequireReview] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncingClaims, setIsSyncingClaims] = useState(false);

  useEffect(() => {
    setCompanyName(activeCompany.name);
  }, [activeCompany.name]);

  // Deadline Push Settings
  const [deadlineSettings, setDeadlineSettings] = useState<DeadlineServiceSettings>(
    DeadlinePushService.getSettings()
  );
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | 'unsupported'>(
    DeadlinePushService.getBrowserPushPermissionStatus()
  );

  useEffect(() => {
    const unsub = DeadlinePushService.subscribeStatus(status => {
      setDeadlineSettings(status.settings);
      setBrowserPerm(status.browserPermission);
    });
    return () => unsub();
  }, []);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('تم حفظ إعدادات وتفضيلات المنشأة بنجاح', 'success');
  };

  const handleUpdateDeadlineSetting = <K extends keyof DeadlineServiceSettings>(
    key: K,
    value: DeadlineServiceSettings[K]
  ) => {
    const updated = DeadlinePushService.saveSettings({ [key]: value });
    setDeadlineSettings(updated);
    showToast(`تم تحديث إعدادات تنبيهات المواعيد`, 'info');
  };

  const handleRequestPushPermission = async () => {
    const perm = await DeadlinePushService.requestBrowserPushPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      showToast('تم تفعيل إشعارات المتصفح بنجاح!', 'success');
      DeadlinePushService.playGentleChime();
    } else if (perm === 'denied') {
      showToast('تم رفض إذن إشعارات المتصفح', 'info');
    }
  };

  const handleTestPush = () => {
    DeadlinePushService.playGentleChime();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('تنبيه تجريبي من Luméré', {
        body: 'خدمة فحص المواعيد النهائية تعمل بنجاح! ستتلقى تنبيهات فورية للمهام القريبة من الانتهاء.',
        icon: '/favicon.ico',
      });
      showToast('تم إرسال إشعار فوري تجريبي!', 'success');
    } else {
      showToast('تم تشغيل الصوت التجريبي! يرجى منح إذن إشعارات المتصفح أعلاه لتلقي النوافذ المنبثقة.', 'info');
    }
  };

  const handleRefreshDatabase = async () => {
    setIsResetting(true);
    try {
      onRefreshAllData();
      showToast('تمت مزامنة وتحديث كافة البيانات بنجاح من Firestore!', 'success');
    } catch {
      showToast('فشل تحديث البيانات', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSyncClaims = async () => {
    setIsSyncingClaims(true);
    try {
      const synced = await PrivilegedService.syncCurrentUserClaims();
      await refreshCurrentUser();
      if (synced) {
        showToast('تمت مزامنة صلاحيات Firebase Auth Custom Claims بنجاح.', 'success');
      } else {
        showToast('لم يتم نشر Cloud Functions بعد؛ يعمل النظام حالياً عبر قواعد Firestore.', 'info');
      }
    } finally {
      setIsSyncingClaims(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          إعدادات وتكوين نظام Luméré
        </h2>
        <p className="text-xs text-neutral-500">
          سياسات المؤسسة، ضوابط الأمان والصلاحيات، إعدادات الإشعارات الفورية، وصيانة النظام.
        </p>
      </div>

      {/* Brand & Organization */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
          <Building className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-neutral-900">الهوية المؤسسية والافتراضيات</h3>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="اسم المنشأة"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />

            <Input
              label="المهلة الافتراضية للمهمة (بالأيام)"
              type="number"
              value={defaultDeadlineDays}
              onChange={e => setDefaultDeadlineDays(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="require-review-toggle"
              checked={requireReview}
              onChange={e => setRequireReview(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="require-review-toggle" className="text-xs font-semibold text-neutral-700 cursor-pointer">
              إلزامية مراجعة واعتماد المدير أو رئيس القسم قبل إغلاق أي مهمة مكتملة
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="sm" variant="primary">
              حفظ التفضيلات
            </Button>
          </div>
        </form>
      </Card>

      {/* Automated Deadline Push Notifications Configuration */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-neutral-900">
              خدمة الإشعارات التلقائية الفورية للمواعيد النهائية
            </h3>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            خدمة نشطة
          </span>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          يقوم محرك المراقبة بفحص المهام غير المكتملة ومقارنتها بالوقت الحالي كل {deadlineSettings.checkIntervalSeconds} ثانية.
          عندما يقترب الموعد من حد الإنذار، يتم إرسال إشعارات فورية وتنبيهات صوتية للموظف المسؤول.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Threshold Selection */}
          <Select
            label="حد الإنذار المسبق للموعد"
            value={String(deadlineSettings.thresholdHours)}
            onChange={e => handleUpdateDeadlineSetting('thresholdHours', Number(e.target.value))}
            options={[
              { value: '24', label: '24 ساعة (المستحقة اليوم / خلال يوم واحد)' },
              { value: '48', label: '48 ساعة (خلال يومين - موصى به)' },
              { value: '72', label: '72 ساعة (خلال 3 أيام)' },
              { value: '120', label: '120 ساعة (خلال 5 أيام)' },
            ]}
          />

          {/* Evaluation Interval */}
          <Select
            label="معدل تكرار الفحص الآلي"
            value={String(deadlineSettings.checkIntervalSeconds)}
            onChange={e =>
              handleUpdateDeadlineSetting('checkIntervalSeconds', Number(e.target.value))
            }
            options={[
              { value: '30', label: 'كل 30 ثانية' },
              { value: '60', label: 'كل 60 ثانية (الافتراضي)' },
              { value: '300', label: 'كل 5 دقائق' },
            ]}
          />
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <div>
              <p className="text-xs font-bold text-neutral-900">تنبيهات المهام المتأخرة</p>
              <p className="text-[11px] text-neutral-500">
                إرسال تنبيهات عاجلة ذات أولوية قصوى للمهام التي فات موعد تسليمها ولم تكتمل.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deadlineSettings.includeOverdue}
              onChange={e => handleUpdateDeadlineSetting('includeOverdue', e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <div>
              <p className="text-xs font-bold text-neutral-900">تصعيد المهام العاجلة للمدراء</p>
              <p className="text-[11px] text-neutral-500">
                إرسال نسخة من التنبيه لمنشئ المهمة ورؤساء الأقسام للمهام ذات الأولوية المرتفعة والعاجلة.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deadlineSettings.notifyManagersForUrgent}
              onChange={e =>
                handleUpdateDeadlineSetting('notifyManagersForUrgent', e.target.checked)
              }
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <div>
              <p className="text-xs font-bold text-neutral-900">إشعارات المتصفح الأصلية (Desktop Push)</p>
              <p className="text-[11px] text-neutral-500">
                إظهار نوافذ تنبيه منبثقة على سطح المكتب ونظام التشغيل حتى عند تصغير المتصفح.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {browserPerm === 'granted' ? (
                <span className="text-[11px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded font-medium">
                  مفعلة
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Bell className="w-3 h-3 text-amber-600" />}
                  onClick={handleRequestPushPermission}
                >
                  منح الإذن
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <div>
              <p className="text-xs font-bold text-neutral-900">نغمة التنبيه الصوتية الهادئة</p>
              <p className="text-[11px] text-neutral-500">
                تشغيل رنين جيبي متناسق خفيف عند إرسال تنبيه اقتراب الموعد.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => DeadlinePushService.playGentleChime()}
                title="معاينة الصوت"
                className="p-1.5 rounded-lg bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 text-xs cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <input
                type="checkbox"
                checked={deadlineSettings.enableAudioChime}
                onChange={e => handleUpdateDeadlineSetting('enableAudioChime', e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Test Trigger Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<Bell className="w-3.5 h-3.5 text-neutral-600" />}
            onClick={handleTestPush}
          >
            إرسال إشعار تجريبي
          </Button>
        </div>
      </Card>

      {/* Security & Access Architecture */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-neutral-900">معمارية الأمان والتحكم بالصلاحيات (RBAC)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="font-bold text-neutral-900">التحكم بالوصول المبني على الأدوار</p>
            <p className="text-neutral-500 mt-1">
              مستويات الصلاحية للمدير العام، مدراء الأقسام، والموظفين محكمة عبر قواعد أمان Firestore.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="font-bold text-neutral-900">سجل تدقيق غير قابل للتلاعب</p>
            <p className="text-neutral-500 mt-1">
              سجلات النشاطات محصورة بالكتابة فقط وتمنع الحذف أو التعديل لضمان الشفافية المؤسسية.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="font-bold text-neutral-900">فرض مسارات العمل المؤسسية</p>
            <p className="text-neutral-500 mt-1">
              قواعد النظام تمنع الموظف من إغلاق المهمة ذاتياً وتلزم بمرورها عبر مرحلة الاعتماد من الإدارة.
            </p>
          </div>
        </div>
      </Card>

      {/* Database Maintenance */}
      {(isSuperAdmin || isCompanyAdmin) && (
        <Card className="p-5 space-y-4 border-emerald-100 bg-emerald-50/20">
          <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-3">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-neutral-900">مزامنة وصيانة قاعدة البيانات والصلاحيات</h3>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            مزامنة بيانات {activeCompany.name} فوراً من Firestore وتحديث بطاقة صلاحيات Firebase Auth Custom Claims.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              isLoading={isResetting}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-neutral-600" />}
              onClick={handleRefreshDatabase}
            >
              تحديث ومزامنة البيانات الآن
            </Button>

            <Button
              size="sm"
              variant="outline"
              isLoading={isSyncingClaims}
              leftIcon={<Shield className="w-3.5 h-3.5 text-emerald-700" />}
              onClick={handleSyncClaims}
            >
              مزامنة صلاحيات الحساب (Custom Claims)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
