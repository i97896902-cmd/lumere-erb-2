import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import {
  DEFAULT_SUBSIDIARY_ID,
  SUGGESTED_DEPARTMENTS_BY_COMPANY,
} from '../../config/companies';
import {
  UserCheck,
  Building2,
  Phone,
  Briefcase,
  Mail,
  ShieldAlert,
  LogOut,
  Layers,
} from 'lucide-react';

interface CompleteProfileViewProps {
  departments: Array<{ id: string; name: string; companyId?: string }>;
}

export const CompleteProfileView: React.FC<CompleteProfileViewProps> = ({ departments }) => {
  const { currentUser, firebaseUser, completeEmployeeProfile, logout } = useAuth();
  const { subsidiaries } = useCompany();

  const activeSubsidiaries = useMemo(
    () => subsidiaries.filter(c => c.status === 'active'),
    [subsidiaries]
  );

  const [companyId, setCompanyId] = useState(
    currentUser?.companyId && activeSubsidiaries.some(c => c.id === currentUser.companyId)
      ? currentUser.companyId
      : activeSubsidiaries[0]?.id || DEFAULT_SUBSIDIARY_ID
  );
  const [displayName, setDisplayName] = useState(
    currentUser?.displayName || firebaseUser?.displayName || ''
  );
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [position, setPosition] = useState(currentUser?.position || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDepartments = useMemo(() => {
    const live = departments.filter(
      d => (d.companyId || DEFAULT_SUBSIDIARY_ID) === companyId
    );
    if (live.length > 0) {
      return live.map(d => ({ id: d.id, name: d.name }));
    }
    const suggested = SUGGESTED_DEPARTMENTS_BY_COMPANY[companyId] || [];
    if (suggested.length > 0) {
      return suggested.map(d => ({ id: d.id, name: d.name }));
    }
    return [{ id: 'general', name: 'الإدارة والعمليات' }];
  }, [departments, companyId]);

  const [department, setDepartment] = useState(
    currentUser?.department || availableDepartments[0]?.name || ''
  );

  useEffect(() => {
    if (!availableDepartments.some(d => d.name === department)) {
      setDepartment(availableDepartments[0]?.name || '');
    }
  }, [availableDepartments, department]);

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
        companyId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="complete-profile-view"
      className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4 sm:p-6"
      dir="rtl"
    >
      <div className="w-full max-w-xl">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <img
            src="/assets/aistudio/image_4888628b.png"
            alt="Luméré"
            className="h-16 w-auto mx-auto mb-3 object-contain select-none"
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            إكمال الملف التعريفي للموظف
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            أهلاً بك في منظومة LUMERE GROUP. اختر الشركة التابعة التي تنتمي إليها واستكمل بياناتك للاعتماد.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/75 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Read-only Google Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                البريد الإلكتروني المعتمد
              </label>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-600 text-sm">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-mono text-xs">
                  {firebaseUser?.email || currentUser?.email}
                </span>
                <span className="mr-auto text-[11px] font-semibold text-[#15803D] bg-[#E8F8EE] px-2.5 py-0.5 rounded-full">
                  Firebase Auth
                </span>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="input-profile-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                الاسم الكامل <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-profile-name"
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="مثال: أحمد خالد المنصور"
                className="w-full px-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
              />
            </div>

            {/* Subsidiary Company Selection */}
            <div>
              <label htmlFor="select-profile-company" className="block text-xs font-semibold text-slate-600 mb-1.5">
                الشركة التابعة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <Layers className="w-4 h-4" />
                </div>
                <select
                  id="select-profile-company"
                  required
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
                >
                  {activeSubsidiaries.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.arabicName ? `— ${c.arabicName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="input-profile-phone" className="block text-xs font-semibold text-slate-600 mb-1.5">
                رقم الهاتف / الجوال <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="input-profile-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="مثال: +966 50 123 4567"
                  className="w-full pr-10 pl-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all text-right"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="select-profile-dept" className="block text-xs font-semibold text-slate-600 mb-1.5">
                القسم المؤسسي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <select
                  id="select-profile-dept"
                  required
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
                >
                  {availableDepartments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Position */}
            <div>
              <label htmlFor="input-profile-position" className="block text-xs font-semibold text-slate-600 mb-1.5">
                المسمى الوظيفي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  id="input-profile-position"
                  type="text"
                  required
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="مثال: مهندس واجهات أمامية / مصمم جرافيك / مشرف عمليات"
                  className="w-full pr-10 pl-4 py-2.5 rounded-full bg-[#F1F3F5] border border-transparent text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                id="btn-submit-profile"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
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

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              id="btn-logout-from-profile"
              onClick={logout}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
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
