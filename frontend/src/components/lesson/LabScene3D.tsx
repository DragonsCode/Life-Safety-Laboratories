import { useMemo, useRef, useState } from 'react';
import { Alert, Box, Chip, IconButton, Paper, Slider, Stack, Tooltip, Typography } from '@mui/material';
import { OrbitControls, Text as DreiText } from '@react-three/drei';
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
  bodyCurrentMA, totalBodyImpedance, skinImpedance, classifyCurrentDanger,
  stepVoltage, groundPotential, safeDistance,
} from '../../formulas/electricSafety';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo';
import type { ComponentProps } from 'react';

/** Wrap drei Text with bold weight + dark outline so every label is legible */
function Text(props: ComponentProps<typeof DreiText>) {
  const size = (props.fontSize as number | undefined) ?? 0.14;
  return (
    <DreiText
      fontWeight={700}
      outlineWidth={size * 0.14}
      outlineColor="#111111"
      anchorX="center"
      anchorY="middle"
      {...props}
    />
  );
}

type LampType = 'incandescent' | 'fluorescent' | 'led';

interface LabSceneProps {
  lessonId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
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
    powerW: number;
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
      <Text fontSize={0.1} color="#aaa" position={[state.sensorOffsetM, 0.95, 1]}>
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
      <Text fontSize={0.13} color="#2b2b2b" position={[-roomL / 4, 0.18, -lineOffset - 0.28]}>
        {`L' = ${lPrime.toFixed(2)}`}
      </Text>
      <mesh position={[0, 0.03, -lineOffset / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[lineOffset, 0.03]} />
        <meshBasicMaterial color="#2b2b2b" />
      </mesh>
      <Text fontSize={0.13} color="#2b2b2b" position={[0.3, 0.18, -lineOffset / 2]}>
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
      <Text fontSize={0.1} color="#f5f5f5" position={[0, state.heightM + 0.8, 0]}>
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
        <Text fontSize={0.1} color="#aaa" position={[0, 1.95, 0]}>
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
      <Text fontSize={0.12} color="#333333" position={[0, 3.0, 0]}>
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
        <Text fontSize={0.11} color="#bbb" position={[0, 2.1, 0]}>
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
        <meshStandardMaterial color="#3a3e44" roughness={0.9} />
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
      <Text fontSize={0.14} color="#80cbc4" position={[0, 3.3, 0]}>
        {`Экран: δ = ${(thickness * 1000).toFixed(2)} мм | ω = ${omega.toExponential(2)} 1/с`}
      </Text>
      <Text fontSize={0.11} color="#b0bec5" position={[0, 3.05, 0]}>
        {`ППЭδдоп = ${ppeAllow.toExponential(2)} Вт/м² | L = ${L.toFixed(3)}`}
      </Text>

      {/* Waveguide (tube through shield) */}
      <mesh position={[0, 0.5, 2.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[state.waveguideDiameterM * 5, state.waveguideDiameterM * 5, Math.max(0.1, wgLen * 2), 16]} />
        <meshStandardMaterial color="#455a64" metalness={0.6} transparent opacity={0.7} />
      </mesh>
      <Text fontSize={0.11} color="#a5d6a7" position={[0, 1.3, 2.5]}>
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
        <meshBasicMaterial color="#4caf50" transparent opacity={0.12} />
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
  const weakThreshold = maxE / 3;
  const maxD = Math.max(...state.distances, 100);
  const scaleX = (m: number) => Math.min(10, m / (maxD / 10));

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
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#2d4a22" roughness={0.92} />
      </mesh>

      {/* Cellular base stations (click to toggle booster) */}
      {stations.map((s) => (
        <group key={s.id} position={[scaleX(s.xM), 0, 0]}>
          {/* Big clickable halo (makes interaction obvious) */}
          <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => onToggleStation(s.id)}>
            <ringGeometry args={[0.25, 0.45, 48]} />
            <meshBasicMaterial color={s.boosted ? '#00e676' : '#ffd54f'} transparent opacity={0.65} />
          </mesh>
          <Text fontSize={0.10} color={s.boosted ? '#00e676' : '#ffd54f'} position={[0, 0.45, -2]}>
            {s.boosted ? 'клик: снять усилитель' : 'клик: поставить усилитель'}
          </Text>

          <mesh position={[0, 2.2, -2]} castShadow onClick={() => onToggleStation(s.id)}>
            <cylinderGeometry args={[0.08, 0.14, 4.4, 8]} />
            <meshStandardMaterial color={s.boosted ? '#00e676' : '#b0bec5'} metalness={0.6} />
          </mesh>
          <mesh position={[0, 4.5, -2]} onClick={() => onToggleStation(s.id)}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial
              color={s.boosted ? '#00e676' : '#ff5722'}
              emissive={s.boosted ? '#00e676' : '#ff3300'}
              emissiveIntensity={s.boosted ? 1.8 : 1.2}
            />
          </mesh>
          <Text fontSize={0.11} color={s.boosted ? '#00e676' : '#ffcc80'} position={[0, 5.0, -2]}>
            {`${s.label}${s.boosted ? ' (усил.)' : ''}`}
          </Text>
        </group>
      ))}

      <Text fontSize={0.14} color="#ffd54f" position={[0, 6.9, 0]}>
        {`Сотовая связь (упрощ.): P=${state.powerKW} кВт, Ga=${state.gainAntenna}, препятствия → потери`}
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
            <Text fontSize={0.09} color="#bbb" position={[0, 0.85, 0]}>
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
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 11, 64]} />
        <meshBasicMaterial color="#4caf50" transparent opacity={0.08} />
      </mesh>

      <pointLight position={[0, 8, 4]} color="#fff5e0" intensity={1} distance={15} decay={2} />
      <pointLight position={[8, 4, -4]} color="#ffeedd" intensity={0.5} distance={12} decay={2} />
    </>
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
  const maxR = Math.max(...state.distances, 1);
  const scaleX = (m: number) => Math.min(9, m / (maxR / 9));
  const idx = Math.min(Math.max(0, selectedIndex), Math.max(0, points.length - 1));
  const p = points[idx];
  const houseX = 9.6;

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
  const sndWeak = p ? p.EsndFinal < sndWeakThreshold && !p.sndBoost : false;

  const flicker = 0.5 + 0.5 * Math.sin(timeR.current * 10 + idx * 2);
  const videoNoiseOpacity = imgWeak ? Math.max(0.25, 0.35 + 0.35 * flicker) : 0.04;
  const audioNoiseOpacity = sndWeak ? Math.max(0.2, 0.35 + 0.45 * flicker) : 0.04;

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color="#bfe3c0" roughness={0.95} />
      </mesh>

      {/* Road */}
      <mesh position={[5.3, 0.01, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 1.6]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.98} />
      </mesh>
      <mesh position={[5.3, 0.012, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.06]} />
        <meshStandardMaterial color="#fff59d" emissive="#fff59d" emissiveIntensity={0.18} />
      </mesh>

      {/* Obstacles in order: buildings -> trees -> house */}
      {[
        // buildings first (closer to tower)
        { x: 2.3, z: 0.1, w: 1.8, d: 1.9, h: 3.6, c: '#90a4ae' },
        { x: 3.9, z: -0.1, w: 2.6, d: 2.0, h: 4.4, c: '#78909c' },
        { x: 4.9, z: 0.2, w: 1.4, d: 1.6, h: 3.0, c: '#b0bec5' },
      ].map((b, i) => (
        <mesh key={`bld-${i}`} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.c} roughness={0.9} />
        </mesh>
      ))}
      {/* a lot of trees after buildings */}
      {[
        { x: 5.7, z: 0.9 }, { x: 6.1, z: 0.1 }, { x: 6.5, z: -0.8 },
        { x: 6.9, z: 0.6 }, { x: 7.3, z: -0.2 }, { x: 7.7, z: 0.9 },
        { x: 8.1, z: 0.2 }, { x: 8.4, z: -0.7 },
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

      {/* TV Tower (visual scale only; calculations use real h) */}
      {(() => {
        const towerH = Math.max(3.2, Math.min(5.2, state.heightM * 0.18));
        return (
          <group>
            <mesh position={[0, towerH / 2, 0]} castShadow>
              <boxGeometry args={[0.3, towerH, 0.3]} />
              <meshStandardMaterial color="#78909c" metalness={0.5} />
            </mesh>
            {/* Antenna array */}
            {[-0.4, 0, 0.4].map((z, i) => (
              <mesh key={`ant-${i}`} position={[0, towerH - 0.3, z]} castShadow>
                <boxGeometry args={[0.8, 0.08, 0.04]} />
                <meshStandardMaterial color="#e65100" metalness={0.4} />
              </mesh>
            ))}
            <Text fontSize={0.16} color="#ff7043" position={[0, towerH + 0.6, 0]}>
              {`Телевышка: P = ${state.powerW} Вт | G = ${state.gain}`}
            </Text>
            <Text fontSize={0.12} color="#ffab91" position={[0, towerH + 0.3, 0]}>
              {`h = ${state.heightM} м | f = ${state.frequencyMHz} МГц`}
            </Text>
          </group>
        );
      })()}

      {/* Animated radiation pulses */}
      <group ref={pulseRef}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`uhf-pulse-${i}`} position={[0, state.heightM - 0.5, 0]} rotation={[Math.PI / 4, 0, 0]}>
            <torusGeometry args={[1, 0.02, 6, 24]} />
            <meshBasicMaterial color="#ff7043" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Receiver positions (click markers to move house) */}
      {points.map((pt, i) => {
        const x = scaleX(pt.rM);
        const active = i === idx;
        const pI = points[i];
        const imgWeakI = pI.EimgFinal < imgWeakThreshold && !pI.imgBoost;
        const sndWeakI = pI.EsndFinal < sndWeakThreshold && !pI.sndBoost;
        return (
          <group key={`rx-${i}`} position={[x, 0, 0]}>
            <mesh position={[0, 0.05, 0]} onClick={() => onSelectIndex(i)}>
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

            {/* Big boosters in front (towards camera) */}
            <group position={[-0.55, 0.22, 2.0]}>
              <mesh onClick={() => onToggleImg(i)}>
                <boxGeometry args={[0.75, 0.32, 0.34]} />
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
            <group position={[0.55, 0.22, 2.0]}>
              <mesh onClick={() => onToggleSnd(i)}>
                <boxGeometry args={[0.75, 0.32, 0.34]} />
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
        <group position={[houseX, 0, 0]}>
          {/* house base */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.0, 1.0]} />
            <meshStandardMaterial color="#d7ccc8" roughness={0.95} />
          </mesh>
          {/* roof (raised - no collisions with walls) */}
          <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.92, 0.9, 4]} />
            <meshStandardMaterial color="#8d6e63" roughness={0.9} />
          </mesh>

          {/* TV set inside / on wall */}
          <mesh position={[0.62, 0.65, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.52, 0.36, 0.12]} />
            <meshStandardMaterial color="#111" roughness={0.9} />
          </mesh>
          <mesh position={[0.70, 0.65, 0]}>
            <planeGeometry args={[0.44, 0.28]} />
            <meshBasicMaterial color={imgWeak ? '#ffffff' : '#1de9b6'} transparent opacity={imgWeak ? 0.6 : 0.85} />
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

          {/* Audio indicator panel */}
          <mesh position={[0.62, 0.25, -0.45]}>
            <boxGeometry args={[0.55, 0.18, 0.05]} />
            <meshBasicMaterial color={sndWeak ? '#ff5252' : '#2196f3'} transparent opacity={0.9} />
          </mesh>
          <mesh position={[0.62, 0.25, -0.445]}>
            <boxGeometry args={[0.55, 0.18, 0.05]} />
            <meshBasicMaterial color="#000" transparent opacity={audioNoiseOpacity} />
          </mesh>
          {sndWeak && (
            <Text fontSize={0.1} color="#ff9100" position={[0.62, 0.25, -0.41]}>
              {'▲'}
            </Text>
          )}

          {/* Labels */}
          <Text fontSize={0.12} color="#fff" position={[0, 2.75, 0]}>
            {`Дом-приёмник: r = ${p.rM} м`}
          </Text>
          <Text fontSize={0.1} color="#ffd54f" position={[0, 2.45, 0]}>
            {`E_из=${p.EimgFinal.toFixed(2)} | E_зв=${p.EsndFinal.toFixed(2)} В/м`}
          </Text>

          <Text fontSize={0.09} color="#cfd8dc" position={[0, 2.2, 0]}>
            {'Усилители ставятся на точках r1..r5'}
          </Text>
        </group>
      )}

      <pointLight position={[0, state.heightM + 3, 4]} color="#fff5e0" intensity={1} distance={18} decay={2} />
      <pointLight position={[8, 3, -3]} color="#ffeedd" intensity={0.5} distance={12} decay={2} />
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
      <Text fontSize={0.1} color="#ccc" position={[0, 1.8, 0.35]}>
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

          <Text fontSize={0.07} color="#bbb" position={[0.0, 0.1, 0.03]}>
            {'0 c'}
          </Text>
          <Text fontSize={0.07} color="#bbb" position={[1.6, 0.1, 0.03]}>
            {'5 c'}
          </Text>
          <Text fontSize={0.07} color="#bbb" position={[-0.05, 0.9, 0.03]}>
            {'I'}
          </Text>
          <Text fontSize={0.07} color="#bbb" position={[0.75, -0.02, 0.03]}>
            {'t'}
          </Text>
          <Text fontSize={0.07} color="#bbb" position={[0.75, 0.25, 0.03]}>
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
      <Text fontSize={0.1} color="#bbb" position={[1.5, 1.8, 0]}>
        {`Повреждение: ${damagedPhases[0]}↔${damagedPhases[1]} | U = ${state.voltageV} В`}
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
      <Text fontSize={0.1} color="#aaa" position={[personX, 1.55, 0]}>
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
        const boosterMult = s.boosted ? 1.8 : 1;
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
    const videoPower = props.uhfState.powerW * 0.8;
    const audioPower = props.uhfState.powerW * 0.2;

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
      const p0 = tvModel?.points[0];
      if (!p0) return { headline: 'Телевещание: нет данных.' };
      return {
        headline: `Телевещание: E_из=${p0.EimgFinal.toFixed(2)} В/м; E_зв=${p0.EsndFinal.toFixed(2)} В/м | R=${p0.Rm.toFixed(
          1,
        )} м | F(Δ)=${p0.Fd.toFixed(3)}`,
      };
    }
    if (props.lessonId === 9) {
      const Zk = skinImpedance(props.bodyElecState.skinResistanceOhm, props.bodyElecState.frequencyHz, props.bodyElecState.capacitanceNF * 1e-9);
      const Zt = totalBodyImpedance(Zk, props.bodyElecState.internalResistanceOhm);
      const I = bodyCurrentMA(props.bodyElecState.voltageV, Zt);
      const danger = classifyCurrentDanger(I, props.bodyElecState.frequencyHz <= 60);
      return { headline: `Ток через тело: I = ${I.toFixed(2)} мА | Z = ${Zt.toFixed(0)} Ом | ${danger === 'safe' ? 'безопасный' : danger === 'perceptible' ? 'ощутимый' : danger === 'non-releasing' ? 'неотпускающий' : 'фибрилляция'}` };
    }
    const Ush = stepVoltage(props.groundState.faultCurrentA, props.groundState.soilResistivityOhmM, props.groundState.distanceM, props.groundState.stepLengthM);
    const phi = groundPotential(props.groundState.faultCurrentA, props.groundState.soilResistivityOhmM, props.groundState.distanceM);
    return { headline: `Напряжение шага: Uш = ${Ush.toFixed(1)} В | φ = ${phi.toFixed(1)} В | x = ${props.groundState.distanceM} м` };
  }, [props]);

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
            <circle key={i} cx={toX(p.dM)} cy={toY(p.eFinal)} r="2.5" fill={p.eFinal < maxE / 3 ? '#f44336' : '#ff9800'} />
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
          Лабораторная 3D-сцена
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
          {props.lessonId === 7 && 'Сцена визуализирует сигнал сотовой связи: несколько базовых станций, преграды (высотки/деревья), выбор лучшей станции в точке и усилители на станциях. График сверху перестраивается динамически.'}
          {props.lessonId === 8 && 'Сцена симулирует телевещание: отдельно видео и звук. При слабом сигнале появляются помехи/рассинхрон, усилители включаются отдельно для видео и для звука. График строится после цикла 8.6→8.5→8.4.'}
          {props.lessonId === 9 && 'Сцена демонстрирует эквивалентную схему «напряжение → тело → земля» с визуализацией опасности тока через человека.'}
          {props.lessonId === 10 && 'Сцена показывает растекание тока замыкания в грунте, эквипотенциальные зоны и напряжение шага между ногами человека.'}
        </Alert>
      )}
      <Box sx={{ height: { xs: 320, md: 420 }, borderRadius: 1, overflow: 'hidden' }}>
        <SafeCanvas shadows camera={{ position: [5, 6, 7].includes(props.lessonId) ? [8, 5, 10] : props.lessonId === 10 ? [10, 6, 10] : [8, 5, 8], fov: 46 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[5, 10, 3]} intensity={0.7} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
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
          <OrbitControls enablePan={false} />
          <hemisphereLight args={['#b1e1ff', '#b97a20', 0.25]} />
        </SafeCanvas>
      </Box>
    </Paper>
  );
}
