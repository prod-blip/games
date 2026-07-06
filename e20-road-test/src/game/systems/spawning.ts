import * as THREE from 'three';
import type { Obstacle, ObstacleKind, EndlessTuning } from '../types';
import { createPotholeObstacle } from '../objects/world';

const TYPES: ObstacleKind[] = ['small', 'wide', 'deep', 'broken-road', 'trench'];

function randomRoadZ(roadWidth: number) {
  return THREE.MathUtils.randFloatSpread((roadWidth / 2 - 1.2) * 2);
}

export function updateObstacleSpawning(obstacles: Obstacle[], carX: number, tuning: EndlessTuning, worldRoot: THREE.Group) {
  const farthest = Math.max(...obstacles.map((obstacle) => obstacle.x), carX + 35);
  for (const obstacle of obstacles) {
    if (obstacle.x > carX - 20) continue;
    worldRoot.remove(obstacle.mesh);
    disposeObject(obstacle.mesh);
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const width = widthFor(type);
    obstacle.x = farthest + 10 + Math.random() * (16 / tuning.obstacleDensity);
    obstacle.z = randomRoadZ(tuning.roadWidth);
    obstacle.type = type;
    obstacle.width = width;
    obstacle.severity = severityFor(type);
    obstacle.hit = false;
    obstacle.mesh = createPotholeObstacle(type, obstacle.x, obstacle.z, obstacle.width, tuning);
    worldRoot.add(obstacle.mesh);
  }
}

function widthFor(type: ObstacleKind) {
  if (type === 'small') return 1.8;
  if (type === 'wide') return 3.2;
  if (type === 'deep') return 2.5;
  if (type === 'broken-road') return 3.7;
  return 4.8;
}

function severityFor(type: ObstacleKind) {
  if (type === 'small') return 5;
  if (type === 'wide') return 7;
  if (type === 'deep') return 10;
  if (type === 'broken-road') return 9;
  return 12;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) material.dispose();
  });
}
