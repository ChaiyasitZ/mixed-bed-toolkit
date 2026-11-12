import React from 'react';
import { Menu, Sun, Moon, LogIn, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { BrandLogo } from '../assets/logo';

interface MobileTopBarProps {
  onOpenSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
}

export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  onOpenSidebar,
  theme,
  onToggleTheme,
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="md:hidden flex items-center justify-between gap-3 px-3.5 h-13 bg-[var(--sidebar)]/95 backdrop-blur-md text-[var(--sidebar-title)] border-b border-[var(--sidebar-border)] sticky top-0 z-30 transition-colors">
      {/* Zone 1: Menu Trigger & Single-Line Brand Wordmark */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-1.5 text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] hover:bg-[var(--sidebar-hover)] rounded-lg transition-colors cursor-pointer shrink-0"
          aria-label={language === 'th' ? 'เปิดเมนูนำทาง' : 'Open navigation menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <BrandLogo />
          <span className="text-sm sm:text-base font-bold text-[var(--sidebar-title)] tracking-tight truncate whitespace-nowrap">
            {t('appTitle')}
          </span>
        </div>
      </div>

      {/* Zone 3: Compact Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1 px-2 py-1.5 text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer border border-[var(--sidebar-border)] text-xs font-mono font-semibold whitespace-nowrap"
          title={language === 'th' ? t('switchToEnglish') : t('switchToThai')}
          aria-label="Switch language TH / EN"
        >
          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{language === 'th' ? 'TH' : 'EN'}</span>
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2 text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer border border-[var(--sidebar-border)]"
          aria-label={language === 'th' ? 'สลับธีม' : 'Toggle theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--accent)]" />
          )}
        </button>

        {user ? (
          <button
            onClick={onOpenSidebar}
            className="flex items-center p-0.5 rounded-full cursor-pointer"
            title={user.displayName || user.email || 'Account'}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-[var(--sidebar-border)]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-white">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
            )}
          </button>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
