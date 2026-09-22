import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Sidebar, TabType } from './components/navigation/Sidebar';
import { Navbar } from './components/navigation/Navbar';
import { DashboardView } from './components/views/DashboardView';
import { TasksView } from './components/views/TasksView';
import { ProjectsView } from './components/views/ProjectsView';
import { ClientsView } from './components/views/ClientsView';
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
import { Task, User, Department, Notification, ActivityLog, Client, Project } from './types';
import { DataService } from './services/dataService';
import { DeadlinePushService } from './services/deadlinePushService';
import { AlertCircle } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function LumereAppContent() {
  const { currentUser, loading, isProfileIncomplete, logout } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
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

  // Core Data Collections (empty by default, loaded from Firestore)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTaskDefaultProjectId, setCreateTaskDefaultProjectId] = useState<string | undefined>();
  const [createTaskDefaultClientId, setCreateTaskDefaultClientId] = useState<string | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Subscriptions to real-time collections
  useEffect(() => {
    const unsubEmployees = DataService.subscribeEmployees(fetchedEmployees => {
      setEmployees(fetchedEmployees);
    });

    const unsubDepartments = DataService.subscribeDepartments(fetchedDepts => {
      setDepartments(fetchedDepts);
    });

    const unsubTasks = DataService.subscribeTasks(fetchedTasks => {
      setTasks(fetchedTasks);
    });

    const unsubLogs = DataService.subscribeActivityLogs(fetchedLogs => {
      setActivityLogs(fetchedLogs);
    });

    const unsubClients = DataService.subscribeClients(fetchedClients => {
      setClients(fetchedClients);
    });

    const unsubProjects = DataService.subscribeProjects(fetchedProjects => {
      setProjects(fetchedProjects);
    });

    const unsubPendingUsers = DataService.subscribePendingUsers(fetchedPending => {
      setPendingUsers(fetchedPending);
    });

    return () => {
      unsubEmployees();
      unsubDepartments();
      unsubTasks();
      unsubLogs();
      unsubClients();
      unsubProjects();
      unsubPendingUsers();
    };
  }, []);

  // Subscribe to Notifications for Current User
  useEffect(() => {
    if (!currentUser) return;
    const unsubNotifs = DataService.subscribeNotifications(
      currentUser.id,
      currentUser.role,
      userNotifs => {
        setNotifications(userNotifs);
      }
    );
    return () => unsubNotifs();
  }, [currentUser]);

  // Start automated background deadline push notification service
  useEffect(() => {
    DeadlinePushService.setOnTaskSelect(handleSelectTask);

    if (tasks.length > 0) {
      DeadlinePushService.startAutoScheduler(
        () => tasks,
        () => currentUser,
        60 // check every 60 seconds
      );
    }

    return () => {
      DeadlinePushService.stopAutoScheduler();
    };
  }, [tasks, currentUser]);

  // Handler to open task modal
  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTaskId(null);
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks(prev => [newTask, ...prev]);
  };

  const handleMarkNotificationRead = async (id: string) => {
    await DataService.markNotificationAsRead(id);
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    await DataService.markAllNotificationsAsRead(currentUser.id);
    showToast('تم تحديد جميع التنبيهات كمقروءة', 'info');
  };

  const handleOpenCreateTaskWithContext = (defaultProjId?: string, defaultCliId?: string) => {
    setCreateTaskDefaultProjectId(defaultProjId);
    setCreateTaskDefaultClientId(defaultCliId);
    setIsCreateModalOpen(true);
  };

  const handleRefreshAllCollections = async () => {
    try {
      const [emps, depts, clis, projs, tsks] = await Promise.all([
        DataService.getEmployees(),
        DataService.getDepartments(),
        DataService.getClients(),
        DataService.getProjects(),
        DataService.getTasks(),
      ]);
      if (emps) setEmployees(emps);
      if (depts) setDepartments(depts);
      if (clis) setClients(clis);
      if (projs) setProjects(projs);
      if (tsks) setTasks(tsks);
    } catch (err) {
      console.error('Failed to refresh collections:', err);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg text-white font-bold text-2xl tracking-wider border border-emerald-500/30 animate-bounce">
          L
        </div>
        <p className="mt-4 text-xs tracking-widest uppercase font-bold text-neutral-400">
          جارِ تهيئة نظام Luméré المؤسسي...
        </p>
      </div>
    );
  }

  // 1. If user is explicitly logged out, render the Login View
  if (!currentUser) {
    return <LoginView />;
  }

  // 2. If new user needs to complete their profile (Department, Position, Phone)
  if (isProfileIncomplete) {
    return <CompleteProfileView departments={departments} />;
  }

  // 3. If user status is pending approval
  if (currentUser.status === 'pending') {
    return <PendingApprovalView />;
  }

  // 4. If user status was rejected by Admin
  if (currentUser.status === 'rejected') {
    return <RejectedView />;
  }

  // 5. If user status is suspended
  if (currentUser.status === 'suspended') {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-2">الحساب موقوف مؤقتاً</h2>
          <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
            تم إيقاف صلاحيات الوصول لهذا الحساب من قِبل إدارة Luméré. يرجى التواصل مع مسؤول النظام لمعرفة التفاصيل وإعادة التفعيل.
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

  // Normal Active Dashboard with RTL Support
  return (
    <div className="min-h-screen bg-neutral-100 flex" dir="rtl">
      {installPrompt && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl border-emerald-200 bg-white p-4 shadow-xl" role="status">
          <p className="text-xs font-semibold text-neutral-800">ثبّت Luméré للوصول السريع والعمل كتطبيق.</p>
          <button type="button" onClick={installApp} className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">تثبيت التطبيق</button>
        </div>
      )}
      {/* Sidebar Navigation (Right-Aligned in RTL) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          setGlobalSearchQuery('');
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadNotificationsCount={notifications.filter(n => !n.read).length}
        pendingRequestsCount={pendingUsers.length}
      />

      {/* Main Content Area (lg:pr-64 for right-side sidebar) */}
      <div className="flex-1 flex flex-col lg:pr-64 min-w-0">
        {/* Sticky Header Navbar */}
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onSelectTask={handleSelectTask}
          onOpenNotificationsTab={() => setCurrentTab('notifications')}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
          tasks={tasks}
        />

        {/* View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              tasks={tasks}
              employees={employees}
              departments={departments}
              activityLogs={activityLogs}
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
              onNavigateToTab={tab => setCurrentTab(tab as TabType)}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              employees={employees}
              departments={departments}
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => handleOpenCreateTaskWithContext()}
              initialSearchQuery={globalSearchQuery}
            />
          )}

          {currentTab === 'projects' && (
            <ProjectsView
              projects={projects}
              clients={clients}
              tasks={tasks}
              users={employees}
              departments={departments}
              onRefresh={handleRefreshAllCollections}
              onOpenCreateTask={(projId, cliId) => handleOpenCreateTaskWithContext(projId, cliId)}
              onSelectTask={task => setSelectedTaskId(task.id)}
            />
          )}

          {currentTab === 'clients' && (
            <ClientsView
              clients={clients}
              projects={projects}
              tasks={tasks}
              onRefresh={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'join_requests' && (
            <JoinRequestsView
              pendingUsers={pendingUsers}
              departments={departments}
              onRefresh={() => handleRefreshAllCollections()}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView tasks={tasks} onSelectTask={handleSelectTask} />
          )}

          {currentTab === 'employees' && (
            <EmployeesView
              employees={employees}
              tasks={tasks}
              departments={departments}
              onSelectTask={handleSelectTask}
              onRefreshEmployees={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentsView
              departments={departments}
              tasks={tasks}
              employees={employees}
              onRefreshDepartments={handleRefreshAllCollections}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView tasks={tasks} employees={employees} departments={departments} />
          )}

          {currentTab === 'activity' && <ActivityLogView activityLogs={activityLogs} />}

          {currentTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              tasks={tasks}
              currentUser={currentUser}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onSelectTask={handleSelectTask}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              onRefreshAllData={() => {
                handleRefreshAllCollections();
              }}
            />
          )}

          {currentTab === 'profile' && <ProfileView />}
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
        onClose={() => setSelectedTaskId(null)}
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
        <LumereAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
