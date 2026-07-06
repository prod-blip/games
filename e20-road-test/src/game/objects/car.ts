import * as THREE from 'three';
import type { CarAssembly } from '../types';

export function createCarAssembly(): CarAssembly {
  const car = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const wheelRims: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.5 });
  const bodyDarkMat = new THREE.MeshStandardMaterial({ color: 0xd99712, roughness: 0.58 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18171d, roughness: 0.75 });
  const farWheelMat = new THREE.MeshStandardMaterial({ color: 0x111016, roughness: 0.82 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x70c5ff, roughness: 0.18, metalness: 0.08 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1b21, roughness: 0.45 });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.35 });
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff });

  // Rounded/procedural body silhouette. Capsule is rotated to make a pill-shaped side profile.
  const carBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.2, 5, 20), bodyMat);
  carBody.rotation.z = Math.PI / 2;
  carBody.scale.set(1, 1, 1.15);
  carBody.position.y = 0.88;
  carBody.castShadow = true;

  const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.28, 1.5), bodyDarkMat);
  lowerSkirt.position.set(0, 0.62, 0);
  lowerSkirt.castShadow = true;

  const cabin = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.62, 4, 16), glassMat);
  cabin.rotation.z = Math.PI / 2;
  cabin.scale.z = 1.28;
  cabin.position.set(-0.2, 1.43, 0.03);
  cabin.castShadow = true;

  const windshieldFrame = new THREE.Group();
  const frameA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 1.34), frameMat);
  frameA.position.set(0.46, 1.43, 0.04);
  frameA.rotation.z = -0.18;
  const frameB = frameA.clone();
  frameB.position.x = -0.86;
  frameB.rotation.z = 0.18;
  const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 1.36), frameMat);
  roofFrame.position.set(-0.2, 1.88, 0.04);
  windshieldFrame.add(frameA, frameB, roofFrame);

  // Loose/damage-ready hood with hinge visible.
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 1.32), bodyMat);
  bonnet.position.set(1.03, 1.3, 0);
  bonnet.rotation.z = -0.05;
  bonnet.castShadow = true;
  const hoodHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.28, 10), frameMat);
  hoodHinge.rotation.x = Math.PI / 2;
  hoodHinge.position.set(0.48, 1.22, 0);

  // Hanging bumper: positioned slightly low and forward so later wobble reads as damage.
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 1.48), bumperMat);
  bumper.position.set(1.83, 0.54, 0);
  bumper.rotation.z = -0.04;
  bumper.castShadow = true;
  const bumperStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), frameMat);
  bumperStrap.position.set(1.68, 0.73, 0.58);

  const grillMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffd75a, emissiveIntensity: 0.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, emissive: 0x661111, emissiveIntensity: 0.35 });

  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.92), grillMat);
  grill.position.set(1.58, 0.9, 0);
  const headA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.32), lightMat);
  headA.position.set(1.66, 0.98, 0.48);
  const headB = headA.clone();
  headB.position.z = -0.48;
  const tailA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.34), tailMat);
  tailA.position.set(-1.61, 0.9, 0.48);
  const tailB = tailA.clone();
  tailB.position.z = -0.48;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.65), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  plate.position.set(1.69, 0.56, 0);

  // Cracked windshield marks on the visible side.
  const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.03), crackMat);
  crack1.position.set(-0.13, 1.45, 0.72);
  crack1.rotation.z = 0.55;
  const crack2 = crack1.clone();
  crack2.scale.y = 0.58;
  crack2.position.set(0.06, 1.5, 0.73);
  crack2.rotation.z = -0.7;
  const crack3 = crack1.clone();
  crack3.scale.y = 0.45;
  crack3.position.set(-0.28, 1.33, 0.73);
  crack3.rotation.z = 1.15;

  car.add(
    carBody,
    lowerSkirt,
    cabin,
    windshieldFrame,
    bonnet,
    hoodHinge,
    bumper,
    bumperStrap,
    grill,
    headA,
    headB,
    tailA,
    tailB,
    plate,
    crack1,
    crack2,
    crack3,
  );

  addWheelWells(car, frameMat);
  addAxlesAndSuspension(car, frameMat, bumperMat);
  createFourWheels(car, wheels, wheelRims, darkMat, farWheelMat, bumperMat);
  addExhaust(car, frameMat, bumperMat);

  car.position.set(2, 0.1, 0);

  return {
    car,
    carBody,
    bonnet,
    bumper,
    wheels,
    wheelRims,
    parts: [bonnet, bumper],
  };
}

function addWheelWells(car: THREE.Group, frameMat: THREE.Material) {
  const wellGeo = new THREE.TorusGeometry(0.49, 0.045, 8, 28);
  for (const x of [-1.05, 1.05]) {
    const well = new THREE.Mesh(wellGeo, frameMat);
    well.position.set(x, 0.47, 0.88);
    well.scale.y = 0.8;
    car.add(well);
  }
}

function addAxlesAndSuspension(car: THREE.Group, frameMat: THREE.Material, metalMat: THREE.Material) {
  for (const x of [-1.05, 1.05]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.7, 10), metalMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(x, 0.38, 0);

    const strutA = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.58, 0.06), frameMat);
    strutA.position.set(x - 0.18, 0.67, 0.68);
    strutA.rotation.z = -0.22;
    const strutB = strutA.clone();
    strutB.position.x = x + 0.18;
    strutB.rotation.z = 0.22;

    car.add(axle, strutA, strutB);
  }
}

function createFourWheels(
  car: THREE.Group,
  wheels: THREE.Mesh[],
  wheelRims: THREE.Mesh[],
  tireMat: THREE.Material,
  farTireMat: THREE.Material,
  rimMat: THREE.Material,
) {
  const wheelGeo = new THREE.TorusGeometry(0.36, 0.12, 14, 32);
  const farWheelGeo = new THREE.TorusGeometry(0.34, 0.1, 12, 28);
  const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.08, 20);

  for (const x of [-1.05, 1.05]) {
    for (const side of [-1, 1]) {
      const visibleSide = side === 1;
      const z = visibleSide ? 0.9 : -0.72;
      const wheel = new THREE.Mesh(visibleSide ? wheelGeo : farWheelGeo, visibleSide ? tireMat : farTireMat);
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 0.38, visibleSide ? 0.97 : -0.79);
      rim.scale.setScalar(visibleSide ? 1 : 0.8);
      rim.castShadow = true;

      car.add(wheel, rim);
      wheels.push(wheel);
      wheelRims.push(rim);
    }
  }
}

function addExhaust(car: THREE.Group, frameMat: THREE.Material, metalMat: THREE.Material) {
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.65, 12), metalMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-1.88, 0.48, -0.48);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), frameMat);
  tip.rotation.z = Math.PI / 2;
  tip.position.set(-2.22, 0.48, -0.48);
  car.add(exhaust, tip);
}
