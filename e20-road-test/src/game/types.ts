import * as THREE from 'three';

export type InputState = {
  accelerate: boolean;
  brakeReverse: boolean;
  steerUp: boolean;
  steerDown: boolean;
};

export type RoadsideTheme = 'endless' | 'market' | 'wasteland' | 'chaos';

export type PotholeKind = 'small' | 'wide' | 'deep' | 'broken-road' | 'trench';
export type ObstacleKind = PotholeKind;

export type Obstacle = {
  type: ObstacleKind;
  x: number;
  z: number;
  width: number;
  severity: number;
  mesh: THREE.Object3D;
  hit: boolean;
};

export type E20Pickup = {
  x: number;
  z: number;
  mesh: THREE.Object3D;
  collected: boolean;
  fuelAmount: number;
  degradationAmount: number;
};

export type EndlessTuning = {
  blend: string;
  baseFuelDrain: number;
  baseMaxSpeed: number;
  baseAcceleration: number;
  baseInstability: number;
  roadWidth: number;
  steerForce: number;
  steerResponsiveness: number;
  lateralGrip: number;
  turnSpeedPenalty: number;
  damageMultiplier: number;
  skyColor: number;
  fogColor: number;
  roadColor: number;
  shoulderColor: number;
  dustColor: number;
  obstacleDensity: number;
  roadsideTheme: RoadsideTheme;
};

export type EndlessState = {
  distanceSurvived: number;
  e20Collected: number;
};

export type ChaseState = {
  distance: number;
  targetDistance: number;
  velocity: number;
  acceleration: number;
  aggression: number;
  lungeCooldown: number;
  lungeTimer: number;
  stumbleTimer: number;
  catchTimer: number;
  minCatchDistance: number;
  visualMinDistance: number;
  visualMaxDistance: number;
  monsterPressure: number;
  caught: boolean;
};

export type CarAssembly = {
  car: THREE.Group;
  carBody: THREE.Mesh;
  bonnet: THREE.Mesh;
  bumper: THREE.Mesh;
  wheels: THREE.Mesh[];
  wheelRims: THREE.Mesh[];
  parts: THREE.Object3D[];
};

export type FeedbackEffects = {
  sparks: THREE.Mesh[];
  smoke: THREE.Mesh[];
  sputter: THREE.Mesh[];
  skidMarks: THREE.Mesh[];
  pickupBursts: THREE.Mesh[];
};

export type RoadSegment = {
  group: THREE.Group;
  x: number;
  length: number;
};

export type RoadAssembly = {
  root: THREE.Group;
  segments: RoadSegment[];
  segmentLength: number;
  totalLength: number;
};

export type ChaserAssembly = {
  chaser: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  mouth: THREE.Mesh;
  eyes: THREE.Mesh[];
  arms: THREE.Object3D[];
  armParts: {
    root: THREE.Object3D;
    elbow: THREE.Object3D;
    wrist: THREE.Object3D;
    hand: THREE.Object3D;
  }[];
  legs: THREE.Object3D[];
};

export type WorldAssembly = {
  root: THREE.Group;
  road: RoadAssembly;
  obstacles: Obstacle[];
  pickups: E20Pickup[];
  dustParticles: THREE.Mesh[];
  feedbackEffects: FeedbackEffects;
};
