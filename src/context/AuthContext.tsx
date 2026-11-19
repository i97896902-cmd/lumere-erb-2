import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  getIdTokenResult,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../lib/firebase';
import { CanonicalRole, Role, User } from '../types';
import { formatUnauthorizedDomainMessage } from '../utils/appGuards';
import {
  canSwitchCompanies as checkCanSwitchCompanies,
  getUserCompanyId,
  isActiveStatus,
  isCompanyAdmin as checkIsCompanyAdmin,
  isManager as checkIsManager,
  isSuperAdmin as checkIsSuperAdmin,
  normalizeRole,
  PRIMARY_SUPER_ADMIN_EMAIL,
} from '../utils/rbac';
import { DEFAULT_SUBSIDIARY_ID, PARENT_COMPANY_ID } from '../config/companies';
import { DEFAULT_DIRECT_ACCESS_USER } from '../services/localDataService';

// Direct access preview flag: set VITE_DISABLE_AUTH=false in production builds to enforce full Firebase Authentication
export const AUTH_DISABLED = import.meta.env.VITE_DISABLE_AUTH !== 'false';

export interface AuthCustomClaims {
  role?: CanonicalRole;
  companyId?: string;
}

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  role: CanonicalRole;
  claims: AuthCustomClaims;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isManager: boolean;
  canSwitchCompanies: boolean;
  loading: boolean;
  isProfileIncomplete: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    role: Role,
    department: string,
    position: string,
    phone?: string,
    companyId?: string
  ) => Promise<void>;
  completeEmployeeProfile: (data: {
    displayName: string;
    phone: string;
    department: string;
    position: string;
    companyId?: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

function getGoogleAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/popup-blocked':
      return 'تم حظر نافذة Google. سيتم تحويلك إلى صفحة تسجيل الدخول الآمنة.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/popup-cancelled-by-user':
      return 'تم إلغاء تسجيل الدخول عبر Google.';
    case 'auth/unauthorized-domain':
      return formatUnauthorizedDomainMessage(
        typeof window !== 'undefined' ? window.location.hostname : null
      );
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول عبر Google غير مفعّل في Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت.';
    case 'auth/account-exists-with-different-credential':
      return 'يوجد حساب بهذا البريد باستخدام طريقة تسجيل دخول أخرى.';
    case 'auth/invalid-api-key':
      return 'إعدادات Firebase غير صحيحة. راجع إعدادات المشروع.';
    default:
      return 'تعذر تسجيل الدخول عبر Google. تحقق من إعدادات Firebase Authorized domains وحاول مرة أخرى.';
  }
}

async function readUserClaims(fUser: FirebaseUser): Promise<AuthCustomClaims> {
  try {
    const tokenResult = await getIdTokenResult(fUser);
    const rawRole = tokenResult.claims.role;
    const rawCompanyId = tokenResult.claims.companyId;
    const parsedRole =
      typeof rawRole === 'string' &&
      ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE', 'ADMIN'].includes(rawRole)
        ? normalizeRole(rawRole as Role, fUser.email)
        : undefined;
    return {
      role: parsedRole,
      companyId: typeof rawCompanyId === 'string' ? rawCompanyId : undefined,
    };
  } catch {
    return {};
  }
}

function resolveUserProfile(
  snapId: string,
  data: User,
  fUser: FirebaseUser,
  claims: AuthCustomClaims
): User {
  const isPrimarySuperAdmin = fUser.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;
  const resolvedRole: CanonicalRole = isPrimarySuperAdmin
    ? 'SUPER_ADMIN'
    : claims.role || normalizeRole(data.role, fUser.email);

  const resolvedCompanyId =
    data.companyId ||
    claims.companyId ||
    (resolvedRole === 'SUPER_ADMIN' ? PARENT_COMPANY_ID : DEFAULT_SUBSIDIARY_ID);

  return {
    ...data,
    id: snapId,
    uid: data.uid || fUser.uid,
    role: resolvedRole,
    companyId: resolvedCompanyId,
    status: isPrimarySuperAdmin ? 'active' : data.status,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(
    AUTH_DISABLED ? DEFAULT_DIRECT_ACCESS_USER : null
  );
  const [claims, setClaims] = useState<AuthCustomClaims>(
    AUTH_DISABLED ? { role: 'SUPER_ADMIN', companyId: PARENT_COMPANY_ID } : {}
  );
  const [loading, setLoading] = useState(!AUTH_DISABLED);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(error => {
      console.error('Firebase session persistence error:', error);
      setAuthError('تعذر حفظ جلسة الدخول. يرجى السماح بملفات الارتباط ثم إعادة المحاولة.');
    });
  }, []);

  useEffect(() => {
    if (AUTH_DISABLED) return;
    async function init() {
      await testConnection();
    }
    init();
  }, []);

  const refreshCurrentUser = async () => {
    if (!firebaseUser) return;
    try {
      const tokenClaims = await readUserClaims(firebaseUser);
      setClaims(tokenClaims);
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as User;
        const normalized = resolveUserProfile(snap.id, data, firebaseUser, tokenClaims);
        setCurrentUser(normalized);
        const isTopAdmin = normalized.role === 'SUPER_ADMIN';
        setIsProfileIncomplete(
          !isTopAdmin && (!normalized.department || !normalized.position || !normalized.phone)
        );
      }
    } catch (err) {
      console.error('Error refreshing current user:', err);
    }
  };

  useEffect(() => {
    if (AUTH_DISABLED) {
      setCurrentUser(DEFAULT_DIRECT_ACCESS_USER);
      setClaims({ role: 'SUPER_ADMIN', companyId: PARENT_COMPANY_ID });
      setIsProfileIncomplete(false);
      setAuthError(null);
      setLoading(false);
      return;
    }

    let active = true;
    getRedirectResult(auth).catch(error => {
      if (active) setAuthError(getGoogleAuthErrorMessage(error));
      console.error('Google redirect result error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async fUser => {
      setFirebaseUser(fUser);
      if (fUser) {
        try {
          const tokenClaims = await readUserClaims(fUser);
          if (active) setClaims(tokenClaims);

          const userRef = doc(db, 'users', fUser.uid);
          const snap = await getDoc(userRef);
          const isPrimarySuperAdmin = fUser.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

          if (snap.exists()) {
            const data = snap.data() as User;
            const normalized = resolveUserProfile(snap.id, data, fUser, tokenClaims);

            // Preserve backward compatibility for primary bootstrap SUPER_ADMIN without overwriting other users' roles
            if (
              isPrimarySuperAdmin &&
              (data.role !== 'SUPER_ADMIN' ||
                !isActiveStatus(data.status) ||
                !data.companyId)
            ) {
              try {
                await setDoc(
                  userRef,
                  {
                    role: 'SUPER_ADMIN',
                    status: 'active',
                    companyId: data.companyId || PARENT_COMPANY_ID,
                    companyName: data.companyName || 'LUMERE GROUP',
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
              } catch {
                // Non-blocking if legacy Firestore rules only allow 'ADMIN' prior to rule deployment
              }
            }

            if (active) {
              setCurrentUser(normalized);
              setAuthError(null);
              const isTopAdmin = normalized.role === 'SUPER_ADMIN';
              setIsProfileIncomplete(
                !isTopAdmin && (!normalized.department || !normalized.position || !normalized.phone)
              );
            }
          } else {
            const newUser: User = {
              id: fUser.uid,
              uid: fUser.uid,
              companyId: isPrimarySuperAdmin ? PARENT_COMPANY_ID : DEFAULT_SUBSIDIARY_ID,
              companyName: isPrimarySuperAdmin ? 'LUMERE GROUP' : 'LUMERE',
              email: fUser.email || '',
              displayName: fUser.displayName || fUser.email?.split('@')[0] || 'موظف جديد',
              fullName: fUser.displayName || fUser.email?.split('@')[0] || 'موظف جديد',
              ...(fUser.photoURL ? { photoURL: fUser.photoURL } : {}),
              role: isPrimarySuperAdmin ? 'SUPER_ADMIN' : 'EMPLOYEE',
              department: isPrimarySuperAdmin ? 'الإدارة المركزية' : '',
              position: isPrimarySuperAdmin ? 'مدير المجموعة الأعلى' : '',
              jobTitle: isPrimarySuperAdmin ? 'مدير المجموعة الأعلى' : '',
              phone: '',
              status: isPrimarySuperAdmin ? 'active' : 'pending',
              joinedDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newUser);
            if (active) {
              setCurrentUser(newUser);
              setAuthError(null);
              setIsProfileIncomplete(!isPrimarySuperAdmin);
            }
          }
        } catch (err) {
          console.error('Failed to load user profile from Firestore:', err);
          if (active) {
            setAuthError(
              'تم تسجيل الدخول إلى Google، لكن تعذر تحميل ملفك من Firestore. تحقق من نشر Firestore Rules وإعدادات Firebase.'
            );
            setCurrentUser(null);
            setIsProfileIncomplete(false);
          }
        }
      } else if (active) {
        setCurrentUser(null);
        setClaims({});
        setIsProfileIncomplete(false);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-cancelled-by-user' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          const message = getGoogleAuthErrorMessage(redirectError);
          setAuthError(message);
          throw Object.assign(new Error(message), {
            code: (redirectError as { code?: string })?.code,
          });
        }
      }
      const message = getGoogleAuthErrorMessage(error);
      setAuthError(message);
      throw Object.assign(new Error(message), { code });
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error('Email sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    _requestedRole: Role,
    department: string,
    position: string,
    phone?: string,
    companyId = DEFAULT_SUBSIDIARY_ID
  ) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      // Security: Self-registration is always locked to EMPLOYEE + pending approval
      const safeCompanyId =
        companyId && companyId !== PARENT_COMPANY_ID ? companyId : DEFAULT_SUBSIDIARY_ID;
      const newUser: User = {
        id: res.user.uid,
        uid: res.user.uid,
        companyId: safeCompanyId,
        email,
        displayName,
        fullName: displayName,
        role: 'EMPLOYEE',
        department,
        position,
        jobTitle: position,
        phone: phone || '',
        status: 'pending',
        joinedDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', res.user.uid), newUser);
      setCurrentUser(newUser);
      setIsProfileIncomplete(!department || !position || !phone);
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const completeEmployeeProfile = async (data: {
    displayName: string;
    phone: string;
    department: string;
    position: string;
    companyId?: string;
  }) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      const isTopAdmin = normalizeRole(currentUser.role, currentUser.email) === 'SUPER_ADMIN';
      const targetCompanyId =
        !isTopAdmin && data.companyId && data.companyId !== PARENT_COMPANY_ID
          ? data.companyId
          : getUserCompanyId(currentUser);

      const updated: Partial<User> = {
        displayName: data.displayName,
        fullName: data.displayName,
        phone: data.phone,
        department: data.department,
        position: data.position,
        jobTitle: data.position,
        companyId: targetCompanyId,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, updated, { merge: true });
      setCurrentUser({ ...currentUser, ...updated });
      setIsProfileIncomplete(false);
    } catch (err) {
      console.error('Complete profile error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      console.error('Password reset error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      setAuthError(null);
      setCurrentUser(AUTH_DISABLED ? DEFAULT_DIRECT_ACCESS_USER : null);
      setClaims(AUTH_DISABLED ? { role: 'SUPER_ADMIN', companyId: PARENT_COMPANY_ID } : {});
      setIsProfileIncomplete(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const role: CanonicalRole = currentUser
    ? normalizeRole(currentUser.role, currentUser.email)
    : 'EMPLOYEE';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        role,
        claims,
        isSuperAdmin: checkIsSuperAdmin(currentUser),
        isCompanyAdmin: checkIsCompanyAdmin(currentUser),
        isManager: checkIsManager(currentUser),
        canSwitchCompanies: checkCanSwitchCompanies(currentUser),
        loading,
        isProfileIncomplete,
        authError,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        completeEmployeeProfile,
        resetPassword,
        logout,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
