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
  UserCheck,
  X,
  Layers,
  Globe,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { CompanySwitcher } from './CompanySwitcher';
import { getCompanyInitials, PARENT_COMPANY_ID } from '../../config/companies';
import { getRoleArabicLabel } from '../../utils/rbac';
import type { TabType } from '../../types';

export type { TabType };

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
}

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
  const { role, currentUser, isSuperAdmin, isCompanyAdmin, isManager } = useAuth();
  const { activeCompany, isGroupView } = useCompany();

  const groupNavItems: NavItem[] = isSuperAdmin
    ? [
        { id: 'group_dashboard', label: 'لوحة المجموعة المركزية', icon: Layers },
        { id: 'companies', label: 'جميع الشركات التابعة', icon: Globe },
      ]
    : [];

  const getWorkspaceNavItems = (): NavItem[] => {
    if (isSuperAdmin || isCompanyAdmin) {
      return [
        {
          id: 'dashboard',
          label: isGroupView ? 'ملخص العمليات الموحد' : 'لوحة تحكم الشركة',
          icon: LayoutDashboard,
        },
        { id: 'employees', label: 'فريق العمل', icon: Users },
        { id: 'projects', label: 'المشاريع', icon: FolderKanban },
        { id: 'tasks', label: 'المهام التنفيذية', icon: CheckSquare },
        { id: 'departments', label: 'الأقسام المؤسسية', icon: Building2 },
        { id: 'clients', label: 'العملاء والشركاء', icon: Building },
        { id: 'equipment', label: 'المعدات والأصول', icon: Package },
        {
          id: 'join_requests',
          label: 'طلبات الانضمام',
          icon: UserCheck,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          badgeColor: 'bg-amber-500',
        },
        { id: 'calendar', label: 'التقويم الزمني', icon: CalendarIcon },
        { id: 'reports', label: 'التقارير والمؤشرات', icon: BarChart3 },
        { id: 'activity', label: 'سجل العمليات', icon: History },
        {
          id: 'notifications',
          label: 'التنبيهات',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
        { id: 'settings', label: 'إعدادات النظام', icon: Settings },
      ];
    }

    if (isManager) {
      return [
        { id: 'departments', label: 'إدارة القسم', icon: Building2 },
        { id: 'dashboard', label: 'لوحة القسم', icon: LayoutDashboard },
        { id: 'tasks', label: 'مهام القسم', icon: CheckSquare },
        { id: 'projects', label: 'المشاريع', icon: FolderKanban },
        { id: 'employees', label: 'فريق القسم', icon: Users },
        { id: 'clients', label: 'العملاء والشركاء', icon: Building },
        { id: 'equipment', label: 'المعدات والأصول', icon: Package },
        { id: 'calendar', label: 'التقويم الزمني', icon: CalendarIcon },
        { id: 'reports', label: 'تقارير القسم', icon: BarChart3 },
        { id: 'activity', label: 'سجل العمليات', icon: History },
        {
          id: 'notifications',
          label: 'التنبيهات',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
        { id: 'profile', label: 'ملفي التعريفي', icon: UserIcon },
      ];
    }

    // EMPLOYEE
    return [
      { id: 'dashboard', label: 'لوحة الموظف', icon: LayoutDashboard },
      { id: 'tasks', label: 'مهامي التنفيذية', icon: CheckSquare },
      { id: 'calendar', label: 'التقويم الزمني', icon: CalendarIcon },
      {
        id: 'notifications',
        label: 'التنبيهات',
        icon: Bell,
        badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      },
      { id: 'profile', label: 'ملفي التعريفي', icon: UserIcon },
    ];
  };

  const navItems = getWorkspaceNavItems();

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const brandColor = activeCompany?.theme?.primary || '#059669';

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
        {/* Dynamic Active Company Brand Header */}
        <div className="h-18 px-4 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-3 min-w-0">
            {activeCompany.logo ? (
              <img
                src={activeCompany.logo}
                alt={activeCompany.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover border border-neutral-200 shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-wider shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {getCompanyInitials(activeCompany.name)}
              </div>
            )}
            <div className="min-w-0">
              <span className="font-serif tracking-wider text-base font-bold text-neutral-900 block truncate">
                {activeCompany.name}
              </span>
              <p className="text-[10px] text-neutral-500 font-medium truncate">
                {activeCompany.id === PARENT_COMPANY_ID
                  ? 'منظومة إدارة مجموعة الشركات'
                  : activeCompany.arabicName || activeCompany.businessSector || 'شركة تابعة'}
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

        {/* Company Switcher / Active Company Context */}
        <div className="px-3 py-2.5 border-b border-neutral-100 bg-neutral-50/50">
          <CompanySwitcher
            onCompanyChanged={cid => {
              if (cid === PARENT_COMPANY_ID) {
                onSelectTab('group_dashboard');
              } else if (currentTab === 'group_dashboard' || currentTab === 'companies') {
                onSelectTab('dashboard');
              }
              onCloseMobile();
            }}
          />
        </div>

        {/* Current Role Summary */}
        <div className="px-4 py-2.5 bg-neutral-50/40 border-b border-neutral-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isSuperAdmin || isCompanyAdmin ? (
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <UserIcon className="w-4 h-4 text-neutral-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-neutral-400">الصلاحية الحالية</p>
              <p className="text-xs font-bold text-neutral-800 truncate">
                {getRoleArabicLabel(role, currentUser?.email)}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {groupNavItems.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-neutral-400">إدارة المجموعة</p>
              {groupNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-950 font-bold'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-emerald-700' : 'text-neutral-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-1">
            {groupNavItems.length > 0 && (
              <p className="px-3 text-[10px] font-bold text-neutral-400">
                {isGroupView ? 'عمليات المجموعة' : `مساحة عمل ${activeCompany.name}`}
              </p>
            )}
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
                      ? 'bg-emerald-50 text-emerald-950 font-bold'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-emerald-700' : 'text-neutral-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white rounded-full tabular-nums ${
                        item.badgeColor || 'bg-emerald-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Card Footer */}
        <div className="p-3 border-t border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3 p-2 rounded-xl">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-neutral-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'LU'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-neutral-900 truncate">
                {currentUser?.displayName || 'مستخدم'}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {currentUser?.position || currentUser?.department || activeCompany.name}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
