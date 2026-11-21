import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_TABS,
  buildRouteUrl,
  getDocumentTitleForTab,
  isModifiedClick,
  normalizePathname,
  parseRouteFromUrl,
  pathToTab,
  resolveInitialTab,
  tabToPath,
} from '../src/utils/navigation';
import { canAccessTab, getDefaultTabForRole } from '../src/utils/rbac';
import { PARENT_COMPANY_ID } from '../src/config/companies';
import type { User } from '../src/types';

const superAdmin: User = {
  id: 'sa-1',
  email: 'lumerecompany@gmail.com',
  displayName: 'Super Admin',
  role: 'SUPER_ADMIN',
  companyId: PARENT_COMPANY_ID,
  department: 'الإدارة العليا',
  position: 'مدير عام',
  status: 'active',
  joinedDate: '2026-01-01',
};

const employee: User = {
  id: 'emp-1',
  email: 'emp@lumere.com',
  displayName: 'Employee',
  role: 'EMPLOYEE',
  companyId: 'lumere-company',
  department: 'التصميم',
  position: 'مصمم',
  status: 'active',
  joinedDate: '2026-01-01',
};

test('every TabType maps round-trip cleanly between tabToPath and pathToTab', () => {
  const seenPaths = new Set<string>();
  for (const tab of ALL_TABS) {
    const routePath = tabToPath(tab);
    assert.ok(routePath.startsWith('/'), `Route path for ${tab} must start with /`);
    assert.equal(seenPaths.has(routePath), false, `Duplicate route path ${routePath}`);
    seenPaths.add(routePath);
    assert.equal(pathToTab(routePath), tab);
    // Trailing slash & case-insensitivity
    assert.equal(pathToTab(`${routePath.toUpperCase()}/`), tab);
  }
});

test('parseRouteFromUrl handles root, aliases, unknown paths, and company/task query params', () => {
  assert.deepEqual(parseRouteFromUrl('/', '?utm_source=google'), {
    tab: null,
    companyId: null,
    taskId: null,
    isRoot: true,
    isUnknownPath: false,
  });

  assert.deepEqual(parseRouteFromUrl('/tasks/', '?company=lumere-company&task=tsk-42'), {
    tab: 'tasks',
    companyId: 'lumere-company',
    taskId: 'tsk-42',
    isRoot: false,
    isUnknownPath: false,
  });

  assert.equal(parseRouteFromUrl('/join_requests').tab, 'join_requests');
  assert.equal(parseRouteFromUrl('/join-requests').tab, 'join_requests');
  assert.equal(parseRouteFromUrl('/group_dashboard').tab, 'group_dashboard');
  assert.equal(parseRouteFromUrl('/group').tab, 'group_dashboard');

  const unknown = parseRouteFromUrl('/nonexistent-route');
  assert.equal(unknown.tab, null);
  assert.equal(unknown.isRoot, false);
  assert.equal(unknown.isUnknownPath, true);
});

test('buildRouteUrl builds clean URLs and omits parent company param on group-only views', () => {
  assert.equal(
    buildRouteUrl({ tab: 'tasks', companyId: 'lumere-company', includeCompanyParam: true }),
    '/tasks?company=lumere-company'
  );
  assert.equal(
    buildRouteUrl({ tab: 'tasks', companyId: PARENT_COMPANY_ID, includeCompanyParam: true }),
    '/tasks'
  );
  assert.equal(
    buildRouteUrl({ tab: 'group_dashboard', companyId: 'lumere-company', includeCompanyParam: true }),
    '/group'
  );
  assert.equal(
    buildRouteUrl({ tab: 'companies', companyId: 'lumere-company', includeCompanyParam: true }),
    '/companies'
  );
  assert.equal(
    buildRouteUrl({
      tab: 'projects',
      companyId: 'lumere-company',
      taskId: 'abc123',
      includeCompanyParam: true,
    }),
    '/projects?company=lumere-company&task=abc123'
  );
  assert.equal(
    buildRouteUrl({ tab: 'tasks', companyId: 'lumere-company', includeCompanyParam: false }),
    '/tasks'
  );
});

test('resolveInitialTab preserves authorized deep links on Refresh and enforces RBAC fallback safely', () => {
  // Deep link to /projects for Super Admin -> stays on /projects without losing page on refresh
  const allowedDeepLink = resolveInitialTab({
    parsedRoute: parseRouteFromUrl('/projects', '?company=lumere-company'),
    defaultTab: getDefaultTabForRole('SUPER_ADMIN', false),
    canAccess: tab => canAccessTab(superAdmin, tab),
  });
  assert.equal(allowedDeepLink.tab, 'projects');
  assert.equal(allowedDeepLink.shouldReplaceUrl, false);

  // Google Search landing on / -> resolves to default hub with replaceState (no Back trap)
  const rootLanding = resolveInitialTab({
    parsedRoute: parseRouteFromUrl('/', '?utm_source=google'),
    defaultTab: getDefaultTabForRole('SUPER_ADMIN', true),
    canAccess: tab => canAccessTab(superAdmin, tab),
  });
  assert.equal(rootLanding.tab, 'group_dashboard');
  assert.equal(rootLanding.shouldReplaceUrl, true);

  // Employee opening restricted /settings directly -> safely falls back to /dashboard via replaceState
  const forbiddenDeepLink = resolveInitialTab({
    parsedRoute: parseRouteFromUrl('/settings'),
    defaultTab: getDefaultTabForRole('EMPLOYEE', false),
    canAccess: tab => canAccessTab(employee, tab),
  });
  assert.equal(forbiddenDeepLink.tab, 'dashboard');
  assert.equal(forbiddenDeepLink.shouldReplaceUrl, true);
});

test('isModifiedClick preserves native Ctrl/Cmd/Shift/middle-click new-tab behavior', () => {
  assert.equal(
    isModifiedClick({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0 }),
    false
  );
  assert.equal(
    isModifiedClick({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, button: 0 }),
    true
  );
  assert.equal(
    isModifiedClick({ metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, button: 0 }),
    true
  );
  assert.equal(
    isModifiedClick({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 1 }),
    true
  );
});

test('getDocumentTitleForTab generates readable Arabic page titles for browser history list', () => {
  assert.equal(getDocumentTitleForTab('tasks', 'LUMERE'), 'المهام التنفيذية — LUMERE');
  assert.equal(getDocumentTitleForTab('projects'), 'المشاريع — Luméré');
});

test('SPA hosting rewrites & service worker navigation fallback are properly configured', () => {
  const root = process.cwd();
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

  assert.ok(
    vercel.rewrites.some((r: { destination: string }) => r.destination === '/index.html'),
    'vercel.json must rewrite internal SPA routes to /index.html'
  );
  assert.ok(
    firebase.hosting?.rewrites?.some((r: { destination: string }) => r.destination === '/index.html'),
    'firebase.json hosting must rewrite internal SPA routes to /index.html'
  );
  assert.ok(sw.includes("event.request.mode === 'navigate'"));
  assert.ok(sw.includes("caches.match('/index.html')"));
  assert.equal(normalizePathname('///tasks///'), '/tasks');
});
