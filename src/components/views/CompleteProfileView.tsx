import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, Building2, Phone, Briefcase, Mail, ShieldAlert, Sparkles, LogOut } from 'lucide-react';

interface CompleteProfileViewProps {
  departments: Array<{ id: string; name: string }>;
}

export const CompleteProfileView: React.FC<CompleteProfileViewProps> = ({ departments }) => {
  const { currentUser, firebaseUser, completeEmployeeProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || firebaseUser?.displayName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || (departments[0]?.name || 'Development'));
  const [position, setPosition] = useState(currentUser?.position || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !phone.trim() || !department.trim() || !position.trim()) {
      setError('يرجى ملء جميع الحقول المطلوبة للمتابعة.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await completeEmployeeProfile({
        displayName: displayName.trim(),
        phone: phone.trim(),
        department: department.trim(),
        position: position.trim(),
      });
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="complete-profile-view" className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-xl">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 shadow-xs">
            <span className="text-2xl font-bold font-serif text-emerald-800 tracking-wider">L</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight font-sans">
            إكمال الملف التعريفي للموظف
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            أهلاً بك في منصة Luméré. يُرجى استكمال بياناتك الوظيفية لإرسال طلبك إلى الإدارة للاعتماد.
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-neutral-200/80 p-6 sm:p-8 shadow-xs"
        >
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Read-only Google Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                البريد الإلكتروني المعتمد
              </label>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-neutral-100/80 border border-neutral-200 text-neutral-600 text-sm">
                <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                <span className="truncate font-mono text-xs">{firebaseUser?.email || currentUser?.email}</span>
                <span className="mr-auto text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Google Auth
                </span>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="input-profile-name" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                الاسم الكامل <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-profile-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد خالد المنصور"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="input-profile-phone" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                رقم الهاتف / الجوال <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="input-profile-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="مثال: +966 50 123 4567"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors text-right"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="select-profile-dept" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                القسم المؤسسي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <select
                  id="select-profile-dept"
                  required
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                  <option value="Development">التطوير والبرمجيات (Development)</option>
                  <option value="Design">التصميم وتجربة المستخدم (Design)</option>
                  <option value="Marketing">التسويق والعلاقات العامة (Marketing)</option>
                  <option value="Media">الإنتاج الإعلامي والمحتوى (Media)</option>
                  <option value="Sales">المبيعات وتطوير الأعمال (Sales)</option>
                  <option value="Photography">التصوير الفوتوغرافي (Photography)</option>
                  <option value="Management">الإدارة والعمليات (Management)</option>
                </select>
              </div>
            </div>

            {/* Position */}
            <div>
              <label htmlFor="input-profile-position" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                المسمى الوظيفي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  id="input-profile-position"
                  type="text"
                  required
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="مثال: مهندس واجهات أمامية / مصمم جرافيك / مدير حسابات"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                id="btn-submit-profile"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>إرسال طلب الانضمام للاعتماد</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Logout option */}
          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <button
              id="btn-logout-from-profile"
              onClick={logout}
              className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج أو استخدام حساب آخر</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
