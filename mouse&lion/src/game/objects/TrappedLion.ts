import * as THREE from 'three';
import { SleepingLion } from './SleepingLion';

interface NetParticle {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  pinnedPosition: THREE.Vector3 | null;
}

interface NetConstraint {
  first: number;
  second: number;
  restLength: number;
  breakDistance: number;
  broken: boolean;
}

interface RopeSegment {
  first: number;
  second: number;
  constraint: NetConstraint;
}

interface LionCollider {
  center: THREE.Vector3;
  radius: number;
}

export class TrappedLion {
  readonly group = new THREE.Group();

  private readonly lion = new SleepingLion();
  private readonly netRoot = new THREE.Group();
  private readonly netWidth = 9;
  private readonly netDepth = 11;
  private readonly particles: NetParticle[] = [];
  private readonly constraints: NetConstraint[] = [];
  private readonly ropeSegments: RopeSegment[] = [];
  private readonly colliders: LionCollider[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly midpoint = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly collisionOffset = new THREE.Vector3();
  private ropeInstances!: THREE.InstancedMesh;
  private knotInstances!: THREE.InstancedMesh;
  private elapsed = 0;
  private struggleAmount = 1;
  private struggleTarget = 1;
  private chewProgress = 0;
  private released = false;

  constructor() {
    this.group.name = 'LionTrappedInHuntersNet';
    this.netRoot.name = 'PhysicalWhiteHuntersNet';

    this.lion.wake();
    for (let index = 0; index < 180; index += 1) this.lion.update(1 / 60);
    this.group.add(this.lion.group);

    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f0df,
      emissive: 0x42423b,
      emissiveIntensity: 0.35,
      roughness: 0.92,
    });
    this.createPhysicalNet(ropeMaterial);
    this.createLionColliders();
    this.group.add(this.netRoot);

    for (let index = 0; index < 18; index += 1) this.simulateNet(1 / 60);
    this.updateNetMeshes();
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.struggleAmount = THREE.MathUtils.damp(this.struggleAmount, this.struggleTarget, 3.4, delta);
    this.lion.update(delta);

    const effort = Math.pow(Math.max(0, Math.sin(this.elapsed * 1.65)), 3) * this.struggleAmount;
    const shake = Math.sin(this.elapsed * 10.5) * effort;
    const heave = Math.abs(Math.sin(this.elapsed * 5.25)) * effort;
    this.lion.group.position.x = shake * 0.075;
    this.lion.group.position.y = heave * 0.045;
    this.lion.group.rotation.z = shake * 0.05;
    this.lion.group.rotation.x = Math.sin(this.elapsed * 7.2) * effort * 0.022;
    this.lion.group.updateMatrix();

    const simulationStep = Math.min(delta, 1 / 30) / 2;
    this.simulateNet(simulationStep);
    this.simulateNet(simulationStep);
    this.updateNetMeshes();
  }

  struggle(): void {
    this.struggleTarget = 1;
  }

  calm(): void {
    this.struggleTarget = 0.04;
  }

  setChewProgress(progress: number): void {
    this.chewProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const openingRadius = THREE.MathUtils.lerp(0.16, 1.18, this.chewProgress);
    for (const constraint of this.constraints) {
      if (constraint.breakDistance <= openingRadius) constraint.broken = true;
    }
  }

  releaseNet(): void {
    this.released = true;
    this.struggleTarget = 0;
    this.setChewProgress(1);
    for (const particle of this.particles) {
      particle.pinnedPosition = null;
      particle.previous.copy(particle.position);
      particle.previous.x -= Math.sign(particle.position.x || 1) * 0.035;
      particle.previous.z -= Math.sign(particle.position.z || 1) * 0.025;
      particle.previous.y += 0.045;
    }
  }

  dispose(): void {
    this.lion.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.netRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private createPhysicalNet(material: THREE.Material): void {
    const width = 2.7;
    const depth = 3.7;
    const spacingX = width / (this.netWidth - 1);
    const spacingZ = depth / (this.netDepth - 1);

    for (let zIndex = 0; zIndex < this.netDepth; zIndex += 1) {
      const z = -depth / 2 + zIndex * spacingZ;
      for (let xIndex = 0; xIndex < this.netWidth; xIndex += 1) {
        const x = -width / 2 + xIndex * spacingX;
        const position = new THREE.Vector3(x, this.initialNetHeight(x, z), z);
        const isCorner = (xIndex === 0 || xIndex === this.netWidth - 1)
          && (zIndex === 0 || zIndex === this.netDepth - 1);
        const pinnedPosition = isCorner ? new THREE.Vector3(x, 0.045, z) : null;
        this.particles.push({
          position: pinnedPosition?.clone() ?? position,
          previous: pinnedPosition?.clone() ?? position.clone(),
          pinnedPosition,
        });
      }
    }

    for (let zIndex = 0; zIndex < this.netDepth; zIndex += 1) {
      for (let xIndex = 0; xIndex < this.netWidth; xIndex += 1) {
        const current = this.particleIndex(xIndex, zIndex);
        if (xIndex < this.netWidth - 1) {
          const right = this.particleIndex(xIndex + 1, zIndex);
          this.addConstraint(current, right, spacingX, true);
        }
        if (zIndex < this.netDepth - 1) {
          const below = this.particleIndex(xIndex, zIndex + 1);
          this.addConstraint(current, below, spacingZ, true);
        }
        if (xIndex < this.netWidth - 1 && zIndex < this.netDepth - 1) {
          const diagonal = Math.hypot(spacingX, spacingZ);
          this.addConstraint(current, this.particleIndex(xIndex + 1, zIndex + 1), diagonal, false);
          this.addConstraint(this.particleIndex(xIndex + 1, zIndex), this.particleIndex(xIndex, zIndex + 1), diagonal, false);
        }
      }
    }

    const ropeGeometry = new THREE.CylinderGeometry(0.017, 0.017, 1, 6);
    this.ropeInstances = new THREE.InstancedMesh(ropeGeometry, material, this.ropeSegments.length);
    this.ropeInstances.name = 'SimulatedNetRopes';
    this.ropeInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ropeInstances.frustumCulled = false;
    this.ropeInstances.castShadow = true;
    this.netRoot.add(this.ropeInstances);

    const knotGeometry = new THREE.SphereGeometry(0.032, 6, 5);
    this.knotInstances = new THREE.InstancedMesh(knotGeometry, material, this.particles.length);
    this.knotInstances.name = 'SimulatedNetKnots';
    this.knotInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.knotInstances.frustumCulled = false;
    this.knotInstances.castShadow = true;
    this.netRoot.add(this.knotInstances);
  }

  private addConstraint(first: number, second: number, restLength: number, visible: boolean): void {
    const midpoint = this.midpoint
      .addVectors(this.particles[first].position, this.particles[second].position)
      .multiplyScalar(0.5);
    const constraint: NetConstraint = {
      first,
      second,
      restLength,
      breakDistance: Math.hypot(midpoint.x + 0.58, midpoint.z + 0.82),
      broken: false,
    };
    this.constraints.push(constraint);
    if (visible) this.ropeSegments.push({ first, second, constraint });
  }

  private createLionColliders(): void {
    for (const [x, y, z, radius] of [
      [0, 1.02, 0.22, 0.7],
      [0, 0.92, 0.78, 0.58],
      [0, 1.08, -0.45, 0.62],
      [0, 1.3, -0.96, 0.69],
      [-0.4, 0.45, -0.42, 0.23],
      [0.4, 0.45, -0.42, 0.23],
      [-0.4, 0.45, 0.58, 0.23],
      [0.4, 0.45, 0.58, 0.23],
    ] as Array<[number, number, number, number]>) {
      this.colliders.push({ center: new THREE.Vector3(x, y, z), radius });
    }
  }

  private simulateNet(step: number): void {
    const gravity = -7.4 * step * step;
    for (const particle of this.particles) {
      if (particle.pinnedPosition) {
        particle.position.copy(particle.pinnedPosition);
        particle.previous.copy(particle.pinnedPosition);
        continue;
      }
      this.direction.subVectors(particle.position, particle.previous).multiplyScalar(0.985);
      particle.previous.copy(particle.position);
      particle.position.add(this.direction);
      particle.position.y += gravity;
    }

    for (let iteration = 0; iteration < 6; iteration += 1) {
      for (const constraint of this.constraints) {
        if (!constraint.broken) this.solveConstraint(constraint);
      }
      if (!this.released) this.solveLionCollisions();
      for (const particle of this.particles) {
        if (particle.pinnedPosition) particle.position.copy(particle.pinnedPosition);
        else particle.position.y = Math.max(0.045, particle.position.y);
      }
    }
  }

  private solveConstraint(constraint: NetConstraint): void {
    const first = this.particles[constraint.first];
    const second = this.particles[constraint.second];
    this.direction.subVectors(second.position, first.position);
    const length = this.direction.length();
    if (length < 0.0001) return;

    const firstWeight = first.pinnedPosition ? 0 : 1;
    const secondWeight = second.pinnedPosition ? 0 : 1;
    const totalWeight = firstWeight + secondWeight;
    if (totalWeight === 0) return;
    const correction = (length - constraint.restLength) / length;
    if (firstWeight > 0) first.position.addScaledVector(this.direction, correction * firstWeight / totalWeight);
    if (secondWeight > 0) second.position.addScaledVector(this.direction, -correction * secondWeight / totalWeight);
  }

  private solveLionCollisions(): void {
    for (const particle of this.particles) {
      if (particle.pinnedPosition) continue;
      for (const collider of this.colliders) {
        this.midpoint.copy(collider.center).applyMatrix4(this.lion.group.matrix);
        const radius = collider.radius * this.lion.group.scale.x + 0.025;
        this.collisionOffset.subVectors(particle.position, this.midpoint);
        const distanceSquared = this.collisionOffset.lengthSq();
        if (distanceSquared >= radius * radius) continue;
        if (distanceSquared < 0.000001) this.collisionOffset.set(0, 1, 0);
        else this.collisionOffset.multiplyScalar(1 / Math.sqrt(distanceSquared));
        particle.position.copy(this.midpoint).addScaledVector(this.collisionOffset, radius);
      }
    }
  }

  private updateNetMeshes(): void {
    for (let index = 0; index < this.ropeSegments.length; index += 1) {
      const { first: firstIndex, second: secondIndex, constraint } = this.ropeSegments[index];
      const first = this.particles[firstIndex].position;
      const second = this.particles[secondIndex].position;
      this.direction.subVectors(second, first);
      const length = Math.max(0.001, this.direction.length());
      this.midpoint.addVectors(first, second).multiplyScalar(0.5);
      this.rotation.setFromUnitVectors(this.up, this.direction.multiplyScalar(1 / length));
      this.scale.setScalar(constraint.broken ? 0.001 : 1);
      if (!constraint.broken) this.scale.y = length;
      this.matrix.compose(this.midpoint, this.rotation, this.scale);
      this.ropeInstances.setMatrixAt(index, this.matrix);
    }
    this.ropeInstances.instanceMatrix.needsUpdate = true;

    for (let index = 0; index < this.particles.length; index += 1) {
      this.matrix.makeTranslation(
        this.particles[index].position.x,
        this.particles[index].position.y,
        this.particles[index].position.z,
      );
      this.knotInstances.setMatrixAt(index, this.matrix);
    }
    this.knotInstances.instanceMatrix.needsUpdate = true;
  }

  private particleIndex(x: number, z: number): number {
    return z * this.netWidth + x;
  }

  private initialNetHeight(x: number, z: number): number {
    const xShape = Math.max(0, 1 - Math.pow(x / 1.42, 2));
    const zShape = Math.max(0, 1 - Math.pow(z / 1.92, 2));
    return 0.055 + 1.82 * Math.pow(xShape * zShape, 0.58);
  }
}
