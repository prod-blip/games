import * as THREE from 'three';
import type { ChaseState } from '../types';
import type { VehicleState } from './vehiclePhysics';

export function createInitialChaseState(): ChaseState {
  return {
    distance: 9,
    targetDistance: 9,
    velocity: 0,
    acceleration: 0.18,
    aggression: 0,
    lungeCooldown: 1.2,
    lungeTimer: 0,
    stumbleTimer: 0,
    catchTimer: 0,
    minCatchDistance: 1.6,
    visualMinDistance: 5.5,
    visualMaxDistance: 11,
    monsterPressure: 0,
    caught: false,
  };
}

export function updateChase(chaser: ChaseState, vehicle: VehicleState, delta: number) {
  chaser.lungeCooldown = Math.max(0, chaser.lungeCooldown - delta);
  chaser.lungeTimer = Math.max(0, chaser.lungeTimer - delta);
  chaser.stumbleTimer = Math.max(0, chaser.stumbleTimer - delta);

  const degradationPressure = Math.max(0, vehicle.degradation - 18) * 0.012;
  const damagePressure = Math.max(0, vehicle.damage - 12) * 0.006;
  const lowFuelPressure = vehicle.fuel < 16 ? 0.42 : 0;
  const slowPressure = vehicle.velocity < 5 && (vehicle.degradation > 12 || vehicle.damage > 8 || vehicle.fuel < 16) ? 0.34 : 0;
  const goodSpeedEscape = vehicle.velocity > 12 && vehicle.fuel > 12 ? 0.62 : vehicle.velocity > 8 && vehicle.fuel > 12 ? 0.34 : 0;

  chaser.aggression = degradationPressure + damagePressure + lowFuelPressure + slowPressure;

  // Same model as the pasted game: the target keeps drifting closer, then
  // player rewards/mistakes push that target farther or nearer.
  chaser.targetDistance -= (chaser.acceleration + chaser.aggression) * delta;
  chaser.targetDistance += goodSpeedEscape * delta;

  if (chaser.distance < 5.4 && chaser.aggression > 0.28 && chaser.lungeCooldown <= 0 && chaser.stumbleTimer <= 0) {
    chaser.lungeTimer = 0.45;
    chaser.lungeCooldown = 2.2;
  }

  if (chaser.lungeTimer > 0) {
    chaser.targetDistance -= 5 * delta;
  }

  if (chaser.stumbleTimer > 0) {
    chaser.targetDistance += 4.5 * delta;
    chaser.velocity *= 0.94;
  }

  chaser.targetDistance = clampChaseTarget(chaser.targetDistance);

  const followRate = chaser.lungeTimer > 0 ? 4.2 : 2.5;
  chaser.distance += (chaser.targetDistance - chaser.distance) * delta * followRate;
  chaser.distance = THREE.MathUtils.clamp(chaser.distance, 0.8, 12);
  chaser.velocity = (chaser.targetDistance - chaser.distance) * followRate;
  chaser.monsterPressure = monsterPressure(chaser);

  const catchZone = Math.max(chaser.minCatchDistance, 2.25);
  if (chaser.distance <= catchZone) {
    chaser.catchTimer += delta;
  } else {
    chaser.catchTimer = 0;
  }

  chaser.caught = chaser.catchTimer > 0.65;
  return chaser.caught;
}

export function pushChaserBack(chaser: ChaseState, amount: number) {
  chaser.targetDistance = clampChaseTarget(chaser.targetDistance + amount);
  chaser.stumbleTimer = Math.max(chaser.stumbleTimer, 0.4);
}

export function pullChaserCloser(chaser: ChaseState, amount: number) {
  const rawTarget = chaser.targetDistance - amount;
  const overshoot = Math.max(0, 3.2 - rawTarget);
  chaser.targetDistance = clampChaseTarget(rawTarget);
  if (overshoot > 0) {
    chaser.distance = THREE.MathUtils.clamp(chaser.distance - overshoot * 0.24, 0.8, 12);
  }
}

export function monsterPressure(chaser: ChaseState) {
  return 1 - THREE.MathUtils.clamp((chaser.distance - chaser.minCatchDistance) / 8.2, 0, 1);
}

export function visualChaserDistance(chaser: ChaseState) {
  return THREE.MathUtils.clamp(chaser.distance, chaser.visualMinDistance, chaser.visualMaxDistance);
}

function clampChaseTarget(distance: number) {
  return THREE.MathUtils.clamp(distance, 2.2, 10);
}

export function describeChaser(state: ChaseState) {
  if (state.distance > 9) return 'Visible behind';
  if (state.distance > 5.5) return 'Tracking you';
  if (state.distance > state.minCatchDistance + 0.6) return 'Danger';
  return 'Eating distance';
}
