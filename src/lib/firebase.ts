import { initializeApp } from 'firebase/app';
import { Analytics, getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase Web configuration for project "lumere-erb" (public client config).
// Environment variables (VITE_FIREBASE_*) can override these values per deployment.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCaNb3DUoVemzEd-7HecJheXkCUwe07hCU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'lumere-erb.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'lumere-erb',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'lumere-erb.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1026686151578',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1026686151578:web:86bbd9f72e58cff3492823',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-7NYW806QC4',
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID?.trim() || '';

export const app = initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  try {
    return firestoreDatabaseId
      ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firestoreDatabaseId)
      : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
}

// Connect to the project's default Firestore database unless a named database ID is explicitly provided
export const db = createFirestoreClient();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Safely initialize Firebase Analytics only in supported browser contexts
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then(supported => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connectivity once authenticated
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline') || msg.includes('unavailable')) {
      console.warn(
        `Firestore unreachable for project "${firebaseConfig.projectId}". Ensure Cloud Firestore API and the (default) database are created in Firebase Console.`
      );
      return false;
    }
    // Permission-denied on test/connection confirms Firestore API is reachable and rules are active
    return true;
  }
}
