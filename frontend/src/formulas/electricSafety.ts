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
