/**
 * Lab 7 — Расчёт напряжённости поля ВЧ-диапазона
 * Shuleikin–Van-der-Pol formula, attenuation factor F, x parameter.
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

/**
 * Условие волновой зоны (формула 7.1)
 * d > 2·L²/λ  (L — максимальный размер антенны)
 */
export function isWaveZone(distanceM: number, antennaSizeM: number, wavelengthM: number): boolean {
  assertFinitePositive(distanceM, 'distanceM');
  assertFinitePositive(wavelengthM, 'wavelengthM');
  assertFiniteNonNegative(antennaSizeM, 'antennaSizeM');
  return distanceM > (2 * antennaSizeM * antennaSizeM) / wavelengthM;
}

/**
 * Условие параметра (7.4)
 * 60λ ≫ 0  (как в методичке/ТЗ; формально всегда выполняется при λ>0)
 */
export function isParameterConditionTrue(wavelengthM: number): boolean {
  assertFinitePositive(wavelengthM, 'wavelengthM');
  return 60 * wavelengthM > 0;
}

/**
 * x (вариант 1). (формула 7.5)
 * x = (π · d) / (600 · λ² · δ)
 */
export function xParameterVariant1(
  distanceM: number,
  wavelengthM: number,
  delta: number,
): number {
  assertFinitePositive(distanceM, 'distanceM');
  assertFinitePositive(wavelengthM, 'wavelengthM');
  assertFinitePositive(delta, 'delta');
  return (Math.PI * distanceM) / (600 * wavelengthM * wavelengthM * delta);
}

/**
 * x (полная формула). (формула 7.6)
 * x = (π · d) / (λ · √(θ² + (60 · λ · δ)²))
 */
export function xParameterFull(
  distanceM: number,
  wavelengthM: number,
  theta: number,
  delta: number,
): number {
  assertFinitePositive(distanceM, 'distanceM');
  assertFinitePositive(wavelengthM, 'wavelengthM');
  assertFinitePositive(theta, 'theta');
  assertFinitePositive(delta, 'delta');
  const denom = wavelengthM * Math.sqrt(theta * theta + Math.pow(60 * wavelengthM * delta, 2));
  return (Math.PI * distanceM) / denom;
}

/**
 * Множитель ослабления F(x). (формула 7.3)
 * F = 1.41 · (2 + 0.3·x) / (2 + x + 0.6·x²)
 * Approximation valid for x > 0.
 */
export function attenuationFactorF(x: number): number {
  assertFiniteNonNegative(x, 'x');
  const base = x === 0 ? 1 : (2 + 0.3 * x) / (2 + x + 0.6 * x * x);
  return 1.41 * base;
}

/**
 * Напряжённость поля по Шулейкину–Ван-дер-Полю, В/м. (формула 7.2)
 * E = 7.750 · √(P · Ga) · F / d
 * P in кВт
 */
export function fieldStrengthShuleikin(
  powerKW: number,
  gainAntenna: number,
  distanceM: number,
  fFactor: number,
): number {
  assertFinitePositive(powerKW, 'powerKW');
  assertFinitePositive(gainAntenna, 'gainAntenna');
  assertFinitePositive(distanceM, 'distanceM');
  assertFiniteNonNegative(fFactor, 'fFactor');
  return (7.75 * Math.sqrt(powerKW * gainAntenna) * fFactor) / distanceM;
}

/**
 * Определяет диапазон волн по длине волны.
 */
export type WaveBand = 'DV' | 'SV' | 'KV' | 'UKV' | 'SVCh';

export function classifyWaveBand(wavelengthM: number): WaveBand {
  assertFinitePositive(wavelengthM, 'wavelengthM');
  if (wavelengthM >= 1000) return 'DV';
  if (wavelengthM >= 100) return 'SV';
  if (wavelengthM >= 10) return 'KV';
  if (wavelengthM >= 1) return 'UKV';
  return 'SVCh';
}

/**
 * Полный расчёт x в зависимости от диапазона.
 */
export function xParameter(
  distanceM: number,
  wavelengthM: number,
  theta: number,
  delta: number,
): number {
  // By request: expose both formulas; default to "full" one as it includes θ.
  return xParameterFull(distanceM, wavelengthM, theta, delta);
}

/* ─────────────────────────────
 * Legacy exports (backward compatibility)
 * ───────────────────────────── */

export function xParameterDVSV(distanceM: number, wavelengthM: number, theta: number, sigma: number): number {
  // Previously used a different equation; keep compatibility by routing to full form.
  return xParameterFull(distanceM, wavelengthM, theta, sigma);
}

export function xParameterKV(distanceM: number, wavelengthM: number, theta: number, sigma: number): number {
  // Previously used a different equation; keep compatibility by routing to full form.
  return xParameterFull(distanceM, wavelengthM, theta, sigma);
}
