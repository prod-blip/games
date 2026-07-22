import * as THREE from 'three';
import type { InputState } from '../types';

export class MouseMarker {
  readonly group = new THREE.Group();

  private readonly moveSpeed = 4.8;
  private readonly velocity = new THREE.Vector2();
  private readonly bodyRoot = new THREE.Group();
  private readonly headRoot = new THREE.Group();
  private readonly tailRoot = new THREE.Group();
  private readonly staffRoot = new THREE.Group();
  private readonly ears: THREE.Mesh[] = [];
  private readonly paws: THREE.Mesh[] = [];
  private readonly pawRestZ: number[] = [];
  private readonly shadow: THREE.Mesh;
  private bobTime = 0;
  private trembling = false;
  private trembleTime = 0;
  private scriptedYaw: number | null = null;

  constructor() {
    this.group.name = 'PilgrimRatPlayer';
    this.bodyRoot.name = 'PilgrimRatBody';
    this.headRoot.name = 'PilgrimRatHead';
    this.staffRoot.name = 'WalkingStaff';

    const furMaterial = new THREE.MeshStandardMaterial({ color: 0x2d2b25, roughness: 0.95, flatShading: true });
    const furHighlightMaterial = new THREE.MeshStandardMaterial({ color: 0x4c473d, roughness: 0.94, flatShading: true });
    const muzzleMaterial = new THREE.MeshStandardMaterial({ color: 0xbca993, roughness: 0.9, flatShading: true });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xa77c68, roughness: 0.88, flatShading: true });
    const innerEarMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5f55, roughness: 0.88, flatShading: true });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x080807, roughness: 0.35 });
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff8dc });
    const robeMaterial = new THREE.MeshStandardMaterial({ color: 0x817864, roughness: 1, flatShading: true });
    const robeEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa087, roughness: 0.98, flatShading: true });
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x674a2d, roughness: 1, flatShading: true });
    const pouchMaterial = new THREE.MeshStandardMaterial({ color: 0x3e2a1c, roughness: 0.95, flatShading: true });
    const strawMaterial = new THREE.MeshStandardMaterial({ color: 0xa78c58, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const strawDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x5d482d, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x382418, roughness: 1, flatShading: true });
    const signMaterial = new THREE.MeshStandardMaterial({ color: 0x9a815c, roughness: 1, flatShading: true });
    const tailMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6d61, roughness: 0.9, flatShading: true });

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.68, 9), robeMaterial);
    robe.position.y = 0.47;
    robe.castShadow = true;
    this.bodyRoot.add(robe);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 9), furMaterial);
    torso.scale.set(1, 1.22, 0.82);
    torso.position.set(0, 0.76, 0.015);
    torso.castShadow = true;
    this.bodyRoot.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), furHighlightMaterial);
    chest.scale.set(0.9, 1.2, 0.38);
    chest.position.set(0, 0.79, -0.215);
    chest.castShadow = true;
    this.bodyRoot.add(chest);

    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.5, 0.035), robeEdgeMaterial);
      lapel.position.set(side * 0.08, 0.76, -0.285);
      lapel.rotation.z = side * 0.36;
      lapel.castShadow = true;
      this.bodyRoot.add(lapel);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.47, 7), robeMaterial);
      sleeve.position.set(side * 0.31, 0.7, -0.005);
      sleeve.rotation.z = side * 0.26;
      sleeve.scale.z = 0.84;
      sleeve.castShadow = true;
      this.bodyRoot.add(sleeve);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 7), skinMaterial);
      hand.scale.set(0.72, 1.05, 0.72);
      hand.position.set(side * 0.39, 0.51, -0.045);
      hand.castShadow = true;
      this.bodyRoot.add(hand);
    }

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.025, 6, 20), ropeMaterial);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.61;
    belt.scale.z = 0.78;
    belt.castShadow = true;
    this.bodyRoot.add(belt);

    const beltKnot = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.017, 5, 12), ropeMaterial);
    beltKnot.position.set(0.06, 0.59, -0.29);
    beltKnot.castShadow = true;
    this.bodyRoot.add(beltKnot);

    for (const x of [0.035, 0.09]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.26, 5), ropeMaterial);
      cord.position.set(x, 0.46, -0.29);
      cord.rotation.z = x > 0.05 ? -0.08 : 0.12;
      cord.castShadow = true;
      this.bodyRoot.add(cord);
    }

    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), pouchMaterial);
    pouch.scale.set(0.8, 1, 0.55);
    pouch.position.set(0.27, 0.57, -0.22);
    pouch.castShadow = true;
    this.bodyRoot.add(pouch);

    const pouchCap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.075), ropeMaterial);
    pouchCap.position.set(0.27, 0.66, -0.235);
    pouchCap.castShadow = true;
    this.bodyRoot.add(pouchCap);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), furMaterial);
    head.scale.set(0.92, 0.9, 1.12);
    head.position.set(0, 1.04, -0.035);
    head.castShadow = true;
    this.headRoot.add(head);

    for (const x of [-0.17, 0.17]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8), furMaterial);
      ear.scale.set(0.82, 1.08, 0.36);
      ear.position.set(x, 1.18, -0.015);
      ear.rotation.z = -Math.sign(x) * 0.15;
      ear.castShadow = true;
      this.ears.push(ear);
      this.headRoot.add(ear);

      const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 7), innerEarMaterial);
      innerEar.scale.set(0.82, 1.05, 0.18);
      innerEar.position.set(x, 1.18, -0.052);
      innerEar.rotation.z = -Math.sign(x) * 0.15;
      this.headRoot.add(innerEar);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 9, 7), eyeMaterial);
      eye.position.set(x * 0.47, 1.07, -0.264);
      this.headRoot.add(eye);

      const eyeHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), highlightMaterial);
      eyeHighlight.position.set(x * 0.47 - 0.006, 1.08, -0.291);
      this.headRoot.add(eyeHighlight);
    }

    for (const x of [-0.068, 0.068]) {
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.087, 11, 8), muzzleMaterial);
      muzzle.scale.set(1, 0.76, 1.18);
      muzzle.position.set(x, 1.0, -0.24);
      muzzle.castShadow = true;
      this.headRoot.add(muzzle);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.046, 9, 7), skinMaterial);
    nose.scale.set(1, 0.82, 1.12);
    nose.position.set(0, 1.005, -0.345);
    nose.castShadow = true;
    this.headRoot.add(nose);

    const whiskerGeometry = new THREE.CylinderGeometry(0.0035, 0.0035, 0.34, 4);
    const whiskerMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d0bd });
    const whiskerUp = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1]) {
      for (const yOffset of [-0.035, 0.01, 0.05]) {
        const direction = new THREE.Vector3(side, yOffset * 2.2, -0.16).normalize();
        const whisker = new THREE.Mesh(whiskerGeometry, whiskerMaterial);
        whisker.position.set(side * 0.07, 1.0 + yOffset, -0.285).addScaledVector(direction, 0.16);
        whisker.quaternion.setFromUnitVectors(whiskerUp, direction);
        this.headRoot.add(whisker);
      }
    }

    const hatUnderside = new THREE.Mesh(new THREE.CircleGeometry(0.49, 22), strawDarkMaterial);
    hatUnderside.rotation.x = -Math.PI / 2;
    hatUnderside.position.y = 1.245;
    hatUnderside.castShadow = true;
    this.headRoot.add(hatUnderside);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.2, 22, 1, true), strawMaterial);
    hat.position.y = 1.34;
    hat.scale.z = 0.92;
    hat.castShadow = true;
    this.headRoot.add(hat);

    for (const [radius, y] of [[0.47, 1.255], [0.36, 1.29]] as Array<[number, number]>) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 4, 22), strawDarkMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ring.scale.z = 0.92;
      this.headRoot.add(ring);
    }

    const hatKnot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.07, 7), strawDarkMaterial);
    hatKnot.position.y = 1.475;
    hatKnot.castShadow = true;
    this.headRoot.add(hatKnot);

    this.bodyRoot.add(this.headRoot);

    for (const x of [-0.15, 0.15]) {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 7), skinMaterial);
      paw.scale.set(0.82, 0.45, 1.4);
      paw.position.set(x, 0.095, -0.12);
      paw.castShadow = true;
      this.paws.push(paw);
      this.pawRestZ.push(-0.12);
      this.bodyRoot.add(paw);

      for (const toeOffset of [-0.04, 0, 0.04]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 5), muzzleMaterial);
        toe.position.set(x + toeOffset, 0.08, -0.235);
        toe.scale.set(0.75, 0.55, 1.25);
        this.bodyRoot.add(toe);
      }
    }

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, 0.02, 0.25),
      new THREE.Vector3(0.25, -0.03, 0.52),
      new THREE.Vector3(0.48, 0.01, 0.72),
      new THREE.Vector3(0.63, 0.09, 0.88),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 22, 0.022, 6, false), tailMaterial);
    tail.castShadow = true;
    this.tailRoot.position.set(0, 0.32, 0.22);
    this.tailRoot.add(tail);
    this.bodyRoot.add(this.tailRoot);

    this.staffRoot.position.set(-0.49, 0.035, -0.015);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.72, 7), woodMaterial);
    staff.position.y = 0.86;
    staff.rotation.z = -0.015;
    staff.castShadow = true;
    this.staffRoot.add(staff);

    for (const y of [1.22, 1.28, 1.34]) {
      const binding = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 9), ropeMaterial);
      binding.rotation.x = Math.PI / 2;
      binding.position.y = y;
      this.staffRoot.add(binding);
    }

    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.27, 0.035), signMaterial);
    sign.position.set(0.11, 1.13, -0.01);
    sign.rotation.z = -0.08;
    sign.castShadow = true;
    this.staffRoot.add(sign);
    this.bodyRoot.add(this.staffRoot);

    this.group.add(this.bodyRoot);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.47, 20), shadowMaterial);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.shadow.scale.set(1.2, 1.45, 1);
    this.group.add(this.shadow);

    this.group.position.set(0, 0.02, 1.7);
  }

  update(delta: number, input: InputState, autoForward = false): number {
    this.trembleTime += delta;
    const hasAnalogMovement = Math.abs(input.moveX) > 0.001 || Math.abs(input.moveY) > 0.001;
    const movement = new THREE.Vector2(
      hasAnalogMovement ? input.moveX : Number(input.right) - Number(input.left),
      hasAnalogMovement ? input.moveY : Number(input.down) - Number(input.up || autoForward),
    );
    if (movement.lengthSq() > 1) movement.normalize();

    const targetVelocityX = movement.x * this.moveSpeed;
    const targetVelocityZ = movement.y * this.moveSpeed;
    const damping = movement.lengthSq() > 0 ? 11 : 15;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVelocityX, damping, delta);
    this.velocity.y = THREE.MathUtils.damp(this.velocity.y, targetVelocityZ, damping, delta);

    const moveX = this.velocity.x * delta;
    const moveZ = this.velocity.y * delta;
    this.group.position.x += moveX;
    this.group.position.z += moveZ;

    const isMoving = this.velocity.lengthSq() > 0.035;
    const targetYaw = this.scriptedYaw ?? (isMoving ? Math.atan2(-this.velocity.x, -this.velocity.y) : null);
    if (targetYaw !== null) {
      const yawDifference = Math.atan2(
        Math.sin(targetYaw - this.group.rotation.y),
        Math.cos(targetYaw - this.group.rotation.y),
      );
      this.group.rotation.y += yawDifference * (1 - Math.exp(-delta * 12));
    }

    const steering = movement.x;
    this.bobTime += delta * (isMoving ? 11 : 2.6);
    const step = Math.sin(this.bobTime);
    const bounce = isMoving ? Math.abs(step) * 0.035 : Math.sin(this.bobTime) * 0.006;
    const actionBounce = input.action ? Math.abs(Math.sin(this.bobTime * 1.7)) * 0.045 : 0;
    const trembleX = this.trembling ? Math.sin(this.trembleTime * 42) * 0.025 : 0;
    const trembleZ = this.trembling ? Math.sin(this.trembleTime * 55 + 0.8) * 0.018 : 0;
    this.bodyRoot.position.set(trembleX, bounce + actionBounce, trembleZ);

    const targetLean = -steering * 0.11 + (this.trembling ? Math.sin(this.trembleTime * 47) * 0.035 : 0);
    this.bodyRoot.rotation.z = THREE.MathUtils.damp(this.bodyRoot.rotation.z, targetLean, 10, delta);
    this.bodyRoot.rotation.x = THREE.MathUtils.damp(this.bodyRoot.rotation.x, isMoving ? step * 0.018 : 0, 9, delta);

    const squash = isMoving ? Math.abs(step) * 0.018 : Math.sin(this.bobTime) * 0.004;
    this.bodyRoot.scale.set(1 + squash * 0.25, 1 - squash, 1 + squash * 0.18);
    this.headRoot.rotation.x = isMoving ? -step * 0.025 : Math.sin(this.bobTime * 0.7) * 0.012;
    this.headRoot.rotation.z = (isMoving ? step * 0.012 : 0) + (this.trembling ? Math.sin(this.trembleTime * 51) * 0.028 : 0);

    for (let index = 0; index < this.paws.length; index += 1) {
      const paw = this.paws[index];
      const phase = index === 0 ? 0 : Math.PI;
      const stride = isMoving ? Math.sin(this.bobTime + phase) : 0;
      paw.position.z = this.pawRestZ[index] + stride * 0.085;
      paw.position.y = 0.095 + (isMoving ? Math.max(0, stride) * 0.06 : 0);
    }

    const earTwitch = isMoving
      ? Math.sin(this.bobTime * 1.7) * 0.035
      : Math.pow(Math.max(0, Math.sin(this.bobTime * 0.43)), 10) * 0.1;
    this.ears[0].rotation.z = 0.15 + earTwitch;
    this.ears[1].rotation.z = -0.15 - earTwitch * 0.7;

    this.tailRoot.rotation.y = Math.sin(this.bobTime * (isMoving ? 0.68 : 0.42)) * 0.2 - steering * 0.07;
    this.tailRoot.rotation.z = Math.sin(this.bobTime * 0.48) * 0.05;
    this.staffRoot.rotation.z = THREE.MathUtils.damp(
      this.staffRoot.rotation.z,
      isMoving ? -step * 0.025 : Math.sin(this.bobTime * 0.5) * 0.006,
      8,
      delta,
    );

    const airborne = bounce + actionBounce;
    const shadowScale = 1 - Math.min(0.12, airborne * 0.8);
    this.shadow.scale.set(1.2 * shadowScale, 1.45 * shadowScale, 1);
    const shadowMaterial = this.shadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.opacity = 0.3 - Math.min(0.09, airborne * 0.65);
    return Math.hypot(moveX, moveZ);
  }

  setScriptedFacing(yaw: number | null): void {
    this.scriptedYaw = yaw;
  }

  setTrembling(trembling: boolean): void {
    this.trembling = trembling;
    if (trembling) this.trembleTime = 0;
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
}
