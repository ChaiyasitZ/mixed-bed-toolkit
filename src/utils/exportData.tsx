import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode2,
  Table2,
  ChevronDown,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  CycleRowItem,
  CyclePredictionRecord,
  normalizeCycleRecordToBatch,
  recalculateBatchRows,
  isNonPhysicalCycleRow,
  DEFAULT_COND_CAPACITY,
  DEFAULT_SILICA_CAPACITY,
  DEFAULT_TRAIN_B_COND_CAPACITY,
  DEFAULT_TRAIN_B_SILICA_CAPACITY,
} from '../services/dataService';

export type ExportFormat = 'excel' | 'csv' | 'txt' | 'json';

export interface BatchExportPayload {
  batchName: string;
  train?: string;
  condCapacity: number;
  silicaCapacity: number;
  rows: CycleRowItem[];
  predictedWarning90Volume?: number;
  predictedStop95Volume?: number;
  predictedBreakthroughVolume?: number;
  createdAt?: string;
}

interface EnrichedExportRow extends CycleRowItem {
  dCond: number;
  waCond: number | null;
  dSilica: number;
  waSilica: number | null;
  totalWa: number | null;
  predictedWarning90: number | null;
  predictedStop95: number | null;
}

interface EnrichedBatchPayload {
  batchName: string;
  train: 'A' | 'B';
  condCapacity: number;
  silicaCapacity: number;
  totalCapacity: number;
  warnMol: number;
  stopMol: number;
  rows: EnrichedExportRow[];
  finalWaSilica: number | null;
  finalWaCond: number | null;
  finalTotalWa: number | null;
  predictedWarning90Volume: number | null;
  predictedStop95Volume: number | null;
  predictedBreakthroughVolume: number | null;
  createdAt?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'mixed_bed_data';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function getRowControlStatus(c: CycleRowItem, isTh: boolean): string {
  const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
  if (isNonPhysicalCycleRow(c)) {
    return isTh ? 'ตรวจสอบข้อมูล (Flagged)' : 'Flagged for Review';
  }
  if (govPct >= 100 || c.condOut >= 0.1 || c.silicaOut >= 10) {
    return isTh ? 'ทะลุขีดจำกัด (Breakthrough ≥100%)' : 'Breakthrough (>=100%)';
  }
  if (govPct >= 95) {
    return isTh ? 'จุดหยุดระบบ / ฟื้นฟูเรซิน (≥95%)' : 'Stop Mixed Bed / Regen (>=95%)';
  }
  if (govPct >= 90) {
    return isTh ? 'จุดแจ้งเตือนระบบ (≥90%)' : 'System Warning (>=90%)';
  }
  return isTh ? 'ปกติ (<90%)' : 'Normal (<90%)';
}

function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    // Strip invalid XML 1.0 control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmtExportFixed(val: number | null | undefined, digits: number, fallback: string = '—'): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return fallback;
  return val.toFixed(digits);
}

/**
 * Guarantees a unique, valid Excel Worksheet name (<= 31 chars, no \ / ? * [ ] :)
 */
function makeUniqueSheetName(rawName: string, usedNames: Set<string>, fallbackIndex: number): string {
  let cleaned = rawName
    .replace(/[\\/?*[\]:']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    cleaned = `Sheet_${fallbackIndex}`;
  }
  let candidate = cleaned.slice(0, 31).trim();
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = `_${counter}`;
    candidate = `${cleaned.slice(0, Math.max(1, 31 - suffix.length)).trim()}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Deterministically enriches any BatchExportPayload so that all 5 tabs' columns
 * (including ΔSilica, Weighted Average of Silica, ΔCond., Weighted Average of Cond.,
 * Total Weighted Average, 90% System Warning, and 95% System Stop) are populated
 * with full precision and single-source-of-truth consistency.
 */
function enrichBatchForExport(b: BatchExportPayload, isTh: boolean): EnrichedBatchPayload {
  const isTrainB = b.train === 'B' || (!b.train && b.batchName.includes('B'));
  const defaultCond = isTrainB ? DEFAULT_TRAIN_B_COND_CAPACITY : DEFAULT_COND_CAPACITY;
  const defaultSilica = isTrainB ? DEFAULT_TRAIN_B_SILICA_CAPACITY : DEFAULT_SILICA_CAPACITY;

  const condCapacity = Number.isFinite(b.condCapacity) && b.condCapacity > 0 ? b.condCapacity : defaultCond;
  const silicaCapacity = Number.isFinite(b.silicaCapacity) && b.silicaCapacity > 0 ? b.silicaCapacity : defaultSilica;
  const totalCapacity = Number((condCapacity + silicaCapacity).toFixed(4));
  const warnMol = Number((totalCapacity * 0.9).toFixed(2));
  const stopMol = Number((totalCapacity * 0.95).toFixed(2));

  const recalc = recalculateBatchRows(
    (b.rows || []).map((r) => ({
      rowId: r.rowId,
      label: r.label,
      cycleEnd: r.cycleEnd,
      condIn: r.condIn,
      condOut: r.condOut,
      silicaIn: r.silicaIn,
      silicaOut: r.silicaOut,
    })),
    condCapacity,
    isTh,
    false,
    silicaCapacity
  );

  let sumDV = 0;
  let sumDVxDSilica = 0;
  let sumDVxDCond = 0;

  const enrichedRows: EnrichedExportRow[] = recalc.rows.map((r) => {
    const dSilica = r.silicaConcInMolM3 - r.silicaConcOutMolM3;
    const dCond = r.concInMolM3 - r.concOutMolM3;
    const isValid =
      [r.cycleEnd, r.silicaIn, r.silicaOut, r.condIn, r.condOut].every((v) => Number.isFinite(v) && v >= 0) &&
      r.distance > 0 &&
      dSilica >= 0 &&
      dCond >= 0;

    if (isValid) {
      sumDV += r.distance;
      sumDVxDSilica += r.distance * dSilica;
      sumDVxDCond += r.distance * dCond;
    }

    const hasSumDV = sumDV > 0;
    const waSilica = hasSumDV ? sumDVxDSilica / sumDV : null;
    const waCond = hasSumDV ? sumDVxDCond / sumDV : null;
    const totalWa = waSilica !== null && waCond !== null ? waSilica + waCond : null;
    const canDivide = totalWa !== null && Number.isFinite(totalWa) && totalWa > 1e-12;

    return {
      ...r,
      dCond,
      waCond,
      dSilica,
      waSilica,
      totalWa,
      predictedWarning90: canDivide ? warnMol / (totalWa as number) : null,
      predictedStop95: canDivide ? stopMol / (totalWa as number) : null,
    };
  });

  const finalWaSilica = sumDV > 0 ? sumDVxDSilica / sumDV : null;
  const finalWaCond = sumDV > 0 ? sumDVxDCond / sumDV : null;
  const finalTotalWa = finalWaSilica !== null && finalWaCond !== null ? finalWaSilica + finalWaCond : null;
  const canDivideFinal = finalTotalWa !== null && Number.isFinite(finalTotalWa) && finalTotalWa > 1e-12;

  return {
    batchName: b.batchName || (isTh ? 'ชุดข้อมูลคาดการณ์ Cycle' : 'Cycle Batch'),
    train: isTrainB ? 'B' : 'A',
    condCapacity,
    silicaCapacity,
    totalCapacity,
    warnMol,
    stopMol,
    rows: enrichedRows,
    finalWaSilica,
    finalWaCond,
    finalTotalWa,
    predictedWarning90Volume: canDivideFinal ? warnMol / (finalTotalWa as number) : null,
    predictedStop95Volume: canDivideFinal ? stopMol / (finalTotalWa as number) : null,
    predictedBreakthroughVolume: canDivideFinal ? totalCapacity / (finalTotalWa as number) : null,
    createdAt: b.createdAt,
  };
}

interface ExcelColumnSpec<T> {
  header: string;
  width: number;
  getValue: (row: T) => number | string | null | undefined;
  type: 'number' | 'string';
  decimals?: number;
}

function buildWorksheetXml<T>(
  sheetName: string,
  titleText: string,
  subtitleText: string,
  columns: ExcelColumnSpec<T>[],
  rows: T[],
  getRowTone: (row: T) => 'normal' | 'warn' | 'stop'
): string {
  const colCount = Math.max(1, columns.length);
  const mergeAcross = colCount - 1;

  const colsXml = columns.map((c) => `<Column ss:Width="${c.width}"/>`).join('\n            ');
  const headersXml = columns
    .map((c) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`)
    .join('');

  const dataRowsXml = rows
    .map((r) => {
      const tone = getRowTone(r);
      const baseStyle = tone === 'stop' ? 'sStopRow' : tone === 'warn' ? 'sWarnRow' : 'sNormalRow';

      const cellsXml = columns
        .map((col) => {
          const raw = col.getValue(r);
          if (col.type === 'number') {
            const num = typeof raw === 'number' ? raw : Number(raw);
            if (raw === null || raw === undefined || !Number.isFinite(num)) {
              return `<Cell ss:StyleID="${baseStyle}"><Data ss:Type="String">—</Data></Cell>`;
            }
            const rounded = col.decimals !== undefined ? Number(num.toFixed(col.decimals)) : num;
            return `<Cell ss:StyleID="${baseStyle}"><Data ss:Type="Number">${rounded}</Data></Cell>`;
          }
          const text = raw === null || raw === undefined || raw === '' ? '—' : String(raw);
          return `<Cell ss:StyleID="${baseStyle}"><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
        })
        .join('\n              ');

      return `<Row ss:Height="20">
              ${cellsXml}
            </Row>`;
    })
    .join('\n            ');

  return `<Worksheet ss:Name="${escapeXml(sheetName)}">
          <Table>
            ${colsXml}
            <Row ss:Height="24">
              <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="sTitle">
                <Data ss:Type="String">${escapeXml(titleText)}</Data>
              </Cell>
            </Row>
            <Row ss:Height="20">
              <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="sSubtitle">
                <Data ss:Type="String">${escapeXml(subtitleText)}</Data>
              </Cell>
            </Row>
            <Row ss:Height="24">
              ${headersXml}
            </Row>
            ${dataRowsXml}
          </Table>
        </Worksheet>`;
}

/**
 * Export one or more batches in the specified format ('excel' | 'csv' | 'txt' | 'json')
 * Returns true if export succeeded, false if an error occurred.
 */
export function exportBatchesToFile(
  batches: BatchExportPayload[],
  format: ExportFormat,
  isTh: boolean = true,
  customFilenamePrefix?: string
): boolean {
  if (!batches || batches.length === 0) return false;

  try {
    const enrichedBatches = batches.map((b) => enrichBatchForExport(b, isTh));
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const basePrefix =
      customFilenamePrefix ||
      (enrichedBatches.length === 1
        ? sanitizeFilename(enrichedBatches[0].batchName)
        : 'mixed_bed_all_batches');

    if (format === 'json') {
      const jsonPayload = {
        exportedAt: new Date().toISOString(),
        batchCount: enrichedBatches.length,
        batches: enrichedBatches.map((b) => {
          const lastRow = b.rows[b.rows.length - 1];
          return {
            batchName: b.batchName,
            train: b.train,
            estimateMaximumConductivityCapacityMol: b.condCapacity,
            estimateMaximumSilicaCapacityMol: b.silicaCapacity,
            totalResinCapacityMol: Number(b.totalCapacity.toFixed(2)),
            warning90ThresholdMol: b.warnMol,
            stop95ThresholdMol: b.stopMol,
            rowCount: b.rows.length,
            summary: {
              currentWaterVolumeM3: lastRow ? Number(lastRow.cycleEnd.toFixed(2)) : 0,
              weightedAverageSilicaMolM3:
                b.finalWaSilica !== null ? Number(b.finalWaSilica.toFixed(6)) : null,
              weightedAverageCondMolM3:
                b.finalWaCond !== null ? Number(b.finalWaCond.toFixed(6)) : null,
              totalWeightedAverageMolM3:
                b.finalTotalWa !== null ? Number(b.finalTotalWa.toFixed(6)) : null,
              currentCondIonLoadMol: lastRow ? Number(lastRow.cumulativeIonLoad.toFixed(3)) : 0,
              currentCondPercentLoad: lastRow ? Number(lastRow.condPercentLoad.toFixed(3)) : 0,
              currentSilicaIonLoadMol: lastRow ? Number(lastRow.cumulativeSilicaLoad.toFixed(3)) : 0,
              currentSilicaPercentLoad: lastRow ? Number(lastRow.silicaPercentLoad.toFixed(3)) : 0,
              currentCombinedIonLoadMol: lastRow ? Number(lastRow.totalCombinedIonLoad.toFixed(3)) : 0,
              currentCombinedPercentLoad: lastRow ? Number(lastRow.combinedPercentLoad.toFixed(3)) : 0,
              predictedWarning90VolumeM3:
                b.predictedWarning90Volume !== null
                  ? Number(b.predictedWarning90Volume.toFixed(2))
                  : null,
              predictedStop95VolumeM3:
                b.predictedStop95Volume !== null
                  ? Number(b.predictedStop95Volume.toFixed(2))
                  : null,
              predictedBreakthrough100VolumeM3:
                b.predictedBreakthroughVolume !== null
                  ? Number(b.predictedBreakthroughVolume.toFixed(2))
                  : null,
            },
            rows: b.rows.map((r) => ({
              step: r.step,
              label: r.label,
              cycleStartM3: Number(r.cycleStart.toFixed(2)),
              cycleEndM3: Number(r.cycleEnd.toFixed(2)),
              deltaVolumeM3: Number(r.distance.toFixed(2)),
              // Silica
              silicaInPpb: Number(r.silicaIn.toFixed(2)),
              silicaOutPpb: Number(r.silicaOut.toFixed(2)),
              silicaConcInMolL: Number(r.silicaConcInMolL.toFixed(7)),
              silicaConcInMolM3: Number(r.silicaConcInMolM3.toFixed(6)),
              silicaConcOutMolL: Number(r.silicaConcOutMolL.toFixed(8)),
              silicaConcOutMolM3: Number(r.silicaConcOutMolM3.toFixed(6)),
              deltaSilicaMolM3: Number(r.dSilica.toFixed(6)),
              weightedAverageSilicaMolM3:
                r.waSilica !== null ? Number(r.waSilica.toFixed(6)) : null,
              silicaIonsRemovedMol: Number(r.silicaIonsRemoved.toFixed(3)),
              cumulativeSilicaLoadMol: Number(r.cumulativeSilicaLoad.toFixed(3)),
              silicaPercentLoad: Number(r.silicaPercentLoad.toFixed(3)),
              // Conductivity
              condInUsCm: Number(r.condIn.toFixed(3)),
              condOutUsCm: Number(r.condOut.toFixed(3)),
              condConcInMolL: Number(r.concInMolL.toFixed(8)),
              condConcInMolM3: Number(r.concInMolM3.toFixed(6)),
              condConcOutMolL: Number(r.concOutMolL.toFixed(9)),
              condConcOutMolM3: Number(r.concOutMolM3.toFixed(6)),
              deltaCondMolM3: Number(r.dCond.toFixed(6)),
              weightedAverageCondMolM3:
                r.waCond !== null ? Number(r.waCond.toFixed(6)) : null,
              condIonsRemovedMol: Number(r.ionsRemoved.toFixed(3)),
              cumulativeCondLoadMol: Number(r.cumulativeIonLoad.toFixed(3)),
              condPercentLoad: Number(r.condPercentLoad.toFixed(3)),
              // Combined & Cycle Prediction
              totalWeightedAverageMolM3:
                r.totalWa !== null ? Number(r.totalWa.toFixed(6)) : null,
              predictedWarning90M3:
                r.predictedWarning90 !== null ? Number(r.predictedWarning90.toFixed(2)) : null,
              predictedStop95M3:
                r.predictedStop95 !== null ? Number(r.predictedStop95.toFixed(2)) : null,
              totalCombinedIonLoadMol: Number(r.totalCombinedIonLoad.toFixed(3)),
              combinedPercentLoad: Number(r.combinedPercentLoad.toFixed(3)),
              status: getRowControlStatus(r, isTh),
            })),
          };
        }),
      };

      const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      triggerDownload(blob, `${basePrefix}_${timestamp}.json`);
      return true;
    }

    if (format === 'csv') {
      const headers = [
        isTh ? 'ชื่อชุดข้อมูล (Batch)' : 'Batch Name',
        isTh ? 'สายการผลิต (Train)' : 'Train',
        '#',
        isTh ? 'รอบ' : 'Step Label',
        'Cycle (m³)',
        'ΔV (m³)',
        // Tab 1: Raw Inputs
        'Silica MB Inlet/RO Outlet (ppb)',
        'Silica MB Outlet (ppb)',
        'Cond. MB Inlet/RO Outlet (µS/cm)',
        'Cond MB Outlet (µS/cm)',
        // Tab 2: Silica Calculation
        'Silica Inlet (mol/L)',
        'Silica Inlet (mol/m³)',
        'Silica Outlet (mol/L)',
        'Silica Outlet (mol/m³)',
        'ΔSilica (mol/m³)',
        'Weighted Avg of Silica (mol/m³)',
        isTh ? 'Ion ที่ใช้ไป Silica (mol)' : 'Silica Ions Consumed (mol)',
        'Ion load silica (mol)',
        '%Ion load silica (%)',
        // Tab 3: Conductivity Calculation
        'Cond. Inlet (mol/L)',
        'Cond. Inlet (mol/m³)',
        'Cond. Outlet (mol/L)',
        'Cond. Outlet (mol/m³)',
        'ΔCond. (mol/m³)',
        'Weighted Avg of Cond. (mol/m³)',
        isTh ? 'Ion ที่ใช้ไป Cond. (mol)' : 'Cond. Ions Consumed (mol)',
        'Ion load cond. (mol)',
        '%Ion load cond. (%)',
        // Tab 4 & 5: Cycle Prediction & Combined Load
        'Total Weighted Average (mol/m³)',
        isTh ? 'จุดแจ้งเตือนระบบ (90%) (m³)' : 'System Warning (90%) (m³)',
        isTh ? 'จุดหยุดระบบ (95%) (m³)' : 'System Stop (95%) (m³)',
        isTh ? 'Ion Load รวม (mol)' : 'Total Combined Load (mol)',
        'Percent Load on Resin (%)',
        isTh ? 'สถานะการควบคุม' : 'Control Status',
      ];

      const csvLines: string[] = [headers.map(escapeCsvCell).join(',')];

      enrichedBatches.forEach((b) => {
        b.rows.forEach((c) => {
          const rowCells = [
            b.batchName,
            b.train,
            c.step,
            c.label,
            c.cycleEnd.toFixed(2),
            c.distance.toFixed(2),
            // Tab 1
            c.silicaIn.toFixed(2),
            c.silicaOut.toFixed(2),
            c.condIn.toFixed(3),
            c.condOut.toFixed(3),
            // Tab 2
            c.silicaConcInMolL.toFixed(7),
            c.silicaConcInMolM3.toFixed(6),
            c.silicaConcOutMolL.toFixed(8),
            c.silicaConcOutMolM3.toFixed(6),
            c.dSilica.toFixed(6),
            fmtExportFixed(c.waSilica, 6),
            c.silicaIonsRemoved.toFixed(3),
            c.cumulativeSilicaLoad.toFixed(3),
            `${c.silicaPercentLoad.toFixed(3)}%`,
            // Tab 3
            c.concInMolL.toFixed(8),
            c.concInMolM3.toFixed(6),
            c.concOutMolL.toFixed(9),
            c.concOutMolM3.toFixed(6),
            c.dCond.toFixed(6),
            fmtExportFixed(c.waCond, 6),
            c.ionsRemoved.toFixed(3),
            c.cumulativeIonLoad.toFixed(3),
            `${c.condPercentLoad.toFixed(3)}%`,
            // Tab 4 & 5
            fmtExportFixed(c.totalWa, 6),
            fmtExportFixed(c.predictedWarning90, 2),
            fmtExportFixed(c.predictedStop95, 2),
            c.totalCombinedIonLoad.toFixed(3),
            `${c.combinedPercentLoad.toFixed(3)}%`,
            getRowControlStatus(c, isTh),
          ];
          csvLines.push(rowCells.map(escapeCsvCell).join(','));
        });
      });

      const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      });
      triggerDownload(blob, `${basePrefix}_${timestamp}.csv`);
      return true;
    }

    if (format === 'txt') {
      const divider = '='.repeat(126);
      const subDivider = '-'.repeat(126);
      const lines: string[] = [];

      lines.push(divider);
      lines.push(
        isTh
          ? 'รายงานการคำนวณและคาดการณ์ Cycle ของระบบ Mixed Bed (Conductivity, Silica, Weighted Average & Cycle Prediction)'
          : 'MIXED BED RESIN LOAD CONTROL, WEIGHTED AVERAGE & CYCLE FORECASTING REPORT'
      );
      lines.push(
        `${isTh ? 'วันที่ส่งออกข้อมูล' : 'Exported At'}: ${new Date().toLocaleString(
          isTh ? 'th-TH' : 'en-US'
        )}`
      );
      lines.push(divider);
      lines.push('');

      const pad = (val: string, len: number, align: 'left' | 'right' = 'right') =>
        align === 'left' ? val.padEnd(len, ' ') : val.padStart(len, ' ');

      enrichedBatches.forEach((b, bIdx) => {
        const lastRow = b.rows[b.rows.length - 1];

        lines.push(
          `[${bIdx + 1}] ${isTh ? 'ชุดข้อมูล (Batch)' : 'Batch'}: ${b.batchName} (Mixed Bed Train ${b.train})`
        );
        lines.push(
          `    • Estimate maximum conductivity capacity(mol) = ${b.condCapacity.toFixed(2)} | Estimate maximum silica capacity(mol) = ${b.silicaCapacity.toFixed(2)} | Total Capacity (100%) = ${b.totalCapacity.toFixed(2)} mol`
        );
        lines.push(
          `    • ${isTh ? 'จุดแจ้งเตือนระบบ (90%)' : 'System Warning (90%)'} = ${b.warnMol.toFixed(2)} mol → ${fmtExportFixed(b.predictedWarning90Volume, 2)} m³ | ${isTh ? 'จุดหยุดระบบ (95%)' : 'System Stop (95%)'} = ${b.stopMol.toFixed(2)} mol → ${fmtExportFixed(b.predictedStop95Volume, 2)} m³`
        );
        lines.push(
          `    • Weighted Average of Silica = ${fmtExportFixed(b.finalWaSilica, 6)} mol/m³ | Weighted Average of Cond. = ${fmtExportFixed(b.finalWaCond, 6)} mol/m³ | Total Weighted Average = ${fmtExportFixed(b.finalTotalWa, 6)} mol/m³`
        );
        lines.push(
          `    • ${isTh ? 'ปริมาตรน้ำสะสมปัจจุบัน' : 'Current Water Volume'}: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ (${b.rows.length} ${isTh ? 'รอบ' : 'steps'}) | Percent Load on Resin = ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}% (Cond ${(lastRow ? lastRow.cumulativeIonLoad : 0).toFixed(3)} mol + Silica ${(lastRow ? lastRow.cumulativeSilicaLoad : 0).toFixed(3)} mol)`
        );
        lines.push(subDivider);

        lines.push(
          [
            pad('#', 3, 'left'),
            pad(isTh ? 'รอบ' : 'Step', 10, 'left'),
            pad('Cycle(m³)', 10),
            pad('ΔV(m³)', 9),
            pad('ΔSilica', 10),
            pad('WA Silica', 10),
            pad('ΔCond.', 10),
            pad('WA Cond.', 10),
            pad('Total WA', 10),
            pad('Warn 90%(m³)', 13),
            pad('Stop 95%(m³)', 13),
            pad('%Load รวม', 10),
          ].join(' ')
        );
        lines.push(subDivider);

        b.rows.forEach((c) => {
          lines.push(
            [
              pad(String(c.step), 3, 'left'),
              pad(c.label.slice(0, 9), 10, 'left'),
              pad(c.cycleEnd.toFixed(2), 10),
              pad(c.distance.toFixed(2), 9),
              pad(c.dSilica.toFixed(6), 10),
              pad(fmtExportFixed(c.waSilica, 6), 10),
              pad(c.dCond.toFixed(6), 10),
              pad(fmtExportFixed(c.waCond, 6), 10),
              pad(fmtExportFixed(c.totalWa, 6), 10),
              pad(fmtExportFixed(c.predictedWarning90, 2), 13),
              pad(fmtExportFixed(c.predictedStop95, 2), 13),
              pad(`${c.combinedPercentLoad.toFixed(3)}%`, 10),
            ].join(' ')
          );
        });

        lines.push(divider);
        lines.push('');
      });

      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/plain;charset=utf-8',
      });
      triggerDownload(blob, `${basePrefix}_${timestamp}.txt`);
      return true;
    }

    if (format === 'excel') {
      const usedSheetNames = new Set<string>();
      const worksheets: string[] = [];

      const rowToneEvaluator = (c: EnrichedExportRow): 'normal' | 'warn' | 'stop' => {
        const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
        if (govPct >= 95 || c.condOut >= 0.1 || c.silicaOut >= 10) return 'stop';
        if (govPct >= 90) return 'warn';
        return 'normal';
      };

      const makeMasterColumns = (): ExcelColumnSpec<EnrichedExportRow>[] => [
        { header: '#', width: 42, getValue: (r) => r.step, type: 'number', decimals: 0 },
        { header: isTh ? 'รอบ' : 'Step', width: 95, getValue: (r) => r.label, type: 'string' },
        { header: 'Cycle (m³)', width: 90, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
        { header: 'ΔV (m³)', width: 85, getValue: (r) => r.distance, type: 'number', decimals: 2 },
        { header: 'Silica MB Inlet/RO Outlet (ppb)', width: 155, getValue: (r) => r.silicaIn, type: 'number', decimals: 2 },
        { header: 'Silica MB Outlet (ppb)', width: 130, getValue: (r) => r.silicaOut, type: 'number', decimals: 2 },
        { header: 'Silica Inlet (mol/L)', width: 120, getValue: (r) => r.silicaConcInMolL, type: 'number', decimals: 7 },
        { header: 'Silica Inlet (mol/m³)', width: 125, getValue: (r) => r.silicaConcInMolM3, type: 'number', decimals: 6 },
        { header: 'Silica Outlet (mol/L)', width: 125, getValue: (r) => r.silicaConcOutMolL, type: 'number', decimals: 8 },
        { header: 'Silica Outlet (mol/m³)', width: 125, getValue: (r) => r.silicaConcOutMolM3, type: 'number', decimals: 6 },
        { header: 'ΔSilica (mol/m³)', width: 115, getValue: (r) => r.dSilica, type: 'number', decimals: 6 },
        { header: 'Weighted Avg of Silica', width: 140, getValue: (r) => r.waSilica, type: 'number', decimals: 6 },
        { header: isTh ? 'Ion ที่ใช้ไป Silica (mol)' : 'Silica Ions Consumed (mol)', width: 135, getValue: (r) => r.silicaIonsRemoved, type: 'number', decimals: 3 },
        { header: 'Ion load silica (mol)', width: 125, getValue: (r) => r.cumulativeSilicaLoad, type: 'number', decimals: 3 },
        { header: '%Ion load silica', width: 110, getValue: (r) => r.silicaPercentLoad, type: 'number', decimals: 3 },
        { header: 'Cond. MB Inlet/RO Outlet (µS/cm)', width: 165, getValue: (r) => r.condIn, type: 'number', decimals: 3 },
        { header: 'Cond MB Outlet (µS/cm)', width: 135, getValue: (r) => r.condOut, type: 'number', decimals: 3 },
        { header: 'Cond. Inlet (mol/L)', width: 120, getValue: (r) => r.concInMolL, type: 'number', decimals: 8 },
        { header: 'Cond. Inlet (mol/m³)', width: 125, getValue: (r) => r.concInMolM3, type: 'number', decimals: 6 },
        { header: 'Cond. Outlet (mol/L)', width: 125, getValue: (r) => r.concOutMolL, type: 'number', decimals: 9 },
        { header: 'Cond. Outlet (mol/m³)', width: 125, getValue: (r) => r.concOutMolM3, type: 'number', decimals: 6 },
        { header: 'ΔCond. (mol/m³)', width: 115, getValue: (r) => r.dCond, type: 'number', decimals: 6 },
        { header: 'Weighted Avg of Cond.', width: 140, getValue: (r) => r.waCond, type: 'number', decimals: 6 },
        { header: isTh ? 'Ion ที่ใช้ไป Cond. (mol)' : 'Cond. Ions Consumed (mol)', width: 135, getValue: (r) => r.ionsRemoved, type: 'number', decimals: 3 },
        { header: 'Ion load cond. (mol)', width: 125, getValue: (r) => r.cumulativeIonLoad, type: 'number', decimals: 3 },
        { header: '%Ion load cond.', width: 110, getValue: (r) => r.condPercentLoad, type: 'number', decimals: 3 },
        { header: 'Total Weighted Average', width: 145, getValue: (r) => r.totalWa, type: 'number', decimals: 6 },
        { header: isTh ? 'จุดแจ้งเตือนระบบ (90%) (m³)' : 'System Warning (90%) (m³)', width: 150, getValue: (r) => r.predictedWarning90, type: 'number', decimals: 2 },
        { header: isTh ? 'จุดหยุดระบบ (95%) (m³)' : 'System Stop (95%) (m³)', width: 145, getValue: (r) => r.predictedStop95, type: 'number', decimals: 2 },
        { header: isTh ? 'Ion Load รวม (mol)' : 'Total Combined Load (mol)', width: 125, getValue: (r) => r.totalCombinedIonLoad, type: 'number', decimals: 3 },
        { header: 'Percent Load on Resin (%)', width: 140, getValue: (r) => r.combinedPercentLoad, type: 'number', decimals: 3 },
        { header: isTh ? 'สถานะการควบคุม' : 'Control Status', width: 175, getValue: (r) => getRowControlStatus(r, isTh), type: 'string' },
      ];

      if (enrichedBatches.length === 1) {
        // Single-batch export: Create 5 separate worksheets matching the 5 UI Tabs + 1 Master All-Columns sheet
        const b = enrichedBatches[0];
        const lastRow = b.rows[b.rows.length - 1];
        const titleText = `${b.batchName} (Mixed Bed Train ${b.train}) — Estimate maximum conductivity capacity(mol) = ${b.condCapacity.toFixed(2)} | Estimate maximum silica capacity(mol) = ${b.silicaCapacity.toFixed(2)} | Total Capacity (100%) = ${b.totalCapacity.toFixed(2)} mol`;
        const subtitleText = isTh
          ? `ปริมาตรน้ำปัจจุบัน: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ | จุดแจ้งเตือนระบบ (90% = ${b.warnMol.toFixed(2)} mol): ${fmtExportFixed(b.predictedWarning90Volume, 2)} m³ | จุดหยุดระบบ (95% = ${b.stopMol.toFixed(2)} mol): ${fmtExportFixed(b.predictedStop95Volume, 2)} m³ | Percent Load on Resin: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`
          : `Current Volume: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ | 90% System Warning (${b.warnMol.toFixed(2)} mol): ${fmtExportFixed(b.predictedWarning90Volume, 2)} m³ | 95% System Stop (${b.stopMol.toFixed(2)} mol): ${fmtExportFixed(b.predictedStop95Volume, 2)} m³ | Percent Load on Resin: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`;

        // Sheet 1: 1. บันทึกข้อมูล MB
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? `1_บันทึกข้อมูล_MB_Train_${b.train}` : `1_Input_Log_Train_${b.train}`, usedSheetNames, 1),
            titleText,
            subtitleText,
            [
              { header: '#', width: 45, getValue: (r) => r.step, type: 'number', decimals: 0 },
              { header: isTh ? 'รอบ' : 'Step', width: 105, getValue: (r) => r.label, type: 'string' },
              { header: 'Cycle (m³)', width: 100, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
              { header: 'Silica MB Inlet/RO Outlet (ppb)', width: 175, getValue: (r) => r.silicaIn, type: 'number', decimals: 2 },
              { header: 'Silica MB Outlet (ppb)', width: 145, getValue: (r) => r.silicaOut, type: 'number', decimals: 2 },
              { header: 'Cond. MB Inlet/RO Outlet (µS/cm)', width: 185, getValue: (r) => r.condIn, type: 'number', decimals: 3 },
              { header: 'Cond MB Outlet (µS/cm)', width: 150, getValue: (r) => r.condOut, type: 'number', decimals: 3 },
            ],
            b.rows,
            rowToneEvaluator
          )
        );

        // Sheet 2: 2. การคำนวณ Silica
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? '2_การคำนวณ_Silica' : '2_Silica_Calculation', usedSheetNames, 2),
            titleText,
            subtitleText,
            [
              { header: '#', width: 45, getValue: (r) => r.step, type: 'number', decimals: 0 },
              { header: 'Cycle (m³)', width: 95, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
              { header: 'ΔV (m³)', width: 90, getValue: (r) => r.distance, type: 'number', decimals: 2 },
              { header: 'Silica Inlet (mol/L)', width: 130, getValue: (r) => r.silicaConcInMolL, type: 'number', decimals: 7 },
              { header: 'Silica Inlet (mol/m³)', width: 135, getValue: (r) => r.silicaConcInMolM3, type: 'number', decimals: 6 },
              { header: 'Silica Outlet (mol/L)', width: 135, getValue: (r) => r.silicaConcOutMolL, type: 'number', decimals: 8 },
              { header: 'Silica Outlet (mol/m³)', width: 135, getValue: (r) => r.silicaConcOutMolM3, type: 'number', decimals: 6 },
              { header: isTh ? 'Ion ที่ใช้ไป (mol)' : 'Ions Consumed (mol)', width: 125, getValue: (r) => r.silicaIonsRemoved, type: 'number', decimals: 3 },
              { header: 'Ion load silica (mol)', width: 135, getValue: (r) => r.cumulativeSilicaLoad, type: 'number', decimals: 3 },
              { header: '%Ion load silica', width: 115, getValue: (r) => r.silicaPercentLoad, type: 'number', decimals: 3 },
            ],
            b.rows,
            rowToneEvaluator
          )
        );

        // Sheet 3: 3. การคำนวณ Conductivity
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? '3_การคำนวณ_Conductivity' : '3_Conductivity_Calculation', usedSheetNames, 3),
            titleText,
            subtitleText,
            [
              { header: '#', width: 45, getValue: (r) => r.step, type: 'number', decimals: 0 },
              { header: 'Cycle (m³)', width: 95, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
              { header: 'ΔV (m³)', width: 90, getValue: (r) => r.distance, type: 'number', decimals: 2 },
              { header: 'Cond. Inlet (mol/L)', width: 130, getValue: (r) => r.concInMolL, type: 'number', decimals: 8 },
              { header: 'Cond. Inlet (mol/m³)', width: 135, getValue: (r) => r.concInMolM3, type: 'number', decimals: 6 },
              { header: 'Cond. Outlet (mol/L)', width: 135, getValue: (r) => r.concOutMolL, type: 'number', decimals: 9 },
              { header: 'Cond. Outlet (mol/m³)', width: 135, getValue: (r) => r.concOutMolM3, type: 'number', decimals: 6 },
              { header: isTh ? 'Ion ที่ใช้ไป (mol)' : 'Ions Consumed (mol)', width: 125, getValue: (r) => r.ionsRemoved, type: 'number', decimals: 3 },
              { header: 'Ion load cond. (mol)', width: 135, getValue: (r) => r.cumulativeIonLoad, type: 'number', decimals: 3 },
              { header: '%Ion load cond.', width: 115, getValue: (r) => r.condPercentLoad, type: 'number', decimals: 3 },
            ],
            b.rows,
            rowToneEvaluator
          )
        );

        // Sheet 4: 4. Weighted Average
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName('4_Weighted_Average', usedSheetNames, 4),
            titleText,
            subtitleText,
            [
              { header: '#', width: 45, getValue: (r) => r.step, type: 'number', decimals: 0 },
              { header: 'Cycle (m³)', width: 95, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
              { header: 'ΔV (m³)', width: 90, getValue: (r) => r.distance, type: 'number', decimals: 2 },
              { header: 'Silica Inlet (mol/m³)', width: 135, getValue: (r) => r.silicaConcInMolM3, type: 'number', decimals: 6 },
              { header: 'Silica Outlet (mol/m³)', width: 135, getValue: (r) => r.silicaConcOutMolM3, type: 'number', decimals: 6 },
              { header: 'ΔSilica (mol/m³)', width: 120, getValue: (r) => r.dSilica, type: 'number', decimals: 6 },
              { header: 'Weighted Avg of Silica', width: 145, getValue: (r) => r.waSilica, type: 'number', decimals: 6 },
              { header: 'Cond. Inlet (mol/m³)', width: 135, getValue: (r) => r.concInMolM3, type: 'number', decimals: 6 },
              { header: 'Cond. Outlet (mol/m³)', width: 135, getValue: (r) => r.concOutMolM3, type: 'number', decimals: 6 },
              { header: 'ΔCond. (mol/m³)', width: 120, getValue: (r) => r.dCond, type: 'number', decimals: 6 },
              { header: 'Weighted Avg of Cond.', width: 145, getValue: (r) => r.waCond, type: 'number', decimals: 6 },
            ],
            b.rows,
            rowToneEvaluator
          )
        );

        // Sheet 5: 5. ทำนาย Cycle
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? '5_ทำนาย_Cycle' : '5_Cycle_Prediction', usedSheetNames, 5),
            titleText,
            subtitleText,
            [
              { header: '#', width: 45, getValue: (r) => r.step, type: 'number', decimals: 0 },
              { header: 'Cycle (m³)', width: 95, getValue: (r) => r.cycleEnd, type: 'number', decimals: 2 },
              { header: 'Weighted Average of Silica', width: 165, getValue: (r) => r.waSilica, type: 'number', decimals: 6 },
              { header: 'Weighted Average of Cond.', width: 165, getValue: (r) => r.waCond, type: 'number', decimals: 6 },
              { header: 'Total Weighted Average', width: 155, getValue: (r) => r.totalWa, type: 'number', decimals: 6 },
              { header: isTh ? 'จุดแจ้งเตือนระบบ (90%) (m³)' : 'System Warning (90%) (m³)', width: 165, getValue: (r) => r.predictedWarning90, type: 'number', decimals: 2 },
              { header: isTh ? 'จุดหยุดระบบ (95%) (m³)' : 'System Stop (95%) (m³)', width: 155, getValue: (r) => r.predictedStop95, type: 'number', decimals: 2 },
            ],
            b.rows,
            rowToneEvaluator
          )
        );

        // Sheet 6: 6. สรุปรวมทั้งหมด (Master Table)
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? '6_สรุปรวมทั้งหมด' : '6_Master_Summary', usedSheetNames, 6),
            titleText,
            subtitleText,
            makeMasterColumns(),
            b.rows,
            rowToneEvaluator
          )
        );
      } else {
        // Multi-batch export: Create an Overview comparison sheet + 1 master sheet per batch
        worksheets.push(
          buildWorksheetXml(
            makeUniqueSheetName(isTh ? '0_สรุปทุกชุดข้อมูล' : '0_All_Batches_Overview', usedSheetNames, 0),
            isTh ? 'สรุปภาพรวมทุกชุดข้อมูลที่บันทึกไว้ (Mixed Bed Batch History Overview)' : 'Mixed Bed Saved Batches Summary Overview',
            `${isTh ? 'จำนวนชุดข้อมูลทั้งหมด' : 'Total Batches'}: ${enrichedBatches.length}`,
            [
              { header: '#', width: 42, getValue: (b) => enrichedBatches.indexOf(b) + 1, type: 'number', decimals: 0 },
              { header: isTh ? 'ชื่อชุดข้อมูล (Batch)' : 'Batch Name', width: 185, getValue: (b) => b.batchName, type: 'string' },
              { header: 'Train', width: 55, getValue: (b) => b.train, type: 'string' },
              { header: isTh ? 'จำนวนรอบ' : 'Steps', width: 75, getValue: (b) => b.rows.length, type: 'number', decimals: 0 },
              { header: 'Cond. Cap (mol)', width: 105, getValue: (b) => b.condCapacity, type: 'number', decimals: 2 },
              { header: 'Silica Cap (mol)', width: 105, getValue: (b) => b.silicaCapacity, type: 'number', decimals: 2 },
              { header: 'Total Cap (mol)', width: 105, getValue: (b) => b.totalCapacity, type: 'number', decimals: 2 },
              { header: 'Cycle ล่าสุด (m³)', width: 115, getValue: (b) => (b.rows.length ? b.rows[b.rows.length - 1].cycleEnd : 0), type: 'number', decimals: 2 },
              { header: 'Weighted Avg Silica', width: 135, getValue: (b) => b.finalWaSilica, type: 'number', decimals: 6 },
              { header: 'Weighted Avg Cond.', width: 135, getValue: (b) => b.finalWaCond, type: 'number', decimals: 6 },
              { header: 'Total Weighted Avg', width: 135, getValue: (b) => b.finalTotalWa, type: 'number', decimals: 6 },
              { header: isTh ? 'จุดแจ้งเตือน 90% (m³)' : '90% Warning (m³)', width: 135, getValue: (b) => b.predictedWarning90Volume, type: 'number', decimals: 2 },
              { header: isTh ? 'จุดหยุดระบบ 95% (m³)' : '95% Stop (m³)', width: 135, getValue: (b) => b.predictedStop95Volume, type: 'number', decimals: 2 },
              { header: 'Percent Load (%)', width: 115, getValue: (b) => (b.rows.length ? b.rows[b.rows.length - 1].combinedPercentLoad : 0), type: 'number', decimals: 3 },
            ],
            enrichedBatches,
            (b) => {
              const last = b.rows[b.rows.length - 1];
              if (!last) return 'normal';
              return rowToneEvaluator(last);
            }
          )
        );

        enrichedBatches.forEach((b, idx) => {
          const lastRow = b.rows[b.rows.length - 1];
          const sheetName = makeUniqueSheetName(`${idx + 1}_${b.batchName}`, usedSheetNames, idx + 1);
          const titleText = `${b.batchName} (Mixed Bed Train ${b.train}) — Cond. Cap = ${b.condCapacity.toFixed(2)} mol | Silica Cap = ${b.silicaCapacity.toFixed(2)} mol | Total = ${b.totalCapacity.toFixed(2)} mol`;
          const subtitleText = isTh
            ? `ปริมาตรน้ำปัจจุบัน: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ | จุดแจ้งเตือนระบบ (90%): ${fmtExportFixed(b.predictedWarning90Volume, 2)} m³ | จุดหยุดระบบ (95%): ${fmtExportFixed(b.predictedStop95Volume, 2)} m³ | Percent Load on Resin: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`
            : `Current Volume: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ | 90% System Warning: ${fmtExportFixed(b.predictedWarning90Volume, 2)} m³ | 95% System Stop: ${fmtExportFixed(b.predictedStop95Volume, 2)} m³ | Percent Load on Resin: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`;

          worksheets.push(
            buildWorksheetXml(
              sheetName,
              titleText,
              subtitleText,
              makeMasterColumns(),
              b.rows,
              rowToneEvaluator
            )
          );
        });
      }

      const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Tahoma" ss:Size="10"/>
  </Style>
  <Style ss:ID="sTitle">
   <Font ss:FontName="Tahoma" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#059669" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
   </Borders>
  </Style>
  <Style ss:ID="sNormalRow">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="sWarnRow">
   <Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F59E0B"/>
   </Borders>
  </Style>
  <Style ss:ID="sStopRow">
   <Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EF4444"/>
   </Borders>
  </Style>
 </Styles>
 ${worksheets.join('\n ')}
</Workbook>`;

      const blob = new Blob(['\uFEFF' + excelXml], {
        type: 'application/vnd.ms-excel;charset=utf-8',
      });
      triggerDownload(blob, `${basePrefix}_${timestamp}.xls`);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Failed to export batch data:', err);
    return false;
  }
}

/**
 * Helper to convert CyclePredictionRecord[] from HistoryView into BatchExportPayload[]
 * Properly distinguishes Train A (73.75 / 5.81) and Train B (106.47 / 5.93) defaults.
 */
export function convertRecordsToExportPayloads(
  records: CyclePredictionRecord[]
): BatchExportPayload[] {
  return records.map((r) => {
    const norm = normalizeCycleRecordToBatch(r);
    const isTrainB = norm.train === 'B' || (!norm.train && norm.batchName.includes('B'));
    const defaultCond = isTrainB ? DEFAULT_TRAIN_B_COND_CAPACITY : DEFAULT_COND_CAPACITY;
    const defaultSilica = isTrainB ? DEFAULT_TRAIN_B_SILICA_CAPACITY : DEFAULT_SILICA_CAPACITY;
    const cCap = norm.condCapacity && norm.condCapacity > 0 ? norm.condCapacity : defaultCond;
    const sCap = norm.silicaCapacity && norm.silicaCapacity > 0 ? norm.silicaCapacity : defaultSilica;
    const totalCap = cCap + sCap;
    const warnMol = Number((totalCap * 0.9).toFixed(2));
    const stopMol = Number((totalCap * 0.95).toFixed(2));
    const stop95 = norm.predictedCycle;
    const warn90 = stop95 > 0 && stopMol > 0 ? Number(((stop95 * warnMol) / stopMol).toFixed(3)) : 0;

    return {
      batchName: norm.batchName,
      train: isTrainB ? 'B' : 'A',
      condCapacity: cCap,
      silicaCapacity: sCap,
      rows: norm.rows,
      predictedWarning90Volume: warn90,
      predictedStop95Volume: stop95,
      predictedBreakthroughVolume: norm.predictedBreakthrough,
      createdAt: norm.createdAt,
    };
  });
}

interface ExportMenuProps {
  onExport: (format: ExportFormat) => boolean | void;
  disabled?: boolean;
  isTh: boolean;
  label?: string;
  variant?: 'toolbar' | 'compact';
}

export const ExportDataMenu: React.FC<ExportMenuProps> = ({
  onExport,
  disabled = false,
  isTh,
  label,
  variant = 'toolbar',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentFormat, setRecentFormat] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (fmt: ExportFormat) => {
    if (disabled) return;
    setExportError(null);
    try {
      const result = onExport(fmt);
      if (result === false) {
        setExportError(
          isTh ? 'ไม่สามารถส่งออกไฟล์ได้ กรุณาตรวจสอบข้อมูลในตาราง' : 'Export failed. Please check table data.'
        );
        return;
      }
      setRecentFormat(fmt);
      setTimeout(() => {
        setIsOpen(false);
        setRecentFormat(null);
      }, 650);
    } catch (err) {
      console.error('Export trigger error:', err);
      setExportError(
        isTh ? 'เกิดข้อผิดพลาดขณะสร้างไฟล์ส่งออก' : 'An error occurred while generating the export file.'
      );
    }
  };

  const formatOptions: {
    id: ExportFormat;
    title: string;
    ext: string;
    desc: string;
    badgeClass: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'excel',
      title: 'Microsoft Excel',
      ext: '.xls',
      desc: isTh
        ? 'แยกแผ่นงานครบทั้ง 5 แท็บ + ตารางสรุปรวมพร้อมสีสถานะ'
        : '5 calculation sheets + master summary with status colors',
      badgeClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />,
    },
    {
      id: 'csv',
      title: 'CSV (UTF-8)',
      ext: '.csv',
      desc: isTh
        ? 'ตารางข้อมูลครบทุกคอลัมน์ (ทศนิยมละเอียด 6–9 ตำแหน่ง)'
        : 'Full precision comma-separated values (all columns)',
      badgeClass: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
      icon: <Table2 className="w-4 h-4 text-sky-500 shrink-0" />,
    },
    {
      id: 'txt',
      title: isTh ? 'รายงานวิศวกรรม (TXT)' : 'Engineering Text Report',
      ext: '.txt',
      desc: isTh
        ? 'สรุปค่าความจุ, Weighted Average และตารางทำนาย Cycle'
        : 'Readable engineering summary, Weighted Average & table',
      badgeClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
      icon: <FileText className="w-4 h-4 text-amber-500 shrink-0" />,
    },
    {
      id: 'json',
      title: 'JSON Data',
      ext: '.json',
      desc: isTh ? 'โครงสร้างข้อมูลละเอียดครบทุกฟิลด์สำหรับสำรองระบบ' : 'Complete structured backup data format',
      badgeClass: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
      icon: <FileCode2 className="w-4 h-4 text-indigo-500 shrink-0" />,
    },
  ];

  const renderDropdownPanel = () => (
    <div className="absolute right-0 top-full mt-1.5 w-[min(19rem,calc(100vw-2rem))] rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-xl z-50 p-2 space-y-1">
      <div className="px-2.5 py-1.5 text-xs font-bold text-[var(--ink)] border-b border-[var(--line)] flex items-center justify-between gap-2">
        <span>{isTh ? 'ส่งออกข้อมูลการคำนวณ' : 'Export Calculation Data'}</span>
        <span className="text-[11px] font-mono text-[var(--ink-soft)]">Excel · CSV · TXT · JSON</span>
      </div>

      {exportError && (
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {formatOptions.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => handleSelect(opt.id)}
          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[var(--bg)] text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] shrink-0">
              {opt.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--ink)] truncate">{opt.title}</div>
              <div className="text-[11px] text-[var(--ink-soft)] leading-snug line-clamp-2">{opt.desc}</div>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border shrink-0 ${opt.badgeClass}`}
          >
            {recentFormat === opt.id ? <Check className="w-3.5 h-3.5 inline" /> : opt.ext}
          </span>
        </button>
      ))}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div ref={containerRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--line)]/50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          title={isTh ? 'ส่งออกไฟล์ข้อมูล (Excel, CSV, TXT, JSON)' : 'Export file (Excel, CSV, TXT, JSON)'}
        >
          <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="hidden sm:inline">{label || (isTh ? 'ส่งออก' : 'Export')}</span>
          <ChevronDown className="w-3 h-3 text-[var(--ink-soft)]" />
        </button>

        {isOpen && renderDropdownPanel()}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Unified Quick Bar + Dropdown Trigger */}
      <div className="inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] p-0.5">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          title={isTh ? 'เลือกรูปแบบไฟล์ส่งออก' : 'Choose export file format'}
        >
          <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{label || (isTh ? 'ส่งออกไฟล์' : 'Export')}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
        </button>

        <div className="hidden md:flex items-center gap-0.5 pl-1 pr-0.5 border-l border-[var(--line)]">
          {(
            [
              { id: 'excel' as const, label: 'Excel', color: 'hover:text-emerald-500' },
              { id: 'csv' as const, label: 'CSV', color: 'hover:text-sky-500' },
              { id: 'txt' as const, label: 'TXT', color: 'hover:text-amber-500' },
              { id: 'json' as const, label: 'JSON', color: 'hover:text-indigo-500' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(btn.id)}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold text-[var(--ink-soft)] ${btn.color} hover:bg-[var(--panel)] transition-colors cursor-pointer disabled:opacity-40`}
              title={`${isTh ? 'ส่งออกเป็น' : 'Export as'} ${btn.label}`}
            >
              {recentFormat === btn.id ? <Check className="w-3 h-3 inline text-emerald-500" /> : btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown Panel with Full Details */}
      {isOpen && renderDropdownPanel()}
    </div>
  );
};
