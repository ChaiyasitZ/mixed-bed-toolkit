import React from 'react';
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Database,
  X,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Globe,
  PanelLeftClose,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { BrandLogo } from '../assets/logo';

export type ViewType = 'home' | 'salt' | 'silica' | 'cycle' | 'history';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  recordCounts: {
    salt: number;
    silica: number;
    cycle: number;
  };
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  recordCounts,
  isOpenMobile,
  onCloseMobile,
  theme,
  onToggleTheme,
  onOpenAuthModal,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const totalRecords = recordCounts.cycle;

  const navItems = [
    {
      id: 'home' as ViewType,
      label: language === 'th' ? 'หน้าหลัก / แดชบอร์ด' : 'Home / Dashboard',
      sublabel: language === 'th' ? 'ภาพรวมและผลสรุป' : 'Overview & Quick Actions',
      icon: LayoutDashboard,
      count: null,
    },
    {
      id: 'cycle' as ViewType,
      label: language === 'th' ? 'คาดการณ์ Cycle & Ion Load' : 'Cycle & Ion Load Prediction',
      sublabel: language === 'th' ? 'วิเคราะห์ % Load เรซิน' : 'Resin % Load & Cycle',
      icon: ChartNoAxesCombined,
      count: recordCounts.cycle > 0 ? recordCounts.cycle : null,
    },
    {
      id: 'history' as ViewType,
      label: language === 'th' ? 'ฐานข้อมูลประวัติ' : 'Batch History & Logs',
      sublabel: language === 'th' ? 'บันทึกและส่งออกชุดข้อมูล' : 'Saved Batches & CSV Export',
      icon: Database,
      count: totalRecords > 0 ? totalRecords : null,
    },
  ];

  const handleNavClick = (viewId: ViewType) => {
    onSelectView(viewId);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {isOpenMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs z-40 md:hidden"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 md:z-30 w-72 h-screen bg-[var(--sidebar)] text-[var(--sidebar-ink)] flex flex-col justify-between border-r border-[var(--sidebar-border)] shadow-xl md:shadow-none transition-[transform,margin,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed ? 'md:-ml-72 md:opacity-0 md:pointer-events-none' : 'md:ml-0 md:opacity-100'
        }`}
      >
        {/* Desktop Edge Collapse Tab */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3 top-6 z-40 w-6 h-6 rounded-full bg-[var(--sidebar)] border border-[var(--sidebar-border)] text-[var(--sidebar-muted)] hover:text-[var(--sidebar-title)] hover:border-[var(--accent)] items-center justify-center shadow-sm hover:scale-105 transition-all cursor-pointer group"
            title={`${t('hideSidebar')} (Ctrl+B)`}
            aria-label={t('hideSidebar')}
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Top: Header & Brand */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="p-4 md:p-5 border-b border-[var(--sidebar-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <BrandLogo />
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[var(--sidebar-title)] tracking-tight leading-tight truncate">
                  {t('appTitle')}
                </div>
                <div className="text-xs text-[var(--sidebar-muted)] truncate mt-0.5">
                  {t('appSubtitle')}
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 rounded-lg text-[var(--sidebar-muted)] hover:text-[var(--sidebar-title)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer shrink-0"
              aria-label={language === 'th' ? 'ปิดเมนู' : 'Close menu'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 overflow-y-auto flex-1">
            <div className="px-3 pt-2 pb-1 text-xs font-medium text-[var(--sidebar-muted)]">
              {t('navToolsHeading')}
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group relative ${
                    isActive
                      ? 'text-[var(--sidebar-active-text)] font-semibold'
                      : 'hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-title)] text-[var(--sidebar-ink)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveSurface"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-[var(--sidebar-active)] -z-10"
                    />
                  )}

                  <div
                    className={`p-2 rounded-lg transition-colors shrink-0 ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--sidebar-icon-bg)] text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-title)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">
                      {item.label}
                    </div>
                    <div className="text-xs text-[var(--sidebar-muted)] leading-tight truncate mt-0.5">
                      {item.sublabel}
                    </div>
                  </div>

                  {item.count !== null && (
                    <span className="text-xs font-mono tabular-nums text-[var(--sidebar-muted)] shrink-0">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User Profile & Quick Settings */}
        <div className="p-3 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bottom-bg)] space-y-2.5">
          {/* User Account Bar */}
          {user ? (
            <div className="p-2.5 rounded-xl bg-[var(--sidebar-card-bg)] border border-[var(--sidebar-border)] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-[var(--sidebar-border)]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[var(--sidebar-title)] truncate leading-tight">
                    {user.displayName || t('userGoogle')}
                  </div>
                  <div className="text-[11px] text-[var(--sidebar-muted)] truncate mt-0.5 leading-tight">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-lg text-[var(--sidebar-muted)] hover:text-rose-500 hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer shrink-0"
                title={t('logout')}
                aria-label={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('loginGoogle')}</span>
            </button>
          )}

          {/* Desktop Collapse Action Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] hover:bg-[var(--sidebar-hover)] transition-colors border border-[var(--sidebar-border)] cursor-pointer group"
              title={`${t('hideSidebar')} (Ctrl+B)`}
            >
              <div className="flex items-center gap-2 font-medium whitespace-nowrap">
                <PanelLeftClose className="w-4 h-4 text-[var(--accent)]" />
                <span>{t('hideSidebar')}</span>
              </div>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--sidebar-icon-bg)] border border-[var(--sidebar-border)] text-[var(--sidebar-muted)]">
                Ctrl+B
              </kbd>
            </button>
          )}

          {/* Language & Theme Switcher */}
          <div className="flex items-center justify-between pt-0.5 px-1">
            <span className="text-xs text-[var(--sidebar-muted)]">
              {language === 'th' ? 'ระบบน้ำบริสุทธิ์' : 'Mixed Bed Toolkit'}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--sidebar-card-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] transition-colors text-xs cursor-pointer border border-[var(--sidebar-border)] whitespace-nowrap"
                title={language === 'th' ? t('switchToEnglish') : t('switchToThai')}
                aria-label="Switch language TH / EN"
              >
                <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-xs font-mono font-semibold">
                  {language === 'th' ? 'TH' : 'EN'}
                </span>
              </button>

              <button
                onClick={onToggleTheme}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--sidebar-card-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-ink)] hover:text-[var(--sidebar-title)] transition-colors text-xs cursor-pointer border border-[var(--sidebar-border)] whitespace-nowrap"
                title={
                  theme === 'dark'
                    ? language === 'th'
                      ? 'เปลี่ยนเป็นโหมดสว่าง'
                      : 'Switch to Light'
                    : language === 'th'
                    ? 'เปลี่ยนเป็นโหมดมืด'
                    : 'Switch to Dark'
                }
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs">{t('themeLight')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span className="text-xs">{t('themeDark')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
