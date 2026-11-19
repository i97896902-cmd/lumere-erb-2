import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFirestoreSubscriptionScope,
  shouldRegisterServiceWorker,
  isExpectedSwRegistrationError,
} from './appGuards';

test('getFirestoreSubscriptionScope returns none when loading or unauthenticated', () => {
  assert.equal(
    getFirestoreSubscriptionScope({
      loading: true,
      isAuthenticated: true,
      isProfileIncomplete: false,
      status: 'active',
    }),
    'none'
  );

  assert.equal(
    getFirestoreSubscriptionScope({
      loading: false,
      isAuthenticated: false,
      isProfileIncomplete: false,
      status: undefined,
    }),
    'none'
  );
});

test('getFirestoreSubscriptionScope returns departments_only when profile is incomplete', () => {
  assert.equal(
    getFirestoreSubscriptionScope({
      loading: false,
      isAuthenticated: true,
      isProfileIncomplete: true,
      status: 'pending',
    }),
    'departments_only'
  );
});

test('getFirestoreSubscriptionScope returns none for pending, rejected, or suspended users', () => {
  for (const status of ['pending', 'rejected', 'suspended']) {
    assert.equal(
      getFirestoreSubscriptionScope({
        loading: false,
        isAuthenticated: true,
        isProfileIncomplete: false,
        status,
      }),
      'none'
    );
  }
});

test('getFirestoreSubscriptionScope returns full only for active authenticated users with complete profile', () => {
  assert.equal(
    getFirestoreSubscriptionScope({
      loading: false,
      isAuthenticated: true,
      isProfileIncomplete: false,
      status: 'active',
    }),
    'full'
  );
});

test('shouldRegisterServiceWorker accepts direct 200 JavaScript responses', () => {
  assert.equal(
    shouldRegisterServiceWorker({
      ok: true,
      status: 200,
      redirected: false,
      type: 'basic',
      contentType: 'application/javascript; charset=utf-8',
    }),
    true
  );

  assert.equal(
    shouldRegisterServiceWorker({
      ok: true,
      status: 200,
      redirected: false,
      type: 'basic',
      contentType: 'text/javascript',
    }),
    true
  );
});

test('shouldRegisterServiceWorker rejects redirected, opaque, or non-JS responses', () => {
  assert.equal(
    shouldRegisterServiceWorker({
      ok: false,
      status: 0,
      redirected: false,
      type: 'opaqueredirect',
      contentType: null,
    }),
    false
  );

  assert.equal(
    shouldRegisterServiceWorker({
      ok: true,
      status: 200,
      redirected: true,
      type: 'basic',
      contentType: 'application/javascript',
    }),
    false
  );

  assert.equal(
    shouldRegisterServiceWorker({
      ok: true,
      status: 200,
      redirected: false,
      type: 'basic',
      contentType: 'text/html; charset=utf-8',
    }),
    false
  );

  assert.equal(
    shouldRegisterServiceWorker({
      ok: false,
      status: 302,
      redirected: false,
      type: 'basic',
      contentType: 'application/javascript',
    }),
    false
  );
});

test('isExpectedSwRegistrationError identifies proxy redirect and SecurityError rejections', () => {
  assert.equal(
    isExpectedSwRegistrationError(
      new TypeError(
        "Failed to register a ServiceWorker for scope ('https://example.run.app/') with script ('https://example.run.app/sw.js'): The script resource is behind a redirect, which is disallowed."
      )
    ),
    true
  );

  const secErr = new Error('The operation is insecure.');
  secErr.name = 'SecurityError';
  assert.equal(isExpectedSwRegistrationError(secErr), true);

  assert.equal(isExpectedSwRegistrationError(new Error('Unexpected syntax error')), false);
});

test('formatUnauthorizedDomainMessage includes active hostname when available', async () => {
  const { formatUnauthorizedDomainMessage } = await import('./appGuards');
  const withHost = formatUnauthorizedDomainMessage('ais-dev-example.run.app');
  assert.ok(withHost.includes('ais-dev-example.run.app'));
  assert.ok(withHost.includes('Authorized domains'));

  const withoutHost = formatUnauthorizedDomainMessage('');
  assert.ok(withoutHost.includes('Authorized domains'));
});
