import * as THREE from 'three';

interface LionLeg {
  upper: THREE.Group;
  lower: THREE.Group;
  paw: THREE.Group;
  standX: number;
  standZ: number;
  sleepX: number;
  sleepZ: number;
  wakeStart: number;
  sleepUpperX: number;
  sleepUpperZ: number;
  sleepLowerX: number;
  gaitPhase: number;
}

export class SleepingLion {
  readonly group = new THREE.Group();

  private readonly animalRoot = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly chest: THREE.Mesh;
  private readonly haunch: THREE.Mesh;
  private readonly headRoot = new THREE.Group();
  private mouth!: THREE.Mesh;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly eyelids: THREE.Mesh[] = [];
  private readonly legs: LionLeg[] = [];
  private readonly tailAnchor = new THREE.Group();
  private readonly sleepingTailRoot = new THREE.Group();
  private readonly tailRoot = new THREE.Group();
  private readonly tailTip = new THREE.Group();
  private readonly tailJoints: THREE.Group[] = [];
  private haunchRearOffset = 0;
  private elapsed = 0;
  private wakeAmount = 0;
  private wakeTarget = 0;
  private laughAmount = 0;
  private laughTarget = 0;
  private leaving = false;
  private departed = false;
  private departureElapsed = 0;

  constructor() {
    this.group.name = 'SleepingLionLandmark';
    this.animalRoot.name = 'ArticulatedLion';

    const furMaterial = new THREE.MeshStandardMaterial({ color: 0xa9773e, roughness: 0.96, flatShading: true });
    const furLightMaterial = new THREE.MeshStandardMaterial({ color: 0xc59a62, roughness: 0.94, flatShading: true });
    const muzzleMaterial = new THREE.MeshStandardMaterial({ color: 0xd4b481, roughness: 0.92, flatShading: true });
    const maneMaterial = new THREE.MeshStandardMaterial({ color: 0x35281d, roughness: 1, flatShading: true });
    const maneHighlightMaterial = new THREE.MeshStandardMaterial({ color: 0x513a25, roughness: 1, flatShading: true });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.68, flatShading: true });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe1b956,
      emissive: 0x4a3308,
      emissiveIntensity: 0.5,
      roughness: 0.38,
    });

    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), furMaterial);
    this.body.name = 'LionBody';
    this.body.scale.set(0.78, 0.64, 1.35);
    this.body.position.set(0, 0.48, 0.18);
    this.body.castShadow = true;
    this.animalRoot.add(this.body);

    this.chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 13, 9), maneHighlightMaterial);
    this.chest.name = 'LionChest';
    this.chest.scale.set(0.94, 0.88, 0.86);
    this.chest.position.set(0, 0.5, -0.48);
    this.chest.castShadow = true;
    this.animalRoot.add(this.chest);

    this.haunch = new THREE.Mesh(new THREE.SphereGeometry(0.56, 13, 9), furMaterial);
    this.haunch.name = 'LionHaunch';
    this.haunch.scale.set(0.92, 0.78, 0.98);
    this.haunch.position.set(0, 0.46, 0.72);
    this.haunch.castShadow = true;
    this.haunch.geometry.computeBoundingBox();
    this.haunchRearOffset = (this.haunch.geometry.boundingBox?.max.z ?? 0.56) * this.haunch.scale.z;
    this.animalRoot.add(this.haunch);

    this.createHead(furMaterial, furLightMaterial, muzzleMaterial, maneMaterial, maneHighlightMaterial, darkMaterial, eyeMaterial);
    this.animalRoot.add(this.headRoot);

    const limbLayout: Array<{
      x: number;
      z: number;
      wakeStart: number;
      sleepUpperX: number;
      sleepUpperZ: number;
      sleepLowerX: number;
      gaitPhase: number;
    }> = [
      { x: -0.38, z: -0.42, wakeStart: 0.12, sleepUpperX: 1.22, sleepUpperZ: -0.12, sleepLowerX: -0.15, gaitPhase: 0 },
      { x: 0.38, z: -0.42, wakeStart: 0.3, sleepUpperX: 1.16, sleepUpperZ: 0.12, sleepLowerX: -0.12, gaitPhase: Math.PI },
      { x: -0.4, z: 0.58, wakeStart: 0.43, sleepUpperX: -1.02, sleepUpperZ: -0.38, sleepLowerX: 1.2, gaitPhase: Math.PI },
      { x: 0.4, z: 0.58, wakeStart: 0.58, sleepUpperX: -1.1, sleepUpperZ: 0.38, sleepLowerX: 1.25, gaitPhase: 0 },
    ];

    for (const layout of limbLayout) {
      this.createLeg(layout, furMaterial, furLightMaterial);
    }

    this.createTail(furMaterial, maneMaterial);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), shadowMaterial);
    shadow.name = 'LionGroundShadow';
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.scale.set(0.9, 1.45, 1);
    this.group.add(shadow);

    this.animalRoot.position.y = 0.04;
    this.animalRoot.rotation.y = -Math.PI / 2;
    this.animalRoot.rotation.z = 0.18;
    this.group.add(this.animalRoot);
    this.group.scale.setScalar(1.08);
    this.applyPose(0);
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.wakeAmount = THREE.MathUtils.damp(this.wakeAmount, this.wakeTarget, 1.35, delta);
    this.laughAmount = THREE.MathUtils.damp(this.laughAmount, this.laughTarget, 4, delta);
    if (this.leaving) this.departureElapsed += delta;

    this.applyPose(delta);

    if (this.leaving) {
      this.group.position.z -= delta * 2.35;
      this.group.position.x += delta * 0.42;
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, 0, 2.4, delta);
      if (this.departureElapsed > 4.2) {
        this.departed = true;
        this.group.visible = false;
      }
    }
  }

  wake(): void {
    this.wakeTarget = 1;
  }

  laugh(): void {
    this.laughTarget = 1;
  }

  leave(): void {
    this.wakeTarget = 1;
    this.laughTarget = 0;
    this.leaving = true;
  }

  isSolid(): boolean {
    return !this.leaving && !this.departed;
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

  private createHead(
    furMaterial: THREE.Material,
    furLightMaterial: THREE.Material,
    muzzleMaterial: THREE.Material,
    maneMaterial: THREE.Material,
    maneHighlightMaterial: THREE.Material,
    darkMaterial: THREE.Material,
    eyeMaterial: THREE.Material,
  ): void {
    this.headRoot.name = 'IndependentLionHead';

    const maneCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), maneMaterial);
    maneCore.scale.set(1.05, 1.02, 0.88);
    maneCore.castShadow = true;
    this.headRoot.add(maneCore);

    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const maneBlob = new THREE.Mesh(
        new THREE.IcosahedronGeometry(index % 2 === 0 ? 0.27 : 0.23, 0),
        index % 3 === 0 ? maneHighlightMaterial : maneMaterial,
      );
      maneBlob.position.set(Math.cos(angle) * 0.5, Math.sin(angle) * 0.46, 0.04);
      maneBlob.scale.z = 0.8;
      maneBlob.rotation.set(angle * 0.08, angle, angle * 0.12);
      maneBlob.castShadow = true;
      this.headRoot.add(maneBlob);
    }

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.36, 13, 9), furLightMaterial);
    face.scale.set(0.86, 0.78, 1.02);
    face.position.set(0, 0, -0.37);
    face.castShadow = true;
    this.headRoot.add(face);

    for (const x of [-0.25, 0.25]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 6), furMaterial);
      ear.scale.set(0.82, 1, 0.4);
      ear.position.set(x, 0.35, -0.13);
      ear.rotation.z = -Math.sign(x) * 0.22;
      ear.castShadow = true;
      this.headRoot.add(ear);
    }

    for (const x of [-0.1, 0.1]) {
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 7), muzzleMaterial);
      muzzle.scale.set(1.08, 0.76, 1.12);
      muzzle.position.set(x, -0.09, -0.68);
      muzzle.castShadow = true;
      this.headRoot.add(muzzle);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), darkMaterial);
    nose.scale.set(1.16, 0.72, 0.9);
    nose.position.set(0, -0.045, -0.78);
    this.headRoot.add(nose);

    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), darkMaterial);
    this.mouth.position.set(0, -0.17, -0.7);
    this.mouth.scale.set(0.82, 0.04, 0.5);
    this.headRoot.add(this.mouth);

    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 6), eyeMaterial);
      eye.position.set(x, 0.075, -0.68);
      eye.scale.y = 0.08;
      this.eyes.push(eye);
      this.headRoot.add(eye);

      const eyelid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.018), darkMaterial);
      eyelid.position.set(x, 0.075, -0.69);
      eyelid.rotation.z = x < 0 ? 0.1 : -0.1;
      this.eyelids.push(eyelid);
      this.headRoot.add(eyelid);
    }
  }

  private createLeg(
    layout: {
      x: number;
      z: number;
      wakeStart: number;
      sleepUpperX: number;
      sleepUpperZ: number;
      sleepLowerX: number;
      gaitPhase: number;
    },
    furMaterial: THREE.Material,
    pawMaterial: THREE.Material,
  ): void {
    const upper = new THREE.Group();
    upper.position.set(layout.x, 0.42, layout.z);

    const upperMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.38, 8), furMaterial);
    upperMesh.position.y = -0.19;
    upperMesh.castShadow = true;
    upper.add(upperMesh);

    const lower = new THREE.Group();
    lower.position.y = -0.37;
    const lowerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.125, 0.34, 8), furMaterial);
    lowerMesh.position.y = -0.17;
    lowerMesh.castShadow = true;
    lower.add(lowerMesh);

    const paw = new THREE.Group();
    paw.position.y = -0.34;
    const pawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 7), pawMaterial);
    pawMesh.scale.set(1.02, 0.5, 1.45);
    pawMesh.position.set(0, -0.02, -0.07);
    pawMesh.castShadow = true;
    paw.add(pawMesh);

    lower.add(paw);
    upper.add(lower);
    this.animalRoot.add(upper);
    this.legs.push({
      upper,
      lower,
      paw,
      standX: layout.x,
      standZ: layout.z,
      sleepX: layout.x * 0.55,
      sleepZ: layout.z < 0 ? -0.5 : 0.55,
      wakeStart: layout.wakeStart,
      sleepUpperX: layout.sleepUpperX,
      sleepUpperZ: layout.sleepUpperZ,
      sleepLowerX: layout.sleepLowerX,
      gaitPhase: layout.gaitPhase,
    });
  }

  private createTail(furMaterial: THREE.Material, tuftMaterial: THREE.Material): void {
    this.tailAnchor.name = 'HaunchRearCenterTailAnchor';
    this.sleepingTailRoot.name = 'ContinuousRestingTail';
    this.tailRoot.name = 'ArticulatedTail';
    this.tailRoot.position.set(0, 0, 0);

    const sleepingCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.08, -0.24, 0.22),
      new THREE.Vector3(-0.18, -0.43, 0.45),
      new THREE.Vector3(-0.5, -0.445, 0.62),
      new THREE.Vector3(-0.82, -0.445, 0.48),
      new THREE.Vector3(-0.95, -0.445, 0.2),
    ]);
    const sleepingTail = new THREE.Mesh(new THREE.TubeGeometry(sleepingCurve, 28, 0.055, 7, false), furMaterial);
    sleepingTail.castShadow = true;
    this.sleepingTailRoot.add(sleepingTail);
    const sleepingTuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), tuftMaterial);
    sleepingTuft.position.set(-0.95, -0.36, 0.2);
    sleepingTuft.scale.set(0.72, 0.72, 1.25);
    sleepingTuft.castShadow = true;
    this.sleepingTailRoot.add(sleepingTuft);

    let parent = this.tailRoot;
    const segmentLength = 0.3;
    for (let index = 0; index < 5; index += 1) {
      const joint = new THREE.Group();
      joint.name = `TailJoint-${index + 1}`;
      if (index > 0) joint.position.z = segmentLength;
      const radius = 0.06 - index * 0.006;
      const segment = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.82, radius, segmentLength, 7),
        furMaterial,
      );
      segment.rotation.x = Math.PI / 2;
      segment.position.z = segmentLength / 2;
      segment.castShadow = true;
      joint.add(segment);
      parent.add(joint);
      this.tailJoints.push(joint);
      parent = joint;
    }

    this.tailTip.position.z = segmentLength;
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), tuftMaterial);
    tuft.scale.set(0.72, 0.72, 1.25);
    tuft.castShadow = true;
    this.tailTip.add(tuft);
    parent.add(this.tailTip);
    this.tailAnchor.add(this.sleepingTailRoot);
    this.tailAnchor.add(this.tailRoot);
    this.animalRoot.add(this.tailAnchor);
    this.updateTailAnchor();
  }

  private applyPose(_delta: number): void {
    const wake = this.smoothstep(0, 1, this.wakeAmount);
    const headWake = this.smoothstep(0.28, 0.94, this.wakeAmount);
    const breath = Math.sin(this.elapsed * 1.35);
    const laughPulse = Math.abs(Math.sin(this.elapsed * 8.5)) * this.laughAmount;
    const walking = this.leaving ? 1 : 0;
    const walkCycle = this.departureElapsed * 5.8;

    this.animalRoot.position.y = THREE.MathUtils.lerp(0.04, 0.34, wake) + Math.abs(Math.sin(walkCycle * 2)) * 0.025 * walking;
    this.animalRoot.rotation.y = THREE.MathUtils.lerp(-Math.PI / 2, 0, wake);
    this.animalRoot.rotation.z = 0;
    this.body.position.y = 0.48 + wake * 0.06 + breath * 0.012 + laughPulse * 0.03;
    this.body.scale.y = 0.64 + breath * 0.012 + laughPulse * 0.035;
    this.chest.position.y = 0.5 + wake * 0.08 + laughPulse * 0.045;
    this.haunch.position.y = 0.46 + wake * 0.05;
    this.updateTailAnchor();

    this.headRoot.position.x = THREE.MathUtils.lerp(0.0, 0, headWake);
    this.headRoot.position.y = THREE.MathUtils.lerp(0.22, 0.69, headWake) + laughPulse * 0.08;
    this.headRoot.position.z = THREE.MathUtils.lerp(-0.72, -0.88, headWake);
    this.headRoot.rotation.x = THREE.MathUtils.lerp(0.28, 0, headWake) + laughPulse * 0.06;
    this.headRoot.rotation.y = Math.sin(this.elapsed * 1.7) * 0.025 * wake;
    this.headRoot.rotation.z = THREE.MathUtils.lerp(-0.2, 0, headWake)
      + Math.sin(this.elapsed * 7) * this.laughAmount * 0.04;
    this.mouth.scale.y = 0.04 + laughPulse * 0.95;
    for (const eye of this.eyes) eye.scale.y = 0.08 + headWake * 0.92;
    for (const eyelid of this.eyelids) eyelid.scale.x = 1 - headWake * 0.86;

    for (const leg of this.legs) {
      const legWake = this.smoothstep(leg.wakeStart, Math.min(1, leg.wakeStart + 0.38), this.wakeAmount);
      const stride = Math.sin(walkCycle + leg.gaitPhase) * walking;
      const lift = Math.max(0, Math.sin(walkCycle + leg.gaitPhase)) * walking;
      leg.upper.position.x = THREE.MathUtils.lerp(leg.sleepX, leg.standX, legWake);
      leg.upper.position.z = THREE.MathUtils.lerp(leg.sleepZ, leg.standZ, legWake);
      leg.upper.rotation.x = THREE.MathUtils.lerp(leg.sleepUpperX, stride * 0.42, legWake);
      leg.upper.rotation.z = THREE.MathUtils.lerp(leg.sleepUpperZ, 0, legWake);
      leg.lower.rotation.x = THREE.MathUtils.lerp(
        leg.sleepLowerX,
        -stride * 0.18 + lift * 0.52,
        legWake,
      );
      leg.paw.rotation.x = -(leg.upper.rotation.x + leg.lower.rotation.x) * 0.72;
      leg.paw.position.z = -lift * 0.1;
    }

    this.tailRoot.rotation.x = THREE.MathUtils.lerp(0.95, 0.55, wake);
    this.tailRoot.rotation.y = THREE.MathUtils.lerp(-1.05, 0, wake);
    const sleepCurlY = [-0.34, -0.46, -0.5, -0.4, -0.2];
    const sleepCurlX = [0, -0.55, -0.35, -0.05, 0];
    const standingCurveX = [-0.25, -0.15, -0.05, -0.25, -0.45];
    for (let index = 0; index < this.tailJoints.length; index += 1) {
      const joint = this.tailJoints[index];
      const wave = Math.sin(this.elapsed * (walking ? 5.2 : 2.2) - index * 0.62);
      const walkingWave = wave * (0.13 + index * 0.018) * walking;
      const idleWave = wave * 0.035 * wake * (1 - walking);
      joint.rotation.y = THREE.MathUtils.lerp(sleepCurlY[index], walkingWave + idleWave, wake);
      joint.rotation.x = THREE.MathUtils.lerp(
        sleepCurlX[index],
        standingCurveX[index] + wave * 0.035 * walking,
        wake,
      );
    }
    this.tailTip.position.y = 0;
    this.tailTip.rotation.y = Math.sin(this.elapsed * 5.2 - 3.1) * (0.08 + walking * 0.1) * wake;
    this.sleepingTailRoot.visible = this.wakeTarget === 0;
    this.tailRoot.visible = this.wakeTarget !== 0;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const normalized = THREE.MathUtils.clamp((value - edge0) / Math.max(0.001, edge1 - edge0), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  }

  private updateTailAnchor(): void {
    this.tailAnchor.position.set(
      this.haunch.position.x,
      this.haunch.position.y,
      this.haunch.position.z + this.haunchRearOffset,
    );
  }

}
