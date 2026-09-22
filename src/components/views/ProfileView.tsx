import React, { useState } from 'react';
import { User as UserIcon, Mail, Building2, Briefcase, Calendar, Shield, Save } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RoleBadge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataService } from '../../services/dataService';

export function ProfileView() {
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [position, setPosition] = useState(currentUser?.position || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <h2 className="text-xl font-bold text-neutral-900">الملف الشخصي</h2>
        <p className="text-xs text-neutral-500">
          إدارة بياناتك المهنية، المسمى الوظيفي، وهويتك المؤسسية في منظومة Luméré.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-neutral-100 pb-6">
          <img
            src={currentUser.photoURL}
            alt={currentUser.displayName}
            className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-md"
          />
          <div className="text-center sm:text-right space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="text-lg font-bold text-neutral-900">{currentUser.displayName}</h3>
              <RoleBadge role={role} />
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              {currentUser.position || 'عضو فريق'} • {currentUser.department}
            </p>
            <p className="text-xs font-mono text-neutral-400">{currentUser.email}</p>
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
              helperText="مرتبط بحساب Google المؤسسي"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="المسمى الوظيفي"
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="مثال: مصمم واجهات أول"
            />

            <Input
              label="القسم التابع له"
              value={currentUser.department}
              disabled
              helperText="معين من قِبل إدارة النظام"
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
