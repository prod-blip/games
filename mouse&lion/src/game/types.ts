export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';

export interface GameState {
  status: GameStatus;
  score: number;
  elapsed: number;
  cinematic: boolean;
  scenario: string;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  moveX: number;
  moveY: number;
  pointerX: number;
  pointerY: number;
}
