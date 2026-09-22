import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../lib/firebase';
import { User, Role } from '../types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  role: Role;
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
    phone?: string
  ) => Promise<void>;
  completeEmployeeProfile: (data: {
    displayName: string;
    phone: string;
    department: string;
    position: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const ADMIN_EMAIL = 'lumerecompany@gmail.com';

function getGoogleAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/popup-blocked': return 'تم حظر نافذة Google. سيتم تحويلك إلى صفحة تسجيل الدخول الآمنة.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/popup-cancelled-by-user': return 'تم إلغاء تسجيل الدخول عبر Google.';
    case 'auth/unauthorized-domain': return 'هذا النطاق غير مصرح به في Firebase. أضف نطاق Vercel إلى Authorized domains.';
    case 'auth/operation-not-allowed': return 'تسجيل الدخول عبر Google غير مفعّل في Firebase Authentication.';
    case 'auth/network-request-failed': return 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت.';
    case 'auth/account-exists-with-different-credential': return 'يوجد حساب بهذا البريد باستخدام طريقة تسجيل دخول أخرى.';
    case 'auth/invalid-api-key': return 'إعدادات Firebase غير صحيحة. راجع متغيرات Vercel.';
    default: return 'تعذر تسجيل الدخول عبر Google. تحقق من إعدادات Firebase Authorized domains وحاول مرة أخرى.';
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Test connection on startup
  useEffect(() => {
    async function init() {
      await testConnection();
    }
    init();
  }, []);

  const refreshCurrentUser = async () => {
    if (!firebaseUser) return;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as User;
        const isSoleAdmin = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL;
        const normalized: User = {
          ...data,
          id: snap.id,
          role: isSoleAdmin ? 'ADMIN' : 'EMPLOYEE',
          status: isSoleAdmin ? 'active' : data.status,
        };
        setCurrentUser(normalized);
        setIsProfileIncomplete(!isSoleAdmin && (!normalized.department || !normalized.position || !normalized.phone));
      }
    } catch (err) {
      console.error('Error refreshing current user:', err);
    }
  };

  // Listen to Auth changes and surface redirect OAuth errors.
  useEffect(() => {
    let active = true;
    getRedirectResult(auth).catch(error => {
      if (active) setAuthError(getGoogleAuthErrorMessage(error));
      console.error('Google redirect result error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async fUser => {
      setFirebaseUser(fUser);
      if (fUser) {
        try {
          const userRef = doc(db, 'users', fUser.uid);
          const snap = await getDoc(userRef);

          const isSoleAdmin = fUser.email?.toLowerCase() === ADMIN_EMAIL;

          if (isSoleAdmin) {
            const usersSnap = await getDocs(collection(db, 'users'));
            await Promise.all(usersSnap.docs.filter(userDoc => userDoc.id !== fUser.uid && userDoc.data().role === 'ADMIN').map(userDoc =>
              updateDoc(userDoc.ref, { role: 'EMPLOYEE', updatedAt: new Date().toISOString() })
            ));
          }

          if (snap.exists()) {
            const data = snap.data() as User;
            const normalized: User = { ...data, id: snap.id, role: isSoleAdmin ? 'ADMIN' : 'EMPLOYEE', status: isSoleAdmin ? 'active' : data.status };
            if (isSoleAdmin && (data.role !== 'ADMIN' || data.status !== 'active')) {
              await setDoc(userRef, { role: 'ADMIN', status: 'active' }, { merge: true });
            }
            setCurrentUser(normalized);
            setAuthError(null);
            setIsProfileIncomplete(!isSoleAdmin && (!normalized.department || !normalized.position || !normalized.phone));
          } else {
            const newUser: User = {
              id: fUser.uid,
              email: fUser.email || '',
              displayName: fUser.displayName || fUser.email?.split('@')[0] || 'موظف جديد',
              photoURL: fUser.photoURL || undefined,
              role: isSoleAdmin ? 'ADMIN' : 'EMPLOYEE',
              department: isSoleAdmin ? 'الإدارة العامة' : '',
              position: isSoleAdmin ? 'مسؤول النظام' : '',
              phone: '',
              status: isSoleAdmin ? 'active' : 'pending',
              joinedDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newUser);
            setCurrentUser(newUser);
            setAuthError(null);
            setIsProfileIncomplete(!isSoleAdmin);
          }
        } catch (err) {
          console.error('Failed to load user profile from Firestore:', err);
          setAuthError('تم تسجيل الدخول إلى Google، لكن تعذر تحميل ملفك من Firestore. تحقق من نشر Firestore Rules وإعدادات Firebase.');
          // Never invent an active profile when Firestore is unavailable.
          setCurrentUser(null);
          setIsProfileIncomplete(false);
        }
      } else {
        // When not logged in via Firebase Auth, set currentUser to null so LoginView is displayed
        setCurrentUser(null);
        setIsProfileIncomplete(false);
      }
      setLoading(false);
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
      console.error('Google sign-in error:', error);
      // Popup is unreliable in embedded browsers and can be blocked by policy.
      // Redirect uses Firebase's configured authDomain and works on Vercel HTTPS.
      if (code === 'auth/popup-blocked' || code === 'auth/popup-cancelled-by-user' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          const message = getGoogleAuthErrorMessage(redirectError);
          setAuthError(message);
          throw Object.assign(new Error(message), { code: (redirectError as { code?: string })?.code });
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
    role: Role,
    department: string,
    position: string,
    phone?: string
  ) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const isSoleAdmin = email.toLowerCase() === ADMIN_EMAIL;
      const newUser: User = {
        id: res.user.uid,
        email,
        displayName,
        role: isSoleAdmin ? 'ADMIN' : 'EMPLOYEE',
        department,
        position,
        phone: phone || '',
        status: isSoleAdmin ? 'active' : 'pending',
        joinedDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', res.user.uid), newUser);
      setCurrentUser(newUser);
      setIsProfileIncomplete(!isSoleAdmin);
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
  }) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      const updated: Partial<User> = {
        displayName: data.displayName,
        phone: data.phone,
        department: data.department,
        position: data.position,
        status: currentUser.role === 'ADMIN' ? 'active' : 'pending',
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
      await signOut(auth);
      setAuthError(null);
      setCurrentUser(null);
      setIsProfileIncomplete(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const role: Role = currentUser?.role || 'EMPLOYEE';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        role,
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
