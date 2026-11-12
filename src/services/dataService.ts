import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';

export const LAMBDA_0_NACL = 126.45;
export const MOLAR_MASS_SIO2 = 60.08;
export const DEFAULT_COND_CAPACITY = 73.91;
export const DEFAULT_SILICA_CAPACITY = 5.68;
export const DEFAULT_RESIN_CAPACITY = 79.59; // 73.91 + 5.68 = 79.59 mol (100% Combined Resin Capacity for Train A)
export const DEFAULT_TRAIN_B_COND_CAPACITY = 106.47;
export const DEFAULT_TRAIN_B_SILICA_CAPACITY = 5.93;
export const DEFAULT_TRAIN_B_RESIN_CAPACITY = 112.40; // 106.47 + 5.93 = 112.40 mol (100% Combined Resin Capacity for Train B)

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SaltRecord {
  id: string;
  userId: string;
  feed: number;
  permeate: number;
  rejection: number;
  cycle?: string;
  createdAt: string;
}

export interface SilicaRecord {
  id: string;
  userId: string;
  feed: number;
  permeate: number;
  rejection: number;
  cycle?: string;
  createdAt: string;
}

export interface CycleRowInput {
  rowId?: string;
  label?: string;
  cycleEnd: number;
  condIn: number;
  condOut: number;
  silicaIn?: number;
  silicaOut?: number;
}

export interface CycleRowItem {
  rowId: string;
  step: number;
  label: string;
  cycleStart: number;
  cycleEnd: number;
  distance: number;
  // Conductivity fields
  condIn: number;
  condOut: number;
  concInMolL: number;
  concInMolM3: number;
  concOutMolL: number;
  concOutMolM3: number;
  ionsRemoved: number; // Cond Ion Removed (mol)
  cumulativeIonLoad: number; // Cond Cumulative Ion Load (mol)
  condPercentLoad: number; // (Ion Load Cond / condCapacity) * 100
  // Silica fields
  silicaIn: number; // ppb
  silicaOut: number; // ppb
  silicaConcInMolL: number; // (silicaIn / 1_000_000) / 60.08
  silicaConcInMolM3: number; // silicaConcInMolL * 1000
  silicaConcOutMolL: number; // (silicaOut / 1_000_000) / 60.08
  silicaConcOutMolM3: number; // silicaConcOutMolL * 1000
  silicaIonsRemoved: number; // (silicaConcInMolM3 - silicaConcOutMolM3) * distance
  cumulativeSilicaLoad: number; // Cumulative Silica Ion Load (mol)
  stepSilicaPlusCondLoad: number; // Step 4 formula: Ion Concentration ที่หายไป (Silica) + Ion Load Cond (mol)
  silicaPercentLoad: number; // Step 5 formula: (Ion Load Silica / 5.7) * 100
  // Combined (Cond + Silica) fields (Capacity = 74 + 5.7 = 79.7 mol)
  totalCombinedIonLoad: number; // Ion Load Cond + Ion Load Silica (mol)
  combinedPercentLoad: number; // (totalCombinedIonLoad / 79.7) * 100
  percentLoad: number; // Active Percent Load on Resin (%)
  predictedCycle: number; // Predicted 98% Cut-off Volume (m³)
}

export interface CyclePredictionRecord {
  id: string;
  userId: string;
  batchName?: string;
  train?: string;
  resinCapacity?: number;
  condCapacity?: number;
  silicaCapacity?: number;
  rowCount?: number;
  rows?: CycleRowItem[];
  conductivity: number;
  condOut?: number;
  silica?: number;
  silicaOut?: number;
  cumulativeSilicaLoad?: number;
  silicaPercentLoad?: number;
  totalCombinedIonLoad?: number;
  combinedPercentLoad?: number;
  b0?: number;
  b1?: number;
  b2?: number;
  predictedCycle: number;
  predictedBreakthrough?: number;
  cycleStart?: number;
  cycleEnd?: number;
  distance?: number;
  ionsRemoved?: number;
  cumulativeIonLoad?: number;
  percentLoad?: number;
  cycle?: string;
  createdAt: string;
  updatedAt?: string;
}

// Helper to generate clean alphanumeric IDs matching '^[a-zA-Z0-9_\\-]+$'
export function generateValidId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export interface BatchCalculationResult {
  rows: CycleRowItem[];
  condCapacity: number;
  silicaCapacity: number;
  resinCapacity: number; // Total = condCapacity + silicaCapacity (default 79.7 mol)
  rowCount: number;
  conductivity: number;
  condOut: number;
  silica: number;
  silicaOut: number;
  cycleStart: number;
  cycleEnd: number;
  distance: number;
  ionsRemoved: number;
  cumulativeIonLoad: number;
  condPercentLoad: number;
  cumulativeSilicaLoad: number;
  silicaPercentLoad: number;
  totalCombinedIonLoad: number;
  combinedPercentLoad: number;
  percentLoad: number;
  predictedCycle: number; // Predicted 98% Cut-off Volume (m³)
  predictedBreakthrough: number; // Predicted 100% Breakthrough Volume (m³)
  predictedSilicaCutoffCycle: number; // Predicted 98% Cut-off Volume based on Silica (5.7 mol)
  predictedCondCutoffCycle: number; // Predicted 98% Cut-off Volume based on Cond (74 mol)
  predictedTotalCycleCount98: number; // Estimated number of Cycle steps at 98% cut-off
  maxSafeRowWithin98: CycleRowItem | null; // Highest step still <= 98%
  firstCutoffRowAbove98: CycleRowItem | null; // First step > 98% (or breakthrough)
}

export function isNonPhysicalCycleRow(row: {
  distance: number;
  condIn: number;
  condOut: number;
  ionsRemoved: number;
  cumulativeIonLoad: number;
  percentLoad: number;
  silicaIn?: number;
  silicaOut?: number;
  silicaIonsRemoved?: number;
  cumulativeSilicaLoad?: number;
}): boolean {
  return (
    row.distance <= 0 ||
    row.condIn < 0 ||
    row.condOut < 0 ||
    row.condOut > row.condIn ||
    row.ionsRemoved < 0 ||
    row.cumulativeIonLoad < 0 ||
    row.percentLoad < 0 ||
    (row.silicaIn !== undefined && row.silicaIn < 0) ||
    (row.silicaOut !== undefined && row.silicaOut < 0) ||
    (row.silicaIn !== undefined && row.silicaOut !== undefined && row.silicaOut > row.silicaIn) ||
    (row.silicaIonsRemoved !== undefined && row.silicaIonsRemoved < 0) ||
    (row.cumulativeSilicaLoad !== undefined && row.cumulativeSilicaLoad < 0)
  );
}

/**
 * Deterministically recalculates an entire batch of cycle rows from Step 1 to Step N
 * including both Conductivity (NaCl, 126.45, Cap = 74 mol) and Silica (SiO2, 60.08, Cap = 5.7 mol)
 * with Combined Capacity = 74 + 5.7 = 79.7 mol and 98% Cut-off forecasting.
 */
export function recalculateBatchRows(
  rawInputs: CycleRowInput[],
  condCapacity: number = DEFAULT_COND_CAPACITY,
  isTh: boolean = true,
  sortByVolume: boolean = false,
  silicaCapacity: number = DEFAULT_SILICA_CAPACITY
): BatchCalculationResult {
  const cCap = condCapacity > 0 ? condCapacity : DEFAULT_COND_CAPACITY;
  const sCap = silicaCapacity > 0 ? silicaCapacity : DEFAULT_SILICA_CAPACITY;
  const totalCap = Number((cCap + sCap).toFixed(4)); // Default: 74 + 5.7 = 79.7 mol

  if (!rawInputs || rawInputs.length === 0) {
    return {
      rows: [],
      condCapacity: cCap,
      silicaCapacity: sCap,
      resinCapacity: totalCap,
      rowCount: 0,
      conductivity: 0,
      condOut: 0,
      silica: 0,
      silicaOut: 0,
      cycleStart: 0,
      cycleEnd: 0,
      distance: 0,
      ionsRemoved: 0,
      cumulativeIonLoad: 0,
      condPercentLoad: 0,
      cumulativeSilicaLoad: 0,
      silicaPercentLoad: 0,
      totalCombinedIonLoad: 0,
      combinedPercentLoad: 0,
      percentLoad: 0,
      predictedCycle: 1700,
      predictedBreakthrough: 1735,
      predictedSilicaCutoffCycle: 1700,
      predictedCondCutoffCycle: 1700,
      predictedTotalCycleCount98: 15,
      maxSafeRowWithin98: null,
      firstCutoffRowAbove98: null,
    };
  }

  const ordered = sortByVolume
    ? [...rawInputs].sort((a, b) => a.cycleEnd - b.cycleEnd)
    : [...rawInputs];

  let cumulativeCondLoad = 0;
  let cumulativeSilicaLoad = 0;

  const computedRows: CycleRowItem[] = ordered.map((item, idx) => {
    const step = idx + 1;
    const cycleStart = idx === 0 ? 0 : Number(ordered[idx - 1].cycleEnd) || 0;
    const cycleEnd = Number(item.cycleEnd) || 0;
    const distance = cycleEnd - cycleStart;

    // Conductivity calculations (NaCl eq: 126.45)
    const condIn = Number(item.condIn) || 0;
    const condOut = Number(item.condOut) || 0;
    const concInMolL = condIn / (1000 * LAMBDA_0_NACL);
    const concInMolM3 = concInMolL * 1000;
    const concOutMolL = condOut / (1000 * LAMBDA_0_NACL);
    const concOutMolM3 = concOutMolL * 1000;
    const netCondConc = concInMolM3 - concOutMolM3;
    const condIonsRemoved = netCondConc * distance;
    cumulativeCondLoad = cumulativeCondLoad + condIonsRemoved;
    const condPercentLoad = (cumulativeCondLoad / cCap) * 100;

    // Silica calculations (SiO2: 60.08 g/mol)
    // Step 1: Conc MB Inlet (mol/L) = (Silica MB Inlet ppb / 1,000,000) / 60.08 ; (mol/m³) = (mol/L) * 1000
    // Step 2: Conc MB Outlet (mol/L) = (Silica MB Outlet ppb / 1,000,000) / 60.08 ; (mol/m³) = (mol/L) * 1000
    // Step 3: Ion Concentration ที่หายไป (mol) = (Conc In (mol/m³) - Conc Out (mol/m³)) * ระยะห่าง Cycle (m³)
    const silicaIn = item.silicaIn !== undefined ? Number(item.silicaIn) : 185.3;
    const silicaOut = item.silicaOut !== undefined ? Number(item.silicaOut) : 1.0;
    const silicaConcInMolL = silicaIn / 1_000_000 / MOLAR_MASS_SIO2;
    const silicaConcInMolM3 = silicaConcInMolL * 1000;
    const silicaConcOutMolL = silicaOut / 1_000_000 / MOLAR_MASS_SIO2;
    const silicaConcOutMolM3 = silicaConcOutMolL * 1000;
    const netSilicaConc = silicaConcInMolM3 - silicaConcOutMolM3;
    const silicaIonsRemoved = netSilicaConc * distance;

    // Cumulative Silica Ion Load (mol)
    cumulativeSilicaLoad = cumulativeSilicaLoad + silicaIonsRemoved;

    // Step 4: Ion Load Silica + Cond
    const stepSilicaPlusCondLoad = silicaIonsRemoved + cumulativeCondLoad;
    const totalCombinedIonLoad = cumulativeCondLoad + cumulativeSilicaLoad;

    // Step 5: Percent Load on Resin (%)
    // Silica Percent Load = (Ion Load Silica / 5.7) * 100
    // Combined Percent Load = (Ion Load (Cond + Silica) / 79.7) * 100
    const silicaPercentLoad = (cumulativeSilicaLoad / sCap) * 100;
    const combinedPercentLoad = (totalCombinedIonLoad / totalCap) * 100;

    // Step 6: Predict Cycle volume at 98% cut-off using Combined Ion Load (Cond + Silica) vs 79.7 mol
    const avgCombinedRatePerM3 =
      cycleEnd > 0 && totalCombinedIonLoad > 0
        ? totalCombinedIonLoad / cycleEnd
        : Math.max(0, netCondConc + netSilicaConc);
    const predictedCycle =
      avgCombinedRatePerM3 > 0 ? (totalCap * 0.98) / avgCombinedRatePerM3 : 1700;

    const cleanLabel =
      item.label && item.label.trim()
        ? item.label.trim()
        : isTh
        ? `รอบย่อยที่ ${step}`
        : `Step ${step}`;

    return {
      rowId: item.rowId && /^[a-zA-Z0-9_\-]+$/.test(item.rowId) ? item.rowId : generateValidId(`row_${step}`),
      step,
      label: cleanLabel,
      cycleStart: Number(cycleStart.toFixed(4)),
      cycleEnd: Number(cycleEnd.toFixed(4)),
      distance: Number(distance.toFixed(4)),
      condIn: Number(condIn.toFixed(4)),
      condOut: Number(condOut.toFixed(4)),
      concInMolL: Number(concInMolL.toFixed(8)),
      concInMolM3: Number(concInMolM3.toFixed(6)),
      concOutMolL: Number(concOutMolL.toFixed(9)),
      concOutMolM3: Number(concOutMolM3.toFixed(6)),
      ionsRemoved: Number(condIonsRemoved.toFixed(5)),
      cumulativeIonLoad: Number(cumulativeCondLoad.toFixed(5)),
      condPercentLoad: Number(condPercentLoad.toFixed(4)),
      silicaIn: Number(silicaIn.toFixed(3)),
      silicaOut: Number(silicaOut.toFixed(3)),
      silicaConcInMolL: Number(silicaConcInMolL.toFixed(9)),
      silicaConcInMolM3: Number(silicaConcInMolM3.toFixed(6)),
      silicaConcOutMolL: Number(silicaConcOutMolL.toFixed(10)),
      silicaConcOutMolM3: Number(silicaConcOutMolM3.toFixed(6)),
      silicaIonsRemoved: Number(silicaIonsRemoved.toFixed(5)),
      cumulativeSilicaLoad: Number(cumulativeSilicaLoad.toFixed(5)),
      stepSilicaPlusCondLoad: Number(stepSilicaPlusCondLoad.toFixed(5)),
      silicaPercentLoad: Number(silicaPercentLoad.toFixed(4)),
      totalCombinedIonLoad: Number(totalCombinedIonLoad.toFixed(5)),
      combinedPercentLoad: Number(combinedPercentLoad.toFixed(4)),
      percentLoad: Number(combinedPercentLoad.toFixed(4)),
      predictedCycle: Number(predictedCycle.toFixed(3)),
    };
  });

  const lastRow = computedRows[computedRows.length - 1];
  const avgCondIn = Math.max(
    0,
    computedRows.reduce((sum, r) => sum + r.condIn, 0) / computedRows.length
  );
  const avgSilicaIn = Math.max(
    0,
    computedRows.reduce((sum, r) => sum + r.silicaIn, 0) / computedRows.length
  );
  const totalVol = Math.max(0, lastRow.cycleEnd);
  const totalCombined = lastRow.totalCombinedIonLoad;
  const overallCombinedRate = totalVol > 0 && totalCombined > 0 ? totalCombined / totalVol : 0;
  const overallSilicaRate =
    totalVol > 0 && lastRow.cumulativeSilicaLoad > 0 ? lastRow.cumulativeSilicaLoad / totalVol : 0;
  const overallCondRate =
    totalVol > 0 && lastRow.cumulativeIonLoad > 0 ? lastRow.cumulativeIonLoad / totalVol : 0;

  // Predicted 98% Cut-off Volume (Combined Cond + Silica, Capacity = 74 + 5.7 = 79.7 mol)
  let predictedCutoff98 = overallCombinedRate > 0 ? (totalCap * 0.98) / overallCombinedRate : 1700;
  const idx98 = computedRows.findIndex((r) => r.combinedPercentLoad > 98);
  if (idx98 > 0) {
    const prev = computedRows[idx98 - 1];
    const curr = computedRows[idx98];
    const deltaPct = curr.combinedPercentLoad - prev.combinedPercentLoad;
    if (deltaPct > 0 && prev.combinedPercentLoad <= 98) {
      const frac = (98 - prev.combinedPercentLoad) / deltaPct;
      predictedCutoff98 = prev.cycleEnd + frac * (curr.cycleEnd - prev.cycleEnd);
    }
  }

  let predictedBreakthrough100 = overallCombinedRate > 0 ? totalCap / overallCombinedRate : 1735;
  const idx100 = computedRows.findIndex((r) => r.combinedPercentLoad >= 100);
  if (idx100 > 0) {
    const prev = computedRows[idx100 - 1];
    const curr = computedRows[idx100];
    const deltaPct = curr.combinedPercentLoad - prev.combinedPercentLoad;
    if (deltaPct > 0 && prev.combinedPercentLoad <= 100) {
      const frac = (100 - prev.combinedPercentLoad) / deltaPct;
      predictedBreakthrough100 = prev.cycleEnd + frac * (curr.cycleEnd - prev.cycleEnd);
    }
  }

  const predictedSilicaCutoffCycle =
    overallSilicaRate > 0 ? (sCap * 0.98) / overallSilicaRate : 1700;
  const predictedCondCutoffCycle =
    overallCondRate > 0 ? (cCap * 0.98) / overallCondRate : 1700;

  // Find maximum safe step still within <= 98% (both Combined and Silica) and first step exceeding 98%
  const safeRows = computedRows.filter(
    (r) => r.combinedPercentLoad <= 98 && r.silicaPercentLoad <= 98 && r.condOut < 0.1 && r.silicaOut < 10
  );
  const maxSafeRowWithin98 = safeRows.length > 0 ? safeRows[safeRows.length - 1] : null;
  const firstCutoffRowAbove98 =
    computedRows.find(
      (r) => r.combinedPercentLoad > 98 || r.silicaPercentLoad > 98 || r.condOut >= 0.1 || r.silicaOut >= 10
    ) || null;

  const avgStepVol = totalVol > 0 ? totalVol / computedRows.length : 115;
  const predictedTotalCycleCount98 = firstCutoffRowAbove98
    ? maxSafeRowWithin98
      ? maxSafeRowWithin98.step
      : 1
    : avgStepVol > 0
    ? Math.max(computedRows.length, Math.floor(predictedCutoff98 / avgStepVol))
    : computedRows.length;

  return {
    rows: computedRows,
    condCapacity: cCap,
    silicaCapacity: sCap,
    resinCapacity: totalCap,
    rowCount: computedRows.length,
    conductivity: Number(avgCondIn.toFixed(4)),
    condOut: Math.max(0, lastRow.condOut),
    silica: Number(avgSilicaIn.toFixed(3)),
    silicaOut: Math.max(0, lastRow.silicaOut),
    cycleStart: 0,
    cycleEnd: totalVol,
    distance: totalVol,
    ionsRemoved: lastRow.cumulativeIonLoad,
    cumulativeIonLoad: lastRow.cumulativeIonLoad,
    condPercentLoad: lastRow.condPercentLoad,
    cumulativeSilicaLoad: lastRow.cumulativeSilicaLoad,
    silicaPercentLoad: lastRow.silicaPercentLoad,
    totalCombinedIonLoad: lastRow.totalCombinedIonLoad,
    combinedPercentLoad: lastRow.combinedPercentLoad,
    percentLoad: lastRow.combinedPercentLoad,
    predictedCycle: Number(Math.max(0, predictedCutoff98).toFixed(3)),
    predictedBreakthrough: Number(Math.max(0, predictedBreakthrough100).toFixed(3)),
    predictedSilicaCutoffCycle: Number(Math.max(0, predictedSilicaCutoffCycle).toFixed(3)),
    predictedCondCutoffCycle: Number(Math.max(0, predictedCondCutoffCycle).toFixed(3)),
    predictedTotalCycleCount98,
    maxSafeRowWithin98,
    firstCutoffRowAbove98,
  };
}

/**
 * Normalizes any CyclePredictionRecord (including legacy single-row records)
 * into a consistent Batch record with a populated `rows` array.
 */
export function normalizeCycleRecordToBatch(record: CyclePredictionRecord): CyclePredictionRecord & {
  rows: CycleRowItem[];
  batchName: string;
  condCapacity: number;
  silicaCapacity: number;
  resinCapacity: number;
  rowCount: number;
} {
  const batchName = (record.batchName || record.cycle || 'ชุดข้อมูลคาดการณ์ Cycle').trim();
  const isTrainB = record.train === 'B' || (!record.train && batchName.includes('B'));
  const defaultCond = isTrainB ? DEFAULT_TRAIN_B_COND_CAPACITY : DEFAULT_COND_CAPACITY;
  const defaultSilica = isTrainB ? DEFAULT_TRAIN_B_SILICA_CAPACITY : DEFAULT_SILICA_CAPACITY;

  const condCap =
    record.condCapacity && record.condCapacity > 0
      ? record.condCapacity
      : record.resinCapacity && record.resinCapacity > 10 && record.resinCapacity < 79
      ? record.resinCapacity
      : defaultCond;
  const silicaCap =
    record.silicaCapacity && record.silicaCapacity > 0
      ? record.silicaCapacity
      : defaultSilica;

  if (Array.isArray(record.rows) && record.rows.length > 0) {
    const recalc = recalculateBatchRows(
      record.rows.map((r) => ({
        rowId: r.rowId,
        label: r.label,
        cycleEnd: r.cycleEnd,
        condIn: r.condIn,
        condOut: r.condOut,
        silicaIn: r.silicaIn ?? 185.3,
        silicaOut: r.silicaOut ?? 1.0,
      })),
      condCap,
      true,
      false,
      silicaCap
    );
    return {
      ...record,
      batchName,
      condCapacity: recalc.condCapacity,
      silicaCapacity: recalc.silicaCapacity,
      resinCapacity: recalc.resinCapacity,
      rowCount: recalc.rows.length,
      rows: recalc.rows,
      conductivity: recalc.conductivity,
      condOut: recalc.condOut,
      silica: recalc.silica,
      silicaOut: recalc.silicaOut,
      cycleStart: 0,
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
    };
  }

  // Legacy single-row fallback
  const end = record.cycleEnd ?? record.predictedCycle ?? 156.81;
  const cIn = record.conductivity ?? 5.27;
  const cOut = record.condOut ?? 0.076;
  const sIn = record.silica ?? 185.3;
  const sOut = record.silicaOut ?? 1.0;

  const recalc = recalculateBatchRows(
    [
      {
        rowId: `${record.id}_row_1`,
        label: record.cycle || 'รอบย่อยที่ 1',
        cycleEnd: end,
        condIn: cIn,
        condOut: cOut,
        silicaIn: sIn,
        silicaOut: sOut,
      },
    ],
    condCap,
    true,
    false,
    silicaCap
  );

  return {
    ...record,
    batchName,
    condCapacity: recalc.condCapacity,
    silicaCapacity: recalc.silicaCapacity,
    resinCapacity: recalc.resinCapacity,
    rowCount: 1,
    rows: recalc.rows,
    cumulativeSilicaLoad: recalc.cumulativeSilicaLoad,
    silicaPercentLoad: recalc.silicaPercentLoad,
    totalCombinedIonLoad: recalc.totalCombinedIonLoad,
    combinedPercentLoad: recalc.combinedPercentLoad,
    percentLoad: recalc.percentLoad,
  };
}

// User Profile management
export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const now = new Date().toISOString();
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      const data: Record<string, unknown> = {
        userId: user.uid.slice(0, 128),
        email: (user.email || '').slice(0, 256),
        createdAt: now,
        updatedAt: now,
      };
      if (user.displayName) data.displayName = user.displayName.slice(0, 256);
      if (user.photoURL) data.photoURL = user.photoURL.slice(0, 2048);

      await setDoc(userRef, data);
    } else {
      const existingData = docSnap.data();
      const existingCreatedAt =
        typeof existingData?.createdAt === 'string' && existingData.createdAt.length <= 64
          ? existingData.createdAt
          : now;
      const existingEmail =
        typeof existingData?.email === 'string' ? existingData.email : '';
      const updateData: Record<string, unknown> = {
        userId: user.uid.slice(0, 128),
        createdAt: existingCreatedAt,
        updatedAt: now,
        email: (user.email || existingEmail || '').slice(0, 256),
      };
      if (user.displayName) updateData.displayName = user.displayName.slice(0, 256);
      if (user.photoURL) updateData.photoURL = user.photoURL.slice(0, 2048);

      await setDoc(userRef, updateData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Salt Records CRUD
export async function addSaltRecord(data: Omit<SaltRecord, 'id' | 'userId' | 'createdAt'>): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const recordId = generateValidId('salt');
  const path = `users/${currentUser.uid}/salt_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'salt_records', recordId);
    const payload: Record<string, unknown> = {
      userId: currentUser.uid,
      feed: data.feed,
      permeate: data.permeate,
      rejection: data.rejection,
      createdAt: new Date().toISOString(),
    };
    if (data.cycle && data.cycle.trim()) {
      payload.cycle = data.cycle.trim().slice(0, 128);
    }
    await setDoc(recordRef, payload);
    return recordId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
}

export async function deleteSaltRecord(recordId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/salt_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'salt_records', recordId);
    await deleteDoc(recordRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSaltRecord(
  recordId: string,
  existingCreatedAt: string,
  data: {
    feed: number;
    permeate: number;
    rejection: number;
    cycle?: string;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/salt_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'salt_records', recordId);
    const payload: Record<string, unknown> = {
      userId: currentUser.uid,
      feed: data.feed,
      permeate: data.permeate,
      rejection: data.rejection,
      createdAt: existingCreatedAt,
    };
    if (data.cycle && data.cycle.trim()) {
      payload.cycle = data.cycle.trim().slice(0, 128);
    }
    await setDoc(recordRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeSaltRecords(
  userId: string,
  onData: (records: SaltRecord[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/salt_records`;
  const recordsRef = collection(db, 'users', userId, 'salt_records');
  const q = query(recordsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: SaltRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        records.push({
          id: docSnap.id,
          userId: d.userId,
          feed: d.feed,
          permeate: d.permeate,
          rejection: d.rejection,
          cycle: d.cycle,
          createdAt: d.createdAt,
        });
      });
      onData(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

// Silica Records CRUD
export async function addSilicaRecord(data: Omit<SilicaRecord, 'id' | 'userId' | 'createdAt'>): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const recordId = generateValidId('silica');
  const path = `users/${currentUser.uid}/silica_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'silica_records', recordId);
    const payload: Record<string, unknown> = {
      userId: currentUser.uid,
      feed: data.feed,
      permeate: data.permeate,
      rejection: data.rejection,
      createdAt: new Date().toISOString(),
    };
    if (data.cycle && data.cycle.trim()) {
      payload.cycle = data.cycle.trim().slice(0, 128);
    }
    await setDoc(recordRef, payload);
    return recordId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
}

export async function deleteSilicaRecord(recordId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/silica_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'silica_records', recordId);
    await deleteDoc(recordRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSilicaRecord(
  recordId: string,
  existingCreatedAt: string,
  data: {
    feed: number;
    permeate: number;
    rejection: number;
    cycle?: string;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/silica_records/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'silica_records', recordId);
    const payload: Record<string, unknown> = {
      userId: currentUser.uid,
      feed: data.feed,
      permeate: data.permeate,
      rejection: data.rejection,
      createdAt: existingCreatedAt,
    };
    if (data.cycle && data.cycle.trim()) {
      payload.cycle = data.cycle.trim().slice(0, 128);
    }
    await setDoc(recordRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeSilicaRecords(
  userId: string,
  onData: (records: SilicaRecord[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/silica_records`;
  const recordsRef = collection(db, 'users', userId, 'silica_records');
  const q = query(recordsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: SilicaRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        records.push({
          id: docSnap.id,
          userId: d.userId,
          feed: d.feed,
          permeate: d.permeate,
          rejection: d.rejection,
          cycle: d.cycle,
          createdAt: d.createdAt,
        });
      });
      onData(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

// Helper to build clean Firestore payload for CyclePredictionRecord
function buildCycleFirestorePayload(
  userId: string,
  createdAt: string,
  data: Partial<Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'>> & {
    conductivity: number;
    predictedCycle: number;
  },
  isUpdate: boolean = false
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId,
    conductivity: Math.max(0, Number(data.conductivity) || 0),
    predictedCycle: Number(data.predictedCycle) || 0,
    createdAt,
  };
  if (isUpdate) {
    payload.updatedAt = new Date().toISOString();
  } else if (data.updatedAt) {
    payload.updatedAt = data.updatedAt.slice(0, 64);
  }

  const labelStr = (data.batchName || data.cycle || '').trim();
  if (labelStr) {
    payload.batchName = labelStr.slice(0, 256);
    payload.cycle = labelStr.slice(0, 128);
  }
  if (data.train && data.train.trim()) {
    payload.train = data.train.trim().slice(0, 32);
  }
  if (data.resinCapacity !== undefined && data.resinCapacity > 0) {
    payload.resinCapacity = Number(data.resinCapacity);
  }
  if (data.condCapacity !== undefined && data.condCapacity > 0) {
    payload.condCapacity = Number(data.condCapacity);
  }
  if (data.silicaCapacity !== undefined && data.silicaCapacity > 0) {
    payload.silicaCapacity = Number(data.silicaCapacity);
  }
  if (data.rowCount !== undefined && data.rowCount >= 0) {
    payload.rowCount = Number(data.rowCount);
  }
  if (Array.isArray(data.rows)) {
    payload.rows = data.rows.slice(0, 500).map((r, idx) => ({
      rowId: String(r.rowId || `row_${idx + 1}`).slice(0, 128),
      step: Number(r.step ?? idx + 1),
      label: String(r.label || `Step ${idx + 1}`).slice(0, 128),
      cycleStart: Number(r.cycleStart) || 0,
      cycleEnd: Number(r.cycleEnd) || 0,
      distance: Number(r.distance) || 0,
      condIn: Number(r.condIn) || 0,
      condOut: Number(r.condOut) || 0,
      concInMolL: Number(r.concInMolL) || 0,
      concInMolM3: Number(r.concInMolM3) || 0,
      concOutMolL: Number(r.concOutMolL) || 0,
      concOutMolM3: Number(r.concOutMolM3) || 0,
      ionsRemoved: Number(r.ionsRemoved) || 0,
      cumulativeIonLoad: Number(r.cumulativeIonLoad) || 0,
      condPercentLoad: Number(r.condPercentLoad) || 0,
      silicaIn: Number(r.silicaIn ?? 185.3),
      silicaOut: Number(r.silicaOut ?? 1.0),
      silicaConcInMolL: Number(r.silicaConcInMolL) || 0,
      silicaConcInMolM3: Number(r.silicaConcInMolM3) || 0,
      silicaConcOutMolL: Number(r.silicaConcOutMolL) || 0,
      silicaConcOutMolM3: Number(r.silicaConcOutMolM3) || 0,
      silicaIonsRemoved: Number(r.silicaIonsRemoved) || 0,
      cumulativeSilicaLoad: Number(r.cumulativeSilicaLoad) || 0,
      stepSilicaPlusCondLoad: Number(r.stepSilicaPlusCondLoad) || 0,
      silicaPercentLoad: Number(r.silicaPercentLoad) || 0,
      totalCombinedIonLoad: Number(r.totalCombinedIonLoad) || 0,
      combinedPercentLoad: Number(r.combinedPercentLoad) || 0,
      percentLoad: Number(r.percentLoad) || 0,
      predictedCycle: Number(r.predictedCycle) || 0,
    }));
    payload.rowCount = (payload.rows as unknown[]).length;
  }

  if (data.condOut !== undefined) payload.condOut = Math.max(0, Number(data.condOut) || 0);
  if (data.silica !== undefined) payload.silica = Number(data.silica) || 0;
  if (data.silicaOut !== undefined) payload.silicaOut = Number(data.silicaOut) || 0;
  if (data.cumulativeSilicaLoad !== undefined) payload.cumulativeSilicaLoad = Number(data.cumulativeSilicaLoad) || 0;
  if (data.silicaPercentLoad !== undefined) payload.silicaPercentLoad = Number(data.silicaPercentLoad) || 0;
  if (data.totalCombinedIonLoad !== undefined) payload.totalCombinedIonLoad = Number(data.totalCombinedIonLoad) || 0;
  if (data.combinedPercentLoad !== undefined) payload.combinedPercentLoad = Number(data.combinedPercentLoad) || 0;
  if (data.b0 !== undefined) payload.b0 = Number(data.b0);
  if (data.b1 !== undefined) payload.b1 = Number(data.b1);
  if (data.b2 !== undefined) payload.b2 = Number(data.b2);
  if (data.cycleStart !== undefined) payload.cycleStart = Math.max(0, Number(data.cycleStart) || 0);
  if (data.cycleEnd !== undefined) payload.cycleEnd = Math.max(0, Number(data.cycleEnd) || 0);
  if (data.distance !== undefined) payload.distance = Math.max(0, Number(data.distance) || 0);
  if (data.ionsRemoved !== undefined) payload.ionsRemoved = Number(data.ionsRemoved) || 0;
  if (data.cumulativeIonLoad !== undefined) payload.cumulativeIonLoad = Number(data.cumulativeIonLoad) || 0;
  if (data.percentLoad !== undefined) payload.percentLoad = Number(data.percentLoad) || 0;
  if (data.predictedBreakthrough !== undefined) payload.predictedBreakthrough = Number(data.predictedBreakthrough) || 0;

  return payload;
}

// Cycle Prediction Batch Records CRUD
export async function addCyclePrediction(
  data: Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const recordId = generateValidId('batch');
  const path = `users/${currentUser.uid}/cycle_predictions/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'cycle_predictions', recordId);
    const now = new Date().toISOString();
    const payload = buildCycleFirestorePayload(currentUser.uid, now, data, false);
    await setDoc(recordRef, payload);
    return recordId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
}

export async function deleteCyclePrediction(recordId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/cycle_predictions/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'cycle_predictions', recordId);
    await deleteDoc(recordRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateCyclePrediction(
  recordId: string,
  existingCreatedAt: string,
  data: Partial<Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'>> & {
    conductivity: number;
    predictedCycle: number;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const path = `users/${currentUser.uid}/cycle_predictions/${recordId}`;
  try {
    const recordRef = doc(db, 'users', currentUser.uid, 'cycle_predictions', recordId);
    const payload = buildCycleFirestorePayload(currentUser.uid, existingCreatedAt, data, true);
    await setDoc(recordRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a single row inside a saved Cycle Batch record.
 */
export async function deleteRowFromCloudBatch(
  batchRecord: CyclePredictionRecord,
  rowIdToDelete: string,
  isTh: boolean = true
): Promise<{ deletedEntireBatch: boolean; updatedBatch?: CyclePredictionRecord }> {
  const normalized = normalizeCycleRecordToBatch(batchRecord);
  const remainingInputs: CycleRowInput[] = normalized.rows
    .filter((r) => r.rowId !== rowIdToDelete)
    .map((r) => ({
      rowId: r.rowId,
      label: r.label,
      cycleEnd: r.cycleEnd,
      condIn: r.condIn,
      condOut: r.condOut,
      silicaIn: r.silicaIn,
      silicaOut: r.silicaOut,
    }));

  if (remainingInputs.length === 0) {
    await deleteCyclePrediction(batchRecord.id);
    return { deletedEntireBatch: true };
  }

  const recalc = recalculateBatchRows(
    remainingInputs,
    normalized.condCapacity,
    isTh,
    false,
    normalized.silicaCapacity
  );
  const updatedFields = {
    batchName: normalized.batchName,
    cycle: normalized.batchName,
    train: normalized.train,
    condCapacity: recalc.condCapacity,
    silicaCapacity: recalc.silicaCapacity,
    resinCapacity: recalc.resinCapacity,
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
  };

  await updateCyclePrediction(batchRecord.id, batchRecord.createdAt, updatedFields);
  return {
    deletedEntireBatch: false,
    updatedBatch: {
      ...batchRecord,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Updates a single row inside a saved Cycle Batch record and recalculates the entire batch.
 */
export async function updateRowInCloudBatch(
  batchRecord: CyclePredictionRecord,
  rowIdToUpdate: string,
  updatedRow: {
    label?: string;
    cycleEnd: number;
    condIn: number;
    condOut: number;
    silicaIn?: number;
    silicaOut?: number;
  },
  isTh: boolean = true
): Promise<CyclePredictionRecord> {
  const normalized = normalizeCycleRecordToBatch(batchRecord);
  const nextInputs: CycleRowInput[] = normalized.rows.map((r) =>
    r.rowId === rowIdToUpdate
      ? {
           rowId: r.rowId,
          label: updatedRow.label ?? r.label,
          cycleEnd: updatedRow.cycleEnd,
          condIn: updatedRow.condIn,
          condOut: updatedRow.condOut,
          silicaIn: updatedRow.silicaIn ?? r.silicaIn,
          silicaOut: updatedRow.silicaOut ?? r.silicaOut,
        }
      : {
          rowId: r.rowId,
          label: r.label,
          cycleEnd: r.cycleEnd,
          condIn: r.condIn,
          condOut: r.condOut,
          silicaIn: r.silicaIn,
          silicaOut: r.silicaOut,
        }
  );

  const recalc = recalculateBatchRows(
    nextInputs,
    normalized.condCapacity,
    isTh,
    false,
    normalized.silicaCapacity
  );
  const updatedFields = {
    batchName: normalized.batchName,
    cycle: normalized.batchName,
    train: normalized.train,
    condCapacity: recalc.condCapacity,
    silicaCapacity: recalc.silicaCapacity,
    resinCapacity: recalc.resinCapacity,
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
  };

  await updateCyclePrediction(batchRecord.id, batchRecord.createdAt, updatedFields);
  return {
    ...batchRecord,
    ...updatedFields,
    updatedAt: new Date().toISOString(),
  };
}

export function subscribeCyclePredictions(
  userId: string,
  onData: (records: CyclePredictionRecord[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/cycle_predictions`;
  const recordsRef = collection(db, 'users', userId, 'cycle_predictions');
  const q = query(recordsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: CyclePredictionRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        records.push({
          id: docSnap.id,
          userId: d.userId,
          batchName: d.batchName || d.cycle,
          train: d.train,
          resinCapacity: d.resinCapacity,
          condCapacity: d.condCapacity,
          silicaCapacity: d.silicaCapacity,
          rowCount: d.rowCount,
          rows: Array.isArray(d.rows) ? d.rows : undefined,
          conductivity: d.conductivity,
          condOut: d.condOut,
          silica: d.silica,
          silicaOut: d.silicaOut,
          cumulativeSilicaLoad: d.cumulativeSilicaLoad,
          silicaPercentLoad: d.silicaPercentLoad,
          totalCombinedIonLoad: d.totalCombinedIonLoad,
          combinedPercentLoad: d.combinedPercentLoad,
          b0: d.b0,
          b1: d.b1,
          b2: d.b2,
          predictedCycle: d.predictedCycle,
          predictedBreakthrough: d.predictedBreakthrough,
          cycleStart: d.cycleStart,
          cycleEnd: d.cycleEnd,
          distance: d.distance,
          ionsRemoved: d.ionsRemoved,
          cumulativeIonLoad: d.cumulativeIonLoad,
          percentLoad: d.percentLoad,
          cycle: d.cycle || d.batchName,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      });
      onData(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}
