import * as THREE from 'three';
import type { EndlessTuning, FeedbackEffects, Obstacle, ObstacleKind, WorldAssembly } from '../types';
import { createPickupPool } from './pickups';
import { createEndlessRoad } from './road';

function randomRoadZ(roadWidth: number) {
  return THREE.MathUtils.randFloatSpread((roadWidth / 2 - 1.2) * 2);
}

export function createWorld(scene: THREE.Scene, level: EndlessTuning): WorldAssembly {
  const root = new THREE.Group();
  root.name = 'endless-chase-world';
  scene.add(root);

  const road = createEndlessRoad(level);
  root.add(road.root);
  const obstacles = createPotholePool(level);
  for (const obstacle of obstacles) root.add(obstacle.mesh);

  const pickups = createPickupPool(10, level.roadWidth);
  for (const pickup of pickups) root.add(pickup.mesh);

  const dustParticles = createDustParticles(root, level);
  const feedbackEffects = createFeedbackEffects(root, level);
  createPetrolPump(root);
  createChaseSigns(root, level);

  return { root, road, obstacles, pickups, dustParticles, feedbackEffects };
}

function createPotholePool(level: EndlessTuning): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const types: ObstacleKind[] = ['small', 'wide', 'deep', 'broken-road', 'trench'];
  const count = Math.round(9 * level.obstacleDensity);
  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length];
    const width = widthForPothole(type);
    const x = 15 + i * (11 + Math.random() * 6);
    const z = randomRoadZ(level.roadWidth);
    const mesh = createPotholeObstacle(type, x, z, width, level);
    obstacles.push({ type, x, z, width, severity: severityForPothole(type), mesh, hit: false });
  }
  return obstacles;
}

export function createPotholeObstacle(type: ObstacleKind, x: number, z: number, width: number, level: EndlessTuning) {
  const group = new THREE.Group();
  group.name = `pothole-${type}`;
  group.position.set(x, 0, z);

  addHazardPaint(group, -width * 1.8, width, level);
  addRoadDebris(group, 0, width, type === 'trench' || type === 'broken-road' ? 16 : 9, level);

  const holeMat = new THREE.MeshStandardMaterial({ color: 0x13100e, roughness: 1 });
  const ringMat = new THREE.MeshStandardMaterial({ color: type === 'deep' || type === 'trench' ? 0x2b2421 : 0x3c352f, roughness: 1 });
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x211d1a });

  const zScale = type === 'trench' ? 0.22 : type === 'wide' ? 0.55 : 0.42;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, 0.08, 42), holeMat);
  hole.scale.z = zScale;
  hole.position.set(0, 0.052, 0);
  group.add(hole);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(width * 0.52, 0.055, 8, 48), ringMat);
  ring.scale.y = zScale + 0.08;
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.088, 0);
  group.add(ring);

  const crackCount = type === 'broken-road' || type === 'trench' ? 11 : 6;
  for (let i = 0; i < crackCount; i += 1) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(width * (0.22 + Math.random() * 0.42), 0.035, 0.035), crackMat);
    const angle = (i / crackCount) * Math.PI * 2;
    crack.position.set(Math.cos(angle) * width * 0.48, 0.1, Math.sin(angle) * width * (0.2 + zScale * 0.32));
    crack.rotation.y = angle;
    group.add(crack);
  }

  if (type === 'broken-road') {
    const slabMat = new THREE.MeshStandardMaterial({ color: level.roadColor, roughness: 1 });
    for (let i = 0; i < 4; i += 1) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, 0.06, 0.7), slabMat);
      slab.position.set((Math.random() - 0.5) * width, 0.12, (Math.random() - 0.5) * 2.8);
      slab.rotation.y = (Math.random() - 0.5) * 0.7;
      group.add(slab);
    }
  }

  if (type === 'deep') addOilStain(group, width * 0.45, 0.72);
  return group;
}

function createDustParticles(root: THREE.Group, level: EndlessTuning) {
  const dustParticles: THREE.Mesh[] = [];
  const dustMat = new THREE.MeshBasicMaterial({ color: level.dustColor, transparent: true, opacity: 0.28 });
  for (let i = 0; i < 22; i += 1) {
    const dust = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), dustMat.clone());
    dust.visible = false;
    dustParticles.push(dust);
    root.add(dust);
  }
  return dustParticles;
}

function createFeedbackEffects(root: THREE.Group, level: EndlessTuning): FeedbackEffects {
  const sparks: THREE.Mesh[] = [];
  const smoke: THREE.Mesh[] = [];
  const sputter: THREE.Mesh[] = [];
  const skidMarks: THREE.Mesh[] = [];
  const pickupBursts: THREE.Mesh[] = [];
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 });
  const smokeMat = new THREE.MeshBasicMaterial({ color: level.roadsideTheme === 'chaos' ? 0x3c3432 : 0x4c4a46, transparent: true, opacity: 0.22 });
  const sputterMat = new THREE.MeshBasicMaterial({ color: 0xff8c2a, transparent: true, opacity: 0.75 });
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x15120f, transparent: true, opacity: 0.34 });
  const pickupMat = new THREE.MeshBasicMaterial({ color: 0x3bffd7, transparent: true, opacity: 0.9 });

  for (let i = 0; i < 24; i += 1) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.035), sparkMat.clone());
    spark.visible = false;
    sparks.push(spark);
    root.add(spark);
  }
  for (let i = 0; i < 20; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), smokeMat.clone());
    puff.visible = false;
    smoke.push(puff);
    root.add(puff);
  }
  for (let i = 0; i < 12; i += 1) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), sputterMat.clone());
    flame.visible = false;
    sputter.push(flame);
    root.add(flame);
  }
  for (let i = 0; i < 42; i += 1) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.09), skidMat.clone());
    mark.rotation.x = -Math.PI / 2;
    mark.visible = false;
    skidMarks.push(mark);
    root.add(mark);
  }
  for (let i = 0; i < 26; i += 1) {
    const burst = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), pickupMat.clone());
    burst.visible = false;
    pickupBursts.push(burst);
    root.add(burst);
  }
  return { sparks, smoke, sputter, skidMarks, pickupBursts };
}

function createPetrolPump(root: THREE.Group) {
  const pump = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xdf2e38 });
  const white = new THREE.MeshStandardMaterial({ color: 0xfff6e5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1), red);
  base.position.y = 1;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 1.04), white);
  face.position.set(0, 1.35, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.4), red);
  roof.position.y = 2.25;
  pump.add(base, face, roof);
  pump.position.set(-1.2, 0, -2.3);
  root.add(pump);
}

function createChaseSigns(root: THREE.Group, level: EndlessTuning) {
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });
  const signZ = -(level.roadWidth / 2 + 1.05);
  for (const x of [22, 68, 126]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.2), signMat);
    sign.position.set(x, 2.25, signZ);
    root.add(sign);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2, 0.13), new THREE.MeshStandardMaterial({ color: 0x5b4636 }));
    pole.position.set(x, 1, signZ - 0.01);
    root.add(pole);
  }
}

function addHazardPaint(group: THREE.Group, x: number, width: number, level: EndlessTuning) {
  const paintMat = new THREE.MeshBasicMaterial({ color: level.roadsideTheme === 'chaos' ? 0xffd23f : 0xffe28a, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.24, 0.035, 0.16), paintMat);
    stripe.position.set(x + i * width * 0.22, 0.066, i % 2 === 0 ? -1.55 : 1.55);
    stripe.rotation.y = i % 2 === 0 ? 0.55 : -0.55;
    group.add(stripe);
  }
}

function addOilStain(group: THREE.Group, x: number, radius: number) {
  const oil = new THREE.Mesh(new THREE.CircleGeometry(radius, 26), new THREE.MeshBasicMaterial({ color: 0x090807, transparent: true, opacity: 0.42 }));
  oil.rotation.x = -Math.PI / 2;
  oil.scale.y = 0.38;
  oil.position.set(x, 0.074, -0.45);
  group.add(oil);
}

function addRoadDebris(group: THREE.Group, x: number, width: number, count: number, level: EndlessTuning) {
  const gravelMat = new THREE.MeshStandardMaterial({ color: level.roadsideTheme === 'chaos' ? 0x251f1d : 0x332d28, roughness: 1 });
  for (let i = 0; i < count; i += 1) {
    const size = 0.05 + Math.random() * 0.09;
    const gravel = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), gravelMat);
    gravel.position.set(x + (Math.random() - 0.5) * width * 1.8, 0.11, (Math.random() - 0.5) * 3.9);
    gravel.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(gravel);
  }
}

function widthForPothole(type: ObstacleKind) {
  if (type === 'small') return 1.8;
  if (type === 'wide') return 3.2;
  if (type === 'deep') return 2.5;
  if (type === 'broken-road') return 3.7;
  return 4.8;
}

function severityForPothole(type: ObstacleKind) {
  if (type === 'small') return 5;
  if (type === 'wide') return 7;
  if (type === 'deep') return 10;
  if (type === 'broken-road') return 9;
  return 12;
}
