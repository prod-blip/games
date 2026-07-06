import * as THREE from 'three';
import type { ChaserAssembly } from '../types';
import type { VehicleState } from './vehiclePhysics';

const carBox = new THREE.Box3();
const torsoBox = new THREE.Box3();

export type GameOverSequenceState = {
  active: boolean;
  timer: number;
  crush: number;
  crushVelocity: number;
  impactDone: boolean;
  completed: boolean;
};

export function createGameOverSequenceState(): GameOverSequenceState {
  return { active: false, timer: 0, crush: 0, crushVelocity: 0, impactDone: false, completed: false };
}

export function startGameOverSequence(sequence: GameOverSequenceState) {
  if (sequence.active) return;
  sequence.active = true;
  sequence.timer = 0;
  sequence.crush = 0;
  sequence.crushVelocity = 0;
  sequence.impactDone = false;
  sequence.completed = false;
}

export function updateGameOverSequence(
  sequence: GameOverSequenceState,
  vehicle: VehicleState,
  car: THREE.Group,
  chaser: ChaserAssembly,
  delta: number,
) {
  if (!sequence.active || sequence.completed) return;
  sequence.timer += delta;

  const braking = sequence.timer < 1.1 ? 1.15 : 2.6 + sequence.crush * 3.2;
  vehicle.velocity = THREE.MathUtils.lerp(vehicle.velocity, 0, delta * braking);
  vehicle.zVelocity = THREE.MathUtils.lerp(vehicle.zVelocity, 0, delta * 3.2);
  vehicle.carX = Math.max(0, vehicle.carX + vehicle.velocity * delta);
  vehicle.carZ += vehicle.zVelocity * delta;

  const approachProgress = THREE.MathUtils.smoothstep(sequence.timer, 0.0, 0.72);
  const dropProgress = THREE.MathUtils.smoothstep(sequence.timer, 0.48, 1.35);
  const pinProgress = THREE.MathUtils.smoothstep(sequence.timer, 1.0, 2.55);

  if (!sequence.impactDone && sequence.timer > 1.05) {
    sequence.impactDone = true;
    sequence.crushVelocity = 4.2;
  }

  const targetCrush = pinProgress * 0.64;
  const crushSpring = (targetCrush - sequence.crush) * 24;
  const crushDamping = sequence.crushVelocity * 8.5;
  sequence.crushVelocity += (crushSpring - crushDamping) * delta;
  sequence.crush += sequence.crushVelocity * delta;
  sequence.crush = THREE.MathUtils.clamp(sequence.crush, 0, 0.68);

  const impactShake =
    sequence.timer > 1.0 && sequence.timer < 1.45
      ? Math.sin(sequence.timer * 78) * (1.45 - sequence.timer) * 0.035
      : 0;

  car.position.x = THREE.MathUtils.lerp(car.position.x, vehicle.carX + pinProgress * 0.22, delta * 5);
  car.position.y = THREE.MathUtils.lerp(car.position.y, 0.1 + impactShake - sequence.crush * 0.1, delta * 6);
  car.position.z = THREE.MathUtils.lerp(car.position.z, vehicle.carZ - pinProgress * 0.12, delta * 5);
  car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, -0.28 * pinProgress - sequence.crush * 0.06, delta * 7);
  car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, 0.14 * pinProgress, delta * 5);
  car.scale.set(
    THREE.MathUtils.lerp(car.scale.x, 1 + sequence.crush * 0.24, delta * 8),
    THREE.MathUtils.lerp(car.scale.y, 1 - sequence.crush * 0.62, delta * 8),
    THREE.MathUtils.lerp(car.scale.z, 1 + sequence.crush * 0.16, delta * 8),
  );
  car.visible = true;
  car.updateMatrixWorld(true);
  carBox.setFromObject(car);

  const carTop = carBox.max.y;
  const chaserTargetX = vehicle.carX - 1.55 + approachProgress * 0.98 + sequence.crush * 0.12;
  const chaserTargetZ = vehicle.carZ + 0.1;
  const desiredChaserY = carTop + 0.86 - dropProgress * 0.95;

  chaser.chaser.position.x = THREE.MathUtils.lerp(chaser.chaser.position.x, chaserTargetX, delta * 4.5);
  chaser.chaser.position.z = THREE.MathUtils.lerp(chaser.chaser.position.z, chaserTargetZ, delta * 4.2);
  chaser.chaser.position.y = THREE.MathUtils.lerp(chaser.chaser.position.y, desiredChaserY + impactShake, delta * 5);
  chaser.chaser.rotation.z = THREE.MathUtils.lerp(chaser.chaser.rotation.z, -0.28 - dropProgress * 0.18 - sequence.crush * 0.08, delta * 5);
  chaser.chaser.rotation.x = THREE.MathUtils.lerp(chaser.chaser.rotation.x, 0.1 * pinProgress, delta * 4.5);
  chaser.chaser.scale.setScalar(THREE.MathUtils.lerp(chaser.chaser.scale.x, 1.04 + sequence.crush * 0.02, delta * 4));

  chaser.chaser.updateMatrixWorld(true);
  torsoBox.setFromObject(chaser.torso);
  const torsoClearance = 0.035;
  if (torsoBox.min.y < carTop + torsoClearance) {
    chaser.chaser.position.y += carTop + torsoClearance - torsoBox.min.y;
    chaser.chaser.updateMatrixWorld(true);
  }

  chaser.torso.rotation.z = THREE.MathUtils.lerp(chaser.torso.rotation.z, -0.2 - sequence.crush * 0.1, delta * 4.5);
  chaser.head.rotation.z = THREE.MathUtils.lerp(chaser.head.rotation.z, -0.42 - sequence.crush * 0.18, delta * 4);
  chaser.mouth.scale.y = THREE.MathUtils.lerp(chaser.mouth.scale.y, 1.25, delta * 4);
  chaser.armParts.forEach((arm, index) => {
    const side = index === 0 ? -1 : 1;
    arm.root.rotation.z = THREE.MathUtils.lerp(arm.root.rotation.z, 1.02 + side * 0.1 + sequence.crush * 0.25, delta * 5.5);
    arm.root.position.x = THREE.MathUtils.lerp(arm.root.position.x, 0.68 + sequence.crush * 0.12, delta * 5);
    arm.root.position.y = THREE.MathUtils.lerp(arm.root.position.y, 2.22 - sequence.crush * 0.16, delta * 5);
    arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, 1.28 + sequence.crush * 0.32, delta * 5.5);
    arm.wrist.rotation.x = THREE.MathUtils.lerp(arm.wrist.rotation.x, -0.34 - sequence.crush * 0.18, delta * 5);
    arm.hand.scale.set(
      THREE.MathUtils.lerp(arm.hand.scale.x, 1.75 + sequence.crush * 0.18, delta * 5),
      THREE.MathUtils.lerp(arm.hand.scale.y, 0.78 + sequence.crush * 0.08, delta * 5),
      THREE.MathUtils.lerp(arm.hand.scale.z, 1.08, delta * 5),
    );
  });
  chaser.legs.forEach((leg, index) => {
    const side = index === 0 ? -1 : 1;
    leg.rotation.z = THREE.MathUtils.lerp(leg.rotation.z, side * 0.5 + 0.3, delta * 6);
  });

  chaser.chaser.updateMatrixWorld(true);
  torsoBox.setFromObject(chaser.torso);
  if (torsoBox.min.y < carTop + torsoClearance) {
    chaser.chaser.position.y += carTop + torsoClearance - torsoBox.min.y;
  }

  if (sequence.timer > 3.15) {
    sequence.completed = true;
  }
}
