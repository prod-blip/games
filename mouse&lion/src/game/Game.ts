import * as THREE from 'three';
import { AudioDirector } from './audio/AudioDirector';
import { getCinematicConfig } from './cinematic';
import { InputController } from './input';
import {
  ForestGround,
  LION_CLEARING_X,
  LION_CLEARING_Z,
  TRAPPED_LION_CLEARING_X,
  TRAPPED_LION_CLEARING_Z,
} from './objects/ForestGround';
import { MouseMarker } from './objects/MouseMarker';
import { QuestMarker } from './objects/QuestMarker';
import { SleepingLion } from './objects/SleepingLion';
import { StarrySky } from './objects/StarrySky';
import { TrappedLion } from './objects/TrappedLion';
import { resizeRendererToDisplaySize } from './responsive';
import { createRenderer, addDefaultLighting } from './scene/rendering';
import type { GameState, InputState } from './types';
import { Hud } from './ui/Hud';

const NEUTRAL_INPUT: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  action: false,
  moveX: 0,
  moveY: 0,
  pointerX: 0,
  pointerY: 0,
};

const CHEW_INPUT: InputState = {
  ...NEUTRAL_INPUT,
  action: true,
};

export class Game {
  private readonly parent: HTMLElement;
  private readonly renderer = createRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 120);
  private readonly clock = new THREE.Clock();
  private readonly input: InputController;
  private readonly hud: Hud;
  private readonly forest = new ForestGround();
  private readonly mouse = new MouseMarker();
  private readonly lion = new SleepingLion();
  private readonly trappedLion = new TrappedLion();
  private readonly lionMarker = new QuestMarker();
  private readonly sky = new StarrySky();
  private readonly audio = new AudioDirector();
  private readonly lighting: ReturnType<typeof addDefaultLighting>;
  private animationId = 0;
  private distance = 0;
  private controlsEnabled = false;
  private lionEncounterTriggered = false;
  private trappedLionEncounterTriggered = false;
  private activeObjective: THREE.Object3D | null = null;
  private objectiveLabel = 'Sleeping lion';
  private sequenceTarget: THREE.Object3D | null = null;
  private objectiveFacingTime = 0;
  private rescueActive = false;
  private rescueElapsed = 0;
  private readonly rescueDuration = 5.2;
  private readonly rescueTarget = new THREE.Vector3();
  private readonly mousePleaTarget = new THREE.Vector3();
  private mousePleaActive = false;
  private dayTransitionActive = false;
  private dayTransitionElapsed = 0;
  private readonly dayTransitionDuration = 11;
  private readonly nightFogColor = new THREE.Color(0x090a24);
  private readonly dayFogColor = new THREE.Color(0x86b2b8);
  private readonly nightAmbientColor = new THREE.Color(0x7184d8);
  private readonly dayAmbientColor = new THREE.Color(0xbfe4ff);
  private readonly nightGroundColor = new THREE.Color(0x07130b);
  private readonly dayGroundColor = new THREE.Color(0x355d2c);
  private readonly nightKeyColor = new THREE.Color(0xb9c7ff);
  private readonly dayKeyColor = new THREE.Color(0xffe3ad);
  private readonly nightFillColor = new THREE.Color(0x7657b7);
  private readonly dayFillColor = new THREE.Color(0x8bc5d8);
  private readonly nightKeyPosition = new THREE.Vector3(-5, 9, 4);
  private readonly dayKeyPosition = new THREE.Vector3(7, 12, 3);
  private readonly sequenceMidpoint = new THREE.Vector3();
  private readonly sequenceDirection = new THREE.Vector3();
  private readonly sequenceSide = new THREE.Vector3();
  private readonly sequenceCameraPosition = new THREE.Vector3();
  private readonly trappedCameraForward = new THREE.Vector3();
  private readonly trappedCameraSide = new THREE.Vector3();
  private readonly trappedCameraLook = new THREE.Vector3();
  private sequenceCameraSnap = false;
  private lionEncounterHandler: (() => void) | null = null;
  private trappedLionEncounterHandler: (() => void) | null = null;
  private explorationThoughtHandler: ((text: string | null) => void) | null = null;
  private explorationElapsed = 0;
  private explorationThoughtIndex = 0;
  private readonly explorationThoughts = [
    { at: 12, text: 'The forest feels endless… but adventure waits ahead.' },
    { at: 27, text: 'Was that a deep rumble beyond the trees?' },
    { at: 45, text: 'I should follow the golden marker. Something is waiting for me.' },
  ];
  private rescueExplorationElapsed = 0;
  private rescueExplorationThoughtIndex = 0;
  private rescueSearchStartDistance = 1;
  private rescueSearchBeatTriggered = false;
  private rescueSearchBeatHandler: (() => void) | null = null;
  private readonly rescueExplorationThoughts = [
    { at: 12, text: 'The forest looks so different in the morning light.' },
    { at: 28, text: 'That roar came from somewhere much deeper in the jungle.' },
    { at: 46, text: 'Do not worry, Lion. Your little friend is coming!' },
  ];
  private readonly lionEncounterRadius = 3.25;
  private readonly lionCollisionRadius = 2.05;
  private storyCameraActive = false;
  private storyCameraElapsed = 0;
  private readonly storyCameraDuration = 6.5;
  private readonly storyCameraStart = new THREE.Vector3();
  private readonly storyCameraEnd = new THREE.Vector3();
  private readonly storyLookStart = new THREE.Vector3();
  private readonly storyLookEnd = new THREE.Vector3();
  private readonly storyLookCurrent = new THREE.Vector3();
  private readonly cinematicConfig = getCinematicConfig();

  private readonly state: GameState = {
    status: 'ready',
    score: 0,
    elapsed: 0,
    cinematic: false,
    scenario: 'default',
  };

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.state.cinematic = this.cinematicConfig.enabled;
    this.state.scenario = this.cinematicConfig.scenario;

    this.parent.classList.add('game-root');
    this.parent.appendChild(this.renderer.domElement);

    this.input = new InputController(this.renderer.domElement);
    this.hud = new Hud(this.parent);

    this.scene.background = new THREE.Color(0x030316);
    this.scene.fog = new THREE.Fog(0x090a24, 18, 54);
    this.lighting = addDefaultLighting(this.scene);

    this.scene.add(this.sky.group);
    this.scene.add(this.forest.group);
    this.scene.add(this.mouse.group);
    this.lion.group.position.set(LION_CLEARING_X, 0, LION_CLEARING_Z);
    this.lion.group.rotation.y = Math.PI / 2;
    this.scene.add(this.lion.group);
    this.trappedLion.group.position.set(TRAPPED_LION_CLEARING_X, 0, TRAPPED_LION_CLEARING_Z);
    this.trappedLion.group.rotation.y = -Math.PI / 5;
    this.trappedLion.group.visible = false;
    this.scene.add(this.trappedLion.group);
    this.activeObjective = this.lion.group;
    this.lionMarker.group.position.set(this.lion.group.position.x, 0, this.lion.group.position.z);
    this.lionMarker.setVisible(false);
    this.scene.add(this.lionMarker.group);

    this.camera.position.set(0, 5.8, 8.2);
    this.camera.lookAt(0, 0.15, -7);

    this.applyCinematicScenario();
  }

  async prepare(onProgress: (progress: number, stage: string) => void): Promise<void> {
    onProgress(0.08, 'Growing the forest');
    resizeRendererToDisplaySize(this.renderer, this.camera);
    this.sky.update(0, this.camera);
    this.renderer.render(this.scene, this.camera);

    onProgress(0.28, 'Lighting the stars');
    this.trappedLion.group.visible = true;
    await this.renderer.compileAsync(this.scene, this.camera);
    this.trappedLion.group.visible = false;

    onProgress(0.82, 'Waking the forest');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.renderer.render(this.scene, this.camera);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    onProgress(1, 'Ready');
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  beginStoryIntro(): void {
    const mousePosition = this.mouse.group.position;
    this.controlsEnabled = false;
    this.input.setMovementEnabled(false);
    this.state.status = 'ready';
    this.hud.setVisible(false);
    this.hud.setObjectiveVisible(false);
    this.lionMarker.setVisible(false);
    this.mouse.setScriptedFacing(Math.PI * 0.62);
    this.storyCameraElapsed = 0;
    this.storyCameraActive = true;
    this.storyCameraStart.set(mousePosition.x + 7.2, mousePosition.y + 9.2, mousePosition.z + 15.5);
    this.storyCameraEnd.set(mousePosition.x, mousePosition.y + 5.8, mousePosition.z + 8.2);
    this.storyLookStart.set(mousePosition.x, mousePosition.y + 0.8, mousePosition.z);
    this.storyLookEnd.set(mousePosition.x, 0.18, mousePosition.z - 6.5);
    this.camera.position.copy(this.storyCameraStart);
    this.camera.lookAt(this.storyLookStart);
  }

  turnMouseTowardForest(): void {
    this.mouse.setScriptedFacing(0);
  }

  revealHud(): void {
    this.hud.setVisible(true);
  }

  enablePlayerControl(): void {
    this.controlsEnabled = true;
    this.input.setMovementEnabled(true);
    this.state.status = 'playing';
    this.mouse.setScriptedFacing(null);
    if (this.activeObjective) {
      this.hud.setObjectiveVisible(true);
      this.lionMarker.setVisible(true);
    }
  }

  enableAudio(): void {
    void this.audio.start();
  }

  setLionEncounterHandler(handler: () => void): void {
    this.lionEncounterHandler = handler;
  }

  setTrappedLionEncounterHandler(handler: () => void): void {
    this.trappedLionEncounterHandler = handler;
  }

  setExplorationThoughtHandler(handler: (text: string | null) => void): void {
    this.explorationThoughtHandler = handler;
  }

  setRescueSearchBeatHandler(handler: () => void): void {
    this.rescueSearchBeatHandler = handler;
  }

  wakeLion(): void {
    this.lion.wake();
    this.audio.playWakeAndRoar();
  }

  laughLion(): void {
    this.lion.laugh();
    this.audio.playLionLaugh();
  }

  startMousePlea(): void {
    const awayX = this.mouse.group.position.x - this.lion.group.position.x;
    const awayZ = this.mouse.group.position.z - this.lion.group.position.z;
    const distance = Math.max(0.001, Math.hypot(awayX, awayZ));
    this.mousePleaTarget.copy(this.mouse.group.position);
    this.mousePleaTarget.x += (awayX / distance) * 0.65;
    this.mousePleaTarget.z += (awayZ / distance) * 0.65;
    this.mousePleaActive = true;
    this.mouse.setTrembling(true);
  }

  endMousePlea(): void {
    this.mousePleaActive = false;
    this.mouse.setTrembling(false);
  }

  sendLionAway(): void {
    this.lion.leave();
    this.audio.startLionWalk();
  }

  completeLionEncounter(): void {
    this.audio.stopLionWalk();
    this.sequenceTarget = null;
    this.trappedLion.group.visible = true;
    this.activeObjective = this.trappedLion.group;
    this.objectiveLabel = 'Trapped lion';
    this.rescueSearchStartDistance = Math.max(
      1,
      Math.hypot(
        this.trappedLion.group.position.x - this.mouse.group.position.x,
        this.trappedLion.group.position.z - this.mouse.group.position.z,
      ),
    );
    this.lionMarker.group.position.set(
      this.trappedLion.group.position.x,
      0,
      this.trappedLion.group.position.z,
    );
    this.lionMarker.setVisible(true);
    this.hud.setObjectiveVisible(true);
    const dx = this.trappedLion.group.position.x - this.mouse.group.position.x;
    const dz = this.trappedLion.group.position.z - this.mouse.group.position.z;
    this.mouse.setScriptedFacing(Math.atan2(-dx, -dz));
    this.objectiveFacingTime = 1.2;
    this.controlsEnabled = true;
    this.input.setMovementEnabled(true);
    this.state.status = 'playing';
    this.dayTransitionActive = true;
    this.dayTransitionElapsed = 0;
  }

  calmTrappedLion(): void {
    this.trappedLion.calm();
  }

  playTrappedLionVoice(): void {
    this.audio.playTrappedStruggle();
  }

  startNetRescue(): void {
    this.rescueActive = true;
    this.rescueElapsed = 0;
    this.trappedLion.calm();
    this.trappedLion.group.updateMatrixWorld(true);
    this.rescueTarget.set(-1.45, 0.02, -0.82).applyMatrix4(this.trappedLion.group.matrixWorld);
    const dx = this.trappedLion.group.position.x - this.mouse.group.position.x;
    const dz = this.trappedLion.group.position.z - this.mouse.group.position.z;
    this.mouse.setScriptedFacing(Math.atan2(-dx, -dz));
  }

  finishNetRescue(): void {
    this.rescueActive = false;
    this.trappedLion.setChewProgress(1);
    this.trappedLion.releaseNet();
    this.audio.playNetRelease();
  }

  playStoryAdvanceSound(): void {
    this.audio.playStoryAdvance();
  }

  playEndingSound(): void {
    this.audio.playEndingSting();
  }

  endStory(): void {
    this.activeObjective = null;
    this.controlsEnabled = false;
    this.input.setMovementEnabled(false);
    this.state.status = 'gameover';
    this.trappedLion.calm();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.input.dispose();
    this.hud.dispose();
    this.forest.dispose();
    this.mouse.dispose();
    this.lion.dispose();
    this.trappedLion.dispose();
    this.lionMarker.dispose();
    this.sky.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  private tick = (): void => {
    this.animationId = requestAnimationFrame(this.tick);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    resizeRendererToDisplaySize(this.renderer, this.camera);

    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number): void {
    this.state.elapsed += delta;

    const previousX = this.mouse.group.position.x;
    const previousZ = this.mouse.group.position.z;
    const activeInput = this.controlsEnabled ? this.input.state : this.rescueActive ? CHEW_INPUT : NEUTRAL_INPUT;
    this.mouse.update(delta, activeInput, this.state.cinematic && this.controlsEnabled);
    if (this.mousePleaActive) {
      const recoil = 1 - Math.exp(-delta * 5.5);
      this.mouse.group.position.x = THREE.MathUtils.lerp(this.mouse.group.position.x, this.mousePleaTarget.x, recoil);
      this.mouse.group.position.z = THREE.MathUtils.lerp(this.mouse.group.position.z, this.mousePleaTarget.z, recoil);
    }
    if (this.rescueActive) this.updateNetRescue(delta);
    this.resolveLionCollision(previousX, previousZ);
    if (!this.rescueActive) this.resolveTrappedLionCollision(previousX, previousZ);
    const traveled = Math.hypot(
      this.mouse.group.position.x - previousX,
      this.mouse.group.position.z - previousZ,
    );
    this.forest.update(this.mouse.group.position, delta);
    this.lion.update(delta);
    if (this.trappedLion.group.visible) this.trappedLion.update(delta);
    this.lionMarker.update(delta);
    this.checkActiveEncounter();
    if (this.objectiveFacingTime > 0) {
      this.objectiveFacingTime -= delta;
      if (this.objectiveFacingTime <= 0) this.mouse.setScriptedFacing(null);
    }

    this.distance += traveled;
    this.audio.update(delta, traveled, this.rescueActive);
    this.updateExplorationThoughts(delta);
    this.updateDayTransition(delta);
    this.state.score = this.distance;
    this.updateCamera(delta);
    this.sky.update(delta, this.camera);
    if (this.activeObjective) {
      this.hud.updateObjective(this.mouse.group.position, this.activeObjective.position, this.objectiveLabel);
    }
  }

  private checkActiveEncounter(): void {
    if (!this.controlsEnabled || !this.activeObjective) return;

    if (this.activeObjective === this.lion.group && !this.lionEncounterTriggered) {
      this.triggerLionEncounter();
    } else if (this.activeObjective === this.trappedLion.group && !this.trappedLionEncounterTriggered) {
      this.triggerTrappedLionEncounter();
    }
  }

  private updateExplorationThoughts(delta: number): void {
    if (!this.controlsEnabled) return;

    if (!this.lionEncounterTriggered && this.activeObjective === this.lion.group) {
      this.explorationElapsed += delta;
      const nextThought = this.explorationThoughts[this.explorationThoughtIndex];
      if (!nextThought || this.explorationElapsed < nextThought.at) return;
      this.explorationThoughtIndex += 1;
      this.explorationThoughtHandler?.(nextThought.text);
      return;
    }

    if (!this.trappedLionEncounterTriggered && this.activeObjective === this.trappedLion.group) {
      this.rescueExplorationElapsed += delta;
      const currentDistance = Math.hypot(
        this.trappedLion.group.position.x - this.mouse.group.position.x,
        this.trappedLion.group.position.z - this.mouse.group.position.z,
      );
      const searchProgress = 1 - currentDistance / this.rescueSearchStartDistance;
      if (!this.rescueSearchBeatTriggered && searchProgress >= 0.45) {
        this.rescueSearchBeatTriggered = true;
        this.audio.playDistantLionRoar();
        this.rescueSearchBeatHandler?.();
      }
      const nextThought = this.rescueExplorationThoughts[this.rescueExplorationThoughtIndex];
      if (!nextThought || this.rescueExplorationElapsed < nextThought.at) return;
      this.rescueExplorationThoughtIndex += 1;
      this.explorationThoughtHandler?.(nextThought.text);
    }
  }

  private updateDayTransition(delta: number): void {
    if (!this.dayTransitionActive) return;
    this.dayTransitionElapsed = Math.min(this.dayTransitionDuration, this.dayTransitionElapsed + delta);
    const linearProgress = this.dayTransitionElapsed / this.dayTransitionDuration;
    const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);
    this.sky.setDaylight(progress);

    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.copy(this.nightFogColor).lerp(this.dayFogColor, progress);
      fog.near = THREE.MathUtils.lerp(18, 22, progress);
      fog.far = THREE.MathUtils.lerp(54, 66, progress);
    }

    this.lighting.ambient.color.copy(this.nightAmbientColor).lerp(this.dayAmbientColor, progress);
    this.lighting.ambient.groundColor.copy(this.nightGroundColor).lerp(this.dayGroundColor, progress);
    this.lighting.ambient.intensity = THREE.MathUtils.lerp(1.25, 1.65, progress);
    this.lighting.key.color.copy(this.nightKeyColor).lerp(this.dayKeyColor, progress);
    this.lighting.key.intensity = THREE.MathUtils.lerp(1.85, 2.4, progress);
    this.lighting.key.position.lerpVectors(this.nightKeyPosition, this.dayKeyPosition, progress);
    this.lighting.fill.color.copy(this.nightFillColor).lerp(this.dayFillColor, progress);
    this.lighting.fill.intensity = THREE.MathUtils.lerp(0.45, 0.7, progress);

    if (linearProgress >= 1) this.dayTransitionActive = false;
  }

  private triggerLionEncounter(): void {
    const dx = this.lion.group.position.x - this.mouse.group.position.x;
    const dz = this.lion.group.position.z - this.mouse.group.position.z;
    if (Math.hypot(dx, dz) > this.lionEncounterRadius) return;

    this.stageFirstLionConversation();
    this.explorationThoughtHandler?.(null);
    this.lionEncounterTriggered = true;
    this.activeObjective = null;
    this.sequenceTarget = this.lion.group;
    this.sequenceCameraSnap = true;
    this.controlsEnabled = false;
    this.input.setMovementEnabled(false);
    this.state.status = 'paused';
    this.hud.setObjectiveVisible(false);
    this.lionMarker.setVisible(false);
    this.lionEncounterHandler?.();
  }

  private triggerTrappedLionEncounter(): void {
    const dx = this.trappedLion.group.position.x - this.mouse.group.position.x;
    const dz = this.trappedLion.group.position.z - this.mouse.group.position.z;
    if (Math.hypot(dx, dz) > this.lionEncounterRadius) return;

    this.stageTrappedLionConversation();
    this.trappedLionEncounterTriggered = true;
    this.explorationThoughtHandler?.(null);
    this.activeObjective = null;
    this.sequenceTarget = this.trappedLion.group;
    this.sequenceCameraSnap = true;
    this.controlsEnabled = false;
    this.input.setMovementEnabled(false);
    this.state.status = 'paused';
    this.hud.setObjectiveVisible(false);
    this.lionMarker.setVisible(false);
    this.trappedLionEncounterHandler?.();
  }

  private resolveLionCollision(previousX: number, previousZ: number): void {
    if (!this.lion.isSolid()) return;

    const dx = this.mouse.group.position.x - this.lion.group.position.x;
    const dz = this.mouse.group.position.z - this.lion.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= this.lionCollisionRadius) return;

    if (distance < 0.001) {
      this.mouse.group.position.set(previousX, this.mouse.group.position.y, previousZ);
      return;
    }

    const scale = this.lionCollisionRadius / distance;
    this.mouse.group.position.x = this.lion.group.position.x + dx * scale;
    this.mouse.group.position.z = this.lion.group.position.z + dz * scale;
  }

  private resolveTrappedLionCollision(previousX: number, previousZ: number): void {
    if (!this.trappedLion.group.visible) return;
    const dx = this.mouse.group.position.x - this.trappedLion.group.position.x;
    const dz = this.mouse.group.position.z - this.trappedLion.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= 2.15) return;
    if (distance < 0.001) {
      this.mouse.group.position.set(previousX, this.mouse.group.position.y, previousZ);
      return;
    }
    const scale = 2.15 / distance;
    this.mouse.group.position.x = this.trappedLion.group.position.x + dx * scale;
    this.mouse.group.position.z = this.trappedLion.group.position.z + dz * scale;
  }

  private updateNetRescue(delta: number): void {
    this.rescueElapsed = Math.min(this.rescueDuration, this.rescueElapsed + delta);
    const progress = this.rescueElapsed / this.rescueDuration;
    const approach = 1 - Math.exp(-delta * 4.2);
    this.mouse.group.position.x = THREE.MathUtils.lerp(this.mouse.group.position.x, this.rescueTarget.x, approach);
    this.mouse.group.position.z = THREE.MathUtils.lerp(this.mouse.group.position.z, this.rescueTarget.z, approach);
    this.trappedLion.setChewProgress(progress);
  }

  private stageFirstLionConversation(): void {
    // Always use the same open conversational marks, regardless of the path
    // from which the player entered the clearing.
    this.mouse.group.position.set(
      this.lion.group.position.x - 2.65,
      this.mouse.group.position.y,
      this.lion.group.position.z,
    );

    const lionToMouseX = this.mouse.group.position.x - this.lion.group.position.x;
    const lionToMouseZ = this.mouse.group.position.z - this.lion.group.position.z;
    this.lion.group.rotation.y = Math.atan2(-lionToMouseX, -lionToMouseZ);

    const mouseToLionX = -lionToMouseX;
    const mouseToLionZ = -lionToMouseZ;
    this.mouse.setScriptedFacing(Math.atan2(-mouseToLionX, -mouseToLionZ));
  }

  private stageTrappedLionConversation(): void {
    // The lion faces along its local -Z axis. Put the mouse directly in front
    // at a safe conversational distance, regardless of the arrival path.
    this.trappedCameraForward
      .set(0, 0, -1)
      .applyQuaternion(this.trappedLion.group.quaternion)
      .normalize();
    this.mouse.group.position
      .copy(this.trappedLion.group.position)
      .addScaledVector(this.trappedCameraForward, 3.05)
      .setY(0.02);

    const mouseToLionX = this.trappedLion.group.position.x - this.mouse.group.position.x;
    const mouseToLionZ = this.trappedLion.group.position.z - this.mouse.group.position.z;
    this.mouse.setScriptedFacing(Math.atan2(-mouseToLionX, -mouseToLionZ));
  }

  private updateCamera(delta: number): void {
    if (this.storyCameraActive) {
      this.updateStoryCamera(delta);
      return;
    }

    if (this.sequenceTarget) {
      if (this.sequenceTarget === this.trappedLion.group) {
        const lionPosition = this.trappedLion.group.position;
        this.trappedCameraForward
          .set(0, 0, -1)
          .applyQuaternion(this.trappedLion.group.quaternion)
          .normalize();
        this.trappedCameraSide
          .set(-this.trappedCameraForward.z, 0, this.trappedCameraForward.x)
          .normalize();
        this.sequenceCameraPosition
          .copy(lionPosition)
          .addScaledVector(this.trappedCameraForward, 4.5)
          .addScaledVector(this.trappedCameraSide, 4.2)
          .setY(3.25);
        this.trappedCameraLook
          .copy(lionPosition)
          .addScaledVector(this.trappedCameraForward, 1.15)
          .setY(0.82);
        if (this.sequenceCameraSnap) {
          this.camera.position.copy(this.sequenceCameraPosition);
          this.sequenceCameraSnap = false;
        } else {
          this.camera.position.lerp(this.sequenceCameraPosition, 1 - Math.exp(-delta * 3.2));
        }
        this.camera.lookAt(this.trappedCameraLook);
        return;
      }

      const lionPosition = this.sequenceTarget.position;
      const mousePosition = this.mouse.group.position;
      this.sequenceMidpoint.addVectors(lionPosition, mousePosition).multiplyScalar(0.5);
      this.sequenceDirection.subVectors(lionPosition, mousePosition).setY(0);
      if (this.sequenceDirection.lengthSq() < 0.001) this.sequenceDirection.set(0, 0, -1);
      else this.sequenceDirection.normalize();
      this.sequenceSide.set(-this.sequenceDirection.z, 0, this.sequenceDirection.x);
      if (this.sequenceSide.z < 0) this.sequenceSide.multiplyScalar(-1);
      this.sequenceCameraPosition
        .copy(this.sequenceMidpoint)
        .addScaledVector(this.sequenceSide, 4.7)
        .setY(3.25);
      if (this.sequenceCameraSnap) {
        this.camera.position.copy(this.sequenceCameraPosition);
        this.sequenceCameraSnap = false;
      } else {
        this.camera.position.lerp(this.sequenceCameraPosition, 1 - Math.exp(-delta * 3.2));
      }
      this.camera.lookAt(this.sequenceMidpoint.x, 0.82, this.sequenceMidpoint.z);
      return;
    }

    const mousePosition = this.mouse.group.position;
    const targetPosition = this.state.cinematic
      ? new THREE.Vector3(mousePosition.x + 1.2, mousePosition.y + 4.3, mousePosition.z + 7)
      : new THREE.Vector3(mousePosition.x, mousePosition.y + 5.8, mousePosition.z + 8.2);

    this.camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 4));
    this.camera.lookAt(mousePosition.x, 0.18, mousePosition.z - 6.5);
  }

  private updateStoryCamera(delta: number): void {
    this.storyCameraElapsed += delta;
    const progress = THREE.MathUtils.clamp(this.storyCameraElapsed / this.storyCameraDuration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    this.camera.position.lerpVectors(this.storyCameraStart, this.storyCameraEnd, eased);
    this.storyLookCurrent.lerpVectors(this.storyLookStart, this.storyLookEnd, eased);
    this.camera.lookAt(this.storyLookCurrent);
    if (progress >= 1) this.storyCameraActive = false;
  }

  private applyCinematicScenario(): void {
    if (!this.state.cinematic) return;

    if (this.state.scenario === 'intro') {
      this.camera.position.set(2.2, 3.5, 5.8);
    }
  }
}
