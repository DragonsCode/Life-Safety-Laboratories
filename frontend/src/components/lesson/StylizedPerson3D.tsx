import { useMemo } from 'react';
import * as THREE from 'three';

/** Совпадает с мешами рук в TheoryStylizedPerson */
const ARM_ROT_L = Math.PI / 4.2;
const ARM_ROT_R = -Math.PI / 4.2;
const ARM_SHOULDER_Y = 1.14;
const ARM_CAPSULE_LEN = 0.52;

/** Половина длины капсулы руки — расстояние от плеча до кисти вдоль оси руки */
export const STYLIZED_ARM_HALF_LEN = ARM_CAPSULE_LEN / 2;

/** Локальные координаты левого плеча (как у меша руки) */
export function stylizedPersonLeftShoulderLocal(footHalfSep = 0.11): [number, number, number] {
  const h = footHalfSep;
  const refHalf = 0.11;
  const armX = 0.22 * (h / refHalf);
  return [-armX, ARM_SHOULDER_Y, 0];
}

/**
 * Примерная точка кисти — дальний конец капсулы руки (локальные оси фигуры, как у детей TheoryStylizedPerson).
 * Используйте для пропсов, инструментов в руках и т.п.
 */
export function stylizedPersonHandTipLocal(
  which: 'left' | 'right',
  footHalfSep = 0.11,
): [number, number, number] {
  const h = footHalfSep;
  const refHalf = 0.11;
  const armX = 0.22 * (h / refHalf);
  const halfLen = ARM_CAPSULE_LEN / 2;
  const rot = which === 'left' ? ARM_ROT_L : ARM_ROT_R;
  /** Нижний конец капсулы в локали меша (направление «к кисти» в типичной Т-позе) */
  const lx = 0;
  const ly = -halfLen;
  const x1 = lx * Math.cos(rot) - ly * Math.sin(rot);
  const y1 = lx * Math.sin(rot) + ly * Math.cos(rot);
  const sx = which === 'left' ? -armX : armX;
  return [sx + x1, ARM_SHOULDER_Y + y1, 0];
}

/**
 * Точка на ладони (направление «плечо → кисть», без ручного смещения к щиту):
 * чуть ближе к телу от условного кончика капсулы и слегка вперёд (+Z) — зона контакта с предметом.
 */
export function stylizedPersonPalmCenterLocal(
  which: 'left' | 'right',
  footHalfSep = 0.11,
  alongArm = 0.072,
  forwardZ = 0.055,
): [number, number, number] {
  const refHalf = 0.11;
  const h = footHalfSep;
  const armX = 0.22 * (h / refHalf);
  const shoulder: [number, number, number] = which === 'left' ? [-armX, ARM_SHOULDER_Y, 0] : [armX, ARM_SHOULDER_Y, 0];
  const tip = stylizedPersonHandTipLocal(which, footHalfSep);
  const dx = tip[0] - shoulder[0];
  const dy = tip[1] - shoulder[1];
  const dz = tip[2] - shoulder[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return [tip[0], tip[1], tip[2] + forwardZ];
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  return [tip[0] - ux * alongArm, tip[1] - uy * alongArm, tip[2] - uz * alongArm + forwardZ];
}

/**
 * Хват длинного рычага двумя руками: между кистями по X/Y и смещение вперёд (+Z).
 * Внимание: среднее по X часто ≈ 0 (симметрия рук) — для палки «из руки», а не из центра тела, лучше {@link stylizedPersonHandTipLocal}.
 */
export function stylizedPersonTwoHandStickGripLocal(footHalfSep = 0.11): [number, number, number] {
  const l = stylizedPersonHandTipLocal('left', footHalfSep);
  const r = stylizedPersonHandTipLocal('right', footHalfSep);
  return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + 0.04, 0.17];
}

/**
 * А-поза: обе руки зеркально — вниз и в стороны (ось −Y капсулы → кисти).
 * Без общего смещения по Z, чтобы левая/правая были симметричны в фронтальной плоскости.
 */
function quatArmAPose(which: 'left' | 'right') {
  const sx = which === 'left' ? -1 : 1;
  const dir = new THREE.Vector3(sx * 0.94, -0.44, 0).normalize();
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  return q;
}

/**
 * Стилизованная фигура как в теории занятия 9 («Путь тока»): обувь, брюки, рубашка, кожа;
 * шаг задаётся половиной расстояния между стопами.
 */
export function TheoryStylizedPerson({
  footHalfSep = 0.11,
  torsoPath,
  shirt = '#5c6d8c',
  pants = '#455a64',
  skin = '#deb897',
  leftArmAimAt,
  rightArmAimAt,
  armsMode = 'default',
  /** Множитель половины размаха плеч (по умолчанию 1). Меньше 1 — руки ближе к телу и друг к другу. */
  shoulderSpreadScale = 1,
  /**
   * Смещение основания рук по +Z (к груди в локали фигуры). При наклоне спасателя помогает
   * не рисовать «сустав» сзади линии плеч.
   */
  armShoulderZ = 0,
}: {
  footHalfSep?: number;
  torsoPath?: { color: string; opacity: number };
  shirt?: string;
  pants?: string;
  skin?: string;
  /** Локальная точка, на которую «смотрит» кисть (поворот левой капсулы руки) */
  leftArmAimAt?: [number, number, number];
  /** Локальная точка для правой руки (симметрично {@link leftArmAimAt}) */
  rightArmAimAt?: [number, number, number];
  armsMode?: 'default' | 'aPose';
  shoulderSpreadScale?: number;
  armShoulderZ?: number;
}) {
  const h = footHalfSep;
  const refHalf = 0.11;
  const armX = 0.22 * (h / refHalf) * shoulderSpreadScale;

  const leftArmQuat = useMemo(() => {
    if (leftArmAimAt) {
      const shoulder = new THREE.Vector3(-armX, ARM_SHOULDER_Y, armShoulderZ);
      const target = new THREE.Vector3(...leftArmAimAt);
      const dir = target.clone().sub(shoulder);
      if (dir.lengthSq() < 1e-10) {
        return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ARM_ROT_L));
      }
      dir.normalize();
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      return q;
    }
    if (armsMode === 'aPose') return quatArmAPose('left');
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ARM_ROT_L));
  }, [leftArmAimAt, armX, armsMode, armShoulderZ]);

  const rightArmQuat = useMemo(() => {
    if (rightArmAimAt) {
      const shoulder = new THREE.Vector3(armX, ARM_SHOULDER_Y, armShoulderZ);
      const target = new THREE.Vector3(...rightArmAimAt);
      const dir = target.clone().sub(shoulder);
      if (dir.lengthSq() < 1e-10) {
        return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ARM_ROT_R));
      }
      dir.normalize();
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      return q;
    }
    if (armsMode === 'aPose') return quatArmAPose('right');
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ARM_ROT_R));
  }, [rightArmAimAt, armX, armsMode, armShoulderZ]);

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[-h, 0.04, 0]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.22]} />
        <meshStandardMaterial color="#37474f" roughness={0.65} />
      </mesh>
      <mesh position={[h, 0.04, 0]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.22]} />
        <meshStandardMaterial color="#37474f" roughness={0.65} />
      </mesh>
      <mesh position={[-h, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.58, 6, 10]} />
        <meshStandardMaterial color={pants} roughness={0.82} />
      </mesh>
      <mesh position={[h, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.58, 6, 10]} />
        <meshStandardMaterial color={pants} roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.38, 8, 16]} />
        <meshStandardMaterial color={shirt} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.33, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.14, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[-armX, ARM_SHOULDER_Y, armShoulderZ]} quaternion={leftArmQuat} castShadow>
        <capsuleGeometry args={[0.05, ARM_CAPSULE_LEN, 6, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      <mesh position={[armX, ARM_SHOULDER_Y, armShoulderZ]} quaternion={rightArmQuat} castShadow>
        <capsuleGeometry args={[0.05, ARM_CAPSULE_LEN, 6, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      {torsoPath ? (
        <mesh position={[0, 1.05, 0.04]}>
          <capsuleGeometry args={[0.07, 0.32, 6, 12]} />
          <meshBasicMaterial
            color={torsoPath.color}
            transparent
            opacity={torsoPath.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}
