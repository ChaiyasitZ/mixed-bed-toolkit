import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode2,
  Table2,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  CycleRowItem,
  CyclePredictionRecord,
  normalizeCycleRecordToBatch,
  isNonPhysicalCycleRow,
  DEFAULT_COND_CAPACITY,
  DEFAULT_SILICA_CAPACITY,
} from '../services/dataService';

export type ExportFormat = 'excel' | 'csv' | 'txt' | 'json';

export interface BatchExportPayload {
  batchName: string;
  train?: string;
  condCapacity: number;
  silicaCapacity: number;
  rows: CycleRowItem[];
  predictedCutoff95Volume?: number;
  predictedCutoff98Volume?: number;
  predictedBreakthroughVolume?: number;
  probReach98ByRow?: number[];
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
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function getRowControlStatus(c: CycleRowItem, isTh: boolean): string {
  const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
  if (isNonPhysicalCycleRow(c)) {
    return isTh ? 'ตรวจสอบข้อมูล (Flagged)' : 'Flagged for Review';
  }
  if (govPct >= 100 || c.condOut >= 0.1 || c.silicaOut >= 10) {
    return isTh ? 'ทะลุขีดจำกัด (Breakthrough ≥100%)' : 'Breakthrough (>=100%)';
  }
  if (govPct >= 98) {
    return isTh ? 'หยุดระบบ / ฟื้นฟูเรซิน (≥98%)' : 'Stop Mixed Bed / Regen (>=98%)';
  }
  if (govPct >= 95) {
    return isTh ? 'แจ้งเตือนเฝ้าระวัง (≥95%)' : 'Warning (>=95%)';
  }
  return isTh ? 'ปกติ (<95%)' : 'Normal (<95%)';
}

function escapeXml(unsafe: string | number): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvCell(val: string | number): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export one or more batches in the specified format ('excel' | 'csv' | 'txt' | 'json')
 */
export function exportBatchesToFile(
  batches: BatchExportPayload[],
  format: ExportFormat,
  isTh: boolean = true,
  customFilenamePrefix?: string
) {
  if (!batches || batches.length === 0) return;

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const basePrefix =
    customFilenamePrefix ||
    (batches.length === 1 ? sanitizeFilename(batches[0].batchName) : 'mixed_bed_all_batches');

  if (format === 'json') {
    const jsonPayload = {
      exportedAt: new Date().toISOString(),
      batchCount: batches.length,
      batches: batches.map((b) => {
        const totalCap = b.condCapacity + b.silicaCapacity;
        const lastRow = b.rows[b.rows.length - 1];
        const cutoff98 = b.predictedCutoff98Volume ?? (lastRow ? lastRow.predictedCycle : 0);
        const cutoff95 = b.predictedCutoff95Volume ?? (cutoff98 > 0 ? Number(((cutoff98 * 95) / 98).toFixed(3)) : 0);
        return {
          batchName: b.batchName,
          train: b.train || 'A',
          condCapacityMol: b.condCapacity,
          silicaCapacityMol: b.silicaCapacity,
          totalResinCapacityMol: Number(totalCap.toFixed(3)),
          warning95ThresholdMol: Number((totalCap * 0.95).toFixed(3)),
          cutoff98ThresholdMol: Number((totalCap * 0.98).toFixed(3)),
          rowCount: b.rows.length,
          summary: {
            currentWaterVolumeM3: lastRow ? lastRow.cycleEnd : 0,
            currentCombinedIonLoadMol: lastRow ? lastRow.totalCombinedIonLoad : 0,
            currentCombinedPercentLoad: lastRow ? lastRow.combinedPercentLoad : 0,
            currentSilicaIonLoadMol: lastRow ? lastRow.cumulativeSilicaLoad : 0,
            currentSilicaPercentLoad: lastRow ? lastRow.silicaPercentLoad : 0,
            predictedWarning95VolumeM3: cutoff95,
            predictedCutoff98VolumeM3: cutoff98,
          },
          rows: b.rows.map((r, idx) => ({
            step: r.step,
            label: r.label,
            cycleStartM3: r.cycleStart,
            cycleEndM3: r.cycleEnd,
            deltaVolumeM3: r.distance,
            silicaInPpb: r.silicaIn,
            silicaOutPpb: r.silicaOut,
            silicaConcInMolL: r.silicaConcInMolL,
            silicaConcInMolM3: r.silicaConcInMolM3,
            silicaConcOutMolL: r.silicaConcOutMolL,
            silicaConcOutMolM3: r.silicaConcOutMolM3,
            silicaIonsRemovedMol: r.silicaIonsRemoved,
            cumulativeSilicaLoadMol: r.cumulativeSilicaLoad,
            silicaPercentLoad: r.silicaPercentLoad,
            condInUsCm: r.condIn,
            condOutUsCm: r.condOut,
            condConcInMolM3: r.concInMolM3,
            condConcOutMolM3: r.concOutMolM3,
            condIonsRemovedMol: r.ionsRemoved,
            cumulativeCondLoadMol: r.cumulativeIonLoad,
            totalCombinedIonLoadMol: r.totalCombinedIonLoad,
            combinedPercentLoad: r.combinedPercentLoad,
            probReach98Percent: b.probReach98ByRow?.[idx] ?? null,
            predictedCutoff98M3: r.predictedCycle,
            status: getRowControlStatus(r, isTh),
          })),
        };
      }),
    };

    const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    triggerDownload(blob, `${basePrefix}_${timestamp}.json`);
    return;
  }

  if (format === 'csv') {
    const headers = [
      isTh ? 'ชื่อชุดข้อมูล (Batch)' : 'Batch Name',
      isTh ? 'สายการผลิต (Train)' : 'Train',
      isTh ? 'ลำดับ (Step)' : 'Step',
      isTh ? 'ป้ายกำกับ (Label)' : 'Label',
      'Cycle (m³)',
      isTh ? 'ระยะห่าง ΔV (m³)' : 'Delta V (m³)',
      'Silica Inlet (ppb)',
      'Silica Outlet (ppb)',
      'Conc. Silica In (mol/L)',
      'Conc. Silica In (mol/m³)',
      'Conc. Silica Out (mol/L)',
      'Conc. Silica Out (mol/m³)',
      isTh ? 'Ion Silica ที่หายไป (mol)' : 'Silica Removed (mol)',
      isTh ? 'Ion Load Silica สะสม (mol)' : 'Cum. Silica Load (mol)',
      '% Load Silica (%)',
      'Cond Inlet (µS/cm)',
      'Cond Outlet (µS/cm)',
      'Conc. Cond In (mol/m³)',
      'Conc. Cond Out (mol/m³)',
      isTh ? 'Ion Cond ที่หายไป (mol)' : 'Cond Removed (mol)',
      isTh ? 'Ion Load Cond สะสม (mol)' : 'Cum. Cond Load (mol)',
      isTh ? 'Ion Load รวม (mol)' : 'Total Combined Load (mol)',
      '% Load on Resin (%)',
      'P(Load >= 98%) (%)',
      isTh ? 'จุดตัดรอบ 98% (m³)' : 'Predicted 98% Cutoff (m³)',
      isTh ? 'สถานะการควบคุม' : 'Control Status',
    ];

    const csvLines: string[] = [headers.map(escapeCsvCell).join(',')];

    batches.forEach((b) => {
      b.rows.forEach((c, idx) => {
        const prob = b.probReach98ByRow?.[idx];
        const rowCells = [
          b.batchName,
          b.train || 'A',
          c.step,
          c.label,
          c.cycleEnd.toFixed(3),
          c.distance.toFixed(3),
          c.silicaIn.toFixed(3),
          c.silicaOut.toFixed(3),
          c.silicaConcInMolL.toFixed(7),
          c.silicaConcInMolM3.toFixed(3),
          c.silicaConcOutMolL.toFixed(8),
          c.silicaConcOutMolM3.toFixed(3),
          c.silicaIonsRemoved.toFixed(3),
          c.cumulativeSilicaLoad.toFixed(3),
          `${c.silicaPercentLoad.toFixed(3)}%`,
          c.condIn.toFixed(3),
          c.condOut.toFixed(3),
          c.concInMolM3.toFixed(3),
          c.concOutMolM3.toFixed(3),
          c.ionsRemoved.toFixed(3),
          c.cumulativeIonLoad.toFixed(3),
          c.totalCombinedIonLoad.toFixed(3),
          `${c.combinedPercentLoad.toFixed(3)}%`,
          prob !== undefined ? `${prob.toFixed(2)}%` : '-',
          c.predictedCycle.toFixed(3),
          getRowControlStatus(c, isTh),
        ];
        csvLines.push(rowCells.map(escapeCsvCell).join(','));
      });
    });

    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    triggerDownload(blob, `${basePrefix}_${timestamp}.csv`);
    return;
  }

  if (format === 'txt') {
    const divider = '='.repeat(108);
    const subDivider = '-'.repeat(108);
    const lines: string[] = [];

    lines.push(divider);
    lines.push(
      isTh
        ? 'รายงานการควบคุม Percent Load on Resin และทำนายรอบการผลิต (Mixed Bed System Report)'
        : 'MIXED BED RESIN LOAD CONTROL & CYCLE FORECASTING REPORT'
    );
    lines.push(
      `${isTh ? 'วันที่ส่งออกข้อมูล' : 'Exported At'}: ${new Date().toLocaleString(
        isTh ? 'th-TH' : 'en-US'
      )}`
    );
    lines.push(divider);
    lines.push('');

    batches.forEach((b, bIdx) => {
      const totalCap = b.condCapacity + b.silicaCapacity;
      const lastRow = b.rows[b.rows.length - 1];
      const cutoff98 = b.predictedCutoff98Volume ?? (lastRow ? lastRow.predictedCycle : 0);
      const cutoff95 =
        b.predictedCutoff95Volume ?? (cutoff98 > 0 ? Number(((cutoff98 * 95) / 98).toFixed(3)) : 0);

      lines.push(
        `[${bIdx + 1}] ${isTh ? 'ชุดข้อมูล (Batch)' : 'Batch'}: ${b.batchName} (Train ${
          b.train || 'A'
        })`
      );
      lines.push(
        `    • Cond Capacity: ${b.condCapacity.toFixed(3)} mol | Silica Capacity: ${b.silicaCapacity.toFixed(
          3
        )} mol | ${isTh ? 'ความจุเรซินรวม (100%)' : 'Total Capacity (100%)'}: ${totalCap.toFixed(3)} mol`
      );
      lines.push(
        `    • ${
          isTh ? 'ปริมาตรน้ำที่ผลิตได้ ณ ปัจจุบัน' : 'Current Water Volume'
        }: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(2)} m³ (${b.rows.length} ${
          isTh ? 'รอบ' : 'steps'
        })`
      );
      lines.push(
        `    • ${isTh ? 'จุดแจ้งเตือนระบบ (95%)' : 'Warning Point (95%)'}: ${cutoff95.toFixed(
          2
        )} m³ (${(totalCap * 0.95).toFixed(3)} mol)`
      );
      lines.push(
        `    • ${
          isTh ? 'จุดตัดรอบหยุดระบบเพื่อ Regeneration (98%)' : 'Cutoff Point (98%)'
        }: ${cutoff98.toFixed(2)} m³ (${(totalCap * 0.98).toFixed(3)} mol)`
      );
      lines.push(
        `    • ${isTh ? '% Load on Resin ปัจจุบัน' : 'Current % Load'}: ${(lastRow
          ? lastRow.combinedPercentLoad
          : 0
        ).toFixed(3)}% (Ion Load รวม ${(lastRow ? lastRow.totalCombinedIonLoad : 0).toFixed(
          3
        )} mol | Silica ${(lastRow ? lastRow.silicaPercentLoad : 0).toFixed(3)}%)`
      );
      lines.push(subDivider);

      const pad = (val: string, len: number, align: 'left' | 'right' = 'right') =>
        align === 'left' ? val.padEnd(len, ' ') : val.padStart(len, ' ');

      lines.push(
        [
          pad('#', 4, 'left'),
          pad(isTh ? 'รอบ (Step)' : 'Step', 14, 'left'),
          pad('Cycle(m³)', 11),
          pad('ΔV(m³)', 10),
          pad('Si In/Out', 15),
          pad('Cond In/Out', 15),
          pad('Load รวม(mol)', 14),
          pad('%Load รวม', 11),
          pad('%Silica', 10),
          '  ' + (isTh ? 'สถานะการควบคุม' : 'Status'),
        ].join(' ')
      );
      lines.push(subDivider);

      b.rows.forEach((c) => {
        lines.push(
          [
            pad(String(c.step), 4, 'left'),
            pad(c.label.slice(0, 13), 14, 'left'),
            pad(c.cycleEnd.toFixed(2), 11),
            pad(c.distance.toFixed(2), 10),
            pad(`${c.silicaIn.toFixed(1)}/${c.silicaOut.toFixed(2)}`, 15),
            pad(`${c.condIn.toFixed(2)}/${c.condOut.toFixed(3)}`, 15),
            pad(c.totalCombinedIonLoad.toFixed(3), 14),
            pad(`${c.combinedPercentLoad.toFixed(3)}%`, 11),
            pad(`${c.silicaPercentLoad.toFixed(2)}%`, 10),
            '  ' + getRowControlStatus(c, isTh),
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
    return;
  }

  if (format === 'excel') {
    // Generate Microsoft Excel 2003 SpreadsheetML (.xls) with styled headers, summary & data rows
    const worksheetsXml = batches
      .map((b, idx) => {
        const rawSheetName = `${idx + 1}_${b.batchName}`
          .replace(/[\\/?*[\]:]/g, ' ')
          .trim()
          .slice(0, 28);
        const sheetName = escapeXml(rawSheetName || `Batch_${idx + 1}`);
        const totalCap = b.condCapacity + b.silicaCapacity;
        const lastRow = b.rows[b.rows.length - 1];
        const cutoff98 = b.predictedCutoff98Volume ?? (lastRow ? lastRow.predictedCycle : 0);
        const cutoff95 =
          b.predictedCutoff95Volume ?? (cutoff98 > 0 ? Number(((cutoff98 * 95) / 98).toFixed(3)) : 0);

        const colHeaders = [
          '#',
          isTh ? 'รอบ (Step)' : 'Step',
          'Cycle (m³)',
          isTh ? 'ระยะห่าง ΔV (m³)' : 'Delta V (m³)',
          'Silica Inlet (ppb)',
          'Silica Outlet (ppb)',
          'Conc. Silica In (mol/L)',
          'Conc. Silica In (mol/m³)',
          'Conc. Silica Out (mol/L)',
          'Conc. Silica Out (mol/m³)',
          isTh ? 'Ion Silica ที่หายไป (mol)' : 'Silica Removed (mol)',
          isTh ? 'Ion Load Silica สะสม (mol)' : 'Cum. Silica Load (mol)',
          '% Load Silica (%)',
          'Cond Inlet (µS/cm)',
          'Cond Outlet (µS/cm)',
          'Conc. Cond In (mol/m³)',
          'Conc. Cond Out (mol/m³)',
          isTh ? 'Ion Cond ที่หายไป (mol)' : 'Cond Removed (mol)',
          isTh ? 'Ion Load Cond สะสม (mol)' : 'Cum. Cond Load (mol)',
          isTh ? 'Ion Load รวม (mol)' : 'Total Combined Load (mol)',
          '% Load on Resin (%)',
          'P(Load >= 98%) (%)',
          isTh ? 'จุดตัดรอบ 98% (m³)' : 'Predicted 98% Cutoff (m³)',
          isTh ? 'สถานะการควบคุม' : 'Control Status',
        ];

        const dataRowsXml = b.rows
          .map((c, rIdx) => {
            const prob = b.probReach98ByRow?.[rIdx];
            const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
            const rowStyle =
              govPct >= 98 ? 'sStopRow' : govPct >= 95 ? 'sWarnRow' : 'sNormalRow';

            const numCell = (val: number) =>
              `<Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${
                Number.isFinite(val) ? val : 0
              }</Data></Cell>`;
            const strCell = (val: string) =>
              `<Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;

            return `<Row ss:Height="20">
              ${numCell(c.step)}
              ${strCell(c.label)}
              ${numCell(Number(c.cycleEnd.toFixed(3)))}
              ${numCell(Number(c.distance.toFixed(3)))}
              ${numCell(Number(c.silicaIn.toFixed(3)))}
              ${numCell(Number(c.silicaOut.toFixed(3)))}
              ${numCell(Number(c.silicaConcInMolL.toFixed(7)))}
              ${numCell(Number(c.silicaConcInMolM3.toFixed(3)))}
              ${numCell(Number(c.silicaConcOutMolL.toFixed(8)))}
              ${numCell(Number(c.silicaConcOutMolM3.toFixed(3)))}
              ${numCell(Number(c.silicaIonsRemoved.toFixed(3)))}
              ${numCell(Number(c.cumulativeSilicaLoad.toFixed(3)))}
              ${numCell(Number(c.silicaPercentLoad.toFixed(3)))}
              ${numCell(Number(c.condIn.toFixed(3)))}
              ${numCell(Number(c.condOut.toFixed(3)))}
              ${numCell(Number(c.concInMolM3.toFixed(3)))}
              ${numCell(Number(c.concOutMolM3.toFixed(3)))}
              ${numCell(Number(c.ionsRemoved.toFixed(3)))}
              ${numCell(Number(c.cumulativeIonLoad.toFixed(3)))}
              ${numCell(Number(c.totalCombinedIonLoad.toFixed(3)))}
              ${numCell(Number(c.combinedPercentLoad.toFixed(3)))}
              ${
                prob !== undefined
                  ? numCell(Number(prob.toFixed(2)))
                  : strCell('-')
              }
              ${numCell(Number(c.predictedCycle.toFixed(3)))}
              ${strCell(getRowControlStatus(c, isTh))}
            </Row>`;
          })
          .join('\n');

        return `<Worksheet ss:Name="${sheetName}">
          <Table>
            <Column ss:Width="40"/>
            <Column ss:Width="105"/>
            <Column ss:Width="85"/>
            <Column ss:Width="85"/>
            <Column ss:Width="95"/>
            <Column ss:Width="95"/>
            <Column ss:Width="115"/>
            <Column ss:Width="115"/>
            <Column ss:Width="115"/>
            <Column ss:Width="115"/>
            <Column ss:Width="115"/>
            <Column ss:Width="120"/>
            <Column ss:Width="95"/>
            <Column ss:Width="95"/>
            <Column ss:Width="95"/>
            <Column ss:Width="110"/>
            <Column ss:Width="110"/>
            <Column ss:Width="110"/>
            <Column ss:Width="115"/>
            <Column ss:Width="115"/>
            <Column ss:Width="110"/>
            <Column ss:Width="100"/>
            <Column ss:Width="110"/>
            <Column ss:Width="165"/>
            <Row ss:Height="24">
              <Cell ss:MergeAcross="23" ss:StyleID="sTitle">
                <Data ss:Type="String">${escapeXml(
                  `${b.batchName} (Train ${b.train || 'A'}) — Cond Cap: ${b.condCapacity} mol | Silica Cap: ${b.silicaCapacity} mol | Total: ${totalCap.toFixed(
                    2
                  )} mol`
                )}</Data>
              </Cell>
            </Row>
            <Row ss:Height="20">
              <Cell ss:MergeAcross="23" ss:StyleID="sSubtitle">
                <Data ss:Type="String">${escapeXml(
                  isTh
                    ? `ปริมาตรน้ำปัจจุบัน: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(
                        2
                      )} m³ | แจ้งเตือนระบบ 95%: ${cutoff95.toFixed(
                        2
                      )} m³ | จุดตัดรอบหยุดระบบ 98%: ${cutoff98.toFixed(
                        2
                      )} m³ | % Load ปัจจุบัน: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`
                    : `Current Water: ${(lastRow ? lastRow.cycleEnd : 0).toFixed(
                        2
                      )} m³ | 95% Warning: ${cutoff95.toFixed(
                        2
                      )} m³ | 98% Cutoff: ${cutoff98.toFixed(
                        2
                      )} m³ | Current Load: ${(lastRow ? lastRow.combinedPercentLoad : 0).toFixed(3)}%`
                )}</Data>
              </Cell>
            </Row>
            <Row ss:Height="24">
              ${colHeaders
                .map(
                  (h) =>
                    `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
                )
                .join('')}
            </Row>
            ${dataRowsXml}
          </Table>
        </Worksheet>`;
      })
      .join('\n');

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
 ${worksheetsXml}
</Workbook>`;

    const blob = new Blob(['\uFEFF' + excelXml], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    });
    triggerDownload(blob, `${basePrefix}_${timestamp}.xls`);
  }
}

/**
 * Helper to convert CyclePredictionRecord[] from HistoryView into BatchExportPayload[]
 */
export function convertRecordsToExportPayloads(
  records: CyclePredictionRecord[]
): BatchExportPayload[] {
  return records.map((r) => {
    const norm = normalizeCycleRecordToBatch(r);
    const cutoff98 = norm.predictedCycle;
    const cutoff95 = cutoff98 > 0 ? Number(((cutoff98 * 95) / 98).toFixed(3)) : 0;
    return {
      batchName: norm.batchName,
      train: norm.train || 'A',
      condCapacity: norm.condCapacity || DEFAULT_COND_CAPACITY,
      silicaCapacity: norm.silicaCapacity || DEFAULT_SILICA_CAPACITY,
      rows: norm.rows,
      predictedCutoff95Volume: cutoff95,
      predictedCutoff98Volume: cutoff98,
      predictedBreakthroughVolume: norm.predictedBreakthrough,
      createdAt: norm.createdAt,
    };
  });
}

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
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
    onExport(fmt);
    setRecentFormat(fmt);
    setTimeout(() => {
      setIsOpen(false);
      setRecentFormat(null);
    }, 500);
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
      desc: isTh ? 'ตารางรายงานพร้อมสีสถานะและสรุปผล' : 'Formatted spreadsheet with status colors',
      badgeClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />,
    },
    {
      id: 'csv',
      title: 'CSV (UTF-8)',
      ext: '.csv',
      desc: isTh ? 'ไฟล์ตารางมาตรฐานสำหรับวิเคราะห์ต่อ' : 'Standard comma-separated values',
      badgeClass: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
      icon: <Table2 className="w-4 h-4 text-sky-500 shrink-0" />,
    },
    {
      id: 'txt',
      title: isTh ? 'ข้อความธรรมดา (TXT)' : 'Plain Text Report',
      ext: '.txt',
      desc: isTh ? 'สรุปค่าพารามิเตอร์และตารางอ่านง่าย' : 'Readable engineering summary & table',
      badgeClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
      icon: <FileText className="w-4 h-4 text-amber-500 shrink-0" />,
    },
    {
      id: 'json',
      title: 'JSON Data',
      ext: '.json',
      desc: isTh ? 'โครงสร้างข้อมูลสำหรับสำรองระบบ' : 'Structured backup data format',
      badgeClass: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
      icon: <FileCode2 className="w-4 h-4 text-indigo-500 shrink-0" />,
    },
  ];

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

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-xl z-50 p-1.5 space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-bold text-[var(--ink-soft)] border-b border-[var(--line)] flex items-center justify-between">
              <span>{isTh ? 'เลือกรูปแบบไฟล์ที่ต้องการ' : 'Select Export Format'}</span>
              <span className="font-mono text-[10px]">4 formats</span>
            </div>
            {formatOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-[var(--bg)] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.icon}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--ink)] truncate">{opt.title}</div>
                    <div className="text-[10px] text-[var(--ink-soft)] truncate">{opt.desc}</div>
                  </div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${opt.badgeClass}`}
                >
                  {recentFormat === opt.id ? <Check className="w-3 h-3 inline" /> : opt.ext}
                </span>
              </button>
            ))}
          </div>
        )}
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
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold text-[var(--ink-soft)] ${btn.color} hover:bg-[var(--panel)] transition-colors cursor-pointer disabled:opacity-40`}
              title={`${isTh ? 'ส่งออกเป็น' : 'Export as'} ${btn.label}`}
            >
              {recentFormat === btn.id ? <Check className="w-3 h-3 inline text-emerald-500" /> : btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown Panel with Full Details */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-xl z-50 p-2 space-y-1">
          <div className="px-2.5 py-1.5 text-xs font-bold text-[var(--ink)] border-b border-[var(--line)] flex items-center justify-between">
            <span>{isTh ? 'ส่งออกข้อมูลการคำนวณ' : 'Export Calculation Data'}</span>
            <span className="text-[10px] font-mono text-[var(--ink-soft)]">Excel · CSV · TXT · JSON</span>
          </div>
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
                  <div className="text-[11px] text-[var(--ink-soft)] truncate">{opt.desc}</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border shrink-0 ${opt.badgeClass}`}
              >
                {recentFormat === opt.id ? <Check className="w-3.5 h-3.5 inline" /> : opt.ext}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
