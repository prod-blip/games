import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CHUNK_LENGTH = 14;
const CHUNK_WIDTH = 14;
const CHUNK_COUNT = 9;
const GRID_RADIUS = 1;
const GRASS_COUNT = 360;
const FERN_COUNT = 22;
const BROADLEAF_COUNT = 14;
const SHRUB_COUNT = 16;
const TREE_COUNT = 11;
const ROCK_COUNT = 8;
const LOG_COUNT = 2;
export const LION_CLEARING_X = 7.5;
export const LION_CLEARING_Z = -42;
export const TRAPPED_LION_CLEARING_X = -7.5;
export const TRAPPED_LION_CLEARING_Z = -122;

interface TreeInstanceData {
  position: THREE.Vector3;
  scale: number;
  yaw: number;
  phase: number;
  strength: number;
}

export class ForestGround {
  readonly group = new THREE.Group();

  private readonly chunks: THREE.Group[] = [];
  private readonly horizonGround: THREE.Mesh;
  private readonly windTime = { value: 0 };
  private readonly matrix = new THREE.Matrix4();
  private readonly instancePosition = new THREE.Vector3();
  private readonly instanceScale = new THREE.Vector3();
  private readonly instanceQuaternion = new THREE.Quaternion();
  private readonly instanceEuler = new THREE.Euler();
  private centerChunkX = Number.NaN;
  private centerChunkZ = Number.NaN;
  private elapsed = 0;

  private readonly groundMaterial = new THREE.MeshStandardMaterial({ color: 0x244d2f, roughness: 0.98 });
  private readonly dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x59432d, roughness: 1 });
  private readonly treeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  private readonly grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d7b3b,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  private readonly fernMaterial = new THREE.MeshStandardMaterial({
    color: 0x319052,
    roughness: 0.9,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  private readonly broadleafMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b8d4c,
    roughness: 0.88,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  private readonly shrubMaterial = new THREE.MeshStandardMaterial({ color: 0x205b32, roughness: 0.94, flatShading: true });
  private readonly rockMaterial = new THREE.MeshStandardMaterial({ color: 0x586471, roughness: 0.94, flatShading: true });

  private readonly grassGeometry = this.createGrassGeometry();
  private readonly fernGeometry = this.createFernGeometry();
  private readonly broadleafGeometry = this.createBroadleafGeometry();
  private readonly shrubGeometry = new THREE.DodecahedronGeometry(0.34, 0).translate(0, 0.3, 0);
  private readonly treeGeometry = this.createTreeGeometry();
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.28, 0);
  private readonly logGeometry = this.createLogGeometry();

  constructor() {
    this.group.name = 'InfiniteJungleGround';
    this.configureWindMaterial(this.grassMaterial, 0.095, 2.25, 0.46);
    this.configureWindMaterial(this.fernMaterial, 0.12, 1.75, 0.58);
    this.configureWindMaterial(this.broadleafMaterial, 0.15, 1.5, 0.7);
    this.configureWindMaterial(this.shrubMaterial, 0.055, 1.2, 0.7);

    this.horizonGround = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), this.groundMaterial);
    this.horizonGround.name = 'DistantForestGround';
    this.horizonGround.rotation.x = -Math.PI / 2;
    this.horizonGround.position.y = -0.02;
    this.horizonGround.receiveShadow = true;
    this.group.add(this.horizonGround);

    for (let index = 0; index < CHUNK_COUNT; index += 1) {
      const chunk = this.createChunk(index);
      this.chunks.push(chunk);
      this.group.add(chunk);
    }

    this.update(new THREE.Vector3(), 0);
  }

  update(playerPosition: THREE.Vector3, delta: number): void {
    this.elapsed += delta;
    this.windTime.value = this.elapsed;
    this.animateCanopies();

    const chunkX = Math.round(playerPosition.x / CHUNK_WIDTH);
    const chunkZ = Math.round(playerPosition.z / CHUNK_LENGTH);
    if (chunkX === this.centerChunkX && chunkZ === this.centerChunkZ) return;

    this.centerChunkX = chunkX;
    this.centerChunkZ = chunkZ;
    this.horizonGround.position.x = chunkX * CHUNK_WIDTH;
    this.horizonGround.position.z = chunkZ * CHUNK_LENGTH;
    this.recycleChunksAround(chunkX, chunkZ);
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else materials.add(material);
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private createChunk(index: number): THREE.Group {
    const chunk = new THREE.Group();
    chunk.name = `JungleChunk-${index}`;

    const ground = new THREE.Mesh(new THREE.BoxGeometry(CHUNK_WIDTH, 0.18, CHUNK_LENGTH), this.groundMaterial);
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    chunk.add(ground);

    const dirtPath = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.025, CHUNK_LENGTH + 0.2), this.dirtMaterial);
    dirtPath.name = 'dirtPath';
    dirtPath.position.y = 0.02;
    dirtPath.receiveShadow = true;
    chunk.add(dirtPath);

    chunk.add(this.createGroundCover('grassBedding', this.grassGeometry, this.grassMaterial, GRASS_COUNT));
    chunk.add(this.createGroundCover('ferns', this.fernGeometry, this.fernMaterial, FERN_COUNT));
    chunk.add(this.createGroundCover('broadleafPlants', this.broadleafGeometry, this.broadleafMaterial, BROADLEAF_COUNT));
    chunk.add(this.createGroundCover('shrubs', this.shrubGeometry, this.shrubMaterial, SHRUB_COUNT));
    const trees = this.createGroundCover('trees', this.treeGeometry, this.treeMaterial, TREE_COUNT);
    trees.castShadow = true;
    chunk.add(trees);
    const rocks = this.createGroundCover('rocks', this.rockGeometry, this.rockMaterial, ROCK_COUNT);
    rocks.castShadow = true;
    chunk.add(rocks);
    const logs = this.createGroundCover('fallenLogs', this.logGeometry, this.treeMaterial, LOG_COUNT);
    logs.castShadow = true;
    chunk.add(logs);

    this.randomizeChunk(chunk);
    return chunk;
  }

  private createGroundCover(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private randomizeChunk(chunk: THREE.Group): void {
    const pathVisible = chunk.getObjectByName('dirtPath')?.visible ?? false;

    for (const child of chunk.children) {
      if (!(child instanceof THREE.InstancedMesh)) continue;
      if (child.name === 'trees') this.populateTrees(child, pathVisible, chunk);
      else this.populateGroundCover(child, pathVisible, chunk);
    }
  }

  private populateGroundCover(mesh: THREE.InstancedMesh, pathVisible: boolean, chunk: THREE.Group): void {
    for (let index = 0; index < mesh.count; index += 1) {
      let clearance = 1.75;
      let minScale = 0.65;
      let maxScale = 1.4;
      let y = 0.015;

      if (mesh.name === 'ferns') {
        clearance = 2.05;
        minScale = 0.72;
        maxScale = 1.45;
        y = 0.025;
      } else if (mesh.name === 'broadleafPlants') {
        clearance = 2.15;
        minScale = 0.7;
        maxScale = 1.5;
        y = 0.025;
      } else if (mesh.name === 'shrubs') {
        clearance = 2.35;
        minScale = 0.55;
        maxScale = 1.25;
        y = 0.015;
      } else if (mesh.name === 'rocks') {
        clearance = 2.05;
        minScale = 0.55;
        maxScale = 1.65;
        y = 0.1;
      } else if (mesh.name === 'fallenLogs') {
        clearance = 2.45;
        minScale = 0.75;
        maxScale = 1.4;
        y = 0.02;
      }

      const scale = minScale + Math.random() * (maxScale - minScale);
      const placement = this.randomOpenPlacement(chunk, pathVisible, clearance, 0.15);
      this.instancePosition.set(placement.x, y, placement.y);
      this.instanceEuler.set(
        mesh.name === 'rocks' ? Math.random() * 0.2 : 0,
        Math.random() * Math.PI * 2,
        mesh.name === 'rocks' || mesh.name === 'fallenLogs' ? (Math.random() - 0.5) * 0.16 : 0,
      );
      this.instanceQuaternion.setFromEuler(this.instanceEuler);

      if (mesh.name === 'grassBedding') {
        this.instanceScale.set(scale * (0.65 + Math.random() * 0.55), scale, scale);
      } else if (mesh.name === 'shrubs') {
        this.instanceScale.set(scale * (0.8 + Math.random() * 0.45), scale, scale * (0.8 + Math.random() * 0.45));
      } else if (mesh.name === 'rocks') {
        this.instanceScale.set(scale, scale * (0.65 + Math.random() * 0.4), scale);
      } else {
        this.instanceScale.setScalar(scale);
      }

      this.matrix.compose(this.instancePosition, this.instanceQuaternion, this.instanceScale);
      mesh.setMatrixAt(index, this.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private populateTrees(mesh: THREE.InstancedMesh, pathVisible: boolean, chunk: THREE.Group): void {
    const treeData: TreeInstanceData[] = [];
    for (let index = 0; index < mesh.count; index += 1) {
      const placement = this.randomOpenPlacement(chunk, pathVisible, 2.75, 0.45);
      treeData.push({
        position: new THREE.Vector3(placement.x, 0, placement.y),
        scale: 0.72 + Math.random() * 0.62,
        yaw: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        strength: 0.65 + Math.random() * 0.7,
      });
    }
    mesh.userData.treeData = treeData;
    this.updateTreeMatrices(mesh, treeData);
  }

  private updateTreeMatrices(mesh: THREE.InstancedMesh, treeData: TreeInstanceData[]): void {
    for (let index = 0; index < treeData.length; index += 1) {
      const tree = treeData[index];
      const swayX = Math.cos(this.elapsed * 0.83 + tree.phase * 0.7) * 0.008 * tree.strength;
      const swayZ = Math.sin(this.elapsed * 1.15 + tree.phase) * 0.014 * tree.strength;
      this.instanceEuler.set(swayX, tree.yaw, swayZ);
      this.instanceQuaternion.setFromEuler(this.instanceEuler);
      this.instanceScale.setScalar(tree.scale);
      this.matrix.compose(tree.position, this.instanceQuaternion, this.instanceScale);
      mesh.setMatrixAt(index, this.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private animateCanopies(): void {
    for (const chunk of this.chunks) {
      for (const child of chunk.children) {
        if (!(child instanceof THREE.InstancedMesh) || child.name !== 'trees') continue;
        const treeData = child.userData.treeData as TreeInstanceData[] | undefined;
        if (treeData) this.updateTreeMatrices(child, treeData);
      }
    }
  }

  private recycleChunksAround(centerX: number, centerZ: number): void {
    const desired: Array<{ x: number; z: number; key: string }> = [];
    for (let zOffset = -GRID_RADIUS; zOffset <= GRID_RADIUS; zOffset += 1) {
      for (let xOffset = -GRID_RADIUS; xOffset <= GRID_RADIUS; xOffset += 1) {
        const x = centerX + xOffset;
        const z = centerZ + zOffset;
        desired.push({ x, z, key: this.chunkKey(x, z) });
      }
    }

    const desiredKeys = new Set(desired.map(({ key }) => key));
    const occupiedKeys = new Set<string>();
    const reusable: THREE.Group[] = [];

    for (const chunk of this.chunks) {
      const x = chunk.userData.chunkX as number | undefined;
      const z = chunk.userData.chunkZ as number | undefined;
      const key = x === undefined || z === undefined ? '' : this.chunkKey(x, z);
      if (desiredKeys.has(key)) occupiedKeys.add(key);
      else reusable.push(chunk);
    }

    for (const destination of desired) {
      if (occupiedKeys.has(destination.key)) continue;
      const chunk = reusable.shift();
      if (!chunk) break;

      chunk.userData.chunkX = destination.x;
      chunk.userData.chunkZ = destination.z;
      chunk.position.set(destination.x * CHUNK_WIDTH, 0, destination.z * CHUNK_LENGTH);
      const path = chunk.getObjectByName('dirtPath');
      if (path) path.visible = destination.x === 0;
      this.randomizeChunk(chunk);
    }
  }

  private createTreeGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.17, 0.31, 2.15, 6);
    trunk.scale(0.84, 1, 1);
    trunk.translate(0, 1.05, 0);
    geometries.push(this.colorGeometry(trunk, 0x3c2314));

    const trunkFace = new THREE.BoxGeometry(0.05, 1.68, 0.035);
    trunkFace.rotateZ(-0.05);
    trunkFace.translate(0.09, 1.08, -0.18);
    geometries.push(this.colorGeometry(trunkFace, 0x633b20));

    const leafColors = [0x123b20, 0x1e572d, 0x34733b, 0x4d8543];
    const blobs: Array<[number, number, number, number, number, number, number]> = [
      [0, 0, 0, 1.55, 1.12, 1.4, 0],
      [-0.58, -0.14, 0.12, 1.12, 0.84, 1.0, 1],
      [0.62, -0.08, -0.04, 1.08, 0.9, 1.0, 2],
      [0.1, 0.62, 0.04, 1.15, 1.0, 1.05, 3],
      [-0.2, 1.15, 0.03, 0.86, 1.12, 0.8, 1],
      [0.38, 1.0, -0.05, 0.78, 1.04, 0.8, 2],
      [-0.4, 0.58, 0.2, 0.84, 0.78, 0.74, 0],
      [0.48, 0.48, 0.28, 0.75, 0.72, 0.72, 1],
    ];

    for (let index = 0; index < blobs.length; index += 1) {
      const [x, y, z, sx, sy, sz, materialIndex] = blobs[index];
      const leaf = new THREE.IcosahedronGeometry(0.72, 0);
      leaf.scale(sx, sy, sz);
      leaf.rotateX((index * 0.17) % 0.42);
      leaf.rotateY((index * 1.37) % Math.PI);
      leaf.rotateZ((index * 0.11) % 0.38);
      leaf.translate(x, y + 2.55, z);
      geometries.push(this.colorGeometry(leaf, leafColors[materialIndex]));
    }

    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Unable to build merged tree geometry');
    merged.computeBoundingSphere();
    return merged;
  }

  private createLogGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.16, 0.2, 1.5, 7);
    trunk.rotateZ(Math.PI / 2);
    trunk.translate(0, 0.2, 0);
    geometries.push(this.colorGeometry(trunk, 0x3c2314));
    for (const x of [-0.34, 0.22]) {
      const moss = new THREE.DodecahedronGeometry(0.18, 0);
      moss.scale(1.3, 0.32, 0.7);
      moss.rotateY(x < 0 ? 0.35 : 1.1);
      moss.translate(x, 0.36, 0);
      geometries.push(this.colorGeometry(moss, 0x47783a));
    }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Unable to build merged log geometry');
    merged.computeBoundingSphere();
    return merged;
  }

  private colorGeometry(geometry: THREE.BufferGeometry, colorValue: number): THREE.BufferGeometry {
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry;
    if (prepared !== geometry) geometry.dispose();
    prepared.deleteAttribute('uv');
    const color = new THREE.Color(colorValue);
    const colors = new Float32Array(prepared.getAttribute('position').count * 3);
    for (let index = 0; index < colors.length; index += 3) {
      colors[index] = color.r;
      colors[index + 1] = color.g;
      colors[index + 2] = color.b;
    }
    prepared.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return prepared;
  }

  private createGrassGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.055, 0, 0,
      0.055, 0, 0,
      0.035, 0.25, 0,
      0, 0.46, 0,
    ], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
  }

  private createFernGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      const base = new THREE.Vector3(0, 0.03, 0);
      const middle = direction.clone().multiplyScalar(0.27).setY(0.19);
      const tip = direction.clone().multiplyScalar(0.58).setY(0.13 + (index % 2) * 0.06);
      const left = middle.clone().addScaledVector(perpendicular, 0.105);
      const right = middle.clone().addScaledVector(perpendicular, -0.105);
      this.pushLeaf(positions, base, left, tip, right);
    }
    return this.geometryFromPositions(positions);
  }

  private createBroadleafGeometry(): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      const base = new THREE.Vector3(0, 0.02, 0);
      const middle = direction.clone().multiplyScalar(0.18).setY(0.33);
      const tip = direction.clone().multiplyScalar(0.36).setY(0.58 - (index % 2) * 0.08);
      const left = middle.clone().addScaledVector(perpendicular, 0.14);
      const right = middle.clone().addScaledVector(perpendicular, -0.14);
      this.pushLeaf(positions, base, left, tip, right);
    }
    return this.geometryFromPositions(positions);
  }

  private pushLeaf(
    positions: number[],
    base: THREE.Vector3,
    left: THREE.Vector3,
    tip: THREE.Vector3,
    right: THREE.Vector3,
  ): void {
    for (const point of [base, left, tip, base, tip, right]) positions.push(point.x, point.y, point.z);
  }

  private geometryFromPositions(positions: number[]): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private configureWindMaterial(
    material: THREE.MeshStandardMaterial,
    amplitude: number,
    speed: number,
    referenceHeight: number,
  ): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 windOrigin = instanceMatrix[3].xyz;
            float windPhase = windOrigin.x * 0.48 + windOrigin.z * 0.37;
            float wind = sin(uWindTime * ${speed.toFixed(3)} + windPhase);
            float gust = sin(uWindTime * 0.37 + windPhase * 0.41) * 0.35 + 0.65;
            float tipWeight = smoothstep(0.0, 1.0, max(position.y, 0.0) / ${referenceHeight.toFixed(3)});
            transformed.x += wind * gust * ${amplitude.toFixed(3)} * tipWeight * tipWeight;
            transformed.z += cos(uWindTime * ${(speed * 0.73).toFixed(3)} + windPhase) * ${(
              amplitude * 0.38
            ).toFixed(3)} * tipWeight;
          #endif`,
        );
    };
    material.customProgramCacheKey = () => `jungle-wind-${amplitude}-${speed}-${referenceHeight}`;
  }

  private randomPlantX(pathVisible: boolean, clearance: number): number {
    if (!pathVisible) return -CHUNK_WIDTH / 2 + 0.45 + Math.random() * (CHUNK_WIDTH - 0.9);
    const side = Math.random() < 0.5 ? -1 : 1;
    return side * (clearance + Math.random() * (CHUNK_WIDTH / 2 - clearance - 0.45));
  }

  private randomOpenPlacement(
    chunk: THREE.Group,
    pathVisible: boolean,
    clearance: number,
    zMargin: number,
  ): THREE.Vector2 {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      x = this.randomPlantX(pathVisible, clearance);
      z = this.randomZ(zMargin);
      const globalX = chunk.position.x + x;
      const globalZ = chunk.position.z + z;
      const lionClearingDistance =
        Math.pow((globalX - LION_CLEARING_X) / 6, 2) +
        Math.pow((globalZ - LION_CLEARING_Z) / 6, 2);
      const trappedLionClearingDistance =
        Math.pow((globalX - TRAPPED_LION_CLEARING_X) / 7.2, 2) +
        Math.pow((globalZ - TRAPPED_LION_CLEARING_Z) / 7.2, 2);
      if (lionClearingDistance >= 1 && trappedLionClearingDistance >= 1) break;
    }
    return new THREE.Vector2(x, z);
  }

  private randomZ(margin = 0): number {
    return -CHUNK_LENGTH / 2 + margin + Math.random() * (CHUNK_LENGTH - margin * 2);
  }

  private chunkKey(x: number, z: number): string {
    return `${x}:${z}`;
  }
}
