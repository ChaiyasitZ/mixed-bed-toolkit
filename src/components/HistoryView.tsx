import React, { useState, useMemo } from 'react';
import {
  Database,
  Download,
  Trash2,
  Search,
  Filter,
  FlaskConical,
  Microscope,
  ChartNoAxesCombined,
  Pencil,
  HardDrive,
  CheckCircle2,
  Server,
  Info,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Check,
} from 'lucide-react';
import {
  SaltRecord,
  SilicaRecord,
  CyclePredictionRecord,
  CycleRowItem,
  deleteSaltRecord,
  deleteSilicaRecord,
  deleteCyclePrediction,
  updateSaltRecord,
  updateSilicaRecord,
  updateCyclePrediction,
  normalizeCycleRecordToBatch,
  recalculateBatchRows,
  deleteRowFromCloudBatch,
  updateRowInCloudBatch,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ConfirmModal } from './ConfirmModal';
import { EditRecordModal, EditableRecordType } from './EditRecordModal';
import {
  ExportDataMenu,
  ExportFormat,
  exportBatchesToFile,
  convertRecordsToExportPayloads,
} from '../utils/exportData';

interface HistoryViewProps {
  saltRecords: SaltRecord[];
  silicaRecords: SilicaRecord[];
  cycleRecords: CyclePredictionRecord[];
  onDeleteLocalSalt: (id: string) => void;
  onDeleteLocalSilica: (id: string) => void;
  onDeleteLocalCycle: (id: string) => void;
  onUpdateLocalSalt?: (id: string, updated: Partial<SaltRecord>) => void;
  onUpdateLocalSilica?: (id: string, updated: Partial<SilicaRecord>) => void;
  onUpdateLocalCycle?: (id: string, updated: Partial<CyclePredictionRecord>) => void;
  onClearAll: () => void | Promise<void>;
  onOpenAuth: () => void;
  onNavigateToCalc: (type: 'salt' | 'silica' | 'cycle') => void;
  onLoadCycleBatchToEdit?: (batch: CyclePredictionRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  saltRecords,
  silicaRecords,
  cycleRecords,
  onDeleteLocalSalt,
  onDeleteLocalSilica,
  onDeleteLocalCycle,
  onUpdateLocalSalt,
  onUpdateLocalSilica,
  onUpdateLocalCycle,
  onClearAll,
  onOpenAuth,
  onNavigateToCalc,
  onLoadCycleBatchToEdit,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTh = language === 'th';
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBatchIds, setExpandedBatchIds] = useState<Record<string, boolean>>({});

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [editingItem, setEditingItem] = useState<{
    type: EditableRecordType;
    record: SaltRecord | SilicaRecord | CyclePredictionRecord;
  } | null>(null);

  // State for editing a single row inside a Cycle Batch directly in HistoryView
  const [editingBatchRow, setEditingBatchRow] = useState<{
    batch: CyclePredictionRecord;
    rowId: string;
    label: string;
    cycleEnd: string;
    silicaIn: string;
    silicaOut: string;
    condIn: string;
    condOut: string;
  } | null>(null);

  // Accurate storage usage and remaining capacity calculation
  const storageMetrics = useMemo(() => {
    const rawPayload = JSON.stringify({
      cycleRecords,
    });

    const usedBytes = new Blob([rawPayload]).size;
    const isCloud = !!user;
    const totalQuotaBytes = isCloud ? 1024 * 1024 * 1024 : 5 * 1024 * 1024;
    const remainingBytes = Math.max(0, totalQuotaBytes - usedBytes);

    const usedPercentage = Math.min(100, (usedBytes / totalQuotaBytes) * 100);
    const remainingPercentage = Math.max(0, 100 - usedPercentage);

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(3)} GB`;
    };

    return {
      usedBytes,
      usedFormatted: formatBytes(usedBytes),
      totalQuotaBytes,
      quotaFormatted: isCloud ? '1.00 GB' : '5.00 MB',
      remainingBytes,
      remainingFormatted: formatBytes(remainingBytes),
      usedPercentage,
      remainingPercentage,
      isCloud,
      planName: isCloud ? 'Google Cloud Firestore (Spark Tier)' : 'Local Storage (Browser)',
    };
  }, [cycleRecords, user]);

  // Normalize all items for unified list
  interface UnifiedItem {
    id: string;
    type: 'salt' | 'silica' | 'cycle';
    title: string;
    cycle?: string;
    primaryValue: string;
    details: string;
    createdAt: string;
    batchRecord?: ReturnType<typeof normalizeCycleRecordToBatch>;
  }

  const allItems: UnifiedItem[] = useMemo(() => {
    return cycleRecords
      .map((r) => {
        const norm = normalizeCycleRecordToBatch(r);
        const details = isTh
          ? `${norm.rowCount} แถว | ปริมาตร: ${(norm.cycleEnd || 0).toFixed(3)} m³ | Ion Load รวม: ${(norm.totalCombinedIonLoad || 0).toFixed(3)} mol (${(norm.combinedPercentLoad || 0).toFixed(3)}%) | Silica Load: ${(norm.cumulativeSilicaLoad || 0).toFixed(3)} mol (${(norm.silicaPercentLoad || 0).toFixed(3)}%)`
          : `${norm.rowCount} rows | Vol: ${(norm.cycleEnd || 0).toFixed(3)} m³ | Total Load: ${(norm.totalCombinedIonLoad || 0).toFixed(3)} mol (${(norm.combinedPercentLoad || 0).toFixed(3)}%) | Silica Load: ${(norm.cumulativeSilicaLoad || 0).toFixed(3)} mol (${(norm.silicaPercentLoad || 0).toFixed(3)}%)`;

        return {
          id: r.id,
          type: 'cycle' as const,
          title: isTh ? 'ชุดข้อมูลคาดการณ์ Cycle & Ion Load (Cond + Silica)' : 'Cycle & Ion Load Batch (Cond + Silica)',
          cycle: norm.batchName,
          primaryValue: `${norm.predictedCycle.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`,
          details,
          createdAt: r.updatedAt || r.createdAt,
          batchRecord: norm,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cycleRecords, isTh]);

  const filteredItems = allItems.filter((item) => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchCycle = item.cycle ? item.cycle.toLowerCase().includes(term) : false;
      const matchTitle = item.title.toLowerCase().includes(term);
      const matchDetails = item.details.toLowerCase().includes(term);
      return matchCycle || matchTitle || matchDetails;
    }
    return true;
  });

  const handleOpenEdit = (item: UnifiedItem) => {
    if (item.type === 'salt') {
      const rec = saltRecords.find((r) => r.id === item.id);
      if (rec) setEditingItem({ type: 'salt', record: rec });
    } else if (item.type === 'silica') {
      const rec = silicaRecords.find((r) => r.id === item.id);
      if (rec) setEditingItem({ type: 'silica', record: rec });
    } else if (item.type === 'cycle') {
      const rec = cycleRecords.find((r) => r.id === item.id);
      if (rec) setEditingItem({ type: 'cycle', record: rec });
    }
  };

  const handleSaveSalt = async (
    id: string,
    createdAt: string,
    data: { feed: number; permeate: number; rejection: number; cycle?: string }
  ) => {
    if (user) {
      await updateSaltRecord(id, createdAt, data);
    } else if (onUpdateLocalSalt) {
      onUpdateLocalSalt(id, data);
    }
  };

  const handleSaveSilica = async (
    id: string,
    createdAt: string,
    data: { feed: number; permeate: number; rejection: number; cycle?: string }
  ) => {
    if (user) {
      await updateSilicaRecord(id, createdAt, data);
    } else if (onUpdateLocalSilica) {
      onUpdateLocalSilica(id, data);
    }
  };

  const handleSaveCycle = async (
    id: string,
    createdAt: string,
    data: { conductivity: number; condOut?: number; predictedCycle: number; cycle?: string }
  ) => {
    const rec = cycleRecords.find((r) => r.id === id);
    const updatedPayload = {
      ...(rec || {}),
      ...data,
      batchName: data.cycle || rec?.batchName || rec?.cycle,
    };
    if (user) {
      await updateCyclePrediction(id, createdAt, updatedPayload);
    } else if (onUpdateLocalCycle) {
      onUpdateLocalCycle(id, updatedPayload);
    }
  };

  // Delete an entire record or entire Cycle Batch
  const requestDeleteItem = (item: UnifiedItem) => {
    const isBatch = item.type === 'cycle' && item.batchRecord;
    setConfirmConfig({
      isOpen: true,
      title: isBatch
        ? isTh
          ? `ลบชุดข้อมูล "${item.cycle}" ทั้งชุด?`
          : `Delete entire batch "${item.cycle}"?`
        : isTh
        ? `ลบรายการ "${item.title}"?`
        : `Delete record "${item.title}"?`,
      message: isBatch
        ? isTh
          ? `คุณต้องการลบชุดข้อมูล "${item.cycle}" (รวม ${item.batchRecord?.rowCount || 1} แถว) ออกจากประวัติใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`
          : `Are you sure you want to delete the entire batch "${item.cycle}" (${item.batchRecord?.rowCount || 1} rows)? This action cannot be undone.`
        : isTh
        ? `คุณต้องการลบข้อมูลรอบ ${item.cycle || 'นี้'} (${item.primaryValue}) ออกจากประวัติใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`
        : `Are you sure you want to delete cycle ${item.cycle || 'this'} (${item.primaryValue})? This action cannot be undone.`,
      onConfirm: async () => {
        if (user) {
          if (item.type === 'salt') await deleteSaltRecord(item.id);
          if (item.type === 'silica') await deleteSilicaRecord(item.id);
          if (item.type === 'cycle') await deleteCyclePrediction(item.id);
        } else {
          if (item.type === 'salt') onDeleteLocalSalt(item.id);
          if (item.type === 'silica') onDeleteLocalSilica(item.id);
          if (item.type === 'cycle') onDeleteLocalCycle(item.id);
        }
      },
    });
  };

  // Delete a single row inside a Cycle Batch in HistoryView (maintains batch consistency)
  const requestDeleteRowInBatch = (batch: CyclePredictionRecord, row: CycleRowItem) => {
    const norm = normalizeCycleRecordToBatch(batch);
    const isLastRow = norm.rows.length <= 1;

    setConfirmConfig({
      isOpen: true,
      title: isLastRow
        ? isTh
          ? `ลบแถวสุดท้ายและลบชุด "${norm.batchName}"?`
          : `Delete last row & remove batch "${norm.batchName}"?`
        : isTh
        ? `ลบแถว "${row.label}" (${row.cycleEnd.toFixed(3)} m³) ออกจากชุด "${norm.batchName}"?`
        : `Delete row "${row.label}" (${row.cycleEnd.toFixed(3)} m³) from "${norm.batchName}"?`,
      message: isLastRow
        ? isTh
          ? 'แถวนี้เป็นแถวสุดท้ายในชุดข้อมูล เมื่อลบแล้วระบบจะลบชุดข้อมูลนี้ออกจากประวัติด้วย'
          : 'This is the last remaining row in this batch. Deleting it will remove the batch record.'
        : isTh
        ? 'เมื่อลบแถวนี้ ระบบจะคำนวณระยะห่าง (ΔV), Ion Load (Cond + Silica), % Load และจุดหยุดระบบ 95% ของแถวที่เหลือในชุดข้อมูลนี้ใหม่โดยอัตโนมัติ เพื่อให้ข้อมูลในชุดมีความสอดคล้องกัน'
        : 'Deleting this row will automatically recalculate ΔV, Cumulative Ion Load (Cond + Silica), % Load, and 95% system stop for all remaining rows in this batch.',
      onConfirm: async () => {
        if (user) {
          await deleteRowFromCloudBatch(batch, row.rowId, isTh);
        } else {
          const remaining = norm.rows
            .filter((r) => r.rowId !== row.rowId)
            .map((r) => ({
              rowId: r.rowId,
              label: r.label,
              cycleEnd: r.cycleEnd,
              condIn: r.condIn,
              condOut: r.condOut,
              silicaIn: r.silicaIn,
              silicaOut: r.silicaOut,
            }));
          if (remaining.length === 0) {
            onDeleteLocalCycle(batch.id);
          } else if (onUpdateLocalCycle) {
            const recalc = recalculateBatchRows(remaining, norm.condCapacity, isTh, false, norm.silicaCapacity);
            onUpdateLocalCycle(batch.id, {
              rowCount: recalc.rowCount,
              rows: recalc.rows,
              conductivity: recalc.conductivity,
              condOut: recalc.condOut,
              silica: recalc.silica,
              silicaOut: recalc.silicaOut,
              cycleStart: recalc.cycleStart,
              cycleEnd: recalc.cycleEnd,
              distance: recalc.distance,
              ionsRemoved: recalc.ionsRemoved,
              cumulativeIonLoad: recalc.cumulativeIonLoad,
              cumulativeSilicaLoad: recalc.cumulativeSilicaLoad,
              silicaPercentLoad: recalc.silicaPercentLoad,
              totalCombinedIonLoad: recalc.totalCombinedIonLoad,
              combinedPercentLoad: recalc.combinedPercentLoad,
              percentLoad: recalc.percentLoad,
              predictedCycle: recalc.predictedCycle,
              predictedBreakthrough: recalc.predictedBreakthrough,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      },
    });
  };

  // Save edited single row inside a Cycle Batch
  const handleSaveEditedBatchRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchRow) return;
    const end = parseFloat(editingBatchRow.cycleEnd);
    const sIn = parseFloat(editingBatchRow.silicaIn);
    const sOut = parseFloat(editingBatchRow.silicaOut);
    const cIn = parseFloat(editingBatchRow.condIn);
    const cOut = parseFloat(editingBatchRow.condOut);
    if (
      isNaN(end) ||
      end <= 0 ||
      isNaN(sIn) ||
      sIn < 0 ||
      isNaN(sOut) ||
      sOut < 0 ||
      isNaN(cIn) ||
      cIn < 0 ||
      isNaN(cOut) ||
      cOut < 0
    )
      return;

    const batch = editingBatchRow.batch;
    if (user) {
      await updateRowInCloudBatch(
        batch,
        editingBatchRow.rowId,
        {
          label: editingBatchRow.label.trim(),
          cycleEnd: end,
          silicaIn: sIn,
          silicaOut: sOut,
          condIn: cIn,
          condOut: cOut,
        },
        isTh
      );
    } else if (onUpdateLocalCycle) {
      const norm = normalizeCycleRecordToBatch(batch);
      const nextInputs = norm.rows.map((r) =>
        r.rowId === editingBatchRow.rowId
          ? {
              rowId: r.rowId,
              label: editingBatchRow.label.trim() || r.label,
              cycleEnd: end,
              silicaIn: sIn,
              silicaOut: sOut,
              condIn: cIn,
              condOut: cOut,
            }
          : {
              rowId: r.rowId,
              label: r.label,
              cycleEnd: r.cycleEnd,
              silicaIn: r.silicaIn,
              silicaOut: r.silicaOut,
              condIn: r.condIn,
              condOut: r.condOut,
            }
      );
      const recalc = recalculateBatchRows(nextInputs, norm.condCapacity, isTh, false, norm.silicaCapacity);
      onUpdateLocalCycle(batch.id, {
        rowCount: recalc.rowCount,
        rows: recalc.rows,
        conductivity: recalc.conductivity,
        condOut: recalc.condOut,
        silica: recalc.silica,
        silicaOut: recalc.silicaOut,
        cycleStart: recalc.cycleStart,
        cycleEnd: recalc.cycleEnd,
        distance: recalc.distance,
        ionsRemoved: recalc.ionsRemoved,
        cumulativeIonLoad: recalc.cumulativeIonLoad,
        cumulativeSilicaLoad: recalc.cumulativeSilicaLoad,
        silicaPercentLoad: recalc.silicaPercentLoad,
        totalCombinedIonLoad: recalc.totalCombinedIonLoad,
        combinedPercentLoad: recalc.combinedPercentLoad,
        percentLoad: recalc.percentLoad,
        predictedCycle: recalc.predictedCycle,
        predictedBreakthrough: recalc.predictedBreakthrough,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingBatchRow(null);
  };

  const requestClearAll = () => {
    setConfirmConfig({
      isOpen: true,
      title: isTh ? 'ล้างข้อมูลประวัติทั้งหมด?' : 'Clear all history records?',
      message: isTh
        ? 'คุณแน่ใจว่าต้องการล้างข้อมูลประวัติการคำนวณทั้งหมดหรือไม่? ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้'
        : 'Are you sure you want to clear all calculation history records? Deleted data cannot be recovered.',
      onConfirm: async () => {
        await onClearAll();
      },
    });
  };

  const handleExportAllBatches = (format: ExportFormat) => {
    if (!cycleRecords.length) return;
    exportBatchesToFile(
      convertRecordsToExportPayloads(cycleRecords),
      format,
      isTh,
      'mixed_bed_all_history'
    );
  };

  const totalSavedRows = useMemo(() => {
    return cycleRecords.reduce((acc, r) => {
      const norm = normalizeCycleRecordToBatch(r);
      return acc + norm.rowCount;
    }, 0);
  }, [cycleRecords]);

  return (
    <div className="space-y-5 view-transition">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--line)]">
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-[var(--ink)] flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{isTh ? 'ฐานข้อมูลชุดคาดการณ์ Cycle & Ion Load' : 'Cycle & Ion Load Batch History'}</span>
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {!storageMetrics.isCloud && (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer transition-colors whitespace-nowrap"
            >
              {isTh ? 'ซิงค์ Cloud' : 'Sync Cloud'}
            </button>
          )}

          {allItems.length > 0 && (
            <ExportDataMenu
              onExport={handleExportAllBatches}
              isTh={isTh}
              label={isTh ? 'ส่งออกทั้งหมด' : 'Export All'}
              variant="toolbar"
            />
          )}

          {allItems.length > 0 && (
            <button
              onClick={requestClearAll}
              className="p-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
              title={isTh ? 'ล้างข้อมูลทั้งหมด' : 'Clear all history'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Storage Location & Capacity Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Storage Mode & Account */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--line)] flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                storageMetrics.isCloud
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
              }`}
            >
              {storageMetrics.isCloud ? <Server className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-medium text-[var(--ink-soft)] flex items-center gap-1.5">
                <span>{isTh ? 'แหล่งจัดเก็บข้อมูล' : 'Storage Location'}</span>
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${storageMetrics.isCloud ? 'text-emerald-500' : 'text-sky-500'}`}
                />
              </div>
              <div className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate">
                {storageMetrics.isCloud
                  ? isTh
                    ? 'Google Cloud Firestore'
                    : 'Google Cloud Firestore'
                  : isTh
                  ? 'หน่วยความจำเบราว์เซอร์ (Local)'
                  : 'Browser Local Storage'}
              </div>
              <div className="text-xs font-mono text-[var(--ink-soft)] truncate">
                {storageMetrics.isCloud
                  ? user?.email
                  : isTh
                  ? 'บันทึกเฉพาะในอุปกรณ์นี้'
                  : 'Stored on this device only'}
              </div>
            </div>
          </div>

          {/* 2. Used Space & Record Count */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--line)] flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-medium text-[var(--ink-soft)]">
                {isTh ? 'พื้นที่ที่ใช้งานแล้ว (Used)' : 'Storage Used'}
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-[var(--ink)]">
                {storageMetrics.usedFormatted}
              </div>
              <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                {isTh
                  ? `${cycleRecords.length} ชุดข้อมูล · รวม ${totalSavedRows} รอบ`
                  : `${cycleRecords.length} batches · ${totalSavedRows} total steps`}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums shrink-0">
              <span className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--line)] text-xs font-bold text-[var(--accent)]">
                {storageMetrics.usedBytes > 0 && storageMetrics.usedPercentage < 0.01
                  ? '< 0.01%'
                  : `${storageMetrics.usedPercentage.toFixed(2)}%`}
              </span>
            </div>
          </div>

          {/* 3. Remaining Capacity & Total Quota */}
          <div className="p-3.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--line)] flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-medium text-[var(--ink-soft)]">
                {isTh ? 'พื้นที่คงเหลือ (Remaining)' : 'Remaining Capacity'}
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {storageMetrics.remainingFormatted}
              </div>
              <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                {isTh
                  ? `จากความจุทั้งหมด ${storageMetrics.quotaFormatted}`
                  : `Total Quota: ${storageMetrics.quotaFormatted}`}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums shrink-0">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {isTh
                  ? `ว่าง ${storageMetrics.remainingPercentage.toFixed(2)}%`
                  : `${storageMetrics.remainingPercentage.toFixed(2)}% Free`}
              </span>
            </div>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[var(--ink-soft)]">
            <span>
              {isTh
                ? `อัตราการใช้พื้นที่ฐานข้อมูล (${storageMetrics.usedFormatted} / ${storageMetrics.quotaFormatted})`
                : `Database Capacity Usage (${storageMetrics.usedFormatted} / ${storageMetrics.quotaFormatted})`}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {isTh
                ? `พื้นที่ว่างคงเหลือ ${storageMetrics.remainingFormatted}`
                : `${storageMetrics.remainingFormatted} available`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--bg)] border border-[var(--line)] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${
                  storageMetrics.usedBytes > 0 ? Math.max(1.5, Math.min(100, storageMetrics.usedPercentage)) : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center p-1 rounded-xl bg-[var(--bg)] border border-[var(--line)] overflow-x-auto text-xs sm:text-sm font-medium">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--panel)] text-[var(--ink)] font-bold shadow-xs whitespace-nowrap">
            {isTh ? `ชุดคาดการณ์ Cycle ทั้งหมด (${cycleRecords.length})` : `All Cycle Batches (${cycleRecords.length})`}
          </div>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--ink-soft)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isTh ? 'ค้นหาตามชื่อชุดข้อมูล...' : 'Search by batch name...'}
            className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] focus:outline-2 focus:outline-[var(--accent)] transition-all"
          />
        </div>
      </div>

      {/* Record list */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center bg-[var(--panel)] border border-[var(--line)] rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto text-[var(--ink-soft)]">
            <Filter className="w-6 h-6" />
          </div>
          <div className="text-sm sm:text-base font-bold text-[var(--ink)]">
            {searchTerm
              ? isTh
                ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา'
                : 'No matching records found'
              : isTh
              ? 'ยังไม่มีชุดข้อมูลคาดการณ์ Cycle ที่บันทึกไว้'
              : 'No saved Cycle forecasting batches yet'}
          </div>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] max-w-sm mx-auto">
            {isTh
              ? 'คุณสามารถเริ่มคำนวณและกด "บันทึกประวัติ (1 ชุด)" เพื่อจัดเก็บชุดข้อมูลลงในฐานข้อมูล'
              : 'Calculate parameters and click "Save History (1 Set)" to store batches into the database.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => onNavigateToCalc('cycle')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs"
            >
              {isTh ? 'ไปที่หน้าคาดการณ์ Cycle & Ion Load' : 'Go to Cycle & Ion Load Forecasting'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isCycleBatch = item.type === 'cycle' && item.batchRecord;
            const isExpanded = Boolean(expandedBatchIds[item.id]);

            return (
              <div
                key={`${item.type}_${item.id}`}
                className="rounded-xl bg-[var(--panel)] border border-[var(--line)] shadow-2xs hover:shadow-xs transition-all"
              >
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.type === 'salt'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : item.type === 'silica'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {item.type === 'salt' && <FlaskConical className="w-5 h-5" />}
                      {item.type === 'silica' && <Microscope className="w-5 h-5" />}
                      {item.type === 'cycle' && <ChartNoAxesCombined className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-[var(--ink)]">
                          {isCycleBatch ? item.cycle : item.title}
                        </span>
                        {!isCycleBatch && item.cycle && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]">
                            {item.cycle}
                          </span>
                        )}
                        {isCycleBatch && item.batchRecord && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {item.batchRecord.rowCount} {isTh ? 'แถวข้อมูล' : 'rows'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-[var(--ink-soft)] mt-0.5">{item.details}</div>
                      <div className="text-xs text-[var(--ink-soft)] mt-0.5">
                        {new Date(item.createdAt).toLocaleString(isTh ? 'th-TH' : 'en-US')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-[var(--line)]">
                    <div className="text-left sm:text-right mr-1">
                      {isCycleBatch && (
                        <div className="text-xs text-[var(--ink-soft)] font-semibold">
                          {isTh ? 'จุดหยุดระบบ 95%' : '95% System Stop'}
                        </div>
                      )}
                      <div
                        className={`text-base sm:text-lg font-black font-mono ${
                          item.type === 'salt'
                            ? 'text-[var(--accent)]'
                            : item.type === 'silica'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.primaryValue}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCycleBatch && item.batchRecord && (
                        <>
                          <ExportDataMenu
                            onExport={(fmt) =>
                              exportBatchesToFile(
                                convertRecordsToExportPayloads([item.batchRecord!]),
                                fmt,
                                isTh
                              )
                            }
                            isTh={isTh}
                            label={isTh ? 'ส่งออก' : 'Export'}
                            variant="compact"
                          />

                          {onLoadCycleBatchToEdit && (
                            <button
                              type="button"
                              onClick={() => onLoadCycleBatchToEdit(item.batchRecord!)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors"
                              title={
                                isTh
                                  ? 'โหลดชุดข้อมูลนี้กลับไปยังหน้าคาดการณ์เพื่อแก้ไข'
                                  : 'Load batch into Forecasting view to edit'
                              }
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">{isTh ? 'ย้อนกลับ/แก้ไขชุด' : 'Revert / Edit'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBatchIds((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--line)]/50 cursor-pointer"
                            title={isTh ? 'ดูหรือจัดการแถวย่อยในชุดนี้' : 'View or manage rows in this batch'}
                          >
                            <Eye className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                            <span>{item.batchRecord.rowCount}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-[var(--ink-soft)] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors cursor-pointer"
                        title={isTh ? 'แก้ไขข้อมูลรายการนี้' : 'Edit this record'}
                        aria-label={isTh ? 'แก้ไขข้อมูล' : 'Edit record'}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => requestDeleteItem(item)}
                        className="p-1.5 text-[var(--warn)] hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title={isCycleBatch ? (isTh ? 'ลบทั้งชุดข้อมูลนี้' : 'Delete entire batch') : isTh ? 'ลบรายการนี้' : 'Delete record'}
                        aria-label={isTh ? 'ลบข้อมูล' : 'Delete record'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Sub-table for Cycle Batch Rows */}
                {isCycleBatch && item.batchRecord && isExpanded && (
                  <div className="border-t border-[var(--line)] bg-[var(--bg)]/50 p-3 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--ink)]">
                        {isTh
                          ? `ตารางข้อมูลรายแถวในชุด "${item.batchRecord.batchName}" (${item.batchRecord.rowCount} แถว)`
                          : `Rows in Batch "${item.batchRecord.batchName}" (${item.batchRecord.rowCount} rows)`}
                      </span>
                      <span className="text-[var(--ink-soft)]">
                        {isTh
                          ? 'สามารถแก้ไขหรือลบรายแถวได้ (ระบบจะคำนวณชุดข้อมูลใหม่อัตโนมัติ • ทศนิยม 3 ตำแหน่ง)'
                          : 'Deleting or editing a row automatically recalculates the batch (3 decimal places)'}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                      <table className="w-full min-w-[900px] text-xs sm:text-[13px] text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800/95 text-[var(--ink)] font-bold border-b-2 border-[var(--line)]">
                          <tr className="align-top">
                            <th className="py-2.5 px-2.5 text-center text-[13px] font-bold text-[var(--ink)]">#</th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-[var(--ink)]">{isTh ? 'รอบย่อย' : 'Step'}</div>
                                <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(Label)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-[var(--ink)]">Cycle</div>
                                <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-[var(--ink)]">ΔV</div>
                                <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">Silica In/Out</div>
                                <div className="text-[11px] font-mono font-semibold text-indigo-600/90 dark:text-indigo-300/90">(ppb)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-sky-700 dark:text-sky-300">Cond In/Out</div>
                                <div className="text-[11px] font-mono font-semibold text-sky-600/90 dark:text-sky-300/90">(µS/cm)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">Ion Load Silica</div>
                                <div className="text-[11px] font-mono font-semibold text-indigo-600/90 dark:text-indigo-300/90">(mol)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-sky-700 dark:text-sky-300">Ion Load Cond</div>
                                <div className="text-[11px] font-mono font-semibold text-sky-600/90 dark:text-sky-300/90">(mol)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">Ion Load รวม</div>
                                <div className="text-[11px] font-mono font-semibold text-emerald-600/90 dark:text-emerald-300/90">(mol)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 whitespace-nowrap">
                              <div className="leading-snug">
                                <div className="text-[13px] font-bold text-[var(--ink)]">% Load รวม</div>
                                <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(%)</div>
                              </div>
                            </th>
                            <th className="py-2.5 px-2.5 text-right text-[13px] font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการแถว' : 'Row Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)] font-mono">
                          {item.batchRecord.rows.map((r) => (
                            <tr key={r.rowId} className="hover:bg-black/2 dark:hover:bg-white/2">
                              <td className="py-1.5 px-2.5 text-center text-[var(--ink-soft)]">{r.step}</td>
                              <td className="py-1.5 px-2.5 font-sans font-medium">{r.label}</td>
                              <td className="py-1.5 px-2.5 font-bold">{r.cycleEnd.toFixed(3)}</td>
                              <td className="py-1.5 px-2.5 text-[var(--ink-soft)]">{r.distance.toFixed(3)}</td>
                              <td className="py-1.5 px-2.5 text-purple-600 dark:text-purple-400">
                                {r.silicaIn.toFixed(3)} / {r.silicaOut.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2.5 text-sky-600 dark:text-sky-400">
                                {r.condIn.toFixed(3)} / {r.condOut.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2.5 font-semibold text-purple-600 dark:text-purple-400">
                                {r.cumulativeSilicaLoad.toFixed(3)} ({r.silicaPercentLoad.toFixed(3)}%)
                              </td>
                              <td className="py-1.5 px-2.5 font-semibold text-sky-600 dark:text-sky-400">
                                {r.cumulativeIonLoad.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                                {r.totalCombinedIonLoad.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold">{r.combinedPercentLoad.toFixed(3)}%</td>
                              <td className="py-1.5 px-2.5 text-right font-sans">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingBatchRow({
                                        batch: item.batchRecord!,
                                        rowId: r.rowId,
                                        label: r.label,
                                        cycleEnd: r.cycleEnd.toString(),
                                        silicaIn: r.silicaIn.toString(),
                                        silicaOut: r.silicaOut.toString(),
                                        condIn: r.condIn.toString(),
                                        condOut: r.condOut.toString(),
                                      })
                                    }
                                    className="p-1 text-[var(--ink-soft)] hover:text-emerald-500 rounded cursor-pointer"
                                    title={isTh ? 'แก้ไขแถวนี้' : 'Edit this row'}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestDeleteRowInBatch(item.batchRecord!, r)}
                                    className="p-1 text-[var(--ink-soft)] hover:text-rose-500 rounded cursor-pointer"
                                    title={isTh ? 'ลบแถวนี้ออกจากชุดข้อมูล' : 'Delete this row from batch'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Edit Single Row inside a Cycle Batch */}
      {editingBatchRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden modal-animated">
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/50">
              <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                {isTh ? 'แก้ไขแถวในชุดข้อมูล' : 'Edit Row in Batch'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBatchRow(null)}
                className="p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedBatchRow} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {isTh ? 'ป้ายกำกับรอบย่อย (Step Label)' : 'Step Label'}
                  </label>
                  <input
                    type="text"
                    value={editingBatchRow.label}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, label: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                    {isTh ? 'Cycle สะสม (m³)' : 'Cumulative Cycle (m³)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editingBatchRow.cycleEnd}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, cycleEnd: e.target.value })}
                    className="w-full text-xs sm:text-sm font-mono px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
                    Silica MB Inlet (ppb)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editingBatchRow.silicaIn}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, silicaIn: e.target.value })}
                    className="w-full text-xs sm:text-sm font-mono px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">
                    Silica MB Outlet (ppb)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editingBatchRow.silicaOut}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, silicaOut: e.target.value })}
                    className="w-full text-xs sm:text-sm font-mono px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">Cond. In (µS/cm)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editingBatchRow.condIn}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, condIn: e.target.value })}
                    className="w-full text-xs sm:text-sm font-mono px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">Cond. Out (µS/cm)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editingBatchRow.condOut}
                    onChange={(e) => setEditingBatchRow({ ...editingBatchRow, condOut: e.target.value })}
                    className="w-full text-xs sm:text-sm font-mono px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBatchRow(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-soft)] cursor-pointer"
                >
                  {isTh ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isTh ? 'บันทึกและคำนวณใหม่' : 'Save & Recalculate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingItem && (
        <EditRecordModal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          type={editingItem.type}
          record={editingItem.record}
          onSaveSalt={handleSaveSalt}
          onSaveSilica={handleSaveSilica}
          onSaveCycle={handleSaveCycle}
        />
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
