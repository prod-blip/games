import './style.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLDivElement>('#app');
const loader = document.querySelector<HTMLDivElement>('#game-loader');
const loaderStage = loader?.querySelector<HTMLElement>('.loader__stage');
const loaderPercent = loader?.querySelector<HTMLElement>('.loader__percent');
const storyIntro = document.querySelector<HTMLElement>('#story-intro');
const storyTitle = storyIntro?.querySelector<HTMLElement>('.story-intro__title-card');
const storyDialogue = storyIntro?.querySelector<HTMLElement>('.story-intro__dialogue');
const storyPrompt = storyIntro?.querySelector<HTMLElement>('.story-intro__prompt');
const lionDialogue = document.querySelector<HTMLElement>('#lion-dialogue');
const lionDialogueSpeaker = lionDialogue?.querySelector<HTMLElement>('.encounter-dialogue__speaker');
const lionDialogueText = lionDialogue?.querySelector<HTMLElement>('.encounter-dialogue__text');
const narratorCard = document.querySelector<HTMLElement>('#narrator-card');
const narratorText = narratorCard?.querySelector<HTMLElement>('.narrator-card__text');
const storyEnding = document.querySelector<HTMLElement>('#story-ending');
const restartStoryButton = storyEnding?.querySelector<HTMLButtonElement>('.story-ending__restart');
const explorationThought = document.querySelector<HTMLElement>('#exploration-thought');
const explorationThoughtText = explorationThought?.querySelector<HTMLElement>('.exploration-thought__text');
const timePassage = document.querySelector<HTMLElement>('#time-passage');
let explorationThoughtTimer = 0;
let narratorAutoTimer = 0;

const usesTouchControls = navigator.maxTouchPoints > 0
  || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
if (usesTouchControls) {
  document.documentElement.classList.add('has-touch-input');
  if (storyPrompt) storyPrompt.textContent = 'Tap anywhere to begin.';
  lionDialogue?.querySelector<HTMLElement>('.encounter-dialogue__continue')
    ?.replaceChildren('Tap anywhere to continue');
  narratorCard?.querySelector<HTMLElement>('.narrator-card__continue')
    ?.replaceChildren('Tap anywhere to continue');
}

const lionEncounterLines = [
  { speaker: 'Mouse', text: 'Oh! A lion... He is fast asleep.' },
  { speaker: 'Lion', text: 'Who dares disturb my rest?', wakesLion: true, animationDelay: 1900 },
  { speaker: 'Mouse', text: 'Please forgive me! Spare me, and one day I may help you.', pleadsMouse: true, animationDelay: 700 },
  { speaker: 'Lion', text: 'You? Help me? Ha, ha, ha! Still, I will let you go.', laughsLion: true, animationDelay: 900 },
] as const;

const trappedLionEncounterLines = [
  { speaker: 'Lion', text: 'My friend! These hunters’ ropes hold fast. Even all my strength cannot break them.', trappedVoice: true },
  { speaker: 'Mouse', text: 'Your mercy saved my life. Now my small teeth will set you free.', calmsLion: true },
] as const;

const rescueEndingLines = [
  { speaker: 'Lion', text: 'You were right, little friend. Today, the smallest creature has saved the King of Beasts.' },
  { speaker: 'Mouse', text: 'Kindness is never wasted—and no friend is too small to help.' },
] as const;

if (!app) throw new Error('Missing #app root element');
const appRoot = app;

let game: Game | undefined;

restartStoryButton?.addEventListener('click', () => window.location.reload());

function setLoadingProgress(progress: number, stage: string): void {
  const clamped = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  loader?.style.setProperty('--loader-progress', `${clamped}%`);
  if (loaderStage) loaderStage.textContent = stage;
  if (loaderPercent) loaderPercent.textContent = `${clamped}%`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function waitForBeginInput(): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.repeat) finish();
    };
    const onPointerDown = () => finish();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
  });
}

function showExplorationThought(text: string | null): void {
  window.clearTimeout(explorationThoughtTimer);
  if (!text) {
    explorationThought?.classList.remove('is-visible');
    return;
  }
  if (explorationThoughtText) explorationThoughtText.textContent = `“${text}”`;
  explorationThought?.classList.add('is-visible');
  explorationThoughtTimer = window.setTimeout(() => {
    explorationThought?.classList.remove('is-visible');
  }, 5200);
}

function showTimePassage(): void {
  timePassage?.classList.add('is-visible');
  window.setTimeout(() => timePassage?.classList.remove('is-visible'), 4200);
}

function showNarratorCard(text: string, automatic = false): void {
  window.clearTimeout(narratorAutoTimer);
  if (narratorText) narratorText.textContent = text;
  narratorCard?.classList.toggle('is-automatic', automatic);
  narratorCard?.classList.add('is-visible');
}

async function hideNarratorCard(): Promise<void> {
  window.clearTimeout(narratorAutoTimer);
  narratorCard?.classList.remove('is-visible');
  await delay(450);
}

function playTimedNarration(text: string, duration = 6200): void {
  showNarratorCard(text, true);
  narratorAutoTimer = window.setTimeout(() => {
    narratorCard?.classList.remove('is-visible');
  }, duration);
}

async function playNarration(text: string): Promise<void> {
  showNarratorCard(text);
  await nextFrame();
  // Keep the card on screen long enough to be noticed and prevent a movement
  // key used to enter the scene from dismissing it immediately.
  await delay(1100);
  await waitForBeginInput();
  await hideNarratorCard();
}

async function playLionEncounter(activeGame: Game): Promise<void> {
  await playNarration(
    'Beneath the twinkling stars, the little mouse found a quiet clearing. Curled in the soft grass was the biggest lion he had ever seen. The lion slept so soundly that his great mane rose and fell with every breath.',
  );
  lionDialogue?.classList.add('is-visible');

  for (const line of lionEncounterLines) {
    if (lionDialogueSpeaker) lionDialogueSpeaker.textContent = line.speaker;
    if (lionDialogueText) lionDialogueText.textContent = `“${line.text}”`;
    if ('wakesLion' in line && line.wakesLion) activeGame.wakeLion();
    if ('laughsLion' in line && line.laughsLion) activeGame.laughLion();
    if ('pleadsMouse' in line && line.pleadsMouse) activeGame.startMousePlea();
    activeGame.playStoryAdvanceSound();
    await nextFrame();
    if ('animationDelay' in line) await delay(line.animationDelay);
    await waitForBeginInput();
    if ('pleadsMouse' in line && line.pleadsMouse) activeGame.endMousePlea();
  }

  lionDialogue?.classList.remove('is-visible');
  activeGame.sendLionAway();
  await delay(3200);

  if (lionDialogueSpeaker) lionDialogueSpeaker.textContent = 'Mouse — Relieved';
  if (lionDialogueText) lionDialogueText.textContent = '“Phew… I am safe. The lion showed me mercy, and I will never forget his kindness.”';
  lionDialogue?.classList.add('is-visible');
  activeGame.playStoryAdvanceSound();
  await waitForBeginInput();
  lionDialogue?.classList.remove('is-visible');

  await playNarration(
    'The lion padded away between the tall trees. The little mouse watched until the last swish of his golden tail disappeared. His knees still wobbled, but his heart felt warm. The mighty lion had chosen kindness.',
  );
  activeGame.completeLionEncounter();
  showTimePassage();
}

async function playTrappedLionEncounter(activeGame: Game): Promise<void> {
  await playNarration(
    'The mouse followed the distant roar through ferns, around rocks, and beneath tangled branches. At last, he reached a hidden clearing—and gasped. The mighty lion was caught beneath a hunter’s heavy net!',
  );
  lionDialogue?.classList.add('is-visible');
  for (const line of trappedLionEncounterLines) {
    if (lionDialogueSpeaker) lionDialogueSpeaker.textContent = line.speaker;
    if (lionDialogueText) lionDialogueText.textContent = `“${line.text}”`;
    if ('calmsLion' in line && line.calmsLion) activeGame.calmTrappedLion();
    if ('trappedVoice' in line && line.trappedVoice) activeGame.playTrappedLionVoice();
    activeGame.playStoryAdvanceSound();
    await nextFrame();
    await waitForBeginInput();
  }

  lionDialogue?.classList.remove('is-visible');
  await delay(300);
  showNarratorCard(
    'The mouse hurried to the thick ropes. Nibble, nibble, nibble! His tiny teeth worked as fast as they could. One strand snapped, then another, and the heavy net began to loosen.',
    true,
  );
  activeGame.startNetRescue();
  await delay(5600);
  activeGame.finishNetRescue();
  await delay(1500);
  await hideNarratorCard();
  lionDialogue?.classList.add('is-visible');

  for (const line of rescueEndingLines) {
    if (lionDialogueSpeaker) lionDialogueSpeaker.textContent = line.speaker;
    if (lionDialogueText) lionDialogueText.textContent = `“${line.text}”`;
    activeGame.playStoryAdvanceSound();
    await nextFrame();
    await waitForBeginInput();
  }

  lionDialogue?.classList.remove('is-visible');
  await playNarration(
    'At last, the final rope broke and the net tumbled onto the ground. The lion was free! From that day on, he remembered that even the smallest friend can do something wonderfully brave.',
  );
  activeGame.endStory();
  storyEnding?.classList.add('is-visible');
  activeGame.playEndingSound();
  await delay(900);
  restartStoryButton?.focus({ preventScroll: true });
}

async function playStoryIntro(activeGame: Game): Promise<void> {
  await delay(720);
  storyTitle?.classList.add('is-visible');
  await delay(3200);
  storyTitle?.classList.remove('is-visible');

  await delay(750);
  await playNarration(
    'Once upon a time, a curious little mouse set out beneath a sky full of stars. The forest was enormous, but the mouse was brave, and every rustling leaf seemed to whisper that an adventure was waiting.',
  );

  await delay(500);
  activeGame.turnMouseTowardForest();
  await delay(900);

  storyDialogue?.classList.add('is-visible');
  await delay(3400);
  storyDialogue?.classList.remove('is-visible');
  await delay(850);

  activeGame.revealHud();
  storyPrompt?.classList.add('is-visible');
  await waitForBeginInput();

  activeGame.enableAudio();

  storyPrompt?.classList.remove('is-visible');
  storyIntro?.classList.add('is-complete');
  activeGame.enablePlayerControl();
  window.setTimeout(() => storyIntro?.remove(), 650);
}

async function bootstrap(): Promise<void> {
  const loadingStartedAt = performance.now();
  setLoadingProgress(0.05, 'Entering the forest');
  await nextFrame();

  setLoadingProgress(0.18, 'Preparing the trail');
  game = new Game(appRoot);
  game.setLionEncounterHandler(() => {
    if (game) void playLionEncounter(game);
  });
  game.setTrappedLionEncounterHandler(() => {
    if (game) void playTrappedLionEncounter(game);
  });
  game.setExplorationThoughtHandler(showExplorationThought);
  game.setRescueSearchBeatHandler(() => {
    playTimedNarration(
      'Several mornings later, while the mouse followed a winding forest trail, a deep growl rolled across the treetops. It sounded far away—but the mouse knew that voice. It was the lion!',
    );
  });
  await nextFrame();

  setLoadingProgress(0.35, 'Building the night world');
  await game.prepare((progress, stage) => {
    setLoadingProgress(0.35 + progress * 0.58, stage);
  });

  setLoadingProgress(0.95, 'Almost there');
  await document.fonts.ready;
  await nextFrame();
  const remainingDisplayTime = Math.max(0, 1200 - (performance.now() - loadingStartedAt));
  if (remainingDisplayTime > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remainingDisplayTime));
  }
  setLoadingProgress(1, 'Ready');

  await new Promise((resolve) => window.setTimeout(resolve, 420));
  game.beginStoryIntro();
  game.start();
  loader?.classList.add('is-complete');
  window.setTimeout(() => loader?.remove(), 700);
  await playStoryIntro(game);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  setLoadingProgress(1, 'Unable to enter the forest');
  loader?.classList.add('has-error');
});

window.addEventListener('beforeunload', () => {
  game?.dispose();
});
