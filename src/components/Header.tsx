import React, { useState } from 'react';
import { ArrowLeft, Sun, Moon, LogIn, LogOut, User as UserIcon, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../assets/logo';

interface HeaderProps {
  currentView: string;
  onGoHome: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onGoHome,
  theme,
  onToggleTheme,
  onOpenAuthModal,
}) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[var(--sidebar)] text-white shadow-md select-none sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {currentView !== 'home' && (
          <button
            onClick={onGoHome}
            className="flex items-center gap-1 text-sm font-medium text-[var(--sidebar-ink)] hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-md hover:bg-white/10"
            title="กลับเมนูหลัก"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">กลับเมนู</span>
          </button>
        )}

        <BrandLogo />

        <div>
          <div className="text-sm sm:text-base font-semibold tracking-tight text-white leading-tight">
            Mixed Bed Toolkit
          </div>
          <div className="text-[11px] sm:text-xs text-[var(--sidebar-ink)] flex items-center gap-1.5 leading-tight">
            <span>โรงไฟฟ้าพระนครเหนือ ชุดที่ 1</span>
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
            <span className="hidden md:inline text-emerald-300 text-[10px]">Cloud Database</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-[var(--sidebar-ink)] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title={theme === 'dark' ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Auth status / button */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer border border-white/10"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-400"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="text-xs font-medium max-w-[100px] sm:max-w-[140px] truncate text-white">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-xl p-3 z-50 text-[var(--ink)]">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-[var(--line)]">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-9 h-9 rounded-full object-cover border border-[var(--line)]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold">
                        {user.email ? user.email[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {user.displayName || 'ผู้ใช้งาน Google'}
                      </div>
                      <div className="text-[11px] text-[var(--ink-soft)] truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="py-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>เข้าสู่ระบบด้วย Google Mail</span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--ink-soft)] py-1">
                      <Database className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent)]" />
                      <span>ฐานข้อมูล Firestore พร้อมใช้งาน</span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--ink-soft)] py-1">
                      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                      <span>สิทธิเข้าถึงเฉพาะบัญชีคุณ (ABAC Secure)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)]">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        logout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            title="เข้าสู่ระบบด้วย Google Mail เพื่อบันทึกข้อมูล"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">เข้าสู่ระบบ Google</span>
            <span className="sm:hidden">Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
