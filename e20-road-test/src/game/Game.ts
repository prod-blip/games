import * as THREE from 'three';
import { ENDLESS_TUNING } from './levels';
import type { ChaseState, ChaserAssembly, EndlessState, FeedbackEffects, InputState, Obstacle, E20Pickup, RoadAssembly } from './types';
import { createCarAssembly } from './objects/car';
import { createChaser, updateChaserVisuals } from './objects/chaser';
import { createWorld } from './objects/world';
import { collectTouchedPickups, recyclePickups, updatePickupVisuals } from './objects/pickups';
import { updateEndlessRoad } from './objects/road';
import { Hud } from './ui/Hud';
import { updateVehiclePhysics, type VehicleState } from './systems/vehiclePhysics';
import { emitImpactSparks, emitPickupBurst, updateCarVisuals, updateDust, updateFeedbackEffects } from './systems/updateCar';
import { createInitialChaseState, pullChaserCloser, pushChaserBack, updateChase, visualChaserDistance } from './systems/chase';
import { updateObstacleSpawning } from './systems/spawning';
import { createGameOverSequenceState, startGameOverSequence, updateGameOverSequence, type GameOverSequenceState } from './systems/gameOverSequence';
import { configureRenderer, createSceneLighting } from './scene/rendering';
import { EngineAudio } from './systems/audio';

export class Game {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  private lastTime = performance.now();
  private input: InputState = { accelerate: false, brakeReverse: false, steerUp: false, steerDown: false };

  private car = new THREE.Group();
  private bonnet!: THREE.Mesh;
  private bumper!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private wheelRims: THREE.Mesh[] = [];
  private parts: THREE.Object3D[] = [];
  private chaser!: ChaserAssembly;
  private obstacles: Obstacle[] = [];
  private pickups: E20Pickup[] = [];
  private road!: RoadAssembly;
  private dustParticles: THREE.Mesh[] = [];
  private feedbackEffects!: FeedbackEffects;
  private worldRoot?: THREE.Group;
  private cameraShake = 0;
  private engineAudio = new EngineAudio();

  private vehicle: VehicleState = {
    carX: 2,
    carY: 0.1,
    carZ: 0,
    zVelocity: 0,
    steer: 0,
    lateralGrip: ENDLESS_TUNING.lateralGrip,
    velocity: 0,
    fuel: 72,
    damage: 0,
    degradation: 0,
  };
  private endless: EndlessState = { distanceSurvived: 0, e20Collected: 0 };
  private chase: ChaseState = createInitialChaseState();
  private gameOverSequence: GameOverSequenceState = createGameOverSequenceState();

  private running = false;
  private started = false;
  private ended = false;
  private cinematic = new URLSearchParams(window.location.search).get('mode') === 'cinematic';
  private cinematicScenario = new URLSearchParams(window.location.search).get('scenario') ?? '';
  private cinematicTimer = 0;

  private hud!: Hud;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    configureRenderer(this.renderer);
    this.host.appendChild(this.renderer.domElement);

    this.hud = new Hud({
      host: this.host,
      onRetry: () => {
        this.started = true;
        this.engineAudio.ensureStarted();
        this.reset();
      },
    });
    this.started = true;
    this.setupScene();
    this.applyCinematicScenarioInitialState();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  dispose() {
    this.running = false;
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  private setupScene() {
    createSceneLighting(this.scene, ENDLESS_TUNING);
    this.camera.position.set(0, 7, 15);
    this.camera.lookAt(8, 0, 0);

    this.rebuildWorld();

    const carAssembly = createCarAssembly();
    this.car = carAssembly.car;
    this.bonnet = carAssembly.bonnet;
    this.bumper = carAssembly.bumper;
    this.wheels = carAssembly.wheels;
    this.wheelRims = carAssembly.wheelRims;
    this.parts = carAssembly.parts;
    this.scene.add(this.car);

    this.chaser = createChaser();
    this.scene.add(this.chaser.chaser);
  }

  private rebuildWorld() {
    if (this.worldRoot) {
      this.disposeObject(this.worldRoot);
      this.scene.remove(this.worldRoot);
    }
    const world = createWorld(this.scene, ENDLESS_TUNING);
    this.worldRoot = world.root;
    this.road = world.road;
    this.obstacles = world.obstacles;
    this.pickups = world.pickups;
    this.dustParticles = world.dustParticles;
    this.feedbackEffects = world.feedbackEffects;
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) material.dispose();
    });
  }

  private setupInput() {
    const setButton = (selector: string, key: keyof InputState) => {
      const button = this.host.querySelector<HTMLButtonElement>(selector);
      if (!button) return;
      const down = (event: Event) => {
        event.preventDefault();
        if (!this.gameOverSequence.active) {
          this.input[key] = true;
          this.hud.setControlPressed(key, true);
          this.engineAudio.ensureStarted();
        }
      };
      const up = (event: Event) => {
        event.preventDefault();
        this.input[key] = false;
        this.hud.setControlPressed(key, false);
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', up);
    };

    setButton('.left', 'brakeReverse');
    setButton('.up', 'steerUp');
    setButton('.down', 'steerDown');
    setButton('.right', 'accelerate');

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyR') {
        this.engineAudio.ensureStarted();
        this.reset();
      }
      if (this.gameOverSequence.active) return;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        this.input.accelerate = true;
        this.hud.setControlPressed('accelerate', true);
        this.engineAudio.ensureStarted();
      }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        this.input.steerUp = true;
        this.hud.setControlPressed('steerUp', true);
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        this.input.steerDown = true;
        this.hud.setControlPressed('steerDown', true);
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        this.input.brakeReverse = true;
        this.hud.setControlPressed('brakeReverse', true);
        this.engineAudio.ensureStarted();
      }
    });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        this.input.accelerate = false;
        this.hud.setControlPressed('accelerate', false);
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        this.input.brakeReverse = false;
        this.hud.setControlPressed('brakeReverse', false);
      }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        this.input.steerUp = false;
        this.hud.setControlPressed('steerUp', false);
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        this.input.steerDown = false;
        this.hud.setControlPressed('steerDown', false);
      }
    });
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.04);
    this.lastTime = now;
    this.update(delta);
    this.render(delta);
  };

  private update(delta: number) {
    if (!this.started) return;

    if (this.cinematicScenario) {
      this.cinematicTimer += delta;
      this.applyCinematicScenarioInput();
    }

    if (this.gameOverSequence.active) {
      this.input.accelerate = false;
      this.input.brakeReverse = false;
      this.input.steerUp = false;
      this.input.steerDown = false;
      this.hud.setControlPressed('accelerate', false);
      this.hud.setControlPressed('brakeReverse', false);
      this.hud.setControlPressed('steerUp', false);
      this.hud.setControlPressed('steerDown', false);
      this.engineAudio.stop();
      updateGameOverSequence(this.gameOverSequence, this.vehicle, this.car, this.chaser, delta);
      if (this.gameOverSequence.completed && !this.ended) this.end('E20 Road Test complete. Please collect your certificate of participation and one large garage bill.');
      return;
    }

    const previousX = this.vehicle.carX;
    const { frontGround, rearGround } = updateVehiclePhysics(
      this.vehicle,
      this.input,
      ENDLESS_TUNING,
      this.obstacles,
      delta,
      () => this.handleImpactVisual(),
    );

    this.endless.distanceSurvived += Math.max(0, this.vehicle.carX - previousX);
    updateEndlessRoad(this.road, this.vehicle.carX);
    if (this.worldRoot) updateObstacleSpawning(this.obstacles, this.vehicle.carX, ENDLESS_TUNING, this.worldRoot);
    recyclePickups(this.pickups, this.vehicle.carX, ENDLESS_TUNING.roadWidth);
    updatePickupVisuals(this.pickups, delta);
    collectTouchedPickups(this.pickups, this.vehicle.carX, this.vehicle.carZ, (pickup: E20Pickup) => this.collectE20(pickup));

    const caughtByChaser = updateChase(this.chase, this.vehicle, delta);
    this.engineAudio.update(this.input, this.vehicle);
    updateChaserVisuals(this.chaser, this.vehicle, this.chase, delta);

    updateCarVisuals({
      car: this.car,
      bonnet: this.bonnet,
      bumper: this.bumper,
      wheels: this.wheels,
      wheelRims: this.wheelRims,
      state: this.vehicle,
      input: this.input,
      level: ENDLESS_TUNING,
      delta,
      frontGround,
      rearGround,
    });
    updateDust(this.dustParticles, this.vehicle, this.input, delta);
    updateFeedbackEffects({ effects: this.feedbackEffects, state: this.vehicle, input: this.input, level: ENDLESS_TUNING, delta });
    this.hud.updateSurvival(this.endless, this.vehicle, this.chase);

    if (caughtByChaser) this.startCaughtSequence();
  }

  private collectE20(pickup: E20Pickup) {
    this.vehicle.fuel = THREE.MathUtils.clamp(this.vehicle.fuel + pickup.fuelAmount, 0, 100);
    this.vehicle.degradation = THREE.MathUtils.clamp(this.vehicle.degradation + pickup.degradationAmount, 0, 100);
    this.vehicle.velocity = Math.min(ENDLESS_TUNING.baseMaxSpeed, this.vehicle.velocity + 2.4);
    this.endless.e20Collected += 1;
    this.cameraShake = Math.min(0.75, this.cameraShake + 0.18);
    emitPickupBurst(this.feedbackEffects, this.vehicle);
    pushChaserBack(this.chase, 2.6);
    this.chase.stumbleTimer = 0.5;
    this.chase.velocity += 1.5;
    this.hud.flashImpact();
    this.hud.pulsePickup();
  }

  private handleImpactVisual() {
    this.car.rotation.z += this.vehicle.damage * 0.0007 * (this.vehicle.velocity >= 0 ? 1 : -1);
    this.cameraShake = Math.min(1.2, this.cameraShake + 0.36 + this.vehicle.damage * 0.002);
    this.vehicle.carY += 0.18;
    pullChaserCloser(this.chase, 3.6);
    this.chase.velocity -= 2.5;
    this.hud.flashImpact();
    emitImpactSparks(this.feedbackEffects, this.vehicle);
    this.popPartIfNeeded();
  }

  private popPartIfNeeded() {
    if (this.vehicle.damage < 28 || this.parts.length === 0) return;
    if (Math.random() > 0.35) return;
    const part = this.parts.shift();
    if (!part) return;
    const world = new THREE.Vector3();
    part.getWorldPosition(world);
    this.car.remove(part);
    this.scene.add(part);
    part.position.copy(world);
    part.rotation.set(Math.random(), Math.random(), Math.random());
  }

  private startCaughtSequence() {
    this.chase.caught = true;
    startGameOverSequence(this.gameOverSequence);
  }

  private applyCinematicScenarioInitialState() {
    if (!this.cinematicScenario) return;
    this.started = true;
    this.cinematicTimer = 0;

    if (this.cinematicScenario === 'chaser-behind') {
      this.vehicle.carX = 8;
      this.vehicle.velocity = 9;
      this.vehicle.fuel = 88;
      this.chase.distance = 3.8;
      this.chase.targetDistance = 3.9;
      this.chase.minCatchDistance = 0.8;
      this.chase.visualMinDistance = 3.5;
      this.chase.visualMaxDistance = 4.4;
    }

    if (this.cinematicScenario === 'chaser-jump') {
      this.vehicle.carX = 12;
      this.vehicle.velocity = 6;
      this.vehicle.fuel = 70;
      this.chase.distance = 3.4;
      this.chase.targetDistance = 2.7;
      this.chase.minCatchDistance = 1.2;
      this.chase.visualMinDistance = 3.4;
      this.chase.visualMaxDistance = 5;
    }

    if (this.cinematicScenario === 'chaser-zoom') {
      this.vehicle.carX = 9;
      this.vehicle.velocity = 5.5;
      this.vehicle.fuel = 84;
      this.chase.distance = 3.25;
      this.chase.targetDistance = 3.15;
      this.chase.minCatchDistance = 0.8;
      this.chase.visualMinDistance = 3;
      this.chase.visualMaxDistance = 3.8;
      this.chase.monsterPressure = 0.86;
    }
  }

  private applyCinematicScenarioInput() {
    if (this.cinematicScenario === 'chaser-behind') {
      this.input.accelerate = true;
      this.input.brakeReverse = false;
      this.input.steerUp = Math.sin(this.cinematicTimer * 1.4) > 0.6;
      this.input.steerDown = Math.sin(this.cinematicTimer * 1.4) < -0.6;
      this.chase.targetDistance = THREE.MathUtils.lerp(this.chase.targetDistance, 3.9, 0.035);
      this.chase.minCatchDistance = 0.8;
    }

    if (this.cinematicScenario === 'chaser-jump') {
      this.input.accelerate = this.cinematicTimer < 1.15;
      this.input.brakeReverse = false;
      this.input.steerUp = false;
      this.input.steerDown = false;
      if (this.cinematicTimer > 0.95 && !this.gameOverSequence.active) this.startCaughtSequence();
    }

    if (this.cinematicScenario === 'chaser-zoom') {
      this.input.accelerate = true;
      this.input.brakeReverse = false;
      this.input.steerUp = Math.sin(this.cinematicTimer * 1.8) > 0.7;
      this.input.steerDown = Math.sin(this.cinematicTimer * 1.8) < -0.7;
      this.chase.targetDistance = THREE.MathUtils.lerp(this.chase.targetDistance, 3.15, 0.04);
      this.chase.minCatchDistance = 0.8;
    }
  }

  private end(message: string) {
    if (this.ended) return;
    this.ended = true;
    this.hud.showEndState(`${message} Distance survived: ${Math.floor(this.endless.distanceSurvived)}m.`);
  }

  private reset() {
    this.vehicle.carX = 2;
    this.vehicle.carZ = 0;
    this.vehicle.zVelocity = 0;
    this.vehicle.steer = 0;
    this.vehicle.lateralGrip = ENDLESS_TUNING.lateralGrip;
    this.vehicle.velocity = 0;
    this.vehicle.fuel = 72;
    this.vehicle.damage = 0;
    this.vehicle.degradation = 0;
    this.endless = { distanceSurvived: 0, e20Collected: 0 };
    this.chase = createInitialChaseState();
    this.gameOverSequence = createGameOverSequenceState();
    this.ended = false;
    this.applyCinematicScenarioInitialState();
    this.hud.resetStatus();
    this.hud.setControlPressed('accelerate', false);
    this.hud.setControlPressed('brakeReverse', false);
    this.hud.setControlPressed('steerUp', false);
    this.hud.setControlPressed('steerDown', false);
    this.restoreCarParts();
    this.rebuildWorld();
    this.car.visible = true;
    this.car.scale.setScalar(1);
    this.car.rotation.set(0, 0, 0);
    this.car.position.set(this.vehicle.carX, 0.1, this.vehicle.carZ);
    this.chaser.chaser.rotation.set(0, 0, -0.06);
    this.chaser.chaser.scale.setScalar(1.05);
    this.chaser.torso.rotation.set(0, 0, 0);
    this.chaser.head.position.x = 0.2;
    this.chaser.head.rotation.set(0, 0, 0);
    this.chaser.mouth.scale.set(1, 1, 1);
    this.chaser.armParts.forEach((arm, index) => {
      const side = index === 0 ? -1 : 1;
      arm.root.position.set(0.28, 2.34, side * 0.68);
      arm.root.rotation.set(side * 0.14, 0, 0.72);
      arm.root.scale.set(1, 1, 1);
      arm.elbow.rotation.set(0, 0, 0.42);
      arm.wrist.rotation.set(0, 0, 0.1);
      arm.hand.scale.set(1.35, 0.72, 1);
    });
    this.chaser.legs.forEach((leg) => {
      leg.rotation.set(0, 0, 0);
    });
    this.chaser.chaser.position.set(this.vehicle.carX - visualChaserDistance(this.chase), 0, this.vehicle.carZ + 1.8);
    this.cameraShake = 0;
  }

  private restoreCarParts() {
    for (const part of [this.bonnet, this.bumper]) {
      if (!part) continue;
      if (part.parent !== this.car) {
        this.scene.remove(part);
        this.car.add(part);
      }
    }
    this.bonnet.position.set(1.05, 1.35, 0);
    this.bonnet.rotation.set(0, 0, 0);
    this.bumper.position.set(1.78, 0.68, 0);
    this.bumper.rotation.set(0, 0, 0);
    this.parts = [this.bonnet, this.bumper];
  }

  private render(delta: number) {
    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    const portrait = aspect < 0.85;
    const speedRatio = THREE.MathUtils.clamp(Math.abs(this.vehicle.velocity) / ENDLESS_TUNING.baseMaxSpeed, 0, 1);
    const damageRatio = THREE.MathUtils.clamp((this.vehicle.damage + this.vehicle.degradation) / 160, 0, 1);
    const danger = this.chase.monsterPressure;
    const showRear = danger * (portrait ? 1.4 : 3.4);
    const targetX = this.cinematicScenario === 'chaser-behind'
      ? this.vehicle.carX + (portrait ? 0.8 : 2.5)
      : this.vehicle.carX + (portrait ? 3.4 : 6.3) - showRear + speedRatio * (portrait ? 1.5 : 3.2);
    const cameraHeight = portrait ? 11.2 + damageRatio : this.cinematic ? 5.8 : 7.2 + damageRatio * 0.7;
    const cameraDistance = portrait ? 22 + damageRatio * 5 : 15.5 + damageRatio * 4 + danger * 1.5;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, 0.08 + speedRatio * 0.02);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, cameraHeight, 0.05);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, cameraDistance, 0.05);

    if (this.cinematicScenario === 'chaser-zoom') {
      const chaserPosition = this.chaser.chaser.position;
      const targetCameraX = chaserPosition.x + (portrait ? 1.1 : 1.6);
      const targetCameraY = chaserPosition.y + (portrait ? 3.55 : 3.25);
      const targetCameraZ = chaserPosition.z + (portrait ? 4.45 : 4.2);
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCameraX, 0.14);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCameraY, 0.12);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCameraZ, 0.12);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, portrait ? 25 : 29, delta * 3.4);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(chaserPosition.x + 0.28, chaserPosition.y + 2.65, chaserPosition.z + 0.03);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const targetFov = 46 + speedRatio * 5 - danger * 4 + damageRatio * 2;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 3.1);
    this.camera.updateProjectionMatrix();

    this.cameraShake = Math.max(0, this.cameraShake - delta * 2.2);
    const sequenceShake = this.gameOverSequence.active ? 0.16 : 0;
    const shakeScale = this.cameraShake * (0.08 + damageRatio * 0.08) + danger * 0.015 + sequenceShake;
    this.camera.position.x += (Math.random() - 0.5) * shakeScale;
    this.camera.position.y += (Math.random() - 0.5) * shakeScale * 0.8;
    const lookX = this.cinematicScenario === 'chaser-behind' ? this.vehicle.carX - 0.4 : this.vehicle.carX + 3 - danger * 2;
    this.camera.lookAt(lookX, this.cinematic ? 0.45 : 0.7, this.vehicle.carZ * 0.35);
    this.renderer.render(this.scene, this.camera);
  }

  private resize = () => {
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };
}
