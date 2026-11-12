import React from 'react';
import { LayoutDashboard, ChartNoAxesCombined, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { ViewType } from './Sidebar';
import { useLanguage } from '../context/LanguageContext';

interface MobileBottomNavProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  recordCounts: {
    salt: number;
    silica: number;
    cycle: number;
  };
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  recordCounts,
}) => {
  const { language } = useLanguage();
  const totalRecords = recordCounts.cycle;

  const navItems = [
    {
      id: 'home' as ViewType,
      label: language === 'th' ? 'หน้าหลัก' : 'Home',
      icon: LayoutDashboard,
      count: null,
    },
    {
      id: 'cycle' as ViewType,
      label: language === 'th' ? 'คาดการณ์ Cycle' : 'Cycle & Ion Load',
      icon: ChartNoAxesCombined,
      count: recordCounts.cycle > 0 ? recordCounts.cycle : null,
    },
    {
      id: 'history' as ViewType,
      label: language === 'th' ? 'ประวัติ' : 'History',
      icon: Database,
      count: totalRecords > 0 ? totalRecords : null,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--panel)]/95 backdrop-blur-md border-t border-[var(--line)] select-none pb-[max(env(safe-area-inset-bottom),0.25rem)]"
      aria-label={language === 'th' ? 'เมนูหลักสำหรับมือถือ' : 'Mobile primary navigation'}
    >
      <div className="grid grid-cols-3 items-center justify-around h-14 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-colors cursor-pointer h-full min-h-[44px] ${
                isActive
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobileNavIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className="absolute top-0.5 w-8 h-0.5 rounded-full bg-[var(--accent)]"
                />
              )}

              <div className="relative flex items-center gap-1 mt-0.5">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-105 stroke-[2.25]' : 'stroke-[1.75]'
                  }`}
                />
                {item.count !== null && item.count > 0 && (
                  <span className="text-[10px] font-mono tabular-nums font-semibold text-[var(--ink-soft)]">
                    ({item.count > 99 ? '99+' : item.count})
                  </span>
                )}
              </div>

              <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
