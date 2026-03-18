import { Suspense, lazy, useMemo, useState } from 'react';
import { Box, LinearProgress, Paper, Slider, Stack, Typography } from '@mui/material';
import type { TheorySimulatorType } from '../../types/theme';

const sceneTitle: Record<string, string> = {
  'light-flux': 'Распространение светового потока от источника',
  'light-illuminance': 'Как освещённость зависит от площади поверхности',
  'light-brightness': 'Яркость и слепящее действие источника',
  'light-pulsation': 'Пульсация света и стробоскопический эффект',
  'light-room-index': 'Индекс помещения — зависимость от размеров',
  'light-specific-power': 'Расположение светильников в помещении',
  'light-multi-source': 'Управление отдельными светильниками в помещении',
  'noise-distance': 'Ослабление шума с расстоянием от источника',
  'noise-barrier': 'Звукоизоляция: отражение звука преградой',
  'noise-sum': 'Суммирование шума от нескольких источников',
  'noise-reflection': 'Отражение звуковых волн от стены',
  'emi-spectrum': 'Длина электромагнитной волны и частота',
  'emi-wave': 'Плотность потока энергии (ППЭ) электромагнитного поля',
  'emi-ppe-zones': 'Зоны вокруг источника ЭМИ (ближняя / промежуточная / дальняя)',
  'emi-shield-thickness': 'Экранирование: толщина поглощающего слоя',
  'emi-waveguide': 'Затухание ЭМИ в волноводе',
  'emi-field-attenuation': 'Ослабление поля экраном (дБ)',
  'hf-field-strength': 'Напряжённость ВЧ-поля по Шулейкину',
  'hf-wave-propagation': 'Распространение радиоволн вдоль земли',
  'hf-soil-attenuation': 'Влияние проводимости почвы на затухание',
  'uhf-field-strength': 'Поле УВЧ-передатчика телецентра',
  'uhf-antenna-pattern': 'Диаграмма направленности антенны',
  'radiation-dose': 'ПДУ облучения — зависимость от частоты',
  'electric-current-body': 'Путь тока через тело человека',
  'electric-resistance': 'Эквивалентная схема сопротивления тела',
  'electric-frequency-effect': 'Влияние частоты на импеданс тела',
  'ground-current-spread': 'Растекание тока в грунте от заземлителя',
  'step-voltage': 'Шаговое напряжение между точками грунта',
  'equipotential-zones': 'Эквипотенциальные линии вокруг заземлителя',
};
import {
  brightness,
  illuminanceFromFlux,
  luminairesBySpecificPower,
  luminairesByUtilization,
  luminousFlux,
  pulsationCoefficientPercent,
  roomIndex,
  suspensionHeight,
} from '../../formulas/illumination';
import {
  barrierReductionDbFromMass,
  levelAfterBarrierDb,
  levelAtDistanceDb,
  sumLevelsEnergyDb,
  sumTwoLevelsByDeltaDb,
} from '../../formulas/noise';
import { classifyEmZone, powerFluxDensityWm2, wavelengthM } from '../../formulas/emi';
import {
  attenuationCoefficient,
  attenuationRatioL,
  shieldThicknessM,
  waveguideAttenuationPerM,
  waveguideLengthM,
} from '../../formulas/shielding';
import { fieldStrengthShuleikin, attenuationFactorF, xParameter } from '../../formulas/hfField';
import { fieldStrengthUHF, normalizedPatternFactor, distanceFromPhaseCenter } from '../../formulas/uhfField';
import {
  bodyCurrentMA,
  totalBodyImpedance,
  skinImpedance,
  classifyCurrentDanger,
  currentDensity,
  groundPotential,
  stepVoltage,
} from '../../formulas/electricSafety';
const TheoryScene3D = lazy(() => import('./TheoryScene3D'));
const isTestEnvironment = import.meta.env.MODE === 'test';

interface SimulatorProps {
  type: TheorySimulatorType;
}

function ValueLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}

/* Default slider values per scene type */
function getDefaults(type: TheorySimulatorType) {
  switch (type) {
    case 'light-multi-source':
      return { a: 80, b: 80, c: 80, d: 80 };
    default:
      return { a: 500, b: 1.2, c: 2.5, d: 120 };
  }
}

export default function MiniSimulator({ type }: SimulatorProps) {
  const defs = getDefaults(type);
  const [a, setA] = useState(defs.a);
  const [b, setB] = useState(defs.b);
  const [c, setC] = useState(defs.c);
  const [d, setD] = useState(defs.d);
  // Extra params for multi-light scene (directions 0-100%)
  const [e, setE] = useState(80);
  const [f, setF] = useState(80);
  const [g, setG] = useState(80);
  const [h, setH] = useState(80);

  const sceneParams = useMemo(() => ({ a, b, c, d, e, f, g, h }), [a, b, c, d, e, f, g, h]);

  const content = useMemo(() => {
    switch (type) {
      case 'light-flux': {
        const flux = luminousFlux(a, b);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">I (кд): {a.toFixed(0)}</Typography>
              <Slider value={a} min={100} max={2000} step={10} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">ω (ср): {b.toFixed(2)}</Typography>
              <Slider value={b} min={0.1} max={6.2} step={0.1} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [<ValueLine key="v1" label="Φ = I·ω" value={`${flux.toFixed(1)} лм`} />],
        };
      }
      case 'light-illuminance': {
        const illuminance = illuminanceFromFlux(a, Math.max(0.1, b));
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Φ (лм): {a.toFixed(0)}</Typography>
              <Slider value={a} min={100} max={5000} step={50} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">S (м²): {b.toFixed(2)}</Typography>
              <Slider value={b} min={0.2} max={12} step={0.1} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [<ValueLine key="v1" label="E = Φ/S" value={`${illuminance.toFixed(1)} лк`} />],
        };
      }
      case 'light-brightness': {
        const luminance = brightness(a, Math.max(0.1, b));
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">I (кд): {a.toFixed(0)}</Typography>
              <Slider value={a} min={50} max={1600} step={10} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">S (м²): {b.toFixed(2)}</Typography>
              <Slider value={b} min={0.1} max={4} step={0.05} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [<ValueLine key="v1" label="B = I/S" value={`${luminance.toFixed(1)} кд/м²`} />],
        };
      }
      case 'light-pulsation': {
        const maxValue = Math.max(a, b);
        const minValue = Math.min(a, b);
        const avg = Math.max(1, c);
        const kp = pulsationCoefficientPercent(maxValue, minValue, avg);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Emax (лк): {a.toFixed(0)}</Typography>
              <Slider value={a} min={100} max={1500} step={10} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">Emin (лк): {b.toFixed(0)}</Typography>
              <Slider value={b} min={50} max={1400} step={10} onChange={(_, value) => setB(value as number)} />
              <Typography variant="caption">Eср (лк): {avg.toFixed(0)}</Typography>
              <Slider value={avg} min={80} max={1450} step={10} onChange={(_, value) => setC(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Kп" value={`${kp.toFixed(2)} %`} />,
            <ValueLine key="v2" label="Оценка" value={kp <= 10 ? 'низкая пульсация' : 'повышенная пульсация'} />,
          ],
        };
      }
      case 'light-room-index': {
        const hp = suspensionHeight(Math.max(0.5, c));
        const index = roomIndex(Math.max(1, a / 50), Math.max(1, b), hp);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">L (м): {(a / 50).toFixed(1)}</Typography>
              <Slider value={a} min={150} max={1500} step={10} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">B (м): {b.toFixed(1)}</Typography>
              <Slider value={b} min={3} max={20} step={0.5} onChange={(_, value) => setB(value as number)} />
              <Typography variant="caption">H (м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={2.5} max={8} step={0.1} onChange={(_, value) => setC(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Hp = H - 0.3" value={`${hp.toFixed(2)} м`} />,
            <ValueLine key="v2" label="i" value={index.toFixed(3)} />,
          ],
        };
      }
      case 'light-specific-power': {
        const area = Math.max(10, a);
        const width = Math.max(3, b);
        const lampPower = Math.max(20, c * 20);
        const countByPower = luminairesBySpecificPower({
          areaM2: area,
          widthM: width,
          lampPowerW: lampPower,
          lampsPerLuminaire: Math.max(1, Math.round(d / 40)),
        });
        const countByEta = luminairesByUtilization({
          areaM2: area,
          eNormLux: 300,
          reserveFactor: 1.5,
          nonUniformityFactor: 1.1,
          lampsPerLuminaire: Math.max(1, Math.round(d / 40)),
          lampFluxLm: 3200,
          utilizationFactor: 0.5,
        });
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">S (м²): {area.toFixed(0)}</Typography>
              <Slider value={area} min={10} max={300} step={5} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">B (м): {width.toFixed(1)}</Typography>
              <Slider value={width} min={3} max={20} step={0.5} onChange={(_, value) => setB(value as number)} />
              <Typography variant="caption">P лампы (Вт): {lampPower.toFixed(0)}</Typography>
              <Slider value={c} min={1} max={10} step={0.5} onChange={(_, value) => setC(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="N (удельная мощность)" value={`${countByPower}`} />,
            <ValueLine key="v2" label="N (η-метод, демо)" value={`${countByEta}`} />,
          ],
        };
      }
      case 'light-multi-source': {
        const lights = [
          { name: 'Светильник 1', int: a, setInt: setA, dir: e, setDir: setE, color: '#ff6644' },
          { name: 'Светильник 2', int: b, setInt: setB, dir: f, setDir: setF, color: '#44aaff' },
          { name: 'Светильник 3', int: c, setInt: setC, dir: g, setDir: setG, color: '#44cc44' },
          { name: 'Светильник 4', int: d, setInt: setD, dir: h, setDir: setH, color: '#ffaa00' },
        ];
        return {
          controls: (
            <Stack spacing={1.2}>
              {lights.map((l, i) => (
                <Box key={i}>
                  <Typography variant="caption" sx={{ color: l.color, fontWeight: 600 }}>
                    {l.name}: {l.int > 0 ? `${l.int.toFixed(0)}%` : 'ВЫКЛ'}
                  </Typography>
                  <Slider value={l.int} min={0} max={100} step={5} onChange={(_, v) => l.setInt(v as number)}
                    sx={{ '& .MuiSlider-thumb': { bgcolor: l.color }, '& .MuiSlider-track': { bgcolor: l.color } }} />
                  <Typography variant="caption">Направление на рабочего: {l.dir.toFixed(0)}%</Typography>
                  <Slider value={l.dir} min={0} max={100} step={5} onChange={(_, v) => l.setDir(v as number)}
                    sx={{ '& .MuiSlider-thumb': { bgcolor: l.color }, '& .MuiSlider-track': { bgcolor: l.color } }} />
                </Box>
              ))}
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Вкл. светильников" value={`${[a, b, c, d].filter((v) => v > 0).length} из 4`} />,
          ],
        };
      }
      case 'noise-distance': {
        const level = levelAtDistanceDb(a, Math.max(0.5, b));
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">L1 (дБ): {a.toFixed(0)}</Typography>
              <Slider value={a} min={70} max={130} step={1} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">R (м): {b.toFixed(1)}</Typography>
              <Slider value={b} min={0.5} max={20} step={0.1} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [<ValueLine key="v1" label="LR" value={`${level.toFixed(2)} дБ`} />],
        };
      }
      case 'noise-barrier': {
        const reduction = barrierReductionDbFromMass(Math.max(10, a));
        const output = levelAfterBarrierDb(b, reduction);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">G (кг/м²): {a.toFixed(0)}</Typography>
              <Slider value={a} min={10} max={800} step={5} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">LR до преграды (дБ): {b.toFixed(0)}</Typography>
              <Slider value={b} min={40} max={130} step={1} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="N(lgG)" value={`${reduction.toFixed(2)} дБ`} />,
            <ValueLine key="v2" label="L′R" value={`${output.toFixed(2)} дБ`} />,
          ],
        };
      }
      case 'noise-sum': {
        const l1 = Math.max(30, a);
        const l2 = Math.max(30, b);
        const l3 = Math.max(30, c);
        const deltaPair = sumTwoLevelsByDeltaDb(l1, l2);
        const energyAll = sumLevelsEnergyDb([l1, l2, l3]);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">L1: {l1.toFixed(0)} дБ</Typography>
              <Slider value={l1} min={40} max={120} step={1} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">L2: {l2.toFixed(0)} дБ</Typography>
              <Slider value={l2} min={40} max={120} step={1} onChange={(_, value) => setB(value as number)} />
              <Typography variant="caption">L3: {l3.toFixed(0)} дБ</Typography>
              <Slider value={l3} min={40} max={120} step={1} onChange={(_, value) => setC(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="L1+L2 (LA+ΔL)" value={`${deltaPair.toFixed(2)} дБ`} />,
            <ValueLine key="v2" label="LΣ (энергосумма 3)" value={`${energyAll.toFixed(2)} дБ`} />,
          ],
        };
      }
      case 'emi-spectrum': {
        const frequency = Math.max(1e3, a * 1e3);
        const lambda = wavelengthM(frequency);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">f (кГц): {a.toFixed(0)}</Typography>
              <Slider value={a} min={1} max={3_000_000} step={1000} onChange={(_, value) => setA(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="λ = c/f" value={`${lambda.toExponential(3)} м`} />,
            <ValueLine
              key="v2"
              label="Диапазон"
              value={frequency < 3e7 ? 'Радиоволны' : frequency < 3e11 ? 'Микроволны' : 'ИК/видимый и выше'}
            />,
          ],
        };
      }
      case 'emi-wave': {
        const ppe = powerFluxDensityWm2(a, b);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">E (В/м): {a.toFixed(2)}</Typography>
              <Slider value={a} min={0} max={200} step={0.5} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">H (А/м): {b.toFixed(3)}</Typography>
              <Slider value={b} min={0} max={5} step={0.01} onChange={(_, value) => setB(value as number)} />
            </Stack>
          ),
          values: [<ValueLine key="v1" label="ППЭ = E×H" value={`${ppe.toFixed(3)} Вт/м²`} />],
        };
      }
      case 'emi-ppe-zones': {
        const frequency = Math.max(1e3, a * 1e3);
        const distance = Math.max(0.01, b);
        const lambda = wavelengthM(frequency);
        const zone = classifyEmZone(distance, lambda);
        const ppe = powerFluxDensityWm2(Math.max(0, c), Math.max(0, d / 1000));
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">f (кГц): {a.toFixed(0)}</Typography>
              <Slider value={a} min={10} max={1_000_000} step={1000} onChange={(_, value) => setA(value as number)} />
              <Typography variant="caption">r (м): {distance.toFixed(2)}</Typography>
              <Slider value={distance} min={0.01} max={20} step={0.01} onChange={(_, value) => setB(value as number)} />
              <Typography variant="caption">E (В/м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={0} max={100} step={0.1} onChange={(_, value) => setC(value as number)} />
              <Typography variant="caption">H (мА/м): {d.toFixed(0)}</Typography>
              <Slider value={d} min={0} max={3000} step={10} onChange={(_, value) => setD(value as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="λ" value={`${lambda.toExponential(3)} м`} />,
            <ValueLine key="v2" label="Зона" value={zone === 'near' ? 'Ближняя' : zone === 'intermediate' ? 'Промежуточная' : 'Дальняя'} />,
            <ValueLine key="v3" label="ППЭ" value={`${ppe.toFixed(3)} Вт/м²`} />,
          ],
        };
      }
      case 'emi-shield-thickness': {
        const freq = Math.max(1, a * 1e6);
        const muA = Math.max(1e-6, b * 1e-4);
        const gamma = Math.max(100, c * 1e6);
        const Ldb = Math.max(1, d);
        const alpha = attenuationCoefficient(freq, muA, gamma);
        // Legacy demo: M = L / (8.68 · α)
        const thickness = Ldb / (8.68 * Math.max(1e-12, alpha));
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">f (МГц): {a.toFixed(0)}</Typography>
              <Slider value={a} min={1} max={3000} step={10} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">μa (×10⁻⁴ Гн/м): {b.toFixed(1)}</Typography>
              <Slider value={b} min={1} max={100} step={0.5} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">γ (×10⁶ См/м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={0.1} max={60} step={0.1} onChange={(_, v) => setC(v as number)} />
              <Typography variant="caption">L (дБ): {d.toFixed(0)}</Typography>
              <Slider value={d} min={1} max={100} step={1} onChange={(_, v) => setD(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="α" value={`${alpha.toFixed(2)} 1/м`} />,
            <ValueLine key="v2" label="M (толщина)" value={`${(thickness * 1000).toFixed(3)} мм`} />,
          ],
        };
      }
      case 'emi-waveguide': {
        const diameter = Math.max(0.001, a / 1000);
        const eps = Math.max(1, b);
        const Ldb = Math.max(1, c);
        const A1 = waveguideAttenuationPerM(diameter, eps);
        // Legacy demo: l = L / A1
        const wgLen = Ldb / Math.max(1e-12, A1);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">D (мм): {a.toFixed(1)}</Typography>
              <Slider value={a} min={1} max={50} step={0.5} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">ε: {b.toFixed(1)}</Typography>
              <Slider value={b} min={1} max={20} step={0.5} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">L (дБ): {c.toFixed(0)}</Typography>
              <Slider value={c} min={1} max={100} step={1} onChange={(_, v) => setC(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="A₁" value={`${A1.toFixed(1)} дБ/м`} />,
            <ValueLine key="v2" label="l (длина)" value={`${(wgLen * 1000).toFixed(1)} мм`} />,
          ],
        };
      }
      case 'emi-field-attenuation': {
        const ppe = Math.max(0.01, a);
        const ppeMax = Math.max(0.01, b);
        const L = attenuationRatioL(ppe, ppeMax);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">ППЭ (Вт/м²): {a.toFixed(2)}</Typography>
              <Slider value={a} min={0.01} max={100} step={0.1} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">ППЭ_доп (Вт/м²): {b.toFixed(2)}</Typography>
              <Slider value={b} min={0.01} max={10} step={0.01} onChange={(_, v) => setB(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="L" value={L.toFixed(3)} />,
            <ValueLine key="v2" label="Оценка" value={ppe <= ppeMax ? 'Допустимо' : 'Превышение — нужен экран'} />,
          ],
        };
      }
      case 'hf-field-strength': {
        const lambdaVal = Math.max(10, a);
        const P = Math.max(0.1, b);
        const Ga = Math.max(0.1, c);
        const dist = Math.max(100, d);
        const x = xParameter(lambdaVal, dist, 7, 0.005);
        const F = attenuationFactorF(x);
        const E = fieldStrengthShuleikin(P, Ga, dist, F);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">λ (м): {a.toFixed(0)}</Typography>
              <Slider value={a} min={10} max={3000} step={10} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">P (кВт): {b.toFixed(1)}</Typography>
              <Slider value={b} min={0.1} max={1000} step={1} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">Ga: {c.toFixed(2)}</Typography>
              <Slider value={c} min={0.1} max={10} step={0.1} onChange={(_, v) => setC(v as number)} />
              <Typography variant="caption">d (м): {d.toFixed(0)}</Typography>
              <Slider value={d} min={100} max={50000} step={100} onChange={(_, v) => setD(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="x" value={x.toFixed(4)} />,
            <ValueLine key="v2" label="F" value={F.toFixed(4)} />,
            <ValueLine key="v3" label="E" value={`${E.toFixed(4)} В/м`} />,
          ],
        };
      }
      case 'hf-wave-propagation': {
        const lambdaVal = Math.max(10, a);
        const dist = Math.max(100, b);
        const sigma = Math.max(0.001, c / 1000);
        const x = xParameter(lambdaVal, dist, 7, sigma);
        const F = attenuationFactorF(x);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">λ (м): {a.toFixed(0)}</Typography>
              <Slider value={a} min={10} max={3000} step={10} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">d (м): {b.toFixed(0)}</Typography>
              <Slider value={b} min={100} max={50000} step={100} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">σ (×10⁻³ См/м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={1} max={100} step={1} onChange={(_, v) => setC(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="x" value={x.toFixed(4)} />,
            <ValueLine key="v2" label="F" value={F.toFixed(4)} />,
          ],
        };
      }
      case 'hf-soil-attenuation': {
        const sigma = Math.max(0.001, a / 1000);
        const lambdaVal = Math.max(10, b);
        const dist = Math.max(100, c);
        const x = xParameter(lambdaVal, dist, 7, sigma);
        const F = attenuationFactorF(x);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">σ (×10⁻³ См/м): {a.toFixed(1)}</Typography>
              <Slider value={a} min={1} max={100} step={1} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">λ (м): {b.toFixed(0)}</Typography>
              <Slider value={b} min={10} max={3000} step={10} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">d (м): {c.toFixed(0)}</Typography>
              <Slider value={c} min={100} max={30000} step={100} onChange={(_, v) => setC(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="F (σ-зависимость)" value={F.toFixed(4)} />,
            <ValueLine key="v2" label="Ослабление" value={`${((1 - F) * 100).toFixed(1)} %`} />,
          ],
        };
      }
      case 'uhf-field-strength': {
        const P = Math.max(1, a);
        const G = Math.max(1, b);
        const Hant = Math.max(1, c);
        const r = Math.max(1, d);
        const R = distanceFromPhaseCenter(Hant, r);
        const delta = Math.atan(Hant / r);
        const Fd = normalizedPatternFactor(delta);
        const E = fieldStrengthUHF(P, G, R, Fd, 1.41);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">P (Вт): {a.toFixed(0)}</Typography>
              <Slider value={a} min={100} max={200000} step={1000} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">G: {b.toFixed(1)}</Typography>
              <Slider value={b} min={1} max={50} step={0.5} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">H (м): {c.toFixed(0)}</Typography>
              <Slider value={c} min={10} max={500} step={5} onChange={(_, v) => setC(v as number)} />
              <Typography variant="caption">r (м): {d.toFixed(0)}</Typography>
              <Slider value={d} min={10} max={2000} step={10} onChange={(_, v) => setD(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="R" value={`${R.toFixed(1)} м`} />,
            <ValueLine key="v2" label="F(Δ)" value={Fd.toFixed(4)} />,
            <ValueLine key="v3" label="E" value={`${E.toFixed(3)} В/м`} />,
          ],
        };
      }
      case 'uhf-antenna-pattern': {
        const G = Math.max(1, a);
        const delta = (b * Math.PI) / 180;
        const Fd = normalizedPatternFactor(delta);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">G: {a.toFixed(1)}</Typography>
              <Slider value={a} min={1} max={50} step={0.5} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">Δ (°): {b.toFixed(0)}</Typography>
              <Slider value={b} min={0} max={90} step={1} onChange={(_, v) => setB(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="F(Δ)" value={Fd.toFixed(4)} />,
          ],
        };
      }
      case 'radiation-dose': {
        const freqMHz = Math.max(0.03, a);
        const E_pdu = freqMHz < 3 ? 50 : freqMHz < 30 ? 20 : freqMHz < 300 ? 10 : 5;
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">f (МГц): {a.toFixed(1)}</Typography>
              <Slider value={a} min={0.03} max={30000} step={10} onChange={(_, v) => setA(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="ПДУ E" value={`${E_pdu} В/м`} />,
          ],
        };
      }
      case 'electric-current-body': {
        const U = Math.max(1, a);
        const Z = Math.max(100, b);
        const ImA = bodyCurrentMA(U, Z);
        const danger = classifyCurrentDanger(ImA);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">U (В): {a.toFixed(0)}</Typography>
              <Slider value={a} min={1} max={380} step={1} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">Z (Ом): {b.toFixed(0)}</Typography>
              <Slider value={b} min={100} max={10000} step={50} onChange={(_, v) => setB(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="I" value={`${ImA.toFixed(2)} мА`} />,
            <ValueLine key="v2" label="Опасность" value={danger} />,
          ],
        };
      }
      case 'electric-resistance': {
        const Rn = Math.max(100, a);
        const C_nF = Math.max(1, b);
        const Rv = Math.max(100, c);
        const freq = Math.max(1, d);
        const Zn = skinImpedance(Rn, freq, C_nF * 1e-9);
        const Zt = totalBodyImpedance(Zn, Rv);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Rн (Ом): {a.toFixed(0)}</Typography>
              <Slider value={a} min={100} max={20000} step={100} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">C (нФ): {b.toFixed(0)}</Typography>
              <Slider value={b} min={1} max={100} step={1} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">Rв (Ом): {c.toFixed(0)}</Typography>
              <Slider value={c} min={100} max={1500} step={50} onChange={(_, v) => setC(v as number)} />
              <Typography variant="caption">f (Гц): {d.toFixed(0)}</Typography>
              <Slider value={d} min={1} max={1000} step={1} onChange={(_, v) => setD(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Zн" value={`${Zn.toFixed(0)} Ом`} />,
            <ValueLine key="v2" label="Z полное" value={`${Zt.toFixed(0)} Ом`} />,
          ],
        };
      }
      case 'electric-frequency-effect': {
        const freq = Math.max(1, a);
        const Zn = skinImpedance(5000, freq, 20e-9);
        const Zt = totalBodyImpedance(Zn, 500);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">f (Гц): {a.toFixed(0)}</Typography>
              <Slider value={a} min={1} max={10000} step={10} onChange={(_, v) => setA(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Z(f)" value={`${Zt.toFixed(0)} Ом`} />,
            <ValueLine key="v2" label="Zн(f)" value={`${Zn.toFixed(0)} Ом`} />,
          ],
        };
      }
      case 'ground-current-spread': {
        const Iz = Math.max(0.1, a);
        const rho = Math.max(1, b);
        const x = Math.max(0.5, c);
        const j = currentDensity(Iz, x);
        const phi = groundPotential(Iz, rho, x);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Iз (А): {a.toFixed(1)}</Typography>
              <Slider value={a} min={0.1} max={50} step={0.5} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">ρ (Ом·м): {b.toFixed(0)}</Typography>
              <Slider value={b} min={1} max={500} step={5} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">x (м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={0.5} max={30} step={0.5} onChange={(_, v) => setC(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="j" value={`${j.toFixed(4)} А/м²`} />,
            <ValueLine key="v2" label="φ(x)" value={`${phi.toFixed(2)} В`} />,
          ],
        };
      }
      case 'step-voltage': {
        const Iz = Math.max(0.1, a);
        const rho = Math.max(1, b);
        const x = Math.max(0.5, c);
        const step = Math.max(0.1, d / 10);
        const Ush = stepVoltage(Iz, rho, x, step);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Iз (А): {a.toFixed(1)}</Typography>
              <Slider value={a} min={0.1} max={50} step={0.5} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">ρ (Ом·м): {b.toFixed(0)}</Typography>
              <Slider value={b} min={1} max={500} step={5} onChange={(_, v) => setB(v as number)} />
              <Typography variant="caption">x (м): {c.toFixed(1)}</Typography>
              <Slider value={c} min={0.5} max={30} step={0.5} onChange={(_, v) => setC(v as number)} />
              <Typography variant="caption">a (м × 0.1): {(d / 10).toFixed(1)}</Typography>
              <Slider value={d} min={3} max={15} step={1} onChange={(_, v) => setD(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="Uш" value={`${Ush.toFixed(2)} В`} />,
            <ValueLine key="v2" label="Оценка" value={Ush < 36 ? 'Безопасно' : 'Превышение порога 36 В!'} />,
          ],
        };
      }
      case 'equipotential-zones': {
        const Iz = Math.max(0.1, a);
        const rho = Math.max(1, b);
        const phi5 = groundPotential(Iz, rho, 5);
        const phi10 = groundPotential(Iz, rho, 10);
        const phi20 = groundPotential(Iz, rho, 20);
        return {
          controls: (
            <Stack spacing={1.2}>
              <Typography variant="caption">Iз (А): {a.toFixed(1)}</Typography>
              <Slider value={a} min={0.1} max={50} step={0.5} onChange={(_, v) => setA(v as number)} />
              <Typography variant="caption">ρ (Ом·м): {b.toFixed(0)}</Typography>
              <Slider value={b} min={1} max={500} step={5} onChange={(_, v) => setB(v as number)} />
            </Stack>
          ),
          values: [
            <ValueLine key="v1" label="φ(5 м)" value={`${phi5.toFixed(2)} В`} />,
            <ValueLine key="v2" label="φ(10 м)" value={`${phi10.toFixed(2)} В`} />,
            <ValueLine key="v3" label="φ(20 м)" value={`${phi20.toFixed(2)} В`} />,
          ],
        };
      }
      default:
        return {
          controls: <Typography variant="body2">Симулятор в разработке.</Typography>,
          values: [],
        };
    }
  }, [a, b, c, d, e, f, g, h, type]);

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
        {sceneTitle[type] || 'Симулятор'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Изменяйте параметры ползунками — результат отобразится в 3D-сцене и в расчётах ниже.
      </Typography>
      {/* Interactive 3D Scene — params is memoized so that the
          scene only re-renders when a slider value actually changes,
          not on every parent render. */}
      {!isTestEnvironment && (
        <Suspense fallback={<LinearProgress sx={{ mb: 1 }} />}>
          <TheoryScene3D type={type} params={sceneParams} />
        </Suspense>
      )}
      {/* Controls */}
      <Box sx={{ mt: 1.5 }}>{content.controls}</Box>
      <Stack spacing={0.8} sx={{ mt: 1.5 }}>
        {content.values}
      </Stack>
    </Paper>
  );
}
