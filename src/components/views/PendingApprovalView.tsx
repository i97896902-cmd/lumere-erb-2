import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Clock, RefreshCw, LogOut, Building2, Briefcase, Phone, Mail, User } from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const { currentUser, refreshCurrentUser, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await refreshCurrentUser();
      setRefreshMessage('تم تحديث الحالة. الطلب لا يزال قيد المراجعة والاعتماد.');
    } catch {
      setRefreshMessage('تعذر التحقق من الحالة حالياً.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4000);
    }
  };

  return (
    <div id="pending-approval-view" className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Brand Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 mb-3 shadow-xs">
            <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight font-sans">
            طلب الانضمام قيد المراجعة والاعتماد
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            تم استلام بياناتك بنجاح. سيقوم مدير النظام بمراجعة طلبك وتفعيل حسابك برتبة الموظف المعتمدة.
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs"
        >
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 mb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-xs font-bold text-amber-900">الحالة: قيد الانتظار والمراجعة الإدارية</span>
            </div>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
              Pending
            </span>
          </div>

          {/* Submission Details */}
          <div className="space-y-3 mb-6 text-xs text-neutral-600 divide-y divide-neutral-100">
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-neutral-500">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                الاسم
              </span>
              <span className="font-semibold text-neutral-900">{currentUser?.displayName}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-neutral-500">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                البريد الإلكتروني
              </span>
              <span className="font-mono text-neutral-800 dir-ltr">{currentUser?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-neutral-500">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                رقم الجوال
              </span>
              <span className="font-mono text-neutral-800 dir-ltr">{currentUser?.phone || 'غير مسجل'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-neutral-500">
                <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                القسم
              </span>
              <span className="font-semibold text-neutral-900">{currentUser?.department || 'غير محدد'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2 text-neutral-500">
                <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                المسمى الوظيفي
              </span>
              <span className="font-semibold text-neutral-900">{currentUser?.position || 'غير محدد'}</span>
            </div>
          </div>

          {refreshMessage && (
            <div className="mb-4 p-3 rounded-xl bg-neutral-100 border border-neutral-200 text-center text-xs text-neutral-700">
              {refreshMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              id="btn-refresh-pending-status"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>التحقق من حالة الاعتماد الآن</span>
            </button>

            <button
              id="btn-logout-pending"
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5 text-neutral-500" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
