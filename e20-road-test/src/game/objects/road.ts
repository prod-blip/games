import * as THREE from 'three';
import type { EndlessTuning, RoadAssembly, RoadSegment } from '../types';

export function createEndlessRoad(level: EndlessTuning): RoadAssembly {
  const root = new THREE.Group();
  root.name = 'endless-road';
  const segmentLength = 28;
  const segmentCount = 9;
  const totalLength = segmentLength * segmentCount;
  const segments: RoadSegment[] = [];

  for (let i = 0; i < segmentCount; i += 1) {
    const group = createRoadSegment(i * segmentLength, segmentLength, level, i);
    root.add(group);
    segments.push({ group, x: i * segmentLength, length: segmentLength });
  }

  return { root, segments, segmentLength, totalLength };
}

export function updateEndlessRoad(road: RoadAssembly, carX: number) {
  const behind = 42;
  for (const segment of road.segments) {
    if (segment.x + segment.length < carX - behind) {
      segment.x += road.totalLength;
      segment.group.position.x = segment.x;
    }
  }
}

function createRoadSegment(x: number, length: number, level: EndlessTuning, index: number) {
  const group = new THREE.Group();
  group.position.x = x;

  const roadMat = new THREE.MeshStandardMaterial({ color: level.roadColor, roughness: 0.96 });
  const shoulderMat = new THREE.MeshStandardMaterial({ color: level.shoulderColor, roughness: 1 });
  const road = new THREE.Mesh(new THREE.BoxGeometry(length + 0.25, 0.35, level.roadWidth), roadMat);
  road.position.set(length / 2, -0.18, 0);
  road.receiveShadow = true;
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(length + 0.25, 0.22, level.roadWidth + 6), shoulderMat);
  shoulder.position.set(length / 2, -0.42, 0);
  shoulder.receiveShadow = true;
  group.add(shoulder, road);

  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd17a });
  for (let localX = 2; localX < length; localX += 4) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), markerMat);
    marker.position.set(localX, 0.035, 0);
    group.add(marker);
  }

  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a3, transparent: true, opacity: 0.7 });
  for (const z of [-level.roadWidth / 2 + 0.35, level.roadWidth / 2 - 0.35]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.045, 0.08), edgeMat);
    edge.position.set(length / 2, 0.04, z);
    group.add(edge);
  }

  addReusableRoadsideProps(group, length, index, level);
  return group;
}

function addReusableRoadsideProps(group: THREE.Group, length: number, index: number, level: EndlessTuning) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3923, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f7e35, roughness: 0.9 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xffc36b, roughness: 0.82 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.9 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x171514, roughness: 0.9 });
  const propZ = level.roadWidth / 2 + 1.2;

  const treeX = 5 + ((index * 7) % 17);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.25, 8), trunkMat);
  trunk.position.set(treeX, 0.58, propZ);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 7), leafMat);
  crown.position.set(treeX + 0.15, 1.45, propZ);
  group.add(trunk, crown);

  const warning = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 0.08), signMat);
  warning.position.set(length * 0.62, 1.95, -propZ);
  warning.rotation.z = index % 2 === 0 ? 0.04 : -0.05;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.65, 0.12), poleMat);
  pole.position.set(length * 0.62, 0.9, -propZ - 0.02);
  group.add(warning, pole);

  if (level.roadsideTheme === 'chaos' && index % 2 === 0) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 18), tyreMat);
    tyre.rotation.y = Math.PI / 2;
    tyre.position.set(length * 0.32, 0.42, propZ + 0.15);
    group.add(tyre);
  }
}
