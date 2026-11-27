import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RoleBadge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/data/dataService';
import { getUserCompanyId } from '../../utils/rbac';

export function ProfileView() {
  const { currentUser, role, refreshCurrentUser } = useAuth();
  const { getCompanyById } = useCompany();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [position, setPosition] = useState(currentUser?.position || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(currentUser?.displayName || '');
    setPosition(currentUser?.position || '');
  }, [currentUser?.id, currentUser?.displayName, currentUser?.position]);

  if (!currentUser) return null;

  const assignedCompanyId = getUserCompanyId(currentUser);
  const assignedCompany = getCompanyById(assignedCompanyId);
  const assignedCompanyLabel = assignedCompany?.name || currentUser.companyName || assignedCompanyId;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast('يرجى إدخال الاسم الكامل', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await DataService.updateUser(
        currentUser.id,
        {
          displayName: displayName.trim(),
          position: position.trim(),
        },
        currentUser
      );
      await refreshCurrentUser();
      showToast('تم تحديث الملف الشخصي بنجاح', 'success');
    } catch {
      showToast('تعذر تحديث الملف الشخصي', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">الملف الشخصي</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          إدارة بياناتك المهنية، المسمى الوظيفي، وهويتك المؤسسية في منظومة LUMERE GROUP.
        </p>
      </div>

      <Card className="p-6 sm:p-7 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-100 pb-6">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-[#22C55E] ring-offset-2"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#DCFCE7] text-[#15803D] ring-2 ring-[#22C55E] flex items-center justify-center font-bold text-xl">
              {currentUser.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-center sm:text-right space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">{currentUser.displayName}</h3>
              <RoleBadge role={role} />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {assignedCompanyLabel} • {currentUser.position || 'عضو فريق'} • {currentUser.department || 'عام'}
            </p>
            <p className="text-xs font-mono text-slate-400">{currentUser.email}</p>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="الاسم الكامل"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />

            <Input
              label="البريد المؤسسي"
              type="email"
              value={currentUser.email}
              disabled
              helperText="مرتبط بحساب Firebase Auth"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="الشركة التابع لها"
              value={assignedCompanyLabel}
              disabled
              helperText="تُدار من قِبل الإدارة المركزية"
            />

            <Input
              label="المسمى الوظيفي"
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="مثال: مصمم واجهات أول"
            />

            <Input
              label="القسم التابع له"
              value={currentUser.department || 'عام'}
              disabled
              helperText="معين من قِبل إدارة الشركة"
            />
          </div>

          <div className="flex justify-end pt-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
