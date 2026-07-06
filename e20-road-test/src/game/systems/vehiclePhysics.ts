import * as THREE from 'three';
import type { InputState, EndlessTuning, Obstacle } from '../types';

export type VehicleState = {
  carX: number;
  carY: number;
  carZ: number;
  zVelocity: number;
  steer: number;
  lateralGrip: number;
  velocity: number;
  fuel: number;
  damage: number;
  degradation: number;
};

export type VehicleStepResult = {
  frontGround: number;
  rearGround: number;
};

export function updateVehiclePhysics(
  state: VehicleState,
  input: InputState,
  tuning: EndlessTuning,
  obstacles: Obstacle[],
  delta: number,
  onImpact: () => void,
): VehicleStepResult {
  const maxZ = tuning.roadWidth / 2 - 1;
  const targetSteer = input.steerUp ? -1 : input.steerDown ? 1 : 0;
  state.steer = THREE.MathUtils.lerp(state.steer, targetSteer, delta * tuning.steerResponsiveness);

  const speedFactor = THREE.MathUtils.clamp(Math.abs(state.velocity) / 12, 0.25, 1.2);
  const turnAcceleration = tuning.steerForce * speedFactor;
  state.zVelocity += state.steer * turnAcceleration * delta;

  const grip = THREE.MathUtils.clamp(
    tuning.lateralGrip + 1 - state.degradation * 0.035 - state.damage * 0.012,
    3.5,
    9,
  );
  state.lateralGrip = grip;
  state.zVelocity -= state.zVelocity * grip * delta;
  state.zVelocity = THREE.MathUtils.clamp(state.zVelocity, -6.5, 6.5);

  const turnDrag = Math.abs(state.steer) * Math.abs(state.velocity) * tuning.turnSpeedPenalty;
  state.velocity -= turnDrag * delta;

  const nextZ = state.carZ + state.zVelocity * delta;
  if (nextZ < -maxZ || nextZ > maxZ) {
    const edgeImpact = Math.abs(state.zVelocity);
    state.carZ = THREE.MathUtils.clamp(nextZ, -maxZ, maxZ);
    state.zVelocity *= -0.12;
    state.velocity *= 0.92;
    state.damage += edgeImpact * 0.4;
  } else {
    state.carZ = nextZ;
  }

  const rearX = state.carX - 1.05;
  const frontX = state.carX + 1.05;
  const rearGround = roadHeightAt(rearX, state.carZ, obstacles);
  const frontGround = roadHeightAt(frontX, state.carZ, obstacles);
  const centerGround = (rearGround + frontGround) * 0.5;
  const slope = Math.atan2(frontGround - rearGround, 2.1);
  const degradationRatio = THREE.MathUtils.clamp(state.degradation / 100, 0, 1);

  const effectiveAcceleration = Math.max(8, tuning.baseAcceleration - state.degradation * 0.055);
  const effectiveMaxSpeed = Math.max(8, tuning.baseMaxSpeed - state.degradation * 0.08 - state.damage * 0.008);
  const traction = THREE.MathUtils.clamp(1.18 - tuning.baseInstability * 0.11 - state.damage * 0.0015 - state.degradation * 0.004, 0.38, 1.08);
  const engineForce = input.accelerate && state.fuel > 0 ? effectiveAcceleration * traction : 0;
  const brakeForce = input.brakeReverse ? 24 * traction : 0;
  const slopeDrag = Math.sin(slope) * 13.5;
  const lateralDrag = Math.abs(state.zVelocity) * 0.16;
  const rollingDrag = state.velocity * (input.accelerate ? 0.34 + degradationRatio * 0.22 : 0.72 + degradationRatio * 0.2) + lateralDrag;
  const fuelDrain = tuning.baseFuelDrain + state.degradation * 0.02 + Math.abs(state.velocity) * 0.085 + Math.abs(state.zVelocity) * 0.02;

  if (input.accelerate && state.fuel > 0) {
    state.velocity += engineForce * delta;
    state.fuel -= fuelDrain * delta;
  }
  if (input.brakeReverse) {
    state.velocity -= brakeForce * delta;
    state.fuel -= fuelDrain * 0.32 * delta;
  }

  if (state.fuel <= 0) state.velocity -= Math.sign(state.velocity) * Math.min(Math.abs(state.velocity), delta * 4.5);
  state.velocity -= slopeDrag * delta;
  state.velocity -= rollingDrag * delta;
  state.velocity = THREE.MathUtils.clamp(state.velocity, -5, effectiveMaxSpeed);
  state.carX = Math.max(0, state.carX + state.velocity * delta);

  const instability = tuning.baseInstability + state.degradation * 0.012;
  const suspensionBob = Math.sin(performance.now() * 0.012 + state.carX) * 0.035 * instability;
  const degradationWobble = Math.sin(performance.now() * 0.022) * state.degradation * 0.0025;
  const steerLean = Math.abs(state.zVelocity) * 0.01;
  const damageHop = Math.min(state.damage * 0.006, 0.26) * Math.abs(Math.sin(performance.now() * 0.015));
  state.carY = 0.1 + centerGround + suspensionBob + degradationWobble + steerLean + damageHop;
  state.fuel = THREE.MathUtils.clamp(state.fuel, 0, 100);
  state.degradation = THREE.MathUtils.clamp(state.degradation, 0, 100);

  handleObstacleImpacts(state, tuning, obstacles, onImpact);

  return { frontGround, rearGround };
}

export function roadHeightAt(x: number, z: number, obstacles: Obstacle[]) {
  let height = 0;
  for (const obstacle of obstacles) {
    const halfX = obstacle.width * 0.72;
    const halfZ = obstacle.width * 0.48;
    const dx = Math.abs(x - obstacle.x);
    const dz = Math.abs(z - obstacle.z);
    if (dx > halfX || dz > halfZ) continue;

    const normalized = Math.min(1, Math.hypot(dx / halfX, dz / halfZ));
    const centerFalloff = Math.cos(normalized * Math.PI * 0.5);
    const rimBand = normalized > 0.62 ? 0.09 * (1 - Math.abs(normalized - 0.82) / 0.2) : 0;
    const depth = obstacle.type === 'small' ? 0.2 : obstacle.type === 'wide' ? 0.26 : obstacle.type === 'deep' ? 0.42 : obstacle.type === 'broken-road' ? 0.32 : 0.5;
    height += Math.max(0, rimBand);
    height -= depth * centerFalloff;
  }
  return height;
}

function handleObstacleImpacts(
  state: VehicleState,
  tuning: EndlessTuning,
  obstacles: Obstacle[],
  onImpact: () => void,
) {
  for (const obstacle of obstacles) {
    const dx = state.carX - obstacle.x;
    const dz = state.carZ - obstacle.z;
    const distance = Math.hypot(dx / (obstacle.width * 0.65), dz / (obstacle.width * 0.48));
    if (!obstacle.hit && distance < 1) {
      obstacle.hit = true;
      const degradationPenalty = 1 + state.degradation * 0.006;
      const lateralPenalty = 1 + Math.abs(state.zVelocity) * 0.04;
      const impact = Math.abs(state.velocity) * obstacle.severity * 0.115 * tuning.damageMultiplier * degradationPenalty * lateralPenalty;
      state.damage += impact;
      state.velocity *= obstacle.type === 'trench' || obstacle.type === 'deep' ? 0.56 : 0.68;
      state.zVelocity *= 0.35;
      onImpact();
    }
    if (Math.abs(dx) > obstacle.width * 1.8 || Math.abs(dz) > obstacle.width * 1.2) obstacle.hit = false;
  }
}
