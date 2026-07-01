import * as THREE from 'three';
import {
  BAIT_FLAGS,
  LAND_PARCELS,
  PLAYER_START,
  REGION_KIND_META,
  TOTAL_PARCELS
} from './data';

const MAP_BOUNDS = { minX: -8.4, maxX: 8.4, minZ: -5.2, maxZ: 5.2 };
const MAP_WIDTH = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
const MAP_DEPTH = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
const PLAYER_RADIUS = 0.34;
const WALK_SPEED = 4.25;
const BELLY_PULSE_SCALE = 1.55;
const TEMPTATION_GOLD = 0xffd23f;
const CLAIM_RED = 0x9a2f24;

function hexToNumber(color) {
  return Number.parseInt(color.replace('#', ''), 16);
}

function clampToMap(position) {
  position.x = THREE.MathUtils.clamp(position.x, MAP_BOUNDS.minX + PLAYER_RADIUS, MAP_BOUNDS.maxX - PLAYER_RADIUS);
  position.z = THREE.MathUtils.clamp(position.z, MAP_BOUNDS.minZ + PLAYER_RADIUS, MAP_BOUNDS.maxZ - PLAYER_RADIUS);
}

function makeTextSprite(text, options = {}) {
  const {
    fontSize = 34,
    color = '#fff6cf',
    background = 'rgba(0, 0, 0, 0.72)',
    padding = 12,
    scale = 0.52
  } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `800 ${fontSize}px Arial`;
  const width = Math.ceil(ctx.measureText(text).width + padding * 2);
  const height = Math.ceil(fontSize + padding * 2);
  canvas.width = width;
  canvas.height = height;
  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillStyle = background;
  ctx.roundRect(0, 0, width, height, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set((width / 100) * scale, (height / 100) * scale, 1);
  return sprite;
}

function makeFaceTexture(image) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, 245, 22, 205, 205, 0, 0, 256, 256);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSoilTexture(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = seed % 2 ? '#8b7847' : '#7c864f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 220; i += 1) {
    const shade = 70 + ((i * 29 + seed * 17) % 70);
    ctx.fillStyle = `rgba(${shade + 34}, ${shade + 20}, ${shade}, ${0.16 + ((i + seed) % 5) * 0.025})`;
    ctx.fillRect((i * 37 + seed * 11) % 128, (i * 23 + seed * 31) % 128, 1 + (i % 5), 1 + ((i + 2) % 4));
  }
  for (let i = 0; i < 12; i += 1) {
    ctx.strokeStyle = `rgba(42, 34, 18, ${0.13 + (i % 3) * 0.04})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((i * 19 + seed * 13) % 128, 0);
    ctx.lineTo((i * 19 + seed * 13 + 42) % 128, 128);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeParcelShape(parcel, index) {
  const shape = new THREE.Shape();
  const points = [];
  const sides = 7 + (index % 3);
  const baseRadius = 0.34 + parcel.acres * 0.012;
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 + index * 0.31;
    const wobble = 0.78 + (((i * 37 + index * 19) % 29) / 100);
    points.push(new THREE.Vector2(Math.cos(angle) * baseRadius * wobble * 1.25, Math.sin(angle) * baseRadius * wobble));
  }
  shape.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return { shape, points };
}

function makeGlowRing(radius, color = TEMPTATION_GOLD) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.035, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  return ring;
}

export class ThreeScamGame {
  constructor(container, { inputState, callbacks }) {
    this.container = container;
    this.inputState = inputState;
    this.callbacks = callbacks;
    this.landGrabbed = new Set();
    this.acresGrabbed = 0;
    this.baitAttempts = 0;
    this.playerPosition = new THREE.Vector3(PLAYER_START.x, PLAYER_START.y, PLAYER_START.z);
    this.playerVelocity = new THREE.Vector3();
    this.lastMoveDirection = new THREE.Vector3(0, 0, 1);
    this.lastFrameTime = performance.now();
    this.animationFrame = 0;
    this.bellyPulseId = 0;
    this.jump = null;
    this.corruption = null;
    this.cameraFocus = null;
    this.cameraShakeUntil = 0;
    this.cameraShakeAmount = 0;
    this.ended = false;
    this.isMobile = false;

    this.init();
  }

  async init() {
    try {
      this.setupThree();
      await this.loadAssets();
      this.createScene();
      this.callbacks.onUpdate?.(this.getStats());
      this.animate();
    } catch (error) {
      this.callbacks.onError?.(error);
    }
  }

  setupThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a100c);
    this.scene.fog = new THREE.Fog(0x0a100c, 18, 30);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 13, 11);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  loadAssets() {
    const loader = new THREE.ImageLoader();
    return new Promise((resolve, reject) => {
      loader.load('/assets/cm.webp', (image) => {
        this.faceTexture = makeFaceTexture(image);
        resolve();
      }, undefined, reject);
    });
  }

  createScene() {
    this.createLights();
    this.createTerrain();
    this.createMapDetails();
    this.createParcels();
    this.createFlags();
    this.createPlayer();
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffee, 0x384631, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1c8, 2.6);
    sun.position.set(-4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    this.scene.add(sun);
  }

  createTerrain() {
    const terrain = new THREE.Mesh(
      new THREE.BoxGeometry(MAP_WIDTH + 1.4, 0.34, MAP_DEPTH + 1.4),
      new THREE.MeshStandardMaterial({ color: 0x789456, roughness: 0.82 })
    );
    terrain.position.y = 0;
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const grid = new THREE.GridHelper(Math.max(MAP_WIDTH, MAP_DEPTH), 18, 0x9ab072, 0x556b44);
    grid.position.y = 0.19;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    this.scene.add(grid);

    const vacantPatch = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 40),
      new THREE.MeshStandardMaterial({ color: 0x8f7d55, roughness: 0.94, metalness: 0.02 })
    );
    vacantPatch.rotation.x = -Math.PI / 2;
    vacantPatch.position.set(PLAYER_START.x, 0.205, PLAYER_START.z);
    vacantPatch.receiveShadow = true;
    this.scene.add(vacantPatch);

    const patchRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 0.96, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b2f1f, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    );
    patchRing.rotation.x = -Math.PI / 2;
    patchRing.position.set(PLAYER_START.x, 0.215, PLAYER_START.z);
    this.scene.add(patchRing);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x172514, transparent: true, opacity: 0.28, roughness: 0.9 });
    [
      { x: 0, z: MAP_BOUNDS.minZ - 0.2, sx: MAP_WIDTH + 1.2, sz: 0.22 },
      { x: 0, z: MAP_BOUNDS.maxZ + 0.2, sx: MAP_WIDTH + 1.2, sz: 0.22 },
      { x: MAP_BOUNDS.minX - 0.2, z: 0, sx: 0.22, sz: MAP_DEPTH + 1.2 },
      { x: MAP_BOUNDS.maxX + 0.2, z: 0, sx: 0.22, sz: MAP_DEPTH + 1.2 }
    ].forEach(({ x, z, sx, sz }) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.8, sz), wallMaterial);
      wall.position.set(x, 0.45, z);
      wall.receiveShadow = true;
      this.scene.add(wall);
    });
  }

  createMapDetails() {
    [
      ['Bhopal', -0.35, -2.75],
      ['Indore', -4.9, 3.25],
      ['Jabalpur', 5.55, -2.3],
      ['Gwalior', -5.55, -4.2],
      ['Rewa', 7.2, -4.25],
      ['Satpura', 1.55, 4.35]
    ].forEach(([name, x, z]) => {
      const label = makeTextSprite(name, { fontSize: 24, background: 'rgba(0,0,0,0.58)', color: '#e9ffd4', scale: 0.32 });
      label.position.set(x, 0.55, z);
      this.scene.add(label);
    });

    [
      [-0.35, -2.75],
      [-4.9, 3.25],
      [5.55, -2.3],
      [-5.55, -4.2],
      [7.2, -4.25],
      [1.55, 4.35],
      [-0.15, -0.1],
      [3.75, 1.35]
    ].forEach(([x, z], clusterIndex) => {
      for (let i = 0; i < 5; i += 1) {
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.09 + i * 0.018, 0.08),
          new THREE.MeshStandardMaterial({ color: clusterIndex % 2 ? 0xd6c79b : 0xc2d0b1, roughness: 0.7 })
        );
        building.position.set(x + Math.cos(i * 1.7) * 0.18, 0.25 + building.geometry.parameters.height / 2, z + Math.sin(i * 1.7) * 0.16);
        building.castShadow = true;
        this.scene.add(building);
      }
    });
  }

  createParcels() {
    this.parcels = LAND_PARCELS.map((parcel, index) => {
      const meta = REGION_KIND_META[parcel.kind];
      const group = new THREE.Group();
      group.position.set(parcel.x, 0.26, parcel.z);

      const { shape, points } = makeParcelShape(parcel, index);
      const soilTexture = makeSoilTexture(index);
      const tractMaterial = new THREE.MeshStandardMaterial({
        color: meta.hex,
        map: soilTexture,
        roughness: 0.84,
        metalness: 0.02,
        emissive: meta.hex,
        emissiveIntensity: 0.015
      });
      const tract = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 }),
        tractMaterial
      );
      tract.rotation.x = -Math.PI / 2;
      tract.castShadow = true;
      tract.receiveShadow = true;
      group.add(tract);

      const borderPoints = points.map((point) => new THREE.Vector3(point.x, 0.1, point.y));
      borderPoints.push(borderPoints[0].clone());
      const border = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(borderPoints),
        new THREE.LineBasicMaterial({ color: 0x15130a, transparent: true, opacity: 0.78 })
      );
      group.add(border);

      for (let i = 0; i < points.length; i += 1) {
        const stone = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.08, 0.07),
          new THREE.MeshStandardMaterial({ color: 0xd8d2b7, roughness: 0.94 })
        );
        stone.position.set(points[i].x, 0.15, points[i].y);
        stone.rotation.y = i * 0.7;
        stone.castShadow = true;
        group.add(stone);

        const next = points[(i + 1) % points.length];
        if (i % 2 === 0) {
          const midX = (points[i].x + next.x) / 2;
          const midZ = (points[i].y + next.y) / 2;
          const length = Math.hypot(next.x - points[i].x, next.y - points[i].y);
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(length, 0.035, 0.035),
            new THREE.MeshStandardMaterial({ color: 0x3b2715, roughness: 0.86 })
          );
          rail.position.set(midX, 0.21, midZ);
          rail.rotation.y = -Math.atan2(next.y - points[i].y, next.x - points[i].x);
          rail.castShadow = true;
          group.add(rail);
        }
      }

      const surveyPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8),
        new THREE.MeshStandardMaterial({ color: 0xf7f1df, roughness: 0.5 })
      );
      surveyPole.position.set(points[1].x * 0.55, 0.36, points[1].y * 0.55);
      surveyPole.castShadow = true;
      group.add(surveyPole);

      const surveyFlag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xe8f4ff, side: THREE.DoubleSide, roughness: 0.4 })
      );
      surveyFlag.position.set(surveyPole.position.x + 0.1, 0.52, surveyPole.position.z);
      group.add(surveyFlag);

      const boardPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8),
        new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 0.8 })
      );
      boardPost.position.set(points[3].x * 0.7, 0.32, points[3].y * 0.7);
      group.add(boardPost);

      const board = makeTextSprite('PLOT', { fontSize: 20, color: '#16120b', background: 'rgba(236, 225, 176, 0.96)', scale: 0.24, padding: 8 });
      board.position.set(boardPost.position.x, 0.58, boardPost.position.z);
      group.add(board);

      const label = makeTextSprite(parcel.name, { fontSize: 28, scale: 0.42 });
      label.position.set(0, 0.72, 0);
      group.add(label);

      const acres = makeTextSprite(`${parcel.acres} acres`, { fontSize: 26, color: '#090909', background: meta.color, scale: 0.3 });
      acres.position.set(0, 0.42, 0);
      group.add(acres);

      const glowRing = makeGlowRing(0.56 + parcel.acres * 0.012);
      group.add(glowRing);

      this.scene.add(group);
      return { ...parcel, group, tract, tractMaterial, border, glowRing, active: true, claimed: false };
    });
  }

  createFlags() {
    this.flags = BAIT_FLAGS.map((flag) => {
      const group = new THREE.Group();
      group.position.set(flag.x, 0.28, flag.z);
      const flagColor = hexToNumber(flag.color);

      const objectiveRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 48),
        new THREE.MeshBasicMaterial({ color: flagColor, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
      );
      objectiveRing.rotation.x = -Math.PI / 2;
      objectiveRing.position.y = 0.02;
      group.add(objectiveRing);

      const objectiveDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 40),
        new THREE.MeshBasicMaterial({ color: flagColor, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
      );
      objectiveDisc.rotation.x = -Math.PI / 2;
      objectiveDisc.position.y = 0.015;
      group.add(objectiveDisc);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.16, 10),
        new THREE.MeshStandardMaterial({ color: 0xf7f1df, roughness: 0.45 })
      );
      pole.position.y = 0.58;
      pole.castShadow = true;
      group.add(pole);

      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.42),
        new THREE.MeshStandardMaterial({ color: flagColor, side: THREE.DoubleSide, roughness: 0.35, emissive: flagColor, emissiveIntensity: 0.22 })
      );
      cloth.position.set(0.38, 0.98, 0);
      cloth.rotation.y = -0.18;
      group.add(cloth);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.27, 0.12, 18),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55 })
      );
      base.castShadow = true;
      group.add(base);

      const label = makeTextSprite(flag.label, { fontSize: 34, background: 'rgba(3,14,10,0.9)', color: flag.color, scale: 0.5, padding: 14 });
      label.position.set(0.16, 1.5, 0);
      group.add(label);

      const goal = makeTextSprite('GOAL', { fontSize: 22, background: flag.color, color: '#061008', scale: 0.3, padding: 9 });
      goal.position.set(0.18, 1.22, 0);
      group.add(goal);

      this.scene.add(group);
      return { ...flag, group, objectiveRing, objectiveDisc, active: true };
    });
  }

  createPlayer() {
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);

    this.belly = new THREE.Mesh(
      new THREE.SphereGeometry(PLAYER_RADIUS, 40, 24),
      new THREE.MeshStandardMaterial({ color: 0xffcf3f, roughness: 0.42, metalness: 0.04, emissive: 0x6e3700, emissiveIntensity: 0.16 })
    );
    this.belly.castShadow = true;
    this.playerGroup.add(this.belly);

    const skin = new THREE.MeshStandardMaterial({ color: 0xd49b63, roughness: 0.55 });
    this.leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin);
    this.rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin);
    this.leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), skin);
    this.rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), skin);
    this.leftHand.position.set(-0.42, 0.02, 0.08);
    this.rightHand.position.set(0.42, 0.02, 0.08);
    this.leftFoot.position.set(-0.18, -0.32, 0.12);
    this.rightFoot.position.set(0.18, -0.32, 0.12);
    this.playerGroup.add(this.leftHand, this.rightHand, this.leftFoot, this.rightFoot);

    this.face = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.faceTexture, transparent: true }));
    this.face.position.set(-0.22, 0.48, 0.42);
    this.face.scale.set(0.68, 0.68, 1);
    this.playerGroup.add(this.face);
    this.syncPlayer();
  }

  animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.033);
    this.lastFrameTime = now;

    this.updatePlayer(delta);
    this.updateCorruption();
    this.updateJump();
    this.updateCamera(delta);
    this.updateCollectibles(delta);
    this.syncPlayer();
    this.renderer.render(this.scene, this.camera);
  };

  getInputVector() {
    const x = Number(this.inputState.right) - Number(this.inputState.left);
    const z = Number(this.inputState.down) - Number(this.inputState.up);
    const vector = new THREE.Vector3(x, 0, z);
    if (vector.lengthSq() > 0) {
      vector.normalize();
    }
    return vector;
  }

  setControl(name, isActive) {
    if (name in this.inputState) {
      this.inputState[name] = isActive;
    }
  }

  updatePlayer(delta) {
    if (this.jump || this.corruption || this.ended) {
      this.playerVelocity.set(0, 0, 0);
      return;
    }

    const desired = this.getInputVector().multiplyScalar(WALK_SPEED);
    this.playerVelocity.copy(desired);
    if (this.playerVelocity.length() > WALK_SPEED) {
      this.playerVelocity.setLength(WALK_SPEED);
    }

    this.playerPosition.addScaledVector(this.playerVelocity, delta);
    clampToMap(this.playerPosition);
    if (this.playerVelocity.lengthSq() > 0.002) {
      this.lastMoveDirection.copy(this.playerVelocity).normalize();
    }
  }

  syncPlayer() {
    const speed = this.playerVelocity.length();
    const walk = Math.min(speed / WALK_SPEED, 1);
    const t = performance.now() / 135;
    const bob = Math.abs(Math.sin(t)) * 0.08 * walk;

    this.playerGroup.position.set(this.playerPosition.x, this.playerPosition.y + bob, this.playerPosition.z);
    this.playerGroup.rotation.y = Math.atan2(this.lastMoveDirection.x, this.lastMoveDirection.z);
    this.face.quaternion.copy(this.camera.quaternion);
    this.leftHand.position.y = Math.sin(t) * 0.1 * walk;
    this.rightHand.position.y = Math.sin(t + Math.PI) * 0.1 * walk;
    this.leftFoot.position.z = 0.12 + Math.sin(t + Math.PI) * 0.12 * walk;
    this.rightFoot.position.z = 0.12 + Math.sin(t) * 0.12 * walk;
  }

  updateCamera(delta) {
    let lookAt = this.isMobile
      ? new THREE.Vector3(this.playerPosition.x, 0.1, this.playerPosition.z)
      : new THREE.Vector3(this.playerPosition.x * 0.06, 0.1, this.playerPosition.z * 0.06);
    let targetPosition = this.isMobile
      ? new THREE.Vector3(
        THREE.MathUtils.clamp(this.playerPosition.x, -5.6, 5.6),
        12.8,
        THREE.MathUtils.clamp(this.playerPosition.z + 8.4, 5.8, 13.2)
      )
      : new THREE.Vector3(
        THREE.MathUtils.clamp(this.playerPosition.x * 0.12, -1.2, 1.2),
        12.8,
        11.2
      );

    if (this.cameraFocus) {
      const t = Math.min((performance.now() - this.cameraFocus.startedAt) / this.cameraFocus.duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      const focusPoint = this.cameraFocus.from.clone().lerp(this.cameraFocus.to, eased);
      lookAt = focusPoint;
      targetPosition = this.isMobile
        ? new THREE.Vector3(
          THREE.MathUtils.clamp(focusPoint.x, -5.6, 5.6),
          11.2,
          THREE.MathUtils.clamp(focusPoint.z + 7.2, 5.8, 13.2)
        )
        : new THREE.Vector3(
          focusPoint.x * 0.26,
          9.4,
          8.2
        );
      if (t >= 1 && !this.jump) {
        this.cameraFocus = null;
      }
    } else if (this.jump) {
      lookAt = this.playerPosition.clone();
      targetPosition = this.isMobile
        ? new THREE.Vector3(
          THREE.MathUtils.clamp(this.playerPosition.x, -5.6, 5.6),
          11.8,
          THREE.MathUtils.clamp(this.playerPosition.z + 7.8, 5.8, 13.2)
        )
        : new THREE.Vector3(this.playerPosition.x * 0.22, 10.2, 8.9);
    }

    if (performance.now() < this.cameraShakeUntil) {
      const shake = this.cameraShakeAmount;
      targetPosition.x += (Math.random() - 0.5) * shake;
      targetPosition.y += (Math.random() - 0.5) * shake * 0.35;
      targetPosition.z += (Math.random() - 0.5) * shake;
    }

    this.camera.position.lerp(targetPosition, Math.min(delta * (this.cameraFocus ? 5 : 2), 1));
    this.camera.lookAt(lookAt);
  }

  updateCollectibles(delta) {
    if (this.ended) {
      return;
    }

    this.flags.forEach((flag) => {
      const pulse = 1 + Math.sin(performance.now() / 420) * 0.08;
      flag.group.rotation.y = Math.sin(performance.now() / 450) * 0.12;
      flag.objectiveRing.scale.setScalar(pulse);
      flag.objectiveRing.material.opacity = 0.36 + Math.sin(performance.now() / 420) * 0.12;
      flag.objectiveDisc.material.opacity = 0.13 + Math.sin(performance.now() / 520) * 0.04;
      const distance = Math.hypot(flag.x - this.playerPosition.x, flag.z - this.playerPosition.z);
      const now = performance.now();
      if (distance < 0.55 + PLAYER_RADIUS * 0.55 && now > (flag.cooldownUntil ?? 0)) {
        this.triggerFlagBait(flag);
      } else if (distance > 1.2) {
        flag.cooldownUntil = 0;
      }
    });
  }

  triggerFlagBait(flag) {
    if (this.jump || this.corruption || this.ended) {
      return;
    }
    const availableParcels = this.parcels.filter((item) => item.active);
    const parcel = availableParcels[Math.floor(Math.random() * availableParcels.length)];
    if (!parcel) {
      this.ended = true;
      this.callbacks.onUpdate?.(this.getStats());
      return;
    }
    this.baitAttempts += 1;
    flag.cooldownUntil = performance.now() + 1900;
    this.pulseFlag(flag);
    this.makeBurst(flag.x, flag.z, hexToNumber(flag.color));
    this.startCorruptionSequence(parcel, flag);
    this.callbacks.onUpdate?.(this.getStats());
  }

  startCorruptionSequence(parcel, flag) {
    this.playerVelocity.set(0, 0, 0);
    this.callbacks.onSound?.('flag');
    window.setTimeout(() => this.callbacks.onSound?.('magnet'), 120);
    window.setTimeout(() => this.callbacks.onSound?.('paper'), 260);
    this.highlightParcel(parcel);
    this.createPaperTrail(flag, parcel);
    this.cameraFocus = {
      from: new THREE.Vector3(flag.x, 0.2, flag.z),
      to: new THREE.Vector3(parcel.x, 0.25, parcel.z),
      startedAt: performance.now(),
      duration: 680
    };
    this.corruption = {
      parcel,
      flag,
      startedAt: performance.now(),
      duration: 680,
      direction: new THREE.Vector3(parcel.x - this.playerPosition.x, 0, parcel.z - this.playerPosition.z).normalize()
    };
  }

  updateCorruption() {
    if (!this.corruption) {
      return;
    }
    const elapsed = performance.now() - this.corruption.startedAt;
    const t = Math.min(elapsed / this.corruption.duration, 1);
    const wobble = Math.sin(t * Math.PI * 10) * Math.sin(t * Math.PI);
    const pull = this.corruption.direction;
    this.lastMoveDirection.copy(pull);
    this.belly.scale.set(1 + Math.abs(wobble) * 0.22, 1 - Math.abs(wobble) * 0.12, 1 + Math.abs(wobble) * 0.22);
    this.face.position.x = -0.22 + pull.x * 0.08 * Math.sin(t * Math.PI);
    this.leftHand.position.x = -0.42 - Math.sin(t * Math.PI) * 0.06;
    this.rightHand.position.x = 0.42 + Math.sin(t * Math.PI) * 0.06;
    this.corruption.parcel.glowRing.material.opacity = 0.3 + Math.abs(wobble) * 0.45;
    this.corruption.parcel.glowRing.scale.setScalar(1 + Math.sin(t * Math.PI * 4) * 0.12);
    if (t >= 1) {
      const { parcel, flag } = this.corruption;
      this.corruption = null;
      this.belly.scale.set(1, 1, 1);
      this.face.position.x = -0.22;
      this.leftHand.position.x = -0.42;
      this.rightHand.position.x = 0.42;
      this.callbacks.onSound?.('jump');
      this.startJumpToParcel(parcel, flag);
    }
  }

  startJumpToParcel(parcel, flag) {
    this.playerVelocity.set(0, 0, 0);
    this.jump = {
      parcel,
      flag,
      startedAt: performance.now(),
      duration: 720,
      start: this.playerPosition.clone(),
      target: new THREE.Vector3(parcel.x, PLAYER_START.y, parcel.z)
    };
  }

  updateJump() {
    if (!this.jump) {
      return;
    }
    const elapsed = performance.now() - this.jump.startedAt;
    const t = Math.min(elapsed / this.jump.duration, 1);
    const eased = 1 - (1 - t) ** 3;
    const arc = Math.sin(t * Math.PI) * 1.25;
    this.playerPosition.lerpVectors(this.jump.start, this.jump.target, eased);
    this.playerPosition.y = PLAYER_START.y + arc;
    const stretch = Math.sin(t * Math.PI);
    this.belly.scale.set(1 + stretch * 0.16, 1 + stretch * 0.26, 1 - stretch * 0.08);
    if (t >= 1) {
      const parcel = this.jump.parcel;
      const flag = this.jump.flag;
      this.playerPosition.copy(this.jump.target);
      this.jump = null;
      this.belly.scale.set(1, 1, 1);
      this.collectParcel(parcel, flag);
    }
  }

  collectParcel(parcel, flag) {
    if (!parcel.active) {
      return;
    }
    parcel.active = false;
    parcel.claimed = true;
    this.landGrabbed.add(parcel.id);
    this.acresGrabbed += parcel.acres;
    this.callbacks.onSound?.('stamp');
    this.shakeCamera(0.24, 240);
    this.pulseBelly();
    this.markParcelClaimed(parcel);
    this.makeBurst(parcel.x, parcel.z, TEMPTATION_GOLD, 28, 0.7);
    this.makeDust(parcel.x, parcel.z);
    this.ended = this.landGrabbed.size === TOTAL_PARCELS;
    window.setTimeout(() => this.callbacks.onSound?.(this.ended ? 'ending' : 'celebration'), 90);
    this.callbacks.onAllotment?.({
      acres: parcel.acres,
      region: parcel.name,
      totalAcres: this.acresGrabbed,
      flag: flag?.label
    });
    this.callbacks.onUpdate?.(this.getStats());
  }

  highlightParcel(parcel) {
    const originalEmissive = parcel.tractMaterial.emissive.clone();
    const originalIntensity = parcel.tractMaterial.emissiveIntensity;
    const startedAt = performance.now();
    const duration = 760;
    const tick = () => {
      if (!parcel.active) {
        parcel.glowRing.material.opacity = 0;
        return;
      }
      const t = Math.min((performance.now() - startedAt) / duration, 1);
      const pulse = Math.sin(t * Math.PI * 6) * (1 - t);
      parcel.tractMaterial.emissive.set(TEMPTATION_GOLD);
      parcel.tractMaterial.emissiveIntensity = 0.12 + Math.abs(pulse) * 0.3;
      parcel.glowRing.material.opacity = 0.22 + Math.abs(pulse) * 0.52;
      parcel.glowRing.scale.setScalar(1 + Math.abs(pulse) * 0.32);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        parcel.tractMaterial.emissive.copy(originalEmissive);
        parcel.tractMaterial.emissiveIntensity = originalIntensity;
        parcel.glowRing.material.opacity = 0;
        parcel.glowRing.scale.setScalar(1);
      }
    };
    tick();
  }

  createPaperTrail(flag, parcel) {
    const start = new THREE.Vector3(flag.x, 0.72, flag.z);
    const end = new THREE.Vector3(parcel.x, 0.82, parcel.z);
    for (let i = 0; i < 9; i += 1) {
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })
      );
      paper.position.copy(start);
      paper.rotation.set(Math.random() * 0.5, Math.random() * 0.8, Math.random() * 0.8);
      this.scene.add(paper);
      const offset = new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 0.35);
      const startedAt = performance.now() + i * 38;
      const duration = 520;
      const tick = () => {
        const t = Math.min(Math.max((performance.now() - startedAt) / duration, 0), 1);
        const eased = 1 - (1 - t) ** 3;
        paper.position.copy(start).lerp(end, eased).add(offset.clone().multiplyScalar(Math.sin(t * Math.PI)));
        paper.rotation.z += 0.12;
        paper.material.opacity = 0.92 * (1 - t);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          paper.geometry.dispose();
          paper.material.dispose();
          this.scene.remove(paper);
        }
      };
      tick();
    }
  }

  shakeCamera(amount, duration) {
    this.cameraShakeAmount = amount;
    this.cameraShakeUntil = performance.now() + duration;
  }

  pulseFlag(flag) {
    const startScale = flag.group.scale.clone();
    const startedAt = performance.now();
    const duration = 280;
    const tick = () => {
      const t = Math.min((performance.now() - startedAt) / duration, 1);
      const scale = 1 + Math.sin(t * Math.PI) * 0.22;
      flag.group.scale.copy(startScale).multiplyScalar(scale);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        flag.group.scale.copy(startScale);
      }
    };
    tick();
  }

  markParcelClaimed(parcel) {
    parcel.tractMaterial.color.set(CLAIM_RED);
    parcel.tractMaterial.emissive.set(0xffbe3d);
    parcel.tractMaterial.emissiveIntensity = 0.18;
    parcel.border.material.color.set(0xfff2a3);
    parcel.border.material.opacity = 1;
    parcel.glowRing.material.color.set(0xfff2a3);
    parcel.glowRing.material.opacity = 0.52;

    const stamp = makeTextSprite('ALLOTTED', {
      fontSize: 30,
      color: '#090909',
      background: 'rgba(255, 222, 62, 0.96)',
      scale: 0.4
    });
    stamp.position.set(0, 1.04, 0);
    stamp.material.rotation = -0.12;
    parcel.group.add(stamp);

    const startScale = parcel.group.scale.clone();
    const stampStartScale = stamp.scale.clone();
    const startedAt = performance.now();
    const duration = 340;
    const tick = () => {
      const t = Math.min((performance.now() - startedAt) / duration, 1);
      const scale = 1 + Math.sin(t * Math.PI) * 0.26;
      parcel.group.scale.copy(startScale).multiplyScalar(scale);
      stamp.scale.copy(stampStartScale).multiplyScalar(1 + Math.sin(t * Math.PI) * 0.42);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        parcel.group.scale.copy(startScale);
        stamp.scale.copy(stampStartScale);
      }
    };
    tick();
  }

  pulseBelly() {
    const pulseId = this.bellyPulseId + 1;
    this.bellyPulseId = pulseId;
    const startedAt = performance.now();
    const duration = 520;
    const tick = () => {
      if (pulseId !== this.bellyPulseId) {
        return;
      }
      const t = Math.min((performance.now() - startedAt) / duration, 1);
      const scale = 1 + Math.sin(t * Math.PI) * (BELLY_PULSE_SCALE - 1);
      this.belly.scale.set(scale * 1.08, scale, scale * 1.08);
      this.face.position.y = 0.48 * scale;
      this.leftHand.position.x = -0.48 * scale;
      this.rightHand.position.x = 0.48 * scale;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.belly.scale.set(1, 1, 1);
        this.face.position.y = 0.48;
        this.leftHand.position.x = -0.48;
        this.rightHand.position.x = 0.48;
      }
    };
    tick();
  }

  makeBurst(x, z, color, count = 18, spread = 0.55) {
    for (let i = 0; i < count; i += 1) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      dot.position.set(x, 0.55, z);
      this.scene.add(dot);
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.4 + Math.random() * spread;
      const target = new THREE.Vector3(x + Math.cos(angle) * distance, 0.7 + Math.random() * 0.5, z + Math.sin(angle) * distance);
      const start = dot.position.clone();
      const startedAt = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - startedAt) / 420, 1);
        dot.position.lerpVectors(start, target, t);
        dot.material.opacity = 1 - t;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          dot.geometry.dispose();
          dot.material.dispose();
          this.scene.remove(dot);
        }
      };
      tick();
    }
  }

  makeDust(x, z) {
    for (let i = 0; i < 22; i += 1) {
      const dust = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 + Math.random() * 0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xb69b67, transparent: true, opacity: 0.52, depthWrite: false })
      );
      dust.position.set(x, 0.34, z);
      this.scene.add(dust);
      const angle = Math.random() * Math.PI * 2;
      const target = new THREE.Vector3(x + Math.cos(angle) * (0.45 + Math.random() * 0.75), 0.38 + Math.random() * 0.22, z + Math.sin(angle) * (0.45 + Math.random() * 0.75));
      const start = dust.position.clone();
      const startedAt = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - startedAt) / 620, 1);
        dust.position.lerpVectors(start, target, t);
        dust.material.opacity = 0.52 * (1 - t);
        dust.scale.setScalar(1 + t * 1.8);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          dust.geometry.dispose();
          dust.material.dispose();
          this.scene.remove(dust);
        }
      };
      tick();
    }
  }

  getStats() {
    const complete = this.landGrabbed.size === TOTAL_PARCELS;
    return {
      acresGrabbed: this.acresGrabbed,
      landParcelsGrabbed: this.landGrabbed.size,
      totalParcels: TOTAL_PARCELS,
      baitAttempts: this.baitAttempts,
      complete,
      endingText: complete ? this.getEndingText() : ''
    };
  }

  getEndingText() {
    return "It's not CM Saab's fault. It's ours!!";
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.isMobile = width < 720;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.35 : 2));
    this.camera.aspect = width / height;
    this.camera.fov = this.isMobile ? 46 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  reset() {
    this.dispose();
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
