import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { LessonTheme } from '../../types/theme';
import {
  lesson2MergedValues,
  lesson4MergedValues,
  lesson6MergedValues,
  lesson6Table2Variants,
  lesson7MergedValues,
  lesson7Table2Variants,
  lesson8MergedValues,
  lesson8Table3Variants,
  lesson12MergedValues,
  lesson12Table1Variants,
  lesson13MergedValues,
  lesson13Table2Variants,
  lesson13Table3Variants,
  lesson13Table3ActiveColumn,
  pickVariantByTicketDigits,
} from '../../data/variants';
import Lab4TablesPanel from './Lab4TablesPanel';
import VariantTable from './VariantTable';
import { mean, realisticIlluminanceLux } from '../../formulas/illumination';
import {
  barrierReductionDbFromMass,
  deltaByDifferenceDb,
  levelAfterBarrierDb,
  levelAtDistanceDb,
  sourceLevelAtObserver,
  sumLevelsEnergyDb,
  sumTwoLevelsByDeltaDb,
} from '../../formulas/noise';
import {
  classifyEmZone,
  electricFieldStrengthVpm,
  powerFluxDensityWm2,
  wavelengthM,
} from '../../formulas/emi';
import {
  magneticFieldStrengthH,
  allowablePPE,
  shieldThicknessM,
  waveguideAttenuationPerM,
  waveguideLengthM,
  absolutePermeability,
  angularFrequencyOmega,
  attenuationRatioL,
  powerFluxDensityFromH,
} from '../../formulas/shielding';
import { fieldStrengthShuleikin, attenuationFactorF, xParameter, classifyWaveBand } from '../../formulas/hfField';
import {
  distanceFromPhaseCenter,
  normalizedPatternFactorFromR,
  fieldStrengthUHF,
  pduForFrequencyVpm,
} from '../../formulas/uhfField';
import {
  bodyCurrentMA,
  totalBodyImpedance,
  skinImpedance,
  classifyCurrentDanger,
  currentDensity,
  groundPotential,
  stepVoltage as calcStepVoltage,
  safeDistance,
  lesson11TouchEstimate,
  lesson12TnLabEstimate,
  type Lesson12TnScenario,
} from '../../formulas/electricSafety';
import { lesson13FireLabMetrics } from '../../formulas/fireSafety';
import { useProgress } from '../../context/ProgressContext';

import type { FirstAidElectricStage } from './FirstAidElectricLabScene';

const LabScene3D = lazy(() => import('./LabScene3D'));

type LampType = 'incandescent' | 'fluorescent' | 'led';

interface LabSectionProps {
  lesson: LessonTheme;
}

interface ResultRow {
  step: string;
  metric: string;
  value: string;
}

const EMI_ZONE_LABEL: Record<'near' | 'intermediate' | 'far', string> = {
  near: 'ближняя (индукция)',
  intermediate: 'промежуточная',
  far: 'дальняя (излучение)',
};

const WAVE_BAND_LABEL: Record<'DV' | 'SV' | 'KV' | 'UKV' | 'SVCh', string> = {
  DV: 'ДВ',
  SV: 'СВ',
  KV: 'КВ',
  UKV: 'УКВ',
  SVCh: 'СВЧ',
};

export default function LabSection({ lesson }: LabSectionProps) {
  const progress = useProgress();
  const persistedLabStep = progress.get(lesson.id).labStep;
  const initialValues = lesson.variants[0]?.values ?? {};
  /** Числа из таблицы вариантов (значения могут быть string | number). */
  function variantNumeric(values: Record<string, string | number>, key: string, fallback: number): number {
    const raw = values[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  }
  function variantValuesAsNumbers(values: Record<string, string | number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
    }
    return out;
  }
  const [ticketInput, setTicketInput] = useState('');
  const [variantNumber, setVariantNumber] = useState(0);
  const [lesson2Penultimate, setLesson2Penultimate] = useState(0);
  const [lesson4Penultimate, setLesson4Penultimate] = useState(0);
  const [lesson2Full, setLesson2Full] = useState<Record<string, number>>(
    () => lesson.id === 2 ? lesson2MergedValues(0, 0) : {}
  );
  const [lesson4Room, setLesson4Room] = useState<Record<string, number>>(
    () => lesson.id === 4 ? lesson4MergedValues(0, 0) : {}
  );
  const [lesson2LampPower, setLesson2LampPower] = useState(60);
  const [lesson2SigmaE, setLesson2SigmaE] = useState<string>('42.84');

  /* ── Lesson 6 (shield) state ── */
  const [lesson6Full, setLesson6Full] = useState<Record<string, number>>(
    () => lesson.id === 6 ? lesson6MergedValues(0, 0) : {}
  );
  const [lesson6Penultimate, setLesson6Penultimate] = useState(0);
  /* ── Lesson 7 (HF field) state ── */
  const [lesson7Full, setLesson7Full] = useState<Record<string, number>>(
    () => lesson.id === 7 ? lesson7MergedValues(0, 0) : {}
  );
  const [lesson7Penultimate, setLesson7Penultimate] = useState(0);
  /* ── Lesson 8 (UHF field) state ── */
  const [lesson8Full, setLesson8Full] = useState<Record<string, number>>(() =>
    lesson.id === 8
      ? (Object.fromEntries(
          Object.entries(lesson8MergedValues(0, 0)).filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>)
      : {},
  );
  const [lesson8Penultimate, setLesson8Penultimate] = useState(0);
  /* ── Lesson 12 (grounding / TN) state ── */
  const [lesson12Full, setLesson12Full] = useState<Record<string, number | string>>(() =>
    lesson.id === 12 ? lesson12MergedValues(0, 0) : {},
  );
  const [lesson12Penultimate, setLesson12Penultimate] = useState(0);
  const [lesson13Full, setLesson13Full] = useState<Record<string, number | string>>(() =>
    lesson.id === 13 ? lesson13MergedValues(0, 0) : {},
  );
  const [lesson13Penultimate, setLesson13Penultimate] = useState(0);
  const [lesson13SparkOn, setLesson13SparkOn] = useState(false);
  const [l14FirstAidStage, setL14FirstAidStage] = useState<FirstAidElectricStage>('disconnect');
  const [l15InvestigationStage, setL15InvestigationStage] = useState<
    'firstAid' | 'preventHazard' | 'preserveScene' | 'notify' | 'commission' | 'investigation' | 'report'
  >('firstAid');
  const [l15Severity, setL15Severity] = useState<'light' | 'heavyOrFatal'>('light');
  /* ── Lesson 9 (body resistance) state ── */
  const [l9Voltage, setL9Voltage] = useState(220);
  const [l9Freq, setL9Freq] = useState(50);
  const [l9Rn, setL9Rn] = useState(5000);
  const [l9C, setL9C] = useState(20);
  const [l9Rv, setL9Rv] = useState(500);
  const [l9TimeS, setL9TimeS] = useState(1);
  const [l9TouchType, setL9TouchType] = useState<'unipolar' | 'bipolar' | 'multipolar'>('unipolar');
  const [l9DamagedPhases, setL9DamagedPhases] = useState<[string, string]>(['A', 'B']);
  /* ── Lesson 10 (step voltage) state ── */
  const [l10Iz, setL10Iz] = useState(10);
  const [l10Rho, setL10Rho] = useState(100);
  const [l10X, setL10X] = useState(5);
  const [l10A, setL10A] = useState(0.8);
  const [l10Surface, setL10Surface] = useState<'earth' | 'sand' | 'stone'>('earth');
  const [l11Uphi, setL11Uphi] = useState(220);
  const [l11Rh, setL11Rh] = useState(1000);
  const [l11Network, setL11Network] = useState<'IT' | 'TN'>('TN');
  const [l11Regime, setL11Regime] = useState<'normal' | 'emergency'>('normal');
  const [l11TouchedPhase, setL11TouchedPhase] = useState(0);
  const [l11Rg, setL11Rg] = useState(10);
  const [l11Rzm, setL11Rzm] = useState(15);
  const [l11Riso, setL11Riso] = useState(6000);
  const [l12Scenario, setL12Scenario] = useState<Lesson12TnScenario>('sc_enclosure');
  const [l12Rh, setL12Rh] = useState(1000);
  const [l12R0, setL12R0] = useState(4);
  const [trainingMode, setTrainingMode] = useState(false);
  const [manualTableOpen, setManualTableOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, Math.min(persistedLabStep, lesson.labWizard.steps.length))
  );
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);

  const variant = useMemo(
    () => lesson.variants.find((item) => item.variant === variantNumber) ?? lesson.variants[0],
    [lesson.variants, variantNumber]
  );

  const [lampType, setLampType] = useState<LampType>('led');
  const [intensityCd, setIntensityCd] = useState(
    variantNumeric(initialValues, 'intensityCd', variantNumeric(initialValues, 'lampFluxLm', 900)),
  );
  const [heightM, setHeightM] = useState(variantNumeric(initialValues, 'heightM', 2.8));
  const [sensorOffsetM, setSensorOffsetM] = useState(variantNumeric(initialValues, 'distanceM', 0.9));
  const [reflectance, setReflectance] = useState(variantNumeric(initialValues, 'reflectance', 0.4));
  const [luminaireCount, setLuminaireCount] = useState(variantNumeric(initialValues, 'luminaireCount', 2));

  const [sourceA, setSourceA] = useState(variantNumeric(initialValues, 'sourceA1mDb', 98));
  const [sourceB, setSourceB] = useState(variantNumeric(initialValues, 'sourceB1mDb', 92));
  const [sourceC, setSourceC] = useState(variantNumeric(initialValues, 'sourceC1mDb', 86));
  const [observerX, setObserverX] = useState(4.5);
  const [sourceAX, setSourceAX] = useState(4.5 - variantNumeric(initialValues, 'distanceA', 3));
  const [sourceBX, setSourceBX] = useState(4.5 - variantNumeric(initialValues, 'distanceB', 4));
  const [sourceCX, setSourceCX] = useState(4.5 - variantNumeric(initialValues, 'distanceC', 5));
  const [barrierMassA, setBarrierMassA] = useState(variantNumeric(initialValues, 'barrierMassA', 150));
  const [barrierMassB, setBarrierMassB] = useState(
    variantNumeric(initialValues, 'barrierMassB', variantNumeric(initialValues, 'barrierMassA', 150)),
  );
  const [barrierMassC, setBarrierMassC] = useState(
    variantNumeric(initialValues, 'barrierMassC', variantNumeric(initialValues, 'barrierMassA', 150)),
  );
  const [sourceAOn, setSourceAOn] = useState(true);
  const [sourceBOn, setSourceBOn] = useState(true);
  const [sourceCOn, setSourceCOn] = useState(true);

  const [frequencyHz, setFrequencyHz] = useState(variantNumeric(initialValues, 'frequencyHz', 2.4e6));
  const [distanceM, setDistanceM] = useState(variantNumeric(initialValues, 'distanceM', 1.2));
  const [eVpm, setEVpm] = useState(variantNumeric(initialValues, 'electricFieldVpm', 14));
  const [hApm, setHApm] = useState(variantNumeric(initialValues, 'magneticFieldApm', 0.45));

  useEffect(() => {
    const restored = Math.max(0, Math.min(progress.get(lesson.id).labStep, lesson.labWizard.steps.length));
    setStepIndex((current) => (current === restored ? current : restored));
  }, [lesson.id, lesson.labWizard.steps.length, progress]);

  useEffect(() => {
    if (lesson.id !== 11) return;
    const v = lesson.variants[0]?.values;
    if (!v) return;
    const u = Number(v.UphiV);
    const r = Number(v.bodyResistanceOhm);
    if (Number.isFinite(u)) setL11Uphi(u);
    if (Number.isFinite(r)) setL11Rh(r);
  }, [lesson.id, lesson.variants]);

  useEffect(() => {
    progress.setLabStep(lesson.id, stepIndex);
  }, [lesson.id, progress, stepIndex]);

  useEffect(() => {
    const handleLabStepRequest = (event: Event) => {
      const targetId = (event as CustomEvent<string>).detail;
      if (!targetId) return;
      const nextStep = lesson.labWizard.steps.findIndex((step) => step.id === targetId);
      if (nextStep >= 0) {
        setStepIndex(nextStep + 1);
      }
    };

    window.addEventListener('lesson-lab-step-request', handleLabStepRequest as EventListener);
    return () => window.removeEventListener('lesson-lab-step-request', handleLabStepRequest as EventListener);
  }, [lesson.labWizard.steps]);

  function applyVariantValues(values: Record<string, number | string>) {
    if (lesson.id === 2) {
      setLesson2Full(variantValuesAsNumbers(values));
    }
    if (lesson.id === 4) {
      setLesson4Room(variantValuesAsNumbers(values));
    }
    if (lesson.id === 1 || lesson.id === 2) {
      setIntensityCd(variantNumeric(values, 'intensityCd', variantNumeric(values, 'lampFluxLm', 900)));
      setHeightM(variantNumeric(values, 'heightM', 2.8));
      setSensorOffsetM(variantNumeric(values, 'distanceM', 0.9));
      setReflectance(variantNumeric(values, 'reflectance', 0.4));
      setLuminaireCount(variantNumeric(values, 'luminaireCount', 2));
    }
    if (lesson.id === 3 || lesson.id === 4) {
      setSourceA(variantNumeric(values, 'sourceA1mDb', 98));
      setSourceB(variantNumeric(values, 'sourceB1mDb', 92));
      setSourceC(variantNumeric(values, 'sourceC1mDb', 86));
      setSourceAX(observerX - variantNumeric(values, 'distanceA', 3));
      setSourceBX(observerX - variantNumeric(values, 'distanceB', 4));
      setSourceCX(observerX - variantNumeric(values, 'distanceC', 5));
      setBarrierMassA(variantNumeric(values, 'barrierMassA', 150));
      setBarrierMassB(variantNumeric(values, 'barrierMassB', variantNumeric(values, 'barrierMassA', 150)));
      setBarrierMassC(variantNumeric(values, 'barrierMassC', variantNumeric(values, 'barrierMassA', 150)));
    }
    if (lesson.id === 5) {
      setFrequencyHz(variantNumeric(values, 'frequencyHz', 2.4e6));
      setDistanceM(variantNumeric(values, 'distanceM', 1.2));
      setEVpm(variantNumeric(values, 'electricFieldVpm', 14));
      setHApm(variantNumeric(values, 'magneticFieldApm', 0.45));
    }
    if (lesson.id === 6) {
      setLesson6Full(variantValuesAsNumbers(values));
    }
    if (lesson.id === 7) {
      setLesson7Full(variantValuesAsNumbers(values));
    }
    if (lesson.id === 8) {
      setLesson8Full(
        Object.fromEntries(
          Object.entries(values).filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>,
      );
    }
    if (lesson.id === 9) {
      setL9Voltage(variantNumeric(values, 'voltage', 220));
      setL9Freq(variantNumeric(values, 'frequency', 50));
      setL9Rn(variantNumeric(values, 'Rn', 5000));
      setL9C(variantNumeric(values, 'C', 20));
      setL9Rv(variantNumeric(values, 'Rv', 500));
    }
    if (lesson.id === 10) {
      setL10Iz(variantNumeric(values, 'Iz', 10));
      setL10Rho(variantNumeric(values, 'rho', 100));
      setL10X(variantNumeric(values, 'x', 5));
      setL10A(variantNumeric(values, 'a', 0.8));
    }
    if (lesson.id === 11) {
      setL11Uphi(variantNumeric(values, 'UphiV', 220));
      setL11Rh(variantNumeric(values, 'bodyResistanceOhm', 1000));
    }
    if (lesson.id === 12) {
      setLesson12Full({ ...values });
    }
    if (lesson.id === 13) {
      setLesson13Full({ ...values });
    }
  }

  const lightingMetrics = useMemo(() => {
    const distance = Math.sqrt(heightM * heightM + sensorOffsetM * sensorOffsetM);
    const eLux = realisticIlluminanceLux({
      intensityCd,
      distanceM: Math.max(0.1, distance),
      luminaireCount,
      reflectance,
      utilizationFactor: 0.62,
      maintenanceFactor: 0.85,
    });
    const history = [eLux, eLux * 0.92, eLux * 1.05, eLux * 0.89, eLux * 1.02];
    return {
      eLux,
      eAvg: mean(history),
      distance,
    };
  }, [heightM, intensityCd, luminaireCount, reflectance, sensorOffsetM]);

  const noiseMetrics = useMemo(() => {
    const levels = [
      sourceAOn
        ? sourceLevelAtObserver({
          levelAt1mDb: sourceA,
          distanceM: Math.max(0.8, Math.abs(observerX - sourceAX)),
          barrierMassPerM2: barrierMassA,
        })
        : Number.NEGATIVE_INFINITY,
      sourceBOn
        ? sourceLevelAtObserver({
          levelAt1mDb: sourceB,
          distanceM: Math.max(0.8, Math.abs(observerX - sourceBX)),
          barrierMassPerM2: barrierMassB,
        })
        : Number.NEGATIVE_INFINITY,
      sourceCOn
        ? sourceLevelAtObserver({
          levelAt1mDb: sourceC,
          distanceM: Math.max(0.8, Math.abs(observerX - sourceCX)),
          barrierMassPerM2: barrierMassC,
        })
        : Number.NEGATIVE_INFINITY,
    ].filter((value) => Number.isFinite(value)) as number[];

    const total = levels.length > 0 ? sumLevelsEnergyDb(levels) : 0;
    return { levels, total };
  }, [barrierMassA, barrierMassB, barrierMassC, observerX, sourceA, sourceAOn, sourceAX, sourceB, sourceBOn, sourceBX, sourceC, sourceCOn, sourceCX]);

  const lesson2Calcs = useMemo(() => {
    if (lesson.id !== 2) return null;
    const v = lesson2Full;
    const L = v.lengthM ?? 0;
    const B = v.widthM ?? 0;
    const H = v.heightM ?? 0;
    const PhiL = v.lampFluxLm ?? 0;
    const En = v.eNormLux ?? 0;
    const Kz = v.reserveFactor ?? 0;
    const z = v.nonUniformity ?? 0;
    const Sn = v.roomAreaM2 ?? 0;
    const n = v.lampsPerLuminaire ?? 0;
    const Wm = v.tabWm ?? v.tabWt ?? 0;
    const etaPct = v.etaPct ?? 0;
    const mu = v.mu ?? 0;
    const hasTables = Kz > 0 && z > 0 && Sn > 0 && n > 0 && etaPct > 0 && mu > 0;

    const PhiSv = +(2 * PhiL).toFixed(2);
    const N1 = hasTables && PhiSv > 0
      ? Math.ceil((En * Sn * Kz * z * 100) / (PhiSv * etaPct))
      : null;
    const PhiSvRequired = hasTables && N1
      ? +((En * Sn * Kz * z * 100) / (N1 * etaPct)).toFixed(2)
      : null;
    const Hp = +(H - 0.3).toFixed(3);
    const i = Hp > 0 && (L + B) > 0
      ? +((L * B) / (Hp * (L + B))).toFixed(3)
      : null;

    const chosenPower = lesson2LampPower;
    const calculatedLampPower = +(0.9 * Wm).toFixed(3);
    const alphaKz = +(((1.3 / 1.5) * calculatedLampPower)).toFixed(3);
    const alphaZ = +(((1.5 / 1.1) * alphaKz)).toFixed(3);
    const correctionK = +(((400 / 100) * alphaZ)).toFixed(3);
    const Wp = +((correctionK * Wm)).toFixed(3);
    const lampFits = chosenPower >= calculatedLampPower;
    const N2 = hasTables && n > 0 && chosenPower > 0
      ? Math.ceil((Wp * Sn) / (n * chosenPower))
      : null;

    const sigmaEParsed = Number.parseFloat(lesson2SigmaE);
    const sigmaE = Number.isFinite(sigmaEParsed) && sigmaEParsed > 0 ? sigmaEParsed : 42.84;
    const Hprime = Hp;
    const Pprime = Hprime > 0 ? +(chosenPower / Hprime).toFixed(3) : null;
    const Lprime = Hprime > 0 ? +(L / Hprime).toFixed(3) : null;
    const lLine = Lprime !== null ? +(0.5 * Lprime).toFixed(3) : null;
    const PhiLprime = hasTables
      ? +((1000 * En * Kz * z) / (mu * sigmaE)).toFixed(2)
      : null;
    const N1row = PhiLprime !== null && PhiSv > 0
      ? Math.ceil((PhiLprime * L) / PhiSv)
      : null;
    const Ntotal = N1row !== null ? N1row * 2 : null;

    return {
      L,
      B,
      H,
      PhiL,
      En,
      Kz,
      z,
      Sn,
      n,
      Wm,
      etaPct,
      mu,
      hasTables,
      PhiSv,
      N1,
      PhiSvRequired,
      Hp,
      i,
      chosenPower,
      calculatedLampPower,
      alphaKz,
      alphaZ,
      correctionK,
      Wp,
      lampFits,
      N2,
      Hprime,
      Pprime,
      Lprime,
      lLine,
      sigmaE,
      PhiLprime,
      N1row,
      Ntotal,
    };
  }, [lesson.id, lesson2Full, lesson2LampPower, lesson2SigmaE]);

  const lesson4Calcs = useMemo(() => {
    if (lesson.id !== 4) return null;

    const perSource = [
      {
        id: 'A',
        label: 'Источник 1',
        enabled: sourceAOn,
        levelAt1mDb: sourceA,
        distanceM: Math.max(0.8, Math.abs(observerX - sourceAX)),
        barrierMass: barrierMassA,
      },
      {
        id: 'B',
        label: 'Источник 2',
        enabled: sourceBOn,
        levelAt1mDb: sourceB,
        distanceM: Math.max(0.8, Math.abs(observerX - sourceBX)),
        barrierMass: barrierMassB,
      },
      {
        id: 'C',
        label: 'Источник 3',
        enabled: sourceCOn,
        levelAt1mDb: sourceC,
        distanceM: Math.max(0.8, Math.abs(observerX - sourceCX)),
        barrierMass: barrierMassC,
      },
    ].map((source) => {
      if (!source.enabled) {
        return {
          ...source,
          LR: null,
          barrierReduction: null,
          LRp: null,
        };
      }

      const LR = levelAtDistanceDb(source.levelAt1mDb, source.distanceM);
      const barrierReduction = barrierReductionDbFromMass(source.barrierMass);
      const LRp = levelAfterBarrierDb(LR, barrierReduction);
      return {
        ...source,
        LR: +LR.toFixed(3),
        barrierReduction: +barrierReduction.toFixed(3),
        LRp: +LRp.toFixed(3),
      };
    });

    const correctedLevels = perSource
      .filter((source) => source.LRp !== null)
      .sort((left, right) => (right.LRp ?? 0) - (left.LRp ?? 0));

    let pairAB: {
      leftLabel: string;
      rightLabel: string;
      diff: number;
      delta: number;
      sum: number;
    } | null = null;
    let pairABC: {
      leftLabel: string;
      rightLabel: string;
      diff: number;
      delta: number;
      sum: number;
    } | null = null;

    if (correctedLevels.length >= 2) {
      const left = correctedLevels[0];
      const right = correctedLevels[1];
      const diff = (left.LRp ?? 0) - (right.LRp ?? 0);
      const delta = deltaByDifferenceDb(diff);
      const sum = sumTwoLevelsByDeltaDb(left.LRp ?? 0, right.LRp ?? 0);
      pairAB = {
        leftLabel: left.label,
        rightLabel: right.label,
        diff: +diff.toFixed(3),
        delta: +delta.toFixed(3),
        sum: +sum.toFixed(3),
      };
    }

    if (pairAB && correctedLevels.length >= 3) {
      const third = correctedLevels[2];
      const diff = pairAB.sum - (third.LRp ?? 0);
      const delta = deltaByDifferenceDb(diff);
      const sum = sumTwoLevelsByDeltaDb(pairAB.sum, third.LRp ?? 0);
      pairABC = {
        leftLabel: `${pairAB.leftLabel} + ${pairAB.rightLabel}`,
        rightLabel: third.label,
        diff: +diff.toFixed(3),
        delta: +delta.toFixed(3),
        sum: +sum.toFixed(3),
      };
    }

    const totalWithBarrier = pairABC?.sum ?? pairAB?.sum ?? correctedLevels[0]?.LRp ?? 0;

    const Spt = lesson4Room.surfaceCeilingFloorM2 ?? 0;
    const Sc = lesson4Room.surfaceWallsM2 ?? 0;
    const alpha1 = lesson4Room.alpha1 ?? 0;
    const alpha2 = lesson4Room.alpha2 ?? 0;
    const beta1 = lesson4Room.beta1 ?? 0;
    const beta2 = lesson4Room.beta2 ?? 0;
    const gamma = lesson4Room.floorGamma ?? 0.061;
    const M1 = +(Spt * alpha1 + Sc * beta1 + Spt * gamma).toFixed(3);
    const M2 = +(Spt * alpha2 + Sc * beta2 + Spt * gamma).toFixed(3);
    const coveringReduction = M1 > 0 && M2 > 0 ? +(10 * Math.log10(M2 / M1)).toFixed(3) : 0;
    const totalAfterTreatment = +(totalWithBarrier - coveringReduction).toFixed(3);

    return {
      perSource,
      correctedLevels,
      pairAB,
      pairABC,
      totalWithBarrier: +totalWithBarrier.toFixed(3),
      room: {
        Spt,
        Sc,
        alpha1,
        alpha2,
        beta1,
        beta2,
        gamma,
      },
      M1,
      M2,
      coveringReduction,
      totalAfterTreatment,
    };
  }, [
    barrierMassA,
    barrierMassB,
    barrierMassC,
    lesson.id,
    lesson4Room,
    observerX,
    sourceA,
    sourceAOn,
    sourceAX,
    sourceB,
    sourceBOn,
    sourceBX,
    sourceC,
    sourceCOn,
    sourceCX,
  ]);

  const emiMetrics = useMemo(() => {
    const lambda = wavelengthM(Math.max(1e3, frequencyHz));
    const ppe = powerFluxDensityWm2(Math.max(0, eVpm), Math.max(0, hApm));
    const zone = classifyEmZone(Math.max(0.01, distanceM), lambda);
    return { lambda, ppe, zone };
  }, [distanceM, eVpm, frequencyHz, hApm]);

  /* ── Lesson 6 computed metrics ── */
  const lesson6Calcs = useMemo(() => {
    if (lesson.id !== 6) return null;
    const v = lesson6Full;
    const W = v.W ?? 12;
    const I = v.I ?? 350;
    const f = v.f ?? 3e8;
    const T = v.T ?? 4;
    const R = v.R ?? 3;
    const r = v.r ?? 0.25; // coil radius
    const mu = v.mu ?? 200;
    const gamma = v.gamma ?? 1e7;
    const D = v.D ?? 0.01;
    const eps = v.epsilon ?? 7;

    /* Step 1: βm coefficient — if not specified, keep 1 */
    const betaM = v.betaM ?? 1;

    /* Step 2: Formula 6.1 — H = (w·I·r²·βm) / (4·R³) */
    const H = magneticFieldStrengthH(W, I, R, r, betaM);

    /* Step 4: Formula 6.5 — PPE_allowed = N / T */
    const PPEmax = allowablePPE(T);

    /* Step 3: Formula 6.4 — PPEδ = 377·H²/2 */
    const PPE = powerFluxDensityFromH(H);

    /* Step 5: Formula 6.6 — L = PPEδ / PPEδ_доп */
    const L = attenuationRatioL(PPE, PPEmax);

    /* Formula 6.9 — μa = μ0 · μ */
    const muA = absolutePermeability(mu);

    /* Step 6: Formula 6.8 — ω = 2πf */
    const omega = angularFrequencyOmega(f);

    /* Formula 6.7 — M = ln(L) / (2·√(ω·μa·γ/2)) */
    const M = shieldThicknessM(L, omega, muA, gamma);

    /* Step 7: Formula 6.10 — α (дБ/м) = 32 / (D·√ε) */
    const alpha = waveguideAttenuationPerM(D, eps);

    /* Step 8: Formula 6.11 — waveguide length */
    const wgLen = waveguideLengthM(L, alpha);

    return { W, I, f, T, R, r, mu, muA, gamma, D, eps, betaM, H, PPE, PPEmax, L, omega, alpha, M, wgLen };
  }, [lesson.id, lesson6Full]);

  /* ── Lesson 7 computed metrics ── */
  const lesson7Calcs = useMemo(() => {
    if (lesson.id !== 7) return null;
    const v = lesson7Full;
    const lambda = v.lambda ?? 1650;
    const P = v.P ?? 300;
    const Ga = v.Ga ?? 1.1;
    const theta = v.theta ?? 7;
    const sigma = v.sigma ?? 0.003;
    const distances = [v.d1 ?? 1000, v.d2 ?? 2000, v.d3 ?? 3000, v.d4 ?? 4000, v.d5 ?? 5000];
    const band = classifyWaveBand(lambda);
    const results = distances.map((d) => {
      const x = xParameter(d, lambda, theta, sigma);
      const F = attenuationFactorF(x);
      const E = fieldStrengthShuleikin(P, Ga, d, F);
      return { d, x, F, E };
    });
    return { lambda, P, Ga, theta, sigma, band, results };
  }, [lesson.id, lesson7Full]);

  /* ── Lesson 8 computed metrics ── */
  const lesson8Calcs = useMemo(() => {
    if (lesson.id !== 8) return null;
    const v = lesson8Full;
    const kwImg = typeof v.pImageKW === 'number' ? v.pImageKW : undefined;
    const kwSnd = typeof v.pSoundKW === 'number' ? v.pSoundKW : undefined;
    const Pimg = (kwImg !== undefined ? kwImg * 1000 : (v.pImg ?? 94_000));
    const Psnd = (kwSnd !== undefined ? kwSnd * 1000 : (v.pSnd ?? 23_000));
    const G = v.G ?? 12;
    const Hant = v.H ?? 300;
    const K = v.K ?? 1.41;
    const distances = [v.r1 ?? 100, v.r2 ?? 200, v.r3 ?? 400, v.r4 ?? 600, v.r5 ?? 1000];
    const results = distances.map((r) => {
      const R = distanceFromPhaseCenter(Hant, r);
      const delta = Math.atan(Hant / r);
      const Fd = normalizedPatternFactorFromR(r);
      const Eimg = fieldStrengthUHF(Pimg, G, R, Fd, K);
      const Esnd = fieldStrengthUHF(Psnd, G, R, Fd, K);
      const Etotal = Math.sqrt(Eimg ** 2 + Esnd ** 2);
      return { r, R, delta, Fd, Eimg, Esnd, Etotal };
    });
    return { Pimg, Psnd, G, Hant, K, results };
  }, [lesson.id, lesson8Full]);

  /* ── Lesson 9 computed metrics ── */
  const lesson9Calcs = useMemo(() => {
    if (lesson.id !== 9) return null;
    const Zn = skinImpedance(l9Rn, l9Freq, l9C * 1e-9);
    const Z = totalBodyImpedance(Zn, l9Rv);
    const ImA = bodyCurrentMA(l9Voltage, Z);
    const danger = classifyCurrentDanger(ImA);
    return { Zn, Z, ImA, danger, U: l9Voltage, f: l9Freq, Rn: l9Rn, C: l9C, Rv: l9Rv };
  }, [lesson.id, l9Voltage, l9Freq, l9Rn, l9C, l9Rv]);

  /* ── Lesson 10 computed metrics ── */
  const lesson10Calcs = useMemo(() => {
    if (lesson.id !== 10) return null;
    const j = currentDensity(l10Iz, l10X);
    const phi = groundPotential(l10Iz, l10Rho, l10X);
    const Ush = calcStepVoltage(l10Iz, l10Rho, l10X, l10A);
    return { j, phi, Ush, Iz: l10Iz, rho: l10Rho, x: l10X, a: l10A };
  }, [lesson.id, l10Iz, l10Rho, l10X, l10A]);

  const lesson11Calcs = useMemo(() => {
    if (lesson.id !== 11) return null;
    const regimeEff = l11Network === 'IT' ? 'normal' : l11Regime;
    const { UprV, ImA } = lesson11TouchEstimate({
      network: l11Network,
      regime: regimeEff,
      touchedPhaseIndex: l11TouchedPhase,
      UphiV: l11Uphi,
      RhOhm: l11Rh,
      RgOhm: l11Rg,
      RzmOhm: l11Rzm,
      RisoOhm: l11Riso,
    });
    const dangerLevel = classifyCurrentDanger(ImA, true);
    const dangerLabel =
      dangerLevel === 'safe'
        ? 'безопасный уровень'
        : dangerLevel === 'perceptible'
          ? 'ощутимый ток'
          : dangerLevel === 'non-releasing'
            ? 'неотпускающий ток'
            : 'опасная зона';
    return {
      UprV,
      ImA,
      dangerLabel,
      Uphi: l11Uphi,
      Rh: l11Rh,
      network: l11Network,
      regimeEff,
      touchedPhase: l11TouchedPhase,
    };
  }, [lesson.id, l11Network, l11Regime, l11TouchedPhase, l11Uphi, l11Rh, l11Rg, l11Rzm, l11Riso]);

  function addResultRow() {
    if (stepIndex === 0) return;
    const currentStep = lesson.labWizard.steps[stepIndex - 1];
    const sid = currentStep.id;

    /* Для вводных/таблиц/итогов не подставляем расчётные величины — иначе совпадает с последним расчётным шагом. */
    if (
      currentStep.type === 'instruction' ||
      currentStep.type === 'tableFill' ||
      currentStep.type === 'quizCheck'
    ) {
      setResultRows((prev) => [
        ...prev,
        {
          step: currentStep.title,
          metric: currentStep.resultField ?? currentStep.type,
          value: '—',
        },
      ]);
      return;
    }

    let value = '—';

    const lampName =
      lampType === 'incandescent' ? 'накаливание' : lampType === 'fluorescent' ? 'люминесцентная' : 'LED';
    const l2sum = lesson2Calcs
      ? `N₁(η)=${lesson2Calcs.N1 ?? 'н/д'} св.; N₂(W)=${lesson2Calcs.N2 ?? 'н/д'} св.; NΣ=${lesson2Calcs.Ntotal ?? 'н/д'} св.`
      : '—';

    if (lesson.id === 1) {
      if (sid === 's1-3' || sid === 's1-5' || sid === 's1-7') {
        value = `E=${lightingMetrics.eLux.toFixed(1)} лк (лампа: ${lampName})`;
      } else if (sid === 's1-8') {
        value = `E=${lightingMetrics.eLux.toFixed(1)} лк; Eср=${lightingMetrics.eAvg.toFixed(1)} лк; лампа: ${lampName}`;
      } else if (sid === 's1-2' || sid === 's1-4' || sid === 's1-6') {
        value = `Лампа в панели: ${lampName}; E≈${lightingMetrics.eLux.toFixed(1)} лк`;
      } else {
        value = `E=${lightingMetrics.eLux.toFixed(1)} лк; Eср=${lightingMetrics.eAvg.toFixed(1)} лк`;
      }
    } else if (lesson.id === 2 && lesson2Calcs) {
      const c = lesson2Calcs;
      switch (sid) {
        case 's2-3':
          value = `Hp=${c.Hp} м`;
          break;
        case 's2-4':
          value = `i=${c.i ?? 'н/д'}`;
          break;
        case 's2-5':
          value = `η=${(c.etaPct / 100).toFixed(3)} (доли)`;
          break;
        case 's2-6':
          value = `Φсв=${c.PhiSv} лм`;
          break;
        case 's2-7':
          value = `N₁=${c.N1 ?? 'н/д'} св.`;
          break;
        case 's2-9':
          value = `αKз=${c.alphaKz}`;
          break;
        case 's2-10':
          value = `αZ=${c.alphaZ}`;
          break;
        case 's2-11':
          value = `αE=${(c.En / 100).toFixed(3)}`;
          break;
        case 's2-12':
          value = `Wp=${c.Wp} Вт/м²`;
          break;
        case 's2-13':
          value = `N₂=${c.N2 ?? 'н/д'} св.`;
          break;
        case 's2-15':
          value = `H′=${c.Hprime} м; l=${c.lLine ?? 'н/д'} м`;
          break;
        case 's2-16':
          value = `P′=${c.Pprime ?? 'н/д'}; L′=${c.Lprime ?? 'н/д'}`;
          break;
        case 's2-17':
          value = `μ=${c.mu} (Σe — по таблице приложения)`;
          break;
        case 's2-18':
          value = `Φл′=${c.PhiLprime ?? 'н/д'} лм`;
          break;
        case 's2-19':
          value = `N₁(в ряду)=${c.N1row ?? 'н/д'}`;
          break;
        case 's2-20':
          value = `NΣ=${c.Ntotal ?? 'н/д'} св.`;
          break;
        default:
          value = l2sum;
      }
    } else if (lesson.id === 3) {
      const barrierN =
        barrierMassA > 0 ? (14.5 + 15 * Math.log10(barrierMassA)).toFixed(2) : '—';
      if (sid === 's3-3' || sid === 's3-5' || sid === 's3-7') {
        value = `LΣ=${noiseMetrics.total.toFixed(2)} дБ`;
      } else if (sid === 's3-4') {
        value = `N=${barrierN} дБ (G=${barrierMassA.toFixed(0)} кг/м²)`;
      } else {
        value = `LΣ=${noiseMetrics.total.toFixed(1)} дБ; G=${barrierMassA.toFixed(0)} кг/м²`;
      }
    } else if (lesson.id === 4 && lesson4Calcs) {
      const L4 = lesson4Calcs;
      if (sid === 's4-2') {
        value = L4.perSource
          .filter((s) => s.enabled)
          .map((s) => `${s.id}: LR=${s.LR?.toFixed(2) ?? '—'} дБ`)
          .join('; ');
      } else if (sid === 's4-3') {
        const n = 14.5 + 15 * Math.log10(Math.max(1e-6, barrierMassA));
        value = `N=${n.toFixed(2)} дБ (G=${barrierMassA.toFixed(0)} кг/м²)`;
      } else if (sid === 's4-4') {
        value = L4.perSource
          .filter((s) => s.enabled)
          .map((s) => `${s.id}: L′R=${s.LRp?.toFixed(2) ?? '—'} дБ`)
          .join('; ');
      } else if (sid === 's4-5') {
        const s = L4.pairABC?.sum ?? L4.pairAB?.sum;
        value = s !== undefined ? `LΣ (LA+ΔL)=${s.toFixed(2)} дБ` : '—';
      } else if (sid === 's4-6') {
        const levels = L4.perSource.filter((s) => s.enabled && s.LRp != null).map((s) => s.LRp as number);
        const e =
          levels.length > 0
            ? 10 * Math.log10(levels.reduce((acc, L) => acc + 10 ** (L / 10), 0))
            : null;
        value = e !== null ? `LΣ (энерг.)=${e.toFixed(2)} дБ` : '—';
      } else {
        value = `LΣ=${L4.totalWithBarrier.toFixed(1)} дБ; L′Σ=${L4.totalAfterTreatment.toFixed(1)} дБ`;
      }
    } else if (lesson.id === 5) {
      const z = EMI_ZONE_LABEL[emiMetrics.zone];
      const v5 = variant.values;
      const pW = typeof v5.sourcePowerW === 'number' ? v5.sourcePowerW : 0;
      const gA = typeof v5.sourceGain === 'number' ? v5.sourceGain : 0;
      let eAnt = 0;
      try {
        eAnt = electricFieldStrengthVpm(pW, gA, Math.max(0.01, distanceM));
      } catch {
        eAnt = 0;
      }
      if (sid === 's5-2') {
        value = `λ=${emiMetrics.lambda.toExponential(2)} м`;
      } else if (sid === 's5-3') {
        value = `Зона: ${z}; r=${distanceM.toFixed(2)} м; λ/(2π)=${(emiMetrics.lambda / (2 * Math.PI)).toFixed(2)} м`;
      } else if (sid === 's5-4') {
        value = `ППЭ=${emiMetrics.ppe.toFixed(4)} Вт/м²`;
      } else if (sid === 's5-5') {
        value = `E=${eAnt.toFixed(3)} В/м (√30PG/R, P=${pW} Вт, G=${gA})`;
      } else {
        value = `λ=${emiMetrics.lambda.toExponential(2)} м; ППЭ=${emiMetrics.ppe.toFixed(3)} Вт/м²; зона: ${z}`;
      }
    } else if (lesson.id === 6 && lesson6Calcs) {
      const c6 = lesson6Calcs;
      switch (sid) {
        case 's6-2':
          value = `H=${c6.H.toExponential(3)} А/м`;
          break;
        case 's6-3':
          value = `ППЭδ=${c6.PPE.toExponential(3)} Вт/м²`;
          break;
        case 's6-4':
          value = `ППЭδдоп=${c6.PPEmax.toExponential(3)} Вт/м²`;
          break;
        case 's6-5':
          value = `L=${c6.L.toFixed(3)}`;
          break;
        case 's6-6':
          value = `ω=${c6.omega.toFixed(1)} с⁻¹; M=${(c6.M * 1000).toFixed(3)} мм`;
          break;
        case 's6-7':
          value = `α=${c6.alpha.toFixed(2)} дБ/м; l=${(c6.wgLen * 1000).toFixed(1)} мм`;
          break;
        default:
          value = `M=${(c6.M * 1000).toFixed(3)} мм; l=${(c6.wgLen * 1000).toFixed(1)} мм`;
      }
    } else if (lesson.id === 7 && lesson7Calcs) {
      const c7 = lesson7Calcs;
      const fmt = (rows: typeof c7.results, key: 'x' | 'F' | 'E') =>
        rows.map((row, i) => `d${i + 1}=${row[key].toFixed(4)}`).join('; ');
      const fMHz = 299_792_458 / Math.max(c7.lambda, 1e-9) / 1e6;
      const pdu = pduForFrequencyVpm(Math.max(0.01, fMHz));
      if (sid === 's7-2') {
        value = `Диапазон: ${WAVE_BAND_LABEL[c7.band]} (λ=${c7.lambda} м)`;
      } else if (sid === 's7-3') {
        value = `x: ${fmt(c7.results, 'x')}`;
      } else if (sid === 's7-4') {
        value = `F: ${fmt(c7.results, 'F')}`;
      } else if (sid === 's7-5' || sid === 's7-6') {
        value = `E, В/м: ${fmt(c7.results, 'E')}`;
      } else if (sid === 's7-7') {
        const maxE = Math.max(...c7.results.map((r) => r.E));
        value = `max E=${maxE.toFixed(4)} В/м; ПДУ≈${pdu} В/м (f≈${fMHz.toFixed(2)} МГц)`;
      } else {
        const r0 = c7.results[0];
        value = r0 ? `E(d₁)=${r0.E.toFixed(4)} В/м` : '—';
      }
    } else if (lesson.id === 8 && lesson8Calcs) {
      const c8 = lesson8Calcs;
      const rowStr = (fn: (row: (typeof c8.results)[number]) => string) =>
        c8.results.map((row, i) => `r${i + 1}: ${fn(row)}`).join('; ');
      if (sid === 's8-2') {
        value = rowStr((row) => `R=${row.R.toFixed(1)} м, Δ=${((row.delta * 180) / Math.PI).toFixed(2)}°`);
      } else if (sid === 's8-3') {
        value = rowStr((row) => `F=${row.Fd.toFixed(4)}`);
      } else if (sid === 's8-4') {
        value = rowStr((row) => `E_изобр=${row.Eimg.toFixed(3)} В/м`);
      } else if (sid === 's8-5') {
        value = rowStr((row) => `E_звук=${row.Esnd.toFixed(3)} В/м`);
      } else if (sid === 's8-6' || sid === 's8-7') {
        value = rowStr((row) => `E_сум=${row.Etotal.toFixed(3)} В/м`);
      } else if (sid === 's8-8') {
        const maxE = Math.max(...c8.results.map((r) => r.Etotal));
        value = `max E_сум=${maxE.toFixed(3)} В/м (сравните с ПДУ методички)`;
      } else {
        const r0 = c8.results[0];
        value = r0 ? `E_сум(d₁)=${r0.Etotal.toFixed(3)} В/м` : '—';
      }
    } else if (lesson.id === 9) {
      const Cfarad = l9C * 1e-9;
      const Z50 = totalBodyImpedance(skinImpedance(l9Rn, 50, Cfarad), l9Rv);
      const Z10k = totalBodyImpedance(skinImpedance(l9Rn, 10_000, Cfarad), l9Rv);
      const RnSkin = Math.max(0, (Z50 - Z10k) / 2);
      const Zn50 =
        RnSkin > 0
          ? RnSkin / Math.sqrt(1 + (2 * Math.PI * 50 * Cfarad * RnSkin) ** 2)
          : 0;
      const I220 = bodyCurrentMA(220, Math.max(Z50, 1e-6));
      const danger220 = classifyCurrentDanger(I220);

      if (sid === 's9-2') {
        value = `Z(50 Hz)=${Z50.toFixed(0)} Ом`;
      } else if (sid === 's9-3') {
        value = `Z(10 кГц)=${Z10k.toFixed(0)} Ом`;
      } else if (sid === 's9-4') {
        value = `Rн=${RnSkin.toFixed(0)} Ом`;
      } else if (sid === 's9-5') {
        value = `Zн(50 Гц)=${Zn50.toFixed(0)} Ом`;
      } else if (sid === 's9-6') {
        value = `Iч(U=220 В)=${I220.toFixed(2)} мА (${danger220})`;
      } else if (lesson9Calcs) {
        value = `I=${lesson9Calcs.ImA.toFixed(2)} мА; Z=${lesson9Calcs.Z.toFixed(0)} Ом; ${lesson9Calcs.danger}`;
      } else {
        value = `Z=${Z50.toFixed(0)} Ом (модель)`;
      }
    } else if (lesson.id === 10) {
      const xs = [1, 2, 5, 10, 20];
      if (sid === 's10-2') {
        value = xs
          .map((x) => `x=${x} м: j=${currentDensity(l10Iz, x).toExponential(2)} А/м²`)
          .join('; ');
      } else if (sid === 's10-3') {
        value = xs
          .map((x) => `x=${x} м: U=${groundPotential(l10Iz, l10Rho, x).toFixed(2)} В`)
          .join('; ');
      } else if (sid === 's10-4') {
        value = xs
          .map(
            (x) =>
              `x=${x} м: Uш=${calcStepVoltage(l10Iz, l10Rho, x, l10A).toFixed(2)} В`,
          )
          .join('; ');
      } else if (sid === 's10-6') {
        const xSafe = safeDistance(l10Iz, l10Rho, 36, l10A);
        value = `x(Uш<36 В)≈${xSafe.toFixed(1)} м (a=${l10A} м)`;
      } else if (lesson10Calcs) {
        value = `Uш=${lesson10Calcs.Ush.toFixed(2)} В; φ=${lesson10Calcs.phi.toFixed(2)} В (x=${l10X} м)`;
      } else {
        value = '—';
      }
    } else if (lesson.id === 11) {
      if (sid === 's11-2' && lesson11Calcs) {
        const ph = `L${lesson11Calcs.touchedPhase + 1}`;
        const mode =
          lesson11Calcs.network === 'IT'
            ? 'ИТ, норма'
            : lesson11Calcs.regimeEff === 'emergency'
              ? 'TN, авария (КЗ L1)'
              : 'TN, норма';
        value = `I_h=${lesson11Calcs.ImA.toFixed(2)} мА; Uпр≈${lesson11Calcs.UprV.toFixed(1)} В (${mode}; касание ${ph}; U_ф=${l11Uphi} В; R_h=${l11Rh} Ом)`;
      } else if (lesson11Calcs) {
        value = `I_h≈${lesson11Calcs.ImA.toFixed(2)} мА; Uпр≈${lesson11Calcs.UprV.toFixed(1)} В`;
      } else {
        value = '—';
      }
    } else {
      const zz = EMI_ZONE_LABEL[emiMetrics.zone];
      value = `λ=${emiMetrics.lambda.toExponential(2)} м; ППЭ=${emiMetrics.ppe.toFixed(3)} Вт/м²; зона: ${zz}`;
    }

    setResultRows((prev) => [
      ...prev,
      {
        step: currentStep.title,
        metric: currentStep.resultField ?? currentStep.type,
        value,
      },
    ]);
  }

  const progressPercent = useMemo(
    () => Math.round((stepIndex / (lesson.labWizard.steps.length + 1)) * 100),
    [lesson.labWizard.steps.length, stepIndex]
  );

  const reportSourceValues = useMemo(() => {
    if (lesson.id === 2) {
      return lesson2Full;
    }
    if (lesson.id === 4) {
      return {
        sourceA1mDb: sourceA,
        sourceB1mDb: sourceB,
        sourceC1mDb: sourceC,
        distanceA: Math.abs(observerX - sourceAX),
        distanceB: Math.abs(observerX - sourceBX),
        distanceC: Math.abs(observerX - sourceCX),
        barrierMassA,
        barrierMassB,
        barrierMassC,
        ...lesson4Room,
      };
    }
    if (lesson.id === 6) return lesson6Full;
    if (lesson.id === 7) return lesson7Full;
    if (lesson.id === 8) return lesson8Full;
    if (lesson.id === 11) {
      return {
        network: l11Network,
        regime: l11Network === 'IT' ? 'normal' : l11Regime,
        touchedPhaseIndex: l11TouchedPhase,
        UphiV: l11Uphi,
        RhOhm: l11Rh,
        RgOhm: l11Rg,
        RzmOhm: l11Rzm,
        RisoOhm: l11Riso,
      };
    }
    if (lesson.id === 12) return lesson12Full;
    if (lesson.id === 13) return lesson13Full;
    return variant.values;
  }, [
    barrierMassA,
    barrierMassB,
    barrierMassC,
    lesson.id,
    lesson2Full,
    lesson4Room,
    observerX,
    sourceA,
    sourceAX,
    sourceB,
    sourceBX,
    sourceC,
    sourceCX,
    variant.values,
    l11Network,
    l11Regime,
    l11TouchedPhase,
    l11Uphi,
    l11Rh,
    l11Rg,
    l11Rzm,
    l11Riso,
    lesson12Full,
    lesson13Full,
    lesson6Full,
    lesson7Full,
    lesson8Full,
  ]);

  const reportText = useMemo(() => {
    const rows = resultRows.map((row, index) => `${index + 1}. ${row.step}: ${row.value}`).join('\n');
    return [
      `Отчет по ${lesson.title}`,
      `Вариант: ${variant.variant}`,
      `Исходные данные: ${JSON.stringify(reportSourceValues)}`,
      'Результаты:',
      rows || 'Нет сохраненных результатов.',
      `Вывод: ${lesson.labWizard.reportConclusionHint}`,
    ].join('\n');
  }, [lesson, reportSourceValues, resultRows, variant]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch {
      // no-op
    }
  }

  /* ── Memoize state objects passed to LabScene3D so the 3D scene
       only re-renders when relevant values actually change,
       not on every parent render. ── */
  const lightStateMemo = useMemo(() => ({
    lampType,
    intensityCd,
    heightM,
    sensorOffsetM,
    reflectance,
    luminaireCount,
    roomLengthM: lesson.id === 2 ? (lesson2Calcs?.L ?? lesson2Full.lengthM ?? 14) : undefined,
    roomWidthM: lesson.id === 2 ? (lesson2Calcs?.B ?? lesson2Full.widthM ?? 10) : undefined,
    chosenLampPowerW: lesson.id === 2 ? lesson2LampPower : undefined,
    lineOffsetM: lesson.id === 2 ? (lesson2Calcs?.lLine ?? undefined) : undefined,
    lineRows: lesson.id === 2 ? 2 : undefined,
  }), [lampType, intensityCd, heightM, sensorOffsetM, reflectance, luminaireCount,
    lesson.id, lesson2Calcs, lesson2Full.lengthM, lesson2Full.widthM, lesson2LampPower]);

  const noiseStateMemo = useMemo(() => ({
    sourceA, sourceB, sourceC,
    sourceAX, sourceBX, sourceCX,
    observerX,
    barrierMassA, barrierMassB, barrierMassC,
    sourceAOn, sourceBOn, sourceCOn,
  }), [sourceA, sourceB, sourceC, sourceAX, sourceBX, sourceCX,
    observerX, barrierMassA, barrierMassB, barrierMassC,
    sourceAOn, sourceBOn, sourceCOn]);

  const emiStateMemo = useMemo(() => ({
    frequencyHz, distanceM, eVpm, hApm,
  }), [frequencyHz, distanceM, eVpm, hApm]);

  const shieldStateMemo = useMemo(() => ({
    frequencyHz: lesson6Full.f ?? 3e8,
    turns: lesson6Full.W ?? 12,
    currentA: (lesson6Full.I ?? 350) / 1000,
    distanceM: lesson6Full.R ?? 3,
    coilRadiusM: 0.1,
    conductivitySpm: lesson6Full.gamma ?? 1e7,
    muRelative: lesson6Full.mu ?? 200,
    exposureTimeH: lesson6Full.T ?? 4,
    waveguideDiameterM: lesson6Full.D ?? 0.01,
    waveguideEpsilon: lesson6Full.epsilon ?? 7,
  }), [lesson6Full]);

  const hfStateMemo = useMemo(() => ({
    powerKW: lesson7Full.P ?? 1,
    gainAntenna: lesson7Full.G ?? 1,
    wavelengthM: lesson7Full.lambda ?? 2000,
    theta: lesson7Full.theta ?? 3e-3,
    sigma: lesson7Full.sigma ?? 1e-3,
    distances: [
      lesson7Full.d1 ?? 50,
      lesson7Full.d2 ?? 100,
      lesson7Full.d3 ?? 200,
      lesson7Full.d4 ?? 500,
      lesson7Full.d5 ?? 1000,
    ],
  }), [lesson7Full]);

  const uhfStateMemo = useMemo(() => {
    const v = lesson8Full;
    const kwImg = typeof v.pImageKW === 'number' ? v.pImageKW : undefined;
    const kwSnd = typeof v.pSoundKW === 'number' ? v.pSoundKW : undefined;
    const powerVideoW = kwImg !== undefined ? kwImg * 1000 : (typeof v.P === 'number' ? v.P * 0.8 : 94_000);
    const powerAudioW = kwSnd !== undefined ? kwSnd * 1000 : (typeof v.P === 'number' ? v.P * 0.2 : 23_000);
    const heightM = typeof v.H === 'number' ? v.H : (typeof v.h === 'number' ? v.h : 25);
    return {
      powerW: (powerVideoW + powerAudioW) / 2,
      powerVideoW,
      powerAudioW,
      gain: v.G ?? 4,
      heightM,
      frequencyMHz: typeof v.f === 'number' ? v.f : 900,
      distances: [
        v.r1 ?? 50,
        v.r2 ?? 100,
        v.r3 ?? 200,
        v.r4 ?? 500,
        v.r5 ?? 1000,
      ],
    };
  }, [lesson8Full]);

  const bodyElecStateMemo = useMemo(() => ({
    voltageV: l9Voltage,
    frequencyHz: l9Freq,
    skinResistanceOhm: l9Rn,
    capacitanceNF: l9C,
    internalResistanceOhm: l9Rv,
    exposureTimeS: l9TimeS,
    touchType: l9TouchType,
    damagedPhases: l9DamagedPhases,
  }), [l9Voltage, l9Freq, l9Rn, l9C, l9Rv, l9TimeS, l9TouchType, l9DamagedPhases]);

  const groundStateMemo = useMemo(() => ({
    faultCurrentA: l10Iz,
    soilResistivityOhmM: l10Rho,
    distanceM: l10X,
    stepLengthM: l10A,
    surfaceType: l10Surface,
  }), [l10Iz, l10Rho, l10X, l10A, l10Surface]);

  const threePhaseStateMemo = useMemo(
    () => ({
      network: l11Network,
      regime: l11Regime,
      touchedPhaseIndex: l11TouchedPhase,
      UphiV: l11Uphi,
      RhOhm: l11Rh,
      RgOhm: l11Rg,
      RzmOhm: l11Rzm,
      RisoOhm: l11Riso,
    }),
    [l11Network, l11Regime, l11TouchedPhase, l11Uphi, l11Rh, l11Rg, l11Rzm, l11Riso],
  );

  const tnEarthingStateMemo = useMemo(() => {
    if (lesson.id !== 12) return undefined;
    const v = lesson12Full;
    return {
      scenario: l12Scenario,
      UphiV: variantNumeric(v, 'UphiV', 220),
      ZnOhm: variantNumeric(v, 'ZnOhm', 1),
      ZHOhm: variantNumeric(v, 'ZHOhm', 1),
      R0Ohm: l12R0,
      RnOhm: variantNumeric(v, 'RnOhm', 4),
      RzmOhm: variantNumeric(v, 'RzmOhm', 100),
      RhOhm: l12Rh,
    };
  }, [lesson.id, lesson12Full, l12Scenario, l12Rh, l12R0]);

  const fireSafetyStateMemo = useMemo(() => {
    if (lesson.id !== 13) return undefined;
    const v = lesson13Full;
    const lvj = String(v.lvj ?? 'Этанол');
    const t3 = lesson13Table3Variants[lesson13Table3ActiveColumn(lvj)].values;
    const t3rec = t3 as Record<string, string | number>;
    return {
      lvjName: lvj,
      eta: variantNumeric(v, 'eta', 1),
      V_m3: variantNumeric(v, 'V_m3', 50),
      G_kgm3: variantNumeric(v, 'G_kgm3', 1),
      Vsv_m3: variantNumeric(v, 'Vsv_m3', 100),
      SA_m2: variantNumeric(v, 'SA_m2', 50),
      KH: variantNumeric(v, 'KH', 1),
      t_evap_h: variantNumeric(v, 't_h', 1),
      rhoP: variantNumeric(t3rec, 'l13_rho', 2),
      Cnkr: variantNumeric(t3rec, 'l13_Cnkn', 2),
      Pmax: variantNumeric(t3rec, 'l13_Pmax', 800),
      PH: variantNumeric(t3rec, 'l13_PH', 10),
      M: variantNumeric(t3rec, 'l13_M', 46),
      sparkOn: lesson13SparkOn,
    };
  }, [lesson.id, lesson13Full, lesson13SparkOn]);

  const firstAidElectricStateMemo = useMemo(() => {
    if (lesson.id !== 14) return undefined;
    return { stage: l14FirstAidStage };
  }, [lesson.id, l14FirstAidStage]);

  const accidentInvestigationStateMemo = useMemo(() => {
    if (lesson.id !== 15) return undefined;
    return { stage: l15InvestigationStage, severity: l15Severity };
  }, [lesson.id, l15InvestigationStage, l15Severity]);

  const lesson13FirePanelMetrics = useMemo(() => {
    if (!fireSafetyStateMemo) return null;
    return lesson13FireLabMetrics({
      lvjName: fireSafetyStateMemo.lvjName,
      eta: fireSafetyStateMemo.eta,
      V_m3: fireSafetyStateMemo.V_m3,
      G_kgm3: fireSafetyStateMemo.G_kgm3,
      Vsv_m3: fireSafetyStateMemo.Vsv_m3,
      SA_m2: fireSafetyStateMemo.SA_m2,
      KH: fireSafetyStateMemo.KH,
      t_evap_h: fireSafetyStateMemo.t_evap_h,
      rhoP: fireSafetyStateMemo.rhoP,
      Cnkr: fireSafetyStateMemo.Cnkr,
      Pmax: fireSafetyStateMemo.Pmax,
      PH: fireSafetyStateMemo.PH,
      M: fireSafetyStateMemo.M,
    });
  }, [fireSafetyStateMemo]);

  const lesson12LabMetrics = useMemo(() => {
    if (lesson.id !== 12 || !tnEarthingStateMemo) return null;
    return lesson12TnLabEstimate(tnEarthingStateMemo);
  }, [lesson.id, tnEarthingStateMemo]);

  return (
    <Stack spacing={2}>
      <Paper id="lab-variant" variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Шаг 0. Вариант студента</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
          Если включить «учебный режим» (чекбокс ниже), значения можно будет менять вручную, даже несмотря на выбранный вариант.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <TextField
            size="small"
            label="Последние цифры студбилета"
            value={ticketInput}
            onChange={(event) => setTicketInput(event.target.value)}
          />
          <Button
            variant="contained"
            onClick={() => {
              const resolved = pickVariantByTicketDigits(lesson.id, ticketInput);
              const digits = ticketInput.replace(/\D/g, '');
              const pen = digits.length > 1 ? Number(digits[digits.length - 2]) : 0;
              setVariantNumber(resolved.variant);
              if (lesson.id === 2) {
                setLesson2Penultimate(pen);
              }
              if (lesson.id === 4) {
                setLesson4Penultimate(pen);
              }
              if (lesson.id === 6) {
                setLesson6Penultimate(pen);
              }
              if (lesson.id === 7) {
                setLesson7Penultimate(pen);
              }
              if (lesson.id === 8) {
                setLesson8Penultimate(pen);
              }
              if (lesson.id === 12) {
                setLesson12Penultimate(pen);
              }
              if (lesson.id === 13) {
                setLesson13Penultimate(pen);
              }
              applyVariantValues(resolved.values);
            }}
          >
            Автоподстановка
          </Button>
          <Select
            size="small"
            value={variantNumber}
            onChange={(event) => {
              const nextVariant = lesson.variants.find((item) => item.variant === Number(event.target.value));
              setVariantNumber(Number(event.target.value));
              if (lesson.id === 2) {
                const merged = lesson2MergedValues(Number(event.target.value), lesson2Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 4) {
                const merged = lesson4MergedValues(Number(event.target.value), lesson4Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 6) {
                const merged = lesson6MergedValues(Number(event.target.value), lesson6Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 7) {
                const merged = lesson7MergedValues(Number(event.target.value), lesson7Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 8) {
                const merged = lesson8MergedValues(Number(event.target.value), lesson8Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 12) {
                const merged = lesson12MergedValues(Number(event.target.value), lesson12Penultimate);
                applyVariantValues(merged);
              } else if (lesson.id === 13) {
                const merged = lesson13MergedValues(Number(event.target.value), lesson13Penultimate);
                applyVariantValues(merged);
              } else if (nextVariant) {
                applyVariantValues(nextVariant.values);
              }
            }}
          >
            {lesson.variants.map((item) => (
              <MenuItem key={`variant-${item.variant}`} value={item.variant}>
                Вариант {item.variant}
              </MenuItem>
            ))}
          </Select>
          {lesson.id === 2 && (
            <Select
              size="small"
              value={lesson2Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson2Penultimate(pen);
                const merged = lesson2MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 220 }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <MenuItem key={d} value={d}>Предпоследняя цифра: {d} (Табл. 2.2)</MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 4 && (
            <Select
              size="small"
              value={lesson4Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson4Penultimate(pen);
                const merged = lesson4MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 240 }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <MenuItem key={d} value={d}>Предпоследняя цифра: {d} (Табл. 4.3)</MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 6 && (
            <Select
              size="small"
              value={lesson6Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson6Penultimate(pen);
                const merged = lesson6MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 240 }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <MenuItem key={d} value={d}>Предпоследняя цифра: {d} (Табл. 6.2)</MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 7 && (
            <Select
              size="small"
              value={lesson7Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson7Penultimate(pen);
                const merged = lesson7MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 240 }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <MenuItem key={d} value={d}>Предпоследняя цифра: {d} (Табл. 7.2)</MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 8 && (
            <Select
              size="small"
              value={lesson8Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson8Penultimate(pen);
                const merged = lesson8MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 240 }}
            >
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <MenuItem key={d} value={d}>Предпоследняя цифра: {d} (Табл. 8.3)</MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 12 && (
            <Select
              size="small"
              value={lesson12Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson12Penultimate(pen);
                const merged = lesson12MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 260 }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <MenuItem key={d} value={d}>
                  Предпоследняя цифра: {d} (Табл. 12.1 — грунт, ρ)
                </MenuItem>
              ))}
            </Select>
          )}
          {lesson.id === 13 && (
            <Select
              size="small"
              value={lesson13Penultimate}
              onChange={(event) => {
                const pen = Number(event.target.value);
                setLesson13Penultimate(pen);
                const merged = lesson13MergedValues(variantNumber, pen);
                applyVariantValues(merged);
              }}
              sx={{ minWidth: 260 }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <MenuItem key={d} value={d}>
                  Предпоследняя цифра: {d} (Табл. 13.2)
                </MenuItem>
              ))}
            </Select>
          )}
          <Button variant="outlined" onClick={() => setManualTableOpen(true)}>
            Показать таблицу методички
          </Button>
        </Stack>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Checkbox
              checked={trainingMode}
              onChange={(event) => setTrainingMode(event.target.checked)}
            />
          }
          label="Учебный режим: разрешить ручную правку значений"
        />
      </Paper>

      <Paper id="lab-wizard" variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Пошаговый wizard</Typography>
          <Typography variant="body2" color="text.secondary">
            Прогресс: {progressPercent}%
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={progressPercent} sx={{ mt: 1, mb: 1.5 }} />

        <Stepper activeStep={stepIndex} alternativeLabel>
          <Step>
            <StepLabel>Вариант</StepLabel>
          </Step>
          {lesson.labWizard.steps.map((step) => (
            <Step key={step.id}>
              <StepLabel>{step.type}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {stepIndex === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Перейдите к шагам лабораторной после подтверждения варианта.
          </Alert>
        ) : (
          <Paper id={`lab-step-${lesson.labWizard.steps[stepIndex - 1].id}`} variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1">{lesson.labWizard.steps[stepIndex - 1].title}</Typography>
            {(() => {
              const wtd = lesson.labWizard.steps[stepIndex - 1].whatToDo;
              return Array.isArray(wtd) ? (
                <Box sx={{ mt: 0.8 }}>
                  <Typography variant="body2">Что делаем:</Typography>
                  <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2.5, listStyleType: 'disc' }}>
                    {wtd.map((item, i) => (
                      <Typography component="li" variant="body2" key={i} sx={{ display: 'list-item', mt: i ? 0.5 : 0 }}>
                        {item}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 0.8 }}>
                  Что делаем: {wtd}
                </Typography>
              );
            })()}
            <Typography variant="body2" sx={{ mt: 0.8 }}>
              Почему: {lesson.labWizard.steps[stepIndex - 1].why}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.8 }}>
              В сцене: {lesson.labWizard.steps[stepIndex - 1].sceneAction}
            </Typography>
            <Alert severity="info" sx={{ mt: 1 }}>
              Подсказка: {lesson.labWizard.steps[stepIndex - 1].hint}
            </Alert>
          </Paper>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" disabled={stepIndex === 0} onClick={() => setStepIndex((prev) => prev - 1)}>
            Назад
          </Button>
          <Button
            variant="contained"
            disabled={stepIndex >= lesson.labWizard.steps.length}
            onClick={() => setStepIndex((prev) => Math.min(prev + 1, lesson.labWizard.steps.length))}
          >
            Далее
          </Button>
          <Button variant="contained" color="secondary" disabled={stepIndex === 0} onClick={addResultRow}>
            Зафиксировать результат шага
          </Button>
        </Stack>
      </Paper>

      <Suspense
        fallback={
          <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Paper>
        }
      >
        <LabScene3D
          lessonId={lesson.id}
          lightState={lightStateMemo}
          noiseState={noiseStateMemo}
          emiState={emiStateMemo}
          shieldState={shieldStateMemo}
          hfState={hfStateMemo}
          uhfState={uhfStateMemo}
          bodyElecState={bodyElecStateMemo}
          groundState={groundStateMemo}
          threePhaseState={lesson.id === 11 ? threePhaseStateMemo : undefined}
          tnEarthingState={lesson.id === 12 ? tnEarthingStateMemo : undefined}
          fireSafetyState={lesson.id === 13 ? fireSafetyStateMemo : undefined}
          firstAidElectricState={lesson.id === 14 ? firstAidElectricStateMemo : undefined}
          accidentInvestigationState={lesson.id === 15 ? accidentInvestigationStateMemo : undefined}
        />
      </Suspense>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">
            Управление лабораторной сценой
          </Typography>
          {!trainingMode && (
            <Alert severity="info" icon={false} sx={{ py: 0, px: 1 }}>
              🔒 Вариант {variant.variant} — значения зафиксированы
            </Alert>
          )}
        </Stack>
        {!trainingMode && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Параметры установлены по варианту №{variant.variant}. Включите «Учебный режим» для свободной настройки.
          </Alert>
        )}

        {lesson.id === 1 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Исследование освещённости</Typography>
            <Select size="small" value={lampType} onChange={(event) => setLampType(event.target.value as LampType)} disabled={!trainingMode}>
              <MenuItem value="incandescent">Лампа накаливания</MenuItem>
              <MenuItem value="fluorescent">Люминесцентная лампа</MenuItem>
              <MenuItem value="led">LED</MenuItem>
            </Select>
            <Typography variant="caption">Сила света I: {intensityCd.toFixed(0)} кд</Typography>
            <Slider value={intensityCd} min={200} max={2500} step={10} disabled={!trainingMode} onChange={(_, value) => setIntensityCd(value as number)} />
            <Typography variant="caption">Высота подвеса: {heightM.toFixed(2)} м</Typography>
            <Slider value={heightM} min={2.2} max={4.5} step={0.05} disabled={!trainingMode} onChange={(_, value) => setHeightM(value as number)} />
            <Typography variant="caption">Смещение датчика: {sensorOffsetM.toFixed(2)} м</Typography>
            <Slider value={sensorOffsetM} min={0} max={3} step={0.05} onChange={(_, value) => setSensorOffsetM(value as number)} />
            <Typography variant="caption">Коэффициент отражения: {reflectance.toFixed(2)}</Typography>
            <Slider value={reflectance} min={0} max={0.9} step={0.01} disabled={!trainingMode} onChange={(_, value) => setReflectance(value as number)} />
            <Typography variant="caption">Количество светильников: {luminaireCount}</Typography>
            <Slider value={luminaireCount} min={1} max={8} step={1} disabled={!trainingMode} onChange={(_, value) => setLuminaireCount(value as number)} />
            <Alert severity={lightingMetrics.eLux >= 300 ? 'success' : 'warning'}>
              Текущее E={lightingMetrics.eLux.toFixed(1)} лк, Eср={lightingMetrics.eAvg.toFixed(1)} лк
            </Alert>
          </Stack>
        )}

        {lesson.id === 2 && lesson2Calcs && (
          <Stack spacing={1.5}>
            <Typography variant="caption" fontWeight={600}>Исходные данные варианта</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>L (м)</TableCell><TableCell>{lesson2Calcs.L}</TableCell><TableCell>B (м)</TableCell><TableCell>{lesson2Calcs.B}</TableCell><TableCell>H (м)</TableCell><TableCell>{lesson2Calcs.H}</TableCell></TableRow>
                <TableRow><TableCell>Φл (лм)</TableCell><TableCell>{lesson2Calcs.PhiL}</TableCell><TableCell>Eн (лк)</TableCell><TableCell>{lesson2Calcs.En}</TableCell><TableCell>n (шт)</TableCell><TableCell>{lesson2Calcs.n}</TableCell></TableRow>
                {lesson2Calcs.hasTables && (
                  <TableRow><TableCell>Kз</TableCell><TableCell>{lesson2Calcs.Kz}</TableCell><TableCell>z</TableCell><TableCell>{lesson2Calcs.z}</TableCell><TableCell>Wм (Вт/м²)</TableCell><TableCell>{lesson2Calcs.Wm}</TableCell></TableRow>
                )}
                {lesson2Calcs.hasTables && (
                  <TableRow><TableCell>Sн (м²)</TableCell><TableCell>{lesson2Calcs.Sn}</TableCell><TableCell>η (%)</TableCell><TableCell>{lesson2Calcs.etaPct}</TableCell><TableCell>μ</TableCell><TableCell>{lesson2Calcs.mu}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {!lesson2Calcs.hasTables && (
              <Alert severity="warning">
                Выберите предпоследнюю цифру студбилета из таблицы 2.2, чтобы включить коэффициенты для расчёта всех трёх методов.
              </Alert>
            )}

            <Typography variant="caption" fontWeight={600}>Выбранная мощность светильника P: {lesson2LampPower} Вт</Typography>
            <Slider value={lesson2LampPower} min={20} max={120} step={5} onChange={(_, value) => setLesson2LampPower(value as number)} />

            <Typography variant="caption" fontWeight={600}>Метод 1 — Коэффициент использования светового потока</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>1) Φсв = 2 · Φл</TableCell><TableCell>{lesson2Calcs.PhiSv.toFixed(2)} лм</TableCell></TableRow>
                <TableRow><TableCell>2) N = (Eн · Sн · Kз · z · 100) / (Φсв · η)</TableCell><TableCell>{lesson2Calcs.N1 ?? '—'} светильников</TableCell></TableRow>
                <TableRow><TableCell>3) Φсв = (Eн · Sн · Kз · z · 100) / (N · η)</TableCell><TableCell>{lesson2Calcs.PhiSvRequired ?? '—'} лм</TableCell></TableRow>
                <TableRow><TableCell>4) Hp = H − 0,3</TableCell><TableCell>{lesson2Calcs.Hp.toFixed(3)} м</TableCell></TableRow>
                <TableRow sx={{ fontWeight: 700 }}>
                  <TableCell><strong>5) i = (L · B) / (Hp · (L + B))</strong></TableCell>
                  <TableCell><strong>{lesson2Calcs.i !== null ? lesson2Calcs.i.toFixed(3) : '—'}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography variant="caption" fontWeight={600}>Метод 2 — Удельная мощность светильника</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>P = произвольно выбранная мощность светильника</TableCell><TableCell>{lesson2Calcs.chosenPower} Вт</TableCell></TableRow>
                <TableRow><TableCell>W = 0,9 · Wм</TableCell><TableCell>{lesson2Calcs.calculatedLampPower.toFixed(3)} Вт/м²</TableCell></TableRow>
                <TableRow><TableCell>1) αкз = (1,3 / 1,5) · W</TableCell><TableCell>{lesson2Calcs.alphaKz.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>2) αz = (1,5 / 1,1) · αкз</TableCell><TableCell>{lesson2Calcs.alphaZ.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>3) αe = (400 / 100) · αz = K</TableCell><TableCell>{lesson2Calcs.correctionK.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>Wр = K · Wм</TableCell><TableCell>{lesson2Calcs.Wp.toFixed(3)} Вт/м²</TableCell></TableRow>
                <TableRow sx={{ fontWeight: 700 }}>
                  <TableCell><strong>N = (Wр · Sн) / (n · P)</strong></TableCell>
                  <TableCell><strong>{lesson2Calcs.N2 ?? '—'} светильников</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Alert severity={lesson2Calcs.lampFits ? 'success' : 'warning'}>
              Выбранный светильник {lesson2Calcs.lampFits ? 'подходит' : 'не подходит'}: P = {lesson2Calcs.chosenPower} Вт, расчетное W = {lesson2Calcs.calculatedLampPower.toFixed(3)}.
            </Alert>

            <Typography variant="caption" fontWeight={600}>Метод 3 — Светящиеся линии</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>P = произвольно выбранная мощность светильника</TableCell><TableCell>{lesson2Calcs.chosenPower} Вт</TableCell></TableRow>
                <TableRow><TableCell>H′ = H − 0,3</TableCell><TableCell>{lesson2Calcs.Hprime.toFixed(3)} м</TableCell></TableRow>
                <TableRow><TableCell>P′ = P / H′</TableCell><TableCell>{lesson2Calcs.Pprime?.toFixed(3) ?? '—'}</TableCell></TableRow>
                <TableRow><TableCell>L′ = L / H′</TableCell><TableCell>{lesson2Calcs.Lprime?.toFixed(3) ?? '—'}</TableCell></TableRow>
                <TableRow><TableCell>l = 0,5 · L′</TableCell><TableCell>{lesson2Calcs.lLine?.toFixed(3) ?? '—'} м</TableCell></TableRow>
                <TableRow>
                  <TableCell>Σe (из таблицы по P′, L′)</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={lesson2SigmaE}
                      onChange={(e) => setLesson2SigmaE(e.target.value)}
                      disabled={!trainingMode}
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                </TableRow>
                <TableRow><TableCell>Φ′л = (1000 · Eн · Kз · z) / (μ · Σe)</TableCell><TableCell>{lesson2Calcs.PhiLprime !== null ? `${lesson2Calcs.PhiLprime.toFixed(2)} лм` : '—'}</TableCell></TableRow>
                <TableRow><TableCell>N₁ = (Φ′л · Lл) / Φсв</TableCell><TableCell>{lesson2Calcs.N1row ?? '—'} светильников в линии</TableCell></TableRow>
                <TableRow sx={{ fontWeight: 700 }}>
                  <TableCell><strong>N = N₁ · 2</strong></TableCell>
                  <TableCell><strong>{lesson2Calcs.Ntotal ?? '—'} светильников всего</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Alert severity="info">
              В методичке для этой схемы двух светящихся линий сумма условных освещенностей принимается Σe = 42.84. Это табличное значение после выбора P′ и L′, а не новая формула.
            </Alert>

            {lesson2Calcs.hasTables && (
              <Alert severity={lesson2Calcs.N1 !== null ? 'success' : 'info'}>
                Метод 1: N₁ = {lesson2Calcs.N1 ?? '?'} св. &nbsp;|&nbsp;
                Метод 2: N₂ = {lesson2Calcs.N2 ?? '?'} св. &nbsp;|&nbsp;
                Метод 3: N = {lesson2Calcs.Ntotal ?? '?'} св.
              </Alert>
            )}
          </Stack>
        )}

        {lesson.id === 3 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Исследование интенсивности шума</Typography>
            <FormControlLabel control={<Checkbox checked={sourceAOn} onChange={(event) => setSourceAOn(event.target.checked)} />} label="Источник A (станок)" />
            <Typography variant="caption">Уровень A: {sourceA} дБ</Typography>
            <Slider value={sourceA} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceA(value as number)} />
            <FormControlLabel control={<Checkbox checked={sourceBOn} onChange={(event) => setSourceBOn(event.target.checked)} />} label="Источник B (станок)" />
            <Typography variant="caption">Уровень B: {sourceB} дБ</Typography>
            <Slider value={sourceB} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceB(value as number)} />
            <FormControlLabel control={<Checkbox checked={sourceCOn} onChange={(event) => setSourceCOn(event.target.checked)} />} label="Источник C (компрессор)" />
            <Typography variant="caption">Уровень C: {sourceC} дБ</Typography>
            <Slider value={sourceC} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceC(value as number)} />
            <Typography variant="caption">Масса преграды G: {barrierMassA.toFixed(0)} кг/м²</Typography>
            <Slider
              value={barrierMassA}
              min={30}
              max={500}
              step={5}
              disabled={!trainingMode}
              onChange={(_, value) => {
                const next = value as number;
                setBarrierMassA(next);
                setBarrierMassB(next);
                setBarrierMassC(next);
              }}
            />
            <Typography variant="caption">Положение наблюдателя X: {observerX.toFixed(1)} м</Typography>
            <Slider value={observerX} min={1.5} max={7} step={0.1} onChange={(_, value) => setObserverX(value as number)} />
            <Alert severity={noiseMetrics.total <= 80 ? 'success' : 'warning'}>
              Итоговый уровень LΣ={noiseMetrics.total.toFixed(1)} дБ
            </Alert>
          </Stack>
        )}

        {lesson.id === 4 && lesson4Calcs && (
          <Stack spacing={1.5}>
            <Typography variant="caption" fontWeight={600}>Расчёт допустимого шума на рабочем месте</Typography>
            <Alert severity="info">
              Для этой работы используются обе цифры студбилета: последняя задаёт три источника и преграды, предпоследняя — параметры помещения для формулы 4.6.
            </Alert>

            <Typography variant="caption" fontWeight={600}>Параметры трёх источников шума</Typography>

            <FormControlLabel control={<Checkbox checked={sourceAOn} onChange={(event) => setSourceAOn(event.target.checked)} />} label="Источник 1" />
            <Typography variant="caption">L1,1 = {sourceA} дБ</Typography>
            <Slider value={sourceA} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceA(value as number)} />
            <Typography variant="caption">R1 = {Math.abs(observerX - sourceAX).toFixed(1)} м</Typography>
            <Slider value={Math.abs(observerX - sourceAX)} min={1} max={10} step={0.1} disabled={!trainingMode} onChange={(_, value) => setSourceAX(observerX - (value as number))} />
            <Typography variant="caption">G1 = {barrierMassA.toFixed(0)} кг/м²</Typography>
            <Slider value={barrierMassA} min={8} max={950} step={1} disabled={!trainingMode} onChange={(_, value) => setBarrierMassA(value as number)} />

            <FormControlLabel control={<Checkbox checked={sourceBOn} onChange={(event) => setSourceBOn(event.target.checked)} />} label="Источник 2" />
            <Typography variant="caption">L1,2 = {sourceB} дБ</Typography>
            <Slider value={sourceB} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceB(value as number)} />
            <Typography variant="caption">R2 = {Math.abs(observerX - sourceBX).toFixed(1)} м</Typography>
            <Slider value={Math.abs(observerX - sourceBX)} min={1} max={10} step={0.1} disabled={!trainingMode} onChange={(_, value) => setSourceBX(observerX - (value as number))} />
            <Typography variant="caption">G2 = {barrierMassB.toFixed(0)} кг/м²</Typography>
            <Slider value={barrierMassB} min={8} max={950} step={1} disabled={!trainingMode} onChange={(_, value) => setBarrierMassB(value as number)} />

            <FormControlLabel control={<Checkbox checked={sourceCOn} onChange={(event) => setSourceCOn(event.target.checked)} />} label="Источник 3" />
            <Typography variant="caption">L1,3 = {sourceC} дБ</Typography>
            <Slider value={sourceC} min={70} max={125} step={1} disabled={!trainingMode} onChange={(_, value) => setSourceC(value as number)} />
            <Typography variant="caption">R3 = {Math.abs(observerX - sourceCX).toFixed(1)} м</Typography>
            <Slider value={Math.abs(observerX - sourceCX)} min={1} max={10} step={0.1} disabled={!trainingMode} onChange={(_, value) => setSourceCX(observerX - (value as number))} />
            <Typography variant="caption">G3 = {barrierMassC.toFixed(0)} кг/м²</Typography>
            <Slider value={barrierMassC} min={8} max={950} step={1} disabled={!trainingMode} onChange={(_, value) => setBarrierMassC(value as number)} />

            <Typography variant="caption">Положение рабочей точки X: {observerX.toFixed(1)} м</Typography>
            <Slider value={observerX} min={1.5} max={7} step={0.1} onChange={(_, value) => setObserverX(value as number)} />

            <Typography variant="caption" fontWeight={600}>Шаг 1–3. Отдельный расчёт для каждого источника</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Источник</TableCell>
                  <TableCell>L1, дБ</TableCell>
                  <TableCell>R, м</TableCell>
                  <TableCell>LR, дБ</TableCell>
                  <TableCell>G, кг/м²</TableCell>
                  <TableCell>N, дБ</TableCell>
                  <TableCell>L′R, дБ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lesson4Calcs.perSource.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>{source.label}</TableCell>
                    <TableCell>{source.levelAt1mDb}</TableCell>
                    <TableCell>{source.distanceM.toFixed(2)}</TableCell>
                    <TableCell>{source.LR !== null ? source.LR.toFixed(3) : '—'}</TableCell>
                    <TableCell>{source.barrierMass}</TableCell>
                    <TableCell>{source.barrierReduction !== null ? source.barrierReduction.toFixed(3) : '—'}</TableCell>
                    <TableCell>{source.LRp !== null ? source.LRp.toFixed(3) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {(lesson4Calcs.pairAB || lesson4Calcs.pairABC) && (
              <>
                <Typography variant="caption" fontWeight={600}>Шаг 4. Последовательное суммирование по таблице 4.4</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Пара</TableCell>
                      <TableCell>L_A = L′Rmax − L′Rmin</TableCell>
                      <TableCell>ΔL</TableCell>
                      <TableCell>LΣ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lesson4Calcs.pairAB && (
                      <TableRow>
                        <TableCell>{lesson4Calcs.pairAB.leftLabel} + {lesson4Calcs.pairAB.rightLabel}</TableCell>
                        <TableCell>{lesson4Calcs.pairAB.diff.toFixed(3)}</TableCell>
                        <TableCell>{lesson4Calcs.pairAB.delta.toFixed(3)}</TableCell>
                        <TableCell>{lesson4Calcs.pairAB.sum.toFixed(3)}</TableCell>
                      </TableRow>
                    )}
                    {lesson4Calcs.pairABC && (
                      <TableRow>
                        <TableCell>{lesson4Calcs.pairABC.leftLabel} + {lesson4Calcs.pairABC.rightLabel}</TableCell>
                        <TableCell>{lesson4Calcs.pairABC.diff.toFixed(3)}</TableCell>
                        <TableCell>{lesson4Calcs.pairABC.delta.toFixed(3)}</TableCell>
                        <TableCell>{lesson4Calcs.pairABC.sum.toFixed(3)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}

            <Typography variant="caption" fontWeight={600}>Формулы 4.6–4.8. Звукопоглощение помещения</Typography>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell>Sпт</TableCell><TableCell>{lesson4Calcs.room.Spt}</TableCell><TableCell>Sс</TableCell><TableCell>{lesson4Calcs.room.Sc}</TableCell></TableRow>
                <TableRow><TableCell>α1</TableCell><TableCell>{lesson4Calcs.room.alpha1.toFixed(3)}</TableCell><TableCell>β1</TableCell><TableCell>{lesson4Calcs.room.beta1.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>α2</TableCell><TableCell>{lesson4Calcs.room.alpha2.toFixed(3)}</TableCell><TableCell>β2</TableCell><TableCell>{lesson4Calcs.room.beta2.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>γ</TableCell><TableCell>{lesson4Calcs.room.gamma.toFixed(3)}</TableCell><TableCell>M1</TableCell><TableCell>{lesson4Calcs.M1.toFixed(3)}</TableCell></TableRow>
                <TableRow><TableCell>M2</TableCell><TableCell>{lesson4Calcs.M2.toFixed(3)}</TableCell><TableCell>K = 10 · lg(M2 / M1)</TableCell><TableCell>{lesson4Calcs.coveringReduction.toFixed(3)} дБ</TableCell></TableRow>
                <TableRow sx={{ fontWeight: 700 }}>
                  <TableCell><strong>L′Σ = LΣ − K</strong></TableCell>
                  <TableCell><strong>{lesson4Calcs.totalAfterTreatment.toFixed(3)} дБ</strong></TableCell>
                  <TableCell><strong>LΣ до обработки</strong></TableCell>
                  <TableCell><strong>{lesson4Calcs.totalWithBarrier.toFixed(3)} дБ</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Alert severity="info">
              fсг относится к октавным полосам и общей теории шума. В числовой алгоритм этой лабораторной величина fсг не входит, поэтому здесь она оставлена только как пояснение, а не как шаг расчёта.
            </Alert>
            <Alert severity={lesson4Calcs.totalAfterTreatment <= 80 ? 'success' : 'warning'}>
              Итог: LΣ = {lesson4Calcs.totalWithBarrier.toFixed(1)} дБ до акустической обработки и L′Σ = {lesson4Calcs.totalAfterTreatment.toFixed(1)} дБ после неё.
            </Alert>
          </Stack>
        )}

        {lesson.id === 5 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Расчёт ЭМИ и экранировка</Typography>
            <Typography variant="caption">Частота: {(frequencyHz / 1e6).toFixed(2)} МГц</Typography>
            <Slider value={frequencyHz / 1e6} min={0.1} max={900} step={0.1} disabled={!trainingMode} onChange={(_, value) => setFrequencyHz((value as number) * 1e6)} />
            <Typography variant="caption">Расстояние r: {distanceM.toFixed(2)} м</Typography>
            <Slider value={distanceM} min={0.05} max={15} step={0.01} onChange={(_, value) => setDistanceM(value as number)} />
            <Typography variant="caption">E: {eVpm.toFixed(2)} В/м</Typography>
            <Slider value={eVpm} min={0} max={200} step={0.2} disabled={!trainingMode} onChange={(_, value) => setEVpm(value as number)} />
            <Typography variant="caption">H: {hApm.toFixed(3)} А/м</Typography>
            <Slider value={hApm} min={0} max={4} step={0.01} disabled={!trainingMode} onChange={(_, value) => setHApm(value as number)} />
            <Alert severity={emiMetrics.ppe <= 10 ? 'success' : 'warning'}>
              λ={emiMetrics.lambda.toExponential(2)} м; ППЭ={emiMetrics.ppe.toFixed(3)} Вт/м²; зона={emiMetrics.zone}
            </Alert>
          </Stack>
        )}

        {/* ── Lesson 6: Shield calc controls ── */}
        {lesson.id === 6 && lesson6Calcs && (
          <Stack spacing={1}>
            <Typography variant="caption" fontWeight={600}>Параметры экрана ЭМИ (последовательная проверка)</Typography>
            <Alert severity="info">
              Шаг 1: βm = {lesson6Calcs.betaM.toFixed(2)}
            </Alert>
            <Alert severity={lesson6Calcs.PPE <= lesson6Calcs.PPEmax ? 'success' : 'warning'}>
              Ф. 6.1: H = {lesson6Calcs.H.toFixed(4)} А/м; Ф. 6.4: ППЭδ = {lesson6Calcs.PPE.toFixed(6)} Вт/м²
            </Alert>
            <Alert severity="info">
              Ф. 6.5: ППЭδдоп = {lesson6Calcs.PPEmax.toFixed(6)} Вт/м²; Ф. 6.6: L = {lesson6Calcs.L.toFixed(3)}
            </Alert>
            <Alert severity="success">
              Ф. 6.7: M = {(lesson6Calcs.M * 1000).toFixed(3)} мм; Ф. 6.10: α = {lesson6Calcs.alpha.toFixed(3)} дБ/м; Ф. 6.11: l = {(lesson6Calcs.wgLen * 1000).toFixed(1)} мм
            </Alert>
          </Stack>
        )}

        {/* ── Lesson 7: HF field controls ── */}
        {lesson.id === 7 && lesson7Calcs && (
          <Stack spacing={1}>
            <Typography variant="caption" fontWeight={600}>Расчёт E по Шулейкину–Ван-дер-Полю</Typography>
            <Typography variant="caption">Диапазон: {lesson7Calcs.band}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>d (м)</TableCell>
                  <TableCell>x</TableCell>
                  <TableCell>F</TableCell>
                  <TableCell>E (В/м)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lesson7Calcs.results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.d}</TableCell>
                    <TableCell>{r.x.toFixed(4)}</TableCell>
                    <TableCell>{r.F.toFixed(4)}</TableCell>
                    <TableCell>{r.E.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}

        {/* ── Lesson 8: UHF field controls ── */}
        {lesson.id === 8 && lesson8Calcs && (
          <Stack spacing={1}>
            <Typography variant="caption" fontWeight={600}>Расчёт E для УВЧ-передатчика</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>r (м)</TableCell>
                  <TableCell>R (м)</TableCell>
                  <TableCell>F(Δ)</TableCell>
                  <TableCell>E_из (В/м)</TableCell>
                  <TableCell>E_зв (В/м)</TableCell>
                  <TableCell>E_сум (В/м)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lesson8Calcs.results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.r}</TableCell>
                    <TableCell>{r.R.toFixed(1)}</TableCell>
                    <TableCell>{r.Fd.toFixed(4)}</TableCell>
                    <TableCell>{r.Eimg.toFixed(3)}</TableCell>
                    <TableCell>{r.Esnd.toFixed(3)}</TableCell>
                    <TableCell>{r.Etotal.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}

        {/* ── Lesson 9: Body impedance controls ── */}
        {lesson.id === 9 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Параметры сопротивления тела</Typography>
            <Typography variant="caption">U (В): {l9Voltage}</Typography>
            <Slider value={l9Voltage} min={12} max={380} step={1} disabled={!trainingMode} onChange={(_, v) => setL9Voltage(v as number)} />
            <Typography variant="caption">f (Гц): {l9Freq}</Typography>
            <Slider value={l9Freq} min={1} max={1000} step={1} onChange={(_, v) => setL9Freq(v as number)} />
            <Typography variant="caption">Rн (Ом): {l9Rn}</Typography>
            <Slider value={l9Rn} min={100} max={20000} step={100} onChange={(_, v) => setL9Rn(v as number)} />
            <Typography variant="caption">C (нФ): {l9C}</Typography>
            <Slider value={l9C} min={1} max={100} step={1} onChange={(_, v) => setL9C(v as number)} />
            <Typography variant="caption">Rв (Ом): {l9Rv}</Typography>
            <Slider value={l9Rv} min={100} max={1500} step={50} onChange={(_, v) => setL9Rv(v as number)} />
            <Typography variant="caption">t (с): {l9TimeS.toFixed(1)}</Typography>
            <Slider value={l9TimeS} min={0.1} max={5} step={0.1} onChange={(_, v) => setL9TimeS(v as number)} />
            <Typography variant="caption" fontWeight={600}>Тип прикосновения</Typography>
            <Select size="small" value={l9TouchType} onChange={(e) => setL9TouchType(e.target.value as 'unipolar' | 'bipolar' | 'multipolar')}>
              <MenuItem value="unipolar">Однополюсное (одна рука)</MenuItem>
              <MenuItem value="bipolar">Двухполюсное (две руки)</MenuItem>
              <MenuItem value="multipolar">Многополюсное</MenuItem>
            </Select>
            <Typography variant="caption" fontWeight={600}>Повреждённые фазы</Typography>
            <Select size="small" value={`${l9DamagedPhases[0]}-${l9DamagedPhases[1]}`} onChange={(e) => {
              const [a, b] = (e.target.value as string).split('-');
              setL9DamagedPhases([a, b]);
            }}>
              <MenuItem value="A-B">Фаза А ↔ Фаза Б</MenuItem>
              <MenuItem value="A-C">Фаза А ↔ Фаза С</MenuItem>
              <MenuItem value="B-C">Фаза Б ↔ Фаза С</MenuItem>
            </Select>
            {lesson9Calcs && (
              <Alert severity={lesson9Calcs.ImA < 10 ? 'success' : 'error'}>
                Zн = {lesson9Calcs.Zn.toFixed(0)} Ом; Z = {lesson9Calcs.Z.toFixed(0)} Ом; I = {lesson9Calcs.ImA.toFixed(2)} мА — {lesson9Calcs.danger}
              </Alert>
            )}
          </Stack>
        )}

        {/* ── Lesson 10: Step voltage controls ── */}
        {lesson.id === 10 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Шаговое напряжение</Typography>
            <Typography variant="caption">Iз (А): {l10Iz}</Typography>
            <Slider value={l10Iz} min={0.5} max={50} step={0.5} disabled={!trainingMode} onChange={(_, v) => setL10Iz(v as number)} />
            <Typography variant="caption">ρ (Ом·м): {l10Rho}</Typography>
            <Slider value={l10Rho} min={10} max={500} step={10} onChange={(_, v) => setL10Rho(v as number)} />
            <Typography variant="caption">x (м): {l10X}</Typography>
            <Slider value={l10X} min={1} max={30} step={0.5} onChange={(_, v) => setL10X(v as number)} />
            <Typography variant="caption">a (м): {l10A}</Typography>
            <Slider value={l10A} min={0.3} max={1.5} step={0.1} onChange={(_, v) => setL10A(v as number)} />
            <Typography variant="caption" fontWeight={600}>Тип поверхности</Typography>
            <Select size="small" value={l10Surface} onChange={(e) => {
              const surface = e.target.value as 'earth' | 'sand' | 'stone';
              setL10Surface(surface);
              /* Adjust soil resistivity based on surface */
              if (surface === 'sand') setL10Rho(300);
              else if (surface === 'stone') setL10Rho(500);
              else setL10Rho(100);
            }}>
              <MenuItem value="earth">Земля (ρ ≈ 100 Ом·м)</MenuItem>
              <MenuItem value="sand">Песок (ρ ≈ 300 Ом·м)</MenuItem>
              <MenuItem value="stone">Камень (ρ ≈ 500 Ом·м)</MenuItem>
            </Select>
            {lesson10Calcs && (
              <Alert severity={lesson10Calcs.Ush < 36 ? 'success' : 'error'}>
                φ(x) = {lesson10Calcs.phi.toFixed(2)} В; Uш = {lesson10Calcs.Ush.toFixed(2)} В {lesson10Calcs.Ush >= 36 ? '⚠ ОПАСНО' : '✓ безопасно'}
              </Alert>
            )}
          </Stack>
        )}

        {lesson.id === 11 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>Трёхфазная сеть и касание фазы</Typography>
            <Typography variant="caption">Система</Typography>
            <Select
              size="small"
              value={l11Network}
              disabled={!trainingMode}
              onChange={(e) => {
                const n = e.target.value as 'IT' | 'TN';
                setL11Network(n);
                if (n === 'IT') setL11Regime('normal');
              }}
            >
              <MenuItem value="IT">ИТ — изолированная нейтраль</MenuItem>
              <MenuItem value="TN">TN — заземлённая нейтраль</MenuItem>
            </Select>
            <Typography variant="caption">Режим (TN)</Typography>
            <Select
              size="small"
              value={l11Regime}
              disabled={!trainingMode || l11Network === 'IT'}
              onChange={(e) => setL11Regime(e.target.value as 'normal' | 'emergency')}
            >
              <MenuItem value="normal">Нормальный</MenuItem>
              <MenuItem value="emergency">Аварийный: КЗ фазы L1 на землю</MenuItem>
            </Select>
            <Typography variant="caption">Касаемая фаза</Typography>
            <Select
              size="small"
              value={l11TouchedPhase}
              disabled={!trainingMode}
              onChange={(e) => setL11TouchedPhase(Number(e.target.value))}
            >
              <MenuItem value={0}>L1</MenuItem>
              <MenuItem value={1}>L2</MenuItem>
              <MenuItem value={2}>L3</MenuItem>
            </Select>
            <Typography variant="caption">U_ф (В): {l11Uphi}</Typography>
            <Slider value={l11Uphi} min={127} max={254} step={1} disabled={!trainingMode} onChange={(_, v) => setL11Uphi(v as number)} />
            <Typography variant="caption">R_h (Ом): {l11Rh}</Typography>
            <Slider value={l11Rh} min={300} max={5000} step={50} onChange={(_, v) => setL11Rh(v as number)} />
            {l11Network === 'TN' && (
              <>
                <Typography variant="caption">R_з, сопротивление заземления нейтрали (Ом): {l11Rg}</Typography>
                <Slider value={l11Rg} min={1} max={80} step={1} disabled={!trainingMode} onChange={(_, v) => setL11Rg(v as number)} />
                {l11Regime === 'emergency' && (
                  <>
                    <Typography variant="caption">R_зм, контакт КЗ на землю (Ом): {l11Rzm}</Typography>
                    <Slider value={l11Rzm} min={1} max={80} step={1} disabled={!trainingMode} onChange={(_, v) => setL11Rzm(v as number)} />
                  </>
                )}
              </>
            )}
            {l11Network === 'IT' && (
              <>
                <Typography variant="caption">R_из, изоляция фазы относительно земли (Ом): {l11Riso}</Typography>
                <Slider value={l11Riso} min={500} max={20000} step={100} disabled={!trainingMode} onChange={(_, v) => setL11Riso(v as number)} />
              </>
            )}
            {lesson11Calcs && (
              <Alert severity={lesson11Calcs.ImA < 10 ? 'success' : 'error'}>
                Uпр ≈ {lesson11Calcs.UprV.toFixed(1)} В → I_h ≈ {lesson11Calcs.ImA.toFixed(2)} мА ({lesson11Calcs.dangerLabel})
              </Alert>
            )}
          </Stack>
        )}

        {lesson.id === 12 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>
              Занятие 12 — TN, зануление, обрыв нуля (модель по формулам 12.2–12.13)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Z_n, Z_H, R_n, R_зм и U_ф берутся из варианта (табл. 12.2); ρ и тип грунта — табл. 12.1.
            </Typography>
            <Typography variant="caption">Сценарий</Typography>
            <Select size="small" value={l12Scenario} onChange={(e) => setL12Scenario(e.target.value as Lesson12TnScenario)}>
              <MenuItem value="normal">Норма: корпус без опасного потенциала</MenuItem>
              <MenuItem value="sc_enclosure">КЗ на занулённый корпус (без повт. заземления нуля)</MenuItem>
              <MenuItem value="sc_enclosure_repeat">КЗ на корпус при повторном заземлении нуля</MenuItem>
              <MenuItem value="break_after_fault">Обрыв нуля: корпус за местом обрыва</MenuItem>
              <MenuItem value="break_before_ok">Обрыв нуля: корпус до обрыва (U ≈ 0)</MenuItem>
              <MenuItem value="break_after_repeat">Обрыв нуля + R_n: корпус за обрывом</MenuItem>
              <MenuItem value="break_before_repeat">Обрыв нуля + R_n: корпус до обрыва</MenuItem>
              <MenuItem value="phase_to_soil">Фаза на землю (напряжение на корпусе, 12.13)</MenuItem>
            </Select>
            <Typography variant="caption">R_h при касании корпуса (Ом): {l12Rh}</Typography>
            <Slider value={l12Rh} min={500} max={5000} step={50} onChange={(_, v) => setL12Rh(v as number)} />
            <Typography variant="caption">R_0 заземление нейтрали (Ом): {l12R0}</Typography>
            <Slider value={l12R0} min={1} max={20} step={0.5} disabled={!trainingMode} onChange={(_, v) => setL12R0(v as number)} />
            {lesson12LabMetrics && (
              <Alert
                severity={
                  lesson12LabMetrics.IbodyMA < 10 ? 'success' : lesson12LabMetrics.IbodyMA < 30 ? 'warning' : 'error'
                }
              >
                {lesson12LabMetrics.caption}
                <br />
                I_к.з. ≈ {lesson12LabMetrics.IkzA.toFixed(2)} А; U_корп ≈ {lesson12LabMetrics.UenclosureV.toFixed(1)} В; I_h ≈{' '}
                {lesson12LabMetrics.IbodyMA.toFixed(2)} мА
              </Alert>
            )}
          </Stack>
        )}

        {lesson.id === 13 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>
              Занятие 13 — паровоздушная смесь и расчётное давление (формулы 13.1–13.6)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Табл. 13.1 задаётся последней цифрой билета, табл. 13.2 (включая Vсв) — предпоследней; при смене только «Вариант 0–9» Vсв не меняется, пока не смените предпоследнюю цифру в шаге 0. 3D-сцена — условный зал постоянного размера, меняются расчёты и вид пара. Искра — источник зажигания у пролива.
            </Typography>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={lesson13SparkOn}
                  onChange={(e) => setLesson13SparkOn(e.target.checked)}
                />
              )}
              label="Искра у пролива (источник воспламенения)"
            />
            {lesson13FirePanelMetrics && (
              <Alert
                severity={
                  lesson13FirePanelMetrics.aboveNkp && lesson13SparkOn
                    ? 'error'
                    : lesson13FirePanelMetrics.aboveNkp
                      ? 'warning'
                      : 'success'
                }
              >
                C ≈ {lesson13FirePanelMetrics.C_pct.toFixed(2)} % при НКПР {lesson13FirePanelMetrics.Cnkr_pct.toFixed(1)} % (
                {lesson13FirePanelMetrics.aboveNkp ? 'смесь воспламеняемая' : 'ниже НКПР в модели'}). ΔP ≈{' '}
                {lesson13FirePanelMetrics.deltaP_kPa.toFixed(2)} кПа; категория А по расчётному ΔP (&gt; 5 кПа):{' '}
                {lesson13FirePanelMetrics.roomCategoryAExplosive ? 'да' : 'нет'}.
              </Alert>
            )}
          </Stack>
        )}

        {lesson.id === 14 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>
              Занятие 14 — первая помощь при поражении электрическим током (схема)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Выберите этап доврачебной помощи. Сцена наглядная и не привязана к таблицам варианта.
            </Typography>
            <Select
              size="small"
              value={l14FirstAidStage}
              onChange={(e) => setL14FirstAidStage(e.target.value as FirstAidElectricStage)}
            >
              <MenuItem value="disconnect">1. Освобождение от тока (сухой изолятор)</MenuItem>
              <MenuItem value="airway">2. Проходимость дыхательных путей</MenuItem>
              <MenuItem value="breaths">3. Искусственное дыхание</MenuItem>
              <MenuItem value="cpr">4. Непрямой массаж сердца (один помощник)</MenuItem>
            </Select>
          </Stack>
        )}

        {lesson.id === 15 && (
          <Stack spacing={1.2}>
            <Typography variant="caption" fontWeight={600}>
              Занятие 15 — расследование несчастных случаев (схема)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Выберите шаг расследования и тяжесть случая — в 3D-сцене подсветится этап и срок (3/15 дней).
            </Typography>
            <Select size="small" value={l15Severity} onChange={(e) => setL15Severity(e.target.value as 'light' | 'heavyOrFatal')}>
              <MenuItem value="light">Лёгкий несчастный случай</MenuItem>
              <MenuItem value="heavyOrFatal">Тяжёлый / со смертельным исходом</MenuItem>
            </Select>
            <Select
              size="small"
              value={l15InvestigationStage}
              onChange={(e) =>
                setL15InvestigationStage(
                  e.target.value as 'firstAid' | 'preventHazard' | 'preserveScene' | 'notify' | 'commission' | 'investigation' | 'report',
                )
              }
            >
              <MenuItem value="firstAid">1. Первая помощь</MenuItem>
              <MenuItem value="preventHazard">2. Предотвращение опасности</MenuItem>
              <MenuItem value="preserveScene">3. Фиксация обстановки</MenuItem>
              <MenuItem value="notify">4. Уведомления</MenuItem>
              <MenuItem value="commission">5. Комиссия</MenuItem>
              <MenuItem value="investigation">6. Материалы расследования</MenuItem>
              <MenuItem value="report">7. Итоги и акты</MenuItem>
            </Select>
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Таблица результатов
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Шаг</TableCell>
              <TableCell>Параметр</TableCell>
              <TableCell>Значение</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resultRows.map((row, index) => (
              <TableRow key={`result-${index}`}>
                <TableCell>{row.step}</TableCell>
                <TableCell>{row.metric}</TableCell>
                <TableCell>{row.value}</TableCell>
              </TableRow>
            ))}
            {resultRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary">
                    Пока нет сохраненных строк.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Финальный отчет</Typography>
        <TextField multiline minRows={8} value={reportText} fullWidth sx={{ mt: 1 }} />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button variant="contained" onClick={copyReport}>
            Экспорт/копировать в буфер
          </Button>
          <Alert severity="info" sx={{ flex: 1 }}>
            {lesson.labWizard.reportConclusionHint}
          </Alert>
        </Stack>
      </Paper>

      <Dialog
        open={manualTableOpen}
        onClose={() => setManualTableOpen(false)}
        maxWidth={
          lesson.id === 4 || lesson.id === 6 || lesson.id === 7 || lesson.id === 8 || lesson.id === 12 || lesson.id === 13
            ? 'xl'
            : 'md'
        }
        fullWidth
      >
        <DialogTitle>
          {lesson.id === 4
            ? 'Таблицы 4.1–4.4 — Исходные данные (Занятие №4)'
            : lesson.labWizard.manualTableName}
        </DialogTitle>
        <DialogContent
          sx={
            lesson.id === 6 || lesson.id === 7 || lesson.id === 8 || lesson.id === 12 || lesson.id === 13
              ? { overflowX: 'hidden' }
              : undefined
          }
        >
          {lesson.id === 4 ? (
            <Lab4TablesPanel lastDigit={variantNumber} penultimateDigit={lesson4Penultimate} />
          ) : lesson.id === 6 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 6.1 — по последней цифре студбилета
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 6.2 — по предпоследней цифре (ваша: <strong>{lesson6Penultimate}</strong>)
              </Typography>
              <VariantTable variants={lesson6Table2Variants} activeVariant={lesson6Penultimate} />
            </Stack>
          ) : lesson.id === 7 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 7.1 — по последней цифре студбилета
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 7.2 — по предпоследней цифре (ваша: <strong>{lesson7Penultimate}</strong>)
              </Typography>
              <VariantTable variants={lesson7Table2Variants} activeVariant={lesson7Penultimate} />
            </Stack>
          ) : lesson.id === 8 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 8.2 — по последней цифре студбилета
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 8.3 — по предпоследней цифре (ваша: <strong>{lesson8Penultimate}</strong>)
              </Typography>
              <VariantTable variants={lesson8Table3Variants} activeVariant={lesson8Penultimate} />
            </Stack>
          ) : lesson.id === 12 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 12.1 — по предпоследней цифре (ваша: <strong>{lesson12Penultimate}</strong>)
              </Typography>
              <VariantTable variants={lesson12Table1Variants} activeVariant={lesson12Penultimate} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 12.2 — по последней цифре студбилета
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
            </Stack>
          ) : lesson.id === 13 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 13.1 — по последней цифре студбилета (ваш вариант: <strong>{variantNumber}</strong>)
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 13.2 — по предпоследней цифре (ваша: <strong>{lesson13Penultimate}</strong>)
              </Typography>
              <VariantTable variants={lesson13Table2Variants} activeVariant={lesson13Penultimate} />
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 13.3 — показатели ЛВЖ (подсвечен столбец вашего ЛВЖ: <strong>{String(lesson13Full.lvj ?? '—')}</strong>)
              </Typography>
              <VariantTable
                variants={lesson13Table3Variants}
                activeVariant={lesson13Table3ActiveColumn(String(lesson13Full.lvj ?? ''))}
              />
            </Stack>
          ) : lesson.id === 2 ? (
            <Stack spacing={3}>
              <Typography variant="subtitle2" fontWeight={700}>
                Таблица 2.1 — по последней цифре студбилета
              </Typography>
              <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2 }}>
                Таблица 2.2 — по предпоследней цифре студбилета
                {' '}(ваша: <strong>{lesson2Penultimate}</strong>)
              </Typography>
              <Table size="small" component={Paper} variant="outlined">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>Параметр</TableCell>
                    {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                      <TableCell key={d} align="center" sx={{ fontWeight: d === lesson2Penultimate ? 700 : 400, bgcolor: d === lesson2Penultimate ? 'primary.light' : 'primary.main', color: 'primary.contrastText' }}>{d}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {([
                    ['Kз',        [0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.3,1.4],  ''],
                    ['z',         [1.00,1.02,1.04,1.06,1.07,1.08,1.09,1.10,1.12,1.13], ''],
                    ['Wм (Вт/м²)',[5.0,5.2,5.4,5.6,5.8,6.0,6.2,6.4,6.6,6.8],  ''],
                    ['Sн (м²)',   [200,210,220,230,240,250,260,270,280,280],     ''],
                    ['n (шт)',    [1,2,3,4,5,6,7,8,9,10],                        ''],
                    ['η (%)',     [45,45,45,45,45,45,45,45,45,45],               ''],
                    ['μ',        [1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2.0],   ''],
                  ] as [string, number[], string][]).map(([label, vals]) => (
                    <TableRow key={label} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
                      {vals.map((val, d) => (
                        <TableCell key={d} align="center"
                          sx={{ bgcolor: d === lesson2Penultimate ? 'action.selected' : undefined, fontWeight: d === lesson2Penultimate ? 700 : 400 }}
                        >
                          {d === lesson2Penultimate
                            ? <Chip size="small" label={String(val)} color="primary" variant="filled" />
                            : String(val)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : (
            <VariantTable variants={lesson.variants} activeVariant={variantNumber} />
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

