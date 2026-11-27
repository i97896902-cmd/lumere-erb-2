import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, CanonicalRole, Department } from '../../types';
import { DataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getAssignableRoles, getRoleArabicLabel, getUserCompanyId } from '../../utils/rbac';
import {
  UserCheck,
  UserX,
  Clock,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Search,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';

interface JoinRequestsViewProps {
  pendingUsers: User[];
  departments?: Department[];
  onRefresh?: () => void;
}

export const JoinRequestsView: React.FC<JoinRequestsViewProps> = ({ pendingUsers, onRefresh }) => {
  const { currentUser, isSuperAdmin } = useAuth();
  const { subsidiaries, defaultWriteCompanyId, activeCompany, getCompanyById } = useCompany();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserForApproval, setSelectedUserForApproval] = useState<User | null>(null);
  const [assignedRole, setAssignedRole] = useState<CanonicalRole>('EMPLOYEE');
  const [targetCompanyId, setTargetCompanyId] = useState(defaultWriteCompanyId);
  const [selectedUserForRejection, setSelectedUserForRejection] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        setSelectedUserForApproval(null);
        setSelectedUserForRejection(null);
      }
    };
    if (selectedUserForApproval || selectedUserForRejection) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUserForApproval, selectedUserForRejection, isProcessing]);

  const assignableRoles = useMemo(() => getAssignableRoles(currentUser), [currentUser]);

  const filteredUsers = pendingUsers.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.department && u.department.toLowerCase().includes(term)) ||
      (u.position && u.position.toLowerCase().includes(term))
    );
  });

  const handleApprove = async () => {
    if (!selectedUserForApproval || !currentUser) return;
    setIsProcessing(true);
    try {
      const resolvedCompanyId = isSuperAdmin
        ? targetCompanyId && targetCompanyId !== 'lumere-group'
          ? targetCompanyId
          : defaultWriteCompanyId
        : getUserCompanyId(currentUser);
      await DataService.approveUser(
        selectedUserForApproval.id,
        assignedRole,
        currentUser,
        resolvedCompanyId
      );
      const companyLabel = getCompanyById(resolvedCompanyId)?.name || resolvedCompanyId;
      const msg = `تمت الموافقة على انضمام ${selectedUserForApproval.displayName} برتبة ${getRoleArabicLabel(assignedRole)} في شركة ${companyLabel}.`;
      setActionSuccess(msg);
      showToast(msg, 'success');
      setSelectedUserForApproval(null);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      console.error('Approve error:', err);
      const errMsg = err instanceof Error ? err.message : 'تعذر اعتماد طلب الانضمام';
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleReject = async () => {
    if (!selectedUserForRejection || !currentUser) return;
    setIsProcessing(true);
    try {
      await DataService.rejectUser(
        selectedUserForRejection.id,
        rejectionReason,
        currentUser,
        selectedUserForRejection.companyId
      );
      const msg = `تم رفض طلب انضمام ${selectedUserForRejection.displayName}.`;
      setActionSuccess(msg);
      showToast(msg, 'info');
      setSelectedUserForRejection(null);
      setRejectionReason('');
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      console.error('Reject error:', err);
      const errMsg = err instanceof Error ? err.message : 'تعذر رفض طلب الانضمام';
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  return (
    <div id="join-requests-view" className="space-y-5" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">طلبات الانضمام والموظفين الجدد</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                مراجعة واعتماد طلبات الموظفين المسجلين حديثاً وتحديد صلاحياتهم في منظومة Luméré
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 tabular-nums">
            {pendingUsers.length} {pendingUsers.length === 1 ? 'طلب في الانتظار' : 'طلبات في الانتظار'}
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-[#E8F8EE] text-[#15803D] text-xs flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-3xl border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، البريد، القسم، أو المسمى الوظيفي..."
            className="w-full pr-10 pl-4 py-2 rounded-full bg-[#F1F3F5] border border-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
          />
        </div>
      </div>

      {/* Pending List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E8F8EE] flex items-center justify-center text-[#16A34A] mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">لا توجد طلبات انضمام معلقة حالياً</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            تمت معالجة كافة طلبات الموظفين الجدد بنجاح. ستظهر هنا أي حسابات جديدة فور إتمام تسجيلها.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUsers.map(user => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200/75 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                {/* User Top Info */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200/80"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-[#E8F8EE] flex items-center justify-center font-bold text-[#15803D] text-sm">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{user.displayName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px] font-mono dir-ltr">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full shrink-0">
                    بانتظار الاعتماد
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-[#F8F9FA] mb-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Layers className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                    <span className="truncate">
                      الشركة:{' '}
                      <strong className="text-slate-900">
                        {getCompanyById(user.companyId)?.name || user.companyName || 'LUMERE'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                    <span className="truncate">القسم: <strong className="text-slate-900">{user.department || 'عام'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">المسمى: <strong className="text-slate-900">{user.position || 'موظف'}</strong></span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate font-mono tabular-nums">{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate tabular-nums">التسجيل: {user.joinedDate || 'حديث'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  id={`btn-approve-user-${user.id}`}
                  onClick={() => {
                    setSelectedUserForApproval(user);
                    setAssignedRole('EMPLOYEE');
                    setTargetCompanyId(
                      user.companyId && user.companyId !== 'lumere-group'
                        ? user.companyId
                        : defaultWriteCompanyId
                    );
                  }}
                  className="flex-1 py-2.5 px-4 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>اعتماد وقبول</span>
                </button>

                <button
                  type="button"
                  id={`btn-reject-user-${user.id}`}
                  onClick={() => setSelectedUserForRejection(user)}
                  className="py-2.5 px-4 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>رفض</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <AnimatePresence>
        {selectedUserForApproval && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4"
            dir="rtl"
            onClick={() => !isProcessing && setSelectedUserForApproval(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="اعتماد طلب الانضمام"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5 text-[#15803D]">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F8EE] flex items-center justify-center">
                    <UserCheck className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">اعتماد طلب الانضمام</h3>
                </div>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setSelectedUserForApproval(null)}
                  className="w-8 h-8 rounded-full bg-[#F1F3F5] hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-4">
                سيتم تفعيل حساب <strong className="text-slate-900">{selectedUserForApproval.displayName}</strong> والسماح له بالدخول للنظام والوصول للمهام والمشاريع.
              </p>

              {/* Company & Role Selection */}
              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الشركة التابعة:
                  </label>
                  {isSuperAdmin ? (
                    <select
                      value={targetCompanyId}
                      onChange={e => setTargetCompanyId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full border border-transparent text-xs bg-[#F1F3F5] text-slate-900 focus:outline-none focus:bg-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
                    >
                      {subsidiaries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.arabicName ? `— ${c.arabicName}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-4 py-2.5 rounded-full bg-[#F1F3F5] text-xs font-semibold text-slate-800">
                      {activeCompany.name}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الصلاحية الممنوحة:
                  </label>
                  <select
                    value={assignedRole}
                    onChange={e => setAssignedRole(e.target.value as CanonicalRole)}
                    className="w-full px-4 py-2.5 rounded-full border border-transparent text-xs bg-[#F1F3F5] text-slate-900 focus:outline-none focus:bg-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
                  >
                    {(assignableRoles.length > 0 ? assignableRoles : (['EMPLOYEE'] as CanonicalRole[])).map(
                      r => (
                        <option key={r} value={r}>
                          {getRoleArabicLabel(r)} ({r})
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  id="btn-confirm-approve"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? 'جارِ المعالجة...' : 'تأكيد الموافقة والتفعيل'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserForApproval(null)}
                  disabled={isProcessing}
                  className="py-2.5 px-5 rounded-full bg-[#E8F8EE] hover:bg-[#DCFCE7] text-[#15803D] text-xs font-semibold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {selectedUserForRejection && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-4"
            dir="rtl"
            onClick={() => !isProcessing && setSelectedUserForRejection(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="رفض طلب الانضمام"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                    <UserX className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">رفض طلب الانضمام</h3>
                </div>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setSelectedUserForRejection(null)}
                  className="w-8 h-8 rounded-full bg-[#F1F3F5] hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-4">
                هل أنت متأكد من رغبتك في رفض طلب <strong className="text-slate-900">{selectedUserForRejection.displayName}</strong>؟
              </p>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  سبب الرفض (سيظهر للمستخدم):
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="مثال: يرجى استكمال بيانات التواصل، أو التواصل المباشر مع إدارة الموارد البشرية..."
                  rows={3}
                  className="w-full p-3.5 rounded-2xl border border-transparent bg-[#F1F3F5] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  id="btn-confirm-reject"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? 'جارِ المعالجة...' : 'تأكيد الرفض'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserForRejection(null)}
                  disabled={isProcessing}
                  className="py-2.5 px-5 rounded-full bg-[#E8F8EE] hover:bg-[#DCFCE7] text-[#15803D] text-xs font-semibold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
