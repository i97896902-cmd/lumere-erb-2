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
import { buildRouteUrl, isModifiedClick } from '../../utils/navigation';
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
  onCompanySwitched?: (companyId: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  unreadNotificationsCount: number;
  pendingRequestsCount?: number;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  onCompanySwitched,
  isOpenMobile,
  onCloseMobile,
  unreadNotificationsCount,
  pendingRequestsCount = 0,
}: SidebarProps) {
  const { role, currentUser, isSuperAdmin, isCompanyAdmin, isManager } = useAuth();
  const { activeCompany, activeCompanyId, isGroupView } = useCompany();

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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, tab: TabType) => {
    if (isModifiedClick(e)) {
      return;
    }
    e.preventDefault();
    onSelectTab(tab);
    onCloseMobile();
  };

  const getItemHref = (tab: TabType) =>
    buildRouteUrl({
      tab,
      companyId: activeCompanyId,
      includeCompanyParam: isSuperAdmin,
    });

  const getIconBgClass = (id: TabType) => {
    switch (id) {
      case 'group_dashboard':
        return 'bg-[#18181B]';
      case 'companies':
        return 'bg-indigo-600';
      case 'dashboard':
        return 'bg-[#22C55E]';
      case 'tasks':
        return 'bg-amber-500';
      case 'projects':
        return 'bg-purple-500';
      case 'calendar':
        return 'bg-rose-500';
      case 'employees':
        return 'bg-blue-500';
      case 'clients':
        return 'bg-pink-600';
      case 'departments':
        return 'bg-sky-500';
      case 'equipment':
        return 'bg-slate-500';
      case 'reports':
        return 'bg-teal-500';
      case 'join_requests':
        return 'bg-amber-500';
      case 'notifications':
        return 'bg-[#EF4444]';
      case 'activity':
        return 'bg-zinc-800';
      case 'settings':
        return 'bg-emerald-600';
      case 'profile':
      default:
        return 'bg-slate-600';
    }
  };

  const coreIds = new Set<TabType>(['dashboard', 'tasks', 'projects', 'calendar']);
  const mgmtIds = new Set<TabType>(['employees', 'clients', 'departments', 'equipment', 'reports']);
  const otherIds = new Set<TabType>(['join_requests', 'notifications', 'activity', 'settings', 'profile']);

  const coreNavItems = navItems.filter(item => coreIds.has(item.id));
  const mgmtNavItems = navItems.filter(item => mgmtIds.has(item.id));
  const otherNavItems = navItems.filter(item => otherIds.has(item.id));
  const fallbackNavItems = navItems.filter(
    item => !coreIds.has(item.id) && !mgmtIds.has(item.id) && !otherIds.has(item.id)
  );

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <a
        key={item.id}
        id={`nav-${item.id}`}
        href={getItemHref(item.id)}
        aria-current={isActive ? 'page' : undefined}
        onClick={e => handleNavClick(e, item.id)}
        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors duration-150 cursor-pointer ${
          isActive
            ? 'bg-[#DCFCE7] text-[#14532D] font-bold'
            : 'text-slate-700 font-medium hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ${getIconBgClass(
              item.id
            )}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge !== undefined && (
          <span
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold leading-none text-white bg-[#EF4444] rounded-full tabular-nums shrink-0"
          >
            {item.badge}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container (RTL Right-Aligned) */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-40 w-64 bg-[#F5F6F8] border-l border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        {/* Dynamic Active Company Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between bg-[#F5F6F8]">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeCompany.logo && (
              <img
                src={activeCompany.logo}
                alt={activeCompany.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <span className="tracking-tight text-sm font-extrabold text-slate-900 block truncate">
                {activeCompany.name}
              </span>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {activeCompany.id === PARENT_COMPANY_ID
                  ? 'منظومة إدارة مجموعة الشركات'
                  : activeCompany.arabicName || activeCompany.businessSector || 'شركة تابعة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <img
              src="/assets/aistudio/image_4888628b.png"
              alt="Luméré"
              className="h-10 w-auto shrink-0 object-contain hidden lg:block select-none"
            />
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
              aria-label="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Company Switcher / Active Company Context */}
        <div className="px-3 pb-2.5">
          <CompanySwitcher
            onCompanyChanged={cid => {
              if (onCompanySwitched) {
                onCompanySwitched(cid);
              } else if (cid === PARENT_COMPANY_ID) {
                onSelectTab('group_dashboard');
              } else if (currentTab === 'group_dashboard' || currentTab === 'companies') {
                onSelectTab('dashboard');
              }
              onCloseMobile();
            }}
          />
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-1 space-y-3 overflow-y-auto">
          {groupNavItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-semibold text-slate-400">إدارة المجموعة</p>
              <div className="bg-white rounded-2xl border border-slate-200/75 p-1.5 space-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                {groupNavItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {coreNavItems.length > 0 && (
            <div className="space-y-1.5">
              {groupNavItems.length > 0 && !isGroupView && (
                <p className="px-2 text-[11px] font-semibold text-slate-400">
                  {`مساحة عمل ${activeCompany.name}`}
                </p>
              )}
              <div className="bg-white rounded-2xl border border-slate-200/75 p-1.5 space-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                {coreNavItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {mgmtNavItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-semibold text-slate-400">الإدارة</p>
              <div className="bg-white rounded-2xl border border-slate-200/75 p-1.5 space-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                {mgmtNavItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {otherNavItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-semibold text-slate-400">أخرى</p>
              <div className="bg-white rounded-2xl border border-slate-200/75 p-1.5 space-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
                {otherNavItems.map(renderNavLink)}
              </div>
            </div>
          )}

          {fallbackNavItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/75 p-1.5 space-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
              {fallbackNavItems.map(renderNavLink)}
            </div>
          )}
        </nav>

        {/* User Card Footer */}
        <div className="p-3 bg-[#F5F6F8]">
          <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-white border border-slate-200/75 shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'LU'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.displayName || 'مستخدم'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {getRoleArabicLabel(role, currentUser?.email)}
                </p>
              </div>
            </div>
            {isSuperAdmin || isCompanyAdmin ? (
              <Shield className="w-4 h-4 text-[#22C55E] shrink-0" />
            ) : (
              <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
