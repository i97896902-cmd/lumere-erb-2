import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Building,
  Calendar as CalendarIcon,
  Users,
  Building2,
  BarChart3,
  History,
  Bell,
  Settings,
  User as UserIcon,
  Shield,
  Briefcase,
  UserCheck,
  X,
} from 'lucide-react';
import { Role } from '../../types';
import { useAuth } from '../../context/AuthContext';

export type TabType =
  | 'dashboard'
  | 'tasks'
  | 'projects'
  | 'clients'
  | 'join_requests'
  | 'calendar'
  | 'employees'
  | 'departments'
  | 'reports'
  | 'activity'
  | 'notifications'
  | 'settings'
  | 'profile';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  unreadNotificationsCount: number;
  pendingRequestsCount?: number;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  unreadNotificationsCount,
  pendingRequestsCount = 0,
}: SidebarProps) {
  const { role, currentUser } = useAuth();

  const getNavItems = () => {
    if (role === 'ADMIN') {
      return [
        { id: 'dashboard' as TabType, label: 'لوحة التحكم', icon: LayoutDashboard },
        { id: 'tasks' as TabType, label: 'المهام التنفيذية', icon: CheckSquare },
        { id: 'projects' as TabType, label: 'المشاريع', icon: FolderKanban },
        { id: 'clients' as TabType, label: 'العملاء والشركاء', icon: Building },
        {
          id: 'join_requests' as TabType,
          label: 'طلبات الانضمام',
          icon: UserCheck,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          badgeColor: 'bg-amber-500',
        },
        { id: 'calendar' as TabType, label: 'التقويم الزمني', icon: CalendarIcon },
        { id: 'employees' as TabType, label: 'فريق العمل', icon: Users },
        { id: 'departments' as TabType, label: 'الأقسام المؤسسية', icon: Building2 },
        { id: 'reports' as TabType, label: 'التقارير والمؤشرات', icon: BarChart3 },
        { id: 'activity' as TabType, label: 'سجل العمليات', icon: History },
        {
          id: 'notifications' as TabType,
          label: 'التنبيهات',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
        { id: 'settings' as TabType, label: 'إعدادات النظام', icon: Settings },
      ];
    }

    // EMPLOYEE
    return [
      { id: 'dashboard' as TabType, label: 'لوحة التحكم', icon: LayoutDashboard },
      { id: 'tasks' as TabType, label: 'مهامي التنفيذية', icon: CheckSquare },
      { id: 'projects' as TabType, label: 'المشاريع', icon: FolderKanban },
      { id: 'clients' as TabType, label: 'العملاء والشركاء', icon: Building },
      { id: 'calendar' as TabType, label: 'التقويم الزمني', icon: CalendarIcon },
      {
        id: 'notifications' as TabType,
        label: 'التنبيهات',
        icon: Bell,
        badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      },
      { id: 'profile' as TabType, label: 'ملفي التعريفي', icon: UserIcon },
    ];
  };

  const navItems = getNavItems();

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const getRoleArabicTitle = () => {
    if (role === 'ADMIN') return 'مدير النظام (Admin)';
    return 'موظف تنفيذي (Employee)';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container (RTL Right-Aligned) */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-40 w-64 bg-white border-l border-neutral-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        {/* Brand Header */}
        <div className="h-18 px-5 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-xs text-white font-bold text-lg tracking-wider border border-emerald-500/30">
              L
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif tracking-widest text-lg font-bold text-neutral-900">
                  LUMÉRÉ
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
              <p className="text-[10px] tracking-wider uppercase text-neutral-400 font-semibold">
                نظام إدارة المهام المؤسسي
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-neutral-400 hover:text-neutral-700"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Role Banner */}
        <div className="px-4 py-3 bg-neutral-50/80 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {role === 'ADMIN' ? (
              <Shield className="w-4 h-4 text-emerald-600" />
            ) : (
              <UserIcon className="w-4 h-4 text-neutral-600" />
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                الصلاحية الحالية
              </p>
              <p className="text-xs font-bold text-neutral-800">
                {getRoleArabicTitle()}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              role === 'ADMIN'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-200 text-neutral-800'
            }`}
          >
            {role}
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-emerald-700' : 'text-neutral-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white rounded-full ${
                      item.badgeColor || 'bg-emerald-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card Footer */}
        <div className="p-3 border-t border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="relative">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'LU'}
                </div>
              )}
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-neutral-900 truncate">
                {currentUser?.displayName || 'مستخدم'}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {currentUser?.position || currentUser?.department || 'فريق Luméré'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
