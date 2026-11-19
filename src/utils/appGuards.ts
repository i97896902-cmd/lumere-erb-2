export type FirestoreSubscriptionScope = 'none' | 'departments_only' | 'full';

export interface AuthSubscriptionState {
  loading: boolean;
  isAuthenticated: boolean;
  isProfileIncomplete: boolean;
  status?: string | null;
}

/**
 * Determines which Firestore collections should have active real-time listeners
 * based on the current authentication and account approval state.
 */
export function getFirestoreSubscriptionScope(
  state: AuthSubscriptionState
): FirestoreSubscriptionScope {
  if (state.loading || !state.isAuthenticated) {
    return 'none';
  }

  if (state.isProfileIncomplete) {
    return 'departments_only';
  }

  if (state.status === 'active') {
    return 'full';
  }

  return 'none';
}

export interface ServiceWorkerProbeResult {
  ok: boolean;
  status: number;
  redirected: boolean;
  type: string;
  contentType: string | null;
}

/**
 * Returns true only when the probed service worker script is served directly
 * (no redirect) with an HTTP 2xx JavaScript response.
 */
export function shouldRegisterServiceWorker(probe: ServiceWorkerProbeResult): boolean {
  if (probe.type === 'opaqueredirect' || probe.redirected) {
    return false;
  }

  if (!probe.ok || probe.status < 200 || probe.status >= 300) {
    return false;
  }

  const normalizedType = (probe.contentType || '').toLowerCase();
  return normalizedType.includes('javascript');
}

/**
 * Identifies expected environment-level service worker registration rejections
 * (e.g., proxy redirects in preview iframes or restricted storage contexts).
 */
export function isExpectedSwRegistrationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' && /redirect|securityerror|not allowed/i.test(error);
  }

  const err = error as { name?: string; message?: string };
  const name = err.name || '';
  const message = err.message || '';

  return (
    name === 'SecurityError' ||
    /behind a redirect|redirect.*disallowed|storage.*disabled|insecure|not allowed/i.test(message)
  );
}

/**
 * Formats an actionable Arabic error message for Firebase auth/unauthorized-domain
 * that names the actual current hostname instead of assuming a single host.
 */
export function formatUnauthorizedDomainMessage(hostname?: string | null): string {
  const cleanHost = (hostname || '').trim();
  if (cleanHost) {
    return `النطاق (${cleanHost}) غير مصرح به في Firebase Authentication. أضف هذا النطاق إلى Authorized domains في إعدادات Firebase.`;
  }
  return 'هذا النطاق غير مصرح به في Firebase Authentication. أضف النطاق الحالي إلى Authorized domains في إعدادات Firebase.';
}
