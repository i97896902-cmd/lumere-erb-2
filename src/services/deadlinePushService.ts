import { Task, User, Notification as AppNotification } from '../types';
import { DataService } from './dataService';

export type DeadlineUrgency = 'overdue' | 'due_today' | 'due_tomorrow' | 'due_soon' | 'on_track';

export interface DeadlineCalculation {
  deadlineDate: Date;
  currentDate: Date;
  diffMs: number;
  diffHours: number;
  diffDays: number;
  isOverdue: boolean;
  urgency: DeadlineUrgency;
  humanReadableDiff: string;
  isApproaching: boolean;
}

export interface DeadlineServiceSettings {
  thresholdHours: number; // e.g., 24, 48, 72 hours
  includeOverdue: boolean;
  enableBrowserPush: boolean;
  enableAudioChime: boolean;
  enableInAppNotifications: boolean;
  checkIntervalSeconds: number;
  notifyManagersForUrgent: boolean;
}

export interface DeadlineCheckResult {
  timestamp: string;
  tasksEvaluated: number;
  approachingCount: number;
  overdueCount: number;
  notificationsTriggered: number;
  details: {
    taskId: string;
    taskTitle: string;
    assigneeId: string;
    deadline: string;
    diffHours: number;
    urgency: DeadlineUrgency;
    notificationSent: boolean;
    reason?: string;
  }[];
}

export interface DeadlineServiceStatus {
  isRunning: boolean;
  lastCheckedAt: string | null;
  lastResult: DeadlineCheckResult | null;
  browserPermission: NotificationPermission | 'unsupported';
  settings: DeadlineServiceSettings;
}

const STORAGE_SETTINGS_KEY = 'lumere_deadline_service_settings';
const STORAGE_NOTIFIED_KEY = 'lumere_deadline_notified_cache';

const DEFAULT_SETTINGS: DeadlineServiceSettings = {
  thresholdHours: 48, // 2 days default
  includeOverdue: true,
  enableBrowserPush: true,
  enableAudioChime: true,
  enableInAppNotifications: true,
  checkIntervalSeconds: 60, // check every minute
  notifyManagersForUrgent: true,
};

class DeadlinePushServiceManager {
  private timer: number | null = null;
  private settings: DeadlineServiceSettings;
  private isRunning = false;
  private lastCheckedAt: string | null = null;
  private lastResult: DeadlineCheckResult | null = null;
  private listeners: ((status: DeadlineServiceStatus) => void)[] = [];
  private onTaskSelectHandler: ((taskId: string) => void) | null = null;

  constructor() {
    this.settings = this.loadSettings();
  }

  public setOnTaskSelect(handler: (taskId: string) => void) {
    this.onTaskSelectHandler = handler;
  }

  public loadSettings(): DeadlineServiceSettings {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(newSettings: Partial<DeadlineServiceSettings>): DeadlineServiceSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save deadline settings to localStorage:', e);
    }
    this.notifyStatusChange();
    return this.settings;
  }

  public getSettings(): DeadlineServiceSettings {
    return { ...this.settings };
  }

  /**
   * Calculates the exact difference between current date/time and the task's deadline.
   */
  public calculateDeadlineInfo(deadlineStr: string, fromDate: Date = new Date()): DeadlineCalculation {
    const currentDate = fromDate;
    
    // Parse deadline. If YYYY-MM-DD, set to 23:59:59 of that day to reflect end-of-day deadline
    let deadlineDate: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineStr)) {
      const [year, month, day] = deadlineStr.split('-').map(Number);
      deadlineDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      deadlineDate = new Date(deadlineStr);
    }

    const diffMs = deadlineDate.getTime() - currentDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = diffMs < 0;

    let urgency: DeadlineUrgency = 'on_track';
    let isApproaching = false;
    let humanReadableDiff = '';

    if (isOverdue) {
      urgency = 'overdue';
      isApproaching = true;
      const overdueHours = Math.abs(Math.floor(diffHours));
      const overdueDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      humanReadableDiff = overdueDays > 0 ? `Overdue by ${overdueDays}d` : `Overdue by ${overdueHours}h`;
    } else if (diffHours <= 24) {
      urgency = 'due_today';
      isApproaching = true;
      const roundedHours = Math.max(1, Math.round(diffHours));
      humanReadableDiff = roundedHours === 1 ? 'Due in 1 hour' : `Due in ${roundedHours} hours`;
    } else if (diffHours <= 48) {
      urgency = 'due_tomorrow';
      isApproaching = true;
      humanReadableDiff = 'Due tomorrow';
    } else if (diffHours <= this.settings.thresholdHours) {
      urgency = 'due_soon';
      isApproaching = true;
      humanReadableDiff = `Due in ${diffDays} days`;
    } else {
      urgency = 'on_track';
      isApproaching = false;
      humanReadableDiff = `${diffDays} days remaining`;
    }

    return {
      deadlineDate,
      currentDate,
      diffMs,
      diffHours,
      diffDays,
      isOverdue,
      urgency,
      humanReadableDiff,
      isApproaching,
    };
  }

  /**
   * Evaluates all active tasks against current date and triggers push notifications
   * for tasks that are approaching their deadline.
   */
  public async checkApproachingDeadlines(
    tasks: Task[],
    currentUser?: User | null,
    forceCheck = false
  ): Promise<DeadlineCheckResult> {
    const now = new Date();
    this.lastCheckedAt = now.toISOString();

    const activeTasks = tasks.filter(
      t => t.status !== 'Completed' && t.status !== 'Cancelled'
    );

    let approachingCount = 0;
    let overdueCount = 0;
    let notificationsTriggered = 0;
    const details: DeadlineCheckResult['details'] = [];

    const notifiedCache = this.getNotifiedCache();
    const updatedCache = { ...notifiedCache };

    for (const task of activeTasks) {
      const calc = this.calculateDeadlineInfo(task.deadline, now);

      if (calc.isOverdue) {
        overdueCount++;
      }

      // Check if task is approaching deadline within configured threshold
      const shouldTrigger =
        (calc.isOverdue && this.settings.includeOverdue) ||
        (calc.diffHours >= 0 && calc.diffHours <= this.settings.thresholdHours);

      if (!shouldTrigger) {
        continue;
      }

      approachingCount++;

      // Cache key includes task ID, deadline date, and urgency stage to prevent repetitive spamming
      const cacheKey = `${task.id}_${task.deadline}_${calc.urgency}`;
      const lastSentTime = notifiedCache[cacheKey];
      const hoursSinceLastNotification = lastSentTime
        ? (now.getTime() - lastSentTime) / (1000 * 60 * 60)
        : Infinity;

      // Throttle: Only send at most once every 18 hours per urgency bucket unless forced
      const isThrottled = !forceCheck && hoursSinceLastNotification < 18;

      if (isThrottled) {
        details.push({
          taskId: task.id,
          taskTitle: task.title,
          assigneeId: task.assignedTo,
          deadline: task.deadline,
          diffHours: Math.round(calc.diffHours),
          urgency: calc.urgency,
          notificationSent: false,
          reason: `Already notified ${Math.round(hoursSinceLastNotification)}h ago`,
        });
        continue;
      }

      // Determine notification title and content
      let notifTitle = '';
      let notifBody = '';

      if (calc.urgency === 'overdue') {
        notifTitle = `⚠️ Task Overdue: ${task.title}`;
        notifBody = `Deadline passed on ${task.deadline} (${calc.humanReadableDiff}). Assigned to: ${task.assignedToName}. Immediate update required.`;
      } else if (calc.urgency === 'due_today') {
        notifTitle = `⏰ Deadline Today: ${task.title}`;
        notifBody = `Task is due today (${calc.humanReadableDiff})! Current progress: ${task.completionPercentage}%.`;
      } else if (calc.urgency === 'due_tomorrow') {
        notifTitle = `⏳ Deadline Tomorrow: ${task.title}`;
        notifBody = `Task deadline is tomorrow (${task.deadline}). Assigned to: ${task.assignedToName}.`;
      } else {
        notifTitle = `🔔 Deadline Approaching: ${task.title}`;
        notifBody = `Task is ${calc.humanReadableDiff} (${task.deadline}). Assigned to: ${task.assignedToName}.`;
      }

      let sent = false;

      // 1. Create In-App Firestore Notification for Assignee
      if (this.settings.enableInAppNotifications && task.assignedTo) {
        try {
          await DataService.createNotification({
            userId: task.assignedTo,
            title: notifTitle,
            message: notifBody,
            type: 'deadline_approaching',
            relatedTaskId: task.id,
            read: false,
            createdAt: now.toISOString(),
          });
          sent = true;

          // If Urgent priority and manager notification is enabled, notify managers/creator as well
          if (
            this.settings.notifyManagersForUrgent &&
            (task.priority === 'Urgent' || task.priority === 'High') &&
            task.createdBy &&
            task.createdBy !== task.assignedTo
          ) {
            await DataService.createNotification({
              userId: task.createdBy,
              title: `[Manager Alert] ${notifTitle}`,
              message: `High-priority task assigned to ${task.assignedToName} is approaching deadline (${task.deadline}).`,
              type: 'deadline_approaching',
              relatedTaskId: task.id,
              read: false,
              createdAt: now.toISOString(),
            });
          }
        } catch (err) {
          console.warn('Failed to save in-app deadline notification to Firestore:', err);
        }
      }

      // 2. Trigger Native Browser Web Push Notification
      // Only pop browser notification if current user is the assignee, or an admin
      const isRelevantUser =
        !currentUser ||
        currentUser.id === task.assignedTo ||
        currentUser.role === 'ADMIN';

      if (this.settings.enableBrowserPush && isRelevantUser) {
        this.sendNativeBrowserNotification(notifTitle, notifBody, task.id);
        sent = true;
      }

      // 3. Audio Chime (if enabled and relevant to current viewing user)
      if (this.settings.enableAudioChime && isRelevantUser) {
        this.playGentleChime();
      }

      if (sent) {
        notificationsTriggered++;
        updatedCache[cacheKey] = now.getTime();
      }

      details.push({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assignedTo,
        deadline: task.deadline,
        diffHours: Math.round(calc.diffHours),
        urgency: calc.urgency,
        notificationSent: sent,
      });
    }

    // Persist updated deduplication cache
    this.saveNotifiedCache(updatedCache);

    const result: DeadlineCheckResult = {
      timestamp: now.toISOString(),
      tasksEvaluated: activeTasks.length,
      approachingCount,
      overdueCount,
      notificationsTriggered,
      details,
    };

    this.lastResult = result;
    this.notifyStatusChange();
    return result;
  }

  /**
   * Browser Push Notification API Integration
   */
  public async requestBrowserPushPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    try {
      const perm = await Notification.requestPermission();
      this.notifyStatusChange();
      return perm;
    } catch {
      return 'denied';
    }
  }

  public getBrowserPushPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public triggerTestPush(): boolean {
    this.playGentleChime();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Luméré Deadline Service Alert', {
          body: 'Automated deadline monitor active. Push notifications are configured and operational!',
          icon: '/favicon.ico',
        });
        return true;
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }
    return false;
  }

  private sendNativeBrowserNotification(title: string, body: string, taskId?: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: taskId ? `lumere-deadline-${taskId}` : undefined,
        silent: !this.settings.enableAudioChime,
      });

      if (taskId && this.onTaskSelectHandler) {
        n.onclick = () => {
          window.focus();
          this.onTaskSelectHandler?.(taskId);
          n.close();
        };
      }
    } catch (e) {
      console.warn('Native notification display failed:', e);
    }
  }

  /**
   * Synthesized luxury sound chime using pure Web Audio API (zero external assets)
   */
  public playGentleChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      // Harmonious luxury chime: E5 (659Hz) and B5 (987Hz)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime + 0.08);
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch {
      // Ignored if user hasn't interacted with page yet
    }
  }

  /**
   * Starts automatic periodic evaluation loop
   */
  public startAutoScheduler(
    getTasks: () => Task[],
    getCurrentUser: () => User | null,
    intervalSeconds?: number
  ) {
    this.stopAutoScheduler();

    const intervalSec = intervalSeconds || this.settings.checkIntervalSeconds || 60;
    this.isRunning = true;

    // Initial check after short delay (3 seconds) to let app settle
    setTimeout(() => {
      if (this.isRunning) {
        this.checkApproachingDeadlines(getTasks(), getCurrentUser(), false).catch(console.error);
      }
    }, 3000);

    // Periodic check interval
    this.timer = window.setInterval(() => {
      if (this.isRunning) {
        this.checkApproachingDeadlines(getTasks(), getCurrentUser(), false).catch(console.error);
      }
    }, intervalSec * 1000);

    this.notifyStatusChange();
  }

  public stopAutoScheduler() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.notifyStatusChange();
  }

  public getStatus(): DeadlineServiceStatus {
    return {
      isRunning: this.isRunning,
      lastCheckedAt: this.lastCheckedAt,
      lastResult: this.lastResult,
      browserPermission: this.getBrowserPushPermissionStatus(),
      settings: this.getSettings(),
    };
  }

  public subscribeStatus(callback: (status: DeadlineServiceStatus) => void): () => void {
    this.listeners.push(callback);
    callback(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyStatusChange() {
    const status = this.getStatus();
    this.listeners.forEach(l => {
      try {
        l(status);
      } catch (e) {
        console.error('Error notifying deadline status listener:', e);
      }
    });
  }

  private getNotifiedCache(): Record<string, number> {
    try {
      const raw = localStorage.getItem(STORAGE_NOTIFIED_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  }

  private saveNotifiedCache(cache: Record<string, number>) {
    try {
      // Clean entries older than 7 days
      const now = Date.now();
      const pruned: Record<string, number> = {};
      for (const [k, timestamp] of Object.entries(cache)) {
        if (now - timestamp < 7 * 24 * 3600 * 1000) {
          pruned[k] = timestamp;
        }
      }
      localStorage.setItem(STORAGE_NOTIFIED_KEY, JSON.stringify(pruned));
    } catch {
      // ignore
    }
  }

  /**
   * Helper to retrieve all approaching tasks for UI display
   */
  public getApproachingTasks(tasks: Task[]): { task: Task; calc: DeadlineCalculation }[] {
    const now = new Date();
    return tasks
      .filter(t => t.status !== 'Completed' && t.status !== 'Cancelled')
      .map(task => ({
        task,
        calc: this.calculateDeadlineInfo(task.deadline, now),
      }))
      .filter(item => item.calc.isApproaching)
      .sort((a, b) => a.calc.diffMs - b.calc.diffMs);
  }
}

export const DeadlinePushService = new DeadlinePushServiceManager();
