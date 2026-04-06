import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { LabVariant } from '../../types/theme';

/* ── Human-readable labels for every variant key ── */
const LABELS: Record<string, [string, string]> = {
  /* label, unit */
  // Lesson 1
  intensityCd:      ['Сила света (I)',      'кд'],
  solidAngleSr:     ['Телесный угол (ω)',   'ср'],
  workAreaM2:       ['Площадь раб. зоны',   'м²'],
  eMaxLux:          ['Emax',                'лк'],
  eMinLux:          ['Emin',                'лк'],
  eAvgLux:          ['Ecp',                 'лк'],
  // Lesson 2
  lengthM:          ['Длина помещения (L)',  'м'],
  widthM:           ['Ширина помещения (B)', 'м'],
  heightM:          ['Высота помещения (H)',  'м'],
  lampFluxLm:       ['Поток лампы (Φл)',     'лм'],
  eNormLux:         ['Норма освещённости (Eн)', 'лк'],
  reserveFactor:    ['Коэф. запаса (Kз)',    ''],
  nonUniformity:    ['Коэф. неравн. (z)',    ''],
  lampsPerLuminaire:['Ламп в светильнике (n)', 'шт'],
  lampPowerW:       ['Мощность лампы (Pл)',  'Вт'],
  // Lesson 2 — Table 2.2 keys (penultimate digit)
  tabWt:            ['Удельная мощность (Wт)', 'Вт/м²'],
  roomAreaM2:       ['Площадь помещения (Sп)', 'м²'],
  etaPct:           ['КПД установки (η)',      '%'],
  mu:               ['Коэффициент μ',          ''],
  // Lesson 3 / 4 — noise
  sourceA1mDb:      ['Источник A — L₁',     'дБ'],
  sourceB1mDb:      ['Источник B — L₁',     'дБ'],
  sourceC1mDb:      ['Источник C — L₁',     'дБ'],
  distanceA:        ['Расстояние R (A)',     'м'],
  distanceB:        ['Расстояние R (B)',     'м'],
  distanceC:        ['Расстояние R (C)',     'м'],
  distanceM:        ['Расстояние (R)',       'м'],
  barrierMassA:     ['Масса преграды A (G)', 'кг/м²'],
  barrierMassB:     ['Масса преграды B (G)', 'кг/м²'],
  barrierMassC:     ['Масса преграды C (G)', 'кг/м²'],
  barrierIdA:       ['№ преграды A',         ''],
  barrierIdB:       ['№ преграды B',         ''],
  barrierIdC:       ['№ преграды C',         ''],
  // Lesson 5 — EMI
  frequencyHz:      ['f',                    'Гц'],
  electricFieldVpm: ['Электр. поле (E)',     'В/м'],
  magneticFieldApm: ['Магн. поле (H)',       'А/м'],
  sourcePowerW:     ['Мощность источника',   'Вт'],
  sourceGain:       ['Коэф. усиления',      ''],
  reflectance:      ['Коэф. отражения',      ''],
  luminaireCount:   ['Кол-во светильников',  'шт'],
  // Lesson 6 — табл. 6.1 (короткие подписи, чтобы таблица помещалась по ширине)
  W:                ['W',                    'витк.'],
  I:                ['I',                    'мА'],
  f:                ['f',                    'Гц'],
  T:                ['T',                    'ч'],
  D:                ['D',                    'м'],
  R:                ['R',                    'м'],
  r:                ['r',                    'м'],
  // Lesson 6 — табл. 6.2 (отображение)
  l6_mu:            ['μ (относит. проницаемость)', ''],
  l6_muA:           ['μₐ',                   'Гн/м'],
  l6_gamma:         ['γ (удельн. проводимость)', 'См/м'],
  l6_epsilon:       ['ε (диэл. проницаемость)', ''],
  // Lesson 7 — табл. 7.1 / 7.2 (стиль как у табл. 6.1: краткий символ + единица)
  lambda:           ['λ',                    'м'],
  powerKW:          ['P',                    'кВт'],
  Ga:               ['Ga',                   ''],
  theta:            ['θ',                    ''],
  sigma:            ['σ',                    'См/м'],
  d1:               ['d₁',                   'м'],
  d2:               ['d₂',                   'м'],
  d3:               ['d₃',                   'м'],
  d4:               ['d₄',                   'м'],
  d5:               ['d₅',                   'м'],
  // Lesson 8 — табл. 8.2 / 8.3 (подписи с индексом — в разметке TableCell)
  pImageKW:         ['', 'кВт'],
  pSoundKW:         ['', 'кВт'],
  fRangeMHz:        ['f',                    'МГц'],
  G:                ['G',                    ''],
  H:                ['H',                    'м'],
  K:                ['K',                    ''],
  r1:               ['r₁',                   'м'],
  r2:               ['r₂',                   'м'],
  r3:               ['r₃',                   'м'],
  r4:               ['r₄',                   'м'],
  r5:               ['r₅',                   'м'],
  // Lesson 9 — исходные данные (схема замещения тела)
  voltageV:         ['U',                    'В'],
  internalResistanceOhm: ['Rв', 'Ом'],
  skinCapacitanceNF: ['C',                   'нФ'],
  // Lesson 10 — заземление / шаговое напряжение
  faultCurrentA:    ['Iз',                   'А'],
  soilResistivityOhmM: ['ρ',                 'Ом·м'],
  stepLengthM:      ['a',                    'м'],
  // Lesson 11 — сети до 1 кВ (как табл. 6.1: символ + единица; разметка ячейки — Uφ, R_h)
  UphiV:            ['Uφ',                   'В'],
  bodyResistanceOhm: ['R_h',                  'Ом'],
  /* Lesson 12 — таблицы 12.1 / 12.2 */
  soilType:         ['Вид грунта',           ''],
  rhoOhmM:          ['ρ',                    'Ом·м'],
  RnOhm:            ['R_n',                  'Ом'],
  ZnOhm:            ['Z_n',                  'Ом'],
  ZHOhm:            ['Z_H',                  'Ом'],
  RzmOhm:           ['Rзм',                  'Ом'],
  lPipeM:           ['l',                    'м'],
  dPipeM:           ['d',                    'м'],
  tPipeM:           ['t',                    'м'],
  etaZ:             ['η_з',                  ''],
  // Lesson 13 — табл. 13.1 (последняя цифра)
  lvj:              ['ЛВЖ',                  ''],
  eta:              ['η',                    ''],
  areaS_m2:         ['S',                    'м²'],
  t_h:              ['t',                    'ч'],
  Gi_kg:            ['Gᵢ',                   'кг'],
  SA_m2:            ['Sₐ',                   'м²'],
  x:                ['x',                    ''],
  // Lesson 13 — табл. 13.2 (предпоследняя цифра)
  V_m3:             ['V',                    'м³'],
  G_kgm3:           ['G',                    'кг/м³'],
  Vsv_m3:           ['Vсв',                  'м³'],
  KH:               ['Kн',                   ''],
  Mlvj_kg:          ['Mлвж',                 'кг'],
  y:                ['y',                    ''],
  Szd_m2:           ['Sзд',                  'м²'],
  // Lesson 13 — табл. 13.3 (справочник по ЛВЖ)
  l13_formula:      ['Формула',              ''],
  l13_M:            ['M',                    'г/моль'],
  l13_rho:          ['ρ, ρп',                'кг/м³'],
  l13_Tvsp:         ['Твсп',                 '°C'],
  l13_Pmax:         ['Pmax',                 'кПа'],
  l13_Cnkn:         ['НКПР',                 '%'],
  l13_PH:           ['Pн',                   'кПа'],
};

/** Значение f без «Гц» — единица указана в подписи параметра. */
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function toSuperscriptInt(n: number): string {
  return String(Math.abs(Math.round(n)))
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

function formatFrequencyScientificHz(val: number): string {
  if (val === 0 || !Number.isFinite(val)) return String(val);
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const mantissa = val / 10 ** exp;
  const mStr = Number.isInteger(mantissa)
    ? String(mantissa)
    : mantissa.toFixed(2).replace(/\.?0+$/, '');
  return `${mStr}×10${toSuperscriptInt(exp)}`;
}

function formatValue(key: string, val: number | string): string {
  if (typeof val === 'string') return val;
  if (key === 'l6_muA' || key === 'l6_gamma') {
    if (val === 0 || !Number.isFinite(val)) return String(val);
    const exp = Math.floor(Math.log10(Math.abs(val)));
    const mantissa = val / 10 ** exp;
    const mStr = mantissa.toFixed(2).replace(/\.?0+$/, '');
    return `${mStr}×10${toSuperscriptInt(exp)}`;
  }
  if (key === 'f') {
    return formatFrequencyScientificHz(val);
  }
  if (key === 'frequencyHz') {
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)} ГГц`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)} МГц`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)} кГц`;
    /* Единица «Гц» только в заголовке строки, в ячейках — число (напр. 50). */
    return String(val);
  }
  if (key === 'etaZ') return val.toFixed(2);
  if (key.startsWith('l13_') && key !== 'l13_formula') {
    if (!Number.isFinite(val)) return String(val);
    if (Number.isInteger(val)) return String(val);
    const s = val.toFixed(3).replace(/\.?0+$/, '');
    return s || '0';
  }
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(2);
}

interface Props {
  variants: LabVariant[];
  /** Highlight this variant number */
  activeVariant?: number;
}

/**
 * Renders a properly formatted table of variant values
 * with human-readable parameter names instead of raw JSON.
 */
export default function VariantTable({ variants, activeVariant }: Props) {
  if (variants.length === 0) return null;

  const keys = Object.keys(variants[0].values);
  const n = variants.length;
  /** Узкая колонка параметров — иначе после коротких подписей остаётся огромный зазор до вариантов */
  const paramColPct = 15;
  const variantColPct = (100 - paramColPct) / n;
  const firstColSx = {
    whiteSpace: 'normal' as const,
    wordBreak: 'break-word' as const,
    pr: 0.75,
  };

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        '& .MuiTable-root': { tableLayout: 'fixed', width: '100%' },
      }}
    >
      <Table size="small" sx={{ minWidth: 0 }}>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 700,
                width: `${paramColPct}%`,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                ...firstColSx,
              }}
            >
              Параметр
            </TableCell>
            {variants.map((v) => (
              <TableCell
                key={`hdr-${v.variant}-${v.displayLabel ?? ''}`}
                align="center"
                sx={{
                  fontWeight: 700,
                  width: `${variantColPct}%`,
                  minWidth: 0,
                  pl: 0.5,
                  bgcolor: v.variant === activeVariant ? 'primary.light' : 'primary.main',
                  color: 'primary.contrastText',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={v.displayLabel}
              >
                {v.displayLabel ?? (v.variant === 0 ? '0' : v.variant)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((key) => {
            const [label, unit] = LABELS[key] ?? [key, ''];
            const unitSuffix = unit ? `\u00a0(${unit})` : '';
            return (
              <TableRow key={key} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    width: `${paramColPct}%`,
                    ...firstColSx,
                  }}
                >
                  {key === 'pImageKW' ? (
                    <>
                      P<sub style={{ fontSize: '0.72em' }}>изобр</sub>
                      {unitSuffix}
                    </>
                  ) : key === 'pSoundKW' ? (
                    <>
                      P<sub style={{ fontSize: '0.72em' }}>звук</sub>
                      {unitSuffix}
                    </>
                  ) : key === 'UphiV' ? (
                    <>
                      U<sub style={{ fontSize: '0.72em' }}>φ</sub>
                      {unitSuffix}
                    </>
                  ) : key === 'bodyResistanceOhm' ? (
                    <>
                      R<sub style={{ fontSize: '0.72em' }}>h</sub>
                      {unitSuffix}
                    </>
                  ) : (
                    <>
                      {label}
                      {unitSuffix}
                    </>
                  )}
                </TableCell>
                {variants.map((v) => {
                  const text = formatValue(key, v.values[key]);
                  const active = v.variant === activeVariant;
                  return (
                    <TableCell
                      key={`${key}-${v.variant}`}
                      align="center"
                      title={text}
                      sx={{
                        minWidth: 0,
                        maxWidth: 0,
                        pl: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        bgcolor: active ? 'action.selected' : undefined,
                        fontWeight: active ? 700 : 400,
                        color: active ? 'primary.dark' : 'text.primary',
                      }}
                    >
                      {text}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
