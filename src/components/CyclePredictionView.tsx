import React, { useState, useMemo, useEffect } from 'react';
import {
  ChartNoAxesCombined,
  Save,
  Trash2,
  Download,
  AlertTriangle,
  RotateCcw,
  Layers,
  Gauge,
  Info,
  Plus,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  History,
  FolderOpen,
  Pencil,
  X,
  CopyPlus,
  LayoutGrid,
  Table as TableIcon,
  OctagonAlert,
  BellRing,
  Droplets,
  ArrowUpRight,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CyclePredictionRecord,
  CycleRowInput,
  DEFAULT_COND_CAPACITY,
  DEFAULT_SILICA_CAPACITY,
  DEFAULT_TRAIN_B_COND_CAPACITY,
  DEFAULT_TRAIN_B_SILICA_CAPACITY,
  LAMBDA_0_NACL,
  MOLAR_MASS_SIO2,
  recalculateBatchRows,
  isNonPhysicalCycleRow,
  normalizeCycleRecordToBatch,
  addCyclePrediction,
  updateCyclePrediction,
  deleteCyclePrediction,
  updateRowInCloudBatch,
  generateValidId,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ConfirmModal } from './ConfirmModal';
import {
  ExportDataMenu,
  ExportFormat,
  exportBatchesToFile,
  convertRecordsToExportPayloads,
} from '../utils/exportData';

export interface DatabaseStorageCounts {
  salt: number;
  silica: number;
  cycle: number;
  total: number;
}

interface CyclePredictionViewProps {
  records: CyclePredictionRecord[];
  allRecordsCount?: DatabaseStorageCounts;
  onAddLocalRecord: (record: Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'>) => string | void;
  onUpdateLocalRecord?: (id: string, updated: Partial<CyclePredictionRecord>) => void;
  onDeleteLocalRecord: (id: string) => void;
  onClearAllLocal: () => void;
  onOpenAuth: () => void;
  externalBatchToLoad?: CyclePredictionRecord | null;
  onClearExternalBatch?: () => void;
}

// Benchmark data of North Bangkok Power Plant Block 1 Train A - Set 1 (15 cycles)
export const PLANT_TRAIN_A_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 156.81, condIn: 5.27, condOut: 0.076, silicaIn: 185.3, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 378.97, condIn: 5.62, condOut: 0.074, silicaIn: 189.2, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 718.03, condIn: 5.69, condOut: 0.075, silicaIn: 188.3, silicaOut: 1.0, label: 'รอบที่ 3' },
  { cycleEnd: 977.47, condIn: 5.98, condOut: 0.078, silicaIn: 197.63, silicaOut: 1.0, label: 'รอบที่ 4' },
  { cycleEnd: 1234.41, condIn: 5.47, condOut: 0.089, silicaIn: 193.4, silicaOut: 0.13, label: 'รอบที่ 5' },
  { cycleEnd: 1496.93, condIn: 5.26, condOut: 0.087, silicaIn: 226.87, silicaOut: 1.0, label: 'รอบที่ 6' },
  { cycleEnd: 1537.45, condIn: 5.34, condOut: 0.086, silicaIn: 210.66, silicaOut: 1.0, label: 'รอบที่ 7' },
  { cycleEnd: 1621.3, condIn: 5.27, condOut: 0.098, silicaIn: 188.32, silicaOut: 2.3, label: 'รอบที่ 8' },
  { cycleEnd: 1647.46, condIn: 5.32, condOut: 0.097, silicaIn: 192.04, silicaOut: 1.57, label: 'รอบที่ 9' },
  { cycleEnd: 1659.97, condIn: 5.41, condOut: 0.099, silicaIn: 235.62, silicaOut: 3.08, label: 'รอบที่ 10' },
  { cycleEnd: 1683.21, condIn: 5.42, condOut: 0.098, silicaIn: 212.42, silicaOut: 4.65, label: 'รอบที่ 11' },
  { cycleEnd: 1689.84, condIn: 5.35, condOut: 0.099, silicaIn: 228.87, silicaOut: 8.45, label: 'รอบที่ 12' },
  { cycleEnd: 1699.36, condIn: 5.73, condOut: 0.099, silicaIn: 199.65, silicaOut: 5.58, label: 'รอบที่ 13' },
  { cycleEnd: 1707.27, condIn: 5.33, condOut: 0.099, silicaIn: 223.51, silicaOut: 6.4, label: 'รอบที่ 14' },
  { cycleEnd: 1728.29, condIn: 6.13, condOut: 0.108, silicaIn: 229.1, silicaOut: 30.05, label: 'รอบที่ 15' },
];

// Benchmark data of Train A - Set 2 (40 cycles, Max Safe Volume before 98% = 1,861.28 m³ at Cycle 34)
export const PLANT_TRAIN_A_SET2_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 48.34, condIn: 4.796, condOut: 0.07, silicaIn: 167.56, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 52.49, condIn: 4.607, condOut: 0.07, silicaIn: 163.72, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 62.33, condIn: 5.624, condOut: 0.074, silicaIn: 177.0, silicaOut: 1.0, label: 'รอบที่ 3' },
  { cycleEnd: 64.23, condIn: 4.872, condOut: 0.07, silicaIn: 169.58, silicaOut: 1.0, label: 'รอบที่ 4' },
  { cycleEnd: 74.03, condIn: 5.56, condOut: 0.071, silicaIn: 158.25, silicaOut: 1.0, label: 'รอบที่ 5' },
  { cycleEnd: 95.32, condIn: 6.603, condOut: 0.079, silicaIn: 179.39, silicaOut: 0.4, label: 'รอบที่ 6' },
  { cycleEnd: 168.45, condIn: 5.285, condOut: 0.071, silicaIn: 168.45, silicaOut: 1.0, label: 'รอบที่ 7' },
  { cycleEnd: 191.4, condIn: 4.903, condOut: 0.07, silicaIn: 235.01, silicaOut: 1.0, label: 'รอบที่ 8' },
  { cycleEnd: 231.38, condIn: 4.173, condOut: 0.07, silicaIn: 150.47, silicaOut: 1.0, label: 'รอบที่ 9' },
  { cycleEnd: 402.23, condIn: 4.102, condOut: 0.073, silicaIn: 171.61, silicaOut: 1.0, label: 'รอบที่ 10' },
  { cycleEnd: 639.93, condIn: 4.063, condOut: 0.07, silicaIn: 174.96, silicaOut: 1.0, label: 'รอบที่ 11' },
  { cycleEnd: 915.9, condIn: 4.048, condOut: 0.07, silicaIn: 169.65, silicaOut: 1.0, label: 'รอบที่ 12' },
  { cycleEnd: 1022.8, condIn: 4.4, condOut: 0.074, silicaIn: 154.33, silicaOut: 1.0, label: 'รอบที่ 13' },
  { cycleEnd: 1076.87, condIn: 4.83, condOut: 0.08, silicaIn: 177.64, silicaOut: 1.0, label: 'รอบที่ 14' },
  { cycleEnd: 1137.25, condIn: 5.34, condOut: 0.08, silicaIn: 195.05, silicaOut: 1.0, label: 'รอบที่ 15' },
  { cycleEnd: 1198.47, condIn: 5.776, condOut: 0.079, silicaIn: 219.46, silicaOut: 1.0, label: 'รอบที่ 16' },
  { cycleEnd: 1282.95, condIn: 6.264, condOut: 0.085, silicaIn: 182.11, silicaOut: 1.0, label: 'รอบที่ 17' },
  { cycleEnd: 1549.68, condIn: 5.49, condOut: 0.079, silicaIn: 176.3, silicaOut: 1.0, label: 'รอบที่ 18' },
  { cycleEnd: 1727.36, condIn: 6.184, condOut: 0.086, silicaIn: 206.4, silicaOut: 1.0, label: 'รอบที่ 19' },
  { cycleEnd: 1740.53, condIn: 6.108, condOut: 0.08, silicaIn: 227.64, silicaOut: 1.53, label: 'รอบที่ 20' },
  { cycleEnd: 1747.3, condIn: 5.319, condOut: 0.08, silicaIn: 225.01, silicaOut: 1.05, label: 'รอบที่ 21' },
  { cycleEnd: 1753.96, condIn: 5.235, condOut: 0.078, silicaIn: 203.96, silicaOut: 1.34, label: 'รอบที่ 22' },
  { cycleEnd: 1762.38, condIn: 5.015, condOut: 0.071, silicaIn: 205.45, silicaOut: 1.0, label: 'รอบที่ 23' },
  { cycleEnd: 1768.99, condIn: 5.12, condOut: 0.074, silicaIn: 205.54, silicaOut: 2.76, label: 'รอบที่ 24' },
  { cycleEnd: 1775.96, condIn: 5.214, condOut: 0.073, silicaIn: 206.1, silicaOut: 0.7, label: 'รอบที่ 25' },
  { cycleEnd: 1791.76, condIn: 4.958, condOut: 0.075, silicaIn: 192.82, silicaOut: 0.96, label: 'รอบที่ 26' },
  { cycleEnd: 1796.84, condIn: 5.257, condOut: 0.074, silicaIn: 200.43, silicaOut: 1.0, label: 'รอบที่ 27' },
  { cycleEnd: 1802.08, condIn: 5.189, condOut: 0.072, silicaIn: 198.53, silicaOut: 1.0, label: 'รอบที่ 28' },
  { cycleEnd: 1809.09, condIn: 5.262, condOut: 0.072, silicaIn: 202.41, silicaOut: 1.0, label: 'รอบที่ 29' },
  { cycleEnd: 1817.58, condIn: 5.253, condOut: 0.071, silicaIn: 203.55, silicaOut: 1.0, label: 'รอบที่ 30' },
  { cycleEnd: 1837.3, condIn: 5.202, condOut: 0.071, silicaIn: 209.14, silicaOut: 3.61, label: 'รอบที่ 31' },
  { cycleEnd: 1845.85, condIn: 5.347, condOut: 0.071, silicaIn: 207.39, silicaOut: 2.74, label: 'รอบที่ 32' },
  { cycleEnd: 1854.36, condIn: 5.262, condOut: 0.07, silicaIn: 194.68, silicaOut: 1.0, label: 'รอบที่ 33' },
  { cycleEnd: 1861.28, condIn: 5.032, condOut: 0.071, silicaIn: 208.91, silicaOut: 1.0, label: 'รอบที่ 34' },
  { cycleEnd: 1867.73, condIn: 5.195, condOut: 0.07, silicaIn: 206.71, silicaOut: 1.0, label: 'รอบที่ 35' },
  { cycleEnd: 1875.22, condIn: 5.427, condOut: 0.07, silicaIn: 208.95, silicaOut: 2.09, label: 'รอบที่ 36' },
  { cycleEnd: 1881.95, condIn: 5.161, condOut: 0.07, silicaIn: 207.18, silicaOut: 4.4, label: 'รอบที่ 37' },
  { cycleEnd: 1890.63, condIn: 5.295, condOut: 0.07, silicaIn: 218.29, silicaOut: 6.14, label: 'รอบที่ 38' },
  { cycleEnd: 1897.17, condIn: 5.215, condOut: 0.07, silicaIn: 202.72, silicaOut: 5.75, label: 'รอบที่ 39' },
  { cycleEnd: 1902.84, condIn: 5.159, condOut: 0.07, silicaIn: 204.52, silicaOut: 39.26, label: 'รอบที่ 40' },
];

// Benchmark data of Train A - Set 3 (24 cycles, 204.49 to 1,771.10 m³)
export const PLANT_TRAIN_A_SET3_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 204.49, condIn: 5.383, condOut: 0.071, silicaIn: 221.83, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 395.28, condIn: 5.686, condOut: 0.07, silicaIn: 183.07, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 678.32, condIn: 5.532, condOut: 0.07, silicaIn: 184.12, silicaOut: 1.0, label: 'รอบที่ 3' },
  { cycleEnd: 758.69, condIn: 5.396, condOut: 0.071, silicaIn: 185.48, silicaOut: 1.0, label: 'รอบที่ 4' },
  { cycleEnd: 926.32, condIn: 5.276, condOut: 0.071, silicaIn: 221.45, silicaOut: 1.0, label: 'รอบที่ 5' },
  { cycleEnd: 1206.37, condIn: 5.352, condOut: 0.072, silicaIn: 223.48, silicaOut: 1.0, label: 'รอบที่ 6' },
  { cycleEnd: 1585.24, condIn: 4.994, condOut: 0.071, silicaIn: 217.37, silicaOut: 1.0, label: 'รอบที่ 7' },
  { cycleEnd: 1625.79, condIn: 4.969, condOut: 0.071, silicaIn: 215.64, silicaOut: 1.0, label: 'รอบที่ 8' },
  { cycleEnd: 1634.71, condIn: 4.953, condOut: 0.071, silicaIn: 231.41, silicaOut: 1.0, label: 'รอบที่ 9' },
  { cycleEnd: 1642.56, condIn: 5.067, condOut: 0.07, silicaIn: 226.64, silicaOut: 0.14, label: 'รอบที่ 10' },
  { cycleEnd: 1649.89, condIn: 4.969, condOut: 0.071, silicaIn: 233.46, silicaOut: 4.57, label: 'รอบที่ 11' },
  { cycleEnd: 1656.58, condIn: 4.902, condOut: 0.07, silicaIn: 225.73, silicaOut: 1.0, label: 'รอบที่ 12' },
  { cycleEnd: 1665.41, condIn: 4.843, condOut: 0.071, silicaIn: 235.32, silicaOut: 2.37, label: 'รอบที่ 13' },
  { cycleEnd: 1672.03, condIn: 4.911, condOut: 0.07, silicaIn: 231.45, silicaOut: 1.0, label: 'รอบที่ 14' },
  { cycleEnd: 1692.39, condIn: 5.583, condOut: 0.073, silicaIn: 232.97, silicaOut: 0.9, label: 'รอบที่ 15' },
  { cycleEnd: 1698.83, condIn: 5.282, condOut: 0.074, silicaIn: 201.37, silicaOut: 1.0, label: 'รอบที่ 16' },
  { cycleEnd: 1708.44, condIn: 5.158, condOut: 0.08, silicaIn: 188.45, silicaOut: 1.35, label: 'รอบที่ 17' },
  { cycleEnd: 1719.95, condIn: 5.161, condOut: 0.081, silicaIn: 179.53, silicaOut: 1.0, label: 'รอบที่ 18' },
  { cycleEnd: 1729.39, condIn: 5.131, condOut: 0.08, silicaIn: 175.41, silicaOut: 1.0, label: 'รอบที่ 19' },
  { cycleEnd: 1736.69, condIn: 5.214, condOut: 0.097, silicaIn: 174.3, silicaOut: 2.13, label: 'รอบที่ 20' },
  { cycleEnd: 1744.74, condIn: 5.161, condOut: 0.098, silicaIn: 183.81, silicaOut: 3.71, label: 'รอบที่ 21' },
  { cycleEnd: 1754.97, condIn: 5.237, condOut: 0.098, silicaIn: 173.43, silicaOut: 4.9, label: 'รอบที่ 22' },
  { cycleEnd: 1762.06, condIn: 5.334, condOut: 0.097, silicaIn: 179.81, silicaOut: 6.8, label: 'รอบที่ 23' },
  { cycleEnd: 1771.1, condIn: 5.156, condOut: 0.099, silicaIn: 178.68, silicaOut: 10.38, label: 'รอบที่ 24' },
];

// Benchmark data of North Bangkok Power Plant Block 1 Train B - Set 1 (25 cycles, 16.93 to 2,014.38 m³)
export const PLANT_TRAIN_B_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 16.93, condIn: 6.82, condOut: 0.075, silicaIn: 221.43, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 165.25, condIn: 7.47, condOut: 0.076, silicaIn: 233.8, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 384.08, condIn: 7.26, condOut: 0.074, silicaIn: 145.67, silicaOut: 1.0, label: 'รอบที่ 3' },
  { cycleEnd: 719.41, condIn: 7.32, condOut: 0.077, silicaIn: 160.66, silicaOut: 1.0, label: 'รอบที่ 4' },
  { cycleEnd: 1013.79, condIn: 7.63, condOut: 0.075, silicaIn: 171.3, silicaOut: 0.7, label: 'รอบที่ 5' },
  { cycleEnd: 1252.84, condIn: 7.27, condOut: 0.079, silicaIn: 218.07, silicaOut: 1.0, label: 'รอบที่ 6' },
  { cycleEnd: 1588.84, condIn: 5.71, condOut: 0.078, silicaIn: 149.74, silicaOut: 1.0, label: 'รอบที่ 7' },
  { cycleEnd: 1711.38, condIn: 5.27, condOut: 0.077, silicaIn: 222.29, silicaOut: 1.0, label: 'รอบที่ 8' },
  { cycleEnd: 1814.01, condIn: 6.24, condOut: 0.079, silicaIn: 137.8, silicaOut: 1.0, label: 'รอบที่ 9' },
  { cycleEnd: 1826.27, condIn: 6.28, condOut: 0.078, silicaIn: 153.62, silicaOut: 0.74, label: 'รอบที่ 10' },
  { cycleEnd: 1843.36, condIn: 6.3, condOut: 0.076, silicaIn: 146.26, silicaOut: 1.0, label: 'รอบที่ 11' },
  { cycleEnd: 1863.37, condIn: 5.97, condOut: 0.076, silicaIn: 224.48, silicaOut: 1.0, label: 'รอบที่ 12' },
  { cycleEnd: 1876.59, condIn: 5.84, condOut: 0.079, silicaIn: 125.0, silicaOut: 1.0, label: 'รอบที่ 13' },
  { cycleEnd: 1882.71, condIn: 5.2, condOut: 0.075, silicaIn: 146.97, silicaOut: 1.0, label: 'รอบที่ 14' },
  { cycleEnd: 1895.85, condIn: 5.78, condOut: 0.076, silicaIn: 146.87, silicaOut: 1.0, label: 'รอบที่ 15' },
  { cycleEnd: 1904.41, condIn: 5.32, condOut: 0.077, silicaIn: 151.24, silicaOut: 0.58, label: 'รอบที่ 16' },
  { cycleEnd: 1911.57, condIn: 5.4, condOut: 0.076, silicaIn: 232.85, silicaOut: 1.0, label: 'รอบที่ 17' },
  { cycleEnd: 1926.14, condIn: 5.95, condOut: 0.077, silicaIn: 236.9, silicaOut: 0.03, label: 'รอบที่ 18' },
  { cycleEnd: 1939.49, condIn: 5.41, condOut: 0.076, silicaIn: 214.4, silicaOut: 1.0, label: 'รอบที่ 19' },
  { cycleEnd: 1956.19, condIn: 5.79, condOut: 0.076, silicaIn: 229.15, silicaOut: 0.73, label: 'รอบที่ 20' },
  { cycleEnd: 1971.6, condIn: 5.7, condOut: 0.077, silicaIn: 224.43, silicaOut: 1.0, label: 'รอบที่ 21' },
  { cycleEnd: 1987.07, condIn: 5.78, condOut: 0.077, silicaIn: 223.04, silicaOut: 6.91, label: 'รอบที่ 22' },
  { cycleEnd: 2002.7, condIn: 5.81, condOut: 0.077, silicaIn: 231.89, silicaOut: 8.05, label: 'รอบที่ 23' },
  { cycleEnd: 2008.43, condIn: 5.63, condOut: 0.076, silicaIn: 243.85, silicaOut: 8.69, label: 'รอบที่ 24' },
  { cycleEnd: 2014.38, condIn: 5.61, condOut: 0.076, silicaIn: 239.41, silicaOut: 10.1, label: 'รอบที่ 25' },
];

// Benchmark data of Train B - Set 2 (38 cycles, 32.60 to 2,104.16 m³)
export const PLANT_TRAIN_B_SET2_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 32.6, condIn: 4.504, condOut: 0.079, silicaIn: 234.15, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 115.74, condIn: 4.658, condOut: 0.08, silicaIn: 259.45, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 297.82, condIn: 4.577, condOut: 0.08, silicaIn: 238.63, silicaOut: 1.0, label: 'รอบที่ 3' },
  { cycleEnd: 379.23, condIn: 4.638, condOut: 0.079, silicaIn: 226.23, silicaOut: 1.0, label: 'รอบที่ 4' },
  { cycleEnd: 516.95, condIn: 4.521, condOut: 0.079, silicaIn: 241.42, silicaOut: 1.0, label: 'รอบที่ 5' },
  { cycleEnd: 781.48, condIn: 4.531, condOut: 0.079, silicaIn: 229.87, silicaOut: 1.0, label: 'รอบที่ 6' },
  { cycleEnd: 849.32, condIn: 4.642, condOut: 0.079, silicaIn: 253.89, silicaOut: 1.0, label: 'รอบที่ 7' },
  { cycleEnd: 1068.91, condIn: 4.727, condOut: 0.079, silicaIn: 233.34, silicaOut: 1.0, label: 'รอบที่ 8' },
  { cycleEnd: 1229.66, condIn: 4.73, condOut: 0.079, silicaIn: 254.23, silicaOut: 1.0, label: 'รอบที่ 9' },
  { cycleEnd: 1485.93, condIn: 4.845, condOut: 0.086, silicaIn: 228.74, silicaOut: 1.0, label: 'รอบที่ 10' },
  { cycleEnd: 1689.34, condIn: 4.722, condOut: 0.084, silicaIn: 239.93, silicaOut: 1.35, label: 'รอบที่ 11' },
  { cycleEnd: 1794.78, condIn: 4.703, condOut: 0.083, silicaIn: 246.37, silicaOut: 1.26, label: 'รอบที่ 12' },
  { cycleEnd: 1826.26, condIn: 4.63, condOut: 0.079, silicaIn: 243.82, silicaOut: 1.0, label: 'รอบที่ 13' },
  { cycleEnd: 1842.57, condIn: 4.504, condOut: 0.08, silicaIn: 233.34, silicaOut: 1.0, label: 'รอบที่ 14' },
  { cycleEnd: 1863.1, condIn: 4.658, condOut: 0.079, silicaIn: 234.63, silicaOut: 1.0, label: 'รอบที่ 15' },
  { cycleEnd: 1867.81, condIn: 4.577, condOut: 0.079, silicaIn: 228.74, silicaOut: 1.0, label: 'รอบที่ 16' },
  { cycleEnd: 1882.33, condIn: 4.638, condOut: 0.079, silicaIn: 239.93, silicaOut: 1.35, label: 'รอบที่ 17' },
  { cycleEnd: 1895.17, condIn: 4.535, condOut: 0.079, silicaIn: 246.37, silicaOut: 1.26, label: 'รอบที่ 18' },
  { cycleEnd: 1908.37, condIn: 4.647, condOut: 0.079, silicaIn: 241.81, silicaOut: 1.42, label: 'รอบที่ 19' },
  { cycleEnd: 1922.47, condIn: 4.431, condOut: 0.079, silicaIn: 174.88, silicaOut: 1.4, label: 'รอบที่ 20' },
  { cycleEnd: 1937.73, condIn: 4.342, condOut: 0.079, silicaIn: 153.77, silicaOut: 1.0, label: 'รอบที่ 21' },
  { cycleEnd: 1952.3, condIn: 4.545, condOut: 0.079, silicaIn: 159.52, silicaOut: 1.0, label: 'รอบที่ 22' },
  { cycleEnd: 1964.3, condIn: 4.401, condOut: 0.079, silicaIn: 178.56, silicaOut: 1.0, label: 'รอบที่ 23' },
  { cycleEnd: 1977.88, condIn: 4.475, condOut: 0.079, silicaIn: 167.85, silicaOut: 1.17, label: 'รอบที่ 24' },
  { cycleEnd: 2004.51, condIn: 4.769, condOut: 0.084, silicaIn: 253.9, silicaOut: 1.02, label: 'รอบที่ 25' },
  { cycleEnd: 2021.17, condIn: 4.727, condOut: 0.086, silicaIn: 222.87, silicaOut: 1.0, label: 'รอบที่ 26' },
  { cycleEnd: 2026.1, condIn: 4.734, condOut: 0.084, silicaIn: 262.73, silicaOut: 1.0, label: 'รอบที่ 27' },
  { cycleEnd: 2033.4, condIn: 4.72, condOut: 0.083, silicaIn: 247.92, silicaOut: 1.0, label: 'รอบที่ 28' },
  { cycleEnd: 2040.69, condIn: 4.695, condOut: 0.083, silicaIn: 249.6, silicaOut: 1.49, label: 'รอบที่ 29' },
  { cycleEnd: 2047.48, condIn: 4.722, condOut: 0.084, silicaIn: 247.36, silicaOut: 1.08, label: 'รอบที่ 30' },
  { cycleEnd: 2056.19, condIn: 4.703, condOut: 0.083, silicaIn: 250.48, silicaOut: 1.25, label: 'รอบที่ 31' },
  { cycleEnd: 2063.73, condIn: 4.589, condOut: 0.082, silicaIn: 216.95, silicaOut: 1.0, label: 'รอบที่ 32' },
  { cycleEnd: 2068.83, condIn: 4.715, condOut: 0.082, silicaIn: 245.86, silicaOut: 1.0, label: 'รอบที่ 33' },
  { cycleEnd: 2077.02, condIn: 4.815, condOut: 0.082, silicaIn: 244.67, silicaOut: 3.87, label: 'รอบที่ 34' },
  { cycleEnd: 2081.99, condIn: 4.685, condOut: 0.083, silicaIn: 241.43, silicaOut: 2.31, label: 'รอบที่ 35' },
  { cycleEnd: 2090.64, condIn: 4.768, condOut: 0.083, silicaIn: 251.88, silicaOut: 6.02, label: 'รอบที่ 36' },
  { cycleEnd: 2096.01, condIn: 4.657, condOut: 0.083, silicaIn: 236.35, silicaOut: 6.82, label: 'รอบที่ 37' },
  { cycleEnd: 2104.16, condIn: 4.415, condOut: 0.086, silicaIn: 268.25, silicaOut: 10.36, label: 'รอบที่ 38' },
];

// Benchmark data of Train B - Set 3 (6 cycles, 3.48 to 1,938.47 m³)
export const PLANT_TRAIN_B_SET3_BENCHMARK: CycleRowInput[] = [
  { cycleEnd: 3.48, condIn: 5.65, condOut: 0.076, silicaIn: 276.0, silicaOut: 1.0, label: 'รอบที่ 1' },
  { cycleEnd: 53.83, condIn: 5.69, condOut: 0.076, silicaIn: 269.0, silicaOut: 1.0, label: 'รอบที่ 2' },
  { cycleEnd: 60.6, condIn: 5.7, condOut: 0.079, silicaIn: 301.0, silicaOut: 0.07, label: 'รอบที่ 3' },
  { cycleEnd: 980.77, condIn: 5.21, condOut: 0.08, silicaIn: 219.0, silicaOut: 1.53, label: 'รอบที่ 4' },
  { cycleEnd: 1930.24, condIn: 5.74, condOut: 0.096, silicaIn: 216.0, silicaOut: 2.56, label: 'รอบที่ 5' },
  { cycleEnd: 1938.47, condIn: 5.66, condOut: 0.01, silicaIn: 221.83, silicaOut: 65.0, label: 'รอบที่ 6' },
];

const WORKSPACE_DRAFT_KEY = 'mb_toolkit_cycle_workspace_draft_v10';

type TrainId = 'A' | 'B';

type FormulaTargetId =
  | 'cond_dv'
  | 'cond_in_mol_l'
  | 'cond_in_mol_m3'
  | 'cond_out_mol_l'
  | 'cond_out_mol_m3'
  | 'cond_delta'
  | 'cond_wa'
  | 'cond_removed'
  | 'cond_cum_load'
  | 'cond_pct_load'
  | 'silica_dv'
  | 'silica_in_mol_l'
  | 'silica_in_mol_m3'
  | 'silica_out_mol_l'
  | 'silica_out_mol_m3'
  | 'silica_delta'
  | 'silica_wa'
  | 'silica_removed'
  | 'silica_cum_load'
  | 'silica_pct_load'
  | 'pred_total_wa'
  | 'pred_warn_90'
  | 'pred_stop_95';

interface SingleTrainWorkspace {
  editingBatchId: string | null;
  editingBatchCreatedAt: string | null;
  batchName: string;
  condCapacity: string;
  silicaCapacity: string;
  rows: CycleRowInput[];
  inputCycle: string;
  inputCondIn: string;
  inputCondOut: string;
  inputSilicaIn: string;
  inputSilicaOut: string;
  inputLabel: string;
}

interface MultiTrainWorkspaceDraft {
  activeTrain: TrainId;
  trains: Record<TrainId, SingleTrainWorkspace>;
}

function createDefaultTrainWorkspace(t: TrainId): SingleTrainWorkspace {
  return {
    editingBatchId: null,
    editingBatchCreatedAt: null,
    batchName: `ชุดที่ 1 - Train ${t}`,
    condCapacity:
      t === 'B' ? DEFAULT_TRAIN_B_COND_CAPACITY.toString() : DEFAULT_COND_CAPACITY.toString(),
    silicaCapacity:
      t === 'B' ? DEFAULT_TRAIN_B_SILICA_CAPACITY.toString() : DEFAULT_SILICA_CAPACITY.toString(),
    rows: [],
    inputCycle: '',
    inputCondIn: '',
    inputCondOut: '',
    inputSilicaIn: '',
    inputSilicaOut: '',
    inputLabel: 'รอบที่ 1',
  };
}

export const CyclePredictionView: React.FC<CyclePredictionViewProps> = ({
  records,
  onAddLocalRecord,
  onUpdateLocalRecord,
  onDeleteLocalRecord,
  externalBatchToLoad,
  onClearExternalBatch,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTh = language === 'th';

  const savedBatches = useMemo(() => {
    return records.map((r) => normalizeCycleRecordToBatch(r));
  }, [records]);

  const savedBatchesTrainA = useMemo(() => {
    return savedBatches.filter((b) => (b.train || (b.batchName.includes('B') ? 'B' : 'A')) === 'A');
  }, [savedBatches]);

  const savedBatchesTrainB = useMemo(() => {
    return savedBatches.filter((b) => (b.train || (b.batchName.includes('B') ? 'B' : 'A')) === 'B');
  }, [savedBatches]);

  const legacySingleRowRecords = useMemo(() => {
    return records.filter((r) => !Array.isArray(r.rows) || r.rows.length <= 1);
  }, [records]);

  const [activeTrain, setActiveTrain] = useState<TrainId>(() => {
    try {
      const saved = localStorage.getItem(WORKSPACE_DRAFT_KEY);
      if (saved) {
        const parsed: MultiTrainWorkspaceDraft = JSON.parse(saved);
        if (parsed.activeTrain === 'A' || parsed.activeTrain === 'B') return parsed.activeTrain;
      }
    } catch {
      // ignore
    }
    return 'A';
  });

  const [trainWorkspaces, setTrainWorkspaces] = useState<Record<TrainId, SingleTrainWorkspace>>(() => {
    const defA = createDefaultTrainWorkspace('A');
    const defB = createDefaultTrainWorkspace('B');
    try {
      const saved = localStorage.getItem(WORKSPACE_DRAFT_KEY);
      if (saved) {
        const parsed: MultiTrainWorkspaceDraft = JSON.parse(saved);
        if (parsed && parsed.trains) {
          const loadedB = { ...defB, ...(parsed.trains.B || {}) };
          // Automatically upgrade legacy 15-row Train B Set 1 draft to the full 25-row Train B Set 1 dataset
          if (
            Array.isArray(loadedB.rows) &&
            loadedB.rows.length === 15 &&
            loadedB.rows[0]?.cycleEnd === 16.93 &&
            loadedB.rows[14]?.cycleEnd === 2014.38
          ) {
            loadedB.rows = PLANT_TRAIN_B_BENCHMARK.map((r, i) => ({
              ...r,
              rowId: generateValidId(`bm_B1_${i + 1}`),
            }));
            loadedB.batchName = 'ชุดที่ 1 - Train B (25 รอบ)';
          }
          return {
            A: { ...defA, ...(parsed.trains.A || {}) },
            B: loadedB,
          };
        }
      }
    } catch {
      // ignore
    }
    return { A: defA, B: defB };
  });

  const train = activeTrain;
  const currentTrainState = trainWorkspaces[activeTrain];
  const editingBatchId = currentTrainState.editingBatchId;
  const editingBatchCreatedAt = currentTrainState.editingBatchCreatedAt;
  const batchName = currentTrainState.batchName;
  const condCapacity = currentTrainState.condCapacity;
  const silicaCapacity = currentTrainState.silicaCapacity;
  const workingInputs = currentTrainState.rows;
  const inputCycle = currentTrainState.inputCycle;
  const inputCondIn = currentTrainState.inputCondIn;
  const inputCondOut = currentTrainState.inputCondOut;
  const inputSilicaIn = currentTrainState.inputSilicaIn;
  const inputSilicaOut = currentTrainState.inputSilicaOut;
  const inputLabel = currentTrainState.inputLabel;

  const updateTrainWorkspace = (
    targetTrain: TrainId,
    updater:
      | Partial<SingleTrainWorkspace>
      | ((prev: SingleTrainWorkspace) => Partial<SingleTrainWorkspace>)
  ) => {
    setTrainWorkspaces((prev) => {
      const curr = prev[targetTrain];
      const patch = typeof updater === 'function' ? updater(curr) : updater;
      return {
        ...prev,
        [targetTrain]: {
          ...curr,
          ...patch,
        },
      };
    });
  };

  const setTrain = (nextTrain: TrainId) => setActiveTrain(nextTrain);
  const setEditingBatchId = (val: string | null) =>
    updateTrainWorkspace(activeTrain, { editingBatchId: val });
  const setEditingBatchCreatedAt = (val: string | null) =>
    updateTrainWorkspace(activeTrain, { editingBatchCreatedAt: val });
  const setBatchName = (val: string) => updateTrainWorkspace(activeTrain, { batchName: val });
  const setCondCapacity = (val: string) =>
    updateTrainWorkspace(activeTrain, { condCapacity: val });
  const setSilicaCapacity = (val: string) =>
    updateTrainWorkspace(activeTrain, { silicaCapacity: val });
  const setWorkingInputs = (
    valOrUpdater: CycleRowInput[] | ((prev: CycleRowInput[]) => CycleRowInput[])
  ) => {
    updateTrainWorkspace(activeTrain, (curr) => ({
      rows: typeof valOrUpdater === 'function' ? valOrUpdater(curr.rows) : valOrUpdater,
    }));
  };
  const setInputCycle = (val: string) => updateTrainWorkspace(activeTrain, { inputCycle: val });
  const setInputCondIn = (val: string) => updateTrainWorkspace(activeTrain, { inputCondIn: val });
  const setInputCondOut = (val: string) =>
    updateTrainWorkspace(activeTrain, { inputCondOut: val });
  const setInputSilicaIn = (val: string) =>
    updateTrainWorkspace(activeTrain, { inputSilicaIn: val });
  const setInputSilicaOut = (val: string) =>
    updateTrainWorkspace(activeTrain, { inputSilicaOut: val });
  const setInputLabel = (val: string) => updateTrainWorkspace(activeTrain, { inputLabel: val });

  useEffect(() => {
    try {
      const draft: MultiTrainWorkspaceDraft = {
        activeTrain,
        trains: trainWorkspaces,
      };
      localStorage.setItem(WORKSPACE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [activeTrain, trainWorkspaces]);

  useEffect(() => {
    (['A', 'B'] as const).forEach((tKey) => {
      const ebId = trainWorkspaces[tKey].editingBatchId;
      if (!ebId) return;
      const isLocalId = ebId.startsWith('local_pred_');
      // Clear mismatched ID immediately when switching between Cloud and Guest modes
      if ((user && isLocalId) || (!user && !isLocalId)) {
        updateTrainWorkspace(tKey, { editingBatchId: null, editingBatchCreatedAt: null });
        return;
      }
      const matched = records.find((r) => r.id === ebId);
      if (records.length > 0 && !matched) {
        updateTrainWorkspace(tKey, { editingBatchId: null, editingBatchCreatedAt: null });
      } else if (matched && matched.createdAt && trainWorkspaces[tKey].editingBatchCreatedAt !== matched.createdAt) {
        // Keep editingBatchCreatedAt strictly synced with the authoritative record timestamp
        updateTrainWorkspace(tKey, { editingBatchCreatedAt: matched.createdAt });
      }
    });
  }, [records, user?.uid]);

  const defaultCondCapForTrain =
    train === 'B' ? DEFAULT_TRAIN_B_COND_CAPACITY : DEFAULT_COND_CAPACITY;
  const defaultSilicaCapForTrain =
    train === 'B' ? DEFAULT_TRAIN_B_SILICA_CAPACITY : DEFAULT_SILICA_CAPACITY;
  const cCap = parseFloat(condCapacity) > 0 ? parseFloat(condCapacity) : defaultCondCapForTrain;
  const sCap = parseFloat(silicaCapacity) > 0 ? parseFloat(silicaCapacity) : defaultSilicaCapForTrain;
  const totalCap = Number((cCap + sCap).toFixed(3));

  const activeBatchCalc = useMemo(() => {
    return recalculateBatchRows(workingInputs, cCap, isTh, false, sCap);
  }, [workingInputs, cCap, sCap, isTh]);

  const processedCycles = activeBatchCalc.rows;
  const lastCycle = processedCycles.length > 0 ? processedCycles[processedCycles.length - 1] : null;
  const previousCycleEnd = lastCycle ? lastCycle.cycleEnd : 0;

  const [inspectedStepIndex, setInspectedStepIndex] = useState<number>(0);

  useEffect(() => {
    if (inspectedStepIndex >= processedCycles.length && processedCycles.length > 0) {
      setInspectedStepIndex(0);
    }
  }, [processedCycles.length, inspectedStepIndex, activeTrain]);

  useEffect(() => {
    if (externalBatchToLoad) {
      handleLoadBatchIntoWorkspace(externalBatchToLoad);
      if (onClearExternalBatch) onClearExternalBatch();
    }
  }, [externalBatchToLoad]);

  useEffect(() => {
    setInputLabel(isTh ? `รอบที่ ${processedCycles.length + 1}` : `Step ${processedCycles.length + 1}`);
  }, [processedCycles.length, isTh, activeTrain]);

  const [tableTab, setTableTab] = useState<'input' | 'silica' | 'cond' | 'weighted' | 'predict'>('input');
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');

  const [editingRowState, setEditingRowState] = useState<{
    target: 'workspace' | 'saved_batch';
    batchRecord?: CyclePredictionRecord;
    rowId: string;
    label: string;
    cycleEnd: string;
    condIn: string;
    condOut: string;
    silicaIn: string;
    silicaOut: string;
  } | null>(null);
  const [editRowError, setEditRowError] = useState<string | null>(null);

  useEffect(() => {
    setEditRowError(null);
  }, [editingRowState?.rowId]);

  const [isBatchBrowserOpen, setIsBatchBrowserOpen] = useState(false);
  // Default formula display hidden (false) as requested
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);
  const [highlightedFormula, setHighlightedFormula] = useState<{
    formulaId: FormulaTargetId;
    rowIndex: number;
    rowId: string;
    step: number;
    columnLabel: string;
    displayValue: string;
    fromTab: 'input' | 'silica' | 'cond' | 'weighted' | 'predict';
    triggerKey: number;
  } | null>(null);
  const [returningCellKey, setReturningCellKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Lightweight readiness check for "+ Add Step" button (does NOT trigger live calculations while typing)
  const canAddRow = useMemo(() => {
    const end = parseFloat(inputCycle);
    const cIn = inputCondIn.trim() !== '' ? parseFloat(inputCondIn) : lastCycle ? lastCycle.condIn : NaN;
    const cOut = inputCondOut.trim() !== '' ? parseFloat(inputCondOut) : lastCycle ? lastCycle.condOut : NaN;
    const sIn = inputSilicaIn.trim() !== '' ? parseFloat(inputSilicaIn) : lastCycle ? lastCycle.silicaIn : NaN;
    const sOut = inputSilicaOut.trim() !== '' ? parseFloat(inputSilicaOut) : lastCycle ? lastCycle.silicaOut : NaN;

    return (
      !isNaN(end) &&
      end > 0 &&
      !isNaN(cIn) &&
      cIn >= 0 &&
      !isNaN(cOut) &&
      cOut >= 0 &&
      !isNaN(sIn) &&
      sIn >= 0 &&
      !isNaN(sOut) &&
      sOut >= 0
    );
  }, [inputCycle, inputCondIn, inputCondOut, inputSilicaIn, inputSilicaOut, lastCycle]);

  const inspectorRow = useMemo(() => {
    if (processedCycles.length > 0) {
      return processedCycles[inspectedStepIndex] || processedCycles[0];
    }
    return null;
  }, [processedCycles, inspectedStepIndex]);

  // Independent 8-Step Formula Inspector for Conductivity (Cond.) & Silica (SiO2) based on recorded rows
  const liveFormulaCalc = useMemo(() => {
    const isTypingAny = false;

    const rawCondCap = parseFloat(condCapacity);
    const rawSilicaCap = parseFloat(silicaCapacity);
    const hasValidCondCap = !isNaN(rawCondCap) && rawCondCap > 0;
    const hasValidSilicaCap = !isNaN(rawSilicaCap) && rawSilicaCap > 0;
    const activeCondCap = hasValidCondCap ? rawCondCap : defaultCondCapForTrain;
    const activeSilicaCap = hasValidSilicaCap ? rawSilicaCap : defaultSilicaCapForTrain;
    const activeTotalCap = Number((activeCondCap + activeSilicaCap).toFixed(2));

    // Determine source values: selected inspectorRow -> benchmark example (156.81 m³)
    const hasTypedCycle = false;
    const hasTypedCondIn = false;
    const hasTypedCondOut = false;
    const hasTypedSilicaIn = false;
    const hasTypedSilicaOut = false;

    const prevCycleVol = isTypingAny
      ? lastCycle
        ? lastCycle.cycleEnd
        : 0
      : inspectorRow
        ? inspectorRow.cycleStart
        : 0;

    const currentCycleVol = isTypingAny
      ? hasTypedCycle
        ? parseFloat(inputCycle)
        : lastCycle
          ? lastCycle.cycleEnd
          : 156.81
      : inspectorRow
        ? inspectorRow.cycleEnd
        : 156.81;

    const distance = Number((currentCycleVol - prevCycleVol).toFixed(4));
    const cycleReady = isTypingAny ? hasTypedCycle : true;

    // Section 1: Conductivity (Cond.)
    const condInReady = isTypingAny ? hasTypedCondIn : true;
    // Steps 5-8 operate ONLY when Outlet is entered
    const condOutReady = isTypingAny ? hasTypedCondOut : true;

    const condInVal = isTypingAny
      ? hasTypedCondIn
        ? parseFloat(inputCondIn)
        : 0
      : inspectorRow
        ? inspectorRow.condIn
        : 5.27;
    const condOutVal = isTypingAny
      ? hasTypedCondOut
        ? parseFloat(inputCondOut)
        : 0
      : inspectorRow
        ? inspectorRow.condOut
        : 0.076;

    const condConcInMolL = condInVal / (1000 * 126.45);
    const condConcInMolM3 = condConcInMolL * 1000;
    const condConcOutMolL = condOutVal / (1000 * 126.45);
    const condConcOutMolM3 = condConcOutMolL * 1000;
    const condIonsRemoved =
      condInReady && condOutReady && cycleReady
        ? (condConcInMolM3 - condConcOutMolM3) * distance
        : 0;
    const prevCondLoad = isTypingAny
      ? lastCycle
        ? lastCycle.cumulativeIonLoad
        : 0
      : inspectorRow
        ? inspectorRow.cumulativeIonLoad - inspectorRow.ionsRemoved
        : 0;
    const cumCondLoad = prevCondLoad + condIonsRemoved;
    const pctCondLoad = activeCondCap > 0 ? (cumCondLoad / activeCondCap) * 100 : 0;

    // Section 2: Silica (SiO2)
    const silicaInReady = isTypingAny ? hasTypedSilicaIn : true;
    // Steps 5-8 operate ONLY when Outlet is entered
    const silicaOutReady = isTypingAny ? hasTypedSilicaOut : true;

    const silicaInVal = isTypingAny
      ? hasTypedSilicaIn
        ? parseFloat(inputSilicaIn)
        : 0
      : inspectorRow
        ? inspectorRow.silicaIn
        : 185.3;
    const silicaOutVal = isTypingAny
      ? hasTypedSilicaOut
        ? parseFloat(inputSilicaOut)
        : 0
      : inspectorRow
        ? inspectorRow.silicaOut
        : 1.0;

    const silicaConcInMolL = silicaInVal / 1_000_000 / 60.08;
    const silicaConcInMolM3 = silicaConcInMolL * 1000;
    const silicaConcOutMolL = silicaOutVal / 1_000_000 / 60.08;
    const silicaConcOutMolM3 = silicaConcOutMolL * 1000;
    const silicaIonsRemoved =
      silicaInReady && silicaOutReady && cycleReady
        ? (silicaConcInMolM3 - silicaConcOutMolM3) * distance
        : 0;
    const prevSilicaLoad = isTypingAny
      ? lastCycle
        ? lastCycle.cumulativeSilicaLoad
        : 0
      : inspectorRow
        ? inspectorRow.cumulativeSilicaLoad - inspectorRow.silicaIonsRemoved
        : 0;
    const cumSilicaLoad = prevSilicaLoad + silicaIonsRemoved;
    const pctSilicaLoad = activeSilicaCap > 0 ? (cumSilicaLoad / activeSilicaCap) * 100 : 0;
    const pctSilicaLoadRef57 = (cumSilicaLoad / 5.7) * 100;

    // Combined Percent Load on Resin
    const combinedIonLoad = cumCondLoad + cumSilicaLoad;
    const combinedPctLoad = activeTotalCap > 0 ? (combinedIonLoad / activeTotalCap) * 100 : 0;

    // Validation warnings
    const warnings: string[] = [];
    if (!hasValidCondCap || !hasValidSilicaCap) {
      warnings.push(
        'ค่า Capacity ต้องมากกว่า 0 เพื่อป้องกันการหารด้วยศูนย์ (Division by Zero)'
      );
    }
    if (cycleReady && distance <= 0) {
      warnings.push(
        `ระยะห่าง Cycle (m³) = ${distance.toFixed(3)} m³ (ค่าไม่สมเหตุสมผล: Cycle รวมถัดไปต้องมากกว่า Cycle ปัจจุบัน)`
      );
    }
    if (condInReady && condInVal < 0) {
      warnings.push('ค่า Cond. MB Inlet ต้องไม่ติดลบ');
    }
    if (condOutReady && condOutVal < 0) {
      warnings.push('ค่า Cond. MB Outlet ต้องไม่ติดลบ');
    }
    if (condInReady && condOutReady && condOutVal > condInVal) {
      warnings.push(
        `ค่าไม่สมเหตุสมผลในส่วน Conductivity: Cond. MB Outlet (${condOutVal.toFixed(3)} μS/cm) มีค่ามากกว่า Cond. MB Inlet (${condInVal.toFixed(3)} μS/cm)`
      );
    }
    if (silicaInReady && silicaInVal < 0) {
      warnings.push('ค่า Silica MB Inlet ต้องไม่ติดลบ');
    }
    if (silicaOutReady && silicaOutVal < 0) {
      warnings.push('ค่า Silica MB Outlet ต้องไม่ติดลบ');
    }
    if (silicaInReady && silicaOutReady && silicaOutVal > silicaInVal) {
      warnings.push(
        `ค่าไม่สมเหตุสมผลในส่วน Silica: Silica MB Outlet (${silicaOutVal.toFixed(2)} ppb) มีค่ามากกว่า Silica MB Inlet (${silicaInVal.toFixed(2)} ppb)`
      );
    }

    return {
      isTypingAny,
      activeCondCap,
      activeSilicaCap,
      activeTotalCap,
      prevCycleVol,
      currentCycleVol,
      distance,
      cycleReady,
      condInReady,
      condOutReady,
      condInVal,
      condOutVal,
      condConcInMolL,
      condConcInMolM3,
      condConcOutMolL,
      condConcOutMolM3,
      condIonsRemoved,
      prevCondLoad,
      cumCondLoad,
      pctCondLoad,
      silicaInReady,
      silicaOutReady,
      silicaInVal,
      silicaOutVal,
      silicaConcInMolL,
      silicaConcInMolM3,
      silicaConcOutMolL,
      silicaConcOutMolM3,
      silicaIonsRemoved,
      prevSilicaLoad,
      cumSilicaLoad,
      pctSilicaLoad,
      pctSilicaLoadRef57,
      combinedIonLoad,
      combinedPctLoad,
      warnings,
    };
  }, [
    inputCycle,
    inputCondIn,
    inputCondOut,
    inputSilicaIn,
    inputSilicaOut,
    condCapacity,
    silicaCapacity,
    defaultCondCapForTrain,
    defaultSilicaCapForTrain,
    lastCycle,
    inspectorRow,
  ]);

  const flaggedRows = useMemo(() => {
    return processedCycles.filter((r) => isNonPhysicalCycleRow(r));
  }, [processedCycles]);

  // Number formatter for weighted-average prediction values ('—' when not computable)
  const fmtNum = (v: number | null | undefined, digits: number) =>
    v === null || v === undefined || !Number.isFinite(v)
      ? '—'
      : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // Weighted-Average Cycle Prediction (Used system-wide for 90% Warning & 95% Stop)
  //   ΔSilica (mol/m³) = Silica Inlet (mol/m³) − Silica Outlet (mol/m³)
  //   ΔCond.  (mol/m³) = Cond. Inlet (mol/m³) − Cond. Outlet (mol/m³)
  //   Weighted Average of Silica = Σ(ΔV × ΔSilica) ÷ Σ(ΔV)
  //   Weighted Average of Cond.  = Σ(ΔV × ΔCond.) ÷ Σ(ΔV)
  //   90% Warning (m³) = (Capacity × 0.90) ÷ (Weighted Average Silica + Weighted Average Cond.) → Train A: 71.63 mol
  //   95% Stop    (m³) = (Capacity × 0.95) ÷ (Weighted Average Silica + Weighted Average Cond.) → Train A: 75.61 mol
  const weightedPrediction = useMemo(() => {
    const warnMol = Number((totalCap * 0.9).toFixed(2));
    const stopMol = Number((totalCap * 0.95).toFixed(2));
    let sumDV = 0;
    let sumDVxDSilica = 0;
    let sumDVxDCond = 0;
    let invalidCount = 0;

    const rows = processedCycles.map((c) => {
      const silicaInMolM3 = (c.silicaIn / 1_000_000 / MOLAR_MASS_SIO2) * 1000;
      const silicaOutMolM3 = (c.silicaOut / 1_000_000 / MOLAR_MASS_SIO2) * 1000;
      const condInMolM3 = (c.condIn / (1000 * LAMBDA_0_NACL)) * 1000;
      const condOutMolM3 = (c.condOut / (1000 * LAMBDA_0_NACL)) * 1000;
      const dSilica = silicaInMolM3 - silicaOutMolM3;
      const dCond = condInMolM3 - condOutMolM3;

      const issues: string[] = [];
      const rawValues = [c.cycleEnd, c.silicaIn, c.silicaOut, c.condIn, c.condOut];
      if (rawValues.some((v) => !Number.isFinite(v))) {
        issues.push(isTh ? 'มีค่าที่ไม่ใช่ตัวเลข' : 'Non-numeric value');
      } else if (rawValues.some((v) => v < 0)) {
        issues.push(isTh ? 'มีค่าติดลบ' : 'Negative value');
      }
      if (!(c.distance > 0)) {
        issues.push(
          isTh ? 'ΔV ต้องมากกว่า 0 (Cycle ต้องมากกว่ารอบก่อนหน้า)' : 'ΔV must be > 0 (Cycle must exceed previous step)'
        );
      }
      if (dSilica < 0) issues.push(isTh ? 'Silica Outlet มากกว่า Inlet' : 'Silica Outlet > Inlet');
      if (dCond < 0) issues.push(isTh ? 'Cond. Outlet มากกว่า Inlet' : 'Cond. Outlet > Inlet');

      const isValid = issues.length === 0;
      if (isValid) {
        sumDV += c.distance;
        sumDVxDSilica += c.distance * dSilica;
        sumDVxDCond += c.distance * dCond;
      } else {
        invalidCount += 1;
      }

      const rowWaSilica = sumDV > 0 ? sumDVxDSilica / sumDV : null;
      const rowWaCond = sumDV > 0 ? sumDVxDCond / sumDV : null;
      const rowTotalWa = rowWaSilica !== null && rowWaCond !== null ? rowWaSilica + rowWaCond : null;
      const rowCanDivide = rowTotalWa !== null && Number.isFinite(rowTotalWa) && rowTotalWa > 1e-12;

      return {
        rowId: c.rowId,
        step: c.step,
        silicaInMolM3,
        silicaOutMolM3,
        dSilica,
        waSilica: rowWaSilica,
        condInMolM3,
        condOutMolM3,
        dCond,
        waCond: rowWaCond,
        totalWa: rowTotalWa,
        warnVolume: rowCanDivide ? warnMol / (rowTotalWa as number) : null,
        stopVolume: rowCanDivide ? stopMol / (rowTotalWa as number) : null,
        isValid,
        issues,
      };
    });

    const waSilica = sumDV > 0 ? sumDVxDSilica / sumDV : null;
    const waCond = sumDV > 0 ? sumDVxDCond / sumDV : null;
    const denominator = waSilica !== null && waCond !== null ? waSilica + waCond : null;
    const canDivide = denominator !== null && Number.isFinite(denominator) && denominator > 1e-12;

    return {
      rows,
      rowMap: new Map(rows.map((r) => [r.rowId, r])),
      sumDV,
      waSilica,
      waCond,
      denominator,
      canDivide,
      noValidRows: sumDV <= 0,
      warnMol,
      stopMol,
      warnVolume: canDivide ? warnMol / (denominator as number) : null,
      stopVolume: canDivide ? stopMol / (denominator as number) : null,
      breakthroughVolume: canDivide ? totalCap / (denominator as number) : null,
      invalidCount,
    };
  }, [processedCycles, totalCap, isTh]);

  // Threshold Control Analysis (90% System Warning & 95% System Stop) — Uses Weighted Average formula across entire system
  const thresholdAnalysis = useMemo(() => {
    const activeRows = processedCycles;

    if (activeRows.length === 0) {
      return {
        checkpoint90: {
          targetPct: 90,
          targetMol: weightedPrediction.warnMol,
          interpolatedVolume: 0,
          lastSafeRow: null,
          firstReachedRow: null,
          safeVolumeBeforeThreshold: 0,
          safeCycleCount: 0,
          isReached: false,
          remainingVolume: 0,
        },
        checkpoint95: {
          targetPct: 95,
          targetMol: weightedPrediction.stopMol,
          interpolatedVolume: 0,
          lastSafeRow: null,
          firstReachedRow: null,
          safeVolumeBeforeThreshold: 0,
          safeCycleCount: 0,
          isReached: false,
          remainingVolume: 0,
        },
        currentZone: 'normal' as const,
        finalGoverningPct: 0,
      };
    }

    const n = activeRows.length;
    const deltaCombinedPcts = activeRows.map((r, i) =>
      Math.max(0, r.combinedPercentLoad - (i === 0 ? 0 : activeRows[i - 1].combinedPercentLoad))
    );
    const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const meanDeltaPct = mean(deltaCombinedPcts);

    const totalVolume = activeRows[n - 1].cycleEnd;
    const finalCombinedPct = activeRows[n - 1].combinedPercentLoad;
    const finalSilicaPct = activeRows[n - 1].silicaPercentLoad;
    const finalGoverningPct = Math.max(finalCombinedPct, finalSilicaPct);

    const buildThresholdPoint = (targetPct: 90 | 95, targetMol: number, predictedVol: number | null) => {
      const idx = activeRows.findIndex((r) => r.combinedPercentLoad >= targetPct);
      const lastSafeIdx = activeRows.reduce(
        (acc, r, i) => (r.combinedPercentLoad <= targetPct && r.silicaPercentLoad <= targetPct ? i : acc),
        -1
      );
      const lastSafeRow = lastSafeIdx >= 0 ? activeRows[lastSafeIdx] : null;
      const firstReachedRow = idx >= 0 ? activeRows[idx] : null;

      const volumeFromWA = predictedVol !== null && Number.isFinite(predictedVol) ? Math.max(0, predictedVol) : 0;

      const estimatedCycles =
        firstReachedRow && lastSafeRow
          ? lastSafeRow.step
          : meanDeltaPct > 0
            ? Math.max(1, Math.floor(targetPct / meanDeltaPct))
            : n;

      return {
        targetPct,
        targetMol,
        interpolatedVolume: Number(volumeFromWA.toFixed(3)),
        lastSafeRow,
        firstReachedRow,
        safeVolumeBeforeThreshold: lastSafeRow ? lastSafeRow.cycleEnd : Number(volumeFromWA.toFixed(3)),
        safeCycleCount: lastSafeRow ? lastSafeRow.step : estimatedCycles,
        isReached: finalCombinedPct >= targetPct || finalSilicaPct >= targetPct,
        remainingVolume: Math.max(0, volumeFromWA - totalVolume),
      };
    };

    const checkpoint90 = buildThresholdPoint(90, weightedPrediction.warnMol, weightedPrediction.warnVolume);
    const checkpoint95 = buildThresholdPoint(95, weightedPrediction.stopMol, weightedPrediction.stopVolume);

    const lastActive = activeRows[n - 1];
    const currentZone: 'normal' | 'warn90' | 'stop95' | 'breakthrough' =
      finalGoverningPct >= 100 || lastActive.condOut >= 0.1 || lastActive.silicaOut >= 10
        ? 'breakthrough'
        : finalGoverningPct >= 95
          ? 'stop95'
          : finalGoverningPct >= 90
            ? 'warn90'
            : 'normal';

    return {
      checkpoint90,
      checkpoint95,
      currentZone,
      finalGoverningPct,
    };
  }, [processedCycles, weightedPrediction]);

  const plantSummary = useMemo(() => {
    if (!lastCycle) {
      return {
        totalVolume: 0,
        currentCombinedPercent: 0,
        currentSilicaPercent: 0,
        currentCondPercent: 0,
        currentCombinedIonLoad: 0,
        currentCondIonLoad: 0,
        currentSilicaIonLoad: 0,
        predictedWarningVolume: 0,
        predictedCutoffVolume: 0,
        predictedBreakthroughVolume: 0,
        predictedSilicaCutoffVolume: 0,
        remainingVolumeTo98: 0,
        predictedTotalCycleCount98: 0,
        maxSafeRowWithin98: null,
        firstCutoffRowAbove98: null,
      };
    }

    const totalVolume = activeBatchCalc.cycleEnd;
    const currentCombinedPercent = activeBatchCalc.combinedPercentLoad;
    const currentSilicaPercent = activeBatchCalc.silicaPercentLoad;
    const currentCondPercent = activeBatchCalc.condPercentLoad;

    const predictedWarningVolume =
      weightedPrediction.warnVolume !== null ? Number(weightedPrediction.warnVolume.toFixed(3)) : 0;
    const predictedCutoffVolume =
      weightedPrediction.stopVolume !== null ? Number(weightedPrediction.stopVolume.toFixed(3)) : 0;
    const predictedBreakthroughVolume =
      weightedPrediction.breakthroughVolume !== null
        ? Number(weightedPrediction.breakthroughVolume.toFixed(3))
        : activeBatchCalc.predictedBreakthrough;
    const predictedSilicaCutoffVolume = activeBatchCalc.predictedSilicaCutoffCycle;
    const remainingVolumeTo98 = Math.max(0, predictedCutoffVolume - totalVolume);

    return {
      totalVolume,
      currentCombinedPercent,
      currentSilicaPercent,
      currentCondPercent,
      currentCombinedIonLoad: activeBatchCalc.totalCombinedIonLoad,
      currentCondIonLoad: activeBatchCalc.cumulativeIonLoad,
      currentSilicaIonLoad: activeBatchCalc.cumulativeSilicaLoad,
      predictedWarningVolume,
      predictedCutoffVolume,
      predictedBreakthroughVolume,
      predictedSilicaCutoffVolume,
      remainingVolumeTo98,
      predictedTotalCycleCount98: activeBatchCalc.predictedTotalCycleCount98,
      maxSafeRowWithin98: activeBatchCalc.maxSafeRowWithin98,
      firstCutoffRowAbove98: activeBatchCalc.firstCutoffRowAbove98,
    };
  }, [lastCycle, activeBatchCalc, weightedPrediction]);

  const hasCycleData = processedCycles.length > 0;

  const inspectorWeightedRow = useMemo(() => {
    if (inspectorRow) {
      return weightedPrediction.rowMap.get(inspectorRow.rowId) || null;
    }
    return null;
  }, [inspectorRow, weightedPrediction]);

  const navigateToFormulaFromTable = (
    formulaId: FormulaTargetId,
    rowIndex: number,
    row: { rowId: string; step: number },
    columnLabel: string,
    displayValue: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setInspectedStepIndex(rowIndex);
    setShowFormulaDetails(true);
    setHighlightedFormula({
      formulaId,
      rowIndex,
      rowId: row.rowId,
      step: row.step,
      columnLabel,
      displayValue,
      fromTab: tableTab,
      triggerKey: Date.now(),
    });
    setTimeout(() => {
      const targetEl =
        document.getElementById(`formula-card-${formulaId}`) ||
        document.getElementById('formula-calculation-section');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 140);
  };

  const handleReturnToTable = () => {
    if (highlightedFormula) {
      setTableTab(highlightedFormula.fromTab);
      setInspectedStepIndex(highlightedFormula.rowIndex);
      const cellKey = `${highlightedFormula.rowId}_${highlightedFormula.formulaId}`;
      setReturningCellKey(cellKey);
      setTimeout(() => {
        const rowEl =
          document.getElementById(`calc-table-row-${highlightedFormula.rowId}`) ||
          document.getElementById('data-entry-calc-table-section');
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 90);
      setTimeout(() => {
        setReturningCellKey((prev) => (prev === cellKey ? null : prev));
      }, 4000);
    } else {
      const tableEl = document.getElementById('data-entry-calc-table-section');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const renderFormulaLinkCell = (
    formulaId: FormulaTargetId,
    rowIndex: number,
    row: { rowId: string; step: number },
    columnLabel: string,
    displayValue: string,
    colorClass: string = ''
  ) => {
    const isActiveFormulaCell =
      (highlightedFormula?.rowId === row.rowId && highlightedFormula?.formulaId === formulaId) ||
      returningCellKey === `${row.rowId}_${formulaId}`;

    return (
      <button
        type="button"
        onClick={(e) => navigateToFormulaFromTable(formulaId, rowIndex, row, columnLabel, displayValue, e)}
        title={
          isTh
            ? `คลิกเพื่อไปดูสูตรการคำนวณ "${columnLabel}" (รอบที่ #${row.step})`
            : `Click to view formula for "${columnLabel}" (Step #${row.step})`
        }
        className={`table-link-cell ${isActiveFormulaCell ? 'table-link-cell-pulse' : ''} ${colorClass}`}
      >
        {displayValue}
      </button>
    );
  };

  const getFormulaCardClass = (formulaId: FormulaTargetId) => {
    const isHighlighted = highlightedFormula?.formulaId === formulaId;
    return `p-2.5 rounded-lg border transition-all space-y-1 ${isHighlighted
        ? 'formula-card-flash border-amber-500 ring-2 ring-amber-400/60'
        : 'bg-[var(--bg)] border-[var(--line)]'
      }`;
  };

  const renderHighlightedFormulaBadge = (formulaId: FormulaTargetId, shortDescTh: string, shortDescEn: string) => {
    const isHighlighted = highlightedFormula?.formulaId === formulaId;
    return (
      <div className="space-y-1 pt-0.5">
        <div className="font-sans text-[11px] text-[var(--ink-soft)] leading-snug">
          <strong className="text-[var(--ink)]">{isTh ? 'คำอธิบาย: ' : 'Explanation: '}</strong>
          {isTh ? shortDescTh : shortDescEn}
        </div>
        {isHighlighted && highlightedFormula && (
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/30 font-sans">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {isTh
                  ? `สูตรของค่าที่คลิกจากตาราง: ${highlightedFormula.columnLabel} = ${highlightedFormula.displayValue} (รอบที่ #${highlightedFormula.step})`
                  : `Selected from table: ${highlightedFormula.columnLabel} = ${highlightedFormula.displayValue} (Step #${highlightedFormula.step})`}
              </span>
            </span>
            <button
              type="button"
              onClick={handleReturnToTable}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] cursor-pointer shadow-xs"
            >
              <CornerDownLeft className="w-3 h-3" />
              <span>{isTh ? `กลับไปยังตารางเดิม (รอบที่ #${highlightedFormula.step})` : `Back to Table (Step #${highlightedFormula.step})`}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleAddRowToBatch = () => {
    setErrorMessage(null);
    const end = parseFloat(inputCycle);
    const cIn = inputCondIn.trim() !== '' ? parseFloat(inputCondIn) : lastCycle ? lastCycle.condIn : NaN;
    const cOut = inputCondOut.trim() !== '' ? parseFloat(inputCondOut) : lastCycle ? lastCycle.condOut : NaN;
    const sIn = inputSilicaIn.trim() !== '' ? parseFloat(inputSilicaIn) : lastCycle ? lastCycle.silicaIn : NaN;
    const sOut = inputSilicaOut.trim() !== '' ? parseFloat(inputSilicaOut) : lastCycle ? lastCycle.silicaOut : NaN;

    if (isNaN(end) || end <= 0) {
      setErrorMessage(
        isTh ? 'กรุณากรอกค่า Cycle (m³) ให้มากกว่า 0' : 'Please enter a valid Cycle volume (> 0 m³).'
      );
      return;
    }
    if (isNaN(cIn) || cIn < 0 || isNaN(cOut) || cOut < 0 || isNaN(sIn) || sIn < 0 || isNaN(sOut) || sOut < 0) {
      setErrorMessage(
        isTh ? 'กรุณากรอกค่าพารามิเตอร์ให้ครบทุกช่อง' : 'Please enter valid Inlet and Outlet values.'
      );
      return;
    }
    if (workingInputs.some((r) => Math.abs(r.cycleEnd - end) < 0.0001)) {
      setErrorMessage(
        isTh ? `มีแถวปริมาตร ${end.toFixed(3)} m³ อยู่แล้ว` : `Volume ${end.toFixed(3)} m³ already exists.`
      );
      return;
    }
    if (lastCycle && end <= lastCycle.cycleEnd) {
      setErrorMessage(
        isTh
          ? `ค่า Cycle (m³) ต้องมากกว่ารอบก่อนหน้า (${lastCycle.cycleEnd.toFixed(2)} m³) เพื่อให้ ΔV มากกว่า 0`
          : `Cycle (m³) must be greater than the previous step (${lastCycle.cycleEnd.toFixed(2)} m³) so that ΔV > 0.`
      );
      return;
    }

    const newRow: CycleRowInput = {
      rowId: generateValidId('row'),
      label: inputLabel.trim() || (isTh ? `รอบที่ ${workingInputs.length + 1}` : `Step ${workingInputs.length + 1}`),
      cycleEnd: end,
      condIn: cIn,
      condOut: cOut,
      silicaIn: sIn,
      silicaOut: sOut,
    };

    setWorkingInputs((prev) => {
      const next = [...prev, newRow];
      setInspectedStepIndex(next.length - 1);
      return next;
    });
    // Reset all 5 inputs back to empty string so faint placeholders show
    setInputCycle('');
    setInputCondIn('');
    setInputCondOut('');
    setInputSilicaIn('');
    setInputSilicaOut('');
  };

  const handleDeleteWorkspaceRow = (rowId: string, label: string) => {
    setConfirmConfig({
      isOpen: true,
      title: isTh ? `ลบ "${label}" ออกจากตาราง?` : `Remove "${label}"?`,
      message: isTh
        ? 'ระบบจะคำนวณระยะห่าง (ΔV), Ion Load, % Load และจุดหยุดระบบ 95% ของแถวที่เหลือใหม่อัตโนมัติ'
        : 'Remaining rows will be automatically recalculated.',
      onConfirm: () => {
        setWorkingInputs((prev) =>
          prev.filter((r, idx) => (processedCycles[idx]?.rowId || r.rowId) !== rowId && r.rowId !== rowId)
        );
      },
    });
  };

  const handleSaveBatchHistory = async (saveAsNew: boolean = false) => {
    setErrorMessage(null);
    if (processedCycles.length === 0) {
      setErrorMessage(isTh ? 'กรุณาเพิ่มข้อมูลอย่างน้อย 1 แถวก่อนบันทึก' : 'Add at least 1 row before saving.');
      return;
    }

    const cleanBatchName =
      batchName.trim() ||
      (isTh
        ? `ชุดข้อมูล (${new Date().toLocaleDateString('th-TH')})`
        : `Cycle Batch (${new Date().toLocaleDateString('en-US')})`);

    setIsSaving(true);
    try {
      const batchPayload: Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'> = {
        batchName: cleanBatchName,
        cycle: cleanBatchName,
        train,
        condCapacity: activeBatchCalc.condCapacity,
        silicaCapacity: activeBatchCalc.silicaCapacity,
        resinCapacity: activeBatchCalc.resinCapacity,
        rowCount: activeBatchCalc.rowCount,
        rows: activeBatchCalc.rows,
        conductivity: activeBatchCalc.conductivity,
        condOut: activeBatchCalc.condOut,
        silica: activeBatchCalc.silica,
        silicaOut: activeBatchCalc.silicaOut,
        cycleStart: activeBatchCalc.cycleStart,
        cycleEnd: activeBatchCalc.cycleEnd,
        distance: activeBatchCalc.distance,
        ionsRemoved: activeBatchCalc.ionsRemoved,
        cumulativeIonLoad: activeBatchCalc.cumulativeIonLoad,
        cumulativeSilicaLoad: activeBatchCalc.cumulativeSilicaLoad,
        silicaPercentLoad: activeBatchCalc.silicaPercentLoad,
        totalCombinedIonLoad: activeBatchCalc.totalCombinedIonLoad,
        combinedPercentLoad: activeBatchCalc.combinedPercentLoad,
        percentLoad: activeBatchCalc.percentLoad,
        predictedCycle: activeBatchCalc.predictedCycle,
        predictedBreakthrough: activeBatchCalc.predictedBreakthrough,
        updatedAt: new Date().toISOString(),
      };

      const existingRecord = editingBatchId
        ? records.find((r) => r.id === editingBatchId)
        : undefined;
      const isUpdatingExisting = !saveAsNew && Boolean(existingRecord);

      if (isUpdatingExisting && existingRecord) {
        const authoritativeCreatedAt =
          existingRecord.createdAt || editingBatchCreatedAt || new Date().toISOString();
        if (user) {
          await updateCyclePrediction(existingRecord.id, authoritativeCreatedAt, batchPayload);
        } else if (onUpdateLocalRecord) {
          onUpdateLocalRecord(existingRecord.id, batchPayload);
        }
        updateTrainWorkspace(activeTrain, {
          editingBatchId: existingRecord.id,
          editingBatchCreatedAt: authoritativeCreatedAt,
        });
        setSaveSuccessMessage(
          isTh
            ? `อัปเดต "${cleanBatchName}" (${activeBatchCalc.rowCount} แถว) ลง${user ? 'ฐานข้อมูล Cloud' : 'เครื่อง'}เรียบร้อยแล้ว`
            : `Updated "${cleanBatchName}" (${activeBatchCalc.rowCount} rows) in ${user ? 'Cloud DB' : 'local storage'}`
        );
      } else {
        const createdAtIso = new Date().toISOString();
        if (user) {
          const newId = await addCyclePrediction(batchPayload, createdAtIso);
          if (!newId) {
            throw new Error(isTh ? 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูล Cloud ได้' : 'Cloud save failed');
          }
          updateTrainWorkspace(activeTrain, {
            editingBatchId: newId,
            editingBatchCreatedAt: createdAtIso,
          });
        } else {
          const maybeId = onAddLocalRecord(batchPayload);
          if (typeof maybeId === 'string' && maybeId) {
            updateTrainWorkspace(activeTrain, {
              editingBatchId: maybeId,
              editingBatchCreatedAt: createdAtIso,
            });
          }
        }
        setSaveSuccessMessage(
          isTh
            ? `บันทึก "${cleanBatchName}" (${activeBatchCalc.rowCount} แถว) ลง${user ? 'ฐานข้อมูล Cloud' : 'เครื่อง'}เรียบร้อยแล้ว`
            : `Saved "${cleanBatchName}" (${activeBatchCalc.rowCount} rows) to ${user ? 'Cloud DB' : 'local storage'}`
        );
      }

      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Batch save error:', err);
      const detail = err instanceof Error ? err.message : '';
      setErrorMessage(
        isTh
          ? `เกิดข้อผิดพลาดในการบันทึก${detail ? `: ${detail.slice(0, 120)}` : ''}`
          : `Failed to save batch${detail ? `: ${detail.slice(0, 120)}` : ''}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadBatchIntoWorkspace = (batchRecord: CyclePredictionRecord) => {
    const normalized = normalizeCycleRecordToBatch(batchRecord);
    const targetTrain: TrainId =
      normalized.train === 'B' || (!normalized.train && normalized.batchName.includes('B'))
        ? 'B'
        : 'A';

    setActiveTrain(targetTrain);
    updateTrainWorkspace(targetTrain, {
      editingBatchId: normalized.id,
      editingBatchCreatedAt: normalized.createdAt,
      batchName: normalized.batchName,
      condCapacity: normalized.condCapacity.toString(),
      silicaCapacity: normalized.silicaCapacity.toString(),
      rows: normalized.rows.map((r) => ({
        rowId: r.rowId,
        label: r.label,
        cycleEnd: r.cycleEnd,
        condIn: r.condIn,
        condOut: r.condOut,
        silicaIn: r.silicaIn,
        silicaOut: r.silicaOut,
      })),
      inputCycle: '',
      inputCondIn: '',
      inputCondOut: '',
      inputSilicaIn: '',
      inputSilicaOut: '',
    });

    setInspectedStepIndex(0);
    setIsBatchBrowserOpen(false);
    setErrorMessage(null);
    setSaveSuccessMessage(
      isTh
        ? `โหลดชุดข้อมูล "${normalized.batchName}" (${normalized.rows.length} แถว) เข้าสู่สายการผลิต Train ${targetTrain} แล้ว`
        : `Loaded "${normalized.batchName}" (${normalized.rows.length} rows) into Train ${targetTrain}`
    );
    setTimeout(() => setSaveSuccessMessage(null), 3500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRevertCurrentBatchChanges = () => {
    if (!editingBatchId) return;
    const original = records.find((r) => r.id === editingBatchId);
    if (!original) return;
    handleLoadBatchIntoWorkspace(original);
  };

  const handleStartNewBatch = () => {
    const trainBatchesCount =
      activeTrain === 'A' ? savedBatchesTrainA.length : savedBatchesTrainB.length;
    const nextNum = trainBatchesCount + 1;
    updateTrainWorkspace(activeTrain, {
      editingBatchId: null,
      editingBatchCreatedAt: null,
      batchName: isTh ? `ชุดที่ ${nextNum} - Train ${activeTrain}` : `Batch ${nextNum} - Train ${activeTrain}`,
      condCapacity:
        activeTrain === 'B'
          ? DEFAULT_TRAIN_B_COND_CAPACITY.toString()
          : DEFAULT_COND_CAPACITY.toString(),
      silicaCapacity:
        activeTrain === 'B'
          ? DEFAULT_TRAIN_B_SILICA_CAPACITY.toString()
          : DEFAULT_SILICA_CAPACITY.toString(),
      rows: [],
      inputCycle: '',
      inputCondIn: '',
      inputCondOut: '',
      inputSilicaIn: '',
      inputSilicaOut: '',
    });
    setErrorMessage(null);
  };

  const handleLoadBenchmark = (whichPreset: 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'B3') => {
    const presetRowsMap: Record<typeof whichPreset, CycleRowInput[]> = {
      A1: PLANT_TRAIN_A_BENCHMARK,
      A2: PLANT_TRAIN_A_SET2_BENCHMARK,
      A3: PLANT_TRAIN_A_SET3_BENCHMARK,
      B1: PLANT_TRAIN_B_BENCHMARK,
      B2: PLANT_TRAIN_B_SET2_BENCHMARK,
      B3: PLANT_TRAIN_B_SET3_BENCHMARK,
    };
    const presetRows = presetRowsMap[whichPreset];
    const targetTrain: TrainId = whichPreset.startsWith('B') ? 'B' : 'A';
    const nextCondCap =
      targetTrain === 'B'
        ? DEFAULT_TRAIN_B_COND_CAPACITY.toString()
        : DEFAULT_COND_CAPACITY.toString();
    const nextSilicaCap =
      targetTrain === 'B'
        ? DEFAULT_TRAIN_B_SILICA_CAPACITY.toString()
        : DEFAULT_SILICA_CAPACITY.toString();

    const presetNameMap: Record<typeof whichPreset, { th: string; en: string }> = {
      A1: { th: 'ชุดที่ 1 - Train A (15 รอบ · 1,728.29 m³)', en: 'Set 1 - Train A (15 cycles · 1,728.29 m³)' },
      A2: { th: 'ชุดที่ 2 - Train A (40 รอบ · 1,902.84 m³)', en: 'Set 2 - Train A (40 cycles · 1,902.84 m³)' },
      A3: { th: 'ชุดที่ 3 - Train A (24 รอบ · 1,771.10 m³)', en: 'Set 3 - Train A (24 cycles · 1,771.10 m³)' },
      B1: { th: 'ชุดที่ 1 - Train B (25 รอบ · 2,014.38 m³)', en: 'Set 1 - Train B (25 cycles · 2,014.38 m³)' },
      B2: { th: 'ชุดที่ 2 - Train B (38 รอบ · 2,104.16 m³)', en: 'Set 2 - Train B (38 cycles · 2,104.16 m³)' },
      B3: { th: 'ชุดที่ 3 - Train B (6 รอบ · 1,938.47 m³)', en: 'Set 3 - Train B (6 cycles · 1,938.47 m³)' },
    };

    setActiveTrain(targetTrain);
    updateTrainWorkspace(targetTrain, {
      editingBatchId: null,
      editingBatchCreatedAt: null,
      condCapacity: nextCondCap,
      silicaCapacity: nextSilicaCap,
      batchName: isTh ? presetNameMap[whichPreset].th : presetNameMap[whichPreset].en,
      rows: presetRows.map((r, i) => ({
        rowId: generateValidId(`bm_${whichPreset}_${i + 1}`),
        label: r.label,
        cycleEnd: r.cycleEnd,
        condIn: r.condIn,
        condOut: r.condOut,
        silicaIn: r.silicaIn,
        silicaOut: r.silicaOut,
      })),
    });
    setInspectedStepIndex(0);
    setErrorMessage(null);
  };

const handleConsolidateLegacyRecords = async () => {
  if (legacySingleRowRecords.length <= 1) return;
  setIsSaving(true);
  try {
    const rawRows: CycleRowInput[] = legacySingleRowRecords.map((r, i) => ({
      rowId: generateValidId(`merged_${i + 1}`),
      label: r.cycle || (isTh ? `รอบที่ ${i + 1}` : `Step ${i + 1}`),
      cycleEnd: r.cycleEnd ?? r.predictedCycle ?? 0,
      condIn: r.conductivity,
      condOut: r.condOut ?? 0.076,
      silicaIn: r.silica ?? 185.3,
      silicaOut: r.silicaOut ?? 1.0,
    }));
    const recalc = recalculateBatchRows(rawRows, cCap, isTh, true, sCap);
    const mergedName = isTh ? `ชุดข้อมูลรวม (${recalc.rowCount} รอบ)` : `Consolidated (${recalc.rowCount} steps)`;

    const batchPayload: Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'> = {
      batchName: mergedName,
      cycle: mergedName,
      train,
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

    if (user) {
      const createdAtIso = new Date().toISOString();
      const newId = await addCyclePrediction(batchPayload, createdAtIso);
      await Promise.all(legacySingleRowRecords.map((r) => deleteCyclePrediction(r.id)));
      if (newId) {
        updateTrainWorkspace(activeTrain, {
          editingBatchId: newId,
          editingBatchCreatedAt: createdAtIso,
        });
      }
    } else {
      legacySingleRowRecords.forEach((r) => onDeleteLocalRecord(r.id));
      onAddLocalRecord(batchPayload);
    }

    setWorkingInputs(
      recalc.rows.map((r) => ({
        rowId: r.rowId,
        label: r.label,
        cycleEnd: r.cycleEnd,
        condIn: r.condIn,
        condOut: r.condOut,
        silicaIn: r.silicaIn,
        silicaOut: r.silicaOut,
      }))
    );
    setBatchName(mergedName);
  } catch (err) {
    console.error('Consolidate error:', err);
  } finally {
    setIsSaving(false);
  }
};

const requestDeleteSavedBatch = (batch: CyclePredictionRecord) => {
  const norm = normalizeCycleRecordToBatch(batch);
  setConfirmConfig({
    isOpen: true,
    title: isTh ? `ลบชุดข้อมูล "${norm.batchName}"?` : `Delete "${norm.batchName}"?`,
    message: isTh
      ? `ยืนยันการลบชุดข้อมูล "${norm.batchName}" (${norm.rowCount} แถว) ออกจากประวัติ?`
      : `Delete batch "${norm.batchName}" (${norm.rowCount} rows) from history?`,
    onConfirm: async () => {
      if (user) {
        await deleteCyclePrediction(batch.id);
      } else {
        onDeleteLocalRecord(batch.id);
      }
      if (editingBatchId === batch.id) {
        setEditingBatchId(null);
        setEditingBatchCreatedAt(null);
      }
    },
  });
};

const handleSaveEditedRow = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingRowState) return;

  const end = parseFloat(editingRowState.cycleEnd);
  const cIn = parseFloat(editingRowState.condIn);
  const cOut = parseFloat(editingRowState.condOut);
  const sIn = parseFloat(editingRowState.silicaIn);
  const sOut = parseFloat(editingRowState.silicaOut);
  if ([end, cIn, cOut, sIn, sOut].some((v) => isNaN(v) || !Number.isFinite(v))) {
    setEditRowError(isTh ? 'กรุณากรอกค่าเป็นตัวเลขให้ครบทุกช่อง' : 'All fields must be valid numbers.');
    return;
  }
  if (end <= 0) {
    setEditRowError(isTh ? 'ค่า Cycle (m³) ต้องมากกว่า 0' : 'Cycle (m³) must be greater than 0.');
    return;
  }
  if ([cIn, cOut, sIn, sOut].some((v) => v < 0)) {
    setEditRowError(
      isTh ? 'ค่า Silica และ Cond. (Inlet/Outlet) ต้องไม่ติดลบ' : 'Silica and Cond. values must not be negative.'
    );
    return;
  }
  setEditRowError(null);

  if (editingRowState.target === 'workspace') {
    setWorkingInputs(() => {
      const currentRows = activeBatchCalc.rows;
      return currentRows.map((r) => {
        if (r.rowId === editingRowState.rowId) {
          return {
            rowId: r.rowId,
            label: editingRowState.label.trim() || r.label,
            cycleEnd: end,
            condIn: cIn,
            condOut: cOut,
            silicaIn: sIn,
            silicaOut: sOut,
          };
        }
        return {
          rowId: r.rowId,
          label: r.label,
          cycleEnd: r.cycleEnd,
          condIn: r.condIn,
          condOut: r.condOut,
          silicaIn: r.silicaIn,
          silicaOut: r.silicaOut,
        };
      });
    });
    setEditingRowState(null);
  } else if (editingRowState.target === 'saved_batch' && editingRowState.batchRecord) {
    const batch = editingRowState.batchRecord;
    if (user) {
      const updated = await updateRowInCloudBatch(
        batch,
        editingRowState.rowId,
        {
          label: editingRowState.label.trim(),
          cycleEnd: end,
          condIn: cIn,
          condOut: cOut,
          silicaIn: sIn,
          silicaOut: sOut,
        },
        isTh
      );
      if (editingBatchId === batch.id) {
        handleLoadBatchIntoWorkspace(updated);
      }
    } else if (onUpdateLocalRecord) {
      const norm = normalizeCycleRecordToBatch(batch);
      const nextInputs = norm.rows.map((r) =>
        r.rowId === editingRowState.rowId
          ? {
            rowId: r.rowId,
            label: editingRowState.label.trim() || r.label,
            cycleEnd: end,
            condIn: cIn,
            condOut: cOut,
            silicaIn: sIn,
            silicaOut: sOut,
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
      const recalc = recalculateBatchRows(nextInputs, norm.condCapacity, isTh, false, norm.silicaCapacity);
      onUpdateLocalRecord(batch.id, {
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
      if (editingBatchId === batch.id) {
        setWorkingInputs(nextInputs);
      }
    }
    setEditingRowState(null);
  }
};

const requestClearWorkspace = () => {
  setConfirmConfig({
    isOpen: true,
    title: isTh ? 'ล้างตารางคำนวณชุดปัจจุบัน?' : 'Clear active table?',
    message: isTh
      ? 'เคลียร์แถวในหน้าคำนวณเพื่อเริ่มชุดใหม่ (ข้อมูลที่บันทึกไว้ในประวัติจะไม่ถูกลบ)'
      : 'Clears rows in the active workspace. Saved batches remain intact.',
    onConfirm: () => {
      handleStartNewBatch();
    },
  });
};

const handleExportActiveBatch = (format: ExportFormat) => {
  const rowsToExport = processedCycles;
  if (!rowsToExport.length) return;

  exportBatchesToFile(
    [
      {
        batchName: batchName || (isTh ? 'ชุดข้อมูลปัจจุบัน' : 'Active Batch'),
        train,
        condCapacity: cCap,
        silicaCapacity: sCap,
        rows: rowsToExport,
        predictedWarning90Volume: thresholdAnalysis?.checkpoint90.interpolatedVolume,
        predictedStop95Volume: plantSummary?.predictedCutoffVolume,
        predictedBreakthroughVolume: plantSummary?.predictedBreakthroughVolume,
      },
    ],
    format,
    isTh
  );
};

// Line Chart Geometry: Y-Axis = % Load on Resin (%), X-Axis = Cycle (m³)
const chartGeometry = useMemo(() => {
  const W = 920;
  const H = 400;
  const padL = 72;
  const padR = 42;
  const padT = 28;
  const padB = 56;

  const chartRows = processedCycles;

  const maxVol =
    chartRows.length > 0
      ? Math.max(
        plantSummary.totalVolume,
        plantSummary.predictedBreakthroughVolume,
        plantSummary.predictedCutoffVolume,
        100
      ) * 1.05
      : 2000;
  const maxPct = Math.max(
    106,
    plantSummary.currentCombinedPercent * 1.06,
    plantSummary.currentSilicaPercent * 1.06
  );

  const xFor = (vol: number) => padL + (Math.min(maxVol, Math.max(0, vol)) / maxVol) * (W - padL - padR);
  const yFor = (pct: number) => padT + (1 - Math.min(maxPct, Math.max(0, pct)) / maxPct) * (H - padT - padB);

  const actualCombinedPoints = [
    { vol: 0, pct: 0, silicaPct: 0, label: 'Start (0 m³)', step: 0, stepIdx: -1 },
    ...chartRows.map((c, idx) => ({
      vol: c.cycleEnd,
      pct: c.combinedPercentLoad,
      silicaPct: c.silicaPercentLoad,
      label: c.label,
      step: c.step,
      stepIdx: idx,
    })),
  ];

  const combinedPolyline =
    chartRows.length > 0 ? actualCombinedPoints.map((p) => `${xFor(p.vol)},${yFor(p.pct)}`).join(' ') : '';
  const silicaPolyline =
    chartRows.length > 0 ? actualCombinedPoints.map((p) => `${xFor(p.vol)},${yFor(p.silicaPct)}`).join(' ') : '';

  const lastPt = actualCombinedPoints[actualCombinedPoints.length - 1];
  const projPoints: { vol: number; pct: number }[] = [];
  if (chartRows.length > 0 && lastPt.pct > 0 && lastPt.pct < 95 && plantSummary.predictedCutoffVolume > lastPt.vol) {
    projPoints.push({ vol: plantSummary.predictedCutoffVolume, pct: 95 });
  }
  if (chartRows.length > 0 && lastPt.pct > 0 && lastPt.pct < 100 && plantSummary.predictedBreakthroughVolume > lastPt.vol) {
    projPoints.push({ vol: plantSummary.predictedBreakthroughVolume, pct: 100 });
  }

  const forecastPolyline =
    projPoints.length > 0
      ? [lastPt, ...projPoints].map((p) => `${xFor(p.vol)},${yFor(p.pct)}`).join(' ')
      : '';

  // Generate 6 evenly spaced X-axis ticks for Cycle (m³)
  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio) => Number((maxVol * ratio).toFixed(0)));

  // Well-spaced Y-axis ticks that never overlap (includes 90% warning & 95% stop)
  const yTicks = [0, 20, 40, 60, 80, 90, 95];

  return {
    W,
    H,
    padL,
    padR,
    padT,
    padB,
    maxVol,
    maxPct,
    xTicks,
    yTicks,
    xFor,
    yFor,
    actualCombinedPoints,
    combinedPolyline,
    silicaPolyline,
    forecastPolyline,
  };
}, [processedCycles, plantSummary]);

return (
  <div className="space-y-5">
    {/* 1. Compact Balanced Header */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--line)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <ChartNoAxesCombined className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-[var(--ink)] tracking-tight truncate">
            {isTh
              ? 'การทำนายจำนวนรอบของปริมาตรน้ำในระบบ Mixed bed'
              : 'Mixed Bed Water Volume Cycle Prediction'}
          </h1>
          <p className="text-xs text-[var(--ink-soft)] truncate">
            {isTh
              ? 'เกณฑ์จุดแจ้งเตือนระบบ 90% และจุดหยุดระบบ 95%'
              : 'System warning threshold at 90% and system stop at 95%'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsBatchBrowserOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--panel)] hover:bg-[var(--sidebar-hover)] text-[var(--ink)] border border-[var(--line)] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <History className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>
            {isTh ? `ชุดที่บันทึก (${savedBatches.length})` : `Saved Batches (${savedBatches.length})`}
          </span>
        </button>

        <button
          type="button"
          onClick={handleStartNewBatch}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--panel)] hover:bg-[var(--sidebar-hover)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--line)] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-500" />
          <span>{isTh ? 'เริ่มชุดใหม่' : 'New Batch'}</span>
        </button>
      </div>
    </div>

    {/* Legacy Consolidation Banner (only if legacy single rows exist) */}
    <AnimatePresence>
      {legacySingleRowRecords.length > 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isTh
                ? `พบข้อมูลแบบแยกแถวเดิม ${legacySingleRowRecords.length} รายการ`
                : `Found ${legacySingleRowRecords.length} legacy single-row records`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleConsolidateLegacyRecords}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
          >
            {isTh ? 'รวมเป็น 1 ชุดข้อมูล' : 'Merge into 1 Batch'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Active Batch Edit Mode Banner */}
    <AnimatePresence>
      {editingBatchId && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
            <FolderOpen className="w-4 h-4 text-sky-500 shrink-0" />
            <span>
              {isTh ? 'กำลังแก้ไขชุดข้อมูล: ' : 'Editing Batch: '}
              <strong className="text-sky-600 dark:text-sky-400">{batchName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRevertCurrentBatchChanges}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--line)] font-semibold text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isTh ? 'คืนค่าเดิม' : 'Revert'}</span>
            </button>
            <button
              type="button"
              onClick={handleStartNewBatch}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-500/20 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>{isTh ? 'ออกจากโหมดแก้ไข' : 'Exit'}</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Dedicated Production Line Switcher: Separate Train A & Train B Workspaces */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(['A', 'B'] as const).map((tVal) => {
        const isCurrent = train === tVal;
        const tWorkspace = trainWorkspaces[tVal];
        const tSavedCount = tVal === 'A' ? savedBatchesTrainA.length : savedBatchesTrainB.length;
        return (
          <button
            key={tVal}
            type="button"
            onClick={() => setTrain(tVal)}
            className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${isCurrent
                ? tVal === 'A'
                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-2xs'
                  : 'bg-sky-500/10 border-sky-500/40 shadow-2xs'
                : 'bg-[var(--panel)] border-[var(--line)] hover:border-[var(--accent)]/50 opacity-80 hover:opacity-100'
              }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-base shrink-0 ${isCurrent
                    ? tVal === 'A'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-sky-600 text-white'
                    : 'bg-[var(--bg)] text-[var(--ink-soft)] border border-[var(--line)]'
                  }`}
              >
                {tVal}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-[var(--ink)] truncate">
                    {`Mixed Bed Train ${tVal}`}
                  </span>
                  {isCurrent && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tVal === 'A'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                          : 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                        }`}
                    >
                      {isTh ? 'กำลังใช้งาน' : 'Active'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-soft)] truncate">
                  {tWorkspace.batchName} ·{' '}
                  <span className="font-mono font-semibold text-[var(--ink)]">
                    {tWorkspace.rows.length} {isTh ? 'รอบในตาราง' : 'steps'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right font-mono tabular-nums shrink-0">
              <div className="text-xs text-[var(--ink-soft)]">
                {isTh ? 'บันทึกแล้ว' : 'Saved'}
              </div>
              <div className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {tSavedCount} {isTh ? 'ชุด' : 'sets'}
              </div>
            </div>
          </button>
        );
      })}
    </div>

    {/* 2. TOP SECTION: Input Parameters & Batch Configuration (Separated per Train A / Train B) */}
    <div className="rounded-2xl bg-[var(--panel)] border border-[var(--line)] overflow-hidden">
      {/* Batch Config Top Sub-Bar */}
      <div className="p-3.5 sm:p-4 bg-[var(--bg)]/40 border-b border-[var(--line)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          {/* Batch Name */}
          <div className="space-y-1">
            <label className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] flex items-center gap-1.5 truncate">
              <Layers className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                {isTh
                  ? `ชื่อชุดข้อมูล (Train ${train})`
                  : `Batch Name (Train ${train})`}
              </span>
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
            />
          </div>

          {/* Benchmark Quick Loaders (Filtered by Active Train A or Train B) */}
          <div className="space-y-1">
            <label className="text-xs sm:text-[13px] font-semibold text-[var(--ink-soft)] block truncate">
              {isTh
                ? `โหลดชุดข้อมูลอ้างอิง (สายการผลิต Train ${train})`
                : `Load Benchmark (Train ${train})`}
            </label>
            {train === 'A' ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('A1')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap truncate"
                  title="Train A ชุดที่ 1 (15 รอบ · 1,728.29 m³)"
                >
                  {isTh ? 'ชุดที่ 1 A1 (15 รอบ)' : 'Set A1 (15 steps)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('A2')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer whitespace-nowrap truncate"
                  title="Train A ชุดที่ 2 (40 รอบ · 1,902.84 m³)"
                >
                  {isTh ? 'ชุดที่ 2 A2 (40 รอบ)' : 'Set A2 (40 steps)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('A3')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-teal-600 dark:text-teal-400 cursor-pointer whitespace-nowrap truncate"
                  title="Train A ชุดที่ 3 (24 รอบ · 1,771.10 m³)"
                >
                  {isTh ? 'ชุดที่ 3 A3 (24 รอบ)' : 'Set A3 (24 steps)'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('B1')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer whitespace-nowrap truncate"
                  title="Train B ชุดที่ 1 (25 รอบ · 2,014.38 m³)"
                >
                  {isTh ? 'ชุดที่ 1 B1 (25 รอบ)' : 'Set B1 (25 steps)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('B2')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer whitespace-nowrap truncate"
                  title="Train B ชุดที่ 2 (38 รอบ · 2,104.16 m³)"
                >
                  {isTh ? 'ชุดที่ 2 B2 (38 รอบ)' : 'Set B2 (38 steps)'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBenchmark('B3')}
                  className="py-2 px-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-cyan-600 dark:text-cyan-400 cursor-pointer whitespace-nowrap truncate"
                  title="Train B ชุดที่ 3 (6 รอบ · 1,938.47 m³)"
                >
                  {isTh ? 'ชุดที่ 3 B3 (6 รอบ)' : 'Set B3 (6 steps)'}
                </button>
              </div>
            )}
                </div>

                {/* Estimate maximum conductivity capacity(mol) */}
                <div className="space-y-1">
                  <label className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] block leading-snug">
                    Estimate maximum conductivity capacity(mol)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={condCapacity}
                    onChange={(e) => setCondCapacity(e.target.value)}
                    placeholder={train === 'B' ? '106.47' : '73.91'}
                    className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                  />
                </div>

                {/* Estimate maximum silica capacity(mol) */}
                <div className="space-y-1">
                  <label className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] block leading-snug">
                    Estimate maximum silica capacity(mol)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={silicaCapacity}
                    onChange={(e) => setSilicaCapacity(e.target.value)}
                    placeholder={train === 'B' ? '5.93' : '5.68'}
                    className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                  />
                </div>
              </div>
        </div>

          {/* Input Parameter Header + Toggle 6-Step Formulas (Hidden by default) */}
          <div className="px-4 sm:px-5 py-3 bg-[var(--bg)]/60 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${train === 'A'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  }`}
              >
                Train {train}
              </span>
              <span>
                {isTh
                  ? `ข้อมูลนำเข้า (Input Parameter) · เพิ่มรอบที่ ${processedCycles.length + 1}`
                  : `Input Parameters · Add Step ${processedCycles.length + 1}`}
              </span>
            </h2>

            <button
              type="button"
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="text-xs text-[var(--accent)] font-semibold flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg bg-[var(--panel)] border border-[var(--line)] hover:bg-[var(--sidebar-hover)] transition-colors whitespace-nowrap"
            >
              <Info className="w-3.5 h-3.5" />
              <span>
                {showFormulaDetails
                  ? isTh
                    ? 'ซ่อนสูตรคำนวณ'
                    : 'Hide Calculation Formulas'
                  : isTh
                    ? 'แสดงสูตรการคำนวณ'
                    : 'Show Calculation Formulas'}
              </span>
              {showFormulaDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Input Parameter Fields (Default placeholders 0.00 / 0.000 when no previous cycle exists) */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <label className="text-xs sm:text-[13px] font-bold text-[var(--ink)] block leading-snug">Cycle (m³)</label>
                <input
                  type="number"
                  step="0.01"
                  value={inputCycle}
                  onChange={(e) => setInputCycle(e.target.value)}
                  placeholder={lastCycle ? `${lastCycle.cycleEnd.toFixed(2)}` : '0.00'}
                  className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-[13px] font-bold text-[var(--ink)] block leading-snug">
                  Silica MB Inlet/RO Outlet (ppb)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={inputSilicaIn}
                  onChange={(e) => setInputSilicaIn(e.target.value)}
                  placeholder={lastCycle ? `${lastCycle.silicaIn.toFixed(2)}` : '0.00'}
                  className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-[13px] font-bold text-[var(--ink)] block leading-snug">
                  Silica MB Outlet (ppb)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={inputSilicaOut}
                  onChange={(e) => setInputSilicaOut(e.target.value)}
                  placeholder={lastCycle ? `${lastCycle.silicaOut.toFixed(2)}` : '0.00'}
                  className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-[13px] font-bold text-[var(--ink)] block leading-snug">
                  Cond. MB Inlet/RO Outlet (µS/cm)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={inputCondIn}
                  onChange={(e) => setInputCondIn(e.target.value)}
                  placeholder={lastCycle ? `${lastCycle.condIn.toFixed(3)}` : '0.000'}
                  className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs sm:text-[13px] font-bold text-[var(--ink)] block leading-snug">
                  Cond MB Outlet (µS/cm)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={inputCondOut}
                  onChange={(e) => setInputCondOut(e.target.value)}
                  placeholder={lastCycle ? `${lastCycle.condOut.toFixed(3)}` : '0.000'}
                  className="w-full text-xs sm:text-sm font-mono tabular-nums font-bold px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/50 placeholder:font-normal"
                />
              </div>
            </div>

            {/* Label + Add Row Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Tag className="w-3.5 h-3.5 text-[var(--ink-soft)] shrink-0" />
                <input
                  type="text"
                  value={inputLabel}
                  onChange={(e) => setInputLabel(e.target.value)}
                  placeholder={isTh ? `รอบที่ ${processedCycles.length + 1}` : `Step ${processedCycles.length + 1}`}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]/40"
                />
              </div>

              <button
                type="button"
                onClick={handleAddRowToBatch}
                disabled={!canAddRow}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isTh ? `เพิ่มรอบที่ ${processedCycles.length + 1}` : `Add Step ${processedCycles.length + 1}`}
                </span>
              </button>
            </div>

            {/* Feedback Banners */}
            <AnimatePresence>
              {saveSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{saveSuccessMessage}</span>
                </motion.div>
              )}

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-semibold"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsible Formula & Live Substitution Cards (Linked directly from calculation table cells) */}
            <AnimatePresence initial={false}>
              {showFormulaDetails && (
                <motion.div
                  id="formula-calculation-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--bg)] border border-[var(--line)] space-y-4 text-xs font-mono tabular-nums">
                    {/* Active Formula Navigation Banner with Quick Return Button */}
                    {highlightedFormula && (
                      <div className="p-3 rounded-xl bg-amber-500/15 border-2 border-amber-500/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-sans">
                        <div className="flex items-start sm:items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                          <div className="text-xs">
                            <span className="font-bold text-amber-700 dark:text-amber-300">
                              {isTh
                                ? `กำลังไฮไลท์สูตรของค่า "${highlightedFormula.columnLabel}" (${highlightedFormula.displayValue}) จากรอบที่ #${highlightedFormula.step}`
                                : `Highlighting formula for "${highlightedFormula.columnLabel}" (${highlightedFormula.displayValue}) from Step #${highlightedFormula.step}`}
                            </span>
                            <span className="block sm:inline sm:ml-2 text-[11px] text-[var(--ink-soft)]">
                              {isTh
                                ? 'กรอบสีเหลืองที่กระพริบด้านล่างคือสูตรและวิธีแทนค่าของตัวเลขที่คุณคลิก'
                                : 'The flashing yellow card below shows the exact formula and substitution.'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleReturnToTable}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap shadow-xs"
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>{isTh ? 'กลับไปยังตารางเดิม' : 'Back to Table'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHighlightedFormula(null)}
                            className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--panel)] cursor-pointer"
                            title={isTh ? 'ล้างไฮไลท์' : 'Clear highlight'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Header & Step Selector */}
                    <div className="font-sans flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5">
                      <div className="space-y-0.5">
                        <div className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                          {isTh
                            ? 'ส่วนคำนวณและแสดงสูตร: Conductivity (Cond.), Silica (SiO₂) และการทำนาย Cycle'
                            : 'Formula Inspector: Conductivity (Cond.), Silica (SiO₂) & Cycle Prediction'}
                        </div>
                        <div className="text-[11px] text-[var(--ink-soft)]">
                          {isTh
                            ? 'แสดงสูตรการคำนวณ วิธีแทนค่ารายรอบ และคำอธิบายสั้น ๆ · คลิกที่ตัวเลขในตารางด้านล่างเพื่อเอาออกมายังสูตรที่ต้องการได้ทันที'
                            : 'Shows calculation formulas, live step substitution, and short explanations · Click any calculated value in the table below to bring out the desired formula immediately.'}
                        </div>
                      </div>

                      <div className="flex items-center flex-wrap gap-2">
                        {processedCycles.length > 0 && !liveFormulaCalc.isTypingAny && (
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                            {processedCycles.map((c, idx) => {
                              const isSelected = inspectedStepIndex === idx;
                              return (
                                <button
                                  key={c.rowId}
                                  type="button"
                                  onClick={() => setInspectedStepIndex(idx)}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold cursor-pointer transition-colors shrink-0 whitespace-nowrap ${isSelected
                                      ? 'bg-[var(--accent)] text-white'
                                      : 'bg-[var(--panel)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--line)]'
                                    }`}
                                >
                                  #{c.step}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {hasCycleData && (
                          <button
                            type="button"
                            onClick={handleReturnToTable}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--panel)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-xs font-semibold text-[var(--accent)] cursor-pointer whitespace-nowrap"
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>{isTh ? 'ไปที่ตารางข้อมูล' : 'Go to Table'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Real-time Validation Warning Banner */}
                    {liveFormulaCalc.warnings.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-700 dark:text-rose-300 font-sans space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                          <span>แจ้งเตือนตรวจสอบค่าที่ไม่สมเหตุสมผล:</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] space-y-0.5">
                          {liveFormulaCalc.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Two Independent Calculator Sections: [1. Conductivity] & [2. Silica] */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* ส่วนที่ 1: Conductivity (Cond.) */}
                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
                        <div className="border-b border-[var(--line)] pb-2 space-y-1 font-sans">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400">
                              {isTh ? 'ส่วนที่ 1: Conductivity (Cond.)' : 'Section 1: Conductivity (Cond.)'}
                            </h4>
                            <span className="text-xs font-mono font-semibold text-[var(--ink-soft)]">
                              Estimate maximum conductivity capacity(mol) = {liveFormulaCalc.activeCondCap.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            {isTh
                              ? 'Input ที่ผู้ใช้กรอก: 1. Cycle (m³) · 2. Cond. MB Inlet (µS/cm) · 3. Cond. MB Outlet (µS/cm)'
                              : 'User Inputs: 1. Cycle (m³) · 2. Cond. MB Inlet (µS/cm) · 3. Cond. MB Outlet (µS/cm)'}
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* Cond Step 1: ΔV */}
                          <div id="formula-card-cond_dv" className={getFormulaCardClass('cond_dv')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '1. ระยะห่าง Cycle (ΔV, m³) = Cycle รวมปัจจุบัน − Cycle รอบก่อนหน้า'
                                : '1. Cycle Interval (ΔV, m³) = Current Cumulative Cycle − Previous Cycle'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.currentCycleVol.toFixed(2)} − {liveFormulaCalc.prevCycleVol.toFixed(2)} ={' '}
                              <strong className="text-[var(--ink)]">{liveFormulaCalc.distance.toFixed(2)} m³</strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_dv',
                              'คำนวณปริมาตรน้ำที่ผลิตได้ในรอบนี้ (ΔV) โดยนำปริมาตรสะสมของรอบปัจจุบันลบด้วยปริมาตรสะสมของรอบก่อนหน้า',
                              'Calculates the water volume produced in this step (ΔV) by subtracting the previous cumulative volume from the current cumulative volume.'
                            )}
                          </div>

                          {/* Cond Step 2: Cond Inlet (mol/L) */}
                          <div id="formula-card-cond_in_mol_l" className={getFormulaCardClass('cond_in_mol_l')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              2. Cond. Inlet (mol/L) = Cond. MB Inlet (µS/cm) ÷ (1000 × 126.45)
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.condInVal.toFixed(3)} ÷ (1000 × 126.45) ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.condConcInMolL.toFixed(8)} mol/L
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_in_mol_l',
                              'แปลงค่าการนำไฟฟ้าขาเข้า (µS/cm) เป็นความเข้มข้นโมลต่อลิตร (mol/L) โดยใช้ค่า Limiting molar conductivity ของ NaCl = 126.45',
                              'Converts inlet conductivity (µS/cm) to molar concentration (mol/L) using the limiting molar conductivity of NaCl = 126.45.'
                            )}
                          </div>

                          {/* Cond Step 3: Cond Inlet (mol/m³) */}
                          <div id="formula-card-cond_in_mol_m3" className={getFormulaCardClass('cond_in_mol_m3')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              3. Cond. Inlet (mol/m³) = Cond. Inlet (mol/L) × 1000
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.condConcInMolL.toFixed(8)} × 1000 ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.condConcInMolM3.toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_in_mol_m3',
                              'แปลงความเข้มข้นไอออนขาเข้า (mol/L) เป็นโมลต่อลูกบาศก์เมตร (mol/m³) โดยคูณ 1,000',
                              'Converts inlet ion concentration (mol/L) to moles per cubic meter (mol/m³) by multiplying by 1,000.'
                            )}
                          </div>

                          {/* Cond Step 4: Cond Outlet (mol/L) */}
                          <div id="formula-card-cond_out_mol_l" className={getFormulaCardClass('cond_out_mol_l')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              4. Cond. Outlet (mol/L) = Cond. MB Outlet (µS/cm) ÷ (1000 × 126.45)
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.condOutVal.toFixed(3)} ÷ (1000 × 126.45) ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.condConcOutMolL.toFixed(9)} mol/L
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_out_mol_l',
                              'แปลงค่าการนำไฟฟ้าขาออก (µS/cm) เป็นความเข้มข้นโมลต่อลิตร (mol/L) โดยใช้ค่า Limiting molar conductivity ของ NaCl = 126.45',
                              'Converts outlet conductivity (µS/cm) to molar concentration (mol/L) using the limiting molar conductivity of NaCl = 126.45.'
                            )}
                          </div>

                          {/* Cond Step 5: Cond Outlet (mol/m³) */}
                          <div id="formula-card-cond_out_mol_m3" className={getFormulaCardClass('cond_out_mol_m3')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              5. Cond. Outlet (mol/m³) = Cond. Outlet (mol/L) × 1000
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.condConcOutMolL.toFixed(9)} × 1000 ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.condConcOutMolM3.toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_out_mol_m3',
                              'แปลงความเข้มข้นไอออนขาออก (mol/L) เป็นโมลต่อลูกบาศก์เมตร (mol/m³) โดยคูณ 1,000',
                              'Converts outlet ion concentration (mol/L) to moles per cubic meter (mol/m³) by multiplying by 1,000.'
                            )}
                          </div>

                          {/* Cond Step 6: ΔCond. (mol/m³) */}
                          <div id="formula-card-cond_delta" className={getFormulaCardClass('cond_delta')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              6. ΔCond. (mol/m³) = Cond. Inlet (mol/m³) − Cond. Outlet (mol/m³)
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.condConcInMolM3.toFixed(6)} − {liveFormulaCalc.condConcOutMolM3.toFixed(6)} ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {(liveFormulaCalc.condConcInMolM3 - liveFormulaCalc.condConcOutMolM3).toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_delta',
                              'ผลต่างความเข้มข้นไอออนจากค่าการนำไฟฟ้า ที่ถูกเรซินใช้ไปต่อน้ำ 1 ลูกบาศก์เมตรในรอบนี้',
                              'Difference in ion concentration from conductivity consumed by the resin per 1 m³ of water in this step.'
                            )}
                          </div>

                          {/* Cond Step 7: Weighted Average of Cond. */}
                          <div id="formula-card-cond_wa" className={getFormulaCardClass('cond_wa')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              7. Weighted Average of Cond. (mol/m³) = Σ(ΔV × ΔCond.) ÷ Σ(ΔV)
                            </div>
                            {inspectorWeightedRow && inspectorWeightedRow.waCond !== null && (
                              <div className="text-[var(--ink-soft)]">
                                {isTh
                                  ? `ค่าเฉลี่ยถ่วงน้ำหนักสะสมตั้งแต่รอบที่ 1 ถึงรอบที่ #${inspectorWeightedRow.step} = `
                                  : `Cumulative weighted average from Step 1 to Step #${inspectorWeightedRow.step} = `}
                                <strong className="text-sky-600 dark:text-sky-400">
                                  {fmtNum(inspectorWeightedRow.waCond, 6)} mol/m³
                                </strong>
                              </div>
                            )}
                            {renderHighlightedFormulaBadge(
                              'cond_wa',
                              'ค่าเฉลี่ยถ่วงน้ำหนักสะสมของค่าการนำไฟฟ้า (Conductivity) คำนวณจากผลรวมของ (ΔV × ΔCond.) หารด้วยผลรวมของ ΔV ตั้งแต่รอบแรกจนถึงรอบปัจจุบัน',
                              'Cumulative weighted average of conductivity (Conductivity), calculated from the sum of (ΔV × ΔCond.) divided by the sum of ΔV from the first step to the current step.'
                            )}
                          </div>

                          {/* Cond Step 8: Cond Ion ที่ใช้ไป (mol) */}
                          <div id="formula-card-cond_removed" className={getFormulaCardClass('cond_removed')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '8. Ion ที่ใช้ไป (Cond., mol) = ΔCond. (mol/m³) × ΔV (m³)'
                                : '8. Ions Consumed (Cond., mol) = ΔCond. (mol/m³) × ΔV (m³)'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.condConcInMolM3.toFixed(6)} − {liveFormulaCalc.condConcOutMolM3.toFixed(6)}) ×{' '}
                              {liveFormulaCalc.distance.toFixed(2)} ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.condIonsRemoved.toFixed(3)} mol
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_removed',
                              'ผลต่างความเข้มข้นไอออนจากค่าการนำไฟฟ้า × ปริมาตรน้ำที่ผลิตได้ในแต่ละรอบ',
                              'Difference in ion concentration from conductivity × water volume produced in each step.'
                            )}
                          </div>

                          {/* Cond Step 9: Ion load cond. สะสม (mol) */}
                          <div id="formula-card-cond_cum_load" className={getFormulaCardClass('cond_cum_load')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '9. Ion load cond. (mol) = Σ(Cond. ion ที่ใช้ไป)'
                                : '9. Ion load cond. (mol) = Σ(Cond. ions consumed)'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.prevCondLoad.toFixed(3)} + {liveFormulaCalc.condIonsRemoved.toFixed(3)} ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.cumCondLoad.toFixed(3)} mol
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_cum_load',
                              'ปริมาณไอออน Conductivity สะสมในเรซินตั้งแต่รอบแรกจนถึงรอบปัจจุบัน',
                              'Cumulative Conductivity ions loaded in the resin from the first step to the current step.'
                            )}
                          </div>

                          {/* Cond Step 10: %Ion load cond. */}
                          <div id="formula-card-cond_pct_load" className={getFormulaCardClass('cond_pct_load')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              10. %Ion load cond. = (Ion load cond. ÷ Estimate maximum conductivity capacity) × 100
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.cumCondLoad.toFixed(3)} ÷ {liveFormulaCalc.activeCondCap.toFixed(2)}) × 100 ={' '}
                              <strong className="text-sky-600 dark:text-sky-400">
                                {liveFormulaCalc.pctCondLoad.toFixed(3)}%
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'cond_pct_load',
                              'สัดส่วนร้อยละของความจุเรซินในส่วน Conductivity ที่ถูกใช้งานไปแล้วเทียบกับความจุสูงสุด',
                              'Percentage of maximum conductivity resin capacity consumed up to this step.'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ส่วนที่ 2: Silica (SiO₂) */}
                      <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
                        <div className="border-b border-[var(--line)] pb-2 space-y-1 font-sans">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              {isTh ? 'ส่วนที่ 2: Silica (SiO₂)' : 'Section 2: Silica (SiO₂)'}
                            </h4>
                            <span className="text-xs font-mono font-semibold text-[var(--ink-soft)]">
                              MW SiO₂ = 60.08 g/mol · Capacity = {liveFormulaCalc.activeSilicaCap.toFixed(2)} mol
                            </span>
                          </div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            {isTh
                              ? 'Input ที่ผู้ใช้กรอก: 1. Cycle (m³) · 2. Silica MB Inlet (ppb) · 3. Silica MB Outlet (ppb)'
                              : 'User Inputs: 1. Cycle (m³) · 2. Silica MB Inlet (ppb) · 3. Silica MB Outlet (ppb)'}
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* Silica Step 1: ΔV */}
                          <div id="formula-card-silica_dv" className={getFormulaCardClass('silica_dv')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '1. ระยะห่าง Cycle (ΔV, m³) = Cycle รวมปัจจุบัน − Cycle รอบก่อนหน้า'
                                : '1. Cycle Interval (ΔV, m³) = Current Cumulative Cycle − Previous Cycle'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.currentCycleVol.toFixed(2)} − {liveFormulaCalc.prevCycleVol.toFixed(2)} ={' '}
                              <strong className="text-[var(--ink)]">{liveFormulaCalc.distance.toFixed(2)} m³</strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_dv',
                              'คำนวณปริมาตรน้ำที่ผลิตได้ในรอบนี้ (ΔV) โดยนำปริมาตรสะสมของรอบปัจจุบันลบด้วยปริมาตรสะสมของรอบก่อนหน้า',
                              'Calculates the water volume produced in this step (ΔV) by subtracting the previous cumulative volume from the current cumulative volume.'
                            )}
                          </div>

                          {/* Silica Step 2: Silica Inlet (mol/L) */}
                          <div id="formula-card-silica_in_mol_l" className={getFormulaCardClass('silica_in_mol_l')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              2. Silica Inlet (mol/L) = (Silica MB Inlet (ppb) ÷ 1,000,000) ÷ 60.08
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.silicaInVal.toFixed(2)} ÷ 1,000,000) ÷ 60.08 ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.silicaConcInMolL.toFixed(7)} mol/L
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_in_mol_l',
                              'แปลงค่าซิลิกาขาเข้า (ppb, µg/L) เป็นความเข้มข้นโมลต่อลิตร (mol/L) แล้วหารด้วยมวลโมเลกุลของ Silica (60.08 g/mol)',
                              'Converts inlet silica (ppb, µg/L) to molar concentration (mol/L) and divides by the molecular weight of Silica (60.08 g/mol).'
                            )}
                          </div>

                          {/* Silica Step 3: Silica Inlet (mol/m³) */}
                          <div id="formula-card-silica_in_mol_m3" className={getFormulaCardClass('silica_in_mol_m3')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              3. Silica Inlet (mol/m³) = Silica Inlet (mol/L) × 1000
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.silicaConcInMolL.toFixed(7)} × 1000 ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.silicaConcInMolM3.toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_in_mol_m3',
                              'แปลงความเข้มข้นไอออนซิลิกาขาเข้า (mol/L) เป็นโมลต่อลูกบาศก์เมตร (mol/m³) โดยคูณ 1,000',
                              'Converts inlet silica ion concentration (mol/L) to moles per cubic meter (mol/m³) by multiplying by 1,000.'
                            )}
                          </div>

                          {/* Silica Step 4: Silica Outlet (mol/L) */}
                          <div id="formula-card-silica_out_mol_l" className={getFormulaCardClass('silica_out_mol_l')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              4. Silica Outlet (mol/L) = (Silica MB Outlet (ppb) ÷ 1,000,000) ÷ 60.08
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.silicaOutVal.toFixed(2)} ÷ 1,000,000) ÷ 60.08 ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.silicaConcOutMolL.toFixed(8)} mol/L
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_out_mol_l',
                              'แปลงค่าซิลิกาขาออก (ppb, µg/L) เป็นความเข้มข้นโมลต่อลิตร (mol/L) แล้วหารด้วยมวลโมเลกุลของ Silica (60.08 g/mol)',
                              'Converts outlet silica (ppb, µg/L) to molar concentration (mol/L) and divides by the molecular weight of Silica (60.08 g/mol).'
                            )}
                          </div>

                          {/* Silica Step 5: Silica Outlet (mol/m³) */}
                          <div id="formula-card-silica_out_mol_m3" className={getFormulaCardClass('silica_out_mol_m3')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              5. Silica Outlet (mol/m³) = Silica Outlet (mol/L) × 1000
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.silicaConcOutMolL.toFixed(8)} × 1000 ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.silicaConcOutMolM3.toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_out_mol_m3',
                              'แปลงความเข้มข้นไอออนซิลิกาขาออก (mol/L) เป็นโมลต่อลูกบาศก์เมตร (mol/m³) โดยคูณ 1,000',
                              'Converts outlet silica ion concentration (mol/L) to moles per cubic meter (mol/m³) by multiplying by 1,000.'
                            )}
                          </div>

                          {/* Silica Step 6: ΔSilica (mol/m³) */}
                          <div id="formula-card-silica_delta" className={getFormulaCardClass('silica_delta')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              6. ΔSilica (mol/m³) = Silica Inlet (mol/m³) − Silica Outlet (mol/m³)
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.silicaConcInMolM3.toFixed(6)} − {liveFormulaCalc.silicaConcOutMolM3.toFixed(6)} ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {(liveFormulaCalc.silicaConcInMolM3 - liveFormulaCalc.silicaConcOutMolM3).toFixed(6)} mol/m³
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_delta',
                              'ผลต่างความเข้มข้นไอออนจากค่าซิลิกา ที่ถูกเรซินใช้ไปต่อน้ำ 1 ลูกบาศก์เมตรในรอบนี้',
                              'Difference in ion concentration from silica consumed by the resin per 1 m³ of water in this step.'
                            )}
                          </div>

                          {/* Silica Step 7: Weighted Average of Silica */}
                          <div id="formula-card-silica_wa" className={getFormulaCardClass('silica_wa')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              7. Weighted Average of Silica (mol/m³) = Σ(ΔV × ΔSilica) ÷ Σ(ΔV)
                            </div>
                            {inspectorWeightedRow && inspectorWeightedRow.waSilica !== null && (
                              <div className="text-[var(--ink-soft)]">
                                {isTh
                                  ? `ค่าเฉลี่ยถ่วงน้ำหนักสะสมตั้งแต่รอบที่ 1 ถึงรอบที่ #${inspectorWeightedRow.step} = `
                                  : `Cumulative weighted average from Step 1 to Step #${inspectorWeightedRow.step} = `}
                                <strong className="text-indigo-600 dark:text-indigo-400">
                                  {fmtNum(inspectorWeightedRow.waSilica, 6)} mol/m³
                                </strong>
                              </div>
                            )}
                            {renderHighlightedFormulaBadge(
                              'silica_wa',
                              'ค่าเฉลี่ยถ่วงน้ำหนักสะสมของปริมาณซิลิกา (Silica) คำนวณจากผลรวมของ (ΔV × ΔSilica) หารด้วยผลรวมของ ΔV ตั้งแต่รอบแรกจนถึงรอบปัจจุบัน',
                              'Cumulative weighted average of silica (Silica), calculated from the sum of (ΔV × ΔSilica) divided by the sum of ΔV from the first step to the current step.'
                            )}
                          </div>

                          {/* Silica Step 8: Ion ที่ใช้ไป (mol) */}
                          <div id="formula-card-silica_removed" className={getFormulaCardClass('silica_removed')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '8. Ion ที่ใช้ไป (Silica, mol) = ΔSilica (mol/m³) × ΔV (m³)'
                                : '8. Ions Consumed (Silica, mol) = ΔSilica (mol/m³) × ΔV (m³)'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.silicaConcInMolM3.toFixed(6)} − {liveFormulaCalc.silicaConcOutMolM3.toFixed(6)}) ×{' '}
                              {liveFormulaCalc.distance.toFixed(2)} ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.silicaIonsRemoved.toFixed(3)} mol
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_removed',
                              'ผลต่างความเข้มข้นไอออนจากค่าซิลิกา × ปริมาตรน้ำที่ผลิตได้ในแต่ละรอบ',
                              'Difference in ion concentration from silica × water volume produced in each step.'
                            )}
                          </div>

                          {/* Silica Step 9: Ion load silica (mol) */}
                          <div id="formula-card-silica_cum_load" className={getFormulaCardClass('silica_cum_load')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              {isTh
                                ? '9. Ion load silica (mol) = Σ(Silica ion ที่ใช้ไป)'
                                : '9. Ion load silica (mol) = Σ(Silica ions consumed)'}
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              {liveFormulaCalc.prevSilicaLoad.toFixed(3)} + {liveFormulaCalc.silicaIonsRemoved.toFixed(3)} ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.cumSilicaLoad.toFixed(3)} mol
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_cum_load',
                              'ปริมาณไอออน Silica สะสมในเรซินตั้งแต่รอบแรกจนถึงรอบปัจจุบัน',
                              'Cumulative Silica ions loaded in the resin from the first step to the current step.'
                            )}
                          </div>

                          {/* Silica Step 10: %Ion load silica. */}
                          <div id="formula-card-silica_pct_load" className={getFormulaCardClass('silica_pct_load')}>
                            <div className="font-sans font-bold text-[var(--ink)]">
                              10. %Ion load silica. = (Ion load silica ÷ Estimate maximum silica capacity) × 100
                            </div>
                            <div className="text-[var(--ink-soft)]">
                              ({liveFormulaCalc.cumSilicaLoad.toFixed(3)} ÷ {liveFormulaCalc.activeSilicaCap.toFixed(2)}) × 100 ={' '}
                              <strong className="text-indigo-600 dark:text-indigo-400">
                                {liveFormulaCalc.pctSilicaLoad.toFixed(3)}%
                              </strong>
                            </div>
                            {renderHighlightedFormulaBadge(
                              'silica_pct_load',
                              'สัดส่วนร้อยละของความจุเรซินในส่วน Silica ที่ถูกใช้งานไปแล้วเทียบกับความจุซิลิกาสูงสุด',
                              'Percentage of maximum silica resin capacity consumed up to this step.'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ส่วนที่ 3: สูตรทำนาย Cycle, Total Weighted Average, จุดแจ้งเตือน (90%) และจุดหยุดระบบ (95%) */}
                    <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-2.5">
                      <div className="text-xs sm:text-sm font-bold text-[var(--accent)] font-sans">
                        {isTh
                          ? 'ส่วนที่ 3: การทำนาย Cycle (Total Weighted Average, จุดแจ้งเตือนระบบ 90% และจุดหยุดระบบ 95%)'
                          : 'Section 3: Cycle Prediction (Total Weighted Average, 90% System Warning & 95% System Stop)'}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                        {/* Total Weighted Average */}
                        <div id="formula-card-pred_total_wa" className={getFormulaCardClass('pred_total_wa')}>
                          <div className="font-sans font-bold text-[var(--ink)]">
                            1. Total Weighted Average (mol/m³) = Weighted Average of Silica + Weighted Average of Cond.
                          </div>
                          <div className="text-[var(--ink-soft)]">
                            {inspectorWeightedRow && inspectorWeightedRow.totalWa !== null ? (
                              <>
                                {fmtNum(inspectorWeightedRow.waSilica, 6)} + {fmtNum(inspectorWeightedRow.waCond, 6)} ={' '}
                                <strong className="text-[var(--ink)]">{fmtNum(inspectorWeightedRow.totalWa, 6)} mol/m³</strong>
                              </>
                            ) : (
                              `${fmtNum(weightedPrediction.waSilica, 6)} + ${fmtNum(weightedPrediction.waCond, 6)} = ${fmtNum(
                                weightedPrediction.denominator,
                                6
                              )} mol/m³`
                            )}
                          </div>
                          {renderHighlightedFormulaBadge(
                            'pred_total_wa',
                            'ผลรวมของอัตราการใช้ความจุเรซินเฉลี่ยถ่วงน้ำหนัก (Silica + Conductivity) ต่อน้ำ 1 ลูกบาศก์เมตร ใช้เป็นตัวหารในการทำนายปริมาตรน้ำ',
                            'Combined volume-weighted average ion load rate (Silica + Conductivity) per m³, used as the divisor for volume prediction.'
                          )}
                        </div>

                        {/* จุดแจ้งเตือนระบบ (90%) */}
                        <div id="formula-card-pred_warn_90" className={getFormulaCardClass('pred_warn_90')}>
                          <div className="font-sans font-bold text-amber-600 dark:text-amber-400">
                            2. {isTh ? 'จุดแจ้งเตือนระบบ (90%)' : 'System Warning (90%)'} = {fmtNum(weightedPrediction.warnMol, 2)} mol ÷ (Weighted Average Silica + Weighted Average Cond.)
                          </div>
                          <div className="text-[var(--ink-soft)]">
                            {inspectorWeightedRow && inspectorWeightedRow.warnVolume !== null ? (
                              <>
                                {fmtNum(weightedPrediction.warnMol, 2)} ÷ {fmtNum(inspectorWeightedRow.totalWa, 6)} ={' '}
                                <strong className="text-amber-500">{fmtNum(inspectorWeightedRow.warnVolume, 2)} m³</strong>
                              </>
                            ) : (
                              `${fmtNum(weightedPrediction.warnMol, 2)} ÷ ${fmtNum(weightedPrediction.denominator, 6)} = ${fmtNum(
                                weightedPrediction.warnVolume,
                                2
                              )} m³`
                            )}
                          </div>
                          {renderHighlightedFormulaBadge(
                            'pred_warn_90',
                            `คาดการณ์ปริมาตรน้ำสะสมเมื่อเรซินถูกใช้งานถึง 90% ของความจุรวม (${fmtNum(weightedPrediction.warnMol, 2)} mol) เพื่อแจ้งเตือนเตรียมสลับ Train`,
                            `Predicted cumulative water volume when resin reaches 90% capacity (${fmtNum(weightedPrediction.warnMol, 2)} mol).`
                          )}
                        </div>

                        {/* จุดหยุดระบบ (95%) */}
                        <div id="formula-card-pred_stop_95" className={getFormulaCardClass('pred_stop_95')}>
                          <div className="font-sans font-bold text-rose-600 dark:text-rose-400">
                            3. {isTh ? 'จุดหยุดระบบ (95%)' : 'System Stop (95%)'} = {fmtNum(weightedPrediction.stopMol, 2)} mol ÷ (Weighted Average Silica + Weighted Average Cond.)
                          </div>
                          <div className="text-[var(--ink-soft)]">
                            {inspectorWeightedRow && inspectorWeightedRow.stopVolume !== null ? (
                              <>
                                {fmtNum(weightedPrediction.stopMol, 2)} ÷ {fmtNum(inspectorWeightedRow.totalWa, 6)} ={' '}
                                <strong className="text-rose-500">{fmtNum(inspectorWeightedRow.stopVolume, 2)} m³</strong>
                              </>
                            ) : (
                              `${fmtNum(weightedPrediction.stopMol, 2)} ÷ ${fmtNum(weightedPrediction.denominator, 6)} = ${fmtNum(
                                weightedPrediction.stopVolume,
                                2
                              )} m³`
                            )}
                          </div>
                          {renderHighlightedFormulaBadge(
                            'pred_stop_95',
                            `คาดการณ์ปริมาตรน้ำสะสมเมื่อเรซินถูกใช้งานถึง 95% ของความจุรวม (${fmtNum(weightedPrediction.stopMol, 2)} mol) ซึ่งเป็นจุดตัดรอบหยุดเดินระบบเพื่อ Regeneration`,
                            `Predicted cumulative water volume when resin reaches 95% capacity (${fmtNum(weightedPrediction.stopMol, 2)} mol) for regeneration.`
                          )}
                        </div>
                      </div>
                    </div>

                    {/* การคำนวณ Percent Load on Resin (Train A & Train B) */}
                    <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-2.5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[var(--line)] pb-2 font-sans">
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            การคำนวณ Percent Load on Resin
                          </div>
                          <div className="text-xs text-[var(--ink-soft)]">
                            สูตรทั่วไป: Percent Load on Resin (%) = [(Ion load Cond. + Ion load Silica) / Total Capacity] × 100
                          </div>
                        </div>
                        <div className="font-mono text-xs">
                          {liveFormulaCalc.condOutReady && liveFormulaCalc.silicaOutReady ? (
                            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-bold">
                              [({liveFormulaCalc.cumCondLoad.toFixed(3)} + {liveFormulaCalc.cumSilicaLoad.toFixed(3)}) / {liveFormulaCalc.activeTotalCap.toFixed(2)}] × 100 ={' '}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {liveFormulaCalc.combinedPctLoad.toFixed(3)}%
                              </strong>
                            </span>
                          ) : (
                            <span className="text-amber-500 font-sans text-xs">
                              รอการกรอกค่า Outlet ของทั้งสองส่วนเพื่อคำนวณ Percent Load on Resin (%)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                        {/* Train A Reference */}
                        <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            Train A
                          </div>
                          <ul className="space-y-0.5 text-[var(--ink-soft)] font-mono">
                            <li>• Estimate maximum conductivity capacity(mol) = <strong className="text-[var(--ink)]">73.91</strong></li>
                            <li>• Estimate maximum silica capacity(mol) = <strong className="text-[var(--ink)]">5.68</strong></li>
                            <li>• Total Capacity (100%) = 73.91 + 5.68 = <strong className="text-emerald-600 dark:text-emerald-400">79.59</strong></li>
                            <li className="font-sans">• จุดแจ้งเตือนระบบ (90%) = <strong className="text-amber-500">71.63 mol</strong> · จุดหยุดระบบ (95%) = <strong className="text-rose-500">75.61 mol</strong></li>
                          </ul>
                        </div>

                        {/* Train B Reference */}
                        <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
                          <div className="font-bold text-sky-600 dark:text-sky-400">
                            Train B
                          </div>
                          <ul className="space-y-0.5 text-[var(--ink-soft)] font-mono">
                            <li>• Estimate maximum conductivity capacity(mol) = <strong className="text-[var(--ink)]">106.47</strong></li>
                            <li className="font-sans">
                              • <span className="font-mono">Estimate maximum silica capacity(mol) = <strong className="text-[var(--ink)]">5.93</strong></span>
                            </li>
                            <li>• Total Capacity (100%) = 106.47 + 5.93 = <strong className="text-sky-600 dark:text-sky-400">112.40</strong></li>
                            <li className="font-sans">• จุดแจ้งเตือนระบบ (90%) = <strong className="text-amber-500">101.16 mol</strong> · จุดหยุดระบบ (95%) = <strong className="text-rose-500">106.78 mol</strong></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 3. Data Entry & Calculation Table Section (Shown only after rows are added) */}
        {hasCycleData && (
          <div
            id="data-entry-calc-table-section"
            className="p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] space-y-3.5"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-[var(--ink)] truncate">
                  {isTh
                    ? `ตารางบันทึกข้อมูล & คำนวณ (MB Train ${train})`
                    : `Data Entry & Calculation Table (MB Train ${train})`}
                  <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">
                    ({batchName} · {processedCycles.length} {isTh ? 'รอบ' : 'steps'})
                  </span>
                </h3>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSaveBatchHistory(false)}
                  disabled={isSaving || processedCycles.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {isSaving
                      ? isTh
                        ? 'กำลังบันทึก...'
                        : 'Saving...'
                      : editingBatchId
                        ? isTh
                          ? `อัปเดตชุดนี้ (${processedCycles.length} แถว)`
                          : `Update Batch (${processedCycles.length})`
                        : isTh
                          ? `บันทึกประวัติ (${processedCycles.length} แถว)`
                          : `Save History (${processedCycles.length})`}
                  </span>
                </button>

                {editingBatchId && processedCycles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSaveBatchHistory(true)}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--line)] text-[var(--ink)] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <CopyPlus className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isTh ? 'บันทึกเป็นชุดใหม่' : 'Save New'}</span>
                  </button>
                )}

                <ExportDataMenu
                  onExport={handleExportActiveBatch}
                  disabled={!hasCycleData}
                  isTh={isTh}
                  label={isTh ? 'ส่งออกไฟล์' : 'Export'}
                  variant="toolbar"
                />

                {processedCycles.length > 0 && (
                  <button
                    type="button"
                    onClick={requestClearWorkspace}
                    className="p-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                    title={isTh ? 'ล้างตาราง' : 'Clear table'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table Mode Selector Tabs (3 Tabs: Input Log, Silica, Conductivity) + View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                {[
                  {
                    id: 'input' as const,
                    label: isTh ? `1. บันทึกข้อมูล MB Train ${train}` : `1. MB Train ${train} Input Log`,
                  },
                  { id: 'silica' as const, label: isTh ? '2. การคำนวณ Silica' : '2. Silica Calculation' },
                  { id: 'cond' as const, label: isTh ? '3. การคำนวณ Conductivity' : '3. Conductivity Calculation' },
                  { id: 'weighted' as const, label: '4. Weighted Average' },
                  { id: 'predict' as const, label: isTh ? '5. ทำนาย Cycle' : '5. Cycle Prediction' },
                ].map((tab) => {
                  const active = tableTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTableTab(tab.id)}
                      className={`relative px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${active ? 'text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                        }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="tableModeActivePill"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 rounded-lg bg-[var(--accent)] -z-0"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--line)] self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setDisplayMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${displayMode === 'table'
                      ? 'bg-[var(--panel)] text-[var(--ink)]'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                    }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{isTh ? 'ตาราง' : 'Table'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${displayMode === 'cards'
                      ? 'bg-[var(--panel)] text-[var(--ink)]'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                    }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{isTh ? 'การ์ด' : 'Cards'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Formula Link Hint Bar */}
            {tableTab !== 'input' && displayMode === 'table' && (
              <div className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    {isTh
                      ? 'คลิกที่ค่าตัวเลขที่มีเส้นประขีดเส้นใต้ในตาราง เพื่อเปิดดูสูตรการคำนวณและไฮไลท์วิธีแทนค่าของรอบนั้นทันที'
                      : 'Click any dashed-underlined value in the table to jump to its formula and highlight the calculation.'}
                  </span>
                </div>
                {highlightedFormula && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFormulaDetails(true);
                      const el = document.getElementById(`formula-card-${highlightedFormula.formulaId}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {isTh
                        ? `ดูสูตรล่าสุดที่เลือก: ${highlightedFormula.columnLabel} (รอบที่ #${highlightedFormula.step})`
                        : `View last formula: ${highlightedFormula.columnLabel} (Step #${highlightedFormula.step})`}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Flagged Rows Alert */}
            {flaggedRows.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  {isTh
                    ? `พบแถวที่มีค่าติดลบหรือไม่สอดคล้องทางกายภาพ ${flaggedRows.length} แถว`
                    : `${flaggedRows.length} row(s) flagged for review.`}
                </span>
              </div>
            )}

            {/* Table / Cards Content */}
            {displayMode === 'cards' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {processedCycles.map((c, idx) => {
                  const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
                  const isNonPhysical = isNonPhysicalCycleRow(c);
                  const isExhausted =
                    !isNonPhysical && (govPct >= 100 || c.condOut >= 0.1 || c.silicaOut >= 10);
                  const isStop95 = !isNonPhysical && !isExhausted && govPct >= 95;
                  const isWarn90 = !isNonPhysical && !isExhausted && !isStop95 && govPct >= 90;
                  const isMaxSafeStep = plantSummary?.maxSafeRowWithin98?.rowId === c.rowId;
                  const isSelected = inspectedStepIndex === idx;

                  return (
                    <div
                      key={c.rowId}
                      onClick={() => {
                        setInspectedStepIndex(idx);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${isSelected
                          ? 'border-[var(--accent)] bg-[var(--bg)]'
                          : isExhausted || isStop95
                            ? 'border-rose-500/40 bg-rose-500/[0.04]'
                            : isWarn90
                              ? 'border-amber-500/40 bg-amber-500/[0.04]'
                              : isMaxSafeStep
                                ? 'border-emerald-500/50 bg-emerald-500/[0.04]'
                                : 'border-[var(--line)] bg-[var(--bg)]/50 hover:border-[var(--accent)]/50'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1.5">
                        <div className="text-xs font-bold text-[var(--ink)] truncate">
                          <span className="font-mono text-[var(--accent)] mr-1">#{c.step}</span>
                          {c.label}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] font-mono font-semibold text-[var(--ink-soft)]">
                            {isExhausted
                              ? 'Breakthrough'
                              : isStop95
                                ? isTh
                                  ? 'จุดหยุดระบบ ≥95%'
                                  : 'Stop ≥95%'
                                : isWarn90
                                  ? isTh
                                    ? 'แจ้งเตือน ≥90%'
                                    : 'Warn ≥90%'
                                  : isTh
                                    ? 'ปกติ (<90%)'
                                    : 'Normal (<90%)'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRowState({
                                target: 'workspace',
                                rowId: c.rowId,
                                label: c.label,
                                cycleEnd: c.cycleEnd.toString(),
                                condIn: c.condIn.toString(),
                                condOut: c.condOut.toString(),
                                silicaIn: c.silicaIn.toString(),
                                silicaOut: c.silicaOut.toString(),
                              });
                            }}
                            className="p-1 text-[var(--ink-soft)] hover:text-emerald-500 rounded cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkspaceRow(c.rowId, c.label);
                            }}
                            className="p-1 text-[var(--ink-soft)] hover:text-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-[13px] font-mono tabular-nums">
                        <div className="col-span-2">
                          <div className="text-xs font-sans font-medium text-[var(--ink-soft)]">Cycle (m³)</div>
                          <div className="font-bold text-[var(--ink)] truncate">
                            {c.cycleEnd.toFixed(2)} m³{' '}
                            <span className="text-xs text-[var(--ink-soft)] font-normal">(ΔV {c.distance.toFixed(2)} m³)</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-sans font-medium text-[var(--ink-soft)]">Silica MB Inlet</div>
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                            {c.silicaIn.toFixed(2)} ppb
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-sans font-medium text-[var(--ink-soft)]">Silica MB Outlet</div>
                          <div className="font-bold text-[var(--ink)] truncate">
                            {c.silicaOut.toFixed(2)} ppb
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-sans font-medium text-[var(--ink-soft)]">Cond. MB Inlet</div>
                          <div className="font-bold text-sky-600 dark:text-sky-400 truncate">
                            {c.condIn.toFixed(3)} µS/cm
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-sans font-medium text-[var(--ink-soft)]">Cond MB Outlet</div>
                          <div className="font-bold text-[var(--ink)] truncate">
                            {c.condOut.toFixed(3)} µS/cm
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Compact Two-Line Header Engineering Table (High-contrast readable headers with stacked units) */
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-xl border border-[var(--line)]">
                <table className="w-full text-xs sm:text-[13px] text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/95 text-[var(--ink)] font-bold border-b-2 border-[var(--line)] z-10">
                    {tableTab === 'input' && (
                      <tr className="align-top">
                        <th className="py-2.5 px-3 text-center text-[13px] sm:text-sm font-bold text-[var(--ink)] sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 whitespace-nowrap">#</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-[var(--ink)]">{isTh ? 'รอบ' : 'Step'}</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-[var(--ink)]">Cycle</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-indigo-700 dark:text-indigo-300">Silica MB Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-indigo-600/90 dark:text-indigo-300/90">(ppb)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-[var(--ink)]">Silica MB Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(ppb)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-sky-700 dark:text-sky-300">Cond. MB Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-sky-600/90 dark:text-sky-300/90">(µS/cm)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] sm:text-sm font-bold text-[var(--ink)]">Cond MB Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(µS/cm)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-right text-[13px] sm:text-sm font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการ' : 'Edit'}</th>
                      </tr>
                    )}
                    {tableTab === 'silica' && (
                      <tr className="align-top">
                        <th className="py-2.5 px-2.5 text-center text-[13px] font-bold text-[var(--ink)] sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 whitespace-nowrap">#</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cycle</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">ΔV</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica MB Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(ppb)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/L)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica MB Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(ppb)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/L)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Silica Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">ΔSilica</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">Weighted Avg of Silica</div>
                            <div className="text-[11px] font-mono font-semibold text-indigo-600/90 dark:text-indigo-300/90">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Ion ที่ใช้ไป</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">Ion load silica</div>
                            <div className="text-[11px] font-mono font-semibold text-indigo-600/90 dark:text-indigo-300/90">(mol)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">%Ion load silica</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(%)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right text-[13px] font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการ' : 'Edit'}</th>
                      </tr>
                    )}
                    {tableTab === 'cond' && (
                      <tr className="align-top">
                        <th className="py-2.5 px-2.5 text-center text-[13px] font-bold text-[var(--ink)] sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 whitespace-nowrap">#</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cycle</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">ΔV</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cond. Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(µS/cm)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cond. Inlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cond. Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(µS/cm)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Cond. Outlet</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">ΔCond.</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-sky-700 dark:text-sky-300">Weighted Avg of Cond.</div>
                            <div className="text-[11px] font-mono font-semibold text-sky-600/90 dark:text-sky-300/90">(mol/m³)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">Ion ที่ใช้ไป</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(mol)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-sky-700 dark:text-sky-300">Ion load cond.</div>
                            <div className="text-[11px] font-mono font-semibold text-sky-600/90 dark:text-sky-300/90">(mol)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="leading-snug">
                            <div className="text-[13px] font-bold text-[var(--ink)]">% Ion load cond.</div>
                            <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">(%)</div>
                          </div>
                        </th>
                        <th className="py-2.5 px-2.5 text-right text-[13px] font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการ' : 'Edit'}</th>
                      </tr>
                    )}
                    {tableTab === 'weighted' && (
                      <tr className="align-top">
                        <th className="py-2.5 px-2.5 text-center text-[13px] font-bold text-[var(--ink)] sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 whitespace-nowrap">#</th>
                        {[
                          { title: 'Cycle', unit: '(m³)', tone: '' },
                          { title: 'ΔV', unit: '(m³)', tone: '' },
                          { title: 'Silica Inlet', unit: '(mol/m³)', tone: '' },
                          { title: 'Silica Outlet', unit: '(mol/m³)', tone: '' },
                          { title: 'ΔSilica', unit: '(mol/m³)', tone: '' },
                          { title: 'Weighted Avg of Silica', unit: '(mol/m³)', tone: 'silica' },
                          { title: 'Cond. Inlet', unit: '(mol/m³)', tone: '' },
                          { title: 'Cond. Outlet', unit: '(mol/m³)', tone: '' },
                          { title: 'ΔCond.', unit: '(mol/m³)', tone: '' },
                          { title: 'Weighted Avg of Cond.', unit: '(mol/m³)', tone: 'cond' },
                        ].map((h) => (
                          <th key={h.title} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            <div className="leading-snug">
                              <div
                                className={`text-[13px] font-bold ${h.tone === 'silica'
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : h.tone === 'cond'
                                      ? 'text-sky-700 dark:text-sky-300'
                                      : 'text-[var(--ink)]'
                                  }`}
                              >
                                {h.title}
                              </div>
                              <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">{h.unit}</div>
                            </div>
                          </th>
                        ))}
                        <th className="py-2.5 px-2.5 text-right text-[13px] font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการ' : 'Edit'}</th>
                      </tr>
                    )}
                    {tableTab === 'predict' && (
                      <tr className="align-top">
                        <th className="py-2.5 px-2.5 text-center text-[13px] font-bold text-[var(--ink)] sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 whitespace-nowrap">#</th>
                        {[
                          { title: 'Cycle', unit: '(m³)', tone: '' },
                          { title: 'Weighted Average of Silica', unit: '(mol/m³)', tone: 'silica' },
                          { title: 'Weighted Average of Cond.', unit: '(mol/m³)', tone: 'cond' },
                          { title: 'Total Weighted Average', unit: '(mol/m³)', tone: 'total' },
                          { title: isTh ? 'จุดแจ้งเตือนระบบ (90%)' : 'System Warning (90%)', unit: '(m³)', tone: 'warn' },
                          { title: isTh ? 'จุดหยุดระบบ (95%)' : 'System Stop (95%)', unit: '(m³)', tone: 'stop' },
                        ].map((h) => (
                          <th key={h.title} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            <div className="leading-snug">
                              <div
                                className={`text-[13px] font-bold ${h.tone === 'silica'
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : h.tone === 'cond'
                                      ? 'text-sky-700 dark:text-sky-300'
                                      : h.tone === 'warn'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : h.tone === 'stop'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-[var(--ink)]'
                                  }`}
                              >
                                {h.title}
                              </div>
                              <div className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">{h.unit}</div>
                            </div>
                          </th>
                        ))}
                        <th className="py-2.5 px-2.5 text-right text-[13px] font-bold text-[var(--ink)] whitespace-nowrap">{isTh ? 'จัดการ' : 'Edit'}</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] font-mono tabular-nums whitespace-nowrap">
                    {processedCycles.map((c, idx) => {
                      const govPct = Math.max(c.combinedPercentLoad, c.silicaPercentLoad);
                      const isNonPhysical = isNonPhysicalCycleRow(c);
                      const isExhausted =
                        !isNonPhysical && (govPct >= 100 || c.condOut >= 0.1 || c.silicaOut >= 10);
                      const isStop95 = !isNonPhysical && !isExhausted && govPct >= 95;
                      const isWarn90 = !isNonPhysical && !isExhausted && !isStop95 && govPct >= 90;
                      const isMaxSafeStep = plantSummary?.maxSafeRowWithin98?.rowId === c.rowId;
                      const isSelected = inspectedStepIndex === idx;
                      const wp = weightedPrediction.rowMap.get(c.rowId);

                      return (
                        <tr
                          id={`calc-table-row-${c.rowId}`}
                          key={c.rowId}
                          onClick={() => setInspectedStepIndex(idx)}
                          className={`transition-colors cursor-pointer ${isSelected
                              ? 'bg-sky-500/10'
                              : isNonPhysical
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold'
                                : isExhausted || isStop95
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                                  : isWarn90
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                                    : isMaxSafeStep
                                      ? 'bg-emerald-500/10 font-semibold'
                                      : 'hover:bg-[var(--bg)]'
                            }`}
                        >
                          {tableTab === 'input' && (
                            <>
                              <td className="py-2 px-2.5 text-center text-[var(--ink-soft)] sticky left-0 bg-[var(--panel)]">
                                {c.step}
                              </td>
                              <td className="py-2 px-2.5 font-sans font-medium">{c.label}</td>
                              <td className="py-2 px-2.5 text-right font-bold text-[var(--ink)]">
                                {c.cycleEnd.toFixed(2)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                {c.silicaIn.toFixed(2)}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.silicaOut.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right font-semibold text-sky-600 dark:text-sky-400">
                                {c.condIn.toFixed(3)}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.condOut.toFixed(3)}</td>
                            </>
                          )}

                          {tableTab === 'silica' && (
                            <>
                              <td className="py-2 px-2.5 text-center text-[var(--ink-soft)] sticky left-0 bg-[var(--panel)]">
                                {c.step}
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-[var(--ink)]">{c.cycleEnd.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_dv', idx, c, 'ΔV (m³)', c.distance.toFixed(2), 'text-[var(--ink-soft)]')}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.silicaIn.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_in_mol_l', idx, c, 'Silica Inlet (mol/L)', c.silicaConcInMolL.toFixed(7))}
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {renderFormulaLinkCell('silica_in_mol_m3', idx, c, 'Silica Inlet (mol/m³)', c.silicaConcInMolM3.toFixed(3))}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.silicaOut.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_out_mol_l', idx, c, 'Silica Outlet (mol/L)', c.silicaConcOutMolL.toFixed(8))}
                              </td>
                              <td className="py-2 px-2.5 text-right font-semibold">
                                {renderFormulaLinkCell('silica_out_mol_m3', idx, c, 'Silica Outlet (mol/m³)', c.silicaConcOutMolM3.toFixed(3))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_delta', idx, c, 'ΔSilica (mol/m³)', fmtNum(wp?.dSilica, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'silica_wa',
                                  idx,
                                  c,
                                  'Weighted Avg of Silica (mol/m³)',
                                  fmtNum(wp?.waSilica, 6),
                                  'font-bold text-indigo-600 dark:text-indigo-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_removed', idx, c, 'Ion ที่ใช้ไป (Silica, mol)', c.silicaIonsRemoved.toFixed(3), 'font-bold')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'silica_cum_load',
                                  idx,
                                  c,
                                  'Ion load silica (mol)',
                                  c.cumulativeSilicaLoad.toFixed(3),
                                  'font-bold text-indigo-600 dark:text-indigo-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_pct_load', idx, c, '%Ion load silica (%)', `${c.silicaPercentLoad.toFixed(3)}%`, 'font-bold')}
                              </td>
                            </>
                          )}

                          {tableTab === 'cond' && (
                            <>
                              <td className="py-2 px-2.5 text-center text-[var(--ink-soft)] sticky left-0 bg-[var(--panel)]">
                                {c.step}
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-[var(--ink)]">{c.cycleEnd.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_dv', idx, c, 'ΔV (m³)', c.distance.toFixed(2), 'text-[var(--ink-soft)]')}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.condIn.toFixed(3)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_in_mol_m3', idx, c, 'Cond. Inlet (mol/m³)', c.concInMolM3.toFixed(3))}
                              </td>
                              <td className="py-2 px-2.5 text-right">{c.condOut.toFixed(3)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_out_mol_m3', idx, c, 'Cond. Outlet (mol/m³)', c.concOutMolM3.toFixed(3))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_delta', idx, c, 'ΔCond. (mol/m³)', fmtNum(wp?.dCond, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'cond_wa',
                                  idx,
                                  c,
                                  'Weighted Avg of Cond. (mol/m³)',
                                  fmtNum(wp?.waCond, 6),
                                  'font-bold text-sky-600 dark:text-sky-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_removed', idx, c, 'Ion ที่ใช้ไป (Cond., mol)', c.ionsRemoved.toFixed(3), 'font-bold')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'cond_cum_load',
                                  idx,
                                  c,
                                  'Ion load cond. (mol)',
                                  c.cumulativeIonLoad.toFixed(3),
                                  'font-bold text-[var(--accent)]'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_pct_load', idx, c, '% Ion load cond. (%)', `${c.condPercentLoad.toFixed(3)}%`, 'font-bold')}
                              </td>
                            </>
                          )}

                          {tableTab === 'weighted' && (
                            <>
                              <td className="py-2 px-2.5 text-center text-[var(--ink-soft)] sticky left-0 bg-[var(--panel)]">
                                <span className="inline-flex items-center gap-1">
                                  {c.step}
                                  {wp && !wp.isValid && (
                                    <span title={wp.issues.join(' · ')}>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-[var(--ink)]">{c.cycleEnd.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_dv', idx, c, 'ΔV (m³)', c.distance.toFixed(2), 'text-[var(--ink-soft)]')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_in_mol_m3', idx, c, 'Silica Inlet (mol/m³)', fmtNum(wp?.silicaInMolM3, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_out_mol_m3', idx, c, 'Silica Outlet (mol/m³)', fmtNum(wp?.silicaOutMolM3, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('silica_delta', idx, c, 'ΔSilica (mol/m³)', fmtNum(wp?.dSilica, 6), 'font-semibold')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'silica_wa',
                                  idx,
                                  c,
                                  'Weighted Avg of Silica (mol/m³)',
                                  fmtNum(wp?.waSilica, 6),
                                  'font-bold text-indigo-600 dark:text-indigo-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_in_mol_m3', idx, c, 'Cond. Inlet (mol/m³)', fmtNum(wp?.condInMolM3, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_out_mol_m3', idx, c, 'Cond. Outlet (mol/m³)', fmtNum(wp?.condOutMolM3, 6))}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell('cond_delta', idx, c, 'ΔCond. (mol/m³)', fmtNum(wp?.dCond, 6), 'font-semibold')}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'cond_wa',
                                  idx,
                                  c,
                                  'Weighted Avg of Cond. (mol/m³)',
                                  fmtNum(wp?.waCond, 6),
                                  'font-bold text-sky-600 dark:text-sky-400'
                                )}
                              </td>
                            </>
                          )}

                          {tableTab === 'predict' && (
                            <>
                              <td className="py-2 px-2.5 text-center text-[var(--ink-soft)] sticky left-0 bg-[var(--panel)]">
                                <span className="inline-flex items-center gap-1">
                                  {c.step}
                                  {wp && !wp.isValid && (
                                    <span title={wp.issues.join(' · ')}>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-[var(--ink)]">{c.cycleEnd.toFixed(2)}</td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'silica_wa',
                                  idx,
                                  c,
                                  'Weighted Average of Silica (mol/m³)',
                                  fmtNum(wp?.waSilica, 6),
                                  'font-bold text-indigo-600 dark:text-indigo-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'cond_wa',
                                  idx,
                                  c,
                                  'Weighted Average of Cond. (mol/m³)',
                                  fmtNum(wp?.waCond, 6),
                                  'font-bold text-sky-600 dark:text-sky-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'pred_total_wa',
                                  idx,
                                  c,
                                  'Total Weighted Average (mol/m³)',
                                  fmtNum(wp?.totalWa, 6),
                                  'font-bold text-[var(--ink)]'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'pred_warn_90',
                                  idx,
                                  c,
                                  isTh ? 'จุดแจ้งเตือนระบบ (90%)' : 'System Warning (90%)',
                                  fmtNum(wp?.warnVolume, 2),
                                  'font-bold text-amber-600 dark:text-amber-400'
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {renderFormulaLinkCell(
                                  'pred_stop_95',
                                  idx,
                                  c,
                                  isTh ? 'จุดหยุดระบบ (95%)' : 'System Stop (95%)',
                                  fmtNum(wp?.stopVolume, 2),
                                  'font-bold text-rose-600 dark:text-rose-400'
                                )}
                              </td>
                            </>
                          )}

                          <td className="py-2 px-2.5 text-right font-sans">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRowState({
                                    target: 'workspace',
                                    rowId: c.rowId,
                                    label: c.label,
                                    cycleEnd: c.cycleEnd.toString(),
                                    condIn: c.condIn.toString(),
                                    condOut: c.condOut.toString(),
                                    silicaIn: c.silicaIn.toString(),
                                    silicaOut: c.silicaOut.toString(),
                                  });
                                }}
                                className="p-1 text-[var(--ink-soft)] hover:text-emerald-500 rounded cursor-pointer"
                                title={isTh ? 'แก้ไข' : 'Edit'}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWorkspaceRow(c.rowId, c.label);
                                }}
                                className="p-1 text-[var(--ink-soft)] hover:text-rose-500 rounded cursor-pointer"
                                title={isTh ? 'ลบ' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. BOTTOM SECTION: Alert Banner + 5 KPI Cards (Current Water | 90% Yellow Warning | 95% Red Stop | % Load | Ion Load) + Line Chart (Shown only after rows are added) */}
        {hasCycleData && plantSummary && thresholdAnalysis && (
          <div className="space-y-4">
            {/* Operational Control Alert Banner (90% Yellow Warning & 95% Red Stop Mixed Bed for Regeneration) */}
            <div
              className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${thresholdAnalysis.currentZone === 'breakthrough' || thresholdAnalysis.currentZone === 'stop95'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                  : thresholdAnalysis.currentZone === 'warn90'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 shrink-0 mt-0.5">
                  {thresholdAnalysis.currentZone === 'breakthrough' || thresholdAnalysis.currentZone === 'stop95' ? (
                    <OctagonAlert className="w-5 h-5 text-rose-500" />
                  ) : thresholdAnalysis.currentZone === 'warn90' ? (
                    <BellRing className="w-5 h-5 text-amber-500" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-bold">
                    {thresholdAnalysis.currentZone === 'breakthrough' || thresholdAnalysis.currentZone === 'stop95'
                      ? isTh
                        ? `ถึงจุดหยุดระบบ 95% (≥ 95%): แนะนำให้หยุดเดินระบบ Mixed Bed ทันทีเพื่อทำการฟื้นฟูเรซิน (Regeneration)`
                        : `System Stop Reached (≥ 95%): Stop Mixed Bed System Immediately for Resin Regeneration`
                      : thresholdAnalysis.currentZone === 'warn90'
                        ? isTh
                          ? `จุดแจ้งเตือนระบบ 90% (≥ 90%): เรซินใกล้ถึงขีดจำกัด เตรียมสลับ Train และพร้อมหยุดเดินระบบที่จุดหยุดระบบ 95%`
                          : `System Warning (≥ 90%): Approaching 95% Stop — Prepare to Stop System for Regeneration`
                        : isTh
                          ? `สถานะเดินระบบปกติ (< 90%): ยังไม่ถึงจุดแจ้งเตือนระบบ 90% (${thresholdAnalysis.checkpoint90.targetMol.toFixed(2)} mol) และจุดหยุดระบบ 95% (${thresholdAnalysis.checkpoint95.targetMol.toFixed(2)} mol)`
                          : `Normal Operation (< 90%): Within 90% Warning (${thresholdAnalysis.checkpoint90.targetMol.toFixed(2)} mol) & 95% System Stop (${thresholdAnalysis.checkpoint95.targetMol.toFixed(2)} mol)`}
                  </div>
                  <div className="text-xs opacity-90">
                    {!weightedPrediction.canDivide ? (
                      <span>
                        {isTh
                          ? 'ยังไม่สามารถคำนวณจุดแจ้งเตือนระบบ (90%) และจุดหยุดระบบ (95%) ได้ เนื่องจากตัวหารเท่ากับศูนย์'
                          : 'Cannot calculate 90% warning and 95% stop points because the divisor is zero.'}
                      </span>
                    ) : plantSummary.maxSafeRowWithin98 ? (
                      isTh ? (
                        <>
                          จุดแจ้งเตือนระบบ 90% ={' '}
                          <strong className="text-amber-500">
                            {fmtNum(weightedPrediction.warnVolume, 2)} m³
                          </strong>{' '}
                          · จุดหยุดระบบ 95% ={' '}
                          <strong className="text-rose-500">
                            {fmtNum(weightedPrediction.stopVolume, 2)} m³
                          </strong>{' '}
                          (ผลิตได้สูงสุดก่อนหยุดระบบ <strong>{plantSummary.maxSafeRowWithin98.step} Cycle</strong> ·{' '}
                          <strong>
                            {plantSummary.maxSafeRowWithin98.cycleEnd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            m³
                          </strong>
                          )
                        </>
                      ) : (
                        <>
                          90% System Warning:{' '}
                          <strong className="text-amber-500">
                            {fmtNum(weightedPrediction.warnVolume, 2)} m³
                          </strong>{' '}
                          · 95% System Stop:{' '}
                          <strong className="text-rose-500">
                            {fmtNum(weightedPrediction.stopVolume, 2)} m³
                          </strong>
                        </>
                      )
                    ) : (
                      <span>
                        {isTh
                          ? `คาดการณ์จุดแจ้งเตือนระบบ 90%: ${fmtNum(weightedPrediction.warnVolume, 2)} m³ · จุดหยุดระบบ 95%: ${fmtNum(weightedPrediction.stopVolume, 2)} m³`
                          : `Predicted 90% Warning: ${fmtNum(weightedPrediction.warnVolume, 2)} m³ · 95% System Stop: ${fmtNum(weightedPrediction.stopVolume, 2)} m³`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] text-[var(--ink)] self-start md:self-center">
                <span>Load: {plantSummary.currentCombinedPercent.toFixed(2)}%</span>
                <span className="text-[var(--ink-soft)]">|</span>
                <span className="text-amber-500">90%: {fmtNum(weightedPrediction.warnVolume, 2)} m³</span>
                <span className="text-[var(--ink-soft)]">|</span>
                <span className="text-rose-500">95%: {fmtNum(weightedPrediction.stopVolume, 2)} m³</span>
              </div>
            </div>

            {/* 5 Balanced KPI Summary Cards: [1. ปริมาณน้ำ ณ ปัจจุบัน (Green)] -> [2. จุดแจ้งเตือนระบบ 90% (Yellow)] -> [3. จุดหยุดระบบ 95% (Red)] -> [4. % Load] -> [5. Ion Load] */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Card 1: Current Water Output (Green) */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-emerald-500/30 space-y-1">
                <div className="text-xs sm:text-[13px] text-[var(--ink)] flex items-center justify-between gap-1">
                  <span className="truncate font-semibold">
                    {isTh ? 'ปริมาตรน้ำที่ผลิตได้ ณ ปัจจุบัน' : 'Current Water Output'}
                  </span>
                  <Droplets className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {plantSummary.totalVolume.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-xs font-normal text-[var(--ink-soft)]">m³</span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                  {plantSummary.maxSafeRowWithin98
                    ? isTh
                      ? `สูงสุดก่อนหยุดระบบ: ${plantSummary.maxSafeRowWithin98.cycleEnd.toFixed(2)} m³ (${plantSummary.maxSafeRowWithin98.step} รอบ)`
                      : `Max safe: ${plantSummary.maxSafeRowWithin98.cycleEnd.toFixed(2)} m³ (${plantSummary.maxSafeRowWithin98.step} steps)`
                    : isTh
                      ? `คาดการณ์ผลิตได้ ${plantSummary.predictedTotalCycleCount98} Cycle`
                      : `Est. ${plantSummary.predictedTotalCycleCount98} Cycles`}
                </div>
              </div>

              {/* Card 2: 90% System Warning Point (Yellow) */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/40 space-y-1">
                <div className="text-xs sm:text-[13px] text-amber-600 dark:text-amber-400 font-bold flex items-center justify-between gap-1">
                  <span className="truncate">{isTh ? 'จุดแจ้งเตือนระบบ 90%' : '90% System Warning'}</span>
                  <BellRing className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-500 dark:text-amber-400 whitespace-nowrap">
                  {fmtNum(weightedPrediction.warnVolume, 2)}{' '}
                  <span className="text-xs font-normal text-[var(--ink-soft)]">m³</span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                  {!weightedPrediction.canDivide
                    ? isTh
                      ? 'ตัวหารเป็นศูนย์ (ไม่สามารถคำนวณได้)'
                      : 'Divisor is zero (cannot calculate)'
                    : thresholdAnalysis.checkpoint90.firstReachedRow
                      ? isTh
                        ? `ถึงเกณฑ์ที่ รอบที่ ${thresholdAnalysis.checkpoint90.firstReachedRow.step} (${thresholdAnalysis.checkpoint90.firstReachedRow.cycleEnd.toFixed(2)} m³)`
                        : `Reached at Step #${thresholdAnalysis.checkpoint90.firstReachedRow.step}`
                      : isTh
                        ? `อีก ${thresholdAnalysis.checkpoint90.remainingVolume.toFixed(2)} m³ ถึงจุดเตือน (${thresholdAnalysis.checkpoint90.targetMol.toFixed(2)} mol)`
                        : `Rem. ${thresholdAnalysis.checkpoint90.remainingVolume.toFixed(2)} m³ (${thresholdAnalysis.checkpoint90.targetMol.toFixed(2)} mol)`}
                </div>
              </div>

              {/* Card 3: 95% System Stop Point (Red) */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/40 space-y-1">
                <div className="text-xs sm:text-[13px] text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between gap-1">
                  <span className="truncate">{isTh ? 'จุดหยุดระบบ 95%' : '95% System Stop'}</span>
                  <OctagonAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {fmtNum(weightedPrediction.stopVolume, 2)}{' '}
                  <span className="text-xs font-normal text-[var(--ink-soft)]">m³</span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                  {!weightedPrediction.canDivide
                    ? isTh
                      ? 'ตัวหารเป็นศูนย์ (ไม่สามารถคำนวณได้)'
                      : 'Divisor is zero (cannot calculate)'
                    : plantSummary.firstCutoffRowAbove98
                      ? isTh
                        ? `ถึงเกณฑ์ที่ รอบที่ ${plantSummary.firstCutoffRowAbove98.step} (${plantSummary.firstCutoffRowAbove98.cycleEnd.toFixed(2)} m³)`
                        : `Reached at Step #${plantSummary.firstCutoffRowAbove98.step} (${plantSummary.firstCutoffRowAbove98.cycleEnd.toFixed(2)} m³)`
                      : isTh
                        ? `อีก ${plantSummary.remainingVolumeTo98.toFixed(2)} m³ ก่อนหยุดระบบ (${thresholdAnalysis.checkpoint95.targetMol.toFixed(2)} mol)`
                        : `Rem. ${plantSummary.remainingVolumeTo98.toFixed(2)} m³ (${thresholdAnalysis.checkpoint95.targetMol.toFixed(2)} mol)`}
                </div>
              </div>

              {/* Card 4: Percent Load on Resin */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1">
                <div className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] flex items-center justify-between gap-1">
                  <span className="truncate">Percent Load on Resin</span>
                  {plantSummary.currentCombinedPercent >= 95 || plantSummary.currentSilicaPercent >= 95 ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : plantSummary.currentCombinedPercent >= 90 || plantSummary.currentSilicaPercent >= 90 ? (
                    <BellRing className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                </div>
                <div
                  className={`text-lg sm:text-xl font-bold font-mono tabular-nums whitespace-nowrap ${plantSummary.currentCombinedPercent >= 95
                      ? 'text-rose-600 dark:text-rose-400'
                      : plantSummary.currentCombinedPercent >= 90
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                >
                  {plantSummary.currentCombinedPercent.toFixed(3)}%
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                  Silica: <strong className="text-indigo-600 dark:text-indigo-400">{plantSummary.currentSilicaPercent.toFixed(2)}%</strong> · Cond: {plantSummary.currentCondPercent.toFixed(2)}%
                </div>
              </div>

              {/* Card 5: Combined Ion Load */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-1 sm:col-span-2 lg:col-span-1">
                <div className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] flex items-center justify-between gap-1">
                  <span className="truncate">{isTh ? 'Ion Load สะสมรวม' : 'Cumulative Ion Load'}</span>
                  <Gauge className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[var(--ink)] whitespace-nowrap">
                  {plantSummary.currentCombinedIonLoad.toFixed(3)}{' '}
                  <span className="text-xs font-normal text-[var(--ink-soft)]">/ {totalCap.toFixed(1)} mol</span>
                </div>
                <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                  Cond {plantSummary.currentCondIonLoad.toFixed(2)} · Si {plantSummary.currentSilicaIonLoad.toFixed(2)} mol
                </div>
              </div>
            </div>

            {/* Animated Resin Capacity Progress Bars + Enlarged Line Chart */}
            {chartGeometry && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
                {/* Dual Progress Bars with 90% Yellow Warning & 95% Red Stop Markers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-sans font-semibold text-[var(--ink)] truncate">
                        {isTh ? 'ความจุเรซินรวม (Cond + Silica)' : 'Combined Resin Load'}
                      </span>
                      <span className="font-bold text-[var(--ink)] whitespace-nowrap">
                        {plantSummary.currentCombinedIonLoad.toFixed(3)} / {totalCap.toFixed(3)} mol ({plantSummary.currentCombinedPercent.toFixed(3)}%)
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-[var(--bg)] border border-[var(--line)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, plantSummary.currentCombinedPercent))}%` }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${plantSummary.currentCombinedPercent >= 95
                            ? 'bg-rose-500'
                            : plantSummary.currentCombinedPercent >= 90
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                      />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10" style={{ left: '90%' }} title="90% Warning" />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10" style={{ left: '95%' }} title="95% System Stop" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-sans font-semibold text-[var(--ink)] truncate">
                        {isTh ? 'ความจุเรซิน Silica (SiO₂)' : 'Silica Resin Load (SiO₂)'}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {plantSummary.currentSilicaIonLoad.toFixed(3)} / {sCap.toFixed(3)} mol ({plantSummary.currentSilicaPercent.toFixed(3)}%)
                      </span>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-[var(--bg)] border border-[var(--line)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, plantSummary.currentSilicaPercent))}%` }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${plantSummary.currentSilicaPercent >= 95
                            ? 'bg-rose-500'
                            : plantSummary.currentSilicaPercent >= 90
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                      />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10" style={{ left: '90%' }} title="90% Warning" />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10" style={{ left: '95%' }} title="95% System Stop" />
                    </div>
                  </div>
                </div>

                {/* Enlarged Line Chart: Y-Axis = % Load on Resin (%), X-Axis = Cycle (m³) */}
                <div className="relative w-full overflow-hidden bg-[var(--bg)] rounded-xl p-4 sm:p-5 border border-[var(--line)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3 text-xs sm:text-sm">
                    <div className="font-bold text-[var(--ink)] flex items-center gap-2">
                      <span>Line Chart: % Load on Resin (แกน Y) vs Cycle m³ (แกน X)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-[var(--ink-soft)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                        <span>% Load on Resin</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-indigo-500 inline-block" />
                        <span>% Load Silica</span>
                      </span>
                      <span>
                        {isTh ? 'จุดแจ้งเตือนระบบ 90%: ' : '90% Warning: '}
                        <strong className="text-amber-500">{fmtNum(weightedPrediction.warnVolume, 2)} m³</strong>
                      </span>
                      <span>
                        {isTh ? 'จุดหยุดระบบ 95%: ' : '95% Stop: '}
                        <strong className="text-rose-500">{fmtNum(weightedPrediction.stopVolume, 2)} m³</strong>
                      </span>
                    </div>
                  </div>

                  <svg
                    viewBox={`0 0 ${chartGeometry.W} ${chartGeometry.H}`}
                    className="w-full h-72 sm:h-96 lg:h-[430px] select-none"
                  >
                    {/* Y-Axis Title */}
                    <text
                      x={18}
                      y={(chartGeometry.padT + (chartGeometry.H - chartGeometry.padB)) / 2}
                      transform={`rotate(-90, 18, ${(chartGeometry.padT + (chartGeometry.H - chartGeometry.padB)) / 2})`}
                      textAnchor="middle"
                      className="text-xs font-sans font-bold fill-[var(--ink-soft)]"
                    >
                      % Load on Resin (%)
                    </text>

                    {/* X-Axis Title */}
                    <text
                      x={(chartGeometry.padL + (chartGeometry.W - chartGeometry.padR)) / 2}
                      y={chartGeometry.H - 10}
                      textAnchor="middle"
                      className="text-xs font-sans font-bold fill-[var(--ink-soft)]"
                    >
                      Cycle (m³)
                    </text>

                    {/* Vertical Grid Lines & X-Axis Ticks (Cycle m³) */}
                    {chartGeometry.xTicks.map((volTick, i) => {
                      const x = chartGeometry.xFor(volTick);
                      return (
                        <g key={`xtick_${i}`}>
                          <line
                            x1={x}
                            y1={chartGeometry.padT}
                            x2={x}
                            y2={chartGeometry.H - chartGeometry.padB}
                            stroke="var(--line)"
                            strokeWidth="1"
                            strokeDasharray="3 4"
                          />
                          <text
                            x={x}
                            y={chartGeometry.H - chartGeometry.padB + 22}
                            textAnchor="middle"
                            className="text-xs font-mono fill-[var(--ink-soft)]"
                          >
                            {volTick.toLocaleString('en-US')}
                          </text>
                        </g>
                      );
                    })}

                    {/* Horizontal Grid Lines & Non-Overlapping Y-Axis Ticks (0, 20, 40, 60, 80, 90, 95) */}
                    {chartGeometry.yTicks.map((pct) => {
                      const y = chartGeometry.yFor(pct);
                      const is95 = pct === 95;
                      const is90 = pct === 90;
                      // Offset 95% slightly upward and 90% slightly downward so their labels never collide
                      const labelY = is95 ? y - 1 : is90 ? y + 7 : y + 4;
                      return (
                        <g key={`ytick_${pct}`}>
                          <line
                            x1={chartGeometry.padL}
                            y1={y}
                            x2={chartGeometry.W - chartGeometry.padR}
                            y2={y}
                            stroke={is95 ? '#f43f5e' : is90 ? '#f59e0b' : 'var(--line)'}
                            strokeWidth={is95 ? '1.75' : is90 ? '1.4' : '1'}
                            strokeDasharray={is95 || is90 ? '6 4' : '3 4'}
                          />
                          <text
                            x={chartGeometry.padL - 10}
                            y={labelY}
                            textAnchor="end"
                            className={`text-xs font-mono ${is95
                                ? 'fill-rose-500 font-bold'
                                : is90
                                  ? 'fill-amber-500 font-bold'
                                  : 'fill-[var(--ink-soft)]'
                              }`}
                          >
                            {pct}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Main X and Y Axes Lines */}
                    <line
                      x1={chartGeometry.padL}
                      y1={chartGeometry.padT}
                      x2={chartGeometry.padL}
                      y2={chartGeometry.H - chartGeometry.padB}
                      stroke="var(--ink-soft)"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={chartGeometry.padL}
                      y1={chartGeometry.H - chartGeometry.padB}
                      x2={chartGeometry.W - chartGeometry.padR}
                      y2={chartGeometry.H - chartGeometry.padB}
                      stroke="var(--ink-soft)"
                      strokeWidth="1.5"
                    />

                    {/* Projected Line to 95% / 100% */}
                    {chartGeometry.forecastPolyline && (
                      <polyline
                        points={chartGeometry.forecastPolyline}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.25"
                        strokeDasharray="6 4"
                      />
                    )}

                    {/* Silica % Load Line */}
                    {chartGeometry.silicaPolyline && (
                      <polyline
                        points={chartGeometry.silicaPolyline}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    )}

                    {/* Combined % Load on Resin Line */}
                    {chartGeometry.combinedPolyline && (
                      <polyline
                        points={chartGeometry.combinedPolyline}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Points on Line Chart */}
                    {chartGeometry.actualCombinedPoints.slice(1).map((pt, idx) => {
                      const isSelected = inspectedStepIndex === pt.stepIdx;
                      return (
                        <g
                          key={idx}
                          onClick={() => {
                            if (pt.stepIdx >= 0) {
                              setInspectedStepIndex(pt.stepIdx);
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {isSelected && (
                            <circle
                              cx={chartGeometry.xFor(pt.vol)}
                              cy={chartGeometry.yFor(pt.pct)}
                              r={7.5}
                              className="fill-sky-500/25 stroke-sky-500 stroke-1"
                            />
                          )}
                          <circle
                            cx={chartGeometry.xFor(pt.vol)}
                            cy={chartGeometry.yFor(pt.pct)}
                            r={isSelected ? 5 : 4}
                            className={
                              pt.pct >= 95
                                ? 'fill-rose-500 stroke-white stroke-1'
                                : pt.pct >= 90
                                  ? 'fill-amber-500 stroke-white stroke-1'
                                  : 'fill-emerald-500 stroke-white stroke-1'
                            }
                          >
                            <title>{`${pt.label}: Cycle = ${pt.vol.toFixed(2)} m³ | % Load on Resin = ${pt.pct.toFixed(3)}%`}</title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Browse & Load Saved Batches (Separated by Train A & Train B) */}
        <AnimatePresence>
          {isBatchBrowserOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            >
              <div className="w-full max-w-xl bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden modal-animated flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/50">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[var(--accent)]" />
                    <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                      {isTh
                        ? `ชุดข้อมูลที่บันทึกไว้ (แยกตามสายการผลิต Train ${train})`
                        : `Saved Batches (Train ${train})`}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBatchBrowserOpen(false)}
                    className="p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Train A / Train B Filter Tabs inside Modal */}
                <div className="px-4 pt-3 pb-1 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)]/30">
                  {(['A', 'B'] as const).map((tVal) => {
                    const count = tVal === 'A' ? savedBatchesTrainA.length : savedBatchesTrainB.length;
                    const isSelected = train === tVal;
                    return (
                      <button
                        key={tVal}
                        type="button"
                        onClick={() => setTrain(tVal)}
                        className={`px-3.5 py-1.5 rounded-t-xl text-xs font-bold border-b-2 transition-colors cursor-pointer ${isSelected
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--panel)]'
                            : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
                          }`}
                      >
                        Train {tVal} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                  {(train === 'A' ? savedBatchesTrainA : savedBatchesTrainB).length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--ink-soft)]">
                      {isTh
                        ? `ยังไม่มีชุดข้อมูลที่บันทึกไว้สำหรับสายการผลิต Train ${train}`
                        : `No saved batches found for Train ${train}.`}
                    </div>
                  ) : (
                    (train === 'A' ? savedBatchesTrainA : savedBatchesTrainB).map((batch) => (
                      <div
                        key={batch.id}
                        className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50 hover:border-[var(--accent)] transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-bold text-xs sm:text-sm text-[var(--ink)] truncate">
                            {batch.batchName}{' '}
                            <span className="font-normal text-xs text-[var(--ink-soft)]">({batch.rowCount} {isTh ? 'แถว' : 'rows'})</span>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-[var(--ink-soft)] truncate">
                            Vol: {(batch.cycleEnd || 0).toFixed(2)} m³ · Load: {(batch.combinedPercentLoad || batch.percentLoad || 0).toFixed(2)}% · 95%: <strong className="text-[var(--accent)]">{batch.predictedCycle.toFixed(2)} m³</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <ExportDataMenu
                            onExport={(fmt) =>
                              exportBatchesToFile(convertRecordsToExportPayloads([batch]), fmt, isTh)
                            }
                            isTh={isTh}
                            variant="compact"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadBatchIntoWorkspace(batch)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{isTh ? 'โหลด' : 'Load'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteSavedBatch(batch)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Edit Single Row */}
        <AnimatePresence>
          {editingRowState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            >
              <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden modal-animated">
                <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    {isTh ? `แก้ไขแถว: ${editingRowState.label}` : `Edit Row: ${editingRowState.label}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingRowState(null)}
                    className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveEditedRow} className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                        {isTh ? 'ป้ายกำกับ' : 'Label'}
                      </label>
                      <input
                        type="text"
                        value={editingRowState.label}
                        onChange={(e) => setEditingRowState({ ...editingRowState, label: e.target.value })}
                        className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">Cycle (m³)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editingRowState.cycleEnd}
                        onChange={(e) => setEditingRowState({ ...editingRowState, cycleEnd: e.target.value })}
                        className="w-full text-xs sm:text-sm font-mono tabular-nums px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                        Silica MB Inlet (ppb)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editingRowState.silicaIn}
                        onChange={(e) => setEditingRowState({ ...editingRowState, silicaIn: e.target.value })}
                        className="w-full text-xs sm:text-sm font-mono tabular-nums px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                        Silica MB Outlet (ppb)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editingRowState.silicaOut}
                        onChange={(e) => setEditingRowState({ ...editingRowState, silicaOut: e.target.value })}
                        className="w-full text-xs sm:text-sm font-mono tabular-nums px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                        Cond. MB Inlet (µS/cm)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={editingRowState.condIn}
                        onChange={(e) => setEditingRowState({ ...editingRowState, condIn: e.target.value })}
                        className="w-full text-xs sm:text-sm font-mono tabular-nums px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--ink)] block mb-1">
                        Cond MB Outlet (µS/cm)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={editingRowState.condOut}
                        onChange={(e) => setEditingRowState({ ...editingRowState, condOut: e.target.value })}
                        className="w-full text-xs sm:text-sm font-mono tabular-nums px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                      />
                    </div>
                  </div>
                  {editRowError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{editRowError}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingRowState(null)}
                      className="px-3.5 py-1.5 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-soft)] cursor-pointer"
                    >
                      {isTh ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {isTh ? 'บันทึก' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {confirmConfig && (
          <ConfirmModal
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmLabel={confirmConfig.confirmLabel || (isTh ? 'ยืนยัน' : 'Confirm')}
            cancelLabel={isTh ? 'ยกเลิก' : 'Cancel'}
            isDestructive={confirmConfig.isDestructive ?? true}
            onConfirm={confirmConfig.onConfirm}
            onClose={() => setConfirmConfig(null)}
          />
        )}
      </div>
      );
};
