/**
 * Lab 8 — Расчёт напряжённости поля УВЧ-диапазона
 * TV centre / retranslator UHF field strength.
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
 * Расстояние R от фазового центра антенны. (формула 8.6)
 * R = √(H² + r²)
 */
export function distanceFromPhaseCenter(heightM: number, groundDistanceM: number): number {
  assertFiniteNonNegative(heightM, 'heightM');
  assertFiniteNonNegative(groundDistanceM, 'groundDistanceM');
  return Math.sqrt(heightM * heightM + groundDistanceM * groundDistanceM);
}

/**
 * Угол Δ от горизонта к заданной точке, рад.
 * Δ = arctan(H / r)
 */
export function elevationAngleRad(heightM: number, groundDistanceM: number): number {
  assertFinitePositive(heightM, 'heightM');
  assertFinitePositive(groundDistanceM, 'groundDistanceM');
  return Math.atan(heightM / groundDistanceM);
}

/**
 * F(Δ) — нормированный множитель диаграммы направленности.
 * Упрощённая аппроксимация: F(Δ) ≈ cos(Δ) для типовой антенны.
 */
export function normalizedPatternFactor(deltaRad: number): number {
  return Math.cos(deltaRad);
}

/**
 * F(Δ) — множитель ослабления поля. (формула 8.5 из ТЗ пользователя)
 * F(Δ) = 1.41 · (2 + 0.3r) / (2 + r + 0.6r²)
 *
 * В формуле используется r (как дано в ТЗ). Здесь r — горизонтальная дальность до точки, м.
 */
export function normalizedPatternFactorFromR(groundDistanceM: number): number {
  assertFiniteNonNegative(groundDistanceM, 'groundDistanceM');
  const r = groundDistanceM;
  return 1.41 * (2 + 0.3 * r) / (2 + r + 0.6 * r * r);
}

/**
 * Напряжённость поля УВЧ, В/м. (формула 8.4)
 * E = K · √(P·G) · F(Δ) / R
 * где K = 7.746 (= √60) для формулы E = √(30PG)/R с K-корректором
 * По методичке: K учитывает неравномерность горизонтальной ДН = 1.41
 */
export function fieldStrengthUHF(
  powerW: number,
  gain: number,
  distanceR: number,
  fDelta: number,
  kHorizontal = 1.41,
): number {
  assertFinitePositive(powerW, 'powerW');
  assertFinitePositive(gain, 'gain');
  assertFinitePositive(distanceR, 'distanceR');
  assertFiniteNonNegative(fDelta, 'fDelta');
  return (kHorizontal * Math.sqrt(30 * powerW * gain) * fDelta) / distanceR;
}

/**
 * Суммарная напряжённость поля от нескольких передатчиков. (формула 8.7)
 * E_sum = √(E₁² + E₂² + ... + Eₙ²)
 */
export function totalFieldStrength(fields: number[]): number {
  const sumSq = fields.reduce((acc, e) => acc + e * e, 0);
  return Math.sqrt(sumSq);
}

/**
 * Верхняя граница ползунка f (МГц) в теории «ПДУ от частоты».
 * Линейный слайдер 0.03…30e3 сжимает низ диапазона на лог-оси; здесь 0.03…1000 — плавнее и покрывает все ступени ПДУ (до 300 МГц).
 */
export const RADIATION_DOSE_FREQ_SLIDER_MAX_MHZ = 1000;

/**
 * ПДУ (предельно допустимый уровень) для частоты, В/м.
 * По таблицам для УВЧ-диапазона.
 */
export function pduForFrequencyVpm(frequencyMHz: number): number {
  assertFinitePositive(frequencyMHz, 'frequencyMHz');
  if (frequencyMHz < 3) return 50;
  if (frequencyMHz < 30) return 20;
  if (frequencyMHz < 50) return 10;
  if (frequencyMHz < 300) return 5;
  // > 300 MHz → ППЭ norms apply
  return 5;
}
