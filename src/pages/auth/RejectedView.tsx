import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { XCircle, LogOut } from 'lucide-react';

export const RejectedView: React.FC = () => {
  const { currentUser, logout } = useAuth();

  return (
    <div id="rejected-approval-view" className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 mb-3 shadow-xs">
            <XCircle className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            تم رفض طلب الانضمام
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            نعتذر، لم تتم الموافقة على طلب انضمامك إلى منصة Luméré الداخلية.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-slate-200/75 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          {currentUser?.rejectionReason && (
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 mb-6">
              <span className="block text-xs font-semibold text-rose-800 mb-1">سبب الرفض المسجل من الإدارة:</span>
              <p className="text-xs text-rose-900 leading-relaxed">{currentUser.rejectionReason}</p>
            </div>
          )}

          <div className="space-y-3 mb-6 text-xs text-slate-600">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>الاسم</span>
              <span className="font-semibold text-slate-900">{currentUser?.displayName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>البريد الإلكتروني</span>
              <span className="font-mono text-slate-800 dir-ltr">{currentUser?.email}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              id="btn-logout-rejected"
              onClick={logout}
              className="w-full py-2.5 px-5 rounded-full bg-[#18181B] hover:bg-neutral-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج والعودة لصفحة الدخول</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
