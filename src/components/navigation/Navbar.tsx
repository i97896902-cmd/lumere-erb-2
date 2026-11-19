import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  Plus,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { RoleBadge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { Notification, Task } from '../../types';
import { canCreateTask, getRoleArabicLabel } from '../../utils/rbac';

interface NavbarProps {
  onOpenMobileSidebar: () => void;
  onOpenCreateTask: () => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onSelectTask: (taskId: string) => void;
  onOpenNotificationsTab: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  tasks: Task[];
}

export function Navbar({
  onOpenMobileSidebar,
  onOpenCreateTask,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSelectTask,
  onOpenNotificationsTab,
  searchQuery,
  onSearchChange,
  tasks,
}: NavbarProps) {
  const { currentUser, role, logout } = useAuth();
  const { activeCompany, defaultWriteCompanyId, isGroupView } = useCompany();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const userCanCreateTask = canCreateTask(currentUser, defaultWriteCompanyId);

  const filteredTasks = searchQuery.trim()
    ? tasks
        .filter(
          t =>
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.taskId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.department.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <header
      className="sticky top-0 z-30 h-18 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-6 flex items-center justify-between gap-4"
      dir="rtl"
    >
      {/* Right (Start in RTL): Mobile Hamburger, Active Context & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors shrink-0"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Active Company Breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-500 whitespace-nowrap shrink-0">
          <span className="font-bold text-neutral-900">{activeCompany.name}</span>
          <span aria-hidden="true">/</span>
          <span>{isGroupView ? 'جميع الشركات' : activeCompany.arabicName || 'مساحة الشركة'}</span>
        </div>

        {/* Global Search Input */}
        <div ref={searchRef} className="relative flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              id="global-task-search"
              value={searchQuery}
              onChange={e => {
                onSearchChange(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder={`بحث في مهام ${activeCompany.name}...`}
              className="w-full pr-9 pl-4 py-2 text-xs bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white rounded-xl border border-transparent focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 transition-all outline-hidden"
            />
          </div>

          {showSearchResults && searchQuery.trim() && (
            <div className="absolute top-full right-0 left-0 mt-1.5 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden z-50">
              <div className="p-2 border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 tabular-nums">
                نتائج البحث ({filteredTasks.length})
              </div>
              {filteredTasks.length > 0 ? (
                <div className="py-1 max-h-64 overflow-y-auto">
                  {filteredTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => {
                        onSelectTask(task.id);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-right px-3.5 py-2.5 hover:bg-neutral-50 flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {task.taskId}
                          </span>
                          <span className="text-xs font-medium text-neutral-900 truncate max-w-[220px]">
                            {task.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                          {task.department} · المكلف: {task.assignedToName}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-neutral-600 shrink-0">
                        {task.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-neutral-500">
                  لا توجد مهام مطابقة لـ &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Left (End in RTL): Create Task, Notifications, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {userCanCreateTask && (
          <Button
            id="btn-create-task-navbar"
            onClick={onOpenCreateTask}
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-xs whitespace-nowrap shrink-0"
          >
            <span className="hidden md:inline">مهمة جديدة</span>
            <span className="md:hidden">إضافة</span>
          </Button>
        )}

        {/* Notifications Popover */}
        <div ref={notifMenuRef} className="relative">
          <button
            id="btn-notifications-bell"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
            aria-label="عرض التنبيهات"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 left-1 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white tabular-nums">
                {unreadCount > 9 ? '+9' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-neutral-200 shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-900">التنبيهات</h4>
                  {unreadCount > 0 && (
                    <span className="text-xs text-emerald-700 font-semibold tabular-nums">
                      · {unreadCount} جديد
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-neutral-50 transition-colors cursor-pointer flex gap-3 ${
                        !n.read ? 'bg-emerald-50/30' : ''
                      }`}
                      onClick={() => {
                        onMarkNotificationRead(n.id);
                        if (n.relatedTaskId) onSelectTask(n.relatedTaskId);
                        setShowNotifMenu(false);
                      }}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === 'task_assigned' && (
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {n.type === 'task_approved' && (
                          <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {n.type === 'deadline_approaching' && (
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {n.type !== 'task_assigned' &&
                          n.type !== 'task_approved' &&
                          n.type !== 'deadline_approaching' && (
                            <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                              <Bell className="w-3.5 h-3.5" />
                            </div>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 truncate">{n.title}</p>
                        <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-neutral-400">
                    لا توجد تنبيهات حالياً
                  </div>
                )}
              </div>

              <div className="p-2.5 border-t border-neutral-100 text-center bg-neutral-50/50">
                <button
                  onClick={() => {
                    onOpenNotificationsTab();
                    setShowNotifMenu(false);
                  }}
                  className="text-xs font-semibold text-neutral-600 hover:text-emerald-700 cursor-pointer"
                >
                  عرض كافة التنبيهات
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-neutral-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs font-bold">
                {currentUser?.displayName?.slice(0, 2).toUpperCase() || 'LU'}
              </div>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-neutral-900 leading-tight">
                {currentUser?.displayName || 'عضو الفريق'}
              </p>
              <p className="text-[10px] text-neutral-500 leading-tight">
                {getRoleArabicLabel(role, currentUser?.email)}
              </p>
            </div>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-neutral-400" />
          </button>

          {showUserMenu && (
            <div className="absolute left-0 mt-2 w-60 bg-white rounded-xl border border-neutral-200 shadow-xl p-2 z-50">
              <div className="px-3 py-2 border-b border-neutral-100 mb-1 text-right">
                <p className="text-xs font-bold text-neutral-900">{currentUser?.displayName}</p>
                <p className="text-[11px] text-neutral-500 truncate text-right">
                  {currentUser?.email}
                </p>
                <div className="mt-1.5 flex justify-end">
                  <RoleBadge role={role} />
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center justify-end gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <span>تسجيل الخروج</span>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
