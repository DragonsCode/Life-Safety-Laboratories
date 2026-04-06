import type { LabVariant, LessonId } from '../types/theme';

const T2_1_L = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
const T2_1_B = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
const T2_1_H = [3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2] as const;
const T2_1_FL = [2300, 2310, 2280, 2290, 2320, 2330, 2340, 2285, 2295, 2305] as const;
const T2_1_EN = [450, 180, 100, 120, 150, 200, 250, 300, 350, 400] as const;

const T2_2_KZ = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4] as const;
const T2_2_Z = [1.00, 1.02, 1.04, 1.06, 1.07, 1.08, 1.09, 1.10, 1.12, 1.13] as const;
const T2_2_WM = [5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8] as const;
const T2_2_SP = [200, 210, 220, 230, 240, 250, 260, 270, 280, 280] as const;
const T2_2_N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const T2_2_ETA = [45, 45, 45, 45, 45, 45, 45, 45, 45, 45] as const;
const T2_2_MU = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0] as const;

const L4_R1 = [2.5, 2.0, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5] as const;
const L4_L1A = [80, 90, 95, 100, 100, 110, 100, 90, 90, 100] as const;
const L4_B1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const L4_R2 = [7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 8.5, 8.5, 8.0, 7.5] as const;
const L4_L1B = [110, 100, 90, 80, 80, 80, 90, 90, 100, 110] as const;
const L4_B2 = [11, 12, 13, 14, 15, 15, 14, 13, 12, 11] as const;
const L4_R3 = [7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5] as const;
const L4_L1C = [95, 90, 95, 100, 105, 110, 105, 100, 95, 90] as const;
const L4_B3 = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

const L4_G_BY_ID: Record<number, number> = {
  1: 250,
  2: 470,
  3: 690,
  4: 934,
  5: 12,
  6: 24,
  7: 8,
  8: 16,
  9: 240,
  10: 480,
  11: 150,
  12: 300,
  13: 70,
  14: 95,
  15: 117,
};

const L4_SPT = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550] as const;
const L4_SC = [160, 180, 200, 220, 250, 260, 280, 300, 320, 340] as const;
const L4_ALPHA1_E3 = [20, 25, 30, 35, 40, 45, 40, 35, 30, 25] as const;
const L4_ALPHA2_E2 = [95, 90, 85, 80, 75, 70, 75, 80, 85, 90] as const;
const L4_BETA1_E3 = [34, 33, 32, 31, 30, 31, 32, 33, 34, 35] as const;
const L4_BETA2_E2 = [75, 80, 85, 90, 95, 90, 85, 80, 75, 70] as const;

function lesson2Table1Values(digit: number): Record<string, number> {
  return {
    lengthM: T2_1_L[digit],
    widthM: T2_1_B[digit],
    heightM: T2_1_H[digit],
    lampFluxLm: T2_1_FL[digit],
    eNormLux: T2_1_EN[digit],
    reserveFactor: 0,
    nonUniformity: 0,
    tabWm: 0,
    tabWt: 0,
    roomAreaM2: 0,
    lampsPerLuminaire: 0,
    etaPct: 0,
    mu: 0,
  };
}

export function lesson2MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number> {
  return {
    lengthM: T2_1_L[lastDigit],
    widthM: T2_1_B[lastDigit],
    heightM: T2_1_H[lastDigit],
    lampFluxLm: T2_1_FL[lastDigit],
    eNormLux: T2_1_EN[lastDigit],
    reserveFactor: T2_2_KZ[penultimateDigit],
    nonUniformity: T2_2_Z[penultimateDigit],
    tabWm: T2_2_WM[penultimateDigit],
    tabWt: T2_2_WM[penultimateDigit],
    roomAreaM2: T2_2_SP[penultimateDigit],
    lampsPerLuminaire: T2_2_N[penultimateDigit],
    etaPct: T2_2_ETA[penultimateDigit],
    mu: T2_2_MU[penultimateDigit],
  };
}

function lesson1Values(base: number): Record<string, number> {
  return {
    intensityCd: 700 + base * 80,
    solidAngleSr: 1 + (base % 4) * 0.2,
    workAreaM2: 0.8 + (base % 3) * 0.2,
    heightM: 2.5 + (base % 4) * 0.2,
    distanceM: 0.5 + (base % 5) * 0.2,
    eMaxLux: 420 + base * 12,
    eMinLux: 280 + base * 9,
    eAvgLux: 350 + base * 10,
  };
}

function lesson3Values(base: number): Record<string, number> {
  return {
    sourceA1mDb: 96 + (base % 4) * 2,
    sourceB1mDb: 88 + (base % 5) * 2,
    sourceC1mDb: 82 + (base % 4) * 2,
    distanceA: 2 + (base % 4),
    distanceB: 3 + (base % 5),
    distanceC: 4 + (base % 4),
    barrierMassA: 120 + base * 10,
    barrierMassB: 120 + base * 10,
    barrierMassC: 120 + base * 10,
  };
}

function lesson4Index(digit: number): number {
  return digit === 0 ? 9 : digit - 1;
}

function lesson4SourceValues(lastDigit: number): Record<string, number> {
  const index = lesson4Index(lastDigit);
  return {
    sourceA1mDb: L4_L1A[index],
    sourceB1mDb: L4_L1B[index],
    sourceC1mDb: L4_L1C[index],
    distanceA: L4_R1[index],
    distanceB: L4_R2[index],
    distanceC: L4_R3[index],
    barrierIdA: L4_B1[index],
    barrierIdB: L4_B2[index],
    barrierIdC: L4_B3[index],
    barrierMassA: L4_G_BY_ID[L4_B1[index]],
    barrierMassB: L4_G_BY_ID[L4_B2[index]],
    barrierMassC: L4_G_BY_ID[L4_B3[index]],
  };
}

export function lesson4RoomValues(penultimateDigit: number): Record<string, number> {
  return {
    surfaceCeilingFloorM2: L4_SPT[penultimateDigit],
    surfaceWallsM2: L4_SC[penultimateDigit],
    alpha1e3: L4_ALPHA1_E3[penultimateDigit],
    alpha2e2: L4_ALPHA2_E2[penultimateDigit],
    beta1e3: L4_BETA1_E3[penultimateDigit],
    beta2e2: L4_BETA2_E2[penultimateDigit],
    alpha1: L4_ALPHA1_E3[penultimateDigit] / 1000,
    alpha2: L4_ALPHA2_E2[penultimateDigit] / 100,
    beta1: L4_BETA1_E3[penultimateDigit] / 1000,
    beta2: L4_BETA2_E2[penultimateDigit] / 100,
    floorGamma: 0.061,
  };
}

export function lesson4MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number> {
  return {
    ...lesson4SourceValues(lastDigit),
    ...lesson4RoomValues(penultimateDigit),
  };
}

function lesson5Values(base: number): Record<string, number> {
  return {
    frequencyHz: 1.5e6 + base * 0.3e6,
    electricFieldVpm: 10 + base,
    magneticFieldApm: 0.05 + base * 0.01,
    distanceM: 0.4 + base * 0.08,
    sourcePowerW: 60 + base * 15,
    sourceGain: 8 + (base % 5),
  };
}

function makeVariants(
  sourceNote: string,
  valuesFactory: (base: number) => Record<string, number | string>,
  validated = false,
): LabVariant[] {
  return Array.from({ length: 10 }, (_, variant) => ({
    variant,
    ticketLastDigits: [variant],
    values: valuesFactory(variant),
    sourceNote,
    validated,
  }));
}

const sourceNote =
  'Данные вариантов перенесены в приложение и требуют верификации по files/labs doc/lab txt 1.txt ... 5.txt (и PDF в той же папке).';

const sourceNote2 =
  'Таблица 2.1 использует последнюю цифру студбилета, а таблица 2.2 — предпоследнюю. Автоподстановка объединяет обе таблицы.';

const sourceNote4 =
  'Таблица 4.1 и таблица 4.2 используют последнюю цифру студбилета, а таблица 4.3 — предпоследнюю. В приложении данные объединяются в один вариант расчёта.';

const lesson2Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson2Table1Values(digit),
  sourceNote: sourceNote2,
  validated: true,
}));

const lesson4Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson4SourceValues(digit),
  sourceNote: sourceNote4,
  validated: true,
}));

/* ─── Lab 6: Table 6.1 (last digit) ─── */
const L6_W = [3, 12, 6, 15, 19, 3, 12, 6, 15, 9] as const;
const L6_I = [150, 350, 250, 100, 60, 40, 80, 200, 300, 400] as const;
const L6_F = [3e8, 3e8, 4e8, 3e8, 4e8, 3e8, 4e8, 3e8, 4e8, 4e8] as const;
const L6_T = [4, 4, 2, 0.2, 4, 6, 0.2, 4, 2, 0.2] as const;
const L6_D = [6e-2, 1e-2, 2e-2, 3e-2, 4e-2, 5e-2, 4e-2, 3e-2, 2e-2, 1e-2] as const;
const L6_R = [2, 3, 2, 3, 2, 3, 2, 3, 2, 3] as const;
const L6_r = [0.15, 0.25, 0.1, 0.2, 0.1, 0.2, 0.1, 0.25, 0.1, 0.2] as const;

/* Lab 6: Table 6.2 (penultimate digit) */
const L6_MU = [1, 200, 1, 200, 1, 200, 1, 200, 1, 200] as const;
const L6_MU_A = [1.2e-6, 2.5e-4, 1.2e-6, 2.5e-4, 1.2e-6, 2.5e-4, 1.2e-6, 2.5e-4, 1.2e-6, 2.5e-4] as const;
const L6_GAMMA = [5.7e7, 1e7, 5.7e7, 1e7, 5.7e7, 1e7, 5.7e7, 1e7, 5.7e7, 1e7] as const;
const L6_EPS = [7.5, 7, 8, 3, 7.5, 7.5, 3, 8, 7, 7.5] as const;

function lesson6Table1Values(digit: number): Record<string, number> {
  return {
    W: L6_W[digit], I: L6_I[digit], f: L6_F[digit], T: L6_T[digit],
    D: L6_D[digit], R: L6_R[digit], r: L6_r[digit],
  };
}

export function lesson6MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number> {
  return {
    ...lesson6Table1Values(lastDigit),
    mu: L6_MU[penultimateDigit], muA: L6_MU_A[penultimateDigit],
    gamma: L6_GAMMA[penultimateDigit], epsilon: L6_EPS[penultimateDigit],
  };
}

const sourceNote6 =
  'Таблица 6.1 (последняя цифра) + таблица 6.2 (предпоследняя цифра). Объединены для автоподстановки.';

const lesson6Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson6Table1Values(digit),
  sourceNote: sourceNote6,
  validated: true,
}));

/* ─── Lab 7: Table 7.1 (last digit) ─── */
const L7_LAMBDA = [1050, 1650, 40, 1200, 80, 1750, 20, 1050, 70, 1900] as const;
const L7_P_KW = [250, 300, 150, 250, 100, 350, 100, 250, 100, 350] as const;
const L7_GA = [1.05, 1.1, 240, 1.04, 200, 1.1, 180, 1.05, 205, 1.2] as const;
const L7_THETA = [7, 7, 10, 4, 3, 4, 5, 7, 4, 5] as const;
const L7_SIGMA = [0.003, 0.003, 0.001, 0.01, 0.001, 0.00075, 0.001, 0.003, 0.001, 0.01] as const;

/* Lab 7: Table 7.2 — distances d1…d5 (penultimate digit) */
const L7_D1 = [400, 400, 500, 300, 600, 520, 660, 400, 450, 550] as const;
const L7_D2 = [700, 700, 800, 600, 900, 800, 960, 750, 800, 950] as const;
const L7_D3 = [1100, 1100, 1200, 1150, 1300, 1350, 1100, 1250, 1300, 1400] as const;
const L7_D4 = [1500, 1500, 1600, 1700, 1700, 1600, 1500, 1600, 1700, 1800] as const;
const L7_D5 = [2000, 2000, 2100, 2000, 2200, 2000, 2300, 2400, 2500, 2000] as const;

function lesson7Table1Values(digit: number): Record<string, number> {
  return {
    lambda: L7_LAMBDA[digit], powerKW: L7_P_KW[digit], Ga: L7_GA[digit],
    theta: L7_THETA[digit], sigma: L7_SIGMA[digit],
  };
}

export function lesson7MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number> {
  return {
    ...lesson7Table1Values(lastDigit),
    d1: L7_D1[penultimateDigit], d2: L7_D2[penultimateDigit],
    d3: L7_D3[penultimateDigit], d4: L7_D4[penultimateDigit],
    d5: L7_D5[penultimateDigit],
  };
}

const sourceNote7 =
  'Таблица 7.1 (последняя цифра) + таблица 7.2 (предпоследняя цифра). Расчёт по Шулейкину–Ван-дер-Полю.';

const lesson7Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson7Table1Values(digit),
  sourceNote: sourceNote7,
  validated: true,
}));

/* ─── Lab 8: Table 8.2 (last digit, digit 0→index 9) ─── */
const L8_F_RANGE = ['48-57', '48-57', '58-66', '76-84', '84-92', '92-100', '174-182', '182-190', '190-198', '198-206'] as const;
const L8_P_IMG = [94, 80, 55, 73, 50, 78, 60, 65, 87, 75] as const;
const L8_P_SND = [23, 20, 16, 26, 15, 24, 18, 25, 30, 30] as const;
const L8_G = [15, 12, 15, 10, 15, 16, 21, 13, 12, 14] as const;
const L8_H = [330, 300, 340, 320, 360, 330, 327, 320, 340, 360] as const;
const L8_K = [1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41] as const;

/* Lab 8: Table 8.3 — distances r1…r5 (penultimate digit) */
const L8_R1 = [50, 50, 35, 40, 35, 55, 60, 48, 54, 46] as const;
const L8_R2 = [150, 150, 125, 140, 135, 150, 140, 170, 190, 160] as const;
const L8_R3 = [300, 300, 270, 280, 290, 300, 290, 310, 280, 300] as const;
const L8_R4 = [450, 450, 480, 420, 460, 450, 440, 460, 470, 480] as const;
const L8_R5 = [550, 550, 580, 600, 590, 500, 550, 560, 570, 580] as const;

function lesson8Table2Values(digit: number): Record<string, number | string> {
  return {
    pImageKW: L8_P_IMG[digit],
    pSoundKW: L8_P_SND[digit],
    G: L8_G[digit],
    H: L8_H[digit],
    K: L8_K[digit],
    fRangeMHz: L8_F_RANGE[digit],
  };
}

/** Таблица 6.2 — только предпоследняя цифра (для отображения в Лабораторной). */
export const lesson6Table2Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: {
    l6_mu: L6_MU[digit],
    l6_muA: L6_MU_A[digit],
    l6_gamma: L6_GAMMA[digit],
    l6_epsilon: L6_EPS[digit],
  },
  sourceNote: 'Таблица 6.2 методички',
  validated: true,
}));

/** Таблица 7.2 — только предпоследняя цифра. */
export const lesson7Table2Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: {
    d1: L7_D1[digit], d2: L7_D2[digit], d3: L7_D3[digit], d4: L7_D4[digit], d5: L7_D5[digit],
  },
  sourceNote: 'Таблица 7.2 методички',
  validated: true,
}));

/** Таблица 8.3 — только предпоследняя цифра. */
export const lesson8Table3Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: {
    r1: L8_R1[digit], r2: L8_R2[digit], r3: L8_R3[digit], r4: L8_R4[digit], r5: L8_R5[digit],
  },
  sourceNote: 'Таблица 8.3 методички',
  validated: true,
}));

export function lesson8MergedValues(
  lastDigit: number,
  penultimateDigit: number,
): Record<string, number | string> {
  return {
    ...lesson8Table2Values(lastDigit),
    r1: L8_R1[penultimateDigit],
    r2: L8_R2[penultimateDigit],
    r3: L8_R3[penultimateDigit],
    r4: L8_R4[penultimateDigit],
    r5: L8_R5[penultimateDigit],
  };
}

const sourceNote8 =
  'Таблица 8.2 (последняя цифра) + таблица 8.3 (предпоследняя цифра). Расчёт E для передатчиков телецентра.';

const lesson8Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson8Table2Values(digit),
  sourceNote: sourceNote8,
  validated: true,
}));

/* ─── Lab 9: No variant table — body resistance is measured ─── */
function lesson9Values(base: number): Record<string, number> {
  return {
    voltageV: 36 + base * 2,
    frequencyHz: 50,
    internalResistanceOhm: 500 + base * 20,
    skinCapacitanceNF: 20 + base * 2,
  };
}

/* ─── Lab 10: No variant table — theoretical calculations ─── */
function lesson10Values(base: number): Record<string, number> {
  return {
    faultCurrentA: 5 + base * 2,
    soilResistivityOhmM: 50 + base * 20,
    stepLengthM: 0.8,
  };
}

/* ─── Lab 14: Theory-first; variant tables from manual not used in app yet ─── */
function lesson14Values(_base: number): Record<string, number | string> {
  return {};
}

function lesson15Values(_base: number): Record<string, number | string> {
  return {};
}

function lesson11Values(base: number): Record<string, number> {
  return {
    UphiV: 210 + base * 8,
    bodyResistanceOhm: 750 + base * 120,
  };
}

/* ─── Lab 12: Table 12.1 (penultimate digit) + Table 12.2 (last digit) ─── */
const L12_SOIL = [
  'Песок влажный',
  'Сухой песок',
  'Суглинок',
  'Глина',
  'Чернозём',
  'Торф',
  'Песок влажный',
  'Сухой песок',
  'Суглинок',
  'Чернозём',
] as const;
const L12_RHO = [500, 300, 80, 60, 50, 25, 450, 350, 90, 65] as const;
const L12_RN = [4, 10, 20, 4, 10, 20, 4, 10, 20, 4] as const;
const L12_ZN = [0.8, 1.4, 1.6, 2, 2.4, 3.2, 3.6, 4.5, 5, 6.3] as const;
const L12_ZH = [0.5, 0.9, 0.9, 1, 1.2, 1.8, 2.1, 2.8, 3.0, 4.0] as const;
const L12_RZM = [100, 150, 100, 75, 50, 50, 100, 100, 200, 100] as const;
const L12_L = [4, 6, 2, 3, 2, 3, 2, 3, 2, 3] as const;
const L12_D = [0.03, 0.05, 0.07, 0.03, 0.05, 0.07, 0.03, 0.05, 0.07, 0.03] as const;
const L12_T = [2, 2.5, 2, 2.5, 2, 2.5, 2, 2.5, 2, 2.5] as const;
const L12_ETA = [0.65, 0.67, 0.69, 0.71, 0.73, 0.75, 0.77, 0.79, 0.81, 0.83] as const;

/** Столбцы таблиц 12.1 / 12.2: порядок 1…9, 0 → индекс 0…9. */
function lesson12TicketDigitColumnIndex(digit: number): number {
  const d = ((digit % 10) + 10) % 10;
  return d === 0 ? 9 : d - 1;
}

function lesson12Table1Values(penultimateDigit: number): Record<string, number | string> {
  const i = lesson12TicketDigitColumnIndex(penultimateDigit);
  return { soilType: L12_SOIL[i], rhoOhmM: L12_RHO[i] };
}

function lesson12Table2Values(lastDigit: number): Record<string, number> {
  const i = lesson12TicketDigitColumnIndex(lastDigit);
  return {
    UphiV: 220,
    RnOhm: L12_RN[i],
    ZnOhm: L12_ZN[i],
    ZHOhm: L12_ZH[i],
    RzmOhm: L12_RZM[i],
    lPipeM: L12_L[i],
    dPipeM: L12_D[i],
    tPipeM: L12_T[i],
    etaZ: L12_ETA[i],
  };
}

export function lesson12MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number | string> {
  return { ...lesson12Table1Values(penultimateDigit), ...lesson12Table2Values(lastDigit) };
}

const sourceNote12 =
  'Таблица 12.1 (предпоследняя цифра) + таблица 12.2 (последняя цифра). U_ф = 220 В для всех вариантов.';

const lesson12Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson12Table2Values(digit),
  sourceNote: sourceNote12,
  validated: true,
}));

/** Таблица 12.1 — по предпоследней цифре (отображение в лабораторной). */
export const lesson12Table1Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson12Table1Values(digit),
  sourceNote: 'Таблица 12.1 методички',
  validated: true,
}));

/* ─── Lab 13: Table 13.1 (last digit) + Table 13.2 (penultimate digit) ─── */

const L13_LVJ = ['Бензол', 'Этанол', 'Ацетон', 'Этанол', 'Ацетон', 'Бензол', 'Бензол', 'Ацетон', 'Этанол', 'Бензол'] as const;
const L13_ETA = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5] as const;
const L13_S = [100, 150, 250, 200, 50, 200, 250, 300, 250, 300] as const;
const L13_T = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 2, 1] as const;
const L13_GI = [10, 20, 30, 40, 50, 60, 70, 15, 25, 35] as const;
const L13_SA = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140] as const;
const L13_X = [10, 5, 8, 4, 6, 5, 3, 7, 8, 9] as const;

const L13_V = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140] as const;
const L13_G = [1, 2, 1, 4, 2, 3, 1, 4, 5, 12] as const;
const L13_VSV = [110, 120, 130, 140, 150, 160, 170, 180, 190, 200] as const;
const L13_KH = [5, 1, 2, 3, 4, 5, 4, 3, 2, 1] as const;
const L13_MLVJ = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] as const;
const L13_Y = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function lesson13Table1Values(lastDigit: number): Record<string, number | string> {
  const d = ((lastDigit % 10) + 10) % 10;
  return {
    lvj: L13_LVJ[d],
    eta: L13_ETA[d],
    areaS_m2: L13_S[d],
    t_h: L13_T[d],
    Gi_kg: L13_GI[d],
    SA_m2: L13_SA[d],
    x: L13_X[d],
  };
}

function lesson13Table2Values(penultimateDigit: number): Record<string, number> {
  const d = ((penultimateDigit % 10) + 10) % 10;
  return {
    V_m3: L13_V[d],
    G_kgm3: L13_G[d],
    Vsv_m3: L13_VSV[d],
    KH: L13_KH[d],
    Mlvj_kg: L13_MLVJ[d],
    y: L13_Y[d],
  };
}

export function lesson13MergedValues(lastDigit: number, penultimateDigit: number): Record<string, number | string> {
  return { ...lesson13Table1Values(lastDigit), ...lesson13Table2Values(penultimateDigit), Szd_m2: 2000 };
}

const sourceNote13 =
  'Таблица 13.1 (последняя цифра) + таблица 13.2 (предпоследняя цифра). Параметры ЛВЖ: табл. 13.3.';

const lesson13Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson13Table1Values(digit),
  sourceNote: sourceNote13,
  validated: true,
}));

export const lesson13Table2Variants: LabVariant[] = Array.from({ length: 10 }, (_, digit) => ({
  variant: digit,
  ticketLastDigits: [digit],
  values: lesson13Table2Values(digit),
  sourceNote: 'Таблица 13.2 методички',
  validated: true,
}));

/** Таблица 13.3 — физико-химические показатели ЛВЖ (общая для всех вариантов). */
export const lesson13Table3Variants: LabVariant[] = [
  {
    variant: 0,
    ticketLastDigits: [],
    displayLabel: 'Ацетон',
    values: {
      l13_formula: '(CH3)2CO',
      l13_M: 58,
      l13_rho: 2.44,
      l13_Tvsp: -19,
      l13_Pmax: 875,
      l13_Cnkn: 2.2,
      l13_PH: 24.54,
    },
    sourceNote: 'Таблица 13.3 методички',
    validated: true,
  },
  {
    variant: 1,
    ticketLastDigits: [],
    displayLabel: 'Бензол',
    values: {
      l13_formula: 'C6H6',
      l13_M: 78,
      l13_rho: 4.3,
      l13_Tvsp: -11,
      l13_Pmax: 900,
      l13_Cnkn: 1.2,
      l13_PH: 16.03,
    },
    sourceNote: 'Таблица 13.3 методички',
    validated: true,
  },
  {
    variant: 2,
    ticketLastDigits: [],
    displayLabel: 'Этанол',
    values: {
      l13_formula: 'C2H5OH',
      l13_M: 46,
      l13_rho: 1.94,
      l13_Tvsp: 12,
      l13_Pmax: 865,
      l13_Cnkn: 3.1,
      l13_PH: 7.97,
    },
    sourceNote: 'Таблица 13.3 методички',
    validated: true,
  },
];

/** Индекс столбца табл. 13.3 по названию ЛВЖ из табл. 13.1. */
export function lesson13Table3ActiveColumn(lvj: string): number {
  const s = lvj.trim();
  if (s === 'Ацетон') return 0;
  if (s === 'Бензол') return 1;
  if (s === 'Этанол') return 2;
  return 0;
}

/* ─── Data category exports: lab vs theory split ─── */

/** Lab 6 lab-specific data (student variant values from tables 6.1 + 6.2) */
export const lesson6LabData = {
  table61: { W: L6_W, I: L6_I, f: L6_F, R: L6_R, D: L6_D, T: L6_T },
  table62: { mu: L6_MU, muA: L6_MU_A, gamma: L6_GAMMA, epsilon: L6_EPS },
};

/** Lab 6 theory/reference data (constants used in formulas) */
export const lesson6TheoryData = {
  mu0: 4 * Math.PI * 1e-7,
  c: 299_792_458,
  npToDb: 8.68,
  energyLoadN: 2,
};

/** Lab 7 lab-specific data (student variant values from tables 7.1 + 7.2) */
export const lesson7LabData = {
  table71: { lambda: L7_LAMBDA, powerKW: L7_P_KW, Ga: L7_GA, theta: L7_THETA, sigma: L7_SIGMA },
  table72: { d1: L7_D1, d2: L7_D2, d3: L7_D3, d4: L7_D4, d5: L7_D5 },
};

/** Lab 7 theory/reference data */
export const lesson7TheoryData = {
  c: 299_792_458,
  fieldConstant: 245,
};

/** Lab 8 lab-specific data (student variant values from tables 8.2 + 8.3) */
export const lesson8LabData = {
  table82: { fRange: L8_F_RANGE, pImageKW: L8_P_IMG, pSoundKW: L8_P_SND, G: L8_G, H: L8_H, K: L8_K },
  table83: { r1: L8_R1, r2: L8_R2, r3: L8_R3, r4: L8_R4, r5: L8_R5 },
};

/** Lab 8 theory/reference data */
export const lesson8TheoryData = {
  kHorizontalDefault: 1.41,
  speedOfLight: 299_792_458,
};

export const lessonVariants: Record<LessonId, LabVariant[]> = {
  1: makeVariants(sourceNote, lesson1Values),
  2: lesson2Variants,
  3: makeVariants(sourceNote, lesson3Values),
  4: lesson4Variants,
  5: makeVariants(sourceNote, lesson5Values),
  6: lesson6Variants,
  7: lesson7Variants,
  8: lesson8Variants,
  9: makeVariants('Лабораторная работа без вариантной таблицы; параметры задаются для моделирования.', lesson9Values),
  10: makeVariants('Лабораторная работа без вариантной таблицы; расчёт зоны растекания тока.', lesson10Values),
  11: makeVariants(
    'Исходные данные по варианту: последняя цифра номера зачётной книжки (как табл. 6.1 у работы 6). Параметры Uφ, R_h.',
    lesson11Values,
  ),
  12: lesson12Variants,
  13: lesson13Variants,
  14: makeVariants(
    'Занятие №14: таблицы варианта в приложении не заданы; материал — теория и иллюстрации по методичке.',
    lesson14Values,
  ),
  15: makeVariants(
    'Занятие №15: таблицы варианта в приложении не заданы; материал — теория и иллюстрации по методичке.',
    lesson15Values,
  ),
};

export function pickVariantByTicketDigits(lessonId: LessonId, ticketInput: string): LabVariant {
  const digits = ticketInput.replace(/\D/g, '');
  const lastDigit = digits.length > 0 ? Number(digits[digits.length - 1]) : 0;
  const penultimateDigit = digits.length > 1 ? Number(digits[digits.length - 2]) : 0;

  if (lessonId === 2) {
    const base = lessonVariants[2].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[2][0];
    return {
      ...base,
      values: lesson2MergedValues(lastDigit, penultimateDigit),
    };
  }

  if (lessonId === 4) {
    const base = lessonVariants[4].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[4][0];
    return {
      ...base,
      values: lesson4MergedValues(lastDigit, penultimateDigit),
    };
  }

  if (lessonId === 6) {
    const base = lessonVariants[6].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[6][0];
    return { ...base, values: lesson6MergedValues(lastDigit, penultimateDigit) };
  }

  if (lessonId === 7) {
    const base = lessonVariants[7].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[7][0];
    return { ...base, values: lesson7MergedValues(lastDigit, penultimateDigit) };
  }

  if (lessonId === 8) {
    const base = lessonVariants[8].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[8][0];
    return { ...base, values: lesson8MergedValues(lastDigit, penultimateDigit) };
  }

  if (lessonId === 12) {
    const base = lessonVariants[12].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[12][0];
    return { ...base, values: lesson12MergedValues(lastDigit, penultimateDigit) };
  }

  if (lessonId === 13) {
    const base = lessonVariants[13].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[13][0];
    return { ...base, values: lesson13MergedValues(lastDigit, penultimateDigit) };
  }

  return lessonVariants[lessonId].find((row) => row.ticketLastDigits.includes(lastDigit)) ?? lessonVariants[lessonId][0];
}

