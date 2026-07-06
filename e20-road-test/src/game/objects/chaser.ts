import * as THREE from 'three';
import type { ChaseState, ChaserAssembly } from '../types';
import type { VehicleState } from '../systems/vehiclePhysics';
import { visualChaserDistance } from '../systems/chase';

const BASE_SCALE = 1.05;
const FACE_TEXTURE_URL = '/nitin-face.webp';

export function createChaser(): ChaserAssembly {
  const chaser = new THREE.Group();
  chaser.name = 'cartoon-villain-chaser';

  const skin = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.78 });
  const skinDark = new THREE.MeshStandardMaterial({ color: 0x8f5d32, roughness: 0.82 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x4c6f9f, roughness: 0.7 });
  const vestDarkMat = new THREE.MeshStandardMaterial({ color: 0x294769, roughness: 0.74 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x8fc8ff, roughness: 0.62 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26222a, roughness: 0.82 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x170306 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf8fbff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

  const bodyRoot = new THREE.Group();
  bodyRoot.position.set(0, 1.72, 0);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 18), shirtMat);
  belly.scale.set(0.9, 1.08, 0.72);
  belly.position.set(0, 0, 0);
  belly.castShadow = true;

  const vestLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.42), vestMat);
  vestLeft.position.set(0.37, 0.06, 0.28);
  vestLeft.rotation.z = -0.08;
  vestLeft.castShadow = true;
  const vestRight = vestLeft.clone();
  vestRight.position.z = -0.28;
  vestRight.rotation.z = -0.08;

  const visibleVestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.09), vestMat);
  visibleVestPanel.position.set(0.22, 0.06, 0.58);
  visibleVestPanel.rotation.z = -0.08;
  visibleVestPanel.castShadow = true;

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 1.05), vestDarkMat);
  belt.position.set(0.18, -0.58, 0);
  belt.castShadow = true;

  const buttons = [-0.22, 0.02, 0.26].map((y) => {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), hairMat);
    button.scale.set(0.5, 1, 1);
    button.position.set(0.58, y, 0);
    return button;
  });
  bodyRoot.add(belly, vestLeft, vestRight, visibleVestPanel, belt, ...buttons);

  const head = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.76), createFaceMaterial());
  head.position.set(0.2, 3.25, 0);
  head.rotation.z = -0.04;

  const eyes = [-0.18, 0.18].map((z) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMat);
    eye.scale.set(0.62, 1, 1);
    eye.position.set(0.78, 3.24, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), pupilMat);
    pupil.scale.set(0.5, 1, 1);
    pupil.position.set(0.035, -0.005, 0);
    eye.add(pupil);
    return eye;
  });

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.44), mouthMat);
  mouth.position.set(0.83, 2.98, 0);
  mouth.castShadow = true;

  // Big side-facing features make the face readable from the chase camera.
  const sideEye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), eyeMat);
  sideEye.scale.set(1, 1, 0.45);
  sideEye.position.set(0.34, 3.36, 0.72);
  const sidePupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pupilMat);
  sidePupil.position.set(0.035, -0.01, 0.025);
  sideEye.add(sidePupil);
  const sideBrow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.065, 0.045), hairMat);
  sideBrow.position.set(0.31, 3.54, 0.75);
  sideBrow.rotation.z = -0.28;
  const sideMouth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.045), mouthMat);
  sideMouth.position.set(0.42, 3.04, 0.74);
  const sideStacheA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.32, 10), hairMat);
  sideStacheA.rotation.z = Math.PI / 2 + 0.25;
  sideStacheA.position.set(0.28, 3.12, 0.78);
  const sideStacheB = sideStacheA.clone();
  sideStacheB.rotation.z = Math.PI / 2 - 0.25;
  sideStacheB.position.set(0.55, 3.12, 0.78);

  const armParts = [-1, 1].map((side) => createArm(side, shirtMat, skin, skinDark));
  const arms = armParts.map((arm) => arm.root);
  for (const arm of arms) chaser.add(arm);

  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.38, 4, 10), pantsMat);
    thigh.position.set(-0.04, -0.16, side * 0.22);
    thigh.castShadow = true;

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 4, 10), pantsMat);
    shin.position.set(0.08, -0.52, side * 0.22);
    shin.rotation.z = side < 0 ? 0.22 : -0.2;
    shin.castShadow = true;

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.18), shoeMat);
    shoe.position.set(0.28, -0.78, side * 0.22);
    shoe.castShadow = true;

    leg.add(thigh, shin, shoe);
    leg.position.set(-0.08, 0.95, 0);
    legs.push(leg);
    chaser.add(leg);
  }

  mouth.visible = false;
  chaser.add(bodyRoot, head);
  chaser.scale.setScalar(BASE_SCALE);
  chaser.rotation.z = -0.06;
  chaser.position.set(-8, 0, 0);

  return { chaser, torso: belly, head, mouth, eyes, arms, armParts, legs };
}

function createFaceMaterial() {
  const texture = new THREE.TextureLoader().load(FACE_TEXTURE_URL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.offset.set(0.18, 0.5);
  texture.repeat.set(0.5, 0.45);

  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
  });
}

function createArm(side: number, shirtMat: THREE.Material, skin: THREE.Material, skinDark: THREE.Material) {
  const root = new THREE.Group();
  root.name = side < 0 ? 'left-shoulder' : 'right-shoulder';

  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.72, 5, 12), shirtMat);
  upperArm.position.y = -0.36;
  upperArm.castShadow = true;

  const elbow = new THREE.Group();
  elbow.position.y = -0.78;

  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.82, 5, 12), skin);
  forearm.position.y = -0.42;
  forearm.castShadow = true;

  const wrist = new THREE.Group();
  wrist.position.y = -0.88;

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), skinDark);
  hand.scale.set(1.35, 0.72, 1);
  hand.castShadow = true;

  wrist.add(hand);
  elbow.add(forearm, wrist);
  root.add(upperArm, elbow);

  root.position.set(0.28, 2.34, side * 0.68);
  root.rotation.x = side * 0.14;
  root.rotation.z = 0.72;
  elbow.rotation.z = 0.42;
  wrist.rotation.z = 0.1;

  return { root, elbow, wrist, hand };
}

export function updateChaserVisuals(assembly: ChaserAssembly, vehicle: VehicleState, chase: ChaseState, delta: number, falling = false) {
  const danger = chase.monsterPressure;
  const visualDistance = visualChaserDistance(chase);
  const close = chase.distance < 4.2 || chase.lungeTimer > 0;
  const runSpeed = close ? 5.5 + danger * 2.2 : 8 + danger * 4;
  assembly.chaser.userData.runCycle = (assembly.chaser.userData.runCycle ?? 0) + delta * runSpeed;
  const run = assembly.chaser.userData.runCycle;

  const targetX = falling ? vehicle.carX - 0.75 : vehicle.carX - visualDistance;
  assembly.chaser.position.x = THREE.MathUtils.lerp(assembly.chaser.position.x, targetX, falling ? delta * 2.8 : delta * 4.8);
  const bounce = falling ? 0 : Math.sin(run) * (close ? 0.08 : 0.15);
  assembly.chaser.position.y = THREE.MathUtils.lerp(assembly.chaser.position.y, bounce, delta * 8);
  const targetZ = vehicle.carZ + Math.sin(run * 0.45) * (close ? 0.35 : 1.1 + danger * 0.45);
  assembly.chaser.position.z = THREE.MathUtils.lerp(assembly.chaser.position.z, targetZ, delta * (1.8 + danger));
  assembly.chaser.scale.setScalar(BASE_SCALE + danger * 0.05);
  assembly.chaser.rotation.z = THREE.MathUtils.lerp(assembly.chaser.rotation.z, -0.16 - danger * 0.08, delta * 5);

  const reach = close ? 1 : 0;
  assembly.torso.rotation.z = -0.04 + Math.sin(run * 0.9) * 0.05;
  assembly.head.rotation.z = Math.sin(run * 0.38) * 0.1 - reach * 0.06;
  assembly.head.position.x = THREE.MathUtils.lerp(assembly.head.position.x, reach ? 0.36 : 0.2, delta * 4);
  assembly.mouth.scale.y = THREE.MathUtils.lerp(assembly.mouth.scale.y, reach ? 1.6 : 1.18, delta * 5);

  assembly.armParts.forEach((arm, index) => {
    const sidePhase = index === 0 ? 0 : Math.PI;
    const swing = Math.sin(run * 1.25 + sidePhase) * (close ? 0.45 : 0.85);
    arm.root.rotation.x = THREE.MathUtils.lerp(arm.root.rotation.x, swing * 0.32 + (index === 0 ? -0.08 : 0.08), delta * 8);
    arm.root.rotation.z = THREE.MathUtils.lerp(arm.root.rotation.z, 0.74 + reach * 0.38 + swing * 0.12, delta * 7);
    arm.root.position.x = THREE.MathUtils.lerp(arm.root.position.x, reach ? 0.55 : 0.28, delta * 5);
    arm.root.position.y = THREE.MathUtils.lerp(arm.root.position.y, reach ? 2.4 : 2.34, delta * 5);

    const elbowBend = reach ? 1.05 + danger * 0.35 : 0.42 + Math.sin(run * 1.45 + sidePhase + 0.8) * 0.28;
    arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, elbowBend, delta * 8);
    arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, Math.sin(run * 0.9 + sidePhase) * 0.12, delta * 7);

    arm.wrist.rotation.z = THREE.MathUtils.lerp(arm.wrist.rotation.z, Math.sin(run * 2.1 + sidePhase) * 0.32 - reach * 0.18, delta * 9);
    arm.wrist.rotation.x = THREE.MathUtils.lerp(arm.wrist.rotation.x, reach ? -0.38 : 0, delta * 7);
    arm.hand.scale.set(
      THREE.MathUtils.lerp(arm.hand.scale.x, reach ? 1.75 : 1.35, delta * 8),
      THREE.MathUtils.lerp(arm.hand.scale.y, reach ? 0.82 : 0.72, delta * 8),
      THREE.MathUtils.lerp(arm.hand.scale.z, reach ? 1.12 : 1, delta * 8),
    );
  });
  assembly.legs.forEach((leg, index) => {
    const sidePhase = index === 0 ? 0 : Math.PI;
    leg.rotation.z = Math.sin(run * 1.35 + sidePhase) * (close ? 0.16 : 0.36);
  });

  for (const eye of assembly.eyes) {
    const material = eye.material as THREE.MeshBasicMaterial;
    material.color.set(danger > 0.72 ? 0xfff2a6 : 0xf8fbff);
  }
}
