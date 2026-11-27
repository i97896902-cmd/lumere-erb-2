import React, { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface LoginViewProps {
  onSuccess?: () => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const { signInWithGoogle, authError } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      showToast('تم تسجيل الدخول بحساب Google بنجاح', 'success');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'تم إلغاء أو تعذر استكمال تسجيل الدخول عبر Google.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center p-4"
      dir="rtl"
    >
      {/* Top Brand Lockup */}
      <div className="text-center mb-6">
        <img
          src="/assets/aistudio/image_4888628b.png"
          alt="Luméré"
          className="h-28 w-auto mx-auto object-contain select-none"
        />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
          أهلاً بك في لوميريه
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1.5">
          منظومة إدارة موارد مجموعة الشركات
        </p>
      </div>

      {/* Main White Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl border border-slate-200/75 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-7 sm:p-8 space-y-5">
        <div className="text-center space-y-1.5">
          <h2 className="text-base font-bold text-slate-900">تسجيل الدخول</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            استخدم حساب Google الخاص بك للوصول الآمن إلى مساحة عمل شركتك.
          </p>
        </div>

        {(errorMsg || authError) && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg || authError}</span>
          </div>
        )}

        <button
          type="button"
          id="btn-google-signin"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-busy={isLoading}
          aria-label="تسجيل الدخول بحساب Google"
          className="w-full py-3.5 px-5 rounded-full bg-[#18181B] hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </span>
          )}
          <span>{isLoading ? 'جارِ الاتصال بحساب Google...' : 'المتابعة باستخدام Google'}</span>
        </button>
      </div>

      {/* Footer Trust & Group Note */}
      <div className="mt-5 text-center space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
          <span>الدخول محصور بمصادقة Google المعتمدة لمنسوبي المجموعة</span>
        </div>
        <p className="text-[10px] tracking-[0.2em] text-slate-400 font-semibold">
          LUMERE · NEX AURA · ORDARK
        </p>
      </div>
    </div>
  );
}
