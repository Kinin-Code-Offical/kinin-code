/**
 * Procedural music player for the terminal's `mp3` command.
 *
 * `composition.ts` decides *what* to play (pure, deterministic per file
 * name); this module turns those bar plans into sound with Web Audio:
 *
 * - a lookahead scheduler (setTimeout every ~25 ms, schedules ~0.1 s ahead on
 *   the AudioContext clock) walks the 16th-note grid and asks the composition
 *   for each bar's events;
 * - drums, bass, arp and lead are monophonic voices built from persistent
 *   nodes whose AudioParams are automated per note (no node churn); only pad
 *   chords create short-lived oscillators, which stop and disconnect after
 *   their release;
 * - master chain: compressor → makeup gain → limiter → analyser → volume →
 *   destination. The analyser sits *before* the host-controlled volume so the
 *   visualiser keeps moving while the host fades the volume with scroll.
 *
 * SSR-safe: nothing touches `window`/`AudioContext` until `play()`.
 */

import {
  STEPS_PER_BAR,
  createSong,
  planBar,
  songTrackInfo,
  type BarPlan,
  type NoteEvent,
  type Song,
  type TrackInfo,
  type Wave,
} from "./composition";

export type { TrackInfo } from "./composition";

export function describeTrack(fileName: string): TrackInfo {
  return songTrackInfo(createSong(fileName));
}

export type MusicPlayer = {
  /** Starts (or restarts) the track for this file name. Call from a user gesture. */
  play(fileName: string): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  isPlaying(): boolean;
  /** Seek within the current track (seconds). Works while paused too. */
  seek(seconds: number): void;
  /** Position within the current track in seconds (0..durationSec). */
  currentTime(): number;
  /** Master volume 0..1, smoothed. */
  setVolume(v: number): void;
  /** Fills `out` with log-spaced magnitude bins (0..255). */
  getSpectrum(out: Uint8Array): void;
  /** Fills `out` with time-domain samples (0..255, 128 = silence). */
  getWaveform(out: Uint8Array): void;
  onEnded(cb: () => void): void;
  dispose(): void;
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
/** When the tab is hidden timers are throttled to ~1 Hz; schedule further. */
const HIDDEN_SCHEDULE_AHEAD_SEC = 1.5;
const FADE_SEC = 0.03;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const expLerp = (range: readonly [number, number], t: number) =>
  range[0] * Math.pow(range[1] / range[0], clamp(t, 0, 1));

// ---------------------------------------------------------------------------
// Shared per-context resources

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const crackleCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

function seededNoise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const length = Math.floor(ctx.sampleRate * 2);
    buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = seededNoise(0x9e3779b9);
    for (let i = 0; i < length; i += 1) {
      data[i] = rnd();
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = crackleCache.get(ctx);
  if (!buf) {
    const length = Math.floor(ctx.sampleRate * 3);
    buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = seededNoise(0x51ed270b);
    let hiss = 0;
    for (let i = 0; i < length; i += 1) {
      hiss = hiss * 0.92 + rnd() * 0.08;
      data[i] = hiss * 0.25;
    }
    const pops = Math.floor(3 * 28);
    for (let p = 0; p < pops; p += 1) {
      const at = Math.floor(((rnd() + 1) / 2) * (length - 64));
      const amp = 0.25 + ((rnd() + 1) / 2) * 0.75;
      const sign = rnd() > 0 ? 1 : -1;
      for (let k = 0; k < 24; k += 1) {
        data[at + k] += sign * amp * Math.exp(-k / 4) * (k % 2 === 0 ? 1 : -0.6);
      }
    }
    crackleCache.set(ctx, buf);
  }
  return buf;
}

function periodicPulse(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let map = waveCache.get(ctx);
  if (!map) {
    map = new Map();
    waveCache.set(ctx, map);
  }
  const key = `pulse${duty}`;
  let wave = map.get(key);
  if (!wave) {
    const n = 40;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k += 1) {
      real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
      imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
    }
    wave = ctx.createPeriodicWave(real, imag);
    map.set(key, wave);
  }
  return wave;
}

function setWave(ctx: BaseAudioContext, osc: OscillatorNode, wave: Wave) {
  if (wave === "pulse25") {
    osc.setPeriodicWave(periodicPulse(ctx, 0.25));
  } else if (wave === "pulse12") {
    osc.setPeriodicWave(periodicPulse(ctx, 0.125));
  } else {
    osc.type = wave;
  }
}

// ---------------------------------------------------------------------------
// Envelope with an analytic model of its own value, so retriggers start
// exactly where the previous note is (no discontinuity → no clicks).

class Env {
  private active = false;
  private t0 = 0;
  private v0 = 0;
  private peak = 0;
  private att = 0.001;
  private decTc = 1;
  private sus = 0;
  private rel = Infinity;
  private relTc = 0.05;

  constructor(private readonly param: AudioParam) {}

  private sustainPhase(x: number) {
    const ta = this.t0 + this.att;
    if (x < ta) {
      return this.v0 + (this.peak - this.v0) * ((x - this.t0) / this.att);
    }
    return this.sus + (this.peak - this.sus) * Math.exp(-(x - ta) / this.decTc);
  }

  valueAt(t: number): number {
    if (!this.active) {
      return 0;
    }
    if (t <= this.t0) {
      return this.v0;
    }
    if (t < this.rel) {
      return this.sustainPhase(t);
    }
    return this.sustainPhase(this.rel) * Math.exp(-(t - this.rel) / this.relTc);
  }

  /**
   * Attack to `peak`, exponential decay towards `sus * peak`, release at
   * `releaseAt` (absolute time; Infinity = never, i.e. pure decay).
   */
  trigger(
    t: number,
    peak: number,
    attack: number,
    decayTc: number,
    sustain: number,
    releaseAt: number,
    releaseTc: number,
  ) {
    const p = this.param;
    if (this.active && t <= this.rel) {
      p.cancelScheduledValues(t);
      this.rel = Infinity;
    }
    const v = this.valueAt(t);
    const att = Math.max(0.0005, attack);
    p.setValueAtTime(v, t);
    p.linearRampToValueAtTime(peak, t + att);
    p.setTargetAtTime(peak * sustain, t + att, Math.max(0.001, decayTc));
    const rel = Math.max(releaseAt, t + att);
    if (Number.isFinite(rel)) {
      p.setTargetAtTime(0, rel, Math.max(0.002, releaseTc));
    }
    this.active = true;
    this.t0 = t;
    this.v0 = v;
    this.peak = peak;
    this.att = att;
    this.decTc = Math.max(0.001, decayTc);
    this.sus = peak * sustain;
    this.rel = rel;
    this.relTc = Math.max(0.002, releaseTc);
  }

  reset(t: number) {
    this.param.cancelScheduledValues(t);
    this.param.setValueAtTime(0, t);
    this.active = false;
  }
}

// ---------------------------------------------------------------------------
// Master chain

type Master = {
  input: AudioNode;
  analyser: AnalyserNode;
  volume: GainNode;
  nodes: AudioNode[];
};

function buildMaster(ctx: BaseAudioContext, volume: number): Master {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.006;
  comp.release.value = 0.2;
  const makeup = ctx.createGain();
  makeup.gain.value = 0.8;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.72;
  analyser.minDecibels = -92;
  analyser.maxDecibels = -18;
  const vol = ctx.createGain();
  vol.gain.value = volume;
  comp.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(vol);
  vol.connect(ctx.destination);
  return { input: comp, analyser, volume: vol, nodes: [comp, makeup, limiter, analyser, vol] };
}

// ---------------------------------------------------------------------------
// Song graph: all voices for one song, connected to the master input.

type BarCache = { bar: number; plan: BarPlan; buckets: NoteEvent[][] };

class SongGraph {
  readonly out: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly song: Song;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly pads = new Set<OscillatorNode>();
  private readonly envs: Env[] = [];
  private barCache: BarCache | null = null;

  private readonly duck: GainNode;
  private readonly kickOsc: OscillatorNode;
  private readonly kickEnv: Env;
  private readonly snareEnv: Env;
  private readonly snareToneOsc: OscillatorNode | null;
  private readonly snareToneEnv: Env | null;
  private readonly hatEnv: Env;
  private readonly crashEnv: Env;
  private readonly bassOsc: OscillatorNode;
  private readonly bassSubOsc: OscillatorNode | null;
  private readonly bassFilter: BiquadFilterNode;
  private readonly bassEnv: Env;
  private readonly arpOsc: OscillatorNode;
  private readonly arpEnv: Env;
  private readonly arpFilter: BiquadFilterNode;
  private readonly leadOsc: OscillatorNode;
  private readonly leadEnv: Env;
  private readonly vibrato: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly padBus: GainNode;
  private readonly delayFeedback: GainNode;
  private readonly delayWet: GainNode;
  private bassBase: number;
  private lastLeadEnd = -1;

  constructor(ctx: BaseAudioContext, song: Song, destination: AudioNode) {
    this.ctx = ctx;
    this.song = song;
    const tb = song.timbre;
    const mix = song.mix;
    const t0 = ctx.currentTime;

    const gain = (value: number, to?: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = value;
      if (to) {
        g.connect(to);
      }
      this.nodes.push(g);
      return g;
    };
    const paramGain = (value: number, param: AudioParam) => {
      const g = gain(value);
      g.connect(param);
      return g;
    };
    const filter = (type: BiquadFilterType, freq: number, q: number, to?: AudioNode) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      if (to) {
        f.connect(to);
      }
      this.nodes.push(f);
      return f;
    };
    const osc = (wave: Wave, freq: number, to: AudioNode) => {
      const o = ctx.createOscillator();
      setWave(ctx, o, wave);
      o.frequency.value = freq;
      o.connect(to);
      o.start(t0);
      this.sources.push(o);
      this.nodes.push(o);
      return o;
    };
    const noise = (offset: number, to: AudioNode) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.loop = true;
      src.connect(to);
      src.start(t0, offset);
      this.sources.push(src);
      this.nodes.push(src);
      return src;
    };
    const env = (param: AudioParam) => {
      const e = new Env(param);
      this.envs.push(e);
      return e;
    };

    // Buses
    this.out = gain(0, destination);
    const sum = gain(1);
    if (tb.tape > 0) {
      sum.connect(filter("lowpass", tb.tape, 0.4, this.out));
    } else {
      sum.connect(this.out);
    }
    const drums = gain(1, sum);
    this.duck = gain(1, sum);

    // Tempo-synced feedback delay (wet is ducked too, for that pumping tail)
    const delay = ctx.createDelay(2);
    delay.delayTime.value = clamp((tb.delayBeats * 60) / song.bpm, 0.05, 1.9);
    this.nodes.push(delay);
    const delaySend = gain(1, delay);
    const damp = filter("lowpass", 2600, 0.5);
    delay.connect(damp);
    this.delayFeedback = gain(tb.delayFeedback, delay);
    this.delayWet = gain(tb.delayWet, this.duck);
    damp.connect(this.delayFeedback);
    damp.connect(this.delayWet);

    // Kick
    const kickGain = gain(0, drums);
    this.kickOsc = osc("sine", tb.kickEnd, kickGain);
    this.kickEnv = env(kickGain.gain);

    // Snare / clap: band-passed noise (+ optional tone body)
    const snareGain = gain(0, drums);
    noise(0.0, filter("bandpass", tb.snareNoiseHz, 0.9, snareGain));
    this.snareEnv = env(snareGain.gain);
    if (tb.snareTone > 0) {
      const toneGain = gain(0, drums);
      this.snareToneOsc = osc("triangle", tb.snareTone, toneGain);
      this.snareToneEnv = env(toneGain.gain);
    } else {
      this.snareToneOsc = null;
      this.snareToneEnv = null;
    }

    // Hats (closed/open share a channel → natural choke) and crash
    const hatGain = gain(0, drums);
    // under the lo-fi tape low-pass, hats sit lower so they stay audible (but dull)
    noise(0.71, filter("highpass", tb.tape > 0 ? tb.tape * 0.7 : 7200, 0.7, hatGain));
    this.hatEnv = env(hatGain.gain);
    const crashGain = gain(0, drums);
    noise(1.37, filter("highpass", 4200, 0.5, crashGain));
    this.crashEnv = env(crashGain.gain);

    // Bass: osc (+ sine body) → resonant low-pass with per-note envelope
    const bassBus = gain(mix.bass, this.duck);
    const bassGain = gain(0, bassBus);
    this.bassFilter = filter("lowpass", tb.bassCutoff, tb.bassQ, bassGain);
    this.bassOsc = osc(tb.bassWave, 55, this.bassFilter);
    if (tb.bassSub) {
      this.bassSubOsc = osc("sine", 55, gain(0.6, this.bassFilter));
    } else {
      this.bassSubOsc = null;
    }
    this.bassEnv = env(bassGain.gain);
    this.bassBase = tb.bassCutoff;

    // Arp (mono) → low-pass that follows the arrangement → delay send
    const arpBus = gain(mix.arp, this.duck);
    arpBus.connect(gain(0.55, delaySend));
    this.arpFilter = filter("lowpass", tb.arpCutoff[0], 1.2, arpBus);
    const arpGain = gain(0, this.arpFilter);
    this.arpOsc = osc(tb.arpWave, 440, arpGain);
    this.arpEnv = env(arpGain.gain);

    // Lead (mono, glide + delayed vibrato) → delay send
    const leadBus = gain(mix.lead, this.duck);
    leadBus.connect(gain(0.45, delaySend));
    const leadFilter = filter("lowpass", tb.leadCutoff, 0.6, leadBus);
    const leadGain = gain(0, leadFilter);
    this.leadOsc = osc(tb.leadWave, 440, leadGain);
    this.leadEnv = env(leadGain.gain);
    this.vibrato = paramGain(0, this.leadOsc.detune);
    osc("sine", 5.4, this.vibrato);

    // Pads: per-chord oscillators into a shared, LFO-swept low-pass
    this.padBus = gain(mix.pad, this.duck);
    if (song.style === "ambient") {
      this.padBus.connect(gain(0.35, delaySend));
    }
    this.padFilter = filter("lowpass", tb.padCutoff[0], 0.7, this.padBus);
    const lfoDepth = paramGain(tb.padCutoff[0] * 0.45, this.padFilter.frequency);
    osc("sine", tb.lfoRate, lfoDepth);

    if (tb.crackle) {
      const crackle = ctx.createBufferSource();
      crackle.buffer = crackleBuffer(ctx);
      crackle.loop = true;
      crackle.connect(gain(0.09, sum));
      crackle.start(t0);
      this.sources.push(crackle);
      this.nodes.push(crackle);
    }
  }

  /** Apply per-bar arrangement automation (filter sweeps). */
  private applyBar(plan: BarPlan, t: number, immediate: boolean) {
    const tb = this.song.timbre;
    const padHz = expLerp(tb.padCutoff, plan.cutoff);
    const arpHz = expLerp(tb.arpCutoff, plan.cutoff);
    const tc = immediate ? 0.01 : this.song.barSec / 4;
    this.padFilter.frequency.setTargetAtTime(padHz, t, tc);
    this.arpFilter.frequency.setTargetAtTime(arpHz, t, tc);
    this.bassBase = tb.bassCutoff * (0.6 + 0.8 * plan.cutoff);
  }

  private bar(bar: number): BarCache {
    if (this.barCache && this.barCache.bar === bar) {
      return this.barCache;
    }
    const plan = planBar(this.song, bar);
    const buckets: NoteEvent[][] = Array.from({ length: STEPS_PER_BAR }, () => []);
    for (const ev of plan.events) {
      buckets[clamp(Math.floor(ev.step), 0, STEPS_PER_BAR - 1)].push(ev);
    }
    this.barCache = { bar, plan, buckets };
    return this.barCache;
  }

  /** Schedule every event that starts on global 16th `step` at time `t`. */
  scheduleStep(step: number, t: number) {
    const barIndex = Math.floor(step / STEPS_PER_BAR);
    const s = step - barIndex * STEPS_PER_BAR;
    const cache = this.bar(barIndex);
    if (s === 0) {
      this.applyBar(cache.plan, t, false);
    }
    const stepSec = this.song.stepSec;
    const swing = s % 2 === 1 ? this.song.swing * stepSec : 0;
    for (const ev of cache.buckets[s]) {
      const frac = ev.step - s;
      this.trigger(ev, t + frac * stepSec + (frac === 0 ? swing : 0));
    }
  }

  /**
   * Prepare to start playback at song position `pos` (seconds) at context
   * time `t`: fade in, set filters for the bar, and re-trigger pad chords
   * that started before `pos` and would still be sounding.
   */
  prime(pos: number, t: number) {
    const song = this.song;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(1, t + FADE_SEC);
    const stepPos = pos / song.stepSec;
    const bar = Math.floor(stepPos / STEPS_PER_BAR);
    if (bar >= song.totalBars) {
      return;
    }
    this.applyBar(this.bar(bar).plan, t, true);
    for (let b = Math.max(0, bar - 2); b <= bar; b += 1) {
      const plan = planBar(song, b);
      for (const ev of plan.events) {
        if (ev.inst !== "pad") {
          continue;
        }
        const start = b * STEPS_PER_BAR + ev.step;
        const end = start + ev.len;
        if (start < stepPos - 1e-6 && end > stepPos + 1) {
          this.padNote(ev.midi, ev.vel, t, (end - stepPos) * song.stepSec, true);
        }
      }
    }
  }

  /** Fade out from `now`, then silence every voice; returns when it is quiet. */
  stop(now: number): number {
    const g = this.out.gain;
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.linearRampToValueAtTime(0, now + FADE_SEC);
    const quiet = now + FADE_SEC + 0.005;
    for (const e of this.envs) {
      e.reset(quiet);
    }
    this.duck.gain.cancelScheduledValues(quiet);
    this.duck.gain.setValueAtTime(1, quiet);
    this.vibrato.gain.cancelScheduledValues(quiet);
    this.vibrato.gain.setValueAtTime(0, quiet);
    // Drop pitch/filter automation of notes that were scheduled past `quiet`
    // so they can't leak into the notes scheduled after the restart.
    const params: (AudioParam | undefined)[] = [
      this.kickOsc.frequency,
      this.snareToneOsc?.frequency,
      this.bassOsc.frequency,
      this.bassSubOsc?.frequency,
      this.bassFilter.frequency,
      this.arpOsc.frequency,
      this.leadOsc.frequency,
      this.padFilter.frequency,
      this.arpFilter.frequency,
    ];
    for (const param of params) {
      param?.cancelScheduledValues(quiet);
    }
    for (const o of this.pads) {
      try {
        o.stop(quiet);
      } catch {
        // already stopped
      }
    }
    // Flush the delay line so old echoes don't bleed into the new position.
    const tb = this.song.timbre;
    const flushUntil = quiet + 2.05;
    for (const [param, value] of [
      [this.delayFeedback.gain, tb.delayFeedback],
      [this.delayWet.gain, tb.delayWet],
    ] as const) {
      param.cancelScheduledValues(quiet);
      param.setValueAtTime(0, quiet);
      param.setValueAtTime(value, flushUntil);
    }
    this.lastLeadEnd = -1;
    this.barCache = null;
    return quiet;
  }

  dispose() {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // not started / already stopped
      }
    }
    for (const o of this.pads) {
      try {
        o.stop();
      } catch {
        // ignore
      }
    }
    this.pads.clear();
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
  }

  private padNote(midi: number, vel: number, t: number, durSec: number, soft = false) {
    const ctx = this.ctx;
    const tb = this.song.timbre;
    const voices = tb.padVoices;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.padFilter);
    const peak = vel / voices;
    const attack = soft ? Math.min(tb.padAttack, 0.15) : tb.padAttack;
    const end = t + Math.max(durSec, attack);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * tb.padSustain, t + attack, tb.padDecay / 3);
    g.gain.setTargetAtTime(0, end, tb.padRelease / 4);
    const stopAt = end + tb.padRelease * 1.3;
    const hz = midiHz(midi);
    let alive = voices;
    for (let v = 0; v < voices; v += 1) {
      const o = ctx.createOscillator();
      setWave(ctx, o, tb.padWave);
      o.frequency.value = hz;
      o.detune.value = voices > 1 ? (v === 0 ? -1 : 1) * tb.padDetune * 0.5 : 0;
      o.connect(g);
      o.start(t);
      o.stop(stopAt);
      this.pads.add(o);
      o.onended = () => {
        this.pads.delete(o);
        o.disconnect();
        alive -= 1;
        if (alive <= 0) {
          g.disconnect();
        }
      };
    }
  }

  private trigger(ev: NoteEvent, t: number) {
    const song = this.song;
    const tb = song.timbre;
    const mix = song.mix;
    const stepSec = song.stepSec;
    switch (ev.inst) {
      case "kick": {
        const f = this.kickOsc.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(tb.kickStart, t);
        f.exponentialRampToValueAtTime(tb.kickEnd, t + 0.065);
        this.kickEnv.trigger(t, ev.vel * mix.kick, 0.0015, tb.kickDecay / 4, 0, Infinity, 0.05);
        if (song.duck > 0) {
          const d = this.duck.gain;
          d.setTargetAtTime(1 - song.duck * ev.vel, t, 0.004);
          d.setTargetAtTime(1, t + 0.05, 0.09);
        }
        break;
      }
      case "snare": {
        this.snareEnv.trigger(t, ev.vel * mix.snare, 0.001, tb.snareDecay / 4, 0, Infinity, 0.05);
        if (this.snareToneOsc && this.snareToneEnv) {
          const f = this.snareToneOsc.frequency;
          f.cancelScheduledValues(t);
          f.setValueAtTime(tb.snareTone * 1.6, t);
          f.exponentialRampToValueAtTime(tb.snareTone, t + 0.03);
          this.snareToneEnv.trigger(t, ev.vel * mix.snare * 0.55, 0.001, 0.035, 0, Infinity, 0.05);
        }
        break;
      }
      case "clap": {
        const peak = ev.vel * mix.snare;
        this.snareEnv.trigger(t, peak * 0.8, 0.001, 0.005, 0, Infinity, 0.05);
        this.snareEnv.trigger(t + 0.011, peak * 0.85, 0.001, 0.005, 0, Infinity, 0.05);
        this.snareEnv.trigger(t + 0.022, peak, 0.001, tb.snareDecay / 4, 0, Infinity, 0.05);
        break;
      }
      case "hat":
        this.hatEnv.trigger(t, ev.vel * mix.hat, 0.0008, tb.hatDecay / 3.5, 0, Infinity, 0.05);
        break;
      case "openHat":
        this.hatEnv.trigger(t, ev.vel * mix.hat * 0.9, 0.0008, tb.openHatDecay / 3.5, 0, Infinity, 0.05);
        break;
      case "crash":
        this.crashEnv.trigger(t, ev.vel * mix.crash, 0.001, 0.45, 0, Infinity, 0.05);
        break;
      case "bass": {
        const hz = midiHz(ev.midi);
        this.bassOsc.frequency.setValueAtTime(hz, t);
        this.bassSubOsc?.frequency.setValueAtTime(hz, t);
        const f = this.bassFilter.frequency;
        const base = this.bassBase;
        f.cancelScheduledValues(t);
        f.setValueAtTime(base * (1 + tb.bassEnv * ev.vel), t);
        f.setTargetAtTime(base, t + 0.002, tb.bassDecay);
        const dur = ev.len * stepSec;
        this.bassEnv.trigger(t, ev.vel, 0.004, 0.3, 0.75, t + dur * 0.9, 0.025);
        break;
      }
      case "pad":
        this.padNote(ev.midi, ev.vel, t, ev.len * stepSec);
        break;
      case "arp": {
        this.arpOsc.frequency.setValueAtTime(midiHz(ev.midi), t);
        const dur = ev.len * stepSec;
        this.arpEnv.trigger(t, ev.vel, 0.003, tb.arpDecay, tb.arpSustain, t + dur, song.style === "ambient" ? 0.25 : 0.02);
        break;
      }
      case "lead": {
        const hz = midiHz(ev.midi);
        const f = this.leadOsc.frequency;
        const legato = this.lastLeadEnd >= t - 0.03;
        if (tb.leadGlide > 0 && legato) {
          f.setTargetAtTime(hz, t, tb.leadGlide / 2);
        } else {
          f.setValueAtTime(hz, t);
        }
        const dur = ev.len * stepSec;
        this.lastLeadEnd = t + dur;
        const release = song.style === "ambient" ? 0.35 : 0.06;
        this.leadEnv.trigger(t, ev.vel, tb.leadAttack, 0.35, 0.7, t + dur * 0.95, release);
        const vib = this.vibrato.gain;
        vib.cancelScheduledValues(t);
        vib.setValueAtTime(0, t);
        if (tb.leadVibrato > 0 && dur > 0.3) {
          vib.setValueAtTime(0, t + 0.18);
          vib.linearRampToValueAtTime(tb.leadVibrato, t + Math.min(dur, 0.6));
        }
        break;
      }
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Offline rendering (tests / tooling): renders `seconds` of a track starting
// at `offset` into an AudioBuffer using the exact same graph + scheduler.

export async function renderTrackOffline(
  fileName: string,
  options: { seconds?: number; offset?: number; sampleRate?: number } = {},
): Promise<AudioBuffer> {
  const song = createSong(fileName);
  const sampleRate = options.sampleRate ?? 44100;
  const seconds = Math.max(0.1, options.seconds ?? 10);
  const offset = clamp(options.offset ?? 0, 0, song.durationSec);
  const Ctor =
    globalThis.OfflineAudioContext ??
    (globalThis as typeof globalThis & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Ctor) {
    throw new Error("OfflineAudioContext is not available");
  }
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = buildMaster(ctx, 1);
  const graph = new SongGraph(ctx, song, master.input);
  graph.prime(offset, 0);
  const totalSteps = song.totalBars * STEPS_PER_BAR;
  for (let s = Math.ceil(offset / song.stepSec - 1e-6); s < totalSteps; s += 1) {
    const t = s * song.stepSec - offset;
    if (t >= seconds) {
      break;
    }
    graph.scheduleStep(s, t);
  }
  const buffer = await ctx.startRendering();
  graph.dispose();
  return buffer;
}

// ---------------------------------------------------------------------------
// Player

type WindowWithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function createMusicPlayer(): MusicPlayer {
  let ctx: AudioContext | null = null;
  let master: Master | null = null;
  let graph: SongGraph | null = null;
  let song: Song | null = null;
  let playing = false;
  let ended = false;
  let startPos = 0;
  let startCtx = 0;
  let pausedPos = 0;
  let nextStep = 0;
  let volume = 1;
  let token = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let suspendTimer: ReturnType<typeof setTimeout> | null = null;
  const endedCallbacks: (() => void)[] = [];
  let freqData: Uint8Array<ArrayBuffer> | null = null;
  let timeData: Uint8Array<ArrayBuffer> | null = null;
  let binMap: { bins: number; rate: number; lo: Int32Array; hi: Int32Array } | null = null;
  /** Last spectrum, decayed while paused (the suspended analyser is frozen). */
  let spectrumHold = new Float32Array(0);

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const cancelSuspend = () => {
    if (suspendTimer !== null) {
      clearTimeout(suspendTimer);
      suspendTimer = null;
    }
  };
  /** Suspend the context while idle so silent oscillators cost no CPU. */
  const scheduleSuspend = () => {
    cancelSuspend();
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      if (!playing && ctx && ctx.state === "running") {
        void ctx.suspend().catch(() => undefined);
      }
    }, 250);
  };

  const ensureContext = (): AudioContext | null => {
    if (disposed || typeof window === "undefined") {
      return null;
    }
    if (ctx && ctx.state !== "closed") {
      return ctx;
    }
    const w = window as WindowWithWebkit;
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = buildMaster(ctx, volume);
    return ctx;
  };

  const stepTime = (s: number) => startCtx + s * (song?.stepSec ?? 0) - startPos;

  const finish = () => {
    clearTimer();
    playing = false;
    ended = true;
    pausedPos = song?.durationSec ?? 0;
    scheduleSuspend();
    for (const cb of endedCallbacks.slice()) {
      try {
        cb();
      } catch {
        // host callback errors must not break the player
      }
    }
  };

  const tick = () => {
    timer = null;
    if (!playing || !ctx || !graph || !song) {
      return;
    }
    const now = ctx.currentTime;
    const hidden = typeof document !== "undefined" && document.hidden;
    const horizon = now + (hidden ? HIDDEN_SCHEDULE_AHEAD_SEC : SCHEDULE_AHEAD_SEC);
    const totalSteps = song.totalBars * STEPS_PER_BAR;
    while (nextStep < totalSteps) {
      const t = stepTime(nextStep);
      if (t >= horizon) {
        break;
      }
      // Skip steps we are already late for (e.g. after timer throttling).
      if (t >= now - 0.01) {
        graph.scheduleStep(nextStep, t);
      }
      nextStep += 1;
    }
    if (now >= startCtx + (song.durationSec - startPos)) {
      finish();
      return;
    }
    timer = setTimeout(tick, LOOKAHEAD_MS);
  };

  const startAt = (position: number, when: number) => {
    if (!ctx || !graph || !song) {
      return;
    }
    cancelSuspend();
    startPos = clamp(position, 0, song.durationSec);
    startCtx = when;
    nextStep = Math.ceil(startPos / song.stepSec - 1e-6);
    graph.prime(startPos, when);
    playing = true;
    ended = false;
    clearTimer();
    tick();
  };

  const currentTime = () => {
    if (!song) {
      return 0;
    }
    if (playing && ctx) {
      return clamp(startPos + Math.max(0, ctx.currentTime - startCtx), 0, song.durationSec);
    }
    return pausedPos;
  };

  const resumeContext = async (c: AudioContext) => {
    if (c.state === "running") {
      return;
    }
    // Some browsers keep resume() pending without a gesture; don't hang forever.
    await Promise.race([
      c.resume().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  };

  return {
    async play(fileName: string) {
      const nextSong = createSong(fileName);
      const my = (token += 1);
      const c = ensureContext();
      clearTimer();
      cancelSuspend();
      if (graph && c) {
        const old = graph;
        old.stop(c.currentTime);
        setTimeout(() => old.dispose(), 200);
      }
      graph = null;
      playing = false;
      ended = false;
      song = nextSong;
      pausedPos = 0;
      if (!c || !master) {
        return;
      }
      // resume() is called synchronously inside the caller's gesture.
      await resumeContext(c);
      if (my !== token || disposed || !master) {
        return;
      }
      graph = new SongGraph(c, nextSong, master.input);
      startAt(0, c.currentTime + 0.05);
    },

    pause() {
      if (!playing) {
        return;
      }
      pausedPos = currentTime();
      playing = false;
      clearTimer();
      if (ctx && graph) {
        graph.stop(ctx.currentTime);
      }
      scheduleSuspend();
    },

    async resume() {
      if (playing || !song) {
        return;
      }
      const my = (token += 1);
      const c = ensureContext();
      if (!c || !master) {
        return;
      }
      cancelSuspend();
      await resumeContext(c);
      if (my !== token || disposed || !song || !master) {
        return;
      }
      if (ended || pausedPos >= song.durationSec - 0.05) {
        pausedPos = 0;
      }
      if (!graph) {
        graph = new SongGraph(c, song, master.input);
      }
      startAt(pausedPos, c.currentTime + 0.03);
    },

    isPlaying() {
      return playing;
    },

    seek(seconds: number) {
      if (!song) {
        return;
      }
      const target = clamp(Number.isFinite(seconds) ? seconds : 0, 0, Math.max(0, song.durationSec - 0.05));
      if (playing && ctx && graph) {
        clearTimer();
        const quiet = graph.stop(ctx.currentTime);
        startAt(target, quiet + 0.005);
      } else {
        pausedPos = target;
        ended = false;
      }
    },

    currentTime,

    setVolume(v: number) {
      const next = clamp(Number.isFinite(v) ? v : 0, 0, 1);
      if (Math.abs(next - volume) < 0.002) {
        return;
      }
      volume = next;
      if (ctx && master) {
        const g = master.volume.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setTargetAtTime(volume, ctx.currentTime, 0.05);
      }
    },

    getSpectrum(out: Uint8Array) {
      if (!ctx || !master) {
        out.fill(0);
        return;
      }
      if (spectrumHold.length !== out.length) {
        spectrumHold = new Float32Array(out.length);
      }
      if (!playing && ctx.state !== "running") {
        for (let i = 0; i < out.length; i += 1) {
          spectrumHold[i] *= 0.8;
          out[i] = spectrumHold[i] < 1 ? 0 : spectrumHold[i];
        }
        return;
      }
      const analyser = master.analyser;
      const n = analyser.frequencyBinCount;
      if (!freqData || freqData.length !== n) {
        freqData = new Uint8Array(n);
      }
      analyser.getByteFrequencyData(freqData);
      const bins = out.length;
      if (!binMap || binMap.bins !== bins || binMap.rate !== ctx.sampleRate) {
        const binHz = ctx.sampleRate / analyser.fftSize;
        const fMin = 32;
        const fMax = Math.min(16000, ctx.sampleRate * 0.45);
        const lo = new Int32Array(bins);
        const hi = new Int32Array(bins);
        for (let i = 0; i < bins; i += 1) {
          const f0 = fMin * Math.pow(fMax / fMin, i / bins);
          const f1 = fMin * Math.pow(fMax / fMin, (i + 1) / bins);
          lo[i] = clamp(Math.floor(f0 / binHz), 0, n - 1);
          hi[i] = clamp(Math.max(lo[i], Math.ceil(f1 / binHz) - 1), 0, n - 1);
        }
        binMap = { bins, rate: ctx.sampleRate, lo, hi };
      }
      for (let i = 0; i < bins; i += 1) {
        let m = 0;
        for (let k = binMap.lo[i]; k <= binMap.hi[i]; k += 1) {
          if (freqData[k] > m) {
            m = freqData[k];
          }
        }
        // gentle tilt so highs are visible next to the bass
        out[i] = Math.min(255, Math.round(m * (0.85 + (0.4 * i) / bins)));
        spectrumHold[i] = out[i];
      }
    },

    getWaveform(out: Uint8Array) {
      if (!ctx || !master || (!playing && ctx.state !== "running")) {
        out.fill(128);
        return;
      }
      const analyser = master.analyser;
      if (!timeData || timeData.length !== analyser.fftSize) {
        timeData = new Uint8Array(analyser.fftSize);
      }
      analyser.getByteTimeDomainData(timeData);
      // Use the most recent ~1024 samples so the trace isn't too dense.
      const span = Math.min(timeData.length, 1024);
      const startIndex = timeData.length - span;
      const len = out.length;
      for (let i = 0; i < len; i += 1) {
        out[i] = timeData[startIndex + Math.floor((i * span) / Math.max(1, len))];
      }
    },

    onEnded(cb: () => void) {
      endedCallbacks.push(cb);
    },

    dispose() {
      disposed = true;
      token += 1;
      clearTimer();
      cancelSuspend();
      playing = false;
      graph?.dispose();
      graph = null;
      if (master) {
        for (const node of master.nodes) {
          try {
            node.disconnect();
          } catch {
            // ignore
          }
        }
      }
      master = null;
      if (ctx) {
        void ctx.close().catch(() => undefined);
      }
      ctx = null;
      endedCallbacks.length = 0;
    },
  };
}
