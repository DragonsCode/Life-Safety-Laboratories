/**
 * Labs 9–10 — Электробезопасность
 * Body impedance, step voltage, ground current spreading.
 */

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite value > 0`);
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite value >= 0`);
  }
}

/* ─── Lab 9: Impedance of human body ─── */

/**
 * Ток через человека, мА. (формула 9.1)
 * Iч = U_пр / Z  (результат в мА)
 */
export function bodyCurrentMA(touchVoltageV: number, impedanceOhm: number): number {
  assertFiniteNonNegative(touchVoltageV, 'touchVoltageV');
  assertFinitePositive(impedanceOhm, 'impedanceOhm');
  return (touchVoltageV / impedanceOhm) * 1000;
}

/**
 * Полное сопротивление тела при пути рука–рука, Ом. (формула 9.3)
 * Z = 2·Zн + Rв
 */
export function totalBodyImpedance(skinImpedanceOhm: number, internalResistanceOhm: number): number {
  assertFiniteNonNegative(skinImpedanceOhm, 'skinImpedanceOhm');
  assertFiniteNonNegative(internalResistanceOhm, 'internalResistanceOhm');
  return 2 * skinImpedanceOhm + internalResistanceOhm;
}

/**
 * Импеданс наружного слоя кожи Zн, Ом. (формула 9.4)
 * Zн = Rн / √(1 + (2π f C Rн)²)
 */
export function skinImpedance(
  skinResistanceOhm: number,
  frequencyHz: number,
  capacitanceF: number,
): number {
  assertFiniteNonNegative(skinResistanceOhm, 'skinResistanceOhm');
  assertFinitePositive(frequencyHz, 'frequencyHz');
  assertFinitePositive(capacitanceF, 'capacitanceF');
  const term = 2 * Math.PI * frequencyHz * capacitanceF * skinResistanceOhm;
  return skinResistanceOhm / Math.sqrt(1 + term * term);
}

/**
 * Извлечение Rн из измеренного Z(0) при постоянном токе. (формула 9.7)
 * Rн = (Z(0) − Rв) / 2
 */
export function extractSkinResistance(totalImpedanceDC: number, internalResistanceOhm: number): number {
  assertFinitePositive(totalImpedanceDC, 'totalImpedanceDC');
  assertFiniteNonNegative(internalResistanceOhm, 'internalResistanceOhm');
  return (totalImpedanceDC - internalResistanceOhm) / 2;
}

/**
 * При f ≥ 10 кГц импеданс кожи стремится к 0. (формула 9.8)
 * Z ≈ Rв
 */
export function highFrequencyImpedance(internalResistanceOhm: number): number {
  assertFiniteNonNegative(internalResistanceOhm, 'internalResistanceOhm');
  return internalResistanceOhm;
}

/**
 * Степень опасности тока.
 */
export type CurrentDangerLevel = 'safe' | 'perceptible' | 'non-releasing' | 'fibrillation';

export function classifyCurrentDanger(currentMA: number, isAC50Hz = true): CurrentDangerLevel {
  assertFiniteNonNegative(currentMA, 'currentMA');
  if (isAC50Hz) {
    if (currentMA < 0.5) return 'safe';
    if (currentMA < 10) return 'perceptible';
    if (currentMA < 100) return 'non-releasing';
    return 'fibrillation';
  }
  // DC
  if (currentMA < 5) return 'safe';
  if (currentMA < 50) return 'perceptible';
  if (currentMA < 300) return 'non-releasing';
  return 'fibrillation';
}

/* ─── Lab 10: Ground current spreading & step voltage ─── */

/**
 * Плотность тока в земле, А/м². (формула 10.1)
 * j = Iз / (2π·x²)
 */
export function currentDensity(faultCurrentA: number, distanceM: number): number {
  assertFinitePositive(faultCurrentA, 'faultCurrentA');
  assertFinitePositive(distanceM, 'distanceM');
  return faultCurrentA / (2 * Math.PI * distanceM * distanceM);
}

/**
 * Напряжённость поля в грунте, В/м. (формула 10.2)
 * E = j · ρ
 */
export function groundFieldStrength(currentDensityAm2: number, soilResistivityOhmM: number): number {
  assertFiniteNonNegative(currentDensityAm2, 'currentDensityAm2');
  assertFinitePositive(soilResistivityOhmM, 'soilResistivityOhmM');
  return currentDensityAm2 * soilResistivityOhmM;
}

/**
 * Потенциал точки в зоне растекания, В. (формула 10.4)
 * UA = Iз · ρ / (2π · x)
 */
export function groundPotential(
  faultCurrentA: number,
  soilResistivityOhmM: number,
  distanceM: number,
): number {
  assertFinitePositive(faultCurrentA, 'faultCurrentA');
  assertFinitePositive(soilResistivityOhmM, 'soilResistivityOhmM');
  assertFinitePositive(distanceM, 'distanceM');
  return (faultCurrentA * soilResistivityOhmM) / (2 * Math.PI * distanceM);
}

/**
 * Шаговое напряжение, В.
 * Uш = Iз·ρ·a / (2π·x₁·(x₁+a))
 */
export function stepVoltage(
  faultCurrentA: number,
  soilResistivityOhmM: number,
  distanceM: number,
  stepLengthM = 0.8,
): number {
  assertFinitePositive(faultCurrentA, 'faultCurrentA');
  assertFinitePositive(soilResistivityOhmM, 'soilResistivityOhmM');
  assertFinitePositive(distanceM, 'distanceM');
  assertFinitePositive(stepLengthM, 'stepLengthM');
  return (
    (faultCurrentA * soilResistivityOhmM * stepLengthM) /
    (2 * Math.PI * distanceM * (distanceM + stepLengthM))
  );
}

/**
 * Безопасное расстояние — дистанция, на которой Uш < threshold.
 * Решаем: Iз·ρ·a / (2π·x·(x+a)) < threshold
 * Итерируем от x=1 с шагом 0.5 пока Uш > threshold.
 */
export function safeDistance(
  faultCurrentA: number,
  soilResistivityOhmM: number,
  thresholdV: number,
  stepLengthM = 0.8,
): number {
  assertFinitePositive(faultCurrentA, 'faultCurrentA');
  assertFinitePositive(soilResistivityOhmM, 'soilResistivityOhmM');
  assertFinitePositive(thresholdV, 'thresholdV');
  let x = 0.5;
  while (x < 100) {
    if (stepVoltage(faultCurrentA, soilResistivityOhmM, x, stepLengthM) < thresholdV) {
      return x;
    }
    x += 0.5;
  }
  return x;
}

/* ─── Lab 11: Three-phase touch (pedagogical estimate) ─── */

export type Lesson11Network = 'IT' | 'TN';
export type Lesson11Regime = 'normal' | 'emergency';

export interface Lesson11TouchParams {
  network: Lesson11Network;
  regime: Lesson11Regime;
  /** Индекс фазы 0..2, к которой прикасаются (L1..L3) */
  touchedPhaseIndex: number;
  UphiV: number;
  RhOhm: number;
  /** R_з — сопротивление заземления нейтрали, Ом (TN) */
  RgOhm: number;
  /** R_зм — контакт КЗ фазы на землю, Ом (авария TN) */
  RzmOhm: number;
  /** Эквивалентное сопротивление изоляции одной фазы относительно земли, Ом (IT; ветви параллельно дают R/3 на путь) */
  RisoOhm: number;
}

/**
 * Упрощённая оценка Uпр и I для наглядной модели (занятие 11).
 * IT: цепь через последовательное R_h и R_iso/3.
 * TN норма: делитель U_ф между R_h и R_з.
 * TN авария: фаза 0 замкнута на землю через R_зм; касание исправной фазы — по форме U_л·R_h/(R_h+R_зм).
 */
export function lesson11TouchEstimate(p: Lesson11TouchParams): { UprV: number; ImA: number } {
  const U = Math.max(1e-6, p.UphiV);
  const Rh = Math.max(1, p.RhOhm);
  const Rg = Math.max(0.01, p.RgOhm);
  const Rzm = Math.max(0.01, p.RzmOhm);
  const Riso = Math.max(10, p.RisoOhm);

  if (p.network === 'IT') {
    const Rret = Riso / 3;
    const Upr = (U * Rh) / (Rh + Rret);
    return { UprV: Upr, ImA: (Upr / Rh) * 1000 };
  }

  if (p.regime === 'normal') {
    const Upr = (U * Rh) / (Rh + Rg);
    return { UprV: Upr, ImA: (Upr / Rh) * 1000 };
  }

  const faultPhase = 0;
  const touched = Math.min(2, Math.max(0, Math.floor(p.touchedPhaseIndex)));
  if (touched === faultPhase) {
    const Upr = (U * Rzm) / (Rzm + Rh);
    return { UprV: Upr, ImA: (Upr / Rh) * 1000 };
  }
  const sqrt3 = Math.sqrt(3);
  const Upr = (sqrt3 * U * Rh) / (Rh + Rzm);
  return { UprV: Upr, ImA: (Upr / Rh) * 1000 };
}

/* ─── Lab 12: TN-C/C-S, зануление, обрыв нуля (упрощённые формулы 12.2–12.13) ─── */

export type Lesson12TnScenario =
  | 'normal'
  | 'sc_enclosure'
  | 'sc_enclosure_repeat'
  | 'break_after_fault'
  | 'break_before_ok'
  | 'break_after_repeat'
  | 'break_before_repeat'
  | 'phase_to_soil';

export interface Lesson12TnLabParams {
  scenario: Lesson12TnScenario;
  /** U_ф, В */
  UphiV: number;
  /** Z_n, петля «фаза–нуль», Ом (12.2) */
  ZnOhm: number;
  /** Z_H, нулевой провод, Ом */
  ZHOhm: number;
  /** R_0, заземление нейтрали, Ом (в методичке часто 4 Ом) */
  R0Ohm: number;
  /** R_n, повторное заземление нуля, Ом */
  RnOhm: number;
  /** R_зм, сопротивление места замыкания фазы на землю, Ом (12.13) */
  RzmOhm: number;
  /** R_h, тело человека, Ом */
  RhOhm: number;
}

/**
 * Педагогическая модель для вкладки «Лабораторная» (занятие 12).
 * I_к.з. = U_ф / Z_n; напряжение на корпусе — по выбранному сценарию; I_h = U_корп / R_h.
 */
export function lesson12TnLabEstimate(p: Lesson12TnLabParams): {
  IkzA: number;
  UenclosureV: number;
  IbodyMA: number;
  caption: string;
} {
  const U = Math.max(1e-6, p.UphiV);
  const Zn = Math.max(1e-3, p.ZnOhm);
  const Zh = Math.max(1e-3, p.ZHOhm);
  const R0 = Math.max(1e-3, p.R0Ohm);
  const Rn = Math.max(1e-3, p.RnOhm);
  const Rzm = Math.max(1e-3, p.RzmOhm);
  const Rh = Math.max(1, p.RhOhm);
  const Ikz = U / Zn;

  let Uencl = 0;
  let caption = '';

  switch (p.scenario) {
    case 'normal':
      Uencl = 0;
      caption = 'Норма: занулённый корпус на потенциале нуля';
      break;
    case 'sc_enclosure':
      Uencl = Ikz * Zh;
      caption = 'КЗ на занулённый корпус, без повторного заземления нуля (12.3)';
      break;
    case 'sc_enclosure_repeat': {
      const Ukz = Ikz * Zh;
      Uencl = (Ukz * Rn) / (Rn + R0);
      caption = 'КЗ на корпус при повторном заземлении нулевого провода (12.4)';
      break;
    }
    case 'break_after_fault':
      Uencl = U;
      caption = 'Обрыв нуля за нагрузкой: корпус за местом обрыва (12.5)';
      break;
    case 'break_before_ok':
      Uencl = 0;
      caption = 'Обрыв нуля: корпус до места обрыва (12.6, U_2 = 0)';
      break;
    case 'break_after_repeat':
      Uencl = (U * Rn) / (R0 + Rn);
      caption = 'Обрыв нуля + R_n: корпус за обрывом (12.7)';
      break;
    case 'break_before_repeat':
      Uencl = (U * R0) / (R0 + Rn);
      caption = 'Обрыв нуля + R_n: корпус до обрыва (12.8)';
      break;
    case 'phase_to_soil':
      Uencl = (U * R0) / (Rzm + R0);
      caption = 'Фаза на землю: напряжение на занулённом оборудовании (12.13)';
      break;
  }

  const IbodyMA = (Uencl / Rh) * 1000;
  return { IkzA: Ikz, UenclosureV: Uencl, IbodyMA, caption };
}

/* ─── Lab 12: Earthing electrode (12.14–12.15) ─── */

export interface Lesson12ElectrodeParams {
  rhoOhmM: number;
  lM: number;
  dM: number;
  tM: number;
}

/** (12.14) — сопротивление одиночного вертикального заземлителя, Ом. */
export function lesson12SingleElectrodeResistanceOhm(p: Lesson12ElectrodeParams): number {
  const rho = Math.max(1e-6, p.rhoOhmM);
  const l = Math.max(1e-6, p.lM);
  const d = Math.max(1e-6, p.dM);
  const t = Math.max(1e-6, p.tM);
  // Требование вида формулы: 4t > l. Если нарушено — мягко поджимаем.
  const tEff = Math.max(t, l / 4 + 1e-6);
  const term1 = Math.log10((2 * l) / d);
  const ratio = (4 * tEff + l) / (4 * tEff - l);
  const term2 = 0.5 * Math.log10(Math.max(1 + 1e-12, ratio));
  const R = 0.366 * (rho / l) * (term1 + term2);
  return Number.isFinite(R) ? R : NaN;
}

/** (12.15) — число электродов при ηз и требуемом Rз. */
export function lesson12ElectrodeCount(p: { RsingleOhm: number; etaZ: number; RtargetOhm: number }): number {
  const R1 = Math.max(1e-6, p.RsingleOhm);
  const eta = Math.max(1e-6, Math.min(1, p.etaZ));
  const Rt = Math.max(1e-6, p.RtargetOhm);
  return R1 / (eta * Rt);
}
