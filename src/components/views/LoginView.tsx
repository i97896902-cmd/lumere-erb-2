import React, { useState } from 'react';
import { Mail, Lock, Shield, AlertCircle, CheckCircle2, User, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface LoginViewProps {
  onSuccess?: () => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const {
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    authError,
  } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('Design');
  const [position, setPosition] = useState('أخصائي');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email form accordion toggle
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
        showToast('تم تسجيل الدخول بنجاح', 'success');
      } else {
        await registerWithEmail(
          email.trim(),
          password,
          displayName.trim(),
          'EMPLOYEE',
          department,
          position
        );
        showToast('تم إنشاء الحساب وإرسال طلب الانضمام', 'success');
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('يوجد حساب مسجل مسبقاً بهذا البريد الإلكتروني.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('كلمة المرور يجب ألا تقل عن 6 خانات.');
      } else {
        setErrorMsg('فشل المصادقة. يرجى التحقق من المدخلات أو تجربة تسجيل الدخول بحساب Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      showToast('تم تسجيل الدخول بواسطة حساب Google بنجاح', 'success');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setErrorMsg(err?.message || 'تم إلغاء أو تعذر استكمال تسجيل الدخول عبر Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    try {
      await resetPassword(resetEmail.trim());
      setResetSent(true);
      showToast('تم إرسال رابط استعادة كلمة المرور', 'success');
    } catch {
      showToast('تعذر إرسال الرابط. يرجى التحقق من صحة البريد.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-center items-center p-4" dir="rtl">
      {/* Container */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200/80 shadow-xl overflow-hidden">
        {/* Brand Banner */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 p-8 text-white text-center border-b border-neutral-800 relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center mx-auto shadow-md text-white font-bold text-2xl tracking-wider border border-emerald-500/30 mb-3">
            L
          </div>
          <h1 className="font-serif tracking-widest text-2xl font-bold">LUMÉRÉ</h1>
          <p className="text-xs tracking-wider uppercase text-neutral-400 font-medium mt-1">
            نظام إدارة المهام والمشاريع المؤسسي
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {(errorMsg || authError) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg || authError}</span>
            </div>
          )}

          {/* Primary Action: Google Sign-In */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label="تسجيل الدخول باستخدام Google"
              className="w-full py-3 px-4 rounded-xl border border-neutral-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 text-neutral-800 font-semibold text-xs flex items-center justify-center gap-3 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600" aria-hidden="true" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>{isLoading ? 'جارِ الاتصال بـ Google...' : 'تسجيل الدخول السريع بحساب Google'}</span>
            </button>
            <p className="text-[11px] text-neutral-400 text-center">
              الدخول المعتمد لمنسوبي وموظفي شركة Luméré
            </p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-neutral-200" />
            <button
              type="button"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="flex-shrink mx-3 text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
            >
              <span>أو استخدام البريد وكلمة المرور</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEmailForm ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex-grow border-t border-neutral-200" />
          </div>

          {/* Collapsible Email / Password Form */}
          {showEmailForm && (
            <form onSubmit={handleSubmit} className="space-y-3.5 pt-1 animate-in fade-in">
              {mode === 'register' && (
                <>
                  <Input
                    label="الاسم الكامل"
                    placeholder="مثال: مروان فهد"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      label="القسم"
                      placeholder="Design / Dev"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                    />
                    <Input
                      label="المسمى الوظيفي"
                      placeholder="أخصائي تصميم"
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Input
                label="البريد الإلكتروني"
                type="email"
                placeholder="name@lumere.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="كلمة المرور"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-full py-2.5"
              >
                {mode === 'login' ? 'تسجيل الدخول بالبريد' : 'إنشاء الحساب وإرسال الطلب'}
              </Button>

              {/* Toggle Login/Register */}
              <div className="text-center pt-2">
                {mode === 'login' ? (
                  <p className="text-xs text-neutral-500">
                    ليس لديك حساب مسجل؟{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      تسجيل حساب جديد
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      تسجيل الدخول
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => {
          setIsForgotModalOpen(false);
          setResetSent(false);
        }}
        title="استعادة كلمة المرور"
        subtitle="سنرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
        maxWidth="sm"
      >
        {resetSent ? (
          <div className="text-center py-4 space-y-3" dir="rtl">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-neutral-900">يرجى التحقق من بريدك</p>
            <p className="text-xs text-neutral-500">
              تم إرسال رابط إعادة التعيين إلى <strong>{resetEmail}</strong>.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsForgotModalOpen(false);
                setResetSent(false);
              }}
            >
              العودة لتسجيل الدخول
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4" dir="rtl">
            <Input
              label="البريد الإلكتروني *"
              type="email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              placeholder="name@lumere.com"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForgotModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary">
                إرسال الرابط
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
