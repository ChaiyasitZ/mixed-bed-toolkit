import React from 'react';
import { ChartNoAxesCombined, Database, ArrowRight, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { ViewType } from './Sidebar';
import {
  SaltRecord,
  SilicaRecord,
  CyclePredictionRecord,
  normalizeCycleRecordToBatch,
} from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface HomeViewProps {
  onNavigate: (view: ViewType) => void;
  onOpenAuth?: () => void;
  saltRecords?: SaltRecord[];
  silicaRecords?: SilicaRecord[];
  cycleRecords: CyclePredictionRecord[];
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenAuth,
  cycleRecords,
}) => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const isTh = language === 'th';

  // Only show saved batch metrics when the user is logged in and has saved records
  const activeRecords = user ? cycleRecords : [];
  const latestBatch = activeRecords[0] ? normalizeCycleRecordToBatch(activeRecords[0]) : null;
  const totalBatches = activeRecords.length;

  return (
    <div className="space-y-5">
      {/* Compact Balanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
        <div className="space-y-1 min-w-0">
          <div className="text-xs font-medium text-[var(--ink-soft)]">
            {isTh
              ? 'ระบบผลิตน้ำบริสุทธิ์ของโรงไฟฟ้าพระนครเหนือชุดที่ 1'
              : 'Demineralized Water System · North Bangkok Power Plant Block 1'}
          </div>
          <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[var(--ink)]">
            {isTh
              ? 'คำนวณและคาดการณ์ Cycle ของระบบ Mixed bed'
              : 'Mixed Bed Cycle Calculation & Forecasting'}
          </h1>
        </div>

        {!user && onOpenAuth && (
          <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-2 rounded-xl bg-[var(--panel)] hover:bg-[var(--sidebar-hover)] text-[var(--ink)] border border-[var(--line)] text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4 text-[var(--accent)]" />
              <span>{isTh ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Workspace Navigation Cards (Top Position) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('cycle')}
          className="group p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--accent)] transition-all text-left flex flex-col justify-between cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ChartNoAxesCombined className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors truncate">
                {isTh
                  ? '01. คาดการณ์ Cycle & Ion Load (Cond + Silica)'
                  : '01. Cycle & Ion Load Forecasting'}
              </h2>
            </div>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
              {isTh
                ? 'คำนวณความเข้มข้น Inlet/Outlet, Ion ที่หายไป, Ion Load สะสม, % Load on Resin และจุดตัดรอบ 98%'
                : 'Calculate Inlet/Outlet concentrations, Ions Removed, Cumulative Ion Load, % Load on Resin, and 98% cut-off.'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--accent)] font-semibold">
            <span>{t('enterCalc')}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="group p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--accent)] transition-all text-left flex flex-col justify-between cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors truncate">
                {isTh ? '02. ฐานข้อมูลประวัติชุดข้อมูล (Batch History)' : '02. Saved Batch History & Export'}
              </h2>
            </div>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
              {isTh
                ? 'เรียกดูชุดข้อมูลที่บันทึกไว้ โหลดกลับมาแก้ไข ลบรายแถวหรือทั้งชุด และส่งออกไฟล์ Excel / CSV / TXT / JSON'
                : 'Browse saved batches, load into the editor, delete individual rows or full sets, and export Excel / CSV / TXT / JSON.'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--accent)] font-semibold">
            <span>{t('viewAllHistory')}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* 4-Column KPI Summary Strip (Shows real values ONLY when logged in and saved data exists) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1"
        >
          <div className="text-xs text-[var(--ink-soft)] truncate">
            {isTh ? 'ชุดข้อมูลที่บันทึก' : 'Saved Batches'}
          </div>
          <div className="text-lg sm:text-xl font-bold text-[var(--ink)] font-mono tabular-nums whitespace-nowrap">
            {user ? (
              <>
                {totalBatches}{' '}
                <span className="text-xs font-sans font-normal text-[var(--ink-soft)]">
                  {isTh ? 'ชุด' : 'sets'}
                </span>
              </>
            ) : (
              <span className="text-[var(--ink-soft)]/50">—</span>
            )}
          </div>
          <div className="text-[11px] text-[var(--ink-soft)] truncate">
            {!user
              ? isTh
                ? 'ยังไม่ได้เข้าสู่ระบบ'
                : 'Not signed in'
              : latestBatch
              ? latestBatch.batchName
              : isTh
              ? 'ยังไม่มีชุดข้อมูลที่บันทึก'
              : 'No saved batches yet'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.03 }}
          className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1"
        >
          <div className="text-xs text-[var(--ink-soft)] truncate">
            {isTh ? 'จุดตัดรอบ 98%' : '98% Cut-off Volume'}
          </div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums whitespace-nowrap ${
              latestBatch ? 'text-[var(--accent)]' : 'text-[var(--ink-soft)]/50'
            }`}
          >
            {latestBatch ? `${latestBatch.predictedCycle.toFixed(3)} m³` : '—'}
          </div>
          <div className="text-[11px] text-[var(--ink-soft)] truncate">
            {latestBatch
              ? `Cycle ${(latestBatch.cycleEnd || 0).toFixed(2)} m³`
              : isTh
              ? 'รอข้อมูลจากการคำนวณ'
              : 'Waiting for calculation data'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.06 }}
          className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1"
        >
          <div className="text-xs text-[var(--ink-soft)] truncate">
            {isTh ? 'Ion Load รวมล่าสุด' : 'Combined Ion Load'}
          </div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums whitespace-nowrap ${
              latestBatch ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]/50'
            }`}
          >
            {latestBatch ? `${(latestBatch.totalCombinedIonLoad || 0).toFixed(3)} mol` : '—'}
          </div>
          <div className="text-[11px] text-[var(--ink-soft)] font-mono tabular-nums truncate">
            {latestBatch
              ? `Cond ${(latestBatch.cumulativeIonLoad || 0).toFixed(3)} · Si ${(latestBatch.cumulativeSilicaLoad || 0).toFixed(3)}`
              : isTh
              ? 'รอข้อมูลจากการคำนวณ'
              : 'Waiting for calculation data'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.09 }}
          className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1"
        >
          <div className="text-xs text-[var(--ink-soft)] truncate">
            {isTh ? '% Load เรซินล่าสุด' : 'Resin % Load'}
          </div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums whitespace-nowrap ${
              latestBatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--ink-soft)]/50'
            }`}
          >
            {latestBatch ? `${(latestBatch.combinedPercentLoad || 0).toFixed(3)}%` : '—'}
          </div>
          <div className="text-[11px] text-[var(--ink-soft)] font-mono tabular-nums truncate">
            {latestBatch
              ? `Silica: ${(latestBatch.silicaPercentLoad || 0).toFixed(3)}%`
              : isTh
              ? 'รอข้อมูลจากการคำนวณ'
              : 'Waiting for calculation data'}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

