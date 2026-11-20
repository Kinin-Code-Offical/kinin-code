// Tiny WebAudio synth for HELLRUN sound effects. Created lazily on the first
// key press (browsers require a user gesture), quiet by default, mutable.

import type { SoundName } from "./defs";

type AudioCtor = typeof AudioContext;

const MASTER_VOLUME = 0.16;

export class Sfx {
  muted = false;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<string, number>();

  /** Creates / resumes the audio context. Safe to call on every key press. */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === "suspended") void this.ac.resume().catch(() => undefined);
      return;
    }
    if (typeof window === "undefined") return;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    try {
      const ac = new Ctor();
      const master = ac.createGain();
      master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      master.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 1.2);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x3fffffff - 1) * 0.9;
      }
      this.ac = ac;
      this.master = master;
      this.noise = buf;
    } catch {
      this.ac = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ac) this.master.gain.setValueAtTime(m ? 0 : MASTER_VOLUME, this.ac.currentTime);
  }

  dispose(): void {
    const ac = this.ac;
    this.ac = null;
    this.master = null;
    if (ac) void ac.close().catch(() => undefined);
  }

  /** Plays a sound; vol 0..1 (distance attenuation is done by the caller). */
  play(name: SoundName, vol = 1): void {
    const ac = this.ac;
    if (!ac || !this.master || this.muted || vol < 0.03) return;
    const now = ac.currentTime;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < 0.035) return;
    this.last.set(name, now);
    switch (name) {
      case "pistol":
        this.noiseBurst(now, 0.14, 0.7 * vol, "bandpass", 1600, 500, 0.8);
        this.tone(now, "square", 170, 55, 0.09, 0.35 * vol);
        break;
      case "shotgun":
        this.noiseBurst(now, 0.38, 1.0 * vol, "lowpass", 2600, 260, 0.7);
        this.tone(now, "sine", 95, 38, 0.28, 0.8 * vol);
        this.noiseBurst(now + 0.42, 0.06, 0.25 * vol, "highpass", 2400, 2400, 1);
        this.noiseBurst(now + 0.58, 0.07, 0.25 * vol, "highpass", 2000, 2000, 1);
        break;
      case "supershotgun":
        this.noiseBurst(now, 0.5, 1.1 * vol, "lowpass", 2200, 180, 0.7);
        this.tone(now, "sine", 80, 30, 0.38, 0.9 * vol);
        this.noiseBurst(now + 0.6, 0.08, 0.25 * vol, "highpass", 1800, 1800, 1);
        break;
      case "chaingun":
        this.noiseBurst(now, 0.08, 0.55 * vol, "bandpass", 2000, 900, 0.9);
        this.tone(now, "square", 150, 70, 0.05, 0.25 * vol);
        break;
      case "punch":
        this.noiseBurst(now, 0.08, 0.35 * vol, "lowpass", 900, 300, 0.7);
        break;
      case "punchHit":
        this.tone(now, "sine", 140, 45, 0.12, 0.8 * vol);
        this.noiseBurst(now, 0.08, 0.5 * vol, "lowpass", 700, 200, 0.7);
        break;
      case "saw":
        this.tone(now, "sawtooth", 95, 110, 0.12, 0.22 * vol);
        break;
      case "sawHit":
        this.tone(now, "sawtooth", 130, 90, 0.12, 0.3 * vol);
        this.noiseBurst(now, 0.1, 0.35 * vol, "bandpass", 1200, 800, 1);
        break;
      case "rocketFire":
        this.noiseBurst(now, 0.45, 0.7 * vol, "bandpass", 500, 1400, 1.2);
        this.tone(now, "sawtooth", 70, 140, 0.3, 0.2 * vol);
        break;
      case "pickup":
        this.tone(now, "square", 700, 700, 0.05, 0.22 * vol);
        this.tone(now + 0.055, "square", 1040, 1040, 0.07, 0.2 * vol);
        break;
      case "weaponPickup":
        this.tone(now, "square", 440, 440, 0.07, 0.22 * vol);
        this.tone(now + 0.07, "square", 660, 660, 0.07, 0.22 * vol);
        this.tone(now + 0.14, "square", 880, 880, 0.12, 0.22 * vol);
        break;
      case "keyPickup":
      case "powerup":
        this.tone(now, "triangle", 523, 523, 0.09, 0.35 * vol);
        this.tone(now + 0.09, "triangle", 784, 784, 0.09, 0.35 * vol);
        this.tone(now + 0.18, "triangle", 1046, 1046, 0.18, 0.35 * vol);
        break;
      case "door":
        this.noiseBurst(now, 0.6, 0.45 * vol, "lowpass", 380, 200, 1);
        this.tone(now, "sawtooth", 52, 70, 0.55, 0.12 * vol);
        break;
      case "locked":
        this.tone(now, "square", 130, 130, 0.08, 0.3 * vol);
        this.tone(now + 0.1, "square", 110, 110, 0.12, 0.3 * vol);
        break;
      case "switch":
        this.noiseBurst(now, 0.05, 0.5 * vol, "highpass", 1500, 1500, 1);
        this.tone(now, "square", 900, 600, 0.06, 0.3 * vol);
        break;
      case "hurt":
        this.tone(now, "sawtooth", 230, 95, 0.22, 0.4 * vol);
        this.noiseBurst(now, 0.12, 0.3 * vol, "lowpass", 900, 300, 0.7);
        break;
      case "playerDeath":
        this.tone(now, "sawtooth", 320, 40, 1.0, 0.45 * vol);
        this.noiseBurst(now, 0.6, 0.4 * vol, "lowpass", 800, 100, 0.7);
        break;
      case "enemyAlert":
        this.tone(now, "sawtooth", 82, 128, 0.32, 0.22 * vol);
        this.tone(now, "sawtooth", 85, 120, 0.32, 0.18 * vol);
        break;
      case "enemyPain":
        this.tone(now, "sawtooth", 300, 170, 0.14, 0.25 * vol);
        break;
      case "enemyDeath":
        this.tone(now, "sawtooth", 260, 48, 0.5, 0.32 * vol);
        this.noiseBurst(now, 0.3, 0.3 * vol, "lowpass", 900, 200, 0.7);
        break;
      case "enemyShot":
        this.noiseBurst(now, 0.12, 0.5 * vol, "bandpass", 1300, 500, 0.8);
        break;
      case "fireball":
        this.noiseBurst(now, 0.42, 0.4 * vol, "bandpass", 700, 260, 2);
        break;
      case "explode":
        this.noiseBurst(now, 0.9, 1.1 * vol, "lowpass", 900, 80, 0.7);
        this.tone(now, "sine", 64, 28, 0.6, 0.9 * vol);
        break;
      case "bite":
        this.noiseBurst(now, 0.12, 0.5 * vol, "lowpass", 1000, 300, 0.7);
        this.tone(now, "sawtooth", 120, 60, 0.14, 0.3 * vol);
        break;
      case "noAmmo":
        this.tone(now, "square", 90, 90, 0.05, 0.25 * vol);
        break;
      case "weaponUp":
        this.noiseBurst(now, 0.05, 0.15 * vol, "highpass", 2500, 2500, 1);
        break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ac = this.ac!;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(
    t: number,
    dur: number,
    vol: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
  ): void {
    const ac = this.ac!;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
