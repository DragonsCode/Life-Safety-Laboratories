/**
 * Lab 6 — Расчёт параметров устройств защиты от ЭМИ
 * Shield thickness, waveguide attenuation, field strength calculations.
 */

const MU_0 = 4 * Math.PI * 1e-7; // Гн/м, магнитная постоянная

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
 * Абсолютная магнитная проницаемость, Гн/м.
 * μa = μ0 · μ (формула 6.9)
 */
export function absolutePermeability(relativePermeability: number): number {
  assertFinitePositive(relativePermeability, 'relativePermeability');
  return MU_0 * relativePermeability;
}

/**
 * Напряжённость магнитного поля катушки H, А/м.
 * H = (w · I · r² · βm) / (4 · R³)  (формула 6.1)
 */
export function magneticFieldStrengthH(
  turns: number,
  currentA: number,
  distanceM: number,
  coilRadiusM: number,
  betaM = 1,
): number {
  assertFinitePositive(turns, 'turns');
  assertFinitePositive(currentA, 'currentA');
  assertFinitePositive(distanceM, 'distanceM');
  assertFinitePositive(coilRadiusM, 'coilRadiusM');
  assertFinitePositive(betaM, 'betaM');
  return (turns * currentA * coilRadiusM * coilRadiusM * betaM) / (4 * Math.pow(distanceM, 3));
}

/**
 * Напряжённость электрического поля E, В/м.
 * E = H · 377  (плоская волна в дальней зоне, формула 6.2)
 */
export function electricFieldFromH(hApm: number): number {
  assertFiniteNonNegative(hApm, 'hApm');
  return hApm * 377;
}

/**
 * Длина волны λ, м. (формула 6.3)
 * λ = c / f
 */
export function wavelength(frequencyHz: number): number {
  assertFinitePositive(frequencyHz, 'frequencyHz');
  return 299_792_458 / frequencyHz;
}

/**
 * Плотность потока энергии ППЭδ, Вт/м². (формула 6.4)
 * ППЭδ = 377 · H² / 2
 */
export function powerFluxDensityFromH(hApm: number): number {
  assertFiniteNonNegative(hApm, 'hApm');
  return (377 * hApm * hApm) / 2;
}

/**
 * Допустимая ППЭδ, Вт/м². (формула 6.5)
 * ППЭδ_доп = N / T, где N = 2 Вт·ч/м²
 */
export function allowablePPE(exposureTimeH: number, energyLoadWhrM2 = 2): number {
  assertFinitePositive(exposureTimeH, 'exposureTimeH');
  return energyLoadWhrM2 / exposureTimeH;
}

/**
 * Коэффициент ослабления L (безразмерный). (формула 6.6)
 * L = ППЭδ / ППЭδ_доп
 */
export function attenuationRatioL(ppeActual: number, ppeAllowable: number): number {
  assertFinitePositive(ppeActual, 'ppeActual');
  assertFinitePositive(ppeAllowable, 'ppeAllowable');
  return ppeActual / ppeAllowable;
}

/**
 * Циклическая (угловая) частота ω, 1/с. (формула 6.8)
 * ω = 2πf
 */
export function angularFrequencyOmega(frequencyHz: number): number {
  assertFinitePositive(frequencyHz, 'frequencyHz');
  return 2 * Math.PI * frequencyHz;
}

/**
 * Толщина экрана M, м. (формула 6.7)
 * M = ln(L) / (2 · √(ω · μa · γ / 2))
 */
export function shieldThicknessM(attenuationRatioL: number, omega: number, muAbsoluteHpm: number, conductivitySpm: number): number {
  assertFinitePositive(attenuationRatioL, 'attenuationRatioL');
  assertFinitePositive(omega, 'omega');
  assertFinitePositive(muAbsoluteHpm, 'muAbsoluteHpm');
  assertFinitePositive(conductivitySpm, 'conductivitySpm');
  const denom = 2 * Math.sqrt((omega * muAbsoluteHpm * conductivitySpm) / 2);
  return Math.log(Math.max(1, attenuationRatioL)) / Math.max(1e-12, denom);
}

/**
 * Коэффициент затухания волноводной трубки α, дБ/м. (формула 6.10)
 * α = 32 / (D · √ε)
 */
export function waveguideAttenuationPerM(diameterM: number, epsilon: number): number {
  assertFinitePositive(diameterM, 'diameterM');
  assertFinitePositive(epsilon, 'epsilon');
  return 32 / (diameterM * Math.sqrt(epsilon));
}

/**
 * Требуемая длина трубки-волновода, м. (формула 6.11)
 * l = (10 · lg(L)) / α
 */
export function waveguideLengthM(attenuationRatioL: number, attenuationDbPerM: number): number {
  assertFinitePositive(attenuationRatioL, 'attenuationRatioL');
  assertFinitePositive(attenuationDbPerM, 'attenuationDbPerM');
  return (10 * Math.log10(Math.max(1, attenuationRatioL))) / attenuationDbPerM;
}

/* ─────────────────────────────
 * Legacy exports (backward compatibility)
 * Used by some UI demos and older lessons.
 * ───────────────────────────── */

/**
 * Legacy: ППЭ = E · H (старый вариант 6.4)
 */
export function powerFluxDensity(eVpm: number, hApm: number): number {
  assertFiniteNonNegative(eVpm, 'eVpm');
  assertFiniteNonNegative(hApm, 'hApm');
  return eVpm * hApm;
}

/**
 * Legacy: L (дБ) = 10·lg(ППЭ/ППЭ_доп)
 */
export function requiredAttenuationDb(ppeActual: number, ppeAllowable: number): number {
  assertFinitePositive(ppeActual, 'ppeActual');
  assertFinitePositive(ppeAllowable, 'ppeAllowable');
  return 10 * Math.log10(ppeActual / ppeAllowable);
}

/**
 * Legacy: α = √(π · f · μa · γ) (старый вариант 6.8)
 */
export function attenuationCoefficient(
  frequencyHz: number,
  muAbsoluteHpm: number,
  conductivitySpm: number,
): number {
  assertFinitePositive(frequencyHz, 'frequencyHz');
  assertFinitePositive(muAbsoluteHpm, 'muAbsoluteHpm');
  assertFinitePositive(conductivitySpm, 'conductivitySpm');
  return Math.sqrt(Math.PI * frequencyHz * muAbsoluteHpm * conductivitySpm);
}
