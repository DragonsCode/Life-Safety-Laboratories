/** Занятие 13: ЛВЖ, концентрация, испарение, ΔP (формулы 13.1–13.6 методички). */

export const LESSON13_P0_KPA = 101;
export const LESSON13_Z_LFJ = 0.3;

export function lesson13AtomCounts(lvjName: string): { nC: number; nH: number; nO: number } {
  const s = lvjName.trim();
  if (s === 'Ацетон') return { nC: 3, nH: 6, nO: 1 };
  if (s === 'Бензол') return { nC: 6, nH: 6, nO: 0 };
  if (s === 'Этанол') return { nC: 2, nH: 6, nO: 1 };
  return { nC: 2, nH: 6, nO: 1 };
}

/** (13.6) стехиометрическая концентрация, % */
export function lesson13StoichConcentrationPct(nC: number, nH: number, nO: number): number {
  return 100 / (1 + 4.48 * (nC + nH / 4 + nO / 2));
}

/**
 * (13.2) объём паров, м³; G — «масса паров на единицу объёма помещения» кг/м³ по табл. 13.2,
 * итоговая масса паров mₐ = G·V, V_п = mₐ/ρ_п.
 */
export function lesson13VaporVolumeM3(G_kgm3: number, V_room_m3: number, rhoVapor_kgm3: number): number {
  const rho = Math.max(1e-9, rhoVapor_kgm3);
  return (G_kgm3 * Math.max(1e-9, V_room_m3)) / rho;
}

/** (13.1) концентрация паров в воздухе помещения, % */
export function lesson13ConcentrationPct(V_room_m3: number, vaporVolume_m3: number): number {
  const V = Math.max(1e-9, V_room_m3);
  return (Math.max(0, vaporVolume_m3) / V) * 100;
}

/** (13.5) интенсивность испарения, кг/(м²·с); P_H — кПа, M — кг/кмоль */
export function lesson13EvaporationIntensity(eta: number, PH_kPa: number, M_kgPerKmol: number): number {
  return 1e-6 * eta * PH_kPa * Math.sqrt(Math.max(1e-9, M_kgPerKmol));
}

/** (13.4) масса паров за время t с, кг */
export function lesson13VaporMass_kg(W_kg_m2_s: number, area_m2: number, t_s: number): number {
  return W_kg_m2_s * Math.max(0, area_m2) * Math.max(0, t_s);
}

/** (13.3) избыточное давление взрыва, кПа */
export function lesson13ExplosionOverpressure_kPa(input: {
  Pmax_kPa: number;
  P0_kPa: number;
  m_kg: number;
  Z: number;
  Vsv_m3: number;
  rhoVapor_kgm3: number;
  Kn: number;
  Cst_pct: number;
}): number {
  const {
    Pmax_kPa,
    P0_kPa,
    m_kg,
    Z,
    Vsv_m3,
    rhoVapor_kgm3,
    Kn,
    Cst_pct,
  } = input;
  const den =
    Math.max(1e-9, Vsv_m3)
    * Math.max(1e-9, rhoVapor_kgm3)
    * Math.max(1e-9, Kn)
    * Math.max(1e-9, Cst_pct);
  return (Pmax_kPa - P0_kPa) * ((m_kg * Z * 100) / den);
}

export type Lesson13FireLabMetrics = {
  C_pct: number;
  Cst_pct: number;
  Cnkr_pct: number;
  W_kg_m2_s: number;
  m_kg: number;
  deltaP_kPa: number;
  aboveNkp: boolean;
  /** кат. А: ΔP > 5 кПа по определению из теории занятия */
  roomCategoryAExplosive: boolean;
};

export function lesson13FireLabMetrics(input: {
  lvjName: string;
  eta: number;
  V_m3: number;
  G_kgm3: number;
  Vsv_m3: number;
  SA_m2: number;
  KH: number;
  t_evap_h: number;
  rhoP: number;
  Cnkr: number;
  Pmax: number;
  PH: number;
  M: number;
}): Lesson13FireLabMetrics {
  const atoms = lesson13AtomCounts(input.lvjName);
  const Cst = lesson13StoichConcentrationPct(atoms.nC, atoms.nH, atoms.nO);
  const Vp = lesson13VaporVolumeM3(input.G_kgm3, input.V_m3, input.rhoP);
  const C = lesson13ConcentrationPct(input.V_m3, Vp);
  const W = lesson13EvaporationIntensity(input.eta, input.PH, input.M);
  const tS = Math.max(0, input.t_evap_h) * 3600;
  const m = lesson13VaporMass_kg(W, input.SA_m2, tS);
  const deltaP = lesson13ExplosionOverpressure_kPa({
    Pmax_kPa: input.Pmax,
    P0_kPa: LESSON13_P0_KPA,
    m_kg: m,
    Z: LESSON13_Z_LFJ,
    Vsv_m3: input.Vsv_m3,
    rhoVapor_kgm3: input.rhoP,
    Kn: input.KH,
    Cst_pct: Cst,
  });
  const aboveNkp = C >= input.Cnkr;
  const roomCategoryAExplosive = deltaP > 5;
  return {
    C_pct: C,
    Cst_pct: Cst,
    Cnkr_pct: input.Cnkr,
    W_kg_m2_s: W,
    m_kg: m,
    deltaP_kPa: deltaP,
    aboveNkp,
    roomCategoryAExplosive,
  };
}
