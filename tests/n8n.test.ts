import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildN8nTaskWebhookPayload,
  DEFAULT_N8N_MAPPING_SHEET_NAME,
  DEFAULT_N8N_SPREADSHEET_ID,
  DEFAULT_N8N_WEBHOOK_URL,
  dispatchN8nTaskEvent,
  getEffectiveN8nWebhookUrl,
  resolveN8nWebhookUrl,
  sanitizeSheetTabName,
  translateTaskPriorityAr,
  translateTaskStatusAr,
} from '../src/services/n8nService';
import type { Task } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function makeSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'doc-task-001',
    companyId: 'lumere',
    taskId: 'TSK-742',
    title: 'تصميم حملة إطلاق الموسم الجديد',
    description: 'إعداد التصاميم الرئيسية لمنصات التواصل الاجتماعي',
    createdBy: 'uid-admin',
    createdByName: 'إدارة Luméré',
    assignedTo: 'uid-emp-1',
    assignedToName: 'أحمد / التصميم: الإبداعي?',
    assignedToEmail: '  Ahmed.Designer@Lumere.com ',
    department: 'التصميم والإبداع',
    priority: 'Urgent',
    status: 'Pending',
    startDate: '2026-11-26',
    deadline: '2026-12-01',
    completionPercentage: 0,
    reviewStatus: 'none',
    projectId: 'proj-1',
    projectName: 'حملة الشتاء',
    createdAt: '2026-11-26T10:15:00.000Z',
    updatedAt: '2026-11-26T10:15:00.000Z',
    ...overrides,
  };
}

test('n8n workflow file exists verbatim in repository and passes structural checks', () => {
  const repoWorkflowPath = path.join(ROOT_DIR, 'n8n', 'lumere-tasks-workflow.json');
  const attachmentWorkflowPath = path.join(
    ROOT_DIR,
    'public',
    'assets',
    'aistudio',
    'Lum_r____________________________Gmail___Telegram___Google_Sheets__ca458769.json'
  );

  assert.equal(fs.existsSync(repoWorkflowPath), true);
  assert.equal(fs.existsSync(attachmentWorkflowPath), true);

  const repoRaw = fs.readFileSync(repoWorkflowPath, 'utf8');
  const attachmentRaw = fs.readFileSync(attachmentWorkflowPath, 'utf8');
  assert.equal(repoRaw, attachmentRaw, 'Workflow file in n8n/ must match attachment verbatim');

  const workflow = JSON.parse(repoRaw);
  assert.equal(workflow.active, true);
  assert.equal(workflow.id, 'uEOrlvfCRF0VFGY5');
  assert.equal(Array.isArray(workflow.nodes), true);
  assert.equal(workflow.nodes.length, 14);

  const webhookNode = workflow.nodes.find((n: { type?: string }) => n.type === 'n8n-nodes-base.webhook');
  assert.ok(webhookNode, 'Webhook trigger node must exist');
  assert.equal(webhookNode.parameters.httpMethod, 'POST');
  assert.equal(webhookNode.parameters.path, 'lumere-tasks');

  const mappingNode = workflow.nodes.find(
    (n: { name?: string }) => n.name === 'قراءة جدول ربط Telegram'
  );
  assert.ok(mappingNode);
  assert.equal(mappingNode.parameters.documentId.value, DEFAULT_N8N_SPREADSHEET_ID);
  assert.equal(mappingNode.parameters.sheetName.cachedResultName, DEFAULT_N8N_MAPPING_SHEET_NAME);
});

test('resolveN8nWebhookUrl normalizes base URLs and preserves explicit webhook paths', () => {
  assert.equal(resolveN8nWebhookUrl(''), '');
  assert.equal(resolveN8nWebhookUrl('   '), '');
  assert.equal(resolveN8nWebhookUrl('not-a-url'), '');
  assert.equal(resolveN8nWebhookUrl('ftp://n8n.example.com/webhook/lumere-tasks'), '');

  assert.equal(
    resolveN8nWebhookUrl('https://n8n.lumere.com'),
    'https://n8n.lumere.com/webhook/lumere-tasks'
  );
  assert.equal(
    resolveN8nWebhookUrl('https://n8n.lumere.com/'),
    'https://n8n.lumere.com/webhook/lumere-tasks'
  );
  assert.equal(
    resolveN8nWebhookUrl('https://n8n.lumere.com/webhook/lumere-tasks'),
    'https://n8n.lumere.com/webhook/lumere-tasks'
  );
  assert.equal(
    resolveN8nWebhookUrl('https://n8n.lumere.com/webhook-test/lumere-tasks'),
    'https://n8n.lumere.com/webhook-test/lumere-tasks'
  );
  assert.equal(
    DEFAULT_N8N_WEBHOOK_URL,
    'https://hassan20300.app.n8n.cloud/webhook/lumere-tasks'
  );
  assert.equal(
    getEffectiveN8nWebhookUrl(DEFAULT_N8N_WEBHOOK_URL),
    'https://hassan20300.app.n8n.cloud/webhook/lumere-tasks'
  );
  assert.equal(getEffectiveN8nWebhookUrl(), '');
});

test('sanitizeSheetTabName strips Google Sheets forbidden characters and enforces 80-char limit', () => {
  assert.equal(sanitizeSheetTabName('أحمد / التصميم: الإبداعي?[1]*\\'), 'أحمد التصميم الإبداعي 1');
  assert.equal(sanitizeSheetTabName('   '), 'Employee_Tasks');
  assert.equal(sanitizeSheetTabName(undefined), 'Employee_Tasks');
  assert.equal(sanitizeSheetTabName('A'.repeat(120)).length, 80);
});

test('Arabic priority and status translations cover every TaskPriority and TaskStatus', () => {
  assert.equal(translateTaskPriorityAr('Low'), 'منخفضة');
  assert.equal(translateTaskPriorityAr('Medium'), 'متوسطة');
  assert.equal(translateTaskPriorityAr('High'), 'عالية');
  assert.equal(translateTaskPriorityAr('Urgent'), 'عاجلة جداً');

  assert.equal(translateTaskStatusAr('Pending'), 'قيد الانتظار');
  assert.equal(translateTaskStatusAr('In Progress'), 'قيد التنفيذ');
  assert.equal(translateTaskStatusAr('Review'), 'قيد المراجعة');
  assert.equal(translateTaskStatusAr('Completed'), 'مكتملة');
  assert.equal(translateTaskStatusAr('Rejected'), 'مرفوضة');
  assert.equal(translateTaskStatusAr('Cancelled'), 'ملغاة');
});

test('buildN8nTaskWebhookPayload matches exact n8n workflow contract for task.created and task.status_updated', () => {
  const createdTask = makeSampleTask();
  const createdPayload = buildN8nTaskWebhookPayload({
    event: 'task.created',
    task: createdTask,
    timestamp: '2026-11-26T10:15:00.000Z',
    appUrl: 'https://lumere-erb.web.app/tasks?taskId=doc-task-001',
  });

  assert.equal(createdPayload.event, 'task.created');
  assert.equal(createdPayload.googleSpreadsheetId, DEFAULT_N8N_SPREADSHEET_ID);
  assert.equal(createdPayload.mappingSheetName, DEFAULT_N8N_MAPPING_SHEET_NAME);
  assert.equal(createdPayload.appUrl, 'https://lumere-erb.web.app/tasks?taskId=doc-task-001');
  assert.deepEqual(createdPayload.task, {
    id: 'doc-task-001',
    taskCode: 'TSK-742',
    title: 'تصميم حملة إطلاق الموسم الجديد',
    description: 'إعداد التصاميم الرئيسية لمنصات التواصل الاجتماعي',
    department: 'التصميم والإبداع',
    projectName: 'حملة الشتاء',
    priority: 'Urgent',
    priorityAr: 'عاجلة جداً',
    status: 'Pending',
    statusAr: 'قيد الانتظار',
    completionPercentage: 0,
    startDate: '2026-11-26',
    deadline: '2026-12-01',
    createdDate: '2026-11-26',
  });
  assert.deepEqual(createdPayload.employee, {
    name: 'أحمد / التصميم: الإبداعي?',
    email: 'ahmed.designer@lumere.com',
    sheetTabName: 'أحمد التصميم الإبداعي',
  });

  const updatedTask = makeSampleTask({
    status: 'Completed',
    completionPercentage: 100,
    projectName: undefined,
  });
  const updatedPayload = buildN8nTaskWebhookPayload({
    event: 'task.status_updated',
    task: updatedTask,
    timestamp: '2026-11-27T12:00:00.000Z',
    appUrl: 'https://lumere-erb.web.app',
  });

  assert.equal(updatedPayload.event, 'task.status_updated');
  assert.equal(updatedPayload.task.status, 'Completed');
  assert.equal(updatedPayload.task.statusAr, 'مكتملة');
  assert.equal(updatedPayload.task.completionPercentage, 100);
  assert.equal(updatedPayload.task.projectName, 'عام');
});

test('dispatchN8nTaskEvent sends POST JSON when configured and never throws on errors', async () => {
  const sampleTask = makeSampleTask();

  // 1. Skips cleanly when URL is unconfigured
  const skipped = await dispatchN8nTaskEvent('task.created', sampleTask, { webhookUrl: '' });
  assert.deepEqual(skipped, { sent: false, reason: 'not_configured' });

  // 2. Dispatches exact JSON payload via POST on valid URL
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const mockOkFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const sent = await dispatchN8nTaskEvent('task.created', sampleTask, {
    webhookUrl: 'https://n8n.lumere.com',
    fetchImpl: mockOkFetch,
  });

  assert.deepEqual(sent, { sent: true, status: 200 });
  assert.equal(capturedUrl, 'https://n8n.lumere.com/webhook/lumere-tasks');
  assert.equal(capturedInit?.method, 'POST');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers['Content-Type'], 'application/json');
  const parsedBody = JSON.parse(String(capturedInit?.body));
  assert.equal(parsedBody.event, 'task.created');
  assert.equal(parsedBody.task.taskCode, 'TSK-742');
  assert.equal(parsedBody.employee.email, 'ahmed.designer@lumere.com');

  // 3. Non-blocking on HTTP error status
  const mockFailStatusFetch = (async () =>
    new Response('Upstream Error', { status: 502 })) as typeof fetch;
  const failedStatus = await dispatchN8nTaskEvent('task.status_updated', sampleTask, {
    webhookUrl: 'https://n8n.lumere.com/webhook/lumere-tasks',
    fetchImpl: mockFailStatusFetch,
  });
  assert.deepEqual(failedStatus, { sent: false, status: 502, reason: 'http_502' });

  // 4. Non-blocking on network rejection
  const mockNetworkErrFetch = (async () => {
    throw new Error('ECONNREFUSED');
  }) as typeof fetch;
  const failedNetwork = await dispatchN8nTaskEvent('task.status_updated', sampleTask, {
    webhookUrl: 'https://n8n.lumere.com/webhook/lumere-tasks',
    fetchImpl: mockNetworkErrFetch,
  });
  assert.deepEqual(failedNetwork, { sent: false, reason: 'ECONNREFUSED' });
});
