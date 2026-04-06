import { useMemo, useRef } from 'react';
import { Billboard, Text as DreiText } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  TheoryStylizedPerson,
  STYLIZED_ARM_HALF_LEN,
  stylizedPersonLeftShoulderLocal,
} from './StylizedPerson3D';

export type FirstAidElectricStage = 'disconnect' | 'airway' | 'breaths' | 'cpr';

function Label(props: { children: string; position: [number, number, number]; color?: string; size?: number }) {
  const { position, children, color = '#eceff1', size = 0.11 } = props;
  return (
    <Billboard position={position} follow>
      <DreiText
        fontWeight={700}
        outlineWidth={size * 0.14}
        outlineColor="#141414"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0]}
        fontSize={size}
        color={color}
        maxWidth={5}
      >
        {children}
      </DreiText>
    </Billboard>
  );
}

export interface FirstAidElectricLabSceneProps {
  stage: FirstAidElectricStage;
  timeScale: number;
}

/** Оттенки рубашки — те же материалы, что в теории №9, только чуть разведены по ролям */
const SHIRT_VICTIM = '#5c6d8c';
const SHIRT_HELPER = '#4a6b5c';

/** Цилиндр вдоль отрезка from→to (ось Y цилиндра = направление толкания) */
function WoodStickBetween({
  from,
  to,
  radius = 0.038,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius?: number;
}) {
  const { position, quaternion, height } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const h = Math.max(0.08, dir.length());
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: mid, quaternion: q, height: h };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius * 1.06, height, 8]} />
      <meshStandardMaterial color="#6d4c41" roughness={0.9} />
    </mesh>
  );
}

/**
 * Наглядная схема занятия 14: этапы доврачебной помощи при поражении током.
 * Человечки — как в первой 3D-визуализации теории занятия 9 (TheoryStylizedPerson).
 */
export default function FirstAidElectricLabScene({ stage, timeScale }: FirstAidElectricLabSceneProps) {
  const sparkRef = useRef<THREE.PointLight>(null);
  const arcT = useRef(0);

  /**
   * Этап 1: хват на линии палки = плечо + направление к концу рычага × половина длины капсулы руки
   * (кисть на палке). Левая рука в TheoryStylizedPerson наводится на grip через leftArmAimAt.
   */
  const disconnectRescuer = useMemo(() => {
    const victimX = -0.72;
    const victimZ = 0.1;
    const rescuerPos = new THREE.Vector3(0.42, 0, -0.12);
    const ry = Math.atan2(victimX - rescuerPos.x, victimZ - rescuerPos.z);
    const up = new THREE.Vector3(0, 1, 0);
    const tipWorld = new THREE.Vector3(victimX + 0.2, 0.98, victimZ);
    const tipDelta = tipWorld.clone().sub(rescuerPos);
    tipDelta.applyAxisAngle(up, -ry);
    const tipLocal: [number, number, number] = [tipDelta.x, tipDelta.y, tipDelta.z];
    const shoulder = new THREE.Vector3(...stylizedPersonLeftShoulderLocal());
    const tip = new THREE.Vector3(...tipLocal);
    const dir = tip.clone().sub(shoulder);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
    else dir.normalize();
    const hl = STYLIZED_ARM_HALF_LEN;
    const gripLocal: [number, number, number] = [
      shoulder.x + dir.x * hl,
      shoulder.y + dir.y * hl,
      shoulder.z + dir.z * hl,
    ];
    return {
      rescuerPos: [rescuerPos.x, rescuerPos.y, rescuerPos.z] as const,
      ry,
      gripLocal,
      tipLocal,
    };
  }, []);

  /**
   * Этап 4: обе кисти к центру грудины пострадавшего (нижняя треть / центр грудной клетки).
   * Локаль цели — в системе координат {@link TheoryStylizedPerson} после цепочки групп спасателя.
   */
  const cprRescuerScene = useMemo(() => {
    const root: [number, number, number] = [1.15, 0.04, 1.08];
    const leanX = -0.5;
    const sternumOnVictim = new THREE.Vector3(0, 1.06, 0.11);
    const victimM = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    const sternumWorld = sternumOnVictim.clone().applyMatrix4(victimM);
    const T = new THREE.Matrix4().makeTranslation(...root);
    const R1 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
    const R2 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const R3 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(leanX, 0, 0));
    const rescuerWorld = new THREE.Matrix4().copy(T).multiply(R1).multiply(R2).multiply(R3);
    const inv = new THREE.Matrix4().copy(rescuerWorld).invert();
    const aim = sternumWorld.clone().applyMatrix4(inv);
    /** Совпадает с ARM_SHOULDER_Y в TheoryStylizedPerson — сдвиг цели вдоль «руки к груди», касание грудины */
    const shoulderMid = new THREE.Vector3(0, 1.14, 0);
    const towardChest = aim.clone().sub(shoulderMid);
    if (towardChest.lengthSq() > 1e-10) {
      towardChest.normalize();
      aim.addScaledVector(towardChest, 0.14);
    }
    const pullToMidlineX = 0.92;
    const sternumAimLocal: [number, number, number] = [aim.x * pullToMidlineX, aim.y, aim.z];
    return { root, leanX, sternumAimLocal };
  }, []);

  useFrame((_, delta) => {
    arcT.current += delta * timeScale;
    const t = arcT.current;
    if (sparkRef.current && stage === 'disconnect') {
      sparkRef.current.intensity = 1.2 + 2.4 * (Math.sin(t * 18) * 0.5 + 0.5);
    }
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#c8bfb4" roughness={0.88} />
      </mesh>

      {/* ─── Этап 1: отключение от тока (сухий диэлектрик) ─── */}
      {stage === 'disconnect' && (
        <group>
          {/*
            Провод вдоль X; пострадавший развернут на 90° — ступни по разные стороны жилы (видно касание).
            Искра у точки касания стопы и провода.
          */}
          <mesh position={[-0.72, 0.04, 0.1]} castShadow>
            <boxGeometry args={[1.6, 0.06, 0.08]} />
            <meshStandardMaterial color="#fdd835" metalness={0.4} emissive="#ff6f00" emissiveIntensity={0.15} />
          </mesh>
          {/* Пострадавший стоит прямо над проводом */}
          <group position={[-0.72, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
            <TheoryStylizedPerson shirt={SHIRT_VICTIM} />
          </group>
          {/** Точка касания: подушечка стопы на жиле (мир: чуть левее центра фигуры по X) */}
          <pointLight ref={sparkRef} position={[-0.72, 0.09, 0.1]} color="#ff9100" intensity={1.5} distance={2.8} decay={2} />
          <mesh position={[-0.72, 0.085, 0.1]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#ff5722" emissive="#ff1744" emissiveIntensity={0.55} />
          </mesh>
          <group position={disconnectRescuer.rescuerPos} rotation={[0, disconnectRescuer.ry, 0]}>
            <TheoryStylizedPerson
              shirt={SHIRT_HELPER}
              leftArmAimAt={disconnectRescuer.gripLocal}
              armsMode="aPose"
            />
            <WoodStickBetween from={disconnectRescuer.gripLocal} to={disconnectRescuer.tipLocal} />
          </group>
          <Label position={[0, 2.35, 0]} color="#fff9c4">
            Сухой деревянный рычаг / изоляция — не металл и не мокрое
          </Label>
        </group>
      )}

      {/* ─── Этап 2: проходимость путей — на спине на коврике, руки А-поза; лёгкий наклон для запрокидывания головы ─── */}
      {stage === 'airway' && (
        <group>
          <group position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TheoryStylizedPerson shirt={SHIRT_VICTIM} armsMode="aPose" />
          </group>
          <group position={[0.52, 0, 1.92]} rotation={[0, -2.88, 0]}>
            <TheoryStylizedPerson shirt={SHIRT_HELPER} armsMode="aPose" />
          </group>
          <Label position={[0, 2.2, 0]} color="#e1f5fe">
            Запрокинуть голову, поднять подбородок — проходимость дыхательных путей
          </Label>
        </group>
      )}

      {/* ─── Этап 3: «рот в рот» (схема) ─── */}
      {stage === 'breaths' && (
        <group>
          <group position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TheoryStylizedPerson shirt={SHIRT_VICTIM} armsMode="aPose" />
          </group>
          {/*
            Спасатель:
            - тело перпендикулярно пострадавшему (повёрнуто по Y примерно на 90°),
            - сначала «лежит» (Rx≈90°), затем приподнят (уменьшаем Rx и поднимаем Y),
            - голова сведена к голове пострадавшего (позиция рядом с Z≈1.5).
          */}
          <group position={[1.45, 0.04, 1.53]}>
            {/* 1) Разворачиваем тело перпендикулярно пострадавшему (и головой к голове пострадавшего) */}
            <group rotation={[0, -Math.PI / 2, 0]}>
              {/* 2) «Лежит» на земле */}
              <group rotation={[Math.PI / 2, 0, 0]}>
                {/* 3) Приподнимаем/наклоняем вперёд к лицу пострадавшего */}
                <group rotation={[-0.30, 0, 0]}>
                  <TheoryStylizedPerson shirt={SHIRT_HELPER} armsMode="aPose" />
                </group>
              </group>
            </group>
          </group>
          <Label position={[0, 2.25, 0]} color="#b3e5fc">
            Искусственное дыхание: ~12 вдохов в минуту (около 5 с на цикл)
          </Label>
        </group>
      )}

      {/* ─── Этап 4: непрямой массаж, один помощник ─── */}
      {stage === 'cpr' && (
        <group>
          {/* Лежит на спине: ось тела вдоль −Z после поворота */}
          <group position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TheoryStylizedPerson shirt={SHIRT_VICTIM} armsMode="aPose" />
          </group>
          <group position={cprRescuerScene.root}>
            {/* 1) Разворачиваем тело перпендикулярно пострадавшему (и головой к голове пострадавшего) */}
            <group rotation={[0, -Math.PI / 2, 0]}>
              {/* 2) «Лежит» на земле */}
              <group rotation={[Math.PI / 2, 0, 0]}>
                {/* 3) Наклон вперёд — руки к центру грудины пострадавшего */}
                <group rotation={[cprRescuerScene.leanX - 0.15, 0, 0]}>
                  <TheoryStylizedPerson
                    shirt={SHIRT_HELPER}
                    shoulderSpreadScale={0.52}
                    armShoulderZ={0.22}
                    leftArmAimAt={cprRescuerScene.sternumAimLocal}
                    rightArmAimAt={cprRescuerScene.sternumAimLocal}
                  />
                </group>
              </group>
            </group>
          </group>
          <Label position={[0, 2.35, 0]} color="#ffe082">
            Непрямой массаж: центр грудины; один помощник — 2 вдоха → 15 нажатий (~60–65/мин)
          </Label>
        </group>
      )}
    </>
  );
}
