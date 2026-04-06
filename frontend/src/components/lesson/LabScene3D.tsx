import { useMemo, useRef, useState } from 'react';
import { Alert, Box, Chip, IconButton, Paper, Slider, Stack, Tooltip, Typography } from '@mui/material';
import { Billboard, Edges, OrbitControls, Text as DreiText } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import * as THREE from 'three';
import SafeCanvas from '../SafeCanvas';
import {
  barrierReductionDbFromMass,
  levelAfterBarrierDb,
  levelAtDistanceDb,
  sourceLevelAtObserver,
  sumLevelsEnergyDb,
  sumTwoLevelsByDeltaDb,
} from '../../formulas/noise';
import { classifyEmZone, wavelengthM } from '../../formulas/emi';
import { realisticIlluminanceLux } from '../../formulas/illumination';
import {
  angularFrequencyOmega,
  attenuationRatioL,
  powerFluxDensityFromH,
  shieldThicknessM,
  waveguideAttenuationPerM,
  waveguideLengthM,
  allowablePPE,
  magneticFieldStrengthH,
  absolutePermeability,
  electricFieldFromH,
} from '../../formulas/shielding';
import {
  fieldStrengthShuleikin,
  attenuationFactorF,
  classifyWaveBand,
  xParameterVariant1,
  xParameterFull,
} from '../../formulas/hfField';
import {
  fieldStrengthUHF,
  distanceFromPhaseCenter,
  elevationAngleRad,
  normalizedPatternFactorFromR,
} from '../../formulas/uhfField';
import {
  bodyCurrentMA,
  totalBodyImpedance,
  skinImpedance,
  classifyCurrentDanger,
  stepVoltage,
  groundPotential,
  safeDistance,
  lesson11TouchEstimate,
  lesson12TnLabEstimate,
  type Lesson12TnScenario,
} from '../../formulas/electricSafety';
import { lesson13FireLabMetrics, lesson13VaporVolumeM3 } from '../../formulas/fireSafety';
import FirstAidElectricLabScene from './FirstAidElectricLabScene';
import AccidentInvestigationLabScene from './AccidentInvestigationLabScene.tsx';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo';
import type { ComponentProps } from 'react';

/** Billboarded drei Text: always faces camera + strong outline for legibility */
function Text(props: ComponentProps<typeof DreiText>) {
  const { position: posIn, fontSize: fontSizeProp, ...rest } = props;
  const position: [number, number, number] = Array.isArray(posIn)
    ? [posIn[0], posIn[1], posIn[2]]
    : posIn && typeof posIn === 'object' && 'x' in posIn
      ? [posIn.x, posIn.y, posIn.z]
      : [0, 0, 0];
  const raw = (fontSizeProp as number | undefined) ?? 0.15;
  const size = Math.max(raw * 1.06, 0.11);
  return (
    <Billboard position={position} follow>
      <DreiText
        fontWeight={700}
        outlineWidth={size * 0.16}
        outlineColor="#141414"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0]}
        fontSize={size}
        {...rest}
      />
    </Billboard>
  );
}

type LampType = 'incandescent' | 'fluorescent' | 'led';

interface LabSceneProps {
  lessonId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  lightState: {
    lampType: LampType;
    intensityCd: number;
    heightM: number;
    sensorOffsetM: number;
    reflectance: number;
    luminaireCount: number;
    roomLengthM?: number;
    roomWidthM?: number;
    chosenLampPowerW?: number;
    lineOffsetM?: number;
    lineRows?: number;
  };
  noiseState: {
    sourceA: number;
    sourceB: number;
    sourceC: number;
    sourceAX: number;
    sourceBX: number;
    sourceCX: number;
    observerX: number;
    barrierMassA: number;
    barrierMassB: number;
    barrierMassC: number;
    sourceAOn: boolean;
    sourceBOn: boolean;
    sourceCOn: boolean;
  };
  emiState: {
    frequencyHz: number;
    distanceM: number;
    eVpm: number;
    hApm: number;
  };
  shieldState: {
    frequencyHz: number;
    turns: number;
    currentA: number;
    distanceM: number;
    coilRadiusM: number;
    conductivitySpm: number;
    muRelative: number;
    exposureTimeH: number;
    waveguideDiameterM: number;
    waveguideEpsilon: number;
  };
  hfState: {
    powerKW: number;
    gainAntenna: number;
    wavelengthM: number;
    theta: number;
    sigma: number;
    distances: number[];
  };
  uhfState: {
    /** Суммарная/запасная мощность (Вт); если заданы powerVideoW/powerAudioW, для формул берутся они */
    powerW: number;
    powerVideoW?: number;
    powerAudioW?: number;
    gain: number;
    heightM: number;
    distances: number[];
    frequencyMHz: number;
  };
  bodyElecState: {
    voltageV: number;
    frequencyHz: number;
    skinResistanceOhm: number;
    capacitanceNF: number;
    internalResistanceOhm: number;
    exposureTimeS?: number;
    touchType?: 'unipolar' | 'bipolar' | 'multipolar';
    damagedPhases?: [string, string];
  };
  groundState: {
    faultCurrentA: number;
    soilResistivityOhmM: number;
    distanceM: number;
    stepLengthM: number;
    surfaceType?: 'earth' | 'sand' | 'stone';
  };
  threePhaseState?: {
    network: 'IT' | 'TN';
    regime: 'normal' | 'emergency';
    touchedPhaseIndex: number;
    UphiV: number;
    RhOhm: number;
    RgOhm: number;
    RzmOhm: number;
    RisoOhm: number;
  };
  /** Занятие 12: TN, зануление, обрыв нуля — параметры из варианта + сценарий */
  tnEarthingState?: {
    scenario: Lesson12TnScenario;
    UphiV: number;
    ZnOhm: number;
    ZHOhm: number;
    R0Ohm: number;
    RnOhm: number;
    RzmOhm: number;
    RhOhm: number;
  };
  /** Занятие 13: ЛВЖ, испарение с площади Sₐ, концентрация и ΔP (13.1–13.6) */
  fireSafetyState?: {
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
    sparkOn: boolean;
  };
  /** Занятие 14: этапы первой помощи при поражении током (без таблиц варианта) */
  firstAidElectricState?: {
    stage: 'disconnect' | 'airway' | 'breaths' | 'cpr';
  };
  /** Занятие 15: расследование НС — схема без таблиц */
  accidentInvestigationState?: {
    stage:
      | 'firstAid'
      | 'preventHazard'
      | 'preserveScene'
      | 'notify'
      | 'commission'
      | 'investigation'
      | 'report';
    severity: 'light' | 'heavyOrFatal';
  };
}

type CellularStation = {
  id: number;
  label: string;
  xM: number;
  boosted: boolean;
};

type CellularObstacle = {
  id: string;
  kind: 'building' | 'trees';
  xM: number;
  widthM: number;
  attenuation: number; // multiplier 0..1
};

type CellularPoint = {
  dM: number;
  stationId: number;
  stationLabel: string;
  rawE: number;
  eFinal: number;
  loss: number;
};

type TvPoint = {
  rM: number;
  Rm: number;
  deltaRad: number;
  Fd: number;
  Eimg: number;
  Esnd: number;
  EimgFinal: number;
  EsndFinal: number;
  imgBoost: boolean;
  sndBoost: boolean;
};

/* ─────────────── Reusable room furniture ─────────────── */

function LabRoom({ width = 12, depth = 8, height = 3.2 }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#706b63" roughness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#e8e4dc" />
      </mesh>
      <mesh position={[0, height / 2, -depth / 2]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#d4cec4" />
      </mesh>
      <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color="#dad4ca" />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color="#dad4ca" />
      </mesh>
    </group>
  );
}

function LabDesk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.04, 0.65]} />
        <meshStandardMaterial color="#b8956a" roughness={0.6} />
      </mesh>
      {[[-0.62, 0, -0.28], [0.62, 0, -0.28], [-0.62, 0, 0.28], [0.62, 0, 0.28]].map((leg, i) => (
        <mesh key={i} position={[leg[0], 0.36, leg[2]]} castShadow>
          <boxGeometry args={[0.04, 0.72, 0.04]} />
          <meshStandardMaterial color="#7d5c4f" />
        </mesh>
      ))}
    </group>
  );
}

function LabChair({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.4, 0.04, 0.4]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>
      <mesh position={[0, 0.72, 0.18]} castShadow>
        <boxGeometry args={[0.4, 0.56, 0.04]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>
    </group>
  );
}

function Cabinet({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[0.8, 1.8, 0.5]} />
      <meshStandardMaterial color="#8b7355" roughness={0.7} />
    </mesh>
  );
}

function Computer({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.35, 0.28, 0.02]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 0.14, 0.005]}>
        <planeGeometry args={[0.32, 0.24]} />
        <meshStandardMaterial emissive="#446688" emissiveIntensity={0.3} color="#335577" />
      </mesh>
      <mesh position={[0, -0.02, 0.04]} castShadow>
        <boxGeometry args={[0.08, 0.03, 0.08]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

/* ─────────────── Lesson 1: Lighting Investigation ─────────────── */

function LightInvestigationScene({ state, timeScale }: { state: LabSceneProps['lightState']; timeScale: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);
  const sensorGlowRef = useRef<THREE.Mesh>(null);

  const color = state.lampType === 'incandescent'
    ? '#ffd39b'
    : state.lampType === 'fluorescent'
      ? '#f0fff8'
      : '#d8ecff';

  const flickerHz = state.lampType === 'fluorescent' ? 100 : state.lampType === 'incandescent' ? 10 : 0;
  const pulsationDepth = state.lampType === 'fluorescent' ? 0.35 : state.lampType === 'incandescent' ? 0.12 : 0;

  const distance = Math.sqrt(state.heightM * state.heightM + state.sensorOffsetM * state.sensorOffsetM);
  const illuminance = realisticIlluminanceLux({
    intensityCd: state.intensityCd,
    distanceM: Math.max(0.2, distance),
    luminaireCount: state.luminaireCount,
    reflectance: state.reflectance,
    utilizationFactor: 0.62,
    maintenanceFactor: 0.85,
  });

  useFrame((_, delta) => {
    timeRef.current += delta * timeScale;
    if (!lightRef.current) return;
    const base = state.intensityCd / 120;
    if (flickerHz <= 0 || pulsationDepth <= 0) {
      lightRef.current.intensity = base;
    } else {
      const flicker = 1 - pulsationDepth + pulsationDepth * Math.sin(timeRef.current * flickerHz * 0.5);
      lightRef.current.intensity = base * flicker;
    }
    if (sensorGlowRef.current) {
      const glow = Math.min(1, illuminance / 500);
      (sensorGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
    }
  });

  return (
    <>
      <LabRoom width={14} depth={10} height={3.5} />
      {/* Desks with computers */}
      {[[-3, 0, 1], [-1, 0, 1], [1, 0, 1], [3, 0, 1], [-3, 0, -2], [-1, 0, -2], [1, 0, -2], [3, 0, -2]].map((pos, i) => (
        <group key={`desk-${i}`}>
          <LabDesk position={pos as [number, number, number]} />
          <LabChair position={[pos[0], 0, pos[2] + 0.7] as [number, number, number]} />
          <Computer position={[pos[0], 0.75, pos[2] - 0.1] as [number, number, number]} />
        </group>
      ))}
      <Cabinet position={[-6, 0.9, -4]} />
      <Cabinet position={[6, 0.9, -4]} />

      {/* Main luminaire */}
      <mesh position={[0, state.heightM + 0.05, 0]}>
        <boxGeometry args={[1.2, 0.05, 0.18]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={0.7} color={color} />
      </mesh>
      <mesh position={[0, state.heightM, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={1} color={color} />
      </mesh>
      <pointLight
        ref={lightRef}
        castShadow
        color={color}
        distance={12}
        decay={2}
        position={[0, state.heightM, 0]}
        intensity={state.intensityCd / 120}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Lux sensor on desk */}
      <mesh ref={sensorGlowRef} position={[state.sensorOffsetM, 0.78, 1]} castShadow>
        <boxGeometry args={[0.2, 0.04, 0.15]} />
        <meshStandardMaterial color="#42a5f5" emissive="#42a5f5" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[state.sensorOffsetM, 0.82, 1]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.2} />
      </mesh>
      <Text fontSize={0.14} color="#42a5f5" position={[state.sensorOffsetM, 1.1, 1]}>
        {`E = ${illuminance.toFixed(0)} лк`}
      </Text>
      <Text fontSize={0.1} color="#1976d2" position={[state.sensorOffsetM, 0.95, 1]}>
        {`r = ${distance.toFixed(2)} м | ρ = ${state.reflectance.toFixed(2)}`}
      </Text>
      <Text fontSize={0.1} color="#9fe6ff" position={[state.sensorOffsetM, 0.8, 1]}>
        {`n = ${state.luminaireCount} свет.`}
      </Text>

      {/* Additional ceiling luminaires (dimmer) */}
      {[[-3.5, 0], [3.5, 0], [-3.5, -3], [3.5, -3]].map(([x, z], i) => (
        <group key={`extra-light-${i}`}>
          <mesh position={[x, 3.4, z]}>
            <boxGeometry args={[0.8, 0.03, 0.12]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={0.2} color="#ddd" />
          </mesh>
          <pointLight position={[x, 3.35, z]} color={color} intensity={0.4} distance={5} decay={2} />
        </group>
      ))}
    </>
  );
}

/* ─────────────── Lesson 2: Lighting Calculation ─────────────── */

function LightCalculationScene({ state, timeScale }: { state: LabSceneProps['lightState']; timeScale: number }) {
  const timeRef = useRef(0);
  const color = state.lampType === 'incandescent'
    ? '#ffd39b'
    : state.lampType === 'fluorescent'
      ? '#f6fff4'
      : '#d7efff';
  const roomL = state.roomLengthM ?? 14;
  const roomB = state.roomWidthM ?? 10;
  const hp = Math.max(0.5, state.heightM - 0.3);
  const idx = (roomL * roomB) / (hp * (roomL + roomB));
  const rows = Math.max(2, state.lineRows ?? 2);
  const fixturesPerRow = Math.max(2, Math.ceil(Math.max(4, state.luminaireCount) / rows));
  const lineOffset = Math.min(roomB / 2 - 0.9, Math.max(0.8, state.lineOffsetM ?? roomB / 4));
  const lPrime = roomL / hp;

  useFrame((_, delta) => {
    timeRef.current += delta * timeScale;
  });

  return (
    <>
      <LabRoom width={roomL} depth={roomB} height={Math.max(3.6, state.heightM + 0.5)} />

      {[...Array(rows)].map((_, row) => {
        const z = rows === 1 ? 0 : row === 0 ? -lineOffset : lineOffset;
        return (
          <group key={`line-${row}`}>
            <mesh position={[0, state.heightM + 0.36, z]}>
              <boxGeometry args={[roomL - 1, 0.05, 0.18]} />
              <meshStandardMaterial color="#111111" emissive={color} emissiveIntensity={0.7} />
            </mesh>
            {Array.from({ length: fixturesPerRow }).map((__, col) => {
              const x = -roomL / 2 + 1 + ((roomL - 2) / (fixturesPerRow - 1)) * col;
              const phase = timeRef.current * 1.8 + col * 0.35 + row * 0.8;
              const pulse = 0.4 + 0.15 * Math.sin(phase);
              return (
                <group key={`fixture-${row}-${col}`}>
                  <mesh position={[x, state.heightM + 0.38, z]}>
                    <boxGeometry args={[0.6, 0.04, 0.12]} />
                    <meshStandardMaterial color="#f1f1f1" emissive={color} emissiveIntensity={0.4 + pulse} />
                  </mesh>
                  <pointLight
                    position={[x, state.heightM + 0.34, z]}
                    color={color}
                    intensity={(state.intensityCd / 320) * (1 + pulse)}
                    distance={state.heightM + 3.5}
                    decay={2}
                  />
                </group>
              );
            })}
          </group>
        );
      })}

      {[[-roomL / 2 + 1.8, 0, 1.8], [0, 0, 1.8], [roomL / 2 - 1.8, 0, 1.8], [-roomL / 2 + 1.8, 0, -1.5], [0, 0, -1.5], [roomL / 2 - 1.8, 0, -1.5]].map((pos, i) => (
        <LabDesk key={`calc-desk-${i}`} position={pos as [number, number, number]} />
      ))}

      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.12, 32]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0.03, roomB / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomL - 0.8, 0.035]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <Text fontSize={0.18} color="#111111" position={[0, 0.2, roomB / 2 - 0.05]}>
        {`L = ${roomL.toFixed(1)} м`}
      </Text>
      <mesh position={[-roomL / 2 + 0.45, 0.03, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[roomB - 0.8, 0.035]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <Text fontSize={0.18} color="#111111" position={[-roomL / 2 + 0.05, 0.2, 0]}>
        {`B = ${roomB.toFixed(1)} м`}
      </Text>

      <mesh position={[-roomL / 4, 0.03, -lineOffset]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomL / 2, 0.03]} />
        <meshBasicMaterial color="#2b2b2b" />
      </mesh>
      <Text fontSize={0.13} color="#1565c0" position={[-roomL / 4, 0.18, -lineOffset - 0.28]}>
        {`L' = ${lPrime.toFixed(2)}`}
      </Text>
      <mesh position={[0, 0.03, -lineOffset / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[lineOffset, 0.03]} />
        <meshBasicMaterial color="#2b2b2b" />
      </mesh>
      <Text fontSize={0.13} color="#1565c0" position={[0.3, 0.18, -lineOffset / 2]}>
        {`l = ${lineOffset.toFixed(2)} м`}
      </Text>

      <mesh position={[-roomL / 2 + 0.55, hp / 2, -roomB / 2 + 0.4]}>
        <boxGeometry args={[0.03, hp, 0.03]} />
        <meshBasicMaterial color="#2ecc71" />
      </mesh>
      <Text fontSize={0.14} color="#2ecc71" position={[-roomL / 2 + 1.15, hp / 2, -roomB / 2 + 0.4]}>
        {`H' = ${hp.toFixed(2)} м`}
      </Text>

      <Text fontSize={0.16} color="#ffd43b" position={[0, 0.65, 0]}>
        {`i = ${idx.toFixed(3)} | P = ${(state.chosenLampPowerW ?? 60).toFixed(0)} Вт`}
      </Text>
      <Text fontSize={0.1} color="#00695c" position={[0, state.heightM + 0.8, 0]}>
        {`Две светящиеся линии, ${fixturesPerRow} светильников в каждом ряду`}
      </Text>
    </>
  );
}

/* ─────────────── Lesson 3: Noise Investigation ─────────────── */

function NoiseWave({ x, z, color, speed = 0.6, timeScale = 1 }: { x: number; z: number; color: string; speed?: number; timeScale?: number }) {
  const ref = useRef<Mesh>(null);
  const timeRef = useRef((Math.abs(x) * 0.37) % 3);

  useFrame((_, delta) => {
    timeRef.current += delta * speed * timeScale;
    if (!ref.current) return;
    const t = timeRef.current % 2.5;
    const scale = 0.2 + t;
    const opacity = Math.max(0.03, 0.45 - t * 0.16);
    ref.current.scale.set(scale, scale, scale);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <mesh ref={ref} position={[x, 1.8, z]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[1, 0.018, 6, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} />
    </mesh>
  );
}

function NoiseInvestigationScene({ state, timeScale }: { state: LabSceneProps['noiseState']; timeScale: number }) {
  const contributions = [
    state.sourceAOn ? sourceLevelAtObserver({
      levelAt1mDb: state.sourceA,
      distanceM: Math.max(0.8, Math.abs(state.observerX - state.sourceAX)),
      barrierMassPerM2: state.barrierMassA,
    }) : Number.NEGATIVE_INFINITY,
    state.sourceBOn ? sourceLevelAtObserver({
      levelAt1mDb: state.sourceB,
      distanceM: Math.max(0.8, Math.abs(state.observerX - state.sourceBX)),
      barrierMassPerM2: state.barrierMassB,
    }) : Number.NEGATIVE_INFINITY,
    state.sourceCOn ? sourceLevelAtObserver({
      levelAt1mDb: state.sourceC,
      distanceM: Math.max(0.8, Math.abs(state.observerX - state.sourceCX)),
      barrierMassPerM2: state.barrierMassC,
    }) : Number.NEGATIVE_INFINITY,
  ].filter((value) => Number.isFinite(value));

  const total = contributions.length > 0 ? sumLevelsEnergyDb(contributions as number[]) : 0;

  const sources = [
    { x: state.sourceAX, z: -2, level: state.sourceA, active: state.sourceAOn, color: '#ff5722', label: 'Станок A', barrierMass: state.barrierMassA },
    { x: state.sourceBX, z: 0, level: state.sourceB, active: state.sourceBOn, color: '#ff9800', label: 'Станок B', barrierMass: state.barrierMassB },
    { x: state.sourceCX, z: 2, level: state.sourceC, active: state.sourceCOn, color: '#ffc107', label: 'Компрессор', barrierMass: state.barrierMassC },
  ];

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
      </mesh>
      {/* Factory walls */}
      <mesh position={[0, 2, -5.8]}>
        <boxGeometry args={[20, 4, 0.2]} />
        <meshStandardMaterial color="#8a8478" />
      </mesh>
      <mesh position={[-9.8, 2, 0]}>
        <boxGeometry args={[0.2, 4, 12]} />
        <meshStandardMaterial color="#8a8478" />
      </mesh>
      <mesh position={[9.8, 2, 0]}>
        <boxGeometry args={[0.2, 4, 12]} />
        <meshStandardMaterial color="#8a8478" />
      </mesh>

      {/* Sources */}
      {sources.map((source, index) => (
        <group key={`src-${index}`}>
          <mesh position={[(source.x + state.observerX) / 2, 1.5, source.z]} castShadow>
            <boxGeometry args={[0.24, 3, 1.7]} />
            <meshStandardMaterial color="#95a5a6" roughness={0.55} metalness={0.08} />
          </mesh>
          <Text fontSize={0.11} color="#dce4e6" position={[(source.x + state.observerX) / 2, 3.15, source.z]}>
            {`G = ${source.barrierMass} кг/м²`}
          </Text>
          {/* Machine body */}
          <mesh position={[source.x, 0.7, source.z]} castShadow>
            <boxGeometry args={[1.0, 1.2, 0.9]} />
            <meshStandardMaterial color={source.active ? '#666' : '#444'} metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Machine top detail */}
          <mesh position={[source.x, 1.4, source.z]} castShadow>
            <cylinderGeometry args={[0.2, 0.3, 0.2, 8]} />
            <meshStandardMaterial color={source.active ? source.color : '#555'} />
          </mesh>
          {/* Vibration indicator */}
          {source.active && (
            <VibrationIndicator position={[source.x, 0.7, source.z]} intensity={source.level / 100} timeScale={timeScale} />
          )}
          <Text fontSize={0.13} color={source.active ? source.color : '#666'} position={[source.x, 1.9, source.z]}>
            {`${source.label}`}
          </Text>
          <Text fontSize={0.11} color={source.active ? '#fff' : '#666'} position={[source.x, 1.7, source.z]}>
            {`${source.level} дБ`}
          </Text>
          {source.active && <NoiseWave x={source.x} z={source.z} color={source.color} speed={source.level / 120} timeScale={timeScale} />}
        </group>
      ))}

      {/* Observer with sound level meter */}
      <group position={[state.observerX, 0, 0]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.6, 8, 16]} />
          <meshStandardMaterial color="#42a5f5" />
        </mesh>
        <mesh position={[0, 1.6, 0]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>
        {/* Sound level meter in hand */}
        <mesh position={[0.25, 1.2, 0.15]} castShadow>
          <boxGeometry args={[0.08, 0.15, 0.04]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <Text fontSize={0.18} color={total > 80 ? '#ff6b6b' : '#9be37d'} position={[0, 2.1, 0]}>
          {`LΣ = ${total.toFixed(1)} дБ`}
        </Text>
        <Text fontSize={0.1} color="#1976d2" position={[0, 1.95, 0]}>
          {total > 80 ? '⚠ Превышение ПДУ!' : '✓ В норме'}
        </Text>
      </group>

      {/* Ceiling lights */}
      <pointLight position={[-4, 3.5, 0]} color="#fff5e0" intensity={1} distance={8} decay={2} />
      <pointLight position={[4, 3.5, 0]} color="#fff5e0" intensity={1} distance={8} decay={2} />
    </>
  );
}

function VibrationIndicator({ position, intensity, timeScale }: { position: [number, number, number]; intensity: number; timeScale: number }) {
  const ref = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta * timeScale;
    if (!ref.current) return;
    const vibAmount = intensity * 0.02;
    ref.current.position.x = position[0] + Math.sin(timeRef.current * 30) * vibAmount;
    ref.current.position.y = position[1] + Math.sin(timeRef.current * 25 + 1) * vibAmount * 0.5;
  });

  return <group ref={ref} position={position} />;
}

function sumLevelsByMethodicalTable(levels: number[]): number {
  if (levels.length === 0) return 0;
  const sorted = [...levels].sort((left, right) => right - left);
  return sorted.slice(1).reduce((acc, level) => sumTwoLevelsByDeltaDb(acc, level), sorted[0]);
}

/* ─────────────── Lesson 4: Noise Calculation ─────────────── */

function NoiseCalculationScene({ state, timeScale }: { state: LabSceneProps['noiseState']; timeScale: number }) {
  const sources = [
    { x: state.sourceAX, z: -3, level: state.sourceA, on: state.sourceAOn, color: '#ff5722', barrierMass: state.barrierMassA, label: 'Источник 1' },
    { x: state.sourceBX, z: 0, level: state.sourceB, on: state.sourceBOn, color: '#ff9800', barrierMass: state.barrierMassB, label: 'Источник 2' },
    { x: state.sourceCX, z: 3, level: state.sourceC, on: state.sourceCOn, color: '#ffc107', barrierMass: state.barrierMassC, label: 'Источник 3' },
  ].map((source) => {
    if (!source.on) {
      return {
        ...source,
        distance: Math.max(0.8, Math.abs(state.observerX - source.x)),
        distanceLevel: null,
        barrierReduction: null,
        barrierLevel: null,
      };
    }

    const distance = Math.max(0.8, Math.abs(state.observerX - source.x));
    const distanceLevel = levelAtDistanceDb(source.level, distance);
    const barrierReduction = barrierReductionDbFromMass(source.barrierMass);
    const barrierLevel = levelAfterBarrierDb(distanceLevel, barrierReduction);
    return {
      ...source,
      distance,
      distanceLevel,
      barrierReduction,
      barrierLevel,
    };
  });

  const distanceLevels = sources
    .filter((source) => source.distanceLevel !== null)
    .map((source) => source.distanceLevel as number);
  const barrierLevels = sources
    .filter((source) => source.barrierLevel !== null)
    .map((source) => source.barrierLevel as number);
  const totalWithout = sumLevelsByMethodicalTable(distanceLevels);
  const totalWith = sumLevelsByMethodicalTable(barrierLevels);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#404651" roughness={0.92} />
      </mesh>
      {Array.from({ length: 21 }).map((_, i) => (
        <group key={`grid-${i}`}>
          <mesh position={[-10 + i, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.01, 12]} />
            <meshBasicMaterial color="#555" transparent opacity={0.3} />
          </mesh>
          {i <= 12 && (
            <mesh position={[0, 0.005, -6 + i]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.01, 20]} />
              <meshBasicMaterial color="#555" transparent opacity={0.3} />
            </mesh>
          )}
        </group>
      ))}

      {sources.map((source, index) => (
        <group key={`calc-src-${index}`}>
          <mesh position={[source.x, 0.6, source.z]} castShadow>
            <boxGeometry args={[0.8, 1.0, 0.7]} />
            <meshStandardMaterial color={source.on ? '#666' : '#444'} metalness={0.5} />
          </mesh>
          <mesh position={[(source.x + state.observerX) / 2, 1.45, source.z]} castShadow>
            <boxGeometry args={[0.26, 2.9, 1.6]} />
            <meshStandardMaterial color="#8f99a3" roughness={0.45} />
          </mesh>
          <Text fontSize={0.12} color={source.color} position={[source.x, 1.42, source.z]}>
            {`${source.label}: L1 = ${source.level} дБ`}
          </Text>
          {source.on && (
            <mesh position={[(source.x + state.observerX) / 2, 0.03, source.z + 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[source.distance, 0.02]} />
              <meshBasicMaterial color={source.color} transparent opacity={0.5} />
            </mesh>
          )}
          <Text fontSize={0.11} color="#dce4e6" position={[(source.x + state.observerX) / 2, 3.05, source.z]}>
            {`G = ${source.barrierMass} кг/м²`}
          </Text>
          {source.on && (
            <>
              <Text fontSize={0.095} color="#ffe082" position={[source.x, 1.12, source.z]}>
                {`LR = ${source.distanceLevel?.toFixed(1)} дБ`}
              </Text>
              <Text fontSize={0.095} color="#b9f6ca" position={[(source.x + state.observerX) / 2 + 0.45, 1.85, source.z]}>
                {`N = ${source.barrierReduction?.toFixed(1)} дБ`}
              </Text>
              <Text fontSize={0.1} color="#a5d6a7" position={[state.observerX - 0.35, 1.15, source.z]}>
                {`L'R = ${source.barrierLevel?.toFixed(1)} дБ`}
              </Text>
              <NoiseWave x={source.x} z={source.z} color={source.color} speed={0.4 + index * 0.12} timeScale={timeScale} />
            </>
          )}
        </group>
      ))}

      <group position={[state.observerX, 0, 0]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.5, 8, 16]} />
          <meshStandardMaterial color="#42a5f5" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>
        <Text fontSize={0.15} color="#ffd43b" position={[0, 2.25, 0]}>
          {`Без преграды: ${totalWithout.toFixed(1)} дБ`}
        </Text>
        <Text fontSize={0.15} color={totalWith > 80 ? '#ff6b6b' : '#9be37d'} position={[0, 2.0, 0]}>
          {`С преградой: ${totalWith.toFixed(1)} дБ`}
        </Text>
        <Text fontSize={0.1} color="#d1e6ff" position={[0, 1.82, 0]}>
          Пошагово: LR → N → L'R
        </Text>
      </group>

      <pointLight position={[0, 3.5, 0]} color="#fff5e0" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

/* ─────────────── Lesson 5: EMI ─────────────── */

function EmWaveDots({
  axis,
  color,
  timeScale,
  baseY,
}: {
  axis: 'electric' | 'magnetic';
  color: string;
  timeScale: number;
  baseY: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta * timeScale;
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      const x = -4.8 + index * 0.55;
      const wave = Math.sin(timeRef.current * 2.2 + index * 0.45) * 0.75;
      if (axis === 'electric') {
        mesh.position.set(x, baseY + wave, 0);
      } else {
        mesh.position.set(x, baseY, wave);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 18 }).map((_, index) => (
        <mesh key={`${axis}-${index}`}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function EmiScene({ state, timeScale }: { state: LabSceneProps['emiState']; timeScale: number }) {
  const lambda = wavelengthM(Math.max(1e3, state.frequencyHz));
  const near = lambda / (2 * Math.PI);
  const far = 2 * lambda;
  const zone = classifyEmZone(Math.max(0.01, state.distanceM), lambda);
  const ppe = state.eVpm * state.hApm;

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#d7e0df" roughness={0.92} />
      </mesh>

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.25, Math.min(near, 4.2)), Math.max(0.35, Math.min(near, 4.7)), 64]} />
        <meshBasicMaterial color="#ff7676" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.9, Math.min(far * 0.55, 6.8)), Math.max(1.1, Math.min(far * 0.6, 7.2)), 64]} />
        <meshBasicMaterial color="#5da9ff" transparent opacity={0.25} />
      </mesh>

      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.6, 0.2, 0.6]} />
        <meshStandardMaterial color="#555" metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.2, 2.6, 12]} />
        <meshStandardMaterial color="#c0392b" emissive="#a42f2d" emissiveIntensity={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.9, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial emissive="#ff3333" emissiveIntensity={2} />
      </mesh>

      <mesh position={[0, 1.6, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[10.8, 0.02, 0.02]} />
        <meshBasicMaterial color="#353535" />
      </mesh>
      <EmWaveDots axis="electric" color="#ff6b6b" timeScale={timeScale} baseY={1.6} />
      <EmWaveDots axis="magnetic" color="#4dabf7" timeScale={timeScale} baseY={1.6} />
      <mesh position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.02, 2.2]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.02, 2.2]} />
        <meshBasicMaterial color="#4dabf7" />
      </mesh>
      <Text fontSize={0.15} color="#ff6b6b" position={[-4.9, 2.7, 0]}>
        Электрическое поле E
      </Text>
      <Text fontSize={0.15} color="#4dabf7" position={[-4.7, 1.65, 1.55]}>
        Магнитное поле H
      </Text>
      <Text fontSize={0.12} color="#0d47a1" position={[0, 3.0, 0]}>
        Поля взаимно перпендикулярны и распространяются вдоль оси волны
      </Text>

      <group position={[Math.min(state.distanceM, 10), 0, 0]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[0.12, 0.25, 0.08]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
          <meshStandardMaterial color="#888" metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={zone === 'near' ? '#ff6b6b' : zone === 'intermediate' ? '#ffd43b' : '#51cf66'} emissive={zone === 'near' ? '#ff0000' : zone === 'intermediate' ? '#ffaa00' : '#00cc44'} emissiveIntensity={0.8} />
        </mesh>
        <Text fontSize={0.15} color="#fff" position={[0, 2.3, 0]}>
          {zone === 'near' ? 'Ближняя зона' : zone === 'intermediate' ? 'Промежуточная' : 'Дальняя зона'}
        </Text>
        <Text fontSize={0.11} color="#eceff1" position={[0, 2.1, 0]}>
          {`r = ${state.distanceM.toFixed(2)} м`}
        </Text>
        <Text fontSize={0.11} color="#ffd43b" position={[0, 0.8, 0]}>
          {`ППЭ = ${ppe.toFixed(3)} Вт/м²`}
        </Text>
      </group>

      <mesh position={[Math.min(state.distanceM, 10) / 2, 0.03, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.min(state.distanceM, 10), 0.03]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>

      {[
        { label: 'Радиоволны', color: '#ffc979', x: 6.4, z: -3.5 },
        { label: 'Микроволны', color: '#ffe08a', x: 6.4, z: -2.0 },
        { label: 'ИК', color: '#ffb1a7', x: 6.4, z: -0.5 },
        { label: 'Видимый', color: '#a8e6a2', x: 6.4, z: 1.0 },
        { label: 'УФ/рентген', color: '#b6c7ff', x: 6.4, z: 2.5 },
      ].map((band, index) => (
        <group key={`emi-band-${index}`} position={[band.x, 0.55, band.z]}>
          <mesh castShadow>
            <boxGeometry args={[2.2, 1.1, 0.5]} />
            <meshStandardMaterial color={band.color} roughness={0.45} />
          </mesh>
          <Text fontSize={0.12} color="#232323" position={[0, 0.8, 0]}>
            {band.label}
          </Text>
        </group>
      ))}

      {near < 8 && (
        <Text fontSize={0.14} color="#ff6b6b" position={[Math.min(7, near) + 0.3, 0.25, -0.55]}>
          Ближняя зона
        </Text>
      )}
      {far < 10 && (
        <Text fontSize={0.14} color="#5da9ff" position={[Math.min(9, far) + 0.3, 0.25, 0.55]}>
          Дальняя зона
        </Text>
      )}

      <pointLight position={[5, 5, 5]} color="#aab" intensity={0.5} />
      <pointLight position={[-5, 4, 4]} color="#fff4e1" intensity={0.65} />
    </>
  );
}

/* ─────────────── Lesson 6: EMI Shielding ─────────────── */

function ShieldingScene({ state, timeScale }: { state: LabSceneProps['shieldState']; timeScale: number }) {
  const waveRef = useRef<THREE.Group>(null);
  const timeR = useRef(0);

  const H = magneticFieldStrengthH(state.turns, state.currentA, state.distanceM, state.coilRadiusM, 1);
  const E = electricFieldFromH(H);
  const ppe = powerFluxDensityFromH(H);
  const ppeAllow = allowablePPE(state.exposureTimeH);
  const L = attenuationRatioL(ppe, ppeAllow);
  const muAbs = absolutePermeability(state.muRelative);
  const omega = angularFrequencyOmega(state.frequencyHz);
  const thickness = shieldThicknessM(L, omega, muAbs, state.conductivitySpm);
  const wgAtt = waveguideAttenuationPerM(state.waveguideDiameterM, state.waveguideEpsilon);
  const wgLen = waveguideLengthM(L, wgAtt);
  const alphaVis = Math.max(0.01, wgAtt / 200); // visual-only decay factor

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    if (!waveRef.current) return;
    waveRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const t = (timeR.current * 1.4 + i * 0.5) % 4;
      const x = -6 + t * 3;
      mesh.position.x = x;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = x < 0 ? 0.5 : Math.max(0.03, 0.5 * Math.exp(-(x * alphaVis * 0.3)));
    });
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#dfe3e8" roughness={0.94} metalness={0.02} />
      </mesh>

      {/* EMI source (coil/transmitter) */}
      <mesh position={[-5, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 1.2, 16]} />
        <meshStandardMaterial color="#c0392b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-5, 2.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
        <meshStandardMaterial color="#e74c3c" emissive="#ff3333" emissiveIntensity={0.6} />
      </mesh>
      <Text fontSize={0.14} color="#ff6b6b" position={[-5, 3.0, 0]}>
        {`H = ${H.toExponential(2)} А/м`}
      </Text>
      <Text fontSize={0.12} color="#ffd43b" position={[-5, 2.7, 0]}>
        {`E = ${E.toExponential(2)} В/м | ППЭδ = ${ppe.toExponential(2)} Вт/м²`}
      </Text>

      {/* Shield wall */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[Math.max(0.05, thickness * 800), 3, 6]} />
        <meshStandardMaterial color="#78909c" metalness={0.7} roughness={0.3} transparent opacity={0.85} />
      </mesh>
      <Text fontSize={0.14} color="#80cbc4" position={[0, 3.58, 0]}>
        {`Экран: δ = ${(thickness * 1000).toFixed(2)} мм | ω = ${omega.toExponential(2)} 1/с`}
      </Text>
      <Text fontSize={0.11} color="#01579b" position={[0, 3.28, 0]}>
        {`ППЭδдоп = ${ppeAllow.toExponential(2)} Вт/м² | L = ${L.toFixed(3)}`}
      </Text>

      {/* Waveguide (tube through shield) */}
      <mesh position={[0, 0.5, 2.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[state.waveguideDiameterM * 5, state.waveguideDiameterM * 5, Math.max(0.1, wgLen * 2), 16]} />
        <meshStandardMaterial color="#455a64" metalness={0.6} transparent opacity={0.7} />
      </mesh>
      {/* Подпись вынесена над верхней гранью экрана и ближе к камере по Z, чтобы не оказывалась внутри полупрозрачной стенки */}
      <Text fontSize={0.11} color="#a5d6a7" position={[0, 3.14, 3.42]}>
        {`Волновод: l = ${(wgLen * 100).toFixed(1)} см | α = ${wgAtt.toFixed(2)} дБ/м`}
      </Text>

      {/* Animated wave fronts */}
      <group ref={waveRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`wave-${i}`} position={[-6 + i, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.8, 0.02, 6, 24]} />
            <meshBasicMaterial color="#ff6b6b" transparent opacity={0.4} />
          </mesh>
        ))}
      </group>

      {/* Protected zone */}
      <mesh position={[4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <Text fontSize={0.16} color="#66bb6a" position={[4, 0.3, 0]}>
        Защищённая зона
      </Text>

      <pointLight position={[-5, 5, 3]} color="#ffcccc" intensity={0.8} distance={12} decay={2} />
      <pointLight position={[4, 5, -2]} color="#ccffcc" intensity={0.6} distance={10} decay={2} />
    </>
  );
}

/* ─────────────── Lesson 7: HF Field (Shuleikin-VdPol) ─────────────── */

/** Ниже этой доли от max S по пяти точкам — «Сигнал слабый» (не ⅓: при разных d иначе почти всегда красное). */
const HF_CELL_WEAK_VS_PEAK = 0.1;

function CellularSignalScene({
  state,
  timeScale,
  points,
  stations,
  obstacles,
  onToggleStation,
}: {
  state: LabSceneProps['hfState'];
  timeScale: number;
  points: CellularPoint[];
  stations: CellularStation[];
  obstacles: CellularObstacle[];
  onToggleStation: (stationId: number) => void;
}) {
  const waveRef = useRef<THREE.Group>(null);
  const timeR = useRef(0);
  const maxE = Math.max(...points.map((p) => p.eFinal), 1e-9);
  const weakThreshold = maxE * HF_CELL_WEAK_VS_PEAK;
  const maxD = Math.max(...state.distances, 100);
  const scaleX = (m: number) => Math.min(10, m / (maxD / 10));

  const maxScaledX = Math.max(
    ...stations.map((s) => scaleX(s.xM)),
    ...points.map((p) => scaleX(p.dM)),
    ...obstacles.map((o) => scaleX(o.xM)),
    1,
  );
  const scenePadX = 1.6;
  const scenePadZ = 1.4;
  const planeW = maxScaledX + 2 * scenePadX;
  const planeD = Math.max(8.5, Math.min(12, maxScaledX * 0.95 + 2 * scenePadZ));
  const contentCenterX = maxScaledX / 2;
  const sceneShiftX = -contentCenterX;
  const ringOuter = Math.min(planeW / 2 - 0.15, contentCenterX + scenePadX + 0.3);

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    if (!waveRef.current) return;
    waveRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const phase = (timeR.current * 0.8 + i * 0.6) % 5;
      const r = 0.5 + phase * 2;
      mesh.scale.set(r, r, r);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0.02, 0.4 - phase * 0.08);
    });
  });

  return (
    <group position={[sceneShiftX, 0, 0]}>
      <mesh position={[contentCenterX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[planeW, planeD]} />
        <meshStandardMaterial color="#8bad78" roughness={0.92} />
      </mesh>

      {/* БС: в центре (x=0) — главная радиостанция/передатчик; по краям — ретрансляторы с усилителем */}
      {stations.map((s) => {
        const isMain = s.id === 0;
        const mastH = isMain ? 5.8 : 4.4;
        const mastY = isMain ? 2.9 : 2.2;
        const topY = isMain ? mastH + 0.35 : 4.5;
        const labelY = isMain ? mastH + 0.95 : 5.0;
        return (
          <group key={s.id} position={[scaleX(s.xM), 0, 0]}>
            {!isMain && (
              <>
                <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => onToggleStation(s.id)}>
                  <ringGeometry args={[0.25, 0.45, 48]} />
                  <meshBasicMaterial color={s.boosted ? '#00e676' : '#ffd54f'} transparent opacity={0.65} />
                </mesh>
                <Text fontSize={0.10} color={s.boosted ? '#00e676' : '#ffd54f'} position={[0, 0.45, -1.35]}>
                  {s.boosted ? 'клик: снять усилитель' : 'клик: поставить усилитель'}
                </Text>
              </>
            )}
            {isMain && (
              <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.35, 0.58, 48]} />
                <meshBasicMaterial color="#ff7043" transparent opacity={0.45} />
              </mesh>
            )}

            <mesh position={[0, mastY, -2]} castShadow={!isMain} onClick={isMain ? undefined : () => onToggleStation(s.id)}>
              <cylinderGeometry args={isMain ? [0.12, 0.2, mastH, 10] : [0.08, 0.14, mastH, 8]} />
              <meshStandardMaterial
                color={isMain ? '#eceff1' : s.boosted ? '#00e676' : '#b0bec5'}
                metalness={isMain ? 0.45 : 0.6}
                roughness={isMain ? 0.35 : 0.5}
              />
            </mesh>
            <mesh position={[0, topY, -2]} onClick={isMain ? undefined : () => onToggleStation(s.id)}>
              <sphereGeometry args={[isMain ? 0.18 : 0.12, 10, 10]} />
              <meshStandardMaterial
                color={isMain ? '#ff7043' : s.boosted ? '#00e676' : '#ff5722'}
                emissive={isMain ? '#ff5722' : s.boosted ? '#00e676' : '#ff3300'}
                emissiveIntensity={isMain ? 1.4 : s.boosted ? 1.8 : 1.2}
              />
            </mesh>
            <Text fontSize={isMain ? 0.12 : 0.11} color={isMain ? '#ffe0b2' : s.boosted ? '#00e676' : '#ffcc80'} position={[0, labelY, -2]}>
              {isMain ? 'Главная радиостанция (передатчик)' : `${s.label}${s.boosted ? ' (усил.)' : ''}`}
            </Text>
            {isMain && (
              <Text fontSize={0.085} color="#b0bec5" position={[0, mastY - 1.2, -0.85]}>
                {'релейные БС по оси — с усилителем'}
              </Text>
            )}
          </group>
        );
      })}

      <Text fontSize={0.14} color="#ffd54f" position={[contentCenterX, 6.9, 0]}>
        {`Главная станция + ретрансляторы (упрощ.): P=${state.powerKW} кВт, Ga=${state.gainAntenna}, препятствия → потери`}
      </Text>

      {/* Obstacles (buildings + trees) */}
      {obstacles.map((o) => {
        const xPos = scaleX(o.xM);
        if (o.kind === 'building') {
          return (
            <mesh key={o.id} position={[xPos, 1.3, -0.8]} castShadow>
              <boxGeometry args={[0.7, 2.6, 1.2]} />
              <meshStandardMaterial color="#607d8b" roughness={0.85} />
            </mesh>
          );
        }
        return (
          <group key={o.id} position={[xPos, 0, 1.4]}>
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, 1.6, 6]} />
              <meshStandardMaterial color="#5d4037" />
            </mesh>
            <mesh position={[0, 1.8, 0]} castShadow>
              <coneGeometry args={[0.6, 1.5, 8]} />
              <meshStandardMaterial color="#2e7d32" />
            </mesh>
          </group>
        );
      })}

      {/* Expanding wave rings */}
      <group ref={waveRef}>
        {/* Rings originate from each base station (no "floating" waves) */}
        {stations.flatMap((s) =>
          Array.from({ length: 4 }).map((_, i) => (
            <mesh
              key={`cell-ring-${s.id}-${i}`}
              position={[scaleX(s.xM), 0.12, -2]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[1, 0.03, 6, 32]} />
              <meshBasicMaterial color={s.boosted ? '#00e676' : '#ff9800'} transparent opacity={0.25} />
            </mesh>
          )),
        )}
      </group>

      {/* Measurement points + signal bars */}
      {points.map((p, i) => {
        const scaledD = scaleX(p.dM);
        const barHeight = Math.max(0.1, (p.eFinal / maxE) * 3);
        const isWeak = p.eFinal < weakThreshold;
        const barColor = isWeak ? '#f44336' : '#ff9800';
        return (
          <group key={`hf-pt-${i}`} position={[scaledD, 0, 0]}>
            {/* Measurement post */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.15, 1, 0.15]} />
              <meshStandardMaterial color="#f44336" />
            </mesh>
            <Text fontSize={0.12} color="#fff" position={[0, 1.3, 0]}>
              {`d=${p.dM} м`}
            </Text>
            <Text fontSize={0.11} color="#ffd54f" position={[0, 1.05, 0]}>
              {`S = ${p.eFinal.toFixed(3)} усл.`}
            </Text>
            <Text fontSize={0.09} color="#00695c" position={[0, 0.85, 0]}>
              {`${p.stationLabel} | потери×${p.loss.toFixed(2)}`}
            </Text>

            {/* Signal strength bar graph */}
            <mesh position={[0, barHeight / 2, 1.5]}>
              <boxGeometry args={[0.3, barHeight, 0.3]} />
              <meshStandardMaterial color={barColor} transparent opacity={0.8} />
            </mesh>
            {isWeak && (
              <Text fontSize={0.08} color="#ff5252" position={[0, 0.5, -0.8]}>
                {'Сигнал слабый'}
              </Text>
            )}
          </group>
        );
      })}

      {/* Ground plane texture */}
      <mesh position={[contentCenterX, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, ringOuter, 64]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.08} />
      </mesh>

      <pointLight position={[contentCenterX, 8, 4]} color="#fff5e0" intensity={1} distance={15} decay={2} />
      <pointLight position={[contentCenterX + 5, 4, -4]} color="#ffeedd" intensity={0.5} distance={12} decay={2} />
    </group>
  );
}

/* ─────────────── Lesson 8: UHF Field ─────────────── */

function TvBroadcastScene({
  state,
  timeScale,
  points,
  selectedIndex,
  onSelectIndex,
  onToggleImg,
  onToggleSnd,
}: {
  state: LabSceneProps['uhfState'];
  timeScale: number;
  points: TvPoint[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onToggleImg: (index: number) => void;
  onToggleSnd: (index: number) => void;
}) {
  const pulseRef = useRef<THREE.Group>(null);
  const timeR = useRef(0);
  const maxImg = Math.max(...points.map((p) => p.EimgFinal), 1e-9);
  const maxSnd = Math.max(...points.map((p) => p.EsndFinal), 1e-9);
  const imgWeakThreshold = maxImg / 3;
  const sndWeakThreshold = maxSnd / 3;
  const idx = Math.min(Math.max(0, selectedIndex), Math.max(0, points.length - 1));
  const p = points[idx];
  /* r1…r5 по оси X с равным шагом; дом ставим у выбранной точки — усилители «своей» r рядом с домом. */
  const rxStartX = 0.95;
  const rxEndX = 8.55;
  const rxSpan = Math.max(0.01, rxEndX - rxStartX);
  const nRx = Math.max(1, points.length);
  const rxLayoutX = (i: number) => rxStartX + (nRx > 1 ? (i / (nRx - 1)) * rxSpan : rxSpan * 0.5);
  const housePosX = rxLayoutX(idx) + 0.62;
  const boosterW = 0.64;
  const boosterSep = 0.46;
  /* Высота антенны в метрах для формул (H); для мешей — ограниченный масштаб */
  const towerVisH = Math.max(3.2, Math.min(5.2, state.heightM * 0.18));

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    if (!pulseRef.current) return;
    pulseRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const t = (timeR.current * 1.2 + i * 0.5) % 3;
      const s = 0.3 + t * 1.5;
      mesh.scale.set(s, s, s);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0.02, 0.35 - t * 0.12);
    });
  });

  const imgWeak = p ? p.EimgFinal < imgWeakThreshold && !p.imgBoost : false;

  const flicker = 0.5 + 0.5 * Math.sin(timeR.current * 10 + idx * 2);
  const videoNoiseOpacity = imgWeak ? Math.max(0.25, 0.35 + 0.35 * flicker) : 0.04;

  return (
    <>
      {/* Пол сдвинут к содержимому сцены — меньше пустой травы по краям */}
      <mesh position={[3.9, 0, -0.85]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 8.2]} />
        <meshStandardMaterial color="#bfe3c0" roughness={0.95} />
      </mesh>

      {/* Road — по длине около r1…r5 */}
      <mesh position={[4.75, 0.01, -2.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.8, 1.45]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.98} />
      </mesh>
      <mesh position={[4.75, 0.012, -2.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.8, 0.06]} />
        <meshStandardMaterial color="#fff59d" emissive="#fff59d" emissiveIntensity={0.18} />
      </mesh>

      {/* Дом / r1…r5 / вышка — у z≈0; небоскрёбы и деревья — за дорогой (дорога ~ z=-1.6…-3.2, дальше — сильнее -Z) */}
      {[
        { x: 2.3, z: -3.65, w: 1.8, d: 1.9, h: 3.6, c: '#90a4ae' },
        { x: 3.9, z: -3.95, w: 2.6, d: 2.0, h: 4.4, c: '#78909c' },
        { x: 4.9, z: -3.72, w: 1.4, d: 1.6, h: 3.0, c: '#b0bec5' },
      ].map((b, i) => (
        <mesh key={`bld-${i}`} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.c} roughness={0.9} />
        </mesh>
      ))}
      {[
        { x: 5.7, z: -3.48 }, { x: 6.1, z: -3.98 }, { x: 6.5, z: -3.42 },
        { x: 6.9, z: -3.82 }, { x: 7.3, z: -3.58 }, { x: 7.7, z: -4.08 },
        { x: 8.1, z: -3.52 }, { x: 8.4, z: -3.92 },
      ].map((t, i) => (
        <group key={`tree-${i}`} position={[t.x, 0, t.z]} >
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 1.2, 8]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          <mesh position={[0, 1.4, 0]} castShadow>
            <sphereGeometry args={[0.55, 10, 10]} />
            <meshStandardMaterial color="#43a047" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* TV Tower (visual scale only; расчёты — по state.heightM) */}
      <group>
        <mesh position={[0, towerVisH / 2, 0]} castShadow>
          <boxGeometry args={[0.3, towerVisH, 0.3]} />
          <meshStandardMaterial color="#78909c" metalness={0.5} />
        </mesh>
        {[-0.4, 0, 0.4].map((z, i) => (
          <mesh key={`ant-${i}`} position={[0, towerVisH - 0.3, z]} castShadow>
            <boxGeometry args={[0.8, 0.08, 0.04]} />
            <meshStandardMaterial color="#e65100" metalness={0.4} />
          </mesh>
        ))}
        <Text fontSize={0.16} color="#ff7043" position={[0, towerVisH + 0.6, 0]}>
          {state.powerVideoW != null && state.powerAudioW != null
            ? `Телевышка: P_из≈${(state.powerVideoW / 1000).toFixed(0)} кВт; P_зв≈${(state.powerAudioW / 1000).toFixed(0)} кВт | G = ${state.gain}`
            : `Телевышка: P = ${state.powerW} Вт | G = ${state.gain}`}
        </Text>
        <Text fontSize={0.12} color="#ffab91" position={[0, towerVisH + 0.3, 0]}>
          {`h = ${state.heightM} м | f = ${state.frequencyMHz} МГц`}
        </Text>
      </group>

      {/* Animated radiation pulses */}
      <group ref={pulseRef}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`uhf-pulse-${i}`} position={[0, towerVisH - 0.5, 0]} rotation={[Math.PI / 4, 0, 0]}>
            <torusGeometry args={[1, 0.02, 6, 24]} />
            <meshBasicMaterial color="#ff7043" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Receiver positions (click markers to move house) */}
      {points.map((_pt, i) => {
        const x = rxLayoutX(i);
        const active = i === idx;
        const pI = points[i];
        const imgWeakI = pI.EimgFinal < imgWeakThreshold && !pI.imgBoost;
        const sndWeakI = pI.EsndFinal < sndWeakThreshold && !pI.sndBoost;
        return (
          <group key={`rx-${i}`} position={[x, 0, 0]}>
            <mesh
              position={[0, 0.05, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectIndex(i);
              }}
            >
              <cylinderGeometry args={[active ? 0.16 : 0.13, active ? 0.16 : 0.13, 0.10, 18]} />
              <meshStandardMaterial
                color={active ? '#ffeb3b' : '#90a4ae'}
                emissive={active ? '#ffeb3b' : '#000000'}
                emissiveIntensity={active ? 0.9 : 0}
              />
            </mesh>
            <Text fontSize={0.08} color={active ? '#ffeb3b' : '#cfd8dc'} position={[0, 0.25, 0]}>
              {`r${i + 1}`}
            </Text>

            {/* Усилители: компактнее, чтобы при равном шаге r1…r5 не пересекались */}
            <group position={[-boosterSep, 0.22, 2.0]}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleImg(i);
                }}
              >
                <boxGeometry args={[boosterW, 0.32, 0.34]} />
                <meshStandardMaterial
                  color={pI.imgBoost ? '#00e676' : imgWeakI ? '#ef5350' : '#607d8b'}
                  emissive={pI.imgBoost ? '#00e676' : imgWeakI ? '#ef5350' : '#000000'}
                  emissiveIntensity={pI.imgBoost ? 1.8 : imgWeakI ? 0.8 : 0}
                />
              </mesh>
              <Text fontSize={0.085} color={pI.imgBoost ? '#00e676' : '#ffebee'} position={[0, 0.28, 0]}>
                {pI.imgBoost ? '✓ видео' : '⬆ видео'}
              </Text>
            </group>
            <group position={[boosterSep, 0.22, 2.0]}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSnd(i);
                }}
              >
                <boxGeometry args={[boosterW, 0.32, 0.34]} />
                <meshStandardMaterial
                  color={pI.sndBoost ? '#00b0ff' : sndWeakI ? '#ffa726' : '#607d8b'}
                  emissive={pI.sndBoost ? '#00b0ff' : sndWeakI ? '#ffa726' : '#000000'}
                  emissiveIntensity={pI.sndBoost ? 1.8 : sndWeakI ? 0.8 : 0}
                />
              </mesh>
              <Text fontSize={0.085} color={pI.sndBoost ? '#81d4fa' : '#e3f2fd'} position={[0, 0.28, 0]}>
                {pI.sndBoost ? '✓ звук' : '⬆ звук'}
              </Text>
            </group>
          </group>
        );
      })}

      {/* House with TV at selected position */}
      {p && (
        <group position={[housePosX, 0, -0.28]}>
          {/* house base */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.0, 1.0]} />
            <meshStandardMaterial color="#d7ccc8" roughness={0.95} />
          </mesh>
          {/* roof (raised - no collisions with walls) */}
          <mesh position={[0, 1.43, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.92, 0.9, 4]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.9} />
          </mesh>

          {/* TV set inside / on wall */}
          <mesh position={[0.62, 0.65, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.52, 0.36, 0.12]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          {/* video noise overlay */}
          <mesh position={[0.705, 0.65, 0.002]}>
            <planeGeometry args={[0.44, 0.28]} />
            <meshBasicMaterial color="#000000" transparent opacity={videoNoiseOpacity} />
          </mesh>
          {imgWeak && (
            <Text fontSize={0.12} color="#ff1744" position={[0.70, 0.8, 0.02]}>
              {'✕'}
            </Text>
          )}

          {/* Labels */}
          <Text fontSize={0.12} color="#fff" position={[0, 2.75, 0]}>
            {`Дом-приёмник: r = ${p.rM} м`}
          </Text>
          <Text fontSize={0.1} color="#ffd54f" position={[0, 2.45, 0]}>
            {`E_из=${p.EimgFinal.toFixed(2)} | E_зв=${p.EsndFinal.toFixed(2)} В/м`}
          </Text>

          <Text fontSize={0.09} color="#00695c" position={[0, 2.2, 0]}>
            {'Усилители ставятся на точках r1..r5'}
          </Text>
        </group>
      )}

      <pointLight position={[2, towerVisH + 3, 3.5]} color="#fff5e0" intensity={1} distance={14} decay={2} />
      <pointLight position={[6, 3.2, -1.8]} color="#ffeedd" intensity={0.55} distance={11} decay={2} />
    </>
  );
}

/* ─────────────── Lesson 9: Electric Current through Body ─────────────── */

function BodyElectricScene({ state, timeScale }: { state: LabSceneProps['bodyElecState']; timeScale: number }) {
  const sparkRef = useRef<THREE.Mesh>(null);
  const timeR = useRef(0);

  const touchType = state.touchType ?? 'unipolar';
  const damagedPhases = state.damagedPhases ?? ['A', 'B'];
  const exposureTimeS = Math.max(0.1, Math.min(5, state.exposureTimeS ?? 1));

  /* Compute impedance and current based on touch type */
  const Zk = skinImpedance(state.skinResistanceOhm, state.frequencyHz, state.capacitanceNF * 1e-9);
  const Zt = touchType === 'bipolar' ? totalBodyImpedance(Zk, state.internalResistanceOhm) * 0.5
    : touchType === 'multipolar' ? totalBodyImpedance(Zk, state.internalResistanceOhm) * 0.3
    : totalBodyImpedance(Zk, state.internalResistanceOhm);
  const I = bodyCurrentMA(state.voltageV, Zt);
  const danger = classifyCurrentDanger(I, state.frequencyHz <= 60);

  const dangerColor = danger === 'safe' ? '#4caf50' : danger === 'perceptible' ? '#ff9800' : danger === 'non-releasing' ? '#f44336' : '#d50000';
  const dangerLabel = danger === 'safe' ? 'Безопасный' : danger === 'perceptible' ? 'Ощутимый (покалывание)' : danger === 'non-releasing' ? 'Неотпускающий (сокращение мышц)' : 'Фибрилляция (остановка сердца)!';
  const touchLabel = touchType === 'unipolar' ? 'Однополюсное (одна рука)' : touchType === 'bipolar' ? 'Двухполюсное (две руки)' : 'Многополюсное';

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    if (!sparkRef.current) return;
    const flash = Math.abs(Math.sin(timeR.current * 8));
    const mat = sparkRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = I > 1 ? flash * Math.min(3, I / 10) : 0.1;
  });

  /* Phase wire positions */
  const phasePositions: Record<string, [number, number, number]> = {
    A: [-4, 2.8, -1],
    B: [-4, 2.8, 0],
    C: [-4, 2.8, 1],
    O: [-4, 2.2, 0],
  };

  const phaseColors: Record<string, string> = { A: '#f44336', B: '#2196f3', C: '#4caf50', O: '#9e9e9e' };

  /* Current path based on touch type */
  const showCurrentPathArm1 = true;
  const showCurrentPathArm2 = touchType === 'bipolar' || touchType === 'multipolar';
  const showCurrentPathLegs = touchType === 'multipolar';

  /* Danger level comparison thresholds (per fig 9.4) */
  const dangerLevels = [
    { label: 'Ощутимый', minMA: 0.5, maxMA: 10, color: '#ff9800' },
    { label: 'Неотпускающий', minMA: 10, maxMA: 100, color: '#f44336' },
    { label: 'Фибрилляция', minMA: 100, maxMA: 500, color: '#d50000' },
  ];

  // Simple time-dependent effect boundaries to visualize fig. 9.4 conceptually
  // (exact values are methodical-table dependent; this is a pedagogical approximation).
  const nonReleasingBoundaryMA = exposureTimeS < 0.5 ? 20 : 10;
  const fibrillationBoundaryMA = Math.max(30, Math.min(120, 60 * (1 / Math.sqrt(exposureTimeS))));

  return (
    <>
      <LabRoom width={12} depth={10} height={3.5} />
      <LabDesk position={[-2, 0, 0]} />

      {/* Three-phase network wires (A, B, C) + Neutral (O) */}
      {(['A', 'B', 'C', 'O'] as const).map((phase) => {
        const pos = phasePositions[phase];
        const isDamaged = damagedPhases.includes(phase);
        return (
          <group key={`phase-${phase}`}>
            {/* Wire */}
            <mesh position={[pos[0] + 2, pos[1], pos[2]]}>
              <boxGeometry args={[6, 0.03, 0.03]} />
              <meshStandardMaterial
                color={phaseColors[phase]}
                emissive={isDamaged ? '#ff0000' : '#000'}
                emissiveIntensity={isDamaged ? 0.8 : 0}
              />
            </mesh>
            <Text fontSize={0.12} color={phaseColors[phase]} position={[pos[0] - 0.3, pos[1] + 0.15, pos[2]]}>
              {phase === 'O' ? 'N (нейтраль)' : `Фаза ${phase}`}
            </Text>
            {/* Resistance symbol between wires */}
            {phase !== 'O' && (
              <mesh position={[pos[0] + 0.5, pos[1] - 0.15, pos[2]]}>
                <boxGeometry args={[0.2, 0.08, 0.08]} />
                <meshStandardMaterial color="#795548" />
              </mesh>
            )}
            {/* Damaged insulation indicator */}
            {isDamaged && (
              <mesh position={[0, pos[1], pos[2]]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#ff1744" emissive="#ff0000" emissiveIntensity={2} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Equipment box (ЭО) */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.8, 1.0, 0.6]} />
        <meshStandardMaterial color="#455a64" metalness={0.4} />
      </mesh>
      <Text fontSize={0.1} color="#eceff1" position={[0, 1.8, 0.35]}>
        {'ЭО'}
      </Text>

      {/* Spark at contact point */}
      <mesh ref={sparkRef} position={[0.4, 1.5, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffeb3b" emissiveIntensity={1} />
      </mesh>

      {/* Human figure */}
      <group position={[1.5, 0, 0]}>
        {/* Body (colored by danger level) */}
        <mesh position={[0, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.6, 8, 16]} />
          <meshStandardMaterial color={dangerColor} transparent opacity={0.7} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.3, 0]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>

        {/* Right arm (always touching) */}
        <mesh position={[-0.5, 1.0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>

        {/* Left arm (touching for bipolar/multipolar) */}
        {showCurrentPathArm2 && (
          <mesh position={[0.5, 1.0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.08, 0.6, 0.08]} />
            <meshStandardMaterial color="#ffd6b6" />
          </mesh>
        )}

        {/* Legs */}
        <mesh position={[-0.12, 0.0, 0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position={[0.12, 0.0, 0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>

        {/* ── RED CURRENT PATH highlight ── */}
        {/* Path through right arm */}
        {showCurrentPathArm1 && I > 0.5 && (
          <mesh position={[-0.5, 1.0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.12, 0.65, 0.12]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.35} />
          </mesh>
        )}
        {/* Path through body */}
        {I > 0.5 && (
          <mesh position={[0, 0.6, 0]}>
            <capsuleGeometry args={[0.26, 0.65, 8, 16]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.25} />
          </mesh>
        )}
        {/* Path through left arm (bipolar) */}
        {showCurrentPathArm2 && I > 0.5 && (
          <mesh position={[0.5, 1.0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.12, 0.65, 0.12]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.35} />
          </mesh>
        )}
        {/* Ground return path through legs (unipolar: arm→body→legs→ground) */}
        {touchType === 'unipolar' && I > 0.5 && (
          <>
            <mesh position={[-0.12, 0.0, 0]}>
              <boxGeometry args={[0.14, 0.55, 0.14]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.25} />
            </mesh>
            <mesh position={[0.12, 0.0, 0]}>
              <boxGeometry args={[0.14, 0.55, 0.14]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.25} />
            </mesh>
          </>
        )}
        {/* Path through legs (multipolar: all limbs) */}
        {showCurrentPathLegs && I > 0.5 && (
          <>
            <mesh position={[-0.12, 0.0, 0]}>
              <boxGeometry args={[0.14, 0.55, 0.14]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
            </mesh>
            <mesh position={[0.12, 0.0, 0]}>
              <boxGeometry args={[0.14, 0.55, 0.14]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
            </mesh>
          </>
        )}
      </group>

      {/* Ground wire */}
      <mesh position={[1.5, 0.15, 0]}>
        <boxGeometry args={[0.02, 0.3, 0.02]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>

      {/* ── Danger level comparison panel (per fig 9.4) ── */}
      <group position={[4, 0.5, -2]}>
        <Text fontSize={0.1} color="#fff" position={[0, 2.2, 0]}>
          {'Сравнение уровней тока (рис. 9.4)'}
        </Text>
        {/* I(t) plane: x=time (0..5s), y=current (0..150mA) */}
        <group position={[0, 0.2, 0]}>
          <mesh position={[0.75, 0.9, 0]} rotation={[0, 0, 0]}>
            <planeGeometry args={[1.6, 1.6]} />
            <meshStandardMaterial color="#111" transparent opacity={0.35} />
          </mesh>

          {/* bands */}
          <mesh position={[0.75, 0.4, 0.01]}>
            <planeGeometry args={[1.6, 0.55]} />
            <meshStandardMaterial color="#ff9800" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0.75, 0.95, 0.01]}>
            <planeGeometry args={[1.6, 0.55]} />
            <meshStandardMaterial color="#f44336" transparent opacity={0.22} />
          </mesh>
          <mesh position={[0.75, 1.5, 0.01]}>
            <planeGeometry args={[1.6, 0.55]} />
            <meshStandardMaterial color="#d50000" transparent opacity={0.18} />
          </mesh>

          {/* marker for current point (t, I) */}
          {(() => {
            const x = (exposureTimeS / 5) * 1.6; // 0..1.6
            const y = Math.min(1.6, (Math.min(150, I) / 150) * 1.6);
            const mx = 0.75 - 0.8 + x;
            const my = 0.9 - 0.8 + y;
            const zone = I < 0.5 ? 'безопасно' : I < nonReleasingBoundaryMA ? 'ощутимо' : I < fibrillationBoundaryMA ? 'неотпускающий' : 'фибрилляция';
            const zoneColor = zone === 'безопасно' ? '#4caf50' : zone === 'ощутимо' ? '#ff9800' : zone === 'неотпускающий' ? '#f44336' : '#d50000';
            return (
              <group>
                <mesh position={[mx, my, 0.03]}>
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshStandardMaterial color={zoneColor} emissive={zoneColor} emissiveIntensity={1.2} />
                </mesh>
                <Text fontSize={0.075} color="#fff" position={[0.75, 1.75, 0.03]}>
                  {`t=${exposureTimeS.toFixed(1)} c; I=${I.toFixed(1)} мА`}
                </Text>
                <Text fontSize={0.07} color={zoneColor} position={[0.75, 1.62, 0.03]}>
                  {`зона: ${zone}`}
                </Text>
              </group>
            );
          })()}

          <Text fontSize={0.105} color="#e65100" position={[0.0, 0.1, 0.03]}>
            {'0 c'}
          </Text>
          <Text fontSize={0.085} color="#e65100" position={[1.6, 0.1, 0.03]}>
            {'5 c'}
          </Text>
          <Text fontSize={0.085} color="#e65100" position={[-0.05, 0.9, 0.03]}>
            {'I'}
          </Text>
          <Text fontSize={0.085} color="#e65100" position={[0.75, -0.02, 0.03]}>
            {'t'}
          </Text>
          <Text fontSize={0.085} color="#e65100" position={[0.75, 0.25, 0.03]}>
            {`границы: неотп.≈${nonReleasingBoundaryMA} мА; фибр.≈${fibrillationBoundaryMA.toFixed(0)} мА`}
          </Text>
        </group>
      </group>

      {/* Info panel */}
      <Text fontSize={0.16} color={dangerColor} position={[1.5, 2.2, 0]}>
        {`I = ${I.toFixed(2)} мА — ${dangerLabel}`}
      </Text>
      <Text fontSize={0.11} color="#90caf9" position={[1.5, 1.95, 0]}>
        {`Z = ${Zt.toFixed(0)} Ом | ${touchLabel}`}
      </Text>
      <Text fontSize={0.1} color="#1976d2" position={[1.5, 1.8, 0]}>
        {`Повреждение: ${damagedPhases[0]}↔${damagedPhases[1]} | U = ${state.voltageV} В`}
      </Text>
    </>
  );
}

/* ─────────────── Lesson 11: Three-phase network & touch path ─────────────── */

function ThreePhaseNeutralScene({
  state,
  timeScale,
}: {
  state: NonNullable<LabSceneProps['threePhaseState']>;
  timeScale: number;
}) {
  const pulseRef = useRef(0);
  useFrame((_, delta) => {
    pulseRef.current += delta * timeScale;
  });
  const { UprV, ImA } = lesson11TouchEstimate({
    network: state.network,
    regime: state.network === 'IT' ? 'normal' : state.regime,
    touchedPhaseIndex: state.touchedPhaseIndex,
    UphiV: state.UphiV,
    RhOhm: state.RhOhm,
    RgOhm: state.RgOhm,
    RzmOhm: state.RzmOhm,
    RisoOhm: state.RisoOhm,
  });
  const danger = classifyCurrentDanger(ImA, true);
  const dangerColor =
    danger === 'safe'
      ? '#4caf50'
      : danger === 'perceptible'
        ? '#ff9800'
        : danger === 'non-releasing'
          ? '#f44336'
          : '#d50000';

  const phaseColors = ['#c62828', '#1565c0', '#2e7d32'];
  const phaseLabels = ['L1', 'L2', 'L3'];
  const rStar = 2.4;
  const yW = 2.65;
  const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3];
  const phaseEnds = angles.map((a) => [rStar * Math.cos(a), yW, rStar * Math.sin(a)] as [number, number, number]);
  const touched = Math.min(2, Math.max(0, state.touchedPhaseIndex));
  const end = phaseEnds[touched];
  const personPos: [number, number, number] = [end[0] * 1.28, 0.35, end[2] * 1.28];
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(pulseRef.current * 5));

  /** Поворот тела к фазе; сустав — боковое плечо (+ малый вынос вперёд), не середина груди по Z */
  const armPose = (() => {
    const shoulderY = 0.96;
    const shoulderLat = 0.19;
    const shoulderForwardZ = 0.055;
    const wireTip = new THREE.Vector3(end[0] - personPos[0], yW - personPos[1], end[2] - personPos[2]);
    const horizLen = Math.hypot(wireTip.x, wireTip.z);
    const bodyYaw = horizLen > 1e-4 ? Math.atan2(wireTip.x, wireTip.z) : 0;
    const wireLocal = wireTip.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -bodyYaw);
    const shoulderSign = Math.abs(wireLocal.x) > 0.025 ? Math.sign(wireLocal.x) : 1;
    const shoulderSideX = shoulderSign * shoulderLat;
    const shoulderLocal = new THREE.Vector3(shoulderSideX, shoulderY, shoulderForwardZ);
    const reach = wireLocal.clone().sub(shoulderLocal);
    const reachLen = reach.length();
    const armYawLocal = Math.hypot(reach.x, reach.z) > 1e-4 ? Math.atan2(reach.x, reach.z) : 0;
    const elev = (70 * Math.PI) / 180;
    const pitchFromVertical = Math.PI / 2 - elev;
    const armLen = Math.min(0.78, Math.max(0.42, reachLen > 1e-4 ? reachLen * 0.88 : 0.52));
    return { bodyYaw, shoulderSideX, shoulderY, shoulderForwardZ, armYawLocal, pitchFromVertical, armLen };
  })();

  const showFault = state.network === 'TN' && state.regime === 'emergency';
  const faultEnd = phaseEnds[0];
  const faultGround: [number, number, number] = [faultEnd[0] * 1.15, 0.08, faultEnd[2] * 1.15];
  const faultOnL1: [number, number, number] = [faultEnd[0] * 0.92, yW - 0.08, faultEnd[2] * 0.92];

  /** Сегмент «проводник + контакт с землёй» между двумя маркерами КЗ */
  const faultArc = (() => {
    if (!showFault) return null;
    const a = new THREE.Vector3(...faultOnL1);
    const b = new THREE.Vector3(...faultGround);
    const seg = b.clone().sub(a);
    const segLen = seg.length();
    if (segLen < 1e-3) return null;
    const u = seg.clone().multiplyScalar(1 / segLen);
    const gapTop = 0.1;
    const gapBot = 0.09;
    const h = Math.max(0.04, segLen - gapTop - gapBot);
    const mid = a.clone().add(u.clone().multiplyScalar(gapTop + h / 2));
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
    return { position: mid, quat, height: h };
  })();

  const netLabel = state.network === 'IT' ? 'ИТ (изолированная нейтраль)' : 'TN (заземлённая нейтраль)';
  const regimeLabel =
    state.network === 'IT' ? 'нормальный режим' : state.regime === 'normal' ? 'нормальный режим' : 'авария: L1 → земля';

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#e2ddd4" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Трансформатор / звезда — условно */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.55, 1.5, 0.45]} />
        <meshStandardMaterial color="#6d6d6d" metalness={0.35} />
      </mesh>
      <Text fontSize={0.11} color="#eceff1" position={[0, 2.25, 0.28]}>
        Трёхфазный источник
      </Text>

      {/* Нейтральная точка */}
      <mesh position={[0, yW, 0]} castShadow>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#9e9e9e" emissive="#424242" emissiveIntensity={0.15} />
      </mesh>
      <Text fontSize={0.1} color="#bdbdbd" position={[0, yW + 0.35, 0]}>
        N
      </Text>

      {/* Фазные проводники */}
      {phaseEnds.map((p, i) => {
        const dx = p[0];
        const dz = p[2];
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const midX = ux * (rStar * 0.5);
        const midZ = uz * (rStar * 0.5);
        const isTouched = i === touched;
        return (
          <group key={`ph-${i}`}>
            <mesh position={[midX, yW, midZ]} rotation={[0, Math.atan2(dx, dz), 0]}>
              <boxGeometry args={[0.06, 0.06, rStar]} />
              <meshStandardMaterial
                color={phaseColors[i]}
                emissive={isTouched ? phaseColors[i] : '#000'}
                emissiveIntensity={isTouched ? 0.35 : 0}
              />
            </mesh>
            <Text fontSize={0.1} color={phaseColors[i]} position={[dx * 1.08, yW + 0.2, dz * 1.08]}>
              {phaseLabels[i]}
            </Text>
          </group>
        );
      })}

      {/* Заземление нейтрали (TN) */}
      {state.network === 'TN' && (
        <group>
          <mesh position={[0, yW * 0.35, 0]}>
            <cylinderGeometry args={[0.025, 0.025, yW * 0.75, 8]} />
            <meshStandardMaterial color="#fdd835" metalness={0.5} />
          </mesh>
          <mesh position={[0.35, 0.12, 0]}>
            <boxGeometry args={[0.5, 0.06, 0.35]} />
            <meshStandardMaterial color="#795548" />
          </mesh>
          <Text fontSize={0.085} color="#fdd835" position={[0.9, 0.35, 0]}>
            {`R_з = ${state.RgOhm} Ом`}
          </Text>
        </group>
      )}

      {state.network === 'IT' && (
        <Text fontSize={0.09} color="#90caf9" position={[-1.2, 0.5, 2.2]}>
          {`Нейтраль не соединена с землёй; R_из ≈ ${state.RisoOhm} Ом/фаза`}
        </Text>
      )}

      {/* КЗ фазы на землю: точка на L1 — токоведущая связь — точка на земле */}
      {showFault && faultArc && (
        <group>
          <mesh position={faultOnL1}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color="#ff5722" emissive="#ff1744" emissiveIntensity={0.5 * pulse} />
          </mesh>
          <mesh position={faultArc.position} quaternion={faultArc.quat} castShadow>
            <cylinderGeometry args={[0.035, 0.035, faultArc.height, 10]} />
            <meshStandardMaterial color="#bf360c" emissive="#ff3d00" emissiveIntensity={0.25 * pulse} metalness={0.35} roughness={0.45} />
          </mesh>
          <mesh position={faultGround}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <Text fontSize={0.085} color="#ffab91" position={[faultGround[0] + 0.55, 0.5, faultGround[2]]}>
            {`L1→земля, R_зм = ${state.RzmOhm} Ом`}
          </Text>
        </group>
      )}

      {/* Человек: корпус и ноги повёрнуты к фазе (bodyYaw), рука донастроена в локальных осях */}
      <group position={personPos}>
        <group rotation={[0, armPose.bodyYaw, 0]}>
          {/* Ноги вдоль ±X, «вперёд» к фазе — +Z после bodyYaw; обувь/стилизация как в теории №9 */}
          {(() => {
            const floorLocalY = -personPos[1];
            const torsoBottomY = 0.55 - (0.52 / 2 + 0.2);
            const footHalfSep = 0.1;
            const pants = '#455a64';
            const shoe = '#37474f';
            const shoeCenterY = floorLocalY + 0.03;
            const legRadius = 0.055;
            const legCylH = Math.max(0.12, torsoBottomY - shoeCenterY - 0.03 - 2 * legRadius);
            const legHalf = legCylH / 2 + legRadius;
            const legCenterY = torsoBottomY - legHalf;
            return (
              <>
                <mesh position={[-footHalfSep, shoeCenterY, 0]} castShadow>
                  <boxGeometry args={[0.12, 0.06, 0.22]} />
                  <meshStandardMaterial color={shoe} roughness={0.65} />
                </mesh>
                <mesh position={[footHalfSep, shoeCenterY, 0]} castShadow>
                  <boxGeometry args={[0.12, 0.06, 0.22]} />
                  <meshStandardMaterial color={shoe} roughness={0.65} />
                </mesh>
                <mesh position={[-footHalfSep, legCenterY, 0]} castShadow>
                  <capsuleGeometry args={[legRadius, legCylH, 6, 10]} />
                  <meshStandardMaterial color={pants} roughness={0.82} />
                </mesh>
                <mesh position={[footHalfSep, legCenterY, 0]} castShadow>
                  <capsuleGeometry args={[legRadius, legCylH, 6, 10]} />
                  <meshStandardMaterial color={pants} roughness={0.82} />
                </mesh>
              </>
            );
          })()}
          <mesh position={[0, 0.55, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.52, 6, 12]} />
            <meshStandardMaterial color={dangerColor} transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#ffccbc" />
          </mesh>
          <group position={[armPose.shoulderSideX, armPose.shoulderY, armPose.shoulderForwardZ]} rotation={[0, armPose.armYawLocal, 0]}>
            <group rotation={[armPose.pitchFromVertical, 0, 0]}>
              <mesh position={[0, armPose.armLen * 0.5, 0]} castShadow>
                <boxGeometry args={[0.065, armPose.armLen, 0.065]} />
                <meshStandardMaterial color="#ffccbc" />
              </mesh>
              {ImA > 0.5 && (
                <mesh position={[0, armPose.armLen * 0.5, 0]}>
                  <boxGeometry args={[0.095, armPose.armLen + 0.04, 0.095]} />
                  <meshBasicMaterial color="#ff1744" transparent opacity={0.28 * pulse} />
                </mesh>
              )}
            </group>
          </group>
        </group>
      </group>

      <Text fontSize={0.13} color="#fff59d" position={[2.3, 3.25, 0]}>
        {`${netLabel} · ${regimeLabel}`}
      </Text>
      <Text fontSize={0.12} color="#e1f5fe" position={[2.3, 2.95, 0]}>
        {`U_ф = ${state.UphiV} В  →  Uпр ≈ ${UprV.toFixed(1)} В`}
      </Text>
      <Text fontSize={0.14} color={dangerColor} position={[2.3, 2.55, 0]}>
        {`I_h ≈ ${ImA.toFixed(2)} мА`}
      </Text>
      <Text fontSize={0.085} color="#b0bec5" position={[2.3, 2.22, 0]}>
        {`Касание: ${phaseLabels[touched]} · R_h = ${state.RhOhm} Ом`}
      </Text>
    </>
  );
}

/* ─────────────── Lesson 12: TN grounding / bonding / neutral break ─────────────── */

function TnEarthingLabScene({
  state,
  timeScale,
}: {
  state: NonNullable<LabSceneProps['tnEarthingState']>;
  timeScale: number;
}) {
  const pulseRef = useRef(0);
  useFrame((_, delta) => {
    pulseRef.current += delta * timeScale;
  });
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(pulseRef.current * 5));
  const { IkzA, UenclosureV, IbodyMA, caption } = lesson12TnLabEstimate(state);
  const danger = classifyCurrentDanger(IbodyMA, true);
  const dangerColor =
    danger === 'safe'
      ? '#4caf50'
      : danger === 'perceptible'
        ? '#ff9800'
        : danger === 'non-releasing'
          ? '#f44336'
          : '#d50000';

  const yPEN = 2.35;
  const xN = -2.1;
  const xEquip = 1.85;
  /** Длина фазной жилы и угол L1 совпадают с отрисовкой ниже (i = 0 → L1). */
  const phaseLenL12 = 1.35;
  const l1Ang = Math.PI / 2;
  const l1Dx = phaseLenL12 * Math.cos(l1Ang);
  const l1Dz = phaseLenL12 * Math.sin(l1Ang);
  /** Внешний конец жилы L1 (центр бруска + половина длины вдоль направления от N). */
  const l1Tip: [number, number, number] = [xN + l1Dx * 0.95, yPEN, l1Dz * 0.95];
  const hasBreak =
    state.scenario === 'break_after_fault' ||
    state.scenario === 'break_before_ok' ||
    state.scenario === 'break_after_repeat' ||
    state.scenario === 'break_before_repeat';
  const hasRepeatGround =
    state.scenario === 'sc_enclosure_repeat' ||
    state.scenario === 'break_after_repeat' ||
    state.scenario === 'break_before_repeat';
  const showArcToEnclosure =
    state.scenario === 'sc_enclosure' ||
    state.scenario === 'sc_enclosure_repeat' ||
    hasBreak;
  const showPhaseSoil = state.scenario === 'phase_to_soil';

  const breakGap = 0.35;
  const xBreakLeft = -0.15;
  const xBreakRight = xBreakLeft + breakGap;
  const penEndX = xEquip - 0.15;

  const penSegments = (() => {
    if (!hasBreak) {
      return [{ x0: xN, x1: penEndX }];
    }
    return [
      { x0: xN, x1: xBreakLeft },
      { x0: xBreakRight, x1: penEndX },
    ];
  })();

  const l1FaultPoint: [number, number, number] = l1Tip;
  const enclosureTop: [number, number, number] = [xEquip, 1.05, 0];
  const personPos: [number, number, number] = [xEquip + 0.95, 0.35, 0.25];

  const arcMid = (() => {
    if (!showArcToEnclosure) return null;
    const a = new THREE.Vector3(...l1FaultPoint);
    const b = new THREE.Vector3(...enclosureTop);
    const seg = b.clone().sub(a);
    const L = seg.length();
    if (L < 1e-3) return null;
    const u = seg.multiplyScalar(1 / L);
    const mid = a.clone().add(u.clone().multiplyScalar(L * 0.5));
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
    return { position: mid, quat, height: Math.max(0.12, L - 0.16) };
  })();

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color="#ded8ce" roughness={0.92} />
      </mesh>

      <mesh position={[xN - 0.4, 1.2, 0]} castShadow>
        <boxGeometry args={[0.85, 1.45, 0.55]} />
        <meshStandardMaterial color="#616161" metalness={0.25} />
      </mesh>
      <Text fontSize={0.1} color="#eceff1" position={[xN - 0.4, 2.05, 0.32]}>
        Трансформатор
      </Text>

      <mesh position={[xN, yPEN, 0]} castShadow>
        <sphereGeometry args={[0.085, 14, 14]} />
        <meshStandardMaterial color="#9e9e9e" emissive="#333" emissiveIntensity={0.12} />
      </mesh>
      <Text fontSize={0.095} color="#bdbdbd" position={[xN, yPEN + 0.32, 0]}>
        N
      </Text>

      {(['#c62828', '#1565c0', '#2e7d32'] as const).map((col, i) => {
        const ang = Math.PI / 2 + (i * 2 * Math.PI) / 3;
        const len = phaseLenL12;
        const dx = len * Math.cos(ang);
        const dz = len * Math.sin(ang);
        const mx = xN + dx * 0.45;
        const mz = dz * 0.45;
        return (
          <group key={`l12-ph-${i}`}>
            <mesh position={[mx, yPEN, mz]} rotation={[0, Math.atan2(dx, dz), 0]}>
              <boxGeometry args={[0.055, 0.055, len]} />
              <meshStandardMaterial color={col} metalness={0.15} />
            </mesh>
            <Text fontSize={0.085} color={col} position={[xN + dx * 1.22, yPEN + 0.2, dz * 1.22]}>
              {['L1', 'L2', 'L3'][i]}
            </Text>
          </group>
        );
      })}

      {penSegments.map((seg, i) => (
        <mesh key={`pen-${i}`} position={[(seg.x0 + seg.x1) / 2, yPEN, 0]} castShadow>
          <boxGeometry args={[Math.abs(seg.x1 - seg.x0), 0.05, 0.05]} />
          <meshStandardMaterial color="#fdd835" metalness={0.35} />
        </mesh>
      ))}

      {hasBreak && (
        <Text fontSize={0.08} color="#ff5722" position={[(xBreakLeft + xBreakRight) / 2, yPEN + 0.28, 0]}>
          обрыв PEN
        </Text>
      )}

      <group position={[xN, 0.12, 0]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, yPEN - 0.2, 8]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[0.45, 0.05, 0.35]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        <Text fontSize={0.075} color="#fbc02d" position={[0.72, 0.2, 0]}>
          {`R_0 = ${state.R0Ohm} Ом`}
        </Text>
      </group>

      {hasRepeatGround && (
        <group position={[0.5, 0.12, 0]}>
          <mesh>
            <cylinderGeometry args={[0.028, 0.028, yPEN - 0.22, 8]} />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
          <mesh position={[0.15, 0, 0.15]}>
            <boxGeometry args={[0.36, 0.05, 0.28]} />
            <meshStandardMaterial color="#4e342e" />
          </mesh>
          {/* Отвод повторного заземления нуля: электрод ↔ точка подключения на PEN */}
          <mesh position={[0, yPEN - 0.12, 0]} castShadow>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#fdd835" metalness={0.35} />
          </mesh>
          <mesh position={[0, (yPEN - 0.12) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, yPEN - 0.12, 10]} />
            <meshStandardMaterial color="#fdd835" metalness={0.35} />
          </mesh>
          <Text fontSize={0.072} color="#ffe082" position={[0.88, 0.25, 0.15]}>
            {`R_n = ${state.RnOhm} Ом`}
          </Text>
        </group>
      )}

      <mesh position={[xEquip, 0.55, 0]} castShadow>
        <boxGeometry args={[0.95, 0.95, 0.65]} />
        <meshStandardMaterial
          color={UenclosureV > 30 ? '#90a4ae' : '#78909c'}
          metalness={0.45}
          roughness={0.35}
          emissive={UenclosureV > 25 ? '#ff7043' : '#000000'}
          emissiveIntensity={UenclosureV > 25 ? (UenclosureV > 120 ? 0.35 : 0.15) * pulse : 0}
        />
      </mesh>
      <Text fontSize={0.088} color="#eceff1" position={[xEquip, 1.12, 0.38]}>
        Занулённый корпус
      </Text>

      {showArcToEnclosure && arcMid && (
        <group>
          <mesh position={l1FaultPoint}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#ff5722" emissive="#ff1744" emissiveIntensity={0.45 * pulse} />
          </mesh>
          <mesh position={arcMid.position} quaternion={arcMid.quat}>
            <cylinderGeometry args={[0.03, 0.03, arcMid.height, 10]} />
            <meshStandardMaterial color="#bf360c" emissive="#ff3d00" emissiveIntensity={0.28 * pulse} metalness={0.3} />
          </mesh>
        </group>
      )}

      {showPhaseSoil && (
        <group>
          <mesh position={[l1Tip[0], 0.65, l1Tip[2]]} rotation={[Math.PI / 3, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 2.2, 8]} />
            <meshStandardMaterial color="#3e2723" />
          </mesh>
          <mesh position={[l1Tip[0] + 0.8, 0.08, l1Tip[2] + 0.5]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          <Text fontSize={0.078} color="#ffab91" position={[l1Tip[0] + 1.2, 0.45, l1Tip[2] + 0.5]}>
            {`L1 → земля, R_зм = ${state.RzmOhm} Ом`}
          </Text>
        </group>
      )}

      <group position={personPos}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <capsuleGeometry args={[0.18, 0.48, 6, 10]} />
          <meshStandardMaterial color={dangerColor} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color="#ffccbc" />
        </mesh>
        <mesh position={[-0.22, 0.75, -0.35]} rotation={[0.55, 0.25, 0]}>
          <boxGeometry args={[0.055, 0.42, 0.055]} />
          <meshStandardMaterial color="#ffccbc" />
        </mesh>
        {IbodyMA > 0.8 && (
          <mesh position={[-0.22, 0.75, -0.35]}>
            <boxGeometry args={[0.09, 0.45, 0.09]} />
            <meshBasicMaterial color="#ff1744" transparent opacity={0.22 * pulse} />
          </mesh>
        )}
      </group>

      <Text fontSize={0.12} color="#fff9c4" position={[-4.65, 3.15, 0]}>
        TN · зануление · петля КЗ
      </Text>
      <Text fontSize={0.095} color="#e1f5fe" position={[-4.65, 2.78, 0]} maxWidth={6}>
        {caption}
      </Text>
      <Text fontSize={0.1} color="#b0bec5" position={[-4.65, 2.42, 0]}>
        {`I_к.з. ≈ ${IkzA.toFixed(1)} А  |  Z_n = ${state.ZnOhm} Ом  |  Z_H = ${state.ZHOhm} Ом`}
      </Text>
      <Text fontSize={0.13} color="#ffcc80" position={[-4.65, 2.05, 0]}>
        {`U_корп ≈ ${UenclosureV.toFixed(1)} В`}
      </Text>
      <Text fontSize={0.15} color={dangerColor} position={[-4.65, 1.65, 0]}>
        {`I_h ≈ ${IbodyMA.toFixed(2)} мА`}
      </Text>
    </>
  );
}

/* ─────────────── Lesson 10: Step Voltage ─────────────── */

function StepVoltageScene({ state, timeScale }: { state: LabSceneProps['groundState']; timeScale: number }) {
  const ringRef = useRef<THREE.Group>(null);
  const timeR = useRef(0);

  const surfaceType = state.surfaceType ?? 'earth';
  const phi = groundPotential(state.faultCurrentA, state.soilResistivityOhmM, state.distanceM);
  const Ush = stepVoltage(state.faultCurrentA, state.soilResistivityOhmM, state.distanceM, state.stepLengthM);
  const safeDist = safeDistance(state.faultCurrentA, state.soilResistivityOhmM, 40, state.stepLengthM);

  /* Danger zone radius: 5–25 m based on voltage (Uш) */
  const dangerRadius = (() => {
    const u = Math.min(200, Math.max(0, Math.abs(Ush)));
    return 5 + (u / 200) * 20;
  })();
  const scaledDangerRadius = Math.min(10, dangerRadius);

  /* Surface properties */
  const surfaceColors: Record<string, string> = { earth: '#5d4037', sand: '#c8a96e', stone: '#78909c' };
  const surfaceRoughness: Record<string, number> = { earth: 0.95, sand: 0.8, stone: 0.6 };

  /* x1 and x2 positions for step voltage visualization */
  const personX = Math.min(8, state.distanceM);
  const x1 = state.distanceM;
  const x2 = state.distanceM + state.stepLengthM;

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    if (!ringRef.current) return;
    ringRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const t = (timeR.current * 0.6 + i * 0.8) % 4;
      const s = 0.5 + t * 2.5;
      // Uniform scale keeps rings visually circular
      mesh.scale.set(s, s, s);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0.02, 0.35 - t * 0.09);
    });
  });

  return (
    <>
      {/* Ground surface - changes with surface type */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial color={surfaceColors[surfaceType]} roughness={surfaceRoughness[surfaceType]} />
      </mesh>

      {/* Surface type texture details */}
      {surfaceType === 'sand' && (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <mesh key={`sand-${i}`} position={[(i % 5) * 4 - 8, 0.01, Math.floor(i / 5) * 4 - 8]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.3 + Math.random() * 0.3, 8]} />
              <meshStandardMaterial color="#b8956a" transparent opacity={0.3} />
            </mesh>
          ))}
        </>
      )}
      {surfaceType === 'stone' && (
        <>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={`stone-${i}`} position={[(i % 4) * 5 - 7.5, 0.05, Math.floor(i / 4) * 5 - 5]}>
              <boxGeometry args={[0.8 + (i % 3) * 0.3, 0.1, 0.6 + (i % 2) * 0.3]} />
              <meshStandardMaterial color="#90a4ae" roughness={0.5} />
            </mesh>
          ))}
        </>
      )}

      {/* Three-phase power line with fallen wire */}
      {/* Standing pole */}
      <mesh position={[-3, 3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 6, 8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {/* Cross-arm */}
      <mesh position={[-3, 5.5, 0]}>
        <boxGeometry args={[2, 0.08, 0.08]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* 3 phase wires on pole */}
      {[-0.7, 0, 0.7].map((zOff, wi) => (
        <mesh key={`wire-${wi}`} position={[-3, 5.5, zOff]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color={['#f44336', '#2196f3', '#4caf50'][wi]} />
        </mesh>
      ))}

      {/* Fallen wire from pole to ground (fault point) */}
      <mesh position={[-1.5, 2.5, 0]} rotation={[0, 0, Math.PI / 5]}>
        <boxGeometry args={[0.025, 4.5, 0.025]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Grounding electrode / fault point (where wire touches ground) */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1, 12]} />
        <meshStandardMaterial color="#616161" metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ff5722" emissive="#ff3300" emissiveIntensity={1.5} />
      </mesh>
      <Text fontSize={0.16} color="#ff7043" position={[0, 1.6, 0]}>
        {`Iз = ${state.faultCurrentA} А | ρ = ${state.soilResistivityOhmM} Ом·м`}
      </Text>
      <Text fontSize={0.1} color="#ffab91" position={[0, 1.35, 0]}>
        {`Поверхность: ${surfaceType === 'earth' ? 'Земля' : surfaceType === 'sand' ? 'Песок' : 'Камень'}`}
      </Text>

      {/* Danger zone circle on ground */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, scaledDangerRadius, 64]} />
        <meshBasicMaterial color="#ff5722" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scaledDangerRadius - 0.1, scaledDangerRadius, 64]} />
        <meshBasicMaterial color="#ff5722" transparent opacity={0.5} />
      </mesh>
      <Text fontSize={0.12} color="#ff8a65" position={[scaledDangerRadius + 0.5, 0.1, 0]}>
        {`Зона: ${dangerRadius.toFixed(1)} м (по Uш)`}
      </Text>

      {/* Animated concentric rings (equipotential zones) */}
      <group ref={ringRef}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`eq-ring-${i}`} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.0, 64]} />
            <meshBasicMaterial color="#ff9800" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Person at observation distance */}
      <group position={[personX, 0, 0]}>
        {/* Body */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.18, 0.5, 8, 16]} />
          <meshStandardMaterial color={Ush > 40 ? '#f44336' : '#4caf50'} transparent opacity={0.7} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.3, 0.9, 0]} rotation={[0, 0, Math.PI / 8]}>
          <boxGeometry args={[0.07, 0.4, 0.07]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>
        <mesh position={[0.3, 0.9, 0]} rotation={[0, 0, -Math.PI / 8]}>
          <boxGeometry args={[0.07, 0.4, 0.07]} />
          <meshStandardMaterial color="#ffd6b6" />
        </mesh>
        {/* Legs with visible feet positions */}
        <mesh position={[-0.12, 0.0, 0]}>
          <boxGeometry args={[0.1, 0.45, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position={[state.stepLengthM * 0.4, 0.0, 0]}>
          <boxGeometry args={[0.1, 0.45, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>

        {/* x1 distance line (front foot to fault point) */}
        <mesh position={[-personX / 2 - 0.06, 0.04, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[personX - 0.12, 0.03]} />
          <meshBasicMaterial color="#42a5f5" />
        </mesh>
        <Text fontSize={0.1} color="#42a5f5" position={[-personX / 2, 0.2, -0.5]}>
          {`x₁ = ${x1.toFixed(1)} м`}
        </Text>

        {/* x2 distance line (back foot to fault point) */}
        <mesh position={[-personX / 2 + state.stepLengthM * 0.2, 0.04, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[personX + state.stepLengthM * 0.4, 0.03]} />
          <meshBasicMaterial color="#ef5350" />
        </mesh>
        <Text fontSize={0.1} color="#ef5350" position={[-personX / 2 + state.stepLengthM * 0.2, 0.2, 0.5]}>
          {`x₂ = ${x2.toFixed(1)} м`}
        </Text>

        {/* Step length indicator between feet */}
        <mesh position={[state.stepLengthM * 0.2 - 0.06, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[state.stepLengthM * 0.4 + 0.12, 0.06]} />
          <meshBasicMaterial color="#ffd43b" />
        </mesh>
        <Text fontSize={0.09} color="#ffd43b" position={[state.stepLengthM * 0.2, 0.15, 0.3]}>
          {`a = ${state.stepLengthM} м`}
        </Text>
      </group>

      {/* Results */}
      <Text fontSize={0.18} color={Ush > 40 ? '#ff5252' : '#66bb6a'} position={[personX, 2.0, 0]}>
        {`Uш = ${Ush.toFixed(1)} В`}
      </Text>
      <Text fontSize={0.12} color="#fff176" position={[personX, 1.75, 0]}>
        {`φ = ${phi.toFixed(1)} В`}
      </Text>
      <Text fontSize={0.1} color="#1976d2" position={[personX, 1.55, 0]}>
        {Ush > 40 ? '⚠ Опасное напряжение шага!' : '✓ Безопасно'}
      </Text>

      {/* Safe distance marker */}
      {safeDist < 20 && (
        <group position={[Math.min(9, safeDist), 0, -1]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.08, 1, 0.08]} />
            <meshStandardMaterial color="#4caf50" />
          </mesh>
          <Text fontSize={0.11} color="#66bb6a" position={[0, 1.2, 0]}>
            {`Безопасно: ${safeDist.toFixed(1)} м`}
          </Text>
        </group>
      )}

      <pointLight position={[0, 6, 4]} color="#fff5e0" intensity={1} distance={15} decay={2} />
      <pointLight position={[6, 3, -4]} color="#ffeedd" intensity={0.5} distance={12} decay={2} />
    </>
  );
}

/* ─────────────── Lesson 13: LFL vapor cloud, spill area, ignition ─────────────── */

function FireSafetyLabScene({
  state,
  timeScale,
}: {
  state: NonNullable<LabSceneProps['fireSafetyState']>;
  timeScale: number;
}) {
  const metrics = useMemo(
    () =>
      lesson13FireLabMetrics({
        lvjName: state.lvjName,
        eta: state.eta,
        V_m3: state.V_m3,
        G_kgm3: state.G_kgm3,
        Vsv_m3: state.Vsv_m3,
        SA_m2: state.SA_m2,
        KH: state.KH,
        t_evap_h: state.t_evap_h,
        rhoP: state.rhoP,
        Cnkr: state.Cnkr,
        Pmax: state.Pmax,
        PH: state.PH,
        M: state.M,
      }),
    [state],
  );

  const cloudRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.PointLight>(null);
  const timeR = useRef(0);

  /**
   * Пол квадратный: сторона = диаметр лужи при макс. Sₐ табл. 13.1 + запас, без искусственного урезания r по варианту.
   * Синхронизировано с max(L13_SA) в data/variants.ts (= 140 м²).
   */
  const METERS_TO_SCENE = 0.72;
  const LESSON13_SA_MAX_M2 = 140;
  const LESSON13_FLOOR_PAD_M = 1.2;
  const rSpillMaxM = Math.sqrt(LESSON13_SA_MAX_M2 / Math.PI);
  const floorSideM = 2 * rSpillMaxM + LESSON13_FLOOR_PAD_M;
  const roomWm = floorSideM;
  const roomDm = floorSideM;
  /** Высота зала только от Vсв варианта (табл. 13.2); площадь пола не меняется. Диапазон Vсв в таблице: 110…200 м³. */
  const LESSON13_VSV_MIN = 110;
  const LESSON13_VSV_MAX = 200;
  const vsvForHeight = Math.max(LESSON13_VSV_MIN, Math.min(LESSON13_VSV_MAX, state.Vsv_m3));
  const vsvU = (vsvForHeight - LESSON13_VSV_MIN) / (LESSON13_VSV_MAX - LESSON13_VSV_MIN);
  const roomHm = 3.2 + vsvU * 4.35;
  const roomW = roomWm * METERS_TO_SCENE;
  const roomD = roomDm * METERS_TO_SCENE;
  const roomH = roomHm * METERS_TO_SCENE;

  const wallT = 0.04;
  const wx = roomW / 2;
  const wz = roomD / 2;

  /** Радиус лужи строго по Sₐ варианта (площадь рассчитана под максимум). */
  const rSpillM = Math.sqrt(Math.max(0.5, state.SA_m2) / Math.PI);
  const spillR = Math.max(0.06, rSpillM * METERS_TO_SCENE);
  const spillCx = 0;
  const spillCz = 0;

  const cn = Math.max(0.05, state.Cnkr);
  const concRatio = Math.min(2.5, metrics.C_pct / cn);

  const vaporColor = (() => {
    if (!metrics.aboveNkp) return '#90caf9';
    if (state.sparkOn) return '#ff5252';
    return '#ffb74d';
  })();

  const vaporOpacity = Math.min(0.55, 0.14 + concRatio * 0.14);

  const Vp_m3 = lesson13VaporVolumeM3(state.G_kgm3, state.V_m3, state.rhoP);

  const halfFloor = Math.min(wx, wz);
  /**
   * В плане — от лужи. Низкий потолок не должен уменьшать радиус (иначе при большой Sₐ и малом Vсв облако «пропадает»):
   * режем только вертикальный scale sy, облако становится более «плоским», но широким.
   */
  const cloudY = Math.min(
    roomH * 0.48,
    Math.max(0.28, spillR * 0.18 + roomH * 0.12),
  );
  const cloudBaseR = Math.max(
    0.22,
    Math.min(spillR * 0.84, halfFloor - 0.22),
  );
  const headroom = Math.max(0.1, roomH - cloudY - 0.14);
  const syCap = headroom / Math.max(cloudBaseR * 0.98, 0.15);

  useFrame((_, delta) => {
    timeR.current += delta * timeScale;
    const t = timeR.current;
    if (cloudRef.current) {
      const pulse = 1 + 0.05 * Math.sin(t * 3);
      const threat = metrics.aboveNkp && state.sparkOn ? 1 + 0.1 * Math.sin(t * 12) : 1;
      const cAnim = Math.min(1.8, concRatio);
      const syWish = (0.4 + 0.055 * cAnim) * pulse * threat;
      const sy = Math.min(syWish, syCap);
      const squash = sy < 0.42 ? 1 + (0.42 - sy) * 0.35 : 1;
      const sXZ = 0.96 * squash * pulse * threat;
      cloudRef.current.scale.set(sXZ, sy, sXZ);
    }
    if (sparkRef.current && state.sparkOn) {
      sparkRef.current.intensity = 1.4 + 1 * Math.sin(t * 20) ** 2;
    }
  });

  const sparkAngle = Math.PI * 0.25;
  const sparkX = spillCx + Math.cos(sparkAngle) * spillR * 0.92;
  const sparkZ = spillCz + Math.sin(sparkAngle) * spillR * 0.92;

  /** Вход — открытый торец со стороны +Z; подписи выше проёма и чуть в −Z (над порогом). */
  const titleAnchorZ = wz - 0.48;
  const titleBaseY = roomH + 1.42;

  return (
    <>
      <group position={[0, 0, 0]}>
        {/* Площадка = пол помещения (один размер) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#cfd8dc" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
          <planeGeometry args={[roomW * 0.98, roomD * 0.98]} />
          <meshStandardMaterial color="#eceff1" roughness={0.88} />
        </mesh>

        {/* Потолок */}
        <mesh position={[0, roomH, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial
            color="#cfd8dc"
            metalness={0.04}
            roughness={0.72}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Стена −X */}
        <mesh position={[-wx - wallT / 2, roomH / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[roomD, roomH]} />
          <meshStandardMaterial
            color="#cfd8dc"
            metalness={0.04}
            roughness={0.72}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Стена +X */}
        <mesh position={[wx + wallT / 2, roomH / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[roomD, roomH]} />
          <meshStandardMaterial
            color="#cfd8dc"
            metalness={0.04}
            roughness={0.72}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Задняя стена −Z (камера смотрит с +Z) */}
        <mesh position={[0, roomH / 2, -wz - wallT / 2]}>
          <planeGeometry args={[roomW + wallT * 2, roomH]} />
          <meshStandardMaterial
            color="#cfd8dc"
            metalness={0.04}
            roughness={0.72}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Контур внутреннего объёма */}
        <mesh position={[0, roomH / 2, 0]}>
          <boxGeometry args={[roomW, roomH, roomD]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
          <Edges threshold={18} color="#37474f" />
        </mesh>

        {/* Пятно пролива: площадь Sₐ варианта → радиус на полу */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[spillCx, 0.012, spillCz]} receiveShadow>
          <circleGeometry args={[spillR, 48]} />
          <meshStandardMaterial
            color={metrics.aboveNkp ? '#5d4037' : '#6d4c41'}
            roughness={0.75}
            metalness={0.05}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Облако паров */}
        <group ref={cloudRef} position={[spillCx, cloudY, spillCz]}>
          <mesh>
            <sphereGeometry args={[cloudBaseR, 28, 28]} />
            <meshStandardMaterial
              color={vaporColor}
              transparent
              opacity={vaporOpacity}
              roughness={0.95}
              metalness={0}
              emissive={metrics.aboveNkp && state.sparkOn ? '#b71c1c' : '#000000'}
              emissiveIntensity={metrics.aboveNkp && state.sparkOn ? 0.35 : 0}
            />
          </mesh>
        </group>

        {/* Искра у края пролива */}
        <group position={[sparkX, 0.22, sparkZ]}>
          <mesh visible={state.sparkOn}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color="#fff59d" emissive="#ffab00" emissiveIntensity={2.2} />
          </mesh>
          <pointLight
            ref={sparkRef}
            position={[0, 0.06, 0]}
            color="#ffecb3"
            intensity={state.sparkOn ? 1.5 : 0}
            distance={6}
            decay={2}
          />
        </group>

        {/* Числа варианта; площадка по max Sₐ табл. 13.1 */}
        <Text position={[-wx + 0.45, 0.38, wz - 0.45]} fontSize={0.12} color="#b0bec5" maxWidth={7.5}>
          {`План ${roomWm.toFixed(1)}×${roomDm.toFixed(1)} м · H≈${roomHm.toFixed(2)} м от Vсв=${state.Vsv_m3} м³ · V=${state.V_m3} м³`}
        </Text>
        <Text position={[-wx + 0.45, 0.14, wz - 0.45]} fontSize={0.1} color="#cfd8dc" maxWidth={7.5}>
          {`Sₐ=${state.SA_m2} м² · Vп≈${Vp_m3.toFixed(2)} м³ (13.2) · табл.13.2 по предпосл. цифре`}
        </Text>
      </group>

      {/* Блок расчётных подписей над открытым входом (+Z) */}
      <Text position={[0, titleBaseY + 0.52, titleAnchorZ]} fontSize={0.22} color="#eceff1">
        {`ЛВЖ: ${state.lvjName}`}
      </Text>
      <Text position={[0, titleBaseY + 0.14, titleAnchorZ]} fontSize={0.155} color="#cfd8dc">
        {`C ≈ ${metrics.C_pct.toFixed(2)} %  ·  НКПР ${metrics.Cnkr_pct.toFixed(1)} %  ·  Cст ≈ ${metrics.Cst_pct.toFixed(2)} %`}
      </Text>
      <Text position={[0, titleBaseY - 0.22, titleAnchorZ]} fontSize={0.14} color="#b0bec5">
        {`W ≈ ${metrics.W_kg_m2_s.toExponential(2)} кг/(м²·с)  ·  m ≈ ${metrics.m_kg.toFixed(2)} кг`}
      </Text>
      <Text position={[0, titleBaseY - 0.5, titleAnchorZ]} fontSize={0.14} color="#b0bec5">
        {`ΔP ≈ ${metrics.deltaP_kPa.toFixed(2)} кПа`}
      </Text>
      <Text
        position={[0, titleBaseY - 0.78, titleAnchorZ]}
        fontSize={0.15}
        color={metrics.roomCategoryAExplosive ? '#c62828' : '#2e7d32'}
      >
        {metrics.roomCategoryAExplosive
          ? 'Кат. помещ. А по ΔP (> 5 кПа)'
          : 'ΔP ≤ 5 кПа (модель) — уточните в отчёте'}
      </Text>

      <pointLight position={[-6, roomH * 0.9, 7]} intensity={0.55} distance={40} decay={2} color="#e3f2fd" />
    </>
  );
}

/* ─────────────── Main Component with Time Control ─────────────── */

export default function LabScene3D(props: LabSceneProps) {
  const [timeScale, setTimeScale] = useState(1);
  const [showExplain, setShowExplain] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [cellBoostedStations, setCellBoostedStations] = useState<Set<number>>(new Set());
  const [tvImgBoosted, setTvImgBoosted] = useState<Set<number>>(new Set());
  const [tvSndBoosted, setTvSndBoosted] = useState<Set<number>>(new Set());
  const [tvSelectedIndex, setTvSelectedIndex] = useState(0);

  const onToggleStation = (stationId: number) => {
    setCellBoostedStations((prev) => {
      const next = new Set(prev);
      if (next.has(stationId)) next.delete(stationId);
      else next.add(stationId);
      return next;
    });
  };

  const cellularModel = useMemo(() => {
    if (props.lessonId !== 7) return null;
    const maxD = Math.max(...props.hfState.distances, 100);
    const stations: CellularStation[] = [
      { id: 0, label: 'BS-1', xM: 0, boosted: cellBoostedStations.has(0) },
      { id: 1, label: 'BS-2', xM: maxD * 0.55, boosted: cellBoostedStations.has(1) },
      { id: 2, label: 'BS-3', xM: maxD, boosted: cellBoostedStations.has(2) },
    ];
    const obstacles: CellularObstacle[] = [
      { id: 'b1', kind: 'building', xM: maxD * 0.25, widthM: maxD * 0.04, attenuation: 0.55 },
      { id: 't1', kind: 'trees', xM: maxD * 0.40, widthM: maxD * 0.03, attenuation: 0.78 },
      { id: 'b2', kind: 'building', xM: maxD * 0.72, widthM: maxD * 0.05, attenuation: 0.5 },
    ];

    // Under-the-hood explicit cycle before chart update:
    // - 7.6 OR 7.5 chosen by wavelength (5 times)
    // - 7.3 (5 times)
    // - 7.2 (5 times)
    const band = classifyWaveBand(props.hfState.wavelengthM);
    const useVariant1 = band === 'DV' || band === 'SV';
    const distances5 = props.hfState.distances.slice(0, 5);

    const points: CellularPoint[] = distances5.map((dM) => {
      let best: CellularPoint | null = null;
      for (const s of stations) {
        const linkD = Math.max(1, Math.abs(dM - s.xM));
        // 7.5 or 7.6 (chosen by wavelength) — exactly once per point
        const x = useVariant1
          ? xParameterVariant1(linkD, props.hfState.wavelengthM, props.hfState.sigma)
          : xParameterFull(linkD, props.hfState.wavelengthM, props.hfState.theta, props.hfState.sigma);
        // 7.3
        const F = attenuationFactorF(x);
        // 7.2
        const base = fieldStrengthShuleikin(props.hfState.powerKW, props.hfState.gainAntenna, linkD, F);
        const boosterMult = s.id === 0 ? 1 : s.boosted ? 1.8 : 1;
        const loss = obstacles.reduce((acc, o) => {
          const left = Math.min(dM, s.xM);
          const right = Math.max(dM, s.xM);
          const inBetween = o.xM >= left && o.xM <= right;
          return inBetween ? acc * o.attenuation : acc;
        }, 1);
        const eFinal = base * boosterMult * loss;
        const candidate: CellularPoint = {
          dM,
          stationId: s.id,
          stationLabel: s.label,
          rawE: base,
          eFinal,
          loss,
        };
        if (!best || candidate.eFinal > best.eFinal) best = candidate;
      }
      return best!;
    });

    return { stations, obstacles, points };
  }, [props.lessonId, props.hfState, cellBoostedStations]);

  const tvModel = useMemo(() => {
    if (props.lessonId !== 8) return null;

    // Required explicit cycle BEFORE chart update:
    // - 8.6 — 5 times
    // - 8.5 — 5 times
    // - 8.4 — 10 times (video + audio)
    const distances5 = props.uhfState.distances.slice(0, 5);
    const K = 1.41;
    const videoPower = props.uhfState.powerVideoW ?? props.uhfState.powerW * 0.8;
    const audioPower = props.uhfState.powerAudioW ?? props.uhfState.powerW * 0.2;

    const points: TvPoint[] = distances5.map((rM, i) => {
      // 8.6
      const Rm = distanceFromPhaseCenter(props.uhfState.heightM, rM);
      // Keep Δ for UI display
      const deltaRad = elevationAngleRad(props.uhfState.heightM, rM);
      // 8.5 (project's required version uses r)
      const Fd = normalizedPatternFactorFromR(rM);
      // 8.4 — 10 times total (2 per point)
      const Eimg = fieldStrengthUHF(videoPower, props.uhfState.gain, Rm, Fd, K);
      const Esnd = fieldStrengthUHF(audioPower, props.uhfState.gain, Rm, Fd, K);

      const imgBoost = tvImgBoosted.has(i);
      const sndBoost = tvSndBoosted.has(i);
      const EimgFinal = imgBoost ? Eimg * 2 : Eimg;
      const EsndFinal = sndBoost ? Esnd * 2 : Esnd;

      return { rM, Rm, deltaRad, Fd, Eimg, Esnd, EimgFinal, EsndFinal, imgBoost, sndBoost };
    });

    return { points };
  }, [props.lessonId, props.uhfState, tvImgBoosted, tvSndBoosted]);

  const sceneInfo = useMemo(() => {
    if (props.lessonId === 1) {
      const distance = Math.sqrt(
        props.lightState.heightM * props.lightState.heightM
        + props.lightState.sensorOffsetM * props.lightState.sensorOffsetM
      );
      const illuminance = realisticIlluminanceLux({
        intensityCd: props.lightState.intensityCd,
        distanceM: Math.max(0.2, distance),
        luminaireCount: props.lightState.luminaireCount,
        reflectance: props.lightState.reflectance,
        utilizationFactor: 0.62,
        maintenanceFactor: 0.85,
      });
      const baseline = props.lightState.intensityCd / Math.max(0.2, distance * distance);
      return {
        headline: `Исследование: E = ${illuminance.toFixed(1)} лк | Лампа: ${props.lightState.lampType === 'incandescent' ? 'накаливания' : props.lightState.lampType === 'fluorescent' ? 'люминесцентная' : 'LED'}`,
        compareText: `Базовая модель E=I/r²: ${baseline.toFixed(1)} лк`,
      };
    }
    if (props.lessonId === 2) {
      const hp = Math.max(0.5, props.lightState.heightM - 0.3);
      const roomLength = props.lightState.roomLengthM ?? 14;
      const roomWidth = props.lightState.roomWidthM ?? 10;
      const idx = (roomLength * roomWidth) / (hp * (roomLength + roomWidth));
      return {
        headline: `Расчёт: i = ${idx.toFixed(3)} | H' = ${hp.toFixed(2)} м | P = ${(props.lightState.chosenLampPowerW ?? 60).toFixed(0)} Вт`,
      };
    }
    if (props.lessonId === 3) {
      const contributions = [
        props.noiseState.sourceAOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceA, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceAX)), barrierMassPerM2: props.noiseState.barrierMassA }) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceBOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceB, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceBX)), barrierMassPerM2: props.noiseState.barrierMassB }) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceCOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceC, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceCX)), barrierMassPerM2: props.noiseState.barrierMassC }) : Number.NEGATIVE_INFINITY,
      ].filter((v) => Number.isFinite(v)) as number[];
      const total = contributions.length > 0 ? sumLevelsEnergyDb(contributions) : 0;
      return { headline: `Исследование шума: LΣ = ${total.toFixed(1)} дБ | три независимые преграды` };
    }
    if (props.lessonId === 4) {
      const distanceLevels = [
        props.noiseState.sourceAOn ? levelAtDistanceDb(props.noiseState.sourceA, Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceAX))) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceBOn ? levelAtDistanceDb(props.noiseState.sourceB, Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceBX))) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceCOn ? levelAtDistanceDb(props.noiseState.sourceC, Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceCX))) : Number.NEGATIVE_INFINITY,
      ].filter((v) => Number.isFinite(v)) as number[];
      const barrierLevels = [
        props.noiseState.sourceAOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceA, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceAX)), barrierMassPerM2: props.noiseState.barrierMassA }) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceBOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceB, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceBX)), barrierMassPerM2: props.noiseState.barrierMassB }) : Number.NEGATIVE_INFINITY,
        props.noiseState.sourceCOn ? sourceLevelAtObserver({ levelAt1mDb: props.noiseState.sourceC, distanceM: Math.max(0.8, Math.abs(props.noiseState.observerX - props.noiseState.sourceCX)), barrierMassPerM2: props.noiseState.barrierMassC }) : Number.NEGATIVE_INFINITY,
      ].filter((v) => Number.isFinite(v)) as number[];
      const totalDistance = sumLevelsByMethodicalTable(distanceLevels);
      const totalBarrier = sumLevelsByMethodicalTable(barrierLevels);
      return { headline: `Расчёт шума: LR = ${totalDistance.toFixed(1)} дБ | L'R = ${totalBarrier.toFixed(1)} дБ` };
    }
    if (props.lessonId === 5) {
      const lambda = wavelengthM(Math.max(1e3, props.emiState.frequencyHz));
      const zone = classifyEmZone(Math.max(0.01, props.emiState.distanceM), lambda);
      const ppe = props.emiState.eVpm * props.emiState.hApm;
      return {
        headline: `ЭМИ: λ = ${lambda.toExponential(2)} м | ППЭ = ${ppe.toFixed(3)} Вт/м² | зона: ${zone === 'near' ? 'ближняя' : zone === 'intermediate' ? 'промежуточная' : 'дальняя'}`,
      };
    }
    if (props.lessonId === 6) {
      const H = magneticFieldStrengthH(
        props.shieldState.turns,
        props.shieldState.currentA,
        props.shieldState.distanceM,
        props.shieldState.coilRadiusM,
        1,
      );
      const ppe = powerFluxDensityFromH(H);
      const L = attenuationRatioL(ppe, allowablePPE(props.shieldState.exposureTimeH));
      const muAbs = absolutePermeability(props.shieldState.muRelative);
      const omega = angularFrequencyOmega(props.shieldState.frequencyHz);
      const thick = shieldThicknessM(L, omega, muAbs, props.shieldState.conductivitySpm);
      return { headline: `Экранирование: δ = ${(thick * 1000).toFixed(2)} мм | ω = ${omega.toExponential(2)} 1/с | ППЭδ = ${ppe.toExponential(2)} Вт/м²` };
    }
    if (props.lessonId === 7) {
      const p0 = cellularModel?.points[0];
      if (!p0) return { headline: 'Сотовая связь: выберите точки измерения.' };
      return {
        headline: `Сотовая связь: S(d₁) = ${p0.eFinal.toFixed(3)} усл. | лучшая станция: ${p0.stationLabel} | препятствия учитываются`,
      };
    }
    if (props.lessonId === 8) {
      const pts = tvModel?.points;
      if (!pts?.length) return { headline: 'Телевещание: нет данных.' };
      const iSel = Math.min(Math.max(0, tvSelectedIndex), pts.length - 1);
      const pSel = pts[iSel];
      return {
        headline: `Телевещание: ${iSel + 1}-я точка (r = ${pSel.rM} м) | E_из=${pSel.EimgFinal.toFixed(2)} В/м; E_зв=${pSel.EsndFinal.toFixed(2)} В/м | R=${pSel.Rm.toFixed(
          1,
        )} м | F(Δ)=${pSel.Fd.toFixed(3)}`,
      };
    }
    if (props.lessonId === 9) {
      const Zk = skinImpedance(props.bodyElecState.skinResistanceOhm, props.bodyElecState.frequencyHz, props.bodyElecState.capacitanceNF * 1e-9);
      const Zt = totalBodyImpedance(Zk, props.bodyElecState.internalResistanceOhm);
      const I = bodyCurrentMA(props.bodyElecState.voltageV, Zt);
      const danger = classifyCurrentDanger(I, props.bodyElecState.frequencyHz <= 60);
      return { headline: `Ток через тело: I = ${I.toFixed(2)} мА | Z = ${Zt.toFixed(0)} Ом | ${danger === 'safe' ? 'безопасный' : danger === 'perceptible' ? 'ощутимый' : danger === 'non-releasing' ? 'неотпускающий' : 'фибрилляция'}` };
    }
    if (props.lessonId === 10) {
      const Ush = stepVoltage(props.groundState.faultCurrentA, props.groundState.soilResistivityOhmM, props.groundState.distanceM, props.groundState.stepLengthM);
      const phi = groundPotential(props.groundState.faultCurrentA, props.groundState.soilResistivityOhmM, props.groundState.distanceM);
      return { headline: `Напряжение шага: Uш = ${Ush.toFixed(1)} В | φ = ${phi.toFixed(1)} В | x = ${props.groundState.distanceM} м` };
    }
    if (props.lessonId === 11) {
      const s = props.threePhaseState;
      if (!s) {
        return { headline: 'Трёхфазная сеть: задайте параметры в панели управления.' };
      }
      const effRegime = s.network === 'IT' ? 'normal' : s.regime;
      const { UprV, ImA } = lesson11TouchEstimate({
        network: s.network,
        regime: effRegime,
        touchedPhaseIndex: s.touchedPhaseIndex,
        UphiV: s.UphiV,
        RhOhm: s.RhOhm,
        RgOhm: s.RgOhm,
        RzmOhm: s.RzmOhm,
        RisoOhm: s.RisoOhm,
      });
      const danger = classifyCurrentDanger(ImA, true);
      const dText =
        danger === 'safe'
          ? 'зона безопасности'
          : danger === 'perceptible'
            ? 'ощутимый ток'
            : danger === 'non-releasing'
              ? 'неотпускающий ток'
              : 'опасная зона';
      const net = s.network === 'IT' ? 'ИТ' : 'TN';
      const reg =
        s.network === 'IT' ? 'нормальный режим' : s.regime === 'normal' ? 'нормальный режим' : 'аварийный (КЗ L1)';
      const ph = ['L1', 'L2', 'L3'][Math.min(2, Math.max(0, s.touchedPhaseIndex))];
      return {
        headline: `${net} · ${reg} · касание ${ph}: Uпр ≈ ${UprV.toFixed(1)} В, I ≈ ${ImA.toFixed(2)} мА (${dText})`,
      };
    }
    if (props.lessonId === 12) {
      const s = props.tnEarthingState;
      if (!s) {
        return { headline: 'Занятие 12: задайте вариант и откройте лабораторную сцену.' };
      }
      const r = lesson12TnLabEstimate(s);
      const dz =
        r.IbodyMA < 1 ? 'безопасно'
        : r.IbodyMA < 10 ? 'ощутимо'
        : r.IbodyMA < 30 ? 'неотпускающий ток'
        : 'опасно';
      return {
        headline: `TN: I_к.з. ≈ ${r.IkzA.toFixed(1)} А · U_корп ≈ ${r.UenclosureV.toFixed(1)} В · I_h ≈ ${r.IbodyMA.toFixed(2)} мА (${dz})`,
      };
    }
    if (props.lessonId === 13) {
      const s = props.fireSafetyState;
      if (!s) {
        return { headline: 'Занятие 13: задайте вариант (табл. 13.1–13.2) и откройте лабораторную сцену.' };
      }
      const m = lesson13FireLabMetrics({
        lvjName: s.lvjName,
        eta: s.eta,
        V_m3: s.V_m3,
        G_kgm3: s.G_kgm3,
        Vsv_m3: s.Vsv_m3,
        SA_m2: s.SA_m2,
        KH: s.KH,
        t_evap_h: s.t_evap_h,
        rhoP: s.rhoP,
        Cnkr: s.Cnkr,
        Pmax: s.Pmax,
        PH: s.PH,
        M: s.M,
      });
      const nk = m.aboveNkp ? '≥ НКПР' : '< НКПР';
      const catA = m.roomCategoryAExplosive ? 'да' : 'нет';
      return {
        headline: `${s.lvjName}: C ≈ ${m.C_pct.toFixed(2)} % (${nk}) | ΔP ≈ ${m.deltaP_kPa.toFixed(2)} кПа | кат. А по ΔP: ${catA}`,
      };
    }
    if (props.lessonId === 14) {
      const s = props.firstAidElectricState;
      const titles: Record<'disconnect' | 'airway' | 'breaths' | 'cpr', string> = {
        disconnect: 'Этап 1: освобождение от тока сухим изолирующим предметом (не металл, не мокрое)',
        airway: 'Этап 2: проходимость путей — запрокидывание головы, подбородок',
        breaths: 'Этап 3: искусственное дыхание «рот в рот» (схема)',
        cpr: 'Этап 4: непрямой массаж; один помощник — 2 вдоха → 15 нажатий',
      };
      return { headline: s ? titles[s.stage] : 'Занятие 14: выберите этап помощи в панели под сценой.' };
    }
    if (props.lessonId === 15) {
      const s = props.accidentInvestigationState;
      const deadline = s?.severity === 'light' ? 'срок расследования: 3 дня' : s?.severity === 'heavyOrFatal' ? 'срок расследования: 15 дней' : '';
      const title: Record<NonNullable<LabSceneProps['accidentInvestigationState']>['stage'], string> = {
        firstAid: 'Этап 1: первая помощь и доставка в мед. организацию',
        preventHazard: 'Этап 2: предотвратить развитие аварии и воздействие факторов на других лиц',
        preserveScene: 'Этап 3: сохранить/зафиксировать обстановку (схемы/фото/видео)',
        notify: 'Этап 4: уведомить органы и родственников (при тяжёлом/смертельном)',
        commission: 'Этап 5: сформировать комиссию (нечётный состав, ≥ 3)',
        investigation: 'Этап 6: опросы, документы, экспертизы — сбор материалов расследования',
        report: 'Этап 7: выводы, квалификация случая, меры и оформление актов',
      };
      return { headline: s ? `${title[s.stage]} · ${deadline}` : 'Занятие 15: выберите этап расследования в панели под сценой.' };
    }
    return { headline: 'Занятие не установлено.' };
  }, [props, tvModel, tvSelectedIndex]);

  const signalChart = useMemo(() => {
    if (props.lessonId !== 7 || !cellularModel) return null;
    const pts = cellularModel.points;
    const maxE = Math.max(...pts.map((p) => p.eFinal), 1e-9);
    const minD = Math.min(...pts.map((p) => p.dM));
    const maxD = Math.max(...pts.map((p) => p.dM), minD + 1);

    const W = 320;
    const H = 90;
    const pad = 10;
    const toX = (d: number) => pad + ((d - minD) / (maxD - minD)) * (W - pad * 2);
    const toY = (e: number) => H - pad - (e / maxE) * (H - pad * 2);
    const poly = pts.map((p) => `${toX(p.dM).toFixed(1)},${toY(p.eFinal).toFixed(1)}`).join(' ');

    return (
      <Box sx={{ mt: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="caption" fontWeight={600}>
          График уровня сигнала (перестраивается при усилении)
        </Typography>
        <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: '100%', height: 90, mt: 0.5, display: 'block' }}>
          <polyline points={poly} fill="none" stroke="#ff9800" strokeWidth="2" />
          {pts.map((p, i) => (
            <circle key={i} cx={toX(p.dM)} cy={toY(p.eFinal)} r="2.5" fill={p.eFinal < maxE * HF_CELL_WEAK_VS_PEAK ? '#f44336' : '#ff9800'} />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          Подсказка: кликай по базовым станциям, чтобы включать/выключать «усилитель».
        </Typography>
      </Box>
    );
  }, [props.lessonId, cellularModel]);

  const tvChart = useMemo(() => {
    if (props.lessonId !== 8 || !tvModel) return null;
    const pts = tvModel.points;
    const maxV = Math.max(...pts.map((p) => p.EimgFinal), 1e-9);
    const maxA = Math.max(...pts.map((p) => p.EsndFinal), 1e-9);
    const maxE = Math.max(maxV, maxA, 1e-9);
    const minR = Math.min(...pts.map((p) => p.rM));
    const maxR = Math.max(...pts.map((p) => p.rM), minR + 1);

    const W = 320;
    const H = 90;
    const pad = 10;
    const toX = (d: number) => pad + ((d - minR) / (maxR - minR)) * (W - pad * 2);
    const toY = (e: number) => H - pad - (e / maxE) * (H - pad * 2);
    const polyV = pts.map((p) => `${toX(p.rM).toFixed(1)},${toY(p.EimgFinal).toFixed(1)}`).join(' ');
    const polyA = pts.map((p) => `${toX(p.rM).toFixed(1)},${toY(p.EsndFinal).toFixed(1)}`).join(' ');
    const idx = Math.min(Math.max(0, tvSelectedIndex), Math.max(0, pts.length - 1));

    return (
      <Box sx={{ mt: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="caption" fontWeight={600}>
          График телевещания: видео (зелёный) + звук (синий)
        </Typography>
        <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: '100%', height: 90, mt: 0.5, display: 'block' }}>
          <polyline points={polyV} fill="none" stroke="#1de9b6" strokeWidth="2" />
          <polyline points={polyA} fill="none" stroke="#29b6f6" strokeWidth="2" />
          {pts.map((p, i) => (
            <circle key={`v-${i}`} cx={toX(p.rM)} cy={toY(p.EimgFinal)} r="2.2" fill={p.imgBoost ? '#00e676' : '#1de9b6'} />
          ))}
          {pts.map((p, i) => (
            <circle key={`a-${i}`} cx={toX(p.rM)} cy={toY(p.EsndFinal)} r="2.2" fill={p.sndBoost ? '#00b0ff' : '#29b6f6'} />
          ))}
          <circle
            cx={toX(pts[idx].rM)}
            cy={toY(Math.max(pts[idx].EimgFinal, pts[idx].EsndFinal))}
            r="4.2"
            fill="none"
            stroke="#ffeb3b"
            strokeWidth="1.6"
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Кликни по меткам r1..r5 на дороге, чтобы переместить дом. Усилители включаются отдельно: «⬆ усил. видео» и «⬆ усил. звук» у дома.
        </Typography>
      </Box>
    );
  }, [props.lessonId, tvModel, tvSelectedIndex]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">
          Практическая 3D-сцена
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <Chip size="small" label="Что происходит?" color={showExplain ? 'primary' : 'default'} onClick={() => setShowExplain((prev) => !prev)} />
          <Chip size="small" label="Режим сравнения" color={comparisonMode ? 'secondary' : 'default'} onClick={() => setComparisonMode((prev) => !prev)} />
          <Tooltip title="Замедлить">
            <IconButton size="small" onClick={() => setTimeScale((s) => Math.max(0.1, s * 0.5))}>
              <SlowMotionVideoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'center' }}>
            ×{timeScale.toFixed(1)}
          </Typography>
          <Tooltip title="Ускорить">
            <IconButton size="small" onClick={() => setTimeScale((s) => Math.min(10, s * 2))}>
              <FastForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {sceneInfo.headline}
      </Typography>
      {signalChart}
      {tvChart}
      {comparisonMode && (sceneInfo as { compareText?: string }).compareText && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {(sceneInfo as { compareText?: string }).compareText}
        </Alert>
      )}
      {showExplain && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {props.lessonId === 1 && 'Связь со светотехникой: сцена визуализирует E ≈ I/r² с поправками на число светильников, отражение поверхностей и эксплуатационный коэффициент.'}
          {props.lessonId === 2 && 'Сцена повторяет схему из методички: размеры L и B, высоту подвеса H′, две светящиеся линии и расстояние l от края до линии.'}
          {props.lessonId === 3 && 'Сцена демонстрирует вклад каждого источника шума и отдельную преграду для каждого канала распространения.'}
          {props.lessonId === 4 && 'Сцена иллюстрирует пошаговый расчет по трем источникам: LR на расстоянии, снижение N преградой и corrected уровень L′R в рабочей точке.'}
          {props.lessonId === 5 && 'Сцена показывает перпендикулярность электрического и магнитного полей, зоны ЭМИ по отношению r/λ и упрощенную классификацию диапазонов.'}
          {props.lessonId === 6 && 'Сцена показывает источник ЭМИ, экранирующую стенку с рассчитанной толщиной δ и волновод. Волновые фронты затухают при прохождении экрана.'}
          {props.lessonId === 7 &&
            'Сцена — упрощённая модель: в центре главная радиостанция (передатчик), по оси — релейные базовые станции с опциональным усилителем (клик), преграды на пути луча, в каждой точке измерения выбирается лучший сигнал. График сверху перестраивается динамически.'}
          {props.lessonId === 8 && 'Сцена симулирует телевещание: отдельно видео и звук. При слабом сигнале появляются помехи/рассинхрон, усилители включаются отдельно для видео и для звука. График строится после цикла 8.6→8.5→8.4.'}
          {props.lessonId === 9 && 'Сцена демонстрирует эквивалентную схему «напряжение → тело → земля» с визуализацией опасности тока через человека.'}
          {props.lessonId === 10 && 'Сцена показывает растекание тока замыкания в грунте, эквипотенциальные зоны и напряжение шага между ногами человека.'}
          {props.lessonId === 11 &&
            'Звезда трёхфазного источника, нейтраль (ИТ без соединения с землёй, TN с заземлением через R_з). В аварии TN показано КЗ фазы L1 на землю — меняется цепь касания и оценка Uпр, I_h по упрощённой модели из занятия.'}
          {props.lessonId === 12 &&
            'Сцена: трёхфазная сеть с занулённым корпусом, заземление нейтрали R_0 и (при сценарии) повторное R_n. Выберите режим — КЗ на корпус, обрыв нуля или фаза на землю; оценки I_к.з., U на корпусе и I_h согласованы с формулами 12.2–12.13 (упрощённая модель). Числа Z_n, Z_H, R_n, R_зм — из вашего варианта (табл. 12.2).'}
          {props.lessonId === 13 &&
            'Сцена: план пола под max Sₐ (табл. 13.1), высота зала от Vсв (табл. 13.2). Лужа и ширина облака в плане — от Sₐ; цвет/прозрачность и чуть высота шара — от C и НКПР. C, ΔP, Vп — по формулам (13.1)–(13.6).'}
          {props.lessonId === 14 &&
            'Сцена показывает четыре этапа доврачебной помощи: отключение пострадавшего от тока сухим диэлектриком, проходимость путей, искусственное дыхание и непрямой массаж с соотношением для одного помощника. Этап выбирается селектором в блоке «Управление лабораторной сценой». Вращайте вид мышью.'}
          {props.lessonId === 15 &&
            'Сцена визуализирует порядок действий при несчастном случае и структуру расследования: первая помощь, предотвращение опасности, фиксация обстановки, уведомления, комиссия, сбор материалов и оформление выводов. Выберите шаг и тяжесть случая — срок расследования (3/15 дней) подсветится в схеме.'}
        </Alert>
      )}
      <Box
        sx={{
          height:
            props.lessonId === 13
              ? { xs: 400, md: 540 }
              : props.lessonId === 14
                ? { xs: 400, md: 500 }
                : { xs: 320, md: 420 },
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <SafeCanvas
          shadows
          camera={{
            position: [5, 6, 7].includes(props.lessonId)
              ? [8, 5, 10]
              : props.lessonId === 10
                ? [10, 6, 10]
                : props.lessonId === 11 || props.lessonId === 12
                  ? [7.5, 5.2, 7.5]
                  : props.lessonId === 13
                    ? [5.9, 4.7, 7.4]
                    : props.lessonId === 14
                      ? [6.2, 4.4, 7.2]
                      : props.lessonId === 8
                      ? [6.8, 5, 8.2]
                      : [8, 5, 8],
            fov: props.lessonId === 13 ? 52 : props.lessonId === 14 ? 50 : 46,
          }}
        >
          <ambientLight intensity={props.lessonId === 15 ? 0.34 : 0.2} />
          <directionalLight
            position={[5, 10, 3]}
            intensity={props.lessonId === 15 ? 0.95 : 0.7}
            castShadow
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
          />
          {props.lessonId === 15 && (
            <pointLight position={[-4, 6, 8]} color="#fff8f0" intensity={0.55} distance={22} decay={2} />
          )}
          {props.lessonId === 15 && (
            <pointLight position={[6, 5, 4]} color="#e3f2fd" intensity={0.4} distance={18} decay={2} />
          )}
          {props.lessonId === 1 && <LightInvestigationScene state={props.lightState} timeScale={timeScale} />}
          {props.lessonId === 2 && <LightCalculationScene state={props.lightState} timeScale={timeScale} />}
          {props.lessonId === 3 && <NoiseInvestigationScene state={props.noiseState} timeScale={timeScale} />}
          {props.lessonId === 4 && <NoiseCalculationScene state={props.noiseState} timeScale={timeScale} />}
          {props.lessonId === 5 && <EmiScene state={props.emiState} timeScale={timeScale} />}
          {props.lessonId === 6 && <ShieldingScene state={props.shieldState} timeScale={timeScale} />}
          {props.lessonId === 7 && cellularModel && (
            <CellularSignalScene
              state={props.hfState}
              timeScale={timeScale}
              points={cellularModel.points}
              stations={cellularModel.stations}
              obstacles={cellularModel.obstacles}
              onToggleStation={onToggleStation}
            />
          )}
          {props.lessonId === 8 && tvModel && (
            <TvBroadcastScene
              state={props.uhfState}
              timeScale={timeScale}
              points={tvModel.points}
              selectedIndex={tvSelectedIndex}
              onSelectIndex={setTvSelectedIndex}
              onToggleImg={(idx) =>
                setTvImgBoosted((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                })
              }
              onToggleSnd={(idx) =>
                setTvSndBoosted((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                })
              }
            />
          )}
          {props.lessonId === 9 && <BodyElectricScene state={props.bodyElecState} timeScale={timeScale} />}
          {props.lessonId === 10 && <StepVoltageScene state={props.groundState} timeScale={timeScale} />}
          {props.lessonId === 11 && props.threePhaseState && (
            <ThreePhaseNeutralScene state={props.threePhaseState} timeScale={timeScale} />
          )}
          {props.lessonId === 12 && props.tnEarthingState && (
            <TnEarthingLabScene state={props.tnEarthingState} timeScale={timeScale} />
          )}
          {props.lessonId === 13 && props.fireSafetyState && (
            <FireSafetyLabScene state={props.fireSafetyState} timeScale={timeScale} />
          )}
          {props.lessonId === 14 && props.firstAidElectricState && (
            <FirstAidElectricLabScene stage={props.firstAidElectricState.stage} timeScale={timeScale} />
          )}
          {props.lessonId === 15 && props.accidentInvestigationState && (
            <AccidentInvestigationLabScene state={props.accidentInvestigationState} timeScale={timeScale} />
          )}
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.06}
            {...(props.lessonId === 13
              ? {
                  minDistance: 6.5,
                  maxDistance: 38,
                  target: [0, 2.25, 0] as [number, number, number],
                }
              : props.lessonId === 14
                ? {
                    minDistance: 4.2,
                    maxDistance: 22,
                    target: [0, 0.45, 0] as [number, number, number],
                  }
                : props.lessonId === 15
                  ? {
                      minDistance: 5.4,
                      maxDistance: 28,
                      target: [0, 1.76, 0] as [number, number, number],
                    }
                : {})}
          />
          <hemisphereLight args={['#b1e1ff', '#b97a20', props.lessonId === 15 ? 0.42 : 0.25]} />
        </SafeCanvas>
      </Box>
    </Paper>
  );
}
