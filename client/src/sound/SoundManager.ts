/**
 * Authentic Retro Sound Synthesizer for Port of Call
 * Faithfully recreates the classic 1987 Amiga / DOS Ports of Call audio:
 * - Dual-tone low-pass filtered Foghorn
 * - Rhythmic pulse-train Diesel Piston Engine (iconic harbor chug)
 * - Metallic Hull Collision / Quay Crunch with resonance
 * - Authentic Paired Strike Ship's Bell (Ding-Ding, Ding-Ding)
 * - Mechanical Coin Counter / Payout register
 * - Urgent Radar / Iceberg Proximity Alert Siren
 * - Maritime Departure Boatswain Whistle
 * - Retro Amiga 8-bit Fanfare Motif
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Engine pulse rhythm timer
  private engineTimer: any = null;
  private currentThrottle: number = 0;

  constructor() {}

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopEngine();
    } else if (this.currentThrottle > 0) {
      this.setEngineThrottle(this.currentThrottle);
    }
    return !this.isMuted;
  }

  /**
   * Helper: Generate a short white noise buffer for metal crumple, exhaust puffs, and coins
   */
  private createNoiseBuffer(duration: number = 0.5): AudioBuffer | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * 1. CLASSIC PORTS OF CALL FOGHORN
   * Rich, resonant harmonic blast with authentic low-C/G overtones & subtle pitch droop
   */
  public playFoghorn() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 2.6;

    // Dual detuned saw waves for thick maritime brass resonance
    const freqs = [58.73, 88.1, 117.46, 176.2]; // D1, A1, D2, A2 harmonic series
    const gains = [0.22, 0.15, 0.08, 0.04];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.35, now + 0.35); // Warm attack
    masterGain.gain.setValueAtTime(0.35, now + duration - 0.5);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Warm vintage lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.linearRampToValueAtTime(320, now + duration);
    filter.Q.setValueAtTime(3.5, now);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      // Classic horn pitch droop as air pressure settles
      osc.frequency.linearRampToValueAtTime(freq * 0.96, now + duration);

      oscGain.gain.setValueAtTime(gains[idx], now);
      osc.connect(oscGain);
      oscGain.connect(filter);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  /**
   * 2. ICONIC DIESEL ENGINE CHUG (Harbor Docking Rhythm)
   * The original Ports of Call made an unmistakable rhythmic "THUD-chug... THUD-chug..."
   * generated here via pulsed piston transients and exhaust bursts
   */
  public setEngineThrottle(throttlePercent: number) {
    this.currentThrottle = throttlePercent;
    if (this.isMuted) return;

    if (this.engineTimer) {
      clearInterval(this.engineTimer);
      this.engineTimer = null;
    }

    if (throttlePercent <= 0) return;

    // Rate: 1.8 beats/sec at dead slow, up to 7.5 beats/sec at full ahead
    const normalized = Math.min(100, Math.max(10, throttlePercent)) / 100;
    const intervalMs = Math.round(520 - normalized * 380); // 520ms down to 140ms

    this.playPistonStroke(normalized);
    this.engineTimer = setInterval(() => {
      if (!this.isMuted && this.currentThrottle > 0) {
        this.playPistonStroke(normalized);
      }
    }, intervalMs);
  }

  private playPistonStroke(power: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Deep cylinder combustion thump (sine pitch drop from 65Hz to 28Hz)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(55 + power * 20, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.12);

    oscGain.gain.setValueAtTime(0.28 * power, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);

    // 2. Exhaust manifold puff (low-pass noise burst)
    const noise = this.createNoiseBuffer(0.1);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(240 + power * 180, now);
      filter.Q.setValueAtTime(2.0, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.14 * power, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);

      src.start(now);
      src.stop(now + 0.09);
    }
  }

  public stopEngine() {
    if (this.engineTimer) {
      clearInterval(this.engineTimer);
      this.engineTimer = null;
    }
    this.currentThrottle = 0;
  }

  /**
   * 3. CLASSIC PORTS OF CALL QUAY COLLISION / CRASH
   * In original POC, hitting the pier produced an infamous, loud, metallic
   * crushing sound with low-frequency impact and scraping rumble
   */
  public playImpact() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.85;

    // 1. Sub-bass heavy hull impact boom
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.5);

    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.65);

    // 2. Metal crumple and plate deformation (swept bandpass noise)
    const noiseBuf = this.createNoiseBuffer(duration);
    if (noiseBuf) {
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + duration);
      filter.Q.setValueAtTime(3.0, now);

      const dist = ctx.createWaveShaper();
      // Light distortion curve for crunchy crunch
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = ((3 + 20) * x * 20 * (Math.PI / 180)) / (Math.PI + 20 * Math.abs(x));
      }
      dist.curve = curve;

      const crunchGain = ctx.createGain();
      crunchGain.gain.setValueAtTime(0.45, now);
      crunchGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSrc.connect(filter);
      filter.connect(dist);
      dist.connect(crunchGain);
      crunchGain.connect(ctx.destination);

      noiseSrc.start(now);
      noiseSrc.stop(now + duration);
    }
  }

  /**
   * 4. AUTHENTIC NAUTICAL SHIP'S BELL
   * Traditional paired strikes ("DING-DING! ... DING-DING!") with multiple bell partials
   */
  public playBell() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two paired strikes 180ms apart (authentic maritime watch strike)
    this.strikeBell(now);
    this.strikeBell(now + 0.22);
  }

  private strikeBell(time: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    // Harmonic bell partials
    const partials = [820, 1260, 1840, 2480, 3350];
    const amplitudes = [0.12, 0.08, 0.05, 0.03, 0.015];

    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(amplitudes[idx], time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 1.45);
    });
  }

  /**
   * 5. MECHANICAL COIN REGISTER / PAYOUT (Ports of Call Cargo Discharged)
   * Rapid cascade of metallic coin drops followed by a register bell
   */
  public playCash() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Rapid coin drops
    const coinPitches = [3400, 4200, 3100, 3900, 4600];
    coinPitches.forEach((pitch, idx) => {
      const dropTime = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, dropTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, dropTime + 0.08);

      gain.gain.setValueAtTime(0.12, dropTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, dropTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(dropTime);
      osc.stop(dropTime + 0.13);
    });

    // Concluding cash register bell chime
    const bellTime = now + 0.38;
    const regOsc = ctx.createOscillator();
    const regGain = ctx.createGain();
    regOsc.type = 'triangle';
    regOsc.frequency.setValueAtTime(1760, bellTime); // A6
    regGain.gain.setValueAtTime(0.18, bellTime);
    regGain.gain.exponentialRampToValueAtTime(0.0001, bellTime + 0.6);

    regOsc.connect(regGain);
    regGain.connect(ctx.destination);

    regOsc.start(bellTime);
    regOsc.stop(bellTime + 0.65);
  }

  /**
   * 6. RADAR / ICEBERG HAZARD PROXIMITY ALERT
   * Urgent high-pitch maritime obstacle siren (classic 2-tone warble)
   */
  public playHazardAlarm() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 1.2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // 2-tone alternating alert siren: 880Hz <-> 1180Hz
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.18;
      const freq = i % 2 === 0 ? 880 : 1200;
      osc.frequency.setValueAtTime(freq, t);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * 7. BOATSWAIN WHISTLE (Cast-off & Underway)
   * High-pitch nautical pipe chirp
   */
  public playDepartureWhistle() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.linearRampToValueAtTime(2900, now + 0.15);
    osc.frequency.setValueAtTime(2900, now + 0.35);
    osc.frequency.linearRampToValueAtTime(2400, now + 0.55);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    gain.gain.setValueAtTime(0.16, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  /**
   * 8. RETRO AMIGA FANFARE JINGLE
   * The memorable celebratory 4-note brass motif of Ports of Call
   */
  public playFanfare() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Classic G4 - C5 - E5 - G5 triumphant fanfare
    const notes = [392.0, 523.25, 659.25, 783.99];
    const times = [0, 0.14, 0.28, 0.46];
    const lengths = [0.12, 0.12, 0.15, 0.55];

    notes.forEach((freq, idx) => {
      const noteTime = now + times[idx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + lengths[idx]);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + lengths[idx] + 0.05);
    });
  }

  /**
   * 9. RETRO REFUSAL / ERROR BUZZER (Action Unavailable / Denied)
   * The classic 1987 Ports of Call / Amiga refusal buzzer for unavailable shipyard repairs,
   * insufficient funds, or invalid orders ("BZZT-BZZT!")
   */
  public playErrorBuzz() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two rapid, gritty low-frequency pulses: 125Hz falling to 100Hz
    [0, 0.12].forEach((offset) => {
      const startTime = now + offset;
      const duration = 0.085;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sawtooth with slight pitch droop creates the classic arcade/retro computer buzzer
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(125, startTime);
      osc.frequency.linearRampToValueAtTime(100, startTime + duration);

      // Bandpass around 750Hz gives that 8-bit monitor speaker / Commodore / Amiga rasp
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, startTime);
      filter.Q.setValueAtTime(2.2, startTime);

      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    });
  }
}

export const sounds = new SoundManager();
