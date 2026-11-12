import React, { useState, useEffect } from 'react';
import { X, FlaskConical, Microscope, ChartNoAxesCombined, Save, Sliders, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SaltRecord, SilicaRecord, CyclePredictionRecord } from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';

export type EditableRecordType = 'salt' | 'silica' | 'cycle';

export interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: EditableRecordType | null;
  record: SaltRecord | SilicaRecord | CyclePredictionRecord | null;
  onSaveSalt: (id: string, createdAt: string, data: { feed: number; permeate: number; rejection: number; cycle?: string }) => Promise<void>;
  onSaveSilica: (id: string, createdAt: string, data: { feed: number; permeate: number; rejection: number; cycle?: string }) => Promise<void>;
  onSaveCycle: (id: string, createdAt: string, data: { conductivity: number; condOut?: number; predictedCycle: number; cycle?: string }) => Promise<void>;
}

export const EditRecordModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  type,
  record,
  onSaveSalt,
  onSaveSilica,
  onSaveCycle,
}) => {
  const { language } = useLanguage();
  const isTh = language === 'th';

  // Common field
  const [cycle, setCycle] = useState('');

  // Salt & Silica fields
  const [feed, setFeed] = useState('');
  const [permeate, setPermeate] = useState('');

  // Cycle Prediction fields
  const [conductivity, setConductivity] = useState('');
  const [condOut, setCondOut] = useState('');
  const [predictedCycle, setPredictedCycle] = useState('');

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when record changes
  useEffect(() => {
    if (!record || !type) return;

    setError(null);
    setCycle(record.cycle || '');

    if (type === 'salt') {
      const saltRec = record as SaltRecord;
      setFeed(saltRec.feed.toString());
      setPermeate(saltRec.permeate.toString());
    } else if (type === 'silica') {
      const silicaRec = record as SilicaRecord;
      setFeed(silicaRec.feed.toString());
      setPermeate(silicaRec.permeate.toString());
    } else if (type === 'cycle') {
      const cycleRec = record as CyclePredictionRecord;
      setConductivity(cycleRec.conductivity.toString());
      setCondOut((cycleRec.condOut ?? 0.076).toString());
      setPredictedCycle(cycleRec.predictedCycle.toString());
    }
  }, [record, type]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !record || !type) return null;

  // Real-time calculations
  const numFeed = parseFloat(feed) || 0;
  const numPerm = parseFloat(permeate) || 0;
  const calculatedRejection = numFeed > 0 ? ((numFeed - numPerm) / numFeed) * 100 : 0;

  const numCond = parseFloat(conductivity) || 0;
  const numCondOut = parseFloat(condOut) || 0;
  const numPredictedCycle = parseFloat(predictedCycle) || 1700;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSaving(true);

      if (type === 'salt' || type === 'silica') {
        if (numFeed <= 0) {
          setError(isTh ? 'กรุณาระบุค่า Feed มากกว่า 0' : 'Feed value must be greater than 0');
          setIsSaving(false);
          return;
        }
        if (numPerm < 0) {
          setError(isTh ? 'ค่า Permeate ต้องไม่ติดลบ' : 'Permeate value cannot be negative');
          setIsSaving(false);
          return;
        }
        if (numPerm > numFeed) {
          setError(isTh ? 'ค่า Permeate ต้องไม่เกินค่า Feed' : 'Permeate cannot exceed Feed value');
          setIsSaving(false);
          return;
        }

        const payload = {
          feed: numFeed,
          permeate: numPerm,
          rejection: parseFloat(calculatedRejection.toFixed(4)),
          cycle: cycle.trim() || undefined,
        };

        if (type === 'salt') {
          await onSaveSalt(record.id, record.createdAt, payload);
        } else {
          await onSaveSilica(record.id, record.createdAt, payload);
        }
      } else if (type === 'cycle') {
        if (numCond < 0) {
          setError(isTh ? 'ค่า Conductivity ขาเข้าต้องไม่ติดลบ' : 'Inlet Conductivity cannot be negative');
          setIsSaving(false);
          return;
        }
        if (numCondOut < 0) {
          setError(isTh ? 'ค่า Conductivity ขาออกต้องไม่ติดลบ' : 'Outlet Conductivity cannot be negative');
          setIsSaving(false);
          return;
        }

        const payload = {
          conductivity: numCond,
          condOut: numCondOut,
          predictedCycle: numPredictedCycle,
          cycle: cycle.trim() || undefined,
        };

        await onSaveCycle(record.id, record.createdAt, payload);
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update record';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === 'salt'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : type === 'silica'
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {type === 'salt' && <FlaskConical className="w-5 h-5" />}
              {type === 'silica' && <Microscope className="w-5 h-5" />}
              {type === 'cycle' && <ChartNoAxesCombined className="w-5 h-5" />}
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--ink)]">
                {type === 'salt' && (isTh ? 'แก้ไขข้อมูล %Salt Rejection' : 'Edit %Salt Rejection')}
                {type === 'silica' && (isTh ? 'แก้ไขข้อมูล %Silica Rejection' : 'Edit %Silica Rejection')}
                {type === 'cycle' && (isTh ? 'แก้ไขข้อมูล คาดการณ์ Cycle' : 'Edit Cycle Prediction')}
              </h3>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                {isTh ? 'บันทึกเมื่อ: ' : 'Recorded: '}
                {new Date(record.createdAt).toLocaleString(isTh ? 'th-TH' : 'en-US')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
            aria-label={isTh ? 'ปิดหน้าต่าง' : 'Close modal'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cycle Label Field */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
              {isTh ? 'รอบการทำงาน / ป้ายกำกับ (Cycle Label)' : 'Cycle Label (Optional)'}
            </label>
            <input
              type="text"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              placeholder={isTh ? 'เช่น Cycle 1, ชุดที่ 1 Run 4' : 'e.g. Cycle 1, Run 4'}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all"
            />
          </div>

          {/* Salt / Silica inputs */}
          {(type === 'salt' || type === 'silica') && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
                    {type === 'salt'
                      ? (isTh ? 'Feed Conductivity (µS/cm)' : 'Feed Conductivity (µS/cm)')
                      : (isTh ? 'Feed Silica (ppb)' : 'Feed Silica (ppb)')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={feed}
                    onChange={(e) => setFeed(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
                    {type === 'salt'
                      ? (isTh ? 'Permeate Conductivity (µS/cm)' : 'Permeate Conductivity (µS/cm)')
                      : (isTh ? 'Permeate Silica (ppb)' : 'Permeate Silica (ppb)')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={permeate}
                    onChange={(e) => setPermeate(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Recalculated Result Live Preview */}
              <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--ink-soft)] font-medium">
                    {isTh ? 'คำนวณ Rejection ใหม่' : 'Recalculated Rejection'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-[var(--accent)] mt-0.5">
                    {calculatedRejection.toFixed(2)}%
                  </div>
                </div>

                <div className="text-right">
                  {calculatedRejection >= 98 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isTh ? 'ปกติ (≥ 98%)' : 'Normal (≥ 98%)'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isTh ? 'ต่ำกว่าเกณฑ์ (< 98%)' : 'Below Standard (< 98%)'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cycle Prediction inputs */}
          {type === 'cycle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
                    {isTh ? 'Cond. MB Inlet / RO Outlet (µS/cm)' : 'Cond. MB Inlet (µS/cm)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={conductivity}
                    onChange={(e) => setConductivity(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
                    {isTh ? 'Cond. MB Outlet (µS/cm)' : 'Cond. MB Outlet (µS/cm)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={condOut}
                    onChange={(e) => setCondOut(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1">
                  {isTh ? 'คาดการณ์ปริมาตรผลิตต่อรอบ (m³)' : 'Predicted Production Volume (m³)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={predictedCycle}
                  onChange={(e) => setPredictedCycle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all font-mono"
                />
              </div>

              {/* Status Preview */}
              <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--ink-soft)] font-medium">
                    {isTh ? 'สถานะคุณภาพน้ำขาออก' : 'Water Quality Status'}
                  </div>
                  <div className="text-sm font-bold font-mono text-[var(--ink)] mt-0.5">
                    Cond Outlet: {numCondOut.toFixed(3)} µS/cm
                  </div>
                </div>

                <div className="text-right">
                  {numCondOut < 0.1 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isTh ? 'ปลอดภัย (< 0.1 µS/cm)' : 'Safe (< 0.1 µS/cm)'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isTh ? 'เกินเกณฑ์ (≥ 0.1 µS/cm)' : 'Exceeds Limit'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
            >
              {isTh ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? (isTh ? 'กำลังบันทึก...' : 'Saving...') : (isTh ? 'บันทึกการแก้ไข' : 'Save Changes')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
