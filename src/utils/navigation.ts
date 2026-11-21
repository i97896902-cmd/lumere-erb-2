import { PARENT_COMPANY_ID } from '../config/companies';
import type { TabType } from '../types';

/**
 * Canonical URL path for every internal ERP view.
 * Kept human-readable, crawlable, and compatible with Chrome Desktop/Mobile & Google Search.
 */
export const TAB_ROUTE_PATHS: Record<TabType, string> = {
  group_dashboard: '/group',
  companies: '/companies',
  dashboard: '/dashboard',
  tasks: '/tasks',
  projects: '/projects',
  clients: '/clients',
  equipment: '/equipment',
  join_requests: '/join-requests',
  calendar: '/calendar',
  employees: '/employees',
  departments: '/departments',
  reports: '/reports',
  activity: '/activity',
  notifications: '/notifications',
  settings: '/settings',
  profile: '/profile',
};

export const TAB_ARABIC_TITLES: Record<TabType, string> = {
  group_dashboard: 'لوحة المجموعة المركزية',
  companies: 'إدارة الشركات التابعة',
  dashboard: 'لوحة التحكم',
  tasks: 'المهام التنفيذية',
  projects: 'المشاريع',
  clients: 'العملاء والشركاء',
  equipment: 'المعدات والأصول',
  join_requests: 'طلبات الانضمام',
  calendar: 'التقويم الزمني',
  employees: 'فريق العمل',
  departments: 'الأقسام والوحدات',
  reports: 'التقارير التحليلية',
  activity: 'سجل النشاطات',
  notifications: 'التنبيهات',
  settings: 'إعدادات النظام',
  profile: 'الملف الشخصي',
};

export const ALL_TABS = Object.keys(TAB_ROUTE_PATHS) as TabType[];

/**
 * Reverse lookup map supporting canonical paths and forgiving aliases
 * (e.g. /group_dashboard, /join_requests, /tasks/).
 */
const PATH_TO_TAB_MAP: Record<string, TabType> = {
  '/group': 'group_dashboard',
  '/group-dashboard': 'group_dashboard',
  '/group_dashboard': 'group_dashboard',
  '/companies': 'companies',
  '/dashboard': 'dashboard',
  '/tasks': 'tasks',
  '/projects': 'projects',
  '/clients': 'clients',
  '/equipment': 'equipment',
  '/join-requests': 'join_requests',
  '/join_requests': 'join_requests',
  '/calendar': 'calendar',
  '/employees': 'employees',
  '/departments': 'departments',
  '/reports': 'reports',
  '/activity': 'activity',
  '/activity-log': 'activity',
  '/notifications': 'notifications',
  '/settings': 'settings',
  '/profile': 'profile',
};

export interface ParsedRoute {
  tab: TabType | null;
  companyId: string | null;
  taskId: string | null;
  isRoot: boolean;
  isUnknownPath: boolean;
}

export interface RouteHistoryState {
  lumereNav: true;
  tab: TabType;
  companyId?: string | null;
  taskId?: string | null;
}

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  const collapsed = `/${trimmed}`.replace(/\/+/g, '/');
  const withoutTrailingSlash = collapsed.replace(/\/+$/, '');
  return (withoutTrailingSlash || '/').toLowerCase();
}

export function tabToPath(tab: TabType): string {
  return TAB_ROUTE_PATHS[tab] || '/dashboard';
}

export function pathToTab(pathname: string): TabType | null {
  const normalized = normalizePathname(pathname);
  return PATH_TO_TAB_MAP[normalized] ?? null;
}

export function parseRouteFromUrl(pathname: string, search: string = ''): ParsedRoute {
  const normalized = normalizePathname(pathname);
  const isRoot = normalized === '/' || normalized === '/index.html';
  const tab = isRoot ? null : pathToTab(normalized);
  const isUnknownPath = !isRoot && tab === null;

  const params = new URLSearchParams(search || '');
  const rawCompany = params.get('company')?.trim() || null;
  const rawTask = params.get('task')?.trim() || null;

  return {
    tab,
    companyId: rawCompany,
    taskId: rawTask,
    isRoot,
    isUnknownPath,
  };
}

export function buildRouteUrl(params: {
  tab: TabType;
  companyId?: string | null;
  taskId?: string | null;
  includeCompanyParam?: boolean;
}): string {
  const path = tabToPath(params.tab);
  const searchParams = new URLSearchParams();

  const isGroupOnlyTab = params.tab === 'group_dashboard' || params.tab === 'companies';
  if (
    !isGroupOnlyTab &&
    params.includeCompanyParam &&
    params.companyId &&
    params.companyId !== PARENT_COMPANY_ID
  ) {
    searchParams.set('company', params.companyId);
  }

  if (params.taskId) {
    searchParams.set('task', params.taskId);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function getDocumentTitleForTab(tab: TabType, companyName?: string): string {
  const section = TAB_ARABIC_TITLES[tab] || 'لوحة التحكم';
  const brand = companyName?.trim() || 'Luméré';
  return `${section} — ${brand}`;
}

/**
 * Resolves which tab should render on initial load or deep-link entry.
 * Uses `replaceState` (never `pushState`) for initial canonicalization so pressing Back
 * immediately returns the user to Google Search / their external referrer instead of trapping them.
 */
export function resolveInitialTab(params: {
  parsedRoute: ParsedRoute;
  defaultTab: TabType;
  canAccess: (tab: TabType) => boolean;
}): { tab: TabType; shouldReplaceUrl: boolean } {
  const { parsedRoute, defaultTab, canAccess } = params;

  if (parsedRoute.tab && canAccess(parsedRoute.tab)) {
    return { tab: parsedRoute.tab, shouldReplaceUrl: false };
  }

  return { tab: defaultTab, shouldReplaceUrl: true };
}

/**
 * Detects modified clicks (Ctrl/Cmd/Shift/Alt or middle-click) so `<a href>` links
 * preserve native browser behaviors like "Open in new tab".
 */
export function isModifiedClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function getCurrentRelativeUrl(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Updates browser History safely without creating duplicate consecutive entries
 * or blocking native browser Back / Forward / Refresh controls.
 */
export function syncBrowserHistory(
  targetUrl: string,
  mode: 'push' | 'replace',
  state?: RouteHistoryState
): boolean {
  if (typeof window === 'undefined' || !window.history) return false;
  const currentUrl = getCurrentRelativeUrl();

  if (mode === 'push' && currentUrl === targetUrl) {
    return false;
  }

  try {
    if (mode === 'replace') {
      window.history.replaceState(state ?? null, '', targetUrl);
    } else {
      window.history.pushState(state ?? null, '', targetUrl);
    }
    return true;
  } catch (err) {
    console.warn('Browser history update skipped:', err);
    return false;
  }
}
