import type { InputState } from '../types';
import type { VehicleState } from './vehiclePhysics';

export class EngineAudio {
  private context?: AudioContext;
  private oscillator?: OscillatorNode;
  private gain?: GainNode;
  private music = new Audio('https://s3-us-west-2.amazonaws.com/s.cdpn.io/264161/Antonio-Vivaldi-Summer_01.mp3');
  private musicStarted = false;

  constructor() {
    this.music.loop = true;
    this.music.volume = 0.35;
  }

  ensureStarted() {
    if (this.context) return;
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    this.context = new AudioContextCtor();
    this.oscillator = this.context.createOscillator();
    this.gain = this.context.createGain();
    this.oscillator.type = 'sawtooth';
    this.oscillator.frequency.value = 80;
    this.gain.gain.value = 0.0001;
    this.oscillator.connect(this.gain);
    this.gain.connect(this.context.destination);
    this.oscillator.start();
  }

  async startMusic() {
    if (this.musicStarted) return true;
    try {
      await this.music.play();
      this.musicStarted = true;
      return true;
    } catch {
      return false;
    }
  }

  stopMusic() {
    this.music.pause();
    this.musicStarted = false;
  }

  async toggleMusic() {
    if (this.musicStarted) {
      this.stopMusic();
      return false;
    }
    return this.startMusic();
  }

  isMusicPlaying() {
    return this.musicStarted;
  }

  update(input: InputState, state: VehicleState) {
    if (!this.context || !this.oscillator || !this.gain) return;
    const now = this.context.currentTime;
    const throttle = input.accelerate ? 1 : input.brakeReverse ? 0.35 : 0.08;
    const damageRattle = Math.min(state.degradation * 0.8 + state.damage * 0.45, 70);
    const targetFrequency = 70 + Math.abs(state.velocity) * 8.5 + throttle * 95 + damageRattle;
    const targetGain = input.accelerate ? 0.045 : input.brakeReverse ? 0.024 : 0.009;
    this.oscillator.frequency.setTargetAtTime(targetFrequency, now, 0.035);
    this.gain.gain.setTargetAtTime(targetGain, now, 0.045);
  }

  stop() {
    if (!this.context || !this.gain) return;
    this.gain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.08);
  }
}
