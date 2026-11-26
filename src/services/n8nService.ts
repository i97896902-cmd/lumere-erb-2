import { Task, TaskPriority, TaskStatus } from '../types';

export type N8nTaskEvent = 'task.created' | 'task.status_updated';

export const DEFAULT_N8N_WEBHOOK_PATH = '/webhook/lumere-tasks';
export const DEFAULT_N8N_WEBHOOK_URL = 'https://hassan20300.app.n8n.cloud/webhook/lumere-tasks';
export const DEFAULT_N8N_SPREADSHEET_ID = '1Ry4Bsmo7gWZuCxZhQ-YOZN2_vt1-fKFmEg9NMIbWYCM';
export const DEFAULT_N8N_MAPPING_SHEET_NAME = 'Employees_Telegram_Map';

export interface N8nTaskWebhookPayload {
  event: N8nTaskEvent;
  timestamp: string;
  appUrl: string;
  googleSpreadsheetId: string;
  mappingSheetName: string;
  task: {
    id: string;
    taskCode: string;
    title: string;
    description: string;
    department: string;
    projectName: string;
    priority: TaskPriority;
    priorityAr: string;
    status: TaskStatus;
    statusAr: string;
    completionPercentage: number;
    startDate: string;
    deadline: string;
    createdDate: string;
  };
  employee: {
    name: string;
    email: string;
    sheetTabName: string;
  };
}

export interface N8nDispatchResult {
  sent: boolean;
  status?: number;
  reason?: string;
}

const PRIORITY_AR_MAP: Record<TaskPriority, string> = {
  Low: 'منخفضة',
  Medium: 'متوسطة',
  High: 'عالية',
  Urgent: 'عاجلة جداً',
};

const STATUS_AR_MAP: Record<TaskStatus, string> = {
  Pending: 'قيد الانتظار',
  'In Progress': 'قيد التنفيذ',
  Review: 'قيد المراجعة',
  Completed: 'مكتملة',
  Rejected: 'مرفوضة',
  Cancelled: 'ملغاة',
};

export function translateTaskPriorityAr(priority: TaskPriority | string | undefined): string {
  if (!priority) return PRIORITY_AR_MAP.Medium;
  return PRIORITY_AR_MAP[priority as TaskPriority] || String(priority);
}

export function translateTaskStatusAr(status: TaskStatus | string | undefined): string {
  if (!status) return STATUS_AR_MAP.Pending;
  return STATUS_AR_MAP[status as TaskStatus] || String(status);
}

export function sanitizeSheetTabName(rawName: string | undefined): string {
  const normalized = (rawName || 'Employee_Tasks')
    .toString()
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return normalized || 'Employee_Tasks';
}

export function resolveN8nWebhookUrl(rawUrl: string | undefined): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = DEFAULT_N8N_WEBHOOK_PATH;
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function getRuntimeEnv(key: string): string {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      : undefined;
  if (viteEnv && typeof viteEnv[key] === 'string') {
    return viteEnv[key] || '';
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key] || '';
  }
  return '';
}

function resolveDefaultAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function buildN8nTaskWebhookPayload(params: {
  event: N8nTaskEvent;
  task: Task;
  timestamp?: string;
  appUrl?: string;
  googleSpreadsheetId?: string;
  mappingSheetName?: string;
}): N8nTaskWebhookPayload {
  const { task, event } = params;
  const timestamp = params.timestamp || new Date().toISOString();
  const appUrl =
    params.appUrl !== undefined
      ? params.appUrl
      : task.id
        ? `${resolveDefaultAppUrl()}/tasks?taskId=${encodeURIComponent(task.id)}`
        : resolveDefaultAppUrl();

  const googleSpreadsheetId =
    (params.googleSpreadsheetId || '').trim() || DEFAULT_N8N_SPREADSHEET_ID;
  const mappingSheetName =
    (params.mappingSheetName || '').trim() || DEFAULT_N8N_MAPPING_SHEET_NAME;

  const employeeEmail = (task.assignedToEmail || '').toLowerCase().trim();
  const employeeName = (task.assignedToName || employeeEmail || 'Employee').trim();
  const taskCode = (task.taskId || task.id || 'LMR-000').trim();
  const createdDate = (task.createdAt || timestamp).slice(0, 10);

  return {
    event,
    timestamp,
    appUrl,
    googleSpreadsheetId,
    mappingSheetName,
    task: {
      id: task.id,
      taskCode,
      title: task.title || 'مهمة جديدة',
      description: task.description || '',
      department: task.department || '',
      projectName: task.projectName || 'عام',
      priority: task.priority || 'Medium',
      priorityAr: translateTaskPriorityAr(task.priority),
      status: task.status || 'Pending',
      statusAr: translateTaskStatusAr(task.status),
      completionPercentage: Number.isFinite(Number(task.completionPercentage))
        ? Number(task.completionPercentage)
        : 0,
      startDate: task.startDate || '',
      deadline: task.deadline || '',
      createdDate,
    },
    employee: {
      name: employeeName,
      email: employeeEmail,
      sheetTabName: sanitizeSheetTabName(employeeName),
    },
  };
}

function isRunningUnderNodeTest(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(
    process.env?.NODE_TEST_CONTEXT ||
      (Array.isArray(process.argv) && process.argv.some(arg => arg.includes('--test')))
  );
}

export function getEffectiveN8nWebhookUrl(overrideUrl?: string): string {
  if (overrideUrl !== undefined) {
    return resolveN8nWebhookUrl(overrideUrl);
  }
  const envUrl = resolveN8nWebhookUrl(getRuntimeEnv('VITE_N8N_WEBHOOK_URL'));
  if (envUrl) return envUrl;
  if (isRunningUnderNodeTest()) return '';
  return DEFAULT_N8N_WEBHOOK_URL;
}

export async function dispatchN8nTaskEvent(
  event: N8nTaskEvent,
  task: Task,
  options?: {
    webhookUrl?: string;
    googleSpreadsheetId?: string;
    fetchImpl?: typeof fetch;
  }
): Promise<N8nDispatchResult> {
  const webhookUrl = getEffectiveN8nWebhookUrl(options?.webhookUrl);

  if (!webhookUrl) {
    return { sent: false, reason: 'not_configured' };
  }

  const fetchFn = options?.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) {
    return { sent: false, reason: 'fetch_unavailable' };
  }

  const spreadsheetId =
    options?.googleSpreadsheetId !== undefined
      ? options.googleSpreadsheetId
      : getRuntimeEnv('VITE_N8N_SPREADSHEET_ID');

  const payload = buildN8nTaskWebhookPayload({
    event,
    task,
    googleSpreadsheetId: spreadsheetId || undefined,
  });

  try {
    const response = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      console.warn(`n8n webhook responded with HTTP ${response.status} for event ${event}`);
      return { sent: false, status: response.status, reason: `http_${response.status}` };
    }

    return { sent: true, status: response.status };
  } catch (err) {
    console.warn(`Non-blocking n8n webhook dispatch failed (${event}):`, err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : 'network_error',
    };
  }
}

export const N8nService = {
  notifyTaskCreated(task: Task): Promise<N8nDispatchResult> {
    return dispatchN8nTaskEvent('task.created', task);
  },

  notifyTaskStatusUpdated(task: Task): Promise<N8nDispatchResult> {
    return dispatchN8nTaskEvent('task.status_updated', task);
  },
};
