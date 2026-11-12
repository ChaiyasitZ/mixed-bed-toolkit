import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Database, Cloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, authError, clearAuthError } = useAuth();
  const { language } = useLanguage();
  const isTh = language === 'th';
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl p-5 sm:p-6 z-10 text-[var(--ink)] modal-animated">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">
              {isTh ? 'เข้าสู่ระบบ Google Mail' : 'Sign in with Google Account'}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--ink-soft)] mt-0.5">
              {isTh
                ? 'บันทึกและจัดการข้อมูลการคำนวณอย่างเป็นระเบียบและปลอดภัย'
                : 'Securely store, organize, and synchronize calculations'}
            </p>
          </div>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{authError}</span>
              <button
                onClick={clearAuthError}
                className="block underline mt-1 font-semibold cursor-pointer"
              >
                {isTh ? 'ลองใหม่อีกครั้ง' : 'Try again'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6 bg-[var(--bg)] p-4 rounded-xl border border-[var(--line)] text-xs sm:text-sm text-[var(--ink-soft)] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--ink)]">
                {isTh ? 'ระบบความปลอดภัยมาตรฐาน:' : 'Standard Cloud Security:'}
              </strong>{' '}
              {isTh
                ? 'ข้อมูลจะถูกจัดเก็บใน Firestore พร้อมกฎความปลอดภัยเฉพาะบัญชีของคุณ (ผู้ใช้อื่นไม่สามารถมองเห็นข้อมูลได้)'
                : 'Data is protected in Firestore with account-level isolation and strict security rules.'}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--ink)]">
                {isTh ? 'ซิงก์ข้อมูลอัตโนมัติ:' : 'Automated Sync:'}
              </strong>{' '}
              {isTh
                ? 'เข้าถึงประวัติ %Salt Rejection, %Silica Rejection และผลคาดการณ์ Cycle ได้ทุกอุปกรณ์'
                : 'Access your %Salt Rejection, %Silica Rejection, and Cycle Predictions across all devices.'}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--ink)]">
                {isTh ? 'ไม่สูญหาย:' : 'Zero Data Loss:'}
              </strong>{' '}
              {isTh
                ? 'ข้อมูลการทำงานของโรงไฟฟ้าพระนครเหนือ ชุดที่ 1 ถูกบันทึกไว้ถาวรและส่งออกเป็น CSV ได้ทุกเมื่อ'
                : 'Power plant historical data is reliably preserved and exportable to CSV at any time.'}
            </div>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white dark:bg-neutral-900 border border-[var(--line)] text-[var(--ink)] font-semibold text-sm sm:text-base shadow-sm hover:shadow-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          <span>
            {isSubmitting
              ? (isTh ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...')
              : (isTh ? 'เข้าสู่ระบบด้วยบัญชี Google Mail' : 'Sign in with Google Account')}
          </span>
        </button>

        <p className="mt-3 text-center text-[11px] text-[var(--ink-soft)]">
          {isTh
            ? 'ล็อกอินด้วย Google OAuth อย่างปลอดภัย ไม่มีเก็บรหัสผ่านในระบบ'
            : 'Secure authentication powered by Google OAuth. No passwords stored.'}
        </p>
      </div>
    </div>,
    document.body
  );
};
