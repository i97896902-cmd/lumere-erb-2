import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AUTH_DISABLED, AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Sidebar, TabType } from './components/navigation/Sidebar';
import { Navbar } from './components/navigation/Navbar';
import { GroupDashboardView } from './components/views/GroupDashboardView';
import { CompaniesManagementView } from './components/views/CompaniesManagementView';
import { DashboardView } from './components/views/DashboardView';
import { TasksView } from './components/views/TasksView';
import { ProjectsView } from './components/views/ProjectsView';
import { ClientsView } from './components/views/ClientsView';
import { EquipmentView } from './components/views/EquipmentView';
import { JoinRequestsView } from './components/views/JoinRequestsView';
import { CalendarView } from './components/views/CalendarView';
import { EmployeesView } from './components/views/EmployeesView';
import { DepartmentsView } from './components/views/DepartmentsView';
import { ReportsView } from './components/views/ReportsView';
import { ActivityLogView } from './components/views/ActivityLogView';
import { NotificationsView } from './components/views/NotificationsView';
import { SettingsView } from './components/views/SettingsView';
import { ProfileView } from './components/views/ProfileView';
import { LoginView } from './components/views/LoginView';
import { CompleteProfileView } from './components/views/CompleteProfileView';
import { PendingApprovalView } from './components/views/PendingApprovalView';
import { RejectedView } from './components/views/RejectedView';
import { CreateTaskModal } from './components/modals/CreateTaskModal';
import { TaskDetailsModal } from './components/modals/TaskDetailsModal';
import {
  Task,
  User,
  Department,
  Notification,
  ActivityLog,
  Client,
  Project,
  Equipment,
} from './types';
import { DataService } from './services/dataService';
import { DeadlinePushService } from './services/deadlinePushService';
import { getFirestoreSubscriptionScope } from './utils/appGuards';
import {
  canAccessTab,
  canManageCompanies,
  canManageCompanyUsers,
  canSwitchCompanies,
  canViewActivityLogs,
  canViewReports,
  getDefaultTabForRole,
  isPendingStatus,
  isRejectedStatus,
  isSuspendedStatus,
  scopeDepartmentsForUser,
  scopeEmployeesForUser,
  scopeTasksForUser,
} from './utils/rbac';
import { PARENT_COMPANY_ID } from './config/companies';
import {
  buildRouteUrl,
  getDocumentTitleForTab,
  parseRouteFromUrl,
  resolveInitialTab,
  syncBrowserHistory,
} from './utils/navigation';
import { AlertCircle } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function LumereAppContent() {
  const { currentUser, firebaseUser, role, loading, isProfileIncomplete, logout } = useAuth();
  const {
    companies,
    activeCompany,
    activeCompanyId,
    isGroupView,
    queryCompanyId,
    switchCompany,
    refreshCompanies,
  } = useCompany();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return parseRouteFromUrl(window.location.pathname, window.location.search).tab || 'dashboard';
  });
  const initializedRoleKeyRef = useRef<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const userCanSwitchCompanies = canSwitchCompanies(currentUser);

  // Modals (defined early so history/popstate handlers can sync ?task= cleanly)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTaskDefaultProjectId, setCreateTaskDefaultProjectId] = useState<string | undefined>();
  const [createTaskDefaultClientId, setCreateTaskDefaultClientId] = useState<string | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseRouteFromUrl(window.location.pathname, window.location.search).taskId;
  });
  const pushedTaskHistoryRef = useRef<string | null>(null);

  // Centralized navigation helper that updates React state and Browser History atomically
  const navigateToRoute = (
    targetTab: TabType,
    options?: {
      mode?: 'push' | 'replace';
      companyId?: string;
      taskId?: string | null;
      clearSearch?: boolean;
    }
  ) => {
    const mode = options?.mode ?? 'push';
    const nextCompanyId = options?.companyId ?? activeCompanyId;
    const nextIsGroupView = userCanSwitchCompanies && nextCompanyId === PARENT_COMPANY_ID;
    const allowedTab =
      currentUser && !canAccessTab(currentUser, targetTab)
        ? getDefaultTabForRole(role, nextIsGroupView)
        : targetTab;
    const effectiveMode = allowedTab !== targetTab ? 'replace' : mode;
    const nextTaskId = options?.taskId !== undefined ? options.taskId : null;

    setCurrentTab(allowedTab);
    setSelectedTaskId(nextTaskId);
    if (options?.clearSearch) {
      setGlobalSearchQuery('');
    }

    const targetUrl = buildRouteUrl({
      tab: allowedTab,
      companyId: nextCompanyId,
      taskId: nextTaskId,
      includeCompanyParam: userCanSwitchCompanies,
    });

    syncBrowserHistory(targetUrl, effectiveMode, {
      lumereNav: true,
      tab: allowedTab,
      companyId: nextCompanyId,
      taskId: nextTaskId,
    });
  };

  // Resolve initial route on login / page refresh while preserving valid deep links
  // Uses replaceState (never pushState) so pressing Back from the entry page returns cleanly to Google Search
  useEffect(() => {
    if (!currentUser) {
      initializedRoleKeyRef.current = null;
      return;
    }
    const roleKey = `${currentUser.id}:${role}`;
    if (initializedRoleKeyRef.current !== roleKey) {
      initializedRoleKeyRef.current = roleKey;
      const parsed = parseRouteFromUrl(window.location.pathname, window.location.search);

      let effectiveCompanyId = activeCompanyId;
      if (userCanSwitchCompanies && parsed.companyId) {
        const matched = companies.some(c => c.id === parsed.companyId);
        if (matched && parsed.companyId !== activeCompanyId) {
          switchCompany(parsed.companyId);
          effectiveCompanyId = parsed.companyId;
        }
      }

      const effectiveIsGroupView =
        userCanSwitchCompanies && effectiveCompanyId === PARENT_COMPANY_ID;
      const defaultTab = getDefaultTabForRole(role, effectiveIsGroupView);
      const { tab: initialTab } = resolveInitialTab({
        parsedRoute: parsed,
        defaultTab,
        canAccess: tab => canAccessTab(currentUser, tab),
      });

      setCurrentTab(initialTab);
      setSelectedTaskId(parsed.taskId);

      const canonicalUrl = buildRouteUrl({
        tab: initialTab,
        companyId: effectiveCompanyId,
        taskId: parsed.taskId,
        includeCompanyParam: userCanSwitchCompanies,
      });

      syncBrowserHistory(canonicalUrl, 'replace', {
        lumereNav: true,
        tab: initialTab,
        companyId: effectiveCompanyId,
        taskId: parsed.taskId,
      });
    }
  }, [currentUser, role, activeCompanyId, userCanSwitchCompanies, companies, switchCompany]);

  // Enforce strict route-level RBAC for every role without trapping Back navigation
  useEffect(() => {
    if (currentUser && !canAccessTab(currentUser, currentTab)) {
      const fallbackTab = getDefaultTabForRole(role, isGroupView);
      setCurrentTab(fallbackTab);
      const fallbackUrl = buildRouteUrl({
        tab: fallbackTab,
        companyId: activeCompanyId,
        includeCompanyParam: userCanSwitchCompanies,
      });
      syncBrowserHistory(fallbackUrl, 'replace', {
        lumereNav: true,
        tab: fallbackTab,
        companyId: activeCompanyId,
        taskId: null,
      });
    }
  }, [currentUser, currentTab, role, isGroupView, activeCompanyId, userCanSwitchCompanies]);

  // Listen to native Browser Back & Forward (popstate) events
  useEffect(() => {
    const handlePopState = () => {
      setIsMobileSidebarOpen(false);
      pushedTaskHistoryRef.current = null;
      const parsed = parseRouteFromUrl(window.location.pathname, window.location.search);

      if (!currentUser) {
        if (parsed.tab) setCurrentTab(parsed.tab);
        setSelectedTaskId(parsed.taskId);
        return;
      }

      let effectiveCompanyId = activeCompanyId;
      if (userCanSwitchCompanies) {
        const targetCompany =
          parsed.companyId && companies.some(c => c.id === parsed.companyId)
            ? parsed.companyId
            : PARENT_COMPANY_ID;
        if (targetCompany !== activeCompanyId) {
          switchCompany(targetCompany);
        }
        effectiveCompanyId = targetCompany;
      }

      const effectiveIsGroupView =
        userCanSwitchCompanies && effectiveCompanyId === PARENT_COMPANY_ID;
      const defaultTab = getDefaultTabForRole(role, effectiveIsGroupView);
      const { tab: resolvedTab, shouldReplaceUrl } = resolveInitialTab({
        parsedRoute: parsed,
        defaultTab,
        canAccess: tab => canAccessTab(currentUser, tab),
      });

      setCurrentTab(resolvedTab);
      setSelectedTaskId(parsed.taskId);

      if (shouldReplaceUrl) {
        const canonicalUrl = buildRouteUrl({
          tab: resolvedTab,
          companyId: effectiveCompanyId,
          taskId: parsed.taskId,
          includeCompanyParam: userCanSwitchCompanies,
        });
        syncBrowserHistory(canonicalUrl, 'replace', {
          lumereNav: true,
          tab: resolvedTab,
          companyId: effectiveCompanyId,
          taskId: parsed.taskId,
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, role, activeCompanyId, userCanSwitchCompanies, companies, switchCompany]);

  // Keep document.title synchronized so Chrome Back/Forward history dropdown shows exact page names
  useEffect(() => {
    if (!currentUser) {
      document.title = 'Luméré — نظام إدارة الشركة';
      return;
    }
    document.title = getDocumentTitleForTab(currentTab, activeCompany.name);
  }, [currentUser, currentTab, activeCompany.name]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);

    const handleDisplayModeChange = (event: MediaQueryListEvent) => setIsInstalled(event.matches);
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    const handleInstallPrompt = (event: Event) => {
      if (standalone) return;
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  // Core Data Collections (strictly scoped to queryCompanyId)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const subscriptionScope = getFirestoreSubscriptionScope({
    loading,
    isAuthenticated: AUTH_DISABLED ? Boolean(currentUser) : Boolean(firebaseUser && currentUser),
    isProfileIncomplete,
    status: currentUser?.status,
  });

  // Real-time subscriptions gated on auth + active company scope (resets state on company switch)
  const prevQueryCompanyRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevQueryCompanyRef.current !== undefined && prevQueryCompanyRef.current !== queryCompanyId) {
      setSelectedTaskId(null);
    }
    prevQueryCompanyRef.current = queryCompanyId;

    if (subscriptionScope === 'none') {
      setEmployees([]);
      setDepartments([]);
      setTasks([]);
      setActivityLogs([]);
      setClients([]);
      setProjects([]);
      setEquipment([]);
      setPendingUsers([]);
      return;
    }

    if (subscriptionScope === 'departments_only') {
      setEmployees([]);
      setTasks([]);
      setActivityLogs([]);
      setClients([]);
      setProjects([]);
      setEquipment([]);
      setPendingUsers([]);
      const unsubDepartments = DataService.subscribeDepartments(fetchedDepts => {
        setDepartments(fetchedDepts);
      }, null, true);
      return () => {
        unsubDepartments();
      };
    }

    // Clear prior company records immediately to prevent cross-company flash
    setEmployees([]);
    setDepartments([]);
    setTasks([]);
    setActivityLogs([]);
    setClients([]);
    setProjects([]);
    setEquipment([]);
    setPendingUsers([]);

    const unsubDepartments = DataService.subscribeDepartments(fetchedDepts => {
      setDepartments(fetchedDepts);
    }, queryCompanyId);

    const unsubEmployees = DataService.subscribeEmployees(fetchedEmployees => {
      setEmployees(fetchedEmployees);
    }, queryCompanyId);

    const unsubTasks = DataService.subscribeTasks(fetchedTasks => {
      setTasks(fetchedTasks);
    }, queryCompanyId);

    const unsubLogs = canViewActivityLogs(currentUser, queryCompanyId || activeCompanyId)
      ? DataService.subscribeActivityLogs(fetchedLogs => {
          setActivityLogs(fetchedLogs);
        }, queryCompanyId)
      : () => {};

    const unsubClients = DataService.subscribeClients(fetchedClients => {
      setClients(fetchedClients);
    }, queryCompanyId);

    const unsubProjects = DataService.subscribeProjects(fetchedProjects => {
      setProjects(fetchedProjects);
    }, queryCompanyId);

    const unsubEquipment = DataService.subscribeEquipment(fetchedEquipment => {
      setEquipment(fetchedEquipment);
    }, queryCompanyId);

    const unsubPendingUsers = canManageCompanyUsers(currentUser, queryCompanyId || activeCompanyId)
      ? DataService.subscribePendingUsers(fetchedPending => {
          setPendingUsers(fetchedPending);
        }, queryCompanyId)
      : () => {};

    return () => {
      unsubEmployees();
      unsubDepartments();
      unsubTasks();
      unsubLogs();
      unsubClients();
      unsubProjects();
      unsubEquipment();
      unsubPendingUsers();
    };
  }, [subscriptionScope, queryCompanyId, activeCompanyId, currentUser]);

  // Subscribe to Notifications for Current Active User
  useEffect(() => {
    if (subscriptionScope !== 'full' || !currentUser) {
      setNotifications([]);
      return;
    }
    const unsubNotifs = DataService.subscribeNotifications(
      currentUser.id,
      currentUser.role,
      userNotifs => {
        setNotifications(userNotifs);
      },
      queryCompanyId
    );
    return () => unsubNotifs();
  }, [subscriptionScope, currentUser, queryCompanyId]);

  // Handler to open task modal (pushes ?task= so browser Back closes the modal naturally)
  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    const taskUrl = buildRouteUrl({
      tab: currentTab,
      companyId: activeCompanyId,
      taskId,
      includeCompanyParam: userCanSwitchCompanies,
    });
    const pushed = syncBrowserHistory(taskUrl, 'push', {
      lumereNav: true,
      tab: currentTab,
      companyId: activeCompanyId,
      taskId,
    });
    if (pushed) {
      pushedTaskHistoryRef.current = taskId;
    }
  };

  const handleCloseTaskModal = () => {
    const closingId = selectedTaskId;
    setSelectedTaskId(null);

    if (
      closingId &&
      pushedTaskHistoryRef.current === closingId &&
      typeof window !== 'undefined' &&
      window.history.state?.lumereNav &&
      window.history.state?.taskId === closingId
    ) {
      pushedTaskHistoryRef.current = null;
      window.history.back();
      return;
    }

    pushedTaskHistoryRef.current = null;
    const cleanUrl = buildRouteUrl({
      tab: currentTab,
      companyId: activeCompanyId,
      taskId: null,
      includeCompanyParam: userCanSwitchCompanies,
    });
    syncBrowserHistory(cleanUrl, 'replace', {
      lumereNav: true,
      tab: currentTab,
      companyId: activeCompanyId,
      taskId: null,
    });
  };

  // Start automated background deadline push notification service
  useEffect(() => {
    DeadlinePushService.setOnTaskSelect(handleSelectTask);

    if (tasks.length > 0) {
      DeadlinePushService.startAutoScheduler(
        () => tasks,
        () => currentUser,
        60
      );
    }

    return () => {
      DeadlinePushService.stopAutoScheduler();
    };
  }, [tasks, currentUser]);

  const handleEnterCompanyWorkspace = (companyId: string) => {
    switchCompany(companyId);
    const nextTab: TabType =
      companyId === PARENT_COMPANY_ID ? 'group_dashboard' : 'dashboard';
    navigateToRoute(nextTab, { mode: 'push', companyId, taskId: null, clearSearch: true });
  };

  const handleCompanySwitchedFromSidebar = (companyId: string) => {
    const nextTab: TabType =
      companyId === PARENT_COMPANY_ID
        ? 'group_dashboard'
        : currentTab === 'group_dashboard' || currentTab === 'companies'
        ? 'dashboard'
        : currentTab;
    navigateToRoute(nextTab, { mode: 'push', companyId, taskId: null, clearSearch: true });
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    handleCloseTaskModal();
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks(prev => (prev.some(t => t.id === newTask.id) ? prev : [newTask, ...prev]));
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await DataService.markNotificationAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
      showToast('تعذر تحديث حالة التنبيه', 'error');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    try {
      await DataService.markAllNotificationsAsRead(currentUser.id);
      showToast('تم تحديد جميع التنبيهات كمقروءة', 'info');
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      showToast('تعذر تحديث حالة التنبيهات', 'error');
    }
  };

  const handleOpenCreateTaskWithContext = (defaultProjId?: string, defaultCliId?: string) => {
    setCreateTaskDefaultProjectId(defaultProjId);
    setCreateTaskDefaultClientId(defaultCliId);
    setIsCreateModalOpen(true);
  };

  const handleRefreshAllCollections = async () => {
    if (subscriptionScope !== 'full') return;
    try {
      const [emps, depts, clis, projs, tsks, equip] = await Promise.all([
        DataService.getEmployees(queryCompanyId),
        DataService.getDepartments(queryCompanyId),
        DataService.getClients(queryCompanyId),
        DataService.getProjects(queryCompanyId),
        DataService.getTasks(queryCompanyId),
        DataService.getEquipment(queryCompanyId),
      ]);
      await refreshCompanies();
      if (emps) setEmployees(emps);
      if (depts) setDepartments(depts);
      if (clis) setClients(clis);
      if (projs) setProjects(projs);
      if (tsks) setTasks(tsks);
      if (equip) setEquipment(equip);
    } catch (err) {
      console.error('Failed to refresh collections:', err);
    }
  };

  const scopedEmployees = useMemo(
    () => scopeEmployeesForUser(currentUser, employees),
    [currentUser, employees]
  );

  const scopedDepartments = useMemo(
    () => scopeDepartmentsForUser(currentUser, departments),
    [currentUser, departments]
  );

  const scopedTasks = useMemo(
    () => scopeTasksForUser(currentUser, tasks, employees),
    [currentUser, tasks, employees]
  );

  const handleSelectTabSafe = (tab: TabType) => {
    navigateToRoute(tab, { mode: 'push', taskId: null, clearSearch: true });
  };

  const selectedTask = scopedTasks.find(t => t.id === selectedTaskId) || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg text-white font-bold text-2xl tracking-wider border border-emerald-500/30 animate-bounce">
          L
        </div>
        <p className="mt-4 text-xs tracking-widest uppercase font-bold text-neutral-400">
          جارِ تهيئة منظومة LUMERE GROUP المؤسسية...
        </p>
      </div>
    );
  }

  // 1. Logged out -> Login View (only when auth is enabled)
  if (!AUTH_DISABLED && !currentUser) {
    return <LoginView />;
  }
  if (!currentUser) {
    return null;
  }

  // 2. Incomplete employee profile -> Onboarding with Company & Department selection
  if (isProfileIncomplete) {
    return <CompleteProfileView departments={departments} />;
  }

  // 3. Pending approval
  if (isPendingStatus(currentUser.status)) {
    return <PendingApprovalView />;
  }

  // 4. Rejected
  if (isRejectedStatus(currentUser.status)) {
    return <RejectedView />;
  }

  // 5. Suspended / Inactive
  if (isSuspendedStatus(currentUser.status)) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-2">الحساب موقوف مؤقتاً</h2>
          <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
            تم إيقاف صلاحيات الوصول لهذا الحساب من قِبل إدارة {activeCompany.name}. يرجى التواصل مع مسؤول النظام لمعرفة التفاصيل وإعادة التفعيل.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // Active Multi-Company Workspace with RTL Support
  return (
    <div className="min-h-screen bg-neutral-100 flex" dir="rtl">
      {installPrompt && !isInstalled && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl border-emerald-200 bg-white p-4 shadow-xl"
          role="status"
        >
          <p className="text-xs font-semibold text-neutral-800">
            ثبّت LUMERE GROUP للوصول السريع والعمل كتطبيق.
          </p>
          <button
            type="button"
            onClick={installApp}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            تثبيت التطبيق
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTabSafe}
        onCompanySwitched={handleCompanySwitchedFromSidebar}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadNotificationsCount={notifications.filter(n => !n.read).length}
        pendingRequestsCount={pendingUsers.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pr-64 min-w-0">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onSelectTask={handleSelectTask}
          onOpenNotificationsTab={() => handleSelectTabSafe('notifications')}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
          tasks={scopedTasks}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'group_dashboard' && canManageCompanies(currentUser) && (
            <GroupDashboardView
              companies={companies}
              employees={employees}
              departments={departments}
              clients={clients}
              projects={projects}
              tasks={tasks}
              activityLogs={activityLogs}
              onEnterCompany={handleEnterCompanyWorkspace}
              onOpenCompaniesManagement={() => handleSelectTabSafe('companies')}
              onOpenReports={() => handleSelectTabSafe('reports')}
            />
          )}

          {currentTab === 'companies' && canManageCompanies(currentUser) && (
            <CompaniesManagementView
              companies={companies}
              employees={employees}
              departments={departments}
              clients={clients}
              projects={projects}
              tasks={tasks}
              onEnterCompany={handleEnterCompanyWorkspace}
              onRefreshAll={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'dashboard' && canAccessTab(currentUser, 'dashboard') && (
            <DashboardView
              tasks={scopedTasks}
              employees={scopedEmployees}
              departments={scopedDepartments}
              activityLogs={activityLogs}
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
              onNavigateToTab={tab => handleSelectTabSafe(tab as TabType)}
            />
          )}

          {currentTab === 'tasks' && canAccessTab(currentUser, 'tasks') && (
            <TasksView
              tasks={scopedTasks}
              employees={scopedEmployees}
              departments={scopedDepartments}
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
              initialSearchQuery={globalSearchQuery}
            />
          )}

          {currentTab === 'projects' && canAccessTab(currentUser, 'projects') && (
            <ProjectsView
              projects={projects}
              clients={clients}
              tasks={scopedTasks}
              users={employees}
              departments={departments}
              onRefresh={handleRefreshAllCollections}
              onOpenCreateTask={(projId, cliId) => handleOpenCreateTaskWithContext(projId, cliId)}
              onSelectTask={task => handleSelectTask(task.id)}
            />
          )}

          {currentTab === 'clients' && canAccessTab(currentUser, 'clients') && (
            <ClientsView
              clients={clients}
              projects={projects}
              tasks={scopedTasks}
              onRefresh={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'equipment' && canAccessTab(currentUser, 'equipment') && (
            <EquipmentView
              equipment={equipment}
              employees={employees}
              projects={projects}
              onRefresh={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'join_requests' && canAccessTab(currentUser, 'join_requests') && (
            <JoinRequestsView
              pendingUsers={pendingUsers}
              departments={departments}
              onRefresh={() => handleRefreshAllCollections()}
            />
          )}

          {currentTab === 'calendar' && canAccessTab(currentUser, 'calendar') && (
            <CalendarView tasks={scopedTasks} onSelectTask={handleSelectTask} />
          )}

          {currentTab === 'employees' && canAccessTab(currentUser, 'employees') && (
            <EmployeesView
              employees={scopedEmployees}
              tasks={scopedTasks}
              departments={scopedDepartments}
              onSelectTask={handleSelectTask}
              onRefreshEmployees={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'departments' && canAccessTab(currentUser, 'departments') && (
            <DepartmentsView
              departments={scopedDepartments}
              tasks={scopedTasks}
              employees={scopedEmployees}
              onRefreshDepartments={handleRefreshAllCollections}
              onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
              onSelectTask={handleSelectTask}
              onNavigateToTab={tab => handleSelectTabSafe(tab)}
            />
          )}

          {currentTab === 'reports' && canViewReports(currentUser) && (
            <ReportsView tasks={scopedTasks} employees={scopedEmployees} departments={scopedDepartments} />
          )}

          {currentTab === 'activity' && canViewActivityLogs(currentUser) && (
            <ActivityLogView activityLogs={activityLogs} />
          )}

          {currentTab === 'notifications' && canAccessTab(currentUser, 'notifications') && (
            <NotificationsView
              notifications={notifications}
              tasks={scopedTasks}
              currentUser={currentUser}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onSelectTask={handleSelectTask}
            />
          )}

          {currentTab === 'settings' && canAccessTab(currentUser, 'settings') && (
            <SettingsView onRefreshAllData={handleRefreshAllCollections} />
          )}

          {currentTab === 'profile' && canAccessTab(currentUser, 'profile') && <ProfileView />}
        </main>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateTaskDefaultProjectId(undefined);
          setCreateTaskDefaultClientId(undefined);
        }}
        employees={employees}
        departments={departments}
        projects={projects}
        clients={clients}
        defaultProjectId={createTaskDefaultProjectId}
        defaultClientId={createTaskDefaultClientId}
        onTaskCreated={handleTaskCreated}
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={!!selectedTaskId}
        task={selectedTask}
        onClose={handleCloseTaskModal}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CompanyProvider>
          <LumereAppContent />
        </CompanyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
