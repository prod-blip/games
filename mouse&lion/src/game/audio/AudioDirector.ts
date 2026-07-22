type OscillatorShape = OscillatorType;

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lionRoarBuffer: AudioBuffer | null = null;
  private trappedLionBuffer: AudioBuffer | null = null;
  private ambienceSources: AudioScheduledSourceNode[] = [];
  private musicTimer = 0;
  private musicPhraseEndsAt = 0;
  private started = false;
  private disposed = false;
  private lionSleeping = true;
  private lionWalking = false;
  private lionWalkRemaining = 0;
  private footstepDistance = 0;
  private chewElapsed = 0;
  private walkElapsed = 0;
  private snoreElapsed = 1.8;
  private wildlifeElapsed = 3.5;

  async start(): Promise<void> {
    if (this.disposed) return;
    if (!this.context) this.createAudioGraph();
    if (!this.context || this.started) return;
    await this.context.resume();
    this.started = true;
    this.startForestAmbience();
    this.scheduleMusicPhrase();
    void this.loadLionRoar();
    void this.loadTrappedLionVoice();
    this.musicTimer = window.setInterval(() => this.scheduleMusicPhrase(), 15000);
    this.playChime([523.25, 659.25, 783.99], 0.025);
  }

  update(delta: number, traveled: number, chewing: boolean): void {
    if (!this.isReady()) return;

    if (traveled > 0.001) {
      this.footstepDistance += traveled;
      if (this.footstepDistance >= 0.42) {
        this.footstepDistance %= 0.42;
        this.playFootstep();
      }
    } else {
      this.footstepDistance = Math.min(this.footstepDistance, 0.2);
    }

    if (chewing) {
      this.chewElapsed -= delta;
      if (this.chewElapsed <= 0) {
        this.chewElapsed = 0.14 + Math.random() * 0.08;
        this.playChew();
      }
    } else {
      this.chewElapsed = 0;
    }

    if (this.lionWalking) {
      this.lionWalkRemaining -= delta;
      this.walkElapsed -= delta;
      if (this.walkElapsed <= 0) {
        this.walkElapsed = 0.36;
        this.playLionStep();
      }
      if (this.lionWalkRemaining <= 0) this.stopLionWalk();
    }

    if (this.lionSleeping) {
      this.snoreElapsed -= delta;
      if (this.snoreElapsed <= 0) {
        this.snoreElapsed = 4.2 + Math.random() * 1.4;
        this.playSnore();
      }
    }

    this.wildlifeElapsed -= delta;
    if (this.wildlifeElapsed <= 0) {
      this.wildlifeElapsed = 6 + Math.random() * 7;
      this.playWildlifeCall();
    }
  }

  playWakeAndRoar(): void {
    this.lionSleeping = false;
    if (!this.isReady() || !this.context) return;
    if (this.lionRoarBuffer && this.effectsBus) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = this.lionRoarBuffer;
      source.playbackRate.value = 0.98;
      // The supplied recording has a quiet average level, so it needs makeup
      // gain before passing through the game's master/effects buses.
      gain.gain.value = 1.8;
      source.connect(gain).connect(this.effectsBus);
      source.start();
      return;
    }

    // Keep a synthesized fallback in case the external recording cannot load.
    const now = this.context.currentTime;
    this.playTone(82, now, 1.45, 0.1, 'sawtooth', this.effectsBus, 56);
    this.playTone(123, now + 0.08, 1.15, 0.055, 'triangle', this.effectsBus, 73);
    this.playNoise(now, 1.25, 0.07, 180, 920);
  }

  playLionLaugh(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime;
    for (let index = 0; index < 3; index += 1) {
      const start = now + index * 0.28;
      this.playTone(115 - index * 7, start, 0.24, 0.075, 'sawtooth', this.effectsBus, 88 - index * 5);
      this.playNoise(start, 0.16, 0.026, 260, 1050);
    }
  }

  playDistantLionRoar(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime;
    this.duckSoundscapeForRoar(now, 6.6);
    if (this.lionRoarBuffer && this.effectsBus) {
      const source = this.context.createBufferSource();
      const lowpass = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = this.lionRoarBuffer;
      source.playbackRate.value = 0.92;
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1550;
      lowpass.Q.value = 0.7;
      gain.gain.value = 1.05;
      source.connect(lowpass).connect(gain).connect(this.effectsBus);
      source.start();
      return;
    }

    this.playTone(68, now, 1.5, 0.075, 'sawtooth', this.effectsBus, 48);
    this.playNoise(now, 1.2, 0.035, 100, 620);
  }

  startLionWalk(): void {
    this.lionWalking = true;
    this.lionWalkRemaining = 4.2;
    this.walkElapsed = 0;
  }

  stopLionWalk(): void {
    this.lionWalking = false;
  }

  playTrappedStruggle(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime;
    if (this.trappedLionBuffer && this.effectsBus) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = this.trappedLionBuffer;
      gain.gain.value = 0.9;
      source.connect(gain).connect(this.effectsBus);
      source.start(now);
      for (let index = 0; index < 3; index += 1) {
        this.playRopeCreak(now + 0.35 + index * 0.7);
      }
      return;
    }
    this.playTone(74, now, 0.85, 0.055, 'sawtooth', this.effectsBus, 61);
    this.playNoise(now + 0.05, 0.65, 0.035, 130, 620);
    for (let index = 0; index < 3; index += 1) {
      this.playRopeCreak(now + 0.18 + index * 0.19);
    }
  }

  playNetRelease(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime;
    for (let index = 0; index < 5; index += 1) {
      const start = now + index * 0.055;
      this.playNoise(start, 0.09, 0.055, 900 + index * 120, 4800);
      this.playTone(210 - index * 18, start, 0.12, 0.025, 'triangle', this.effectsBus, 120);
    }
    this.playChime([392, 523.25, 659.25, 783.99], 0.034, now + 0.55);
  }

  playStoryAdvance(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime;
    this.playTone(660, now, 0.09, 0.018, 'sine', this.effectsBus, 760);
  }

  playEndingSting(): void {
    if (!this.isReady() || !this.context) return;
    const now = this.context.currentTime + 0.05;
    this.playChime([261.63, 329.63, 392, 523.25], 0.045, now);
    this.playTone(130.81, now, 3.4, 0.035, 'sine', this.musicBus, 130.81);
  }

  dispose(): void {
    this.disposed = true;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    for (const source of this.ambienceSources) {
      try { source.stop(); } catch { /* Already stopped. */ }
    }
    this.ambienceSources.length = 0;
    if (this.context) void this.context.close();
    this.context = null;
  }

  private createAudioGraph(): void {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.ambienceBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.master.gain.value = 0.72;
    this.ambienceBus.gain.value = 0.62;
    this.musicBus.gain.value = 0.56;
    this.effectsBus.gain.value = 0.82;
    this.ambienceBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.effectsBus.connect(this.master);
    this.master.connect(this.context.destination);

    const frameCount = this.context.sampleRate * 2;
    this.noiseBuffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      samples[index] = white * 0.34 + previous * 1.8;
    }
  }

  private async loadLionRoar(): Promise<void> {
    if (!this.context || this.lionRoarBuffer) return;
    try {
      const response = await fetch('/audio/sfx/lion-roar.ogg');
      if (!response.ok) throw new Error(`Unable to load lion roar: ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      this.lionRoarBuffer = await this.context.decodeAudioData(encodedAudio);
    } catch (error) {
      console.warn('Using synthesized lion roar fallback.', error);
    }
  }

  private async loadTrappedLionVoice(): Promise<void> {
    if (!this.context || this.trappedLionBuffer) return;
    try {
      const response = await fetch('/audio/sfx/lion-trapped.ogg');
      if (!response.ok) throw new Error(`Unable to load trapped lion voice: ${response.status}`);
      const encodedAudio = await response.arrayBuffer();
      this.trappedLionBuffer = await this.context.decodeAudioData(encodedAudio);
    } catch (error) {
      console.warn('Using synthesized trapped lion fallback.', error);
    }
  }

  private startForestAmbience(): void {
    if (!this.context || !this.noiseBuffer || !this.ambienceBus) return;
    const now = this.context.currentTime;

    const wind = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 620;
    windGain.gain.value = 0.055;
    wind.connect(windFilter).connect(windGain).connect(this.ambienceBus);
    wind.start(now);

    const leaves = this.context.createBufferSource();
    const leavesFilter = this.context.createBiquadFilter();
    const leavesGain = this.context.createGain();
    const breezeLfo = this.context.createOscillator();
    const breezeDepth = this.context.createGain();
    leaves.buffer = this.noiseBuffer;
    leaves.loop = true;
    leaves.playbackRate.value = 1.37;
    leavesFilter.type = 'bandpass';
    leavesFilter.frequency.value = 2600;
    leavesFilter.Q.value = 0.55;
    leavesGain.gain.value = 0.018;
    breezeLfo.frequency.value = 0.09;
    breezeDepth.gain.value = 0.012;
    breezeLfo.connect(breezeDepth).connect(leavesGain.gain);
    leaves.connect(leavesFilter).connect(leavesGain).connect(this.ambienceBus);
    leaves.start(now);
    breezeLfo.start(now);
    this.ambienceSources.push(wind, leaves, breezeLfo);
  }

  private scheduleMusicPhrase(): void {
    if (!this.isReady() || !this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const start = Math.max(now + 0.08, this.musicPhraseEndsAt - 0.7);
    const chords = [
      [146.83, 220, 293.66],
      [130.81, 196, 261.63],
      [174.61, 220, 329.63],
      [146.83, 220, 293.66],
    ];
    const melody = [440, 523.25, 493.88, 392, 440, 587.33, 523.25, 440];

    chords.forEach((chord, chordIndex) => {
      const chordStart = start + chordIndex * 4;
      chord.forEach((frequency, noteIndex) => {
        this.playTone(frequency, chordStart + noteIndex * 0.08, 4.5, 0.011, 'sine', this.musicBus, frequency * 1.003);
      });
    });
    melody.forEach((frequency, index) => {
      this.playTone(frequency, start + 0.8 + index * 1.8, 1.25, 0.012, 'triangle', this.musicBus, frequency * 0.997);
    });
    this.musicPhraseEndsAt = start + 16;
  }

  private playFootstep(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.playNoise(now, 0.055, 0.018, 500, 2600);
    this.playTone(105 + Math.random() * 18, now, 0.065, 0.012, 'sine', this.effectsBus, 72);
  }

  private playChew(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.playNoise(now, 0.055, 0.027, 1500, 6200);
    this.playTone(620 + Math.random() * 180, now, 0.045, 0.012, 'square', this.effectsBus, 430);
  }

  private playLionStep(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.playTone(58, now, 0.14, 0.045, 'sine', this.effectsBus, 42);
    this.playNoise(now, 0.1, 0.018, 110, 620);
  }

  private playSnore(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.playTone(72, now, 1.5, 0.025, 'sawtooth', this.effectsBus, 48);
    this.playNoise(now + 0.18, 1.1, 0.016, 90, 430);
  }

  private playWildlifeCall(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const base = 1500 + Math.random() * 600;
    this.playTone(base, now, 0.12, 0.008, 'sine', this.ambienceBus, base * 1.28);
    this.playTone(base * 1.18, now + 0.18, 0.14, 0.007, 'sine', this.ambienceBus, base * 1.42);
  }

  private playRopeCreak(start: number): void {
    this.playTone(180, start, 0.22, 0.018, 'sawtooth', this.effectsBus, 116);
    this.playNoise(start, 0.16, 0.012, 700, 2400);
  }

  private duckSoundscapeForRoar(start: number, duration: number): void {
    if (!this.musicBus || !this.ambienceBus) return;
    const musicGain = this.musicBus.gain;
    const ambienceGain = this.ambienceBus.gain;
    musicGain.cancelScheduledValues(start);
    ambienceGain.cancelScheduledValues(start);
    musicGain.setValueAtTime(musicGain.value, start);
    ambienceGain.setValueAtTime(ambienceGain.value, start);
    musicGain.linearRampToValueAtTime(0.16, start + 0.22);
    ambienceGain.linearRampToValueAtTime(0.34, start + 0.22);
    musicGain.setValueAtTime(0.16, start + duration - 1.1);
    ambienceGain.setValueAtTime(0.34, start + duration - 1.1);
    musicGain.linearRampToValueAtTime(0.56, start + duration);
    ambienceGain.linearRampToValueAtTime(0.62, start + duration);
  }

  private playChime(frequencies: number[], gain: number, start?: number): void {
    if (!this.context) return;
    const beganAt = start ?? this.context.currentTime;
    frequencies.forEach((frequency, index) => {
      this.playTone(frequency, beganAt + index * 0.11, 1.7 + index * 0.14, gain, 'sine', this.effectsBus, frequency * 1.002);
    });
  }

  private playTone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    shape: OscillatorShape,
    destination: AudioNode | null,
    endFrequency = frequency,
  ): void {
    if (!this.context || !destination) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.05, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  private playNoise(
    start: number,
    duration: number,
    volume: number,
    lowFrequency: number,
    highFrequency: number,
  ): void {
    if (!this.context || !this.noiseBuffer || !this.effectsBus) return;
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    highpass.type = 'highpass';
    highpass.frequency.value = lowFrequency;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = highFrequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(highpass).connect(lowpass).connect(gain).connect(this.effectsBus);
    source.start(start, Math.random() * 1.4, duration + 0.02);
  }

  private isReady(): boolean {
    return this.started && this.context?.state === 'running';
  }
}
