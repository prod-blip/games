import './style.css';
import { Game } from './game/Game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

let game: Game | undefined;

try {
  game = new Game(app);
  game.start();
} catch (error) {
  console.error(error);
  app.innerHTML = `
    <div class="webgl-error">
      <strong>WebGL could not start.</strong>
      <span>Enable browser hardware acceleration, try Chrome/Edge, or restart the browser.</span>
    </div>
  `;
}

window.addEventListener('beforeunload', () => game?.dispose());
