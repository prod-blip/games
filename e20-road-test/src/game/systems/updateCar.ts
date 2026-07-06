import * as THREE from 'three';
import type { FeedbackEffects, InputState, EndlessTuning } from '../types';
import type { VehicleState } from './vehiclePhysics';

type UpdateCarVisualsArgs = {
  car: THREE.Group;
  bonnet: THREE.Mesh;
  bumper: THREE.Mesh;
  wheels: THREE.Mesh[];
  wheelRims: THREE.Mesh[];
  state: VehicleState;
  input: InputState;
  level: EndlessTuning;
  delta: number;
  frontGround: number;
  rearGround: number;
};

type FeedbackArgs = {
  effects: FeedbackEffects;
  state: VehicleState;
  input: InputState;
  level: EndlessTuning;
  delta: number;
};

let skidCursor = 0;

export function updateCarVisuals({
  car,
  bonnet,
  bumper,
  wheels,
  wheelRims,
  state,
  input,
  level,
  delta,
  frontGround,
  rearGround,
}: UpdateCarVisualsArgs) {
  const groundTilt = Math.atan2(frontGround - rearGround, 2.1);
  const throttleLift = input.accelerate ? 0.105 : input.brakeReverse ? -0.055 : 0;
  const steerVisual = THREE.MathUtils.clamp(-state.steer * 0.18 - state.zVelocity * 0.025, -0.36, 0.36);
  const bodyChaos = Math.sin(performance.now() * 0.018) * Math.min(state.damage * 0.0018 * (level.baseInstability + state.degradation * 0.01), 0.18);
  const targetTilt = THREE.MathUtils.clamp(groundTilt + state.velocity * 0.012 + bodyChaos + throttleLift, -0.62, 0.82);
  car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, targetTilt, input.accelerate ? delta * 14 : delta * 8.5);
  const steerLean = -state.zVelocity * 0.055;
  const speedLean = -state.steer * Math.abs(state.velocity) * 0.018;
  car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, steerLean + speedLean, delta * 7);
  car.rotation.y = THREE.MathUtils.lerp(car.rotation.y, steerVisual, delta * 8);
  car.position.set(state.carX, state.carY, state.carZ);

  const wobble = Math.sin(performance.now() * 0.025) * Math.min(state.damage * 0.004, 0.18);
  bonnet.rotation.z = wobble * 1.4;
  bumper.rotation.z = -wobble * 1.8;

  const wheelSpinMultiplier = input.accelerate ? 5.6 : input.brakeReverse ? 4.6 : 3.8;
  for (const wheel of wheels) {
    wheel.rotation.z -= state.velocity * delta * wheelSpinMultiplier;
    wheel.rotation.y = wobble * 0.5 + steerVisual * 0.7;
  }
  for (const rim of wheelRims) {
    rim.rotation.z -= state.velocity * delta * wheelSpinMultiplier;
    rim.rotation.y = wobble * 0.25 + steerVisual * 0.4;
  }
}

export function updateDust(
  dustParticles: THREE.Mesh[],
  state: VehicleState,
  input: InputState,
  delta: number,
) {
  const shouldEmit = Math.abs(state.velocity) > 1.2 && (input.accelerate || input.brakeReverse);
  const activeCount = input.accelerate ? 10 : 6;
  for (let i = 0; i < dustParticles.length; i += 1) {
    const dust = dustParticles[i];
    if (shouldEmit && i < activeCount) {
      dust.visible = true;
      dust.position.set(state.carX - 1.8 - Math.random() * 1.2, 0.22 + Math.random() * 0.45, state.carZ + (Math.random() - 0.5) * 1.8);
      dust.scale.setScalar(0.55 + Math.random() * 1.2);
    } else if (dust.visible) {
      dust.position.x -= delta * (1.2 + Math.abs(state.velocity) * 0.08);
      dust.position.y += delta * 0.55;
      dust.scale.multiplyScalar(0.985);
      const material = dust.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - delta * 0.18);
      if (material.opacity <= 0.04) {
        dust.visible = false;
        material.opacity = 0.28;
      }
    }
  }
}

export function emitImpactSparks(effects: FeedbackEffects, state: VehicleState) {
  const visibleBudget = THREE.MathUtils.clamp(Math.round(5 + Math.abs(state.velocity) * 0.9 + state.damage * 0.06), 6, effects.sparks.length);
  for (let i = 0; i < visibleBudget; i += 1) {
    const spark = effects.sparks[i];
    const direction = state.velocity >= 0 ? -1 : 1;
    spark.visible = true;
    spark.position.set(state.carX + 1.15 + Math.random() * 0.45, state.carY + 0.28 + Math.random() * 0.55, state.carZ + (Math.random() - 0.5) * 1.25);
    spark.rotation.set(Math.random() * 0.7, Math.random() * 0.7, Math.random() * Math.PI);
    spark.scale.set(0.7 + Math.random() * 1.5, 0.7, 0.7);
    spark.userData.vx = direction * (2.5 + Math.random() * 5.5);
    spark.userData.vy = 1.6 + Math.random() * 3.2;
    spark.userData.vz = (Math.random() - 0.5) * 2.5;
    const material = spark.material as THREE.MeshBasicMaterial;
    material.opacity = 0.95;
  }
}

export function updateFeedbackEffects({ effects, state, input, level, delta }: FeedbackArgs) {
  updateSparks(effects.sparks, delta);
  updateSmoke(effects.smoke, state, level, delta);
  updateFuelSputter(effects.sputter, state, level, delta);
  updateSkidMarks(effects.skidMarks, state, input, delta);
  updatePickupBursts(effects.pickupBursts, delta);
}

export function emitPickupBurst(effects: FeedbackEffects, state: VehicleState) {
  for (let i = 0; i < effects.pickupBursts.length; i += 1) {
    const burst = effects.pickupBursts[i];
    burst.visible = true;
    burst.position.set(state.carX + (Math.random() - 0.5) * 1.2, state.carY + 0.65 + Math.random() * 0.6, state.carZ + (Math.random() - 0.5) * 1.6);
    burst.scale.setScalar(0.55 + Math.random() * 1.2);
    burst.userData.vx = -1.2 + Math.random() * 2.4;
    burst.userData.vy = 1.2 + Math.random() * 2.8;
    burst.userData.vz = (Math.random() - 0.5) * 2.6;
    const material = burst.material as THREE.MeshBasicMaterial;
    material.color.set(i % 2 === 0 ? 0x40ff9a : 0x39d5ff);
    material.opacity = 0.9;
  }
}

function updateSparks(sparks: THREE.Mesh[], delta: number) {
  for (const spark of sparks) {
    if (!spark.visible) continue;
    spark.position.x += (spark.userData.vx ?? -2) * delta;
    spark.position.y += (spark.userData.vy ?? 2) * delta;
    spark.position.z += (spark.userData.vz ?? 0) * delta;
    spark.userData.vy = (spark.userData.vy ?? 2) - 8.5 * delta;
    spark.rotation.z += delta * 14;
    const material = spark.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, material.opacity - delta * 2.9);
    if (material.opacity <= 0.03 || spark.position.y < 0.08) spark.visible = false;
  }
}

function updatePickupBursts(bursts: THREE.Mesh[], delta: number) {
  for (const burst of bursts) {
    if (!burst.visible) continue;
    burst.position.x += (burst.userData.vx ?? 0) * delta;
    burst.position.y += (burst.userData.vy ?? 1) * delta;
    burst.position.z += (burst.userData.vz ?? 0) * delta;
    burst.userData.vy = (burst.userData.vy ?? 1) - 4.5 * delta;
    burst.scale.multiplyScalar(1 + delta * 1.6);
    const material = burst.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, material.opacity - delta * 2.4);
    if (material.opacity <= 0.04) burst.visible = false;
  }
}

function updateSmoke(smoke: THREE.Mesh[], state: VehicleState, level: EndlessTuning, delta: number) {
  const shouldSmoke = state.damage > 38 || state.degradation > 45 || (level.baseInstability > 1.1 && Math.abs(state.velocity) > 6);
  for (let i = 0; i < smoke.length; i += 1) {
    const puff = smoke[i];
    if (shouldSmoke && !puff.visible && Math.random() < delta * (0.9 + state.damage * 0.018)) {
      puff.visible = true;
      puff.position.set(state.carX - 1.35, state.carY + 0.72, state.carZ - 0.1 + (Math.random() - 0.5) * 0.5);
      puff.scale.setScalar(0.45 + Math.random() * 0.45);
      const material = puff.material as THREE.MeshBasicMaterial;
      material.opacity = 0.18 + Math.min(state.damage * 0.0012, 0.18);
    } else if (puff.visible) {
      puff.position.x -= delta * (0.5 + Math.abs(state.velocity) * 0.06);
      puff.position.y += delta * 0.72;
      puff.position.z += Math.sin(performance.now() * 0.003 + i) * delta * 0.28;
      puff.scale.multiplyScalar(1 + delta * 0.55);
      const material = puff.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - delta * 0.16);
      if (material.opacity <= 0.02) puff.visible = false;
    }
  }
}

function updateFuelSputter(sputter: THREE.Mesh[], state: VehicleState, level: EndlessTuning, delta: number) {
  const shouldSputter = state.fuel < 20 && Math.abs(state.velocity) > 2;
  for (let i = 0; i < sputter.length; i += 1) {
    const flame = sputter[i];
    if (shouldSputter && !flame.visible && Math.random() < delta * (1.2 + level.baseInstability * 0.5 + state.degradation * 0.01)) {
      flame.visible = true;
      flame.position.set(state.carX - 1.7, state.carY + 0.48, state.carZ + (Math.random() - 0.5) * 0.55);
      flame.scale.setScalar(0.55 + Math.random() * 0.6);
      const material = flame.material as THREE.MeshBasicMaterial;
      material.opacity = 0.72;
    } else if (flame.visible) {
      flame.position.x -= delta * 1.8;
      flame.position.y += delta * 0.4;
      flame.scale.multiplyScalar(0.96);
      const material = flame.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, material.opacity - delta * 2.2);
      if (material.opacity <= 0.04) flame.visible = false;
    }
  }
}

function updateSkidMarks(skidMarks: THREE.Mesh[], state: VehicleState, input: InputState, delta: number) {
  const hardBrake = input.brakeReverse && state.velocity > 5;
  const accelerationTrail = input.accelerate && Math.abs(state.velocity) > 2.4 && Math.random() < delta * 8;
  const damagedSlide = state.damage > 45 && Math.abs(state.velocity) > 5 && Math.random() < delta * 4;
  if (hardBrake || damagedSlide || accelerationTrail) {
    for (const z of [-0.55, 0.55]) {
      const mark = skidMarks[skidCursor % skidMarks.length];
      skidCursor += 1;
      mark.visible = true;
      mark.position.set(state.carX - 0.9 - Math.random() * 0.7, 0.082, state.carZ + z * 0.35 + (Math.random() - 0.5) * 0.16);
      mark.rotation.z = (Math.random() - 0.5) * 0.08;
      mark.scale.set(0.65 + Math.random() * 0.7, 1, 1);
      const material = mark.material as THREE.MeshBasicMaterial;
      material.opacity = 0.28;
    }
  }

  for (const mark of skidMarks) {
    if (!mark.visible) continue;
    const material = mark.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, material.opacity - delta * 0.015);
    if (material.opacity <= 0.02) mark.visible = false;
  }
}
