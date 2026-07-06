import * as THREE from 'three';
import type { E20Pickup } from '../types';

function randomRoadZ(roadWidth: number) {
  const maxZ = roadWidth / 2 - 1.1;
  return THREE.MathUtils.randFloatSpread(maxZ * 2);
}

export function createPickupPool(count = 9, roadWidth = 10): E20Pickup[] {
  const pickups: E20Pickup[] = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPickupMesh();
    const pickup: E20Pickup = {
      x: 28 + i * 18,
      z: randomRoadZ(roadWidth),
      mesh,
      collected: false,
      fuelAmount: 25,
      degradationAmount: 8,
    };
    mesh.position.set(pickup.x, 1.05, pickup.z);
    pickups.push(pickup);
  }
  return pickups;
}

export function recyclePickups(pickups: E20Pickup[], carX: number, roadWidth = 10) {
  const farthest = Math.max(...pickups.map((pickup) => pickup.x), carX + 35);
  for (const pickup of pickups) {
    if (pickup.x < carX - 16 || pickup.collected) {
      pickup.x = farthest + 14 + Math.random() * 20;
      pickup.z = randomRoadZ(roadWidth);
      pickup.collected = false;
      pickup.mesh.visible = true;
      pickup.mesh.position.set(pickup.x, 1.05, pickup.z);
    }
  }
}

export function updatePickupVisuals(pickups: E20Pickup[], delta: number) {
  for (const pickup of pickups) {
    if (!pickup.mesh.visible) continue;
    pickup.mesh.rotation.y += delta * 1.35;
    pickup.mesh.position.y = 1.05 + Math.sin(performance.now() * 0.004 + pickup.x) * 0.1;
  }
}

export function collectTouchedPickups(pickups: E20Pickup[], carX: number, carZ: number, onCollect: (pickup: E20Pickup) => void) {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const dx = carX - pickup.x;
    const dz = carZ - pickup.z;
    if (Math.hypot(dx, dz) < 1.85) {
      pickup.collected = true;
      pickup.mesh.visible = false;
      onCollect(pickup);
    }
  }
}

function createPickupMesh() {
  const group = new THREE.Group();
  const canMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5, metalness: 0.25 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, roughness: 0.5, metalness: 0.12 });
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x042f2e });
  const labelMat = new THREE.MeshBasicMaterial({
    map: createE20LabelTexture(),
    transparent: true,
    side: THREE.DoubleSide,
  });
  const billboardMat = new THREE.SpriteMaterial({
    map: createE20BillboardTexture(),
    transparent: true,
    depthTest: true,
  });

  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.15, 24), canMat);
  can.rotation.z = Math.PI / 2;
  can.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), capMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 0.6;
  const rearCap = cap.clone();
  rearCap.position.x = -0.6;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.535, 0.535, 0.48, 24, 1, true), bandMat);
  band.rotation.z = Math.PI / 2;

  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.52), labelMat);
  label.position.set(0.02, 0.03, 0.555);
  const backLabel = label.clone();
  backLabel.position.z = -0.555;
  backLabel.rotation.y = Math.PI;

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0x7cff8a, transparent: true, opacity: 0.18 }),
  );
  glow.scale.set(1.3, 0.9, 0.9);

  const billboard = new THREE.Sprite(billboardMat);
  billboard.position.set(0, 1.02, 0);
  billboard.scale.set(1.95, 0.86, 1);

  group.add(glow, can, band, cap, rearCap, label, backLabel, billboard);
  group.scale.setScalar(1.25);
  return group;
}

function createE20LabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff8d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f5132';
  ctx.fillRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(34, 34, canvas.width - 68, canvas.height - 68);
  ctx.fillStyle = '#102a18';
  ctx.font = '900 118px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E20', canvas.width / 2, 112);
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('FUEL', canvas.width / 2, 188);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createE20BillboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(5, 46, 22, 0.92)';
  roundRect(ctx, 24, 34, 464, 176, 28);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.fillStyle = '#fff7c2';
  ctx.font = '900 104px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E20', 256, 104);
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillText('FUEL', 256, 168);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
