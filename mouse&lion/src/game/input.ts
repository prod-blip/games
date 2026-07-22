import type { InputState } from './types';

const keyMap: Record<string, keyof Pick<InputState, 'left' | 'right' | 'up' | 'down' | 'action'>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'action',
};

export class InputController {
  private readonly target: HTMLElement;
  private readonly touchControls = document.createElement('div');
  private readonly joystickBase = document.createElement('div');
  private readonly joystickKnob = document.createElement('div');
  private touchPointerId: number | null = null;
  private touchCenterX = 0;
  private touchCenterY = 0;
  private movementEnabled = false;
  readonly state: InputState = {
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

  private readonly onKeyDown = (event: KeyboardEvent) => this.setKey(event, true);
  private readonly onKeyUp = (event: KeyboardEvent) => this.setKey(event, false);
  private readonly onPointerMove = (event: PointerEvent) => {
    this.state.pointerX = event.clientX;
    this.state.pointerY = event.clientY;
    if (event.pointerId === this.touchPointerId) {
      event.preventDefault();
      this.updateJoystick(event.clientX, event.clientY);
    }
  };
  private readonly onPointerDown = (event: PointerEvent) => {
    this.state.pointerX = event.clientX;
    this.state.pointerY = event.clientY;
    if (event.pointerType === 'touch' && this.movementEnabled && event.clientX <= window.innerWidth * 0.72) {
      event.preventDefault();
      this.touchPointerId = event.pointerId;
      this.touchCenterX = event.clientX;
      this.touchCenterY = event.clientY;
      this.joystickBase.style.left = `${event.clientX - 58}px`;
      this.joystickBase.style.top = `${event.clientY - 58}px`;
      this.joystickBase.style.bottom = 'auto';
      this.touchControls.classList.add('is-engaged');
      this.target.setPointerCapture(event.pointerId);
      this.updateJoystick(event.clientX, event.clientY);
      return;
    }
    this.state.action = true;
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.touchPointerId) this.releaseJoystick();
    this.state.action = false;
  };
  private readonly onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === this.touchPointerId) this.releaseJoystick();
  };

  constructor(target: HTMLElement) {
    this.target = target;
    this.touchControls.className = 'touch-controls touch-controls--disabled';
    this.joystickBase.className = 'touch-controls__base';
    this.joystickKnob.className = 'touch-controls__knob';
    this.joystickBase.appendChild(this.joystickKnob);
    this.touchControls.appendChild(this.joystickBase);
    this.target.parentElement?.appendChild(this.touchControls);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
  }

  setMovementEnabled(enabled: boolean): void {
    this.movementEnabled = enabled;
    this.touchControls.classList.toggle('touch-controls--disabled', !enabled);
    if (!enabled) this.releaseJoystick();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.touchControls.remove();
  }

  private setKey(event: KeyboardEvent, pressed: boolean): void {
    const key = keyMap[event.code];
    if (!key) return;

    event.preventDefault();
    this.state[key] = pressed;
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const radius = 44;
    const rawX = clientX - this.touchCenterX;
    const rawY = clientY - this.touchCenterY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    this.state.moveX = x / radius;
    this.state.moveY = y / radius;
    this.joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  private releaseJoystick(): void {
    this.touchPointerId = null;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.touchControls.classList.remove('is-engaged');
    this.joystickBase.style.removeProperty('left');
    this.joystickBase.style.removeProperty('top');
    this.joystickBase.style.removeProperty('bottom');
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
  }
}
