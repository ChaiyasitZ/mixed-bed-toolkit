import React, { useState } from 'react';
import {
  FlaskConical,
  Save,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  LogIn,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SaltRecord, addSaltRecord, deleteSaltRecord } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ConfirmModal } from './ConfirmModal';

interface SaltRejectionViewProps {
  records: SaltRecord[];
  onAddLocalRecord: (record: Omit<SaltRecord, 'id' | 'userId' | 'createdAt'>) => void;
  onDeleteLocalRecord: (id: string) => void;
  onClearAllLocal: () => void;
  onOpenAuth: () => void;
}

export const SaltRejectionView: React.FC<SaltRejectionViewProps> = ({
  records,
  onAddLocalRecord,
  onDeleteLocalRecord,
  onClearAllLocal,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTh = language === 'th';
  const [feed, setFeed] = useState<string>('');
  const [permeate, setPermeate] = useState<string>('');
  const [cycle, setCycle] = useState<string>('');
  const [result, setResult] = useState<{
    rejection: number;
    feedVal: number;
    permVal: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleCalculate = () => {
    setErrorMsg('');
    setSaveSuccess(false);
    const f = parseFloat(feed);
    const p = parseFloat(permeate);

    if (isNaN(f) || isNaN(p) || f <= 0) {
      setErrorMsg(
        isTh
          ? 'กรุณากรอกค่า Feed Water และ Permeate Water ให้ถูกต้อง (Feed ต้องมากกว่า 0)'
          : 'Please enter valid Feed and Permeate values (Feed must be > 0)'
      );
      setResult(null);
      return;
    }

    if (p > f) {
      setErrorMsg(
        isTh
          ? 'ค่า Permeate Water ไม่ควรมากกว่า Feed Water กรุณาตรวจสอบค่าที่กรอก'
          : 'Permeate Water should not exceed Feed Water. Please verify values.'
      );
    }

    const rejection = ((f - p) / f) * 100;
    setResult({
      rejection,
      feedVal: f,
      permVal: p,
    });
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      if (user) {
        await addSaltRecord({
          feed: result.feedVal,
          permeate: result.permVal,
          rejection: result.rejection,
          cycle: cycle.trim() || undefined,
        });
      } else {
        onAddLocalRecord({
          feed: result.feedVal,
          permeate: result.permVal,
          rejection: result.rejection,
          cycle: cycle.trim() || undefined,
        });
      }
      setSaveSuccess(true);
      setCycle('');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setErrorMsg(isTh ? 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง' : 'Failed to save record. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const requestDelete = (recordId: string, cycleLabel?: string) => {
    setConfirmConfig({
      isOpen: true,
      title: isTh ? 'ลบรายการบันทึกนี้?' : 'Delete this record?',
      message: isTh
        ? `คุณต้องการลบข้อมูลรอบ ${cycleLabel || 'นี้'} ออกจากประวัติ %Salt Rejection ใช่หรือไม่?`
        : `Are you sure you want to delete cycle ${cycleLabel || 'this'} from %Salt Rejection history?`,
      onConfirm: async () => {
        if (user) {
          try {
            await deleteSaltRecord(recordId);
          } catch (err) {
            console.error('Delete error:', err);
          }
        } else {
          onDeleteLocalRecord(recordId);
        }
      },
    });
  };

  const requestClearAll = () => {
    setConfirmConfig({
      isOpen: true,
      title: isTh ? 'ล้างประวัติ %Salt ทั้งหมด?' : 'Clear all %Salt history?',
      message: isTh
        ? 'คุณแน่ใจว่าต้องการล้างประวัติการคำนวณ %Salt Rejection ทั้งหมดหรือไม่? ข้อมูลจะไม่สามารถกู้คืนได้'
        : 'Are you sure you want to clear all %Salt Rejection history? This cannot be undone.',
      onConfirm: async () => {
        if (user) {
          await Promise.all(records.map((r) => r.id && deleteSaltRecord(r.id)));
        } else {
          onClearAllLocal();
        }
      },
    });
  };

  const handleExportCSV = () => {
    if (!records.length) return;
    const headers = isTh
      ? ['รอบ/ป้ายกำกับ', 'Feed Water (uS/cm)', 'Permeate Water (uS/cm)', '%Salt Rejection', 'วันที่']
      : ['Cycle/Label', 'Feed Water (uS/cm)', 'Permeate Water (uS/cm)', '%Salt Rejection', 'Date'];
    const rows = records.map((r) => [
      `"${r.cycle || '-'}"`,
      r.feed,
      r.permeate,
      r.rejection.toFixed(2),
      `"${new Date(r.createdAt).toLocaleString(isTh ? 'th-TH' : 'en-US')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `salt_rejection_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart calculation
  const chartData = [...records].reverse(); // chronological order
  const W = 600, H = 220, padL = 40, padR = 20, padT = 20, padB = 35;
  const values = chartData.map((e) => e.rejection);
  const minV = values.length ? Math.min(...values, 90) : 90;
  const maxV = values.length ? Math.max(...values, 100.5) : 100;
  const range = maxV - minV || 1;
  const yFor = (v: number) => padT + (1 - (v - minV) / range) * (H - padT - padB);
  const xFor = (i: number) => padL + (values.length <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (values.length - 1));

  const points = chartData.map((d, i) => `${xFor(i)},${yFor(d.rejection)}`).join(' ');

  const handleReset = () => {
    setFeed('');
    setPermeate('');
    setCycle('');
    setResult(null);
    setErrorMsg('');
    setSaveSuccess(false);
  };

  const handleApplyToday = () => {
    const today = new Date().toLocaleDateString(isTh ? 'th-TH' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    setCycle(isTh ? `รอบวันที่ ${today}` : `Run Date ${today}`);
  };

  const feedNum = parseFloat(feed);
  const permNum = parseFloat(permeate);
  const hasLiveWarning = !isNaN(feedNum) && !isNaN(permNum) && feedNum > 0 && permNum >= feedNum;

  return (
    <div className="space-y-6 view-transition">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
                %Salt Rejection
              </h2>
              <p className="text-xs sm:text-sm text-[var(--ink-soft)] mt-0.5">
                {isTh
                  ? 'ระบบ Reverse Osmosis (RO) · โรงไฟฟ้าพระนครเหนือ ชุดที่ 1'
                  : 'Reverse Osmosis (RO) System · North Bangkok Power Plant Block 1'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ink-soft)] bg-[var(--panel)] px-3.5 py-1.5 rounded-xl border border-[var(--line)] self-start sm:self-auto shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>{isTh ? 'เกณฑ์ควบคุม: ' : 'Control Limit: '}<strong className="text-[var(--ink)]">≥ 95.0%</strong></span>
        </div>
      </div>

      {/* Modern High-Precision Input Panel */}
      <div className="rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-sm overflow-hidden transition-all">
        {/* Panel Header */}
        <div className="px-5 py-3.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--ink)]">
              {isTh ? 'ป้อนค่า Conductivity สำหรับคำนวณ' : 'Enter Conductivity for Calculation'}
            </span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-rose-500 transition-colors cursor-pointer px-2.5 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20"
            title={isTh ? 'ล้างค่าทั้งหมด' : 'Reset all inputs'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isTh ? 'ล้างค่า' : 'Reset'}</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Main 2-Column Parameter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Feed Water Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--ink)] flex items-center gap-1">
                  <span>{isTh ? 'Feed Water (ก่อนเข้า RO)' : 'Feed Water (RO Inlet)'}</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium">
                  {isTh ? 'ช่วงปกติ: 150 – 350' : 'Normal: 150 – 350'}
                </span>
              </div>

              <div className="relative flex items-center rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 focus-within:bg-[var(--panel)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all shadow-2xs">
                <input
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  step="0.01"
                  min="0"
                  value={feed}
                  onChange={(e) => setFeed(e.target.value)}
                  placeholder={isTh ? 'เช่น 220.0' : 'e.g. 220.0'}
                  className="w-full text-base sm:text-lg font-semibold pl-4 pr-16 py-2.5 bg-transparent text-[var(--ink)] focus:outline-none font-mono tabular-nums placeholder:text-[var(--ink-soft)]/40"
                />
                <span className="absolute right-3.5 text-xs sm:text-sm font-mono font-medium text-[var(--ink-soft)] select-none pointer-events-none">
                  µS/cm
                </span>
              </div>

              {/* Quick suggestion pills */}
              <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                <span className="text-xs sm:text-sm text-[var(--ink-soft)]">
                  {isTh ? 'เติมค่าตัวอย่าง:' : 'Sample values:'}
                </span>
                {[210, 225, 245].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFeed(val.toString())}
                    className="text-xs sm:text-sm font-mono px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--accent)] hover:text-white active:scale-95 text-[var(--ink-soft)] border border-[var(--line)] transition-all cursor-pointer"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Permeate Water Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--ink)] flex items-center gap-1">
                  <span>{isTh ? 'Permeate Water (หลังผ่าน RO)' : 'Permeate Water (RO Outlet)'}</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium">
                  {isTh ? 'ช่วงปกติ: 2.0 – 10.0' : 'Normal: 2.0 – 10.0'}
                </span>
              </div>

              <div className="relative flex items-center rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 focus-within:bg-[var(--panel)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all shadow-2xs">
                <input
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  step="0.01"
                  min="0"
                  value={permeate}
                  onChange={(e) => setPermeate(e.target.value)}
                  placeholder={isTh ? 'เช่น 6.5' : 'e.g. 6.5'}
                  className="w-full text-base sm:text-lg font-semibold pl-4 pr-16 py-2.5 bg-transparent text-[var(--ink)] focus:outline-none font-mono tabular-nums placeholder:text-[var(--ink-soft)]/40"
                />
                <span className="absolute right-3.5 text-xs sm:text-sm font-mono font-medium text-[var(--ink-soft)] select-none pointer-events-none">
                  µS/cm
                </span>
              </div>

              {/* Quick suggestion pills */}
              <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                <span className="text-xs sm:text-sm text-[var(--ink-soft)]">
                  {isTh ? 'เติมค่าตัวอย่าง:' : 'Sample values:'}
                </span>
                {[4.5, 6.0, 7.5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPermeate(val.toString())}
                    className="text-xs sm:text-sm font-mono px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--accent)] hover:text-white active:scale-95 text-[var(--ink-soft)] border border-[var(--line)] transition-all cursor-pointer"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Warning banner if permeate >= feed */}
          {hasLiveWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>
                {isTh ? (
                  <>
                    <strong>ข้อสังเกต:</strong> ค่า Permeate Water ({permNum}) ต้องน้อยกว่าค่า Feed Water ({feedNum}) ตามหลักการกรองของเยื่อเมมเบรน RO
                  </>
                ) : (
                  <>
                    <strong>Notice:</strong> Permeate Water ({permNum}) must be lower than Feed Water ({feedNum}) in RO membrane filtration.
                  </>
                )}
              </span>
            </div>
          )}

          {/* Optional Label / Cycle Field */}
          <div className="pt-2 border-t border-[var(--line)]/60">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs sm:text-sm font-semibold text-[var(--ink)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                <span>{isTh ? 'ป้ายกำกับรอบ / หมายเหตุประจำวัน' : 'Cycle Label / Daily Note'}</span>
                <span className="text-xs text-[var(--ink-soft)] font-normal">
                  {isTh ? '(ไม่บังคับ)' : '(Optional)'}
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleApplyToday}
                  className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer"
                >
                  <Calendar className="w-3 h-3" />
                  <span>{isTh ? 'ใส่วันที่วันนี้' : 'Insert Today'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('Train A')}
                  className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] cursor-pointer"
                >
                  Train A
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('Train B')}
                  className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] cursor-pointer"
                >
                  Train B
                </button>
              </div>
            </div>

            <input
              type="text"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder={isTh ? 'เช่น รอบที่ 1, RO Train A, หรือ กะเช้า 01/10/2026' : 'e.g. Run 1, RO Train A, or Morning Shift'}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/40 focus:bg-[var(--panel)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 text-[var(--ink)] transition-all placeholder:text-[var(--ink-soft)]/50"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Button Bar */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleCalculate}
              className="flex-1 py-3 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-deep)] active:scale-[0.99] text-white font-bold text-sm sm:text-base transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-sky-200" />
              <span>{isTh ? 'คำนวณ %Salt Rejection' : 'Calculate %Salt Rejection'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Result Card */}
      {result !== null && (
        <div className="p-6 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-sm space-y-4 card-reveal">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <div className="text-xs sm:text-sm uppercase tracking-wider font-bold text-[var(--ink-soft)]">
              {isTh ? 'ผลการประเมินประสิทธิภาพ' : 'Performance Evaluation Result'}
            </div>
            {result.rejection >= 95 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isTh ? 'ผ่านเกณฑ์มาตรฐาน (≥ 95%)' : 'Passed Criteria (≥ 95%)'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isTh ? 'ต่ำกว่าเกณฑ์ควบคุม (< 95%)' : 'Below Control Limit (< 95%)'}</span>
              </span>
            )}
          </div>

          <div className="text-center py-2">
            <div className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mb-1">
              {isTh ? '%Salt Rejection (การกำจัดเกลือ)' : '%Salt Rejection (Salt Removal)'}
            </div>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--accent)] font-mono tracking-tight">
                {result.rejection.toFixed(2)}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[var(--ink-soft)]">%</span>
            </div>
          </div>

          {/* Formula calculation trace */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs sm:text-sm text-[var(--ink-soft)] font-mono flex items-center justify-center overflow-x-auto text-center">
            <span>
              %SR = (1 − ({result.permVal} / {result.feedVal})) × 100% ={' '}
              <strong className="text-[var(--ink)] text-sm sm:text-base">{result.rejection.toFixed(2)}%</strong>
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                saveSuccess
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? (isTh ? 'กำลังบันทึก...' : 'Saving...')
                  : saveSuccess
                  ? (isTh ? '✓ บันทึกเรียบร้อย' : '✓ Saved Successfully')
                  : (isTh ? '＋ บันทึกลงฐานข้อมูล' : '＋ Save to Database')}
              </span>
            </button>

            {!user && (
              <button
                onClick={onOpenAuth}
                className="text-xs sm:text-sm text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isTh ? 'เข้าสู่ระบบ Google เพื่อซิงก์คลาวด์ถาวร' : 'Sign in with Google for cloud sync'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* History and Trend Chart */}
      {records.length > 0 && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                {isTh
                  ? `ประวัติที่บันทึกไว้ & กราฟแนวโน้ม (${records.length} รายการ)`
                  : `Recorded History & Trend (${records.length} records)`}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--ink-soft)] mt-0.5">
                {isTh
                  ? 'เส้นประสีแดงแสดงเกณฑ์ควบคุม 95% Control Limit'
                  : 'Dashed red line indicates 95% Control Limit'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                title={isTh ? 'ส่งออกประวัติเป็นไฟล์ CSV' : 'Export history as CSV'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isTh ? 'ส่งออก CSV' : 'Export CSV'}</span>
              </button>
              <button
                onClick={requestClearAll}
                className="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                title={isTh ? 'ล้างประวัติ' : 'Clear history'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="relative w-full overflow-hidden bg-[var(--bg)] rounded-xl p-2 border border-[var(--line)]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44 sm:h-52 select-none">
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map((step) => {
                const val = minV + (range * step) / 4;
                const y = yFor(val);
                return (
                  <g key={step}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3.5} textAnchor="end" className="fill-[var(--ink-soft)] text-[11px] font-mono">
                      {val.toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              {/* 95% Control line */}
              {95 >= minV && 95 <= maxV && (
                <g>
                  <line
                    x1={padL}
                    y1={yFor(95)}
                    x2={W - padR}
                    y2={yFor(95)}
                    stroke="var(--warn)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text x={W - padR} y={yFor(95) - 4} textAnchor="end" className="fill-[var(--warn)] text-[11px] font-bold">
                    Control 95%
                  </text>
                </g>
              )}

              {/* Data line */}
              {chartData.length > 1 && (
                <polyline
                  points={points}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Points */}
              {chartData.map((d, i) => {
                const cx = xFor(i);
                const cy = yFor(d.rejection);
                const isHovered = hoveredIdx === i;
                return (
                  <g
                    key={d.id || i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      className={d.rejection >= 95 ? 'fill-[var(--accent)] stroke-white stroke-2' : 'fill-[var(--warn)] stroke-white stroke-2'}
                    />
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-[var(--ink-soft)] text-[11px]">
                      {d.cycle ? (d.cycle.length > 8 ? d.cycle.substring(0, 8) + '..' : d.cycle) : `#${i + 1}`}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && chartData[hoveredIdx] && (
              <div className="absolute top-3 right-3 p-2.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-md text-xs space-y-0.5 pointer-events-none">
                <div className="font-bold text-[var(--accent)]">
                  {chartData[hoveredIdx].rejection.toFixed(2)}%
                </div>
                <div>Feed: {chartData[hoveredIdx].feed} µS/cm</div>
                <div>Perm: {chartData[hoveredIdx].permeate} µS/cm</div>
                {chartData[hoveredIdx].cycle && (
                  <div className="text-[var(--ink-soft)]">{chartData[hoveredIdx].cycle}</div>
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full min-w-[500px] text-xs sm:text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--panel)] text-[var(--ink-soft)] font-semibold border-b border-[var(--line)]">
                <tr>
                  <th className="py-2.5 px-3">{isTh ? 'รอบ/ป้ายกำกับ' : 'Cycle / Label'}</th>
                  <th className="py-2.5 px-3">Feed (µS/cm)</th>
                  <th className="py-2.5 px-3">Permeate (µS/cm)</th>
                  <th className="py-2.5 px-3">%Rejection</th>
                  <th className="py-2.5 px-3 text-right">{isTh ? 'จัดการ' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {records.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{r.cycle || `#${records.length - i}`}</td>
                    <td className="py-2.5 px-3 font-mono">{r.feed}</td>
                    <td className="py-2.5 px-3 font-mono">{r.permeate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span className={r.rejection >= 95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {r.rejection.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => requestDelete(r.id, r.cycle)}
                        className="p-1.5 text-[var(--warn)] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title={isTh ? 'ลบรายการนี้' : 'Delete this record'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={isTh ? 'ลบข้อมูล' : 'Delete'}
          cancelLabel={isTh ? 'ยกเลิก' : 'Cancel'}
          isDestructive={true}
          onConfirm={confirmConfig.onConfirm}
          onClose={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
};
