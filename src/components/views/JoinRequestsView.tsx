import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Role, Department } from '../../types';
import { DataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import {
  UserCheck,
  UserX,
  Clock,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Shield,
  Search,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';

interface JoinRequestsViewProps {
  pendingUsers: User[];
  departments?: Department[];
  onRefresh?: () => void;
}

export const JoinRequestsView: React.FC<JoinRequestsViewProps> = ({ pendingUsers, departments, onRefresh }) => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserForApproval, setSelectedUserForApproval] = useState<User | null>(null);
  const assignedRole: Role = 'EMPLOYEE';
  const [selectedUserForRejection, setSelectedUserForRejection] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
      await DataService.approveUser(selectedUserForApproval.id, 'EMPLOYEE', currentUser);
      setActionSuccess(`تمت الموافقة على انضمام ${selectedUserForApproval.displayName} بنجاح وتفعيله كموظف.`);
      setSelectedUserForApproval(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Approve error:', err);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleReject = async () => {
    if (!selectedUserForRejection || !currentUser) return;
    setIsProcessing(true);
    try {
      await DataService.rejectUser(selectedUserForRejection.id, rejectionReason, currentUser);
      setActionSuccess(`تم رفض طلب انضمام ${selectedUserForRejection.displayName}.`);
      setSelectedUserForRejection(null);
      setRejectionReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Reject error:', err);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  return (
    <div id="join-requests-view" className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">طلبات الانضمام والموظفين الجدد</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                مراجعة واعتماد طلبات الموظفين المسجلين حديثاً وتحديد صلاحياتهم في منظومة Luméré
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
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
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، البريد، القسم، أو المسمى الوظيفي..."
            className="w-full pr-9 pl-4 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Pending List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 mb-1">لا توجد طلبات انضمام معلقة حالياً</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
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
              className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-2xs flex flex-col justify-between hover:border-neutral-300 transition-colors"
            >
              <div>
                {/* User Top Info */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-200 shadow-2xs"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{user.displayName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                        <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="truncate max-w-[180px] font-mono dir-ltr">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full shrink-0">
                    بانتظار الاعتماد
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-4 text-xs">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">القسم: <strong className="text-neutral-900">{user.department || 'عام'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">المسمى: <strong className="text-neutral-900">{user.position || 'موظف'}</strong></span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate font-mono">{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">التسجيل: {user.joinedDate || 'حديث'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                <button
                  id={`btn-approve-user-${user.id}`}
                  onClick={() => {
                    setSelectedUserForApproval(user);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>اعتماد وقبول</span>
                </button>

                <button
                  id={`btn-reject-user-${user.id}`}
                  onClick={() => setSelectedUserForRejection(user)}
                  className="py-2 px-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-2.5 text-emerald-800">
                  <UserCheck className="w-5 h-5" />
                  <h3 className="font-bold text-base text-neutral-900">اعتماد طلب الانضمام</h3>
                </div>
                <button
                  onClick={() => setSelectedUserForApproval(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-600 mb-4">
                سيتم تفعيل حساب <strong className="text-neutral-900">{selectedUserForApproval.displayName}</strong> والسماح له بالدخول للنظام والوصول للمهام والمشاريع.
              </p>

              {/* Role Selection */}
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-semibold text-neutral-700">
                  الصلاحية الممنوحة:
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 rounded-xl border-emerald-600 bg-emerald-50/80 text-center text-emerald-900 font-bold">
                    <span className="block text-xs">موظف</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">Employee (تنفيذ المهام)</span>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="btn-confirm-approve"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? 'جارِ المعالجة...' : 'تأكيد الموافقة والتفعيل'}
                </button>
                <button
                  onClick={() => setSelectedUserForApproval(null)}
                  disabled={isProcessing}
                  className="py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-2.5 text-rose-700">
                  <UserX className="w-5 h-5" />
                  <h3 className="font-bold text-base text-neutral-900">رفض طلب الانضمام</h3>
                </div>
                <button
                  onClick={() => setSelectedUserForRejection(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-600 mb-4">
                هل أنت متأكد من رغبتك في رفض طلب <strong className="text-neutral-900">{selectedUserForRejection.displayName}</strong>؟
              </p>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  سبب الرفض (سيظهر للمستخدم):
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="مثال: يرجى استكمال بيانات التواصل، أو التواصل المباشر مع إدارة الموارد البشرية..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-neutral-300 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-confirm-reject"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? 'جارِ المعالجة...' : 'تأكيد الرفض'}
                </button>
                <button
                  onClick={() => setSelectedUserForRejection(null)}
                  disabled={isProcessing}
                  className="py-2.5 px-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium"
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
