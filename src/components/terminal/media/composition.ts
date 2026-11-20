/**
 * Pure, deterministic song generation for the terminal's procedural `mp3`
 * player. Nothing in here touches Web Audio (or `window`), so it is safe to
 * import during SSR and easy to unit-test. `music.ts` turns the plans produced
 * here into sound.
 *
 * Time grid: 16 steps (16th notes) per 4/4 bar. Every per-track parameter is
 * derived from a seeded RNG keyed by the file's base name, so a given file
 * always produces the same song.
 */

export const STEPS_PER_BAR = 16;
export const MIN_DURATION_SEC = 90;
export const MAX_DURATION_SEC = 180;
/** Silence/release time appended after the last bar so pads can ring out. */
export const TAIL_SEC = 2.5;
export const ARTIST = "KININ Synth";

// ---------------------------------------------------------------------------
// Types

export type Style = "synthwave" | "chiptune" | "lofi" | "techno" | "ambient";
export const STYLES: readonly Style[] = [
  "synthwave",
  "chiptune",
  "lofi",
  "techno",
  "ambient",
];
export const STYLE_LABEL: Record<Style, string> = {
  synthwave: "synthwave",
  chiptune: "chiptune",
  lofi: "lo-fi",
  techno: "techno",
  ambient: "ambient",
};

export type ModeName =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian";

export const SCALES: Record<ModeName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** Oscillator shapes the engine knows; pulse shapes are PeriodicWaves. */
export type Wave =
  | "sine"
  | "triangle"
  | "square"
  | "sawtooth"
  | "pulse25"
  | "pulse12";

export type Instrument =
  | "kick"
  | "snare"
  | "clap"
  | "hat"
  | "openHat"
  | "crash"
  | "bass"
  | "pad"
  | "arp"
  | "lead";

/**
 * One note/hit inside a bar. `step` is in 16ths from the bar start and may be
 * fractional (e.g. 32nd-note arpeggios); `len` is in 16ths and may run past
 * the bar. Drums carry `midi: 0`.
 */
export type NoteEvent = {
  inst: Instrument;
  step: number;
  len: number;
  midi: number;
  vel: number;
};

export type SectionKind = "intro" | "A" | "B" | "break" | "outro";

export type Section = {
  kind: SectionKind;
  /** Unique label, e.g. "intro", "A1", "B1", "break", "A2", "outro". */
  name: string;
  startBar: number;
  bars: number;
  /** Chord roots as 0-based scale degrees. */
  progression: readonly number[];
};

export type Layers = {
  kick: boolean;
  snare: boolean;
  hats: boolean;
  openHats: boolean;
  bass: boolean;
  pad: boolean;
  arp: boolean;
  lead: boolean;
};

export type BassTone = "R" | "O" | "F";
export type BassNote = { step: number; len: number; tone: BassTone };

/**
 * Lead motif note, chord-relative so the same motif fits any chord:
 * - "chord": land on a chord tone; value -1/0/+1 = nearest below/any/above
 * - "step":  move `value` scale steps from the previous note
 * - "root":  resolve to the chord root nearest the previous note
 */
export type MotifNote = {
  step: number;
  len: number;
  kind: "chord" | "step" | "root";
  value: number;
};
export type Motif = { main: MotifNote[]; alt: MotifNote[] };

export type Mix = {
  kick: number;
  snare: number;
  hat: number;
  crash: number;
  bass: number;
  pad: number;
  arp: number;
  lead: number;
};

export type Timbre = {
  bassWave: Wave;
  bassSub: boolean;
  bassCutoff: number;
  bassEnv: number;
  bassQ: number;
  bassDecay: number;
  padWave: Wave;
  padVoices: 1 | 2;
  padDetune: number;
  padAttack: number;
  padDecay: number;
  padSustain: number;
  padRelease: number;
  padCutoff: readonly [number, number];
  arpWave: Wave;
  arpDecay: number;
  arpSustain: number;
  arpCutoff: readonly [number, number];
  leadWave: Wave;
  leadGlide: number;
  leadVibrato: number;
  leadAttack: number;
  leadCutoff: number;
  kickStart: number;
  kickEnd: number;
  kickDecay: number;
  snareTone: number;
  snareNoiseHz: number;
  snareDecay: number;
  hatDecay: number;
  openHatDecay: number;
  delayBeats: number;
  delayFeedback: number;
  delayWet: number;
  lfoRate: number;
  /** Master low-pass in Hz for the lo-fi "tape" colour (0 = off). */
  tape: number;
  crackle: boolean;
};

export type ArpSpec = {
  /** Steps between arp notes (0.5 = 32nds, 1 = 16ths, 2 = 8ths). */
  rate: number;
  /** Index sequence into the voiced chord-tone list. */
  seq: number[];
  /** Gate per arp slot (cycled); false = rest. */
  gates: boolean[];
  /** Note length as a fraction of `rate`. */
  gate: number;
  octaves: 1 | 2;
};

export type PadMode = "sustain" | "restrike" | "stab" | "none";

export type Song = {
  id: string;
  title: string;
  artist: string;
  seed: number;
  style: Style;
  styleLabel: string;
  bpm: number;
  stepSec: number;
  barSec: number;
  keyPc: number;
  mode: ModeName;
  scale: readonly number[];
  keyName: string;
  progressionA: readonly number[];
  progressionB: readonly number[];
  chordBars: number;
  phraseBars: number;
  sevenths: boolean;
  swing: number;
  duck: number;
  sections: Section[];
  totalBars: number;
  /** Total length in seconds including the release tail (integer). */
  durationSec: number;
  kickA: number[];
  kickB: number[];
  snare: number[];
  snareInst: "snare" | "clap";
  hats: number[];
  openHats: number[];
  bassA: BassNote[];
  bassB: BassNote[];
  padMode: PadMode;
  padStabs: number[];
  arp: ArpSpec;
  motifA: Motif;
  motifB: Motif;
  leadAnchor: number;
  registers: { bassLo: number; padLo: number; arpLo: number; leadTonic: number };
  mix: Mix;
  timbre: Timbre;
};

export type BarPlan = {
  bar: number;
  sectionIndex: number;
  section: SectionKind;
  barInSection: number;
  chordDegree: number;
  /** Pad voicing (MIDI) of the bar's chord. */
  chord: number[];
  /** 0..1 brightness for the filter sweep of this bar. */
  cutoff: number;
  /** Section level multiplier already applied to event velocities. */
  level: number;
  layers: Layers;
  events: NoteEvent[];
};

export type TrackInfo = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  durationSec: number;
  style: string;
};

// ---------------------------------------------------------------------------
// Seeded randomness

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mixSeed(a: number, b: number): number {
  let h = (a ^ Math.imul((b + 0x9e3779b9) | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];
const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// ---------------------------------------------------------------------------
// Names

function baseName(fileName: string): string {
  const base = String(fileName ?? "")
    .trim()
    .split(/[\\/]/)
    .pop();
  return (base ?? "").replace(/\.[a-z0-9]{1,5}$/i, "").trim();
}

/** Stable id used for seeding: lower-case base name without extension. */
export function trackIdFromFileName(fileName: string): string {
  return baseName(fileName).toLowerCase() || "untitled";
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

/** "neon_drive.mp3" → "Neon Drive", "synth2.mp3" → "Synth II". */
export function titleFromFileName(fileName: string): string {
  const spaced = baseName(fileName)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");
  const words = spaced.split(/[\s_\-.+~]+/).filter(Boolean);
  if (!words.length) {
    return "Untitled";
  }
  return words
    .map((word, index) => {
      if (/^\d+$/.test(word)) {
        const n = Number(word);
        const isTrailingNumber = index === words.length - 1 && index > 0;
        return isTrailingNumber && n >= 2 && n <= 12 ? ROMAN[n] : word;
      }
      if (index > 0 && SMALL_WORDS.has(word.toLowerCase())) {
        return word.toLowerCase();
      }
      if (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word; // keep acronyms like "DJ"
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Styles for the file names the site ships with. */
export const KNOWN_TRACK_STYLES: Readonly<Record<string, Style>> = {
  synth: "synthwave",
  synth2: "chiptune",
  synth3: "lofi",
  neon_drive: "synthwave",
  circuit_beat: "techno",
  glow_shift: "lofi",
  horizon_chords: "ambient",
  pulse_echo: "chiptune",
  retro_wave: "synthwave",
};

const STYLE_KEYWORDS: readonly [RegExp, Style][] = [
  [/chip|8.?bit|pixel|arcade|game|nes\b|gameboy|bleep/, "chiptune"],
  [/lo.?fi|chill|rain|study|jazz|cafe|coffee|tape|dust|vinyl|sleepy/, "lofi"],
  [/ambient|drift|space|dream|cloud|horizon|ocean|calm|float|aurora|nebula/, "ambient"],
  [/techno|beat|club|acid|rave|machine|circuit|warehouse|bass/, "techno"],
  [/synth|wave|neon|retro|drive|night|sunset|outrun|grid|80s/, "synthwave"],
];

export function styleForTrackId(id: string, seed = hashString(id)): Style {
  const known = KNOWN_TRACK_STYLES[id];
  if (known) {
    return known;
  }
  for (const [pattern, style] of STYLE_KEYWORDS) {
    if (pattern.test(id)) {
      return style;
    }
  }
  return STYLES[mixSeed(seed, 7) % STYLES.length];
}

const SHARP_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function keyName(keyPc: number, mode: ModeName): string {
  const majorish = mode === "major" || mode === "lydian" || mode === "mixolydian";
  return `${(majorish ? FLAT_NAMES : SHARP_NAMES)[mod(keyPc, 12)]} ${mode}`;
}

// ---------------------------------------------------------------------------
// Harmony helpers

/** Semitones above the tonic for an (unbounded) scale degree. */
export function degreeSemis(scale: readonly number[], degree: number): number {
  return 12 * Math.floor(degree / 7) + scale[mod(degree, 7)];
}

export function isDiminished(scale: readonly number[], degree: number): boolean {
  const root = degreeSemis(scale, degree);
  return degreeSemis(scale, degree + 4) - root === 6;
}

/** Pitch classes of the chord built in thirds on `degree`. */
export function chordPitchClasses(song: Pick<Song, "keyPc" | "scale" | "sevenths">, degree: number): number[] {
  const count = song.sevenths ? 4 : 3;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(mod(song.keyPc + degreeSemis(song.scale, degree + 2 * i), 12));
  }
  return out;
}

/** Place pitch classes in the octave window [lo, lo + 11], ascending. */
export function voiceInWindow(pcs: readonly number[], lo: number): number[] {
  return pcs.map((pc) => lo + mod(pc - lo, 12)).sort((a, b) => a - b);
}

function pcToWindow(pc: number, lo: number) {
  return lo + mod(pc - lo, 12);
}

// ---------------------------------------------------------------------------
// Style profiles

type Cell = readonly (readonly [number, number])[];
type ArpOrder = "up" | "down" | "updown" | "pattern";

type StyleProfile = {
  bpm: readonly [number, number];
  modes: readonly ModeName[];
  progressions: readonly (readonly number[])[];
  chordBars: readonly number[];
  sevenths: number;
  swing: readonly [number, number];
  duck: readonly [number, number];
  kickA: readonly string[];
  kickB: readonly string[];
  snare: readonly string[];
  snareInst: "snare" | "clap";
  hats: readonly string[];
  openHats: readonly string[];
  bassA: readonly string[];
  bassB: readonly string[];
  arpRates: readonly number[];
  arpOrders: readonly ArpOrder[];
  arpDensity: number;
  arpGate: number;
  arpOctaves: 1 | 2;
  padMode: PadMode;
  padStabs: readonly string[];
  cells: readonly Cell[];
  cadences: readonly Cell[];
  registers: { bassLo: number; padLo: number; arpLo: number; leadLo: number };
  mix: Mix;
  timbre: (rng: Rng) => Timbre;
};

const MINOR_PROGS = [
  [0, 5, 2, 6], // i–VI–III–VII
  [0, 6, 5, 6], // i–VII–VI–VII
  [0, 3, 5, 4], // i–iv–VI–v
  [0, 5, 3, 6], // i–VI–iv–VII
  [0, 2, 6, 5], // i–III–VII–VI
  [0, 3, 6, 2], // i–iv–VII–III
  [0, 3, 0, 6], // i–IV–i–VII (dorian friendly)
  [0, 6, 3, 3], // i–VII–IV–IV
];
const MAJOR_PROGS = [
  [0, 4, 5, 3], // I–V–vi–IV
  [5, 3, 0, 4], // vi–IV–I–V
  [0, 5, 3, 4], // I–vi–IV–V
  [0, 3, 5, 4], // I–IV–vi–V
  [0, 3, 0, 4], // I–IV–I–V
  [0, 6, 3, 0], // I–bVII–IV–I (mixolydian)
  [0, 1, 5, 4], // I–II–vi–V (lydian)
];

const VEL: Record<string, number> = { X: 1, x: 0.8, o: 0.58, "-": 0.36 };

const SYNTH_CELLS: Cell[] = [
  [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]],
  [[0, 3], [3, 3], [6, 2], [8, 8]],
  [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
];
const SYNTH_CADENCES: Cell[] = [
  [[0, 4], [4, 12]],
  [[0, 2], [2, 2], [4, 12]],
  [[0, 6], [6, 10]],
];
const CHIP_CELLS: Cell[] = [
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2], [8, 2], [10, 2], [12, 4]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 3], [3, 3], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 2], [2, 1], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]],
];
const CHIP_CADENCES: Cell[] = [
  [[0, 2], [2, 2], [4, 2], [6, 10]],
  [[0, 4], [4, 4], [8, 8]],
];
const LOFI_CELLS: Cell[] = [
  [[0, 6], [6, 2], [10, 6]],
  [[2, 4], [6, 2], [8, 8]],
  [[0, 3], [3, 3], [6, 10]],
  [[4, 2], [6, 2], [8, 4], [14, 2]],
];
const LOFI_CADENCES: Cell[] = [[[0, 16]], [[0, 4], [6, 10]]];
const TECHNO_CELLS: Cell[] = [
  [[0, 2], [3, 2], [6, 2], [10, 2]],
  [[0, 1], [2, 1], [4, 2], [8, 1], [11, 2]],
  [[3, 2], [6, 2], [11, 3]],
];
const TECHNO_CADENCES: Cell[] = [[[0, 4], [6, 2], [10, 6]]];
const AMBIENT_CELLS: Cell[] = [
  [[0, 8], [8, 8]],
  [[0, 12], [12, 4]],
  [[0, 4], [4, 12]],
  [[0, 16]],
];
const AMBIENT_CADENCES: Cell[] = [[[0, 16]]];

const PROFILES: Record<Style, StyleProfile> = {
  synthwave: {
    bpm: [92, 118],
    modes: ["minor", "minor", "minor", "dorian", "major"],
    progressions: [...MINOR_PROGS.slice(0, 6), ...MAJOR_PROGS.slice(0, 4)],
    chordBars: [1, 1, 2],
    sevenths: 0.15,
    swing: [0, 0],
    duck: [0.35, 0.55],
    kickA: ["x.......x.......", "x.......x.x....."],
    kickB: ["x...x...x...x...", "x.......x.x....."],
    snare: ["....X.......X..."],
    snareInst: "snare",
    hats: ["o.x.o.x.o.x.o.x.", "o-x-o-x-o-x-o-x-", "x.x.x.x.x.x.x.x."],
    openHats: ["..............x.", "......x.......x."],
    bassA: ["R_R_R_R_R_R_R_R_", "R_O_R_O_R_O_R_O_", "R_RRR_RRR_RRR_RR"],
    bassB: ["R_O_R_O_R_O_R_O_", "R_R_O_R_R_R_O_R_"],
    arpRates: [1],
    arpOrders: ["up", "updown", "pattern"],
    arpDensity: 1,
    arpGate: 0.7,
    arpOctaves: 2,
    padMode: "sustain",
    padStabs: [],
    cells: SYNTH_CELLS,
    cadences: SYNTH_CADENCES,
    registers: { bassLo: 31, padLo: 55, arpLo: 62, leadLo: 62 },
    mix: { kick: 0.95, snare: 1.0, hat: 0.33, crash: 0.27, bass: 0.14, pad: 0.09, arp: 0.135, lead: 0.14 },
    timbre: (rng) => ({
      bassWave: pick(rng, ["sawtooth", "square"] as const),
      bassSub: true,
      bassCutoff: between(rng, 320, 520),
      bassEnv: between(rng, 1.8, 3),
      bassQ: between(rng, 3, 6),
      bassDecay: between(rng, 0.07, 0.13),
      padWave: "sawtooth",
      padVoices: 2,
      padDetune: between(rng, 8, 14),
      padAttack: between(rng, 0.35, 0.7),
      padDecay: 1.2,
      padSustain: 0.85,
      padRelease: between(rng, 0.7, 1.2),
      padCutoff: [450, 3000],
      arpWave: pick(rng, ["square", "sawtooth"] as const),
      arpDecay: between(rng, 0.07, 0.12),
      arpSustain: 0.3,
      arpCutoff: [900, 5200],
      leadWave: pick(rng, ["sawtooth", "square"] as const),
      leadGlide: 0.025,
      leadVibrato: between(rng, 12, 20),
      leadAttack: 0.012,
      leadCutoff: 3600,
      kickStart: 145,
      kickEnd: 47,
      kickDecay: 0.42,
      snareTone: 185,
      snareNoiseHz: 1800,
      snareDecay: 0.22,
      hatDecay: 0.045,
      openHatDecay: 0.26,
      delayBeats: 0.75,
      delayFeedback: between(rng, 0.3, 0.4),
      delayWet: between(rng, 0.22, 0.3),
      lfoRate: between(rng, 0.06, 0.14),
      tape: 0,
      crackle: false,
    }),
  },
  chiptune: {
    bpm: [128, 152],
    modes: ["major", "major", "minor", "mixolydian"],
    progressions: [...MAJOR_PROGS, ...MINOR_PROGS.slice(0, 5)],
    chordBars: [1],
    sevenths: 0,
    swing: [0, 0],
    duck: [0.12, 0.22],
    kickA: ["x.......x.x.....", "x.....x.x......."],
    kickB: ["x.....x.x.x.....", "x.......x.x....."],
    snare: ["....x.......x...", "....x.......x..x"],
    snareInst: "snare",
    hats: ["x.x.x.x.x.x.x.x.", "..x...x...x...x."],
    openHats: ["..............x."],
    bassA: ["R_O_R_O_R_O_R_O_", "R_R_F_R_O_R_F_R_"],
    bassB: ["R_O_F_O_R_O_F_O_", "RRO_RRO_RRO_RRO_"],
    arpRates: [0.5],
    arpOrders: ["up", "updown"],
    arpDensity: 1,
    arpGate: 1,
    arpOctaves: 1,
    padMode: "none",
    padStabs: [],
    cells: CHIP_CELLS,
    cadences: CHIP_CADENCES,
    registers: { bassLo: 38, padLo: 60, arpLo: 64, leadLo: 67 },
    mix: { kick: 0.75, snare: 0.8, hat: 0.3, crash: 0.2, bass: 0.16, pad: 0, arp: 0.11, lead: 0.07 },
    timbre: (rng) => ({
      bassWave: "triangle",
      bassSub: false,
      bassCutoff: 7000,
      bassEnv: 0,
      bassQ: 0.5,
      bassDecay: 0.1,
      padWave: "square",
      padVoices: 1,
      padDetune: 0,
      padAttack: 0.01,
      padDecay: 0.3,
      padSustain: 0.6,
      padRelease: 0.1,
      padCutoff: [2000, 6000],
      arpWave: pick(rng, ["pulse12", "pulse25"] as const),
      arpDecay: 0.2,
      arpSustain: 0.85,
      arpCutoff: [3000, 9000],
      leadWave: pick(rng, ["pulse25", "square", "pulse12"] as const),
      leadGlide: 0,
      leadVibrato: between(rng, 18, 30),
      leadAttack: 0.004,
      leadCutoff: 9000,
      kickStart: 230,
      kickEnd: 55,
      kickDecay: 0.18,
      snareTone: 240,
      snareNoiseHz: 3200,
      snareDecay: 0.14,
      hatDecay: 0.03,
      openHatDecay: 0.16,
      delayBeats: 0.75,
      delayFeedback: 0.2,
      delayWet: 0.1,
      lfoRate: 0.1,
      tape: 0,
      crackle: false,
    }),
  },
  lofi: {
    bpm: [70, 88],
    modes: ["dorian", "major", "minor", "dorian"],
    progressions: [
      [1, 4, 0, 5],
      [3, 4, 2, 5],
      [3, 2, 1, 0],
      [1, 4, 0, 0],
      [0, 3, 0, 3],
      [0, 5, 1, 4],
    ],
    chordBars: [1, 2],
    sevenths: 1,
    swing: [0.16, 0.28],
    duck: [0.15, 0.28],
    kickA: ["x.........x.....", "x......x..x.....", "x.........x..x.."],
    kickB: ["x.........x.....", "x......x..x....."],
    snare: ["....x.......x...", "....x..-....x..."],
    snareInst: "snare",
    hats: ["o.x.o.x.o.x.o-x.", "x.o.x.o.x.o.x.o-"],
    openHats: ["..............o."],
    bassA: ["R_____.R__F_____", "R_______R___F___", "R_____R_.FR_____"],
    bassB: ["R_____.R__F_____", "R_______R___F___"],
    arpRates: [2],
    arpOrders: ["pattern"],
    arpDensity: 0.55,
    arpGate: 1.4,
    arpOctaves: 2,
    padMode: "restrike",
    padStabs: [],
    cells: LOFI_CELLS,
    cadences: LOFI_CADENCES,
    registers: { bassLo: 31, padLo: 55, arpLo: 64, leadLo: 64 },
    mix: { kick: 0.85, snare: 1.1, hat: 0.3, crash: 0.12, bass: 0.15, pad: 0.14, arp: 0.1, lead: 0.1 },
    timbre: (rng) => ({
      bassWave: pick(rng, ["sine", "triangle"] as const),
      bassSub: false,
      bassCutoff: 600,
      bassEnv: 0.5,
      bassQ: 0.7,
      bassDecay: 0.2,
      padWave: "triangle",
      padVoices: 2,
      padDetune: between(rng, 3, 7),
      padAttack: 0.012,
      padDecay: between(rng, 0.5, 0.9),
      padSustain: 0.35,
      padRelease: 0.45,
      padCutoff: [700, 2600],
      arpWave: "sine",
      arpDecay: 0.25,
      arpSustain: 0,
      arpCutoff: [1500, 4000],
      leadWave: pick(rng, ["triangle", "sine"] as const),
      leadGlide: 0.04,
      leadVibrato: between(rng, 6, 12),
      leadAttack: 0.03,
      leadCutoff: 2600,
      kickStart: 120,
      kickEnd: 44,
      kickDecay: 0.36,
      snareTone: 175,
      snareNoiseHz: 1500,
      snareDecay: 0.16,
      hatDecay: 0.035,
      openHatDecay: 0.18,
      delayBeats: 0.5,
      delayFeedback: 0.28,
      delayWet: 0.16,
      lfoRate: between(rng, 0.08, 0.2),
      tape: between(rng, 3000, 4200),
      crackle: true,
    }),
  },
  techno: {
    bpm: [122, 132],
    modes: ["minor", "phrygian", "minor", "dorian"],
    progressions: [
      [0, 0, 5, 6],
      [0, 3, 0, 3],
      [0, 0, 0, 6],
      [0, 5, 0, 6],
      [0, 0, 3, 3],
    ],
    chordBars: [1, 2],
    sevenths: 0.3,
    swing: [0, 0.06],
    duck: [0.45, 0.65],
    kickA: ["x...x...x...x..."],
    kickB: ["x...x...x...x..."],
    snare: ["....x.......x..."],
    snareInst: "clap",
    hats: ["o-.-o-.-o-.-o-.-", "o-x-o-x-o-x-o-x-"],
    openHats: ["..x...x...x...x."],
    bassA: [".RRR.RRR.RRR.RRR", "..R_..R_..R_..R_", "..RR..RR..RR..RR"],
    bassB: [".RRO.RRO.RRO.RRO", "..R_..O_..R_..F_"],
    arpRates: [1],
    arpOrders: ["pattern"],
    arpDensity: 0.7,
    arpGate: 0.6,
    arpOctaves: 2,
    padMode: "stab",
    padStabs: ["...x......x.....", "..x..x....x..x..", "......x.......x."],
    cells: TECHNO_CELLS,
    cadences: TECHNO_CADENCES,
    registers: { bassLo: 31, padLo: 55, arpLo: 60, leadLo: 62 },
    mix: { kick: 0.6, snare: 1.5, hat: 0.24, crash: 0.2, bass: 0.16, pad: 0.18, arp: 0.15, lead: 0.07 },
    timbre: (rng) => ({
      bassWave: "sawtooth",
      bassSub: true,
      bassCutoff: between(rng, 220, 380),
      bassEnv: between(rng, 3, 5),
      bassQ: between(rng, 8, 13),
      bassDecay: between(rng, 0.06, 0.11),
      padWave: "sawtooth",
      padVoices: 2,
      padDetune: between(rng, 6, 12),
      padAttack: 0.004,
      padDecay: 0.12,
      padSustain: 0.25,
      padRelease: 0.12,
      padCutoff: [500, 2600],
      arpWave: pick(rng, ["square", "sawtooth"] as const),
      arpDecay: 0.06,
      arpSustain: 0.15,
      arpCutoff: [700, 3800],
      leadWave: "square",
      leadGlide: 0,
      leadVibrato: 0,
      leadAttack: 0.004,
      leadCutoff: 2400,
      kickStart: 165,
      kickEnd: 46,
      kickDecay: 0.48,
      snareTone: 0,
      snareNoiseHz: 1250,
      snareDecay: 0.2,
      hatDecay: 0.03,
      openHatDecay: 0.17,
      delayBeats: 0.75,
      delayFeedback: between(rng, 0.38, 0.5),
      delayWet: between(rng, 0.18, 0.26),
      lfoRate: between(rng, 0.05, 0.1),
      tape: 0,
      crackle: false,
    }),
  },
  ambient: {
    bpm: [66, 82],
    modes: ["lydian", "major", "minor", "dorian"],
    progressions: [
      [0, 3, 5, 4],
      [0, 4, 3, 3],
      [3, 0, 4, 5],
      [0, 2, 3, 0],
      [0, 1, 5, 4],
      [0, 5, 3, 0],
    ],
    chordBars: [2],
    sevenths: 0.6,
    swing: [0, 0],
    duck: [0, 0.08],
    kickA: ["................"],
    kickB: ["x.......x......."],
    snare: ["........o......."],
    snareInst: "clap",
    hats: ["..o...o...o...o.", "o.-.o.-.o.-.o.-."],
    openHats: ["................"],
    bassA: ["R_______________", "R_______F_______"],
    bassB: ["R_______R_______", "R___________O___"],
    arpRates: [2],
    arpOrders: ["updown", "pattern"],
    arpDensity: 0.65,
    arpGate: 2.5,
    arpOctaves: 2,
    padMode: "sustain",
    padStabs: [],
    cells: AMBIENT_CELLS,
    cadences: AMBIENT_CADENCES,
    registers: { bassLo: 31, padLo: 52, arpLo: 67, leadLo: 62 },
    mix: { kick: 0.55, snare: 0.7, hat: 0.2, crash: 0.1, bass: 0.11, pad: 0.08, arp: 0.075, lead: 0.115 },
    timbre: (rng) => ({
      bassWave: "sine",
      bassSub: false,
      bassCutoff: 400,
      bassEnv: 0,
      bassQ: 0.5,
      bassDecay: 0.4,
      padWave: pick(rng, ["sawtooth", "triangle"] as const),
      padVoices: 2,
      padDetune: between(rng, 8, 14),
      padAttack: between(rng, 1.4, 2.4),
      padDecay: 3,
      padSustain: 0.9,
      padRelease: between(rng, 2, 3),
      padCutoff: [350, 2000],
      arpWave: pick(rng, ["sine", "triangle"] as const),
      arpDecay: 0.45,
      arpSustain: 0,
      arpCutoff: [1200, 4200],
      leadWave: pick(rng, ["sine", "triangle"] as const),
      leadGlide: 0.08,
      leadVibrato: between(rng, 6, 10),
      leadAttack: 0.12,
      leadCutoff: 2400,
      kickStart: 95,
      kickEnd: 42,
      kickDecay: 0.6,
      snareTone: 0,
      snareNoiseHz: 2200,
      snareDecay: 0.18,
      hatDecay: 0.05,
      openHatDecay: 0.3,
      delayBeats: pick(rng, [0.75, 1] as const),
      delayFeedback: between(rng, 0.45, 0.55),
      delayWet: between(rng, 0.3, 0.38),
      lfoRate: between(rng, 0.04, 0.09),
      tape: 0,
      crackle: false,
    }),
  },
};

// ---------------------------------------------------------------------------
// Pattern parsing / generation (exported for tests)

export function parseHits(pattern: string): number[] {
  const out = new Array<number>(STEPS_PER_BAR).fill(0);
  for (let i = 0; i < STEPS_PER_BAR; i += 1) {
    out[i] = VEL[pattern.charAt(i)] ?? 0;
  }
  return out;
}

export function parseBass(pattern: string): BassNote[] {
  const notes: BassNote[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i += 1) {
    const c = pattern.charAt(i);
    if (c === "R" || c === "O" || c === "F") {
      let len = 1;
      while (i + len < STEPS_PER_BAR && pattern.charAt(i + len) === "_") {
        len += 1;
      }
      notes.push({ step: i, len, tone: c });
    }
  }
  return notes;
}

function parseSteps(pattern: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i += 1) {
    if (pattern.charAt(i) !== "." && pattern.charAt(i) !== "") {
      out.push(i);
    }
  }
  return out;
}

function makeArp(rng: Rng, profile: StyleProfile, toneCount: number): ArpSpec {
  const octaves = profile.arpOctaves;
  const n = toneCount * octaves;
  const order = pick(rng, profile.arpOrders);
  let seq: number[];
  if (order === "up") {
    seq = Array.from({ length: n }, (_, i) => i);
  } else if (order === "down") {
    seq = Array.from({ length: n }, (_, i) => n - 1 - i);
  } else if (order === "updown") {
    seq = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 2; i >= 1; i -= 1) {
      seq.push(i);
    }
  } else {
    seq = [0];
    for (let i = 1; i < 8; i += 1) {
      seq.push(Math.floor(rng() * n));
    }
  }
  const slots = 16;
  const gates = Array.from(
    { length: slots },
    (_, i) => i === 0 || rng() < profile.arpDensity,
  );
  return { rate: pick(rng, profile.arpRates), seq, gates, gate: profile.arpGate, octaves };
}

/** Build a 4-bar call-and-response motif: [X, Y, X, cadence]. */
export function makeMotif(rng: Rng, cells: readonly Cell[], cadences: readonly Cell[]): Motif {
  const x = pick(rng, cells);
  let y = pick(rng, cells);
  for (let tries = 0; y === x && cells.length > 1 && tries < 8; tries += 1) {
    y = pick(rng, cells);
  }
  const z = pick(rng, cadences);
  let y2 = pick(rng, cells);
  for (let tries = 0; y2 === y && cells.length > 1 && tries < 8; tries += 1) {
    y2 = pick(rng, cells);
  }
  const z2 = cadences.length > 1 ? pick(rng, cadences) : z;
  const contour = [1, rng() < 0.5 ? 0 : -1, 1, -1];
  const build = (bars: readonly Cell[]) => {
    const local = mulberry32(Math.floor(rng() * 0xffffffff));
    let dir = 1;
    const notes: MotifNote[] = [];
    bars.forEach((cell, b) => {
      cell.forEach(([s, len], i) => {
        const step = b * STEPS_PER_BAR + s;
        const lastOfPhrase = b === bars.length - 1 && i === cell.length - 1;
        if (lastOfPhrase) {
          notes.push({ step, len, kind: "root", value: 0 });
        } else if (i === 0 || len >= 4 || s % 8 === 0) {
          const pref = local() < 0.75 ? contour[b] : -contour[b];
          notes.push({ step, len, kind: "chord", value: pref });
        } else {
          if (local() < 0.3) {
            dir = -dir;
          }
          notes.push({ step, len, kind: "step", value: dir * (local() < 0.8 ? 1 : 2) });
        }
      });
    });
    return notes;
  };
  const main = build([x, y, x, z]);
  const alt = build([x, y2, x, z2]);
  return { main, alt };
}

const LEAD_LO = -2;
const LEAD_HI = 9;

/** Turn a motif into concrete MIDI notes against 4 bars of chord roots. */
export function realizeMotif(
  song: Pick<Song, "scale" | "registers" | "leadAnchor">,
  notes: readonly MotifNote[],
  chordDegrees: readonly number[],
): { step: number; len: number; midi: number }[] {
  let prev = song.leadAnchor;
  const out: { step: number; len: number; midi: number }[] = [];
  for (const note of notes) {
    const bar = Math.min(chordDegrees.length - 1, Math.floor(note.step / STEPS_PER_BAR));
    const root = chordDegrees[bar];
    let degree: number;
    if (note.kind === "step") {
      degree = prev + note.value;
      if (degree < LEAD_LO || degree > LEAD_HI) {
        degree = prev - note.value;
      }
    } else {
      const tones = note.kind === "root" ? [0] : [0, 2, 4];
      const candidates: number[] = [];
      for (let d = LEAD_LO; d <= LEAD_HI; d += 1) {
        if (tones.includes(mod(d - root, 7))) {
          candidates.push(d);
        }
      }
      degree = nearestCandidate(candidates, prev, note.kind === "root" ? 0 : note.value);
    }
    prev = degree;
    out.push({
      step: note.step,
      len: note.len,
      midi: song.registers.leadTonic + degreeSemis(song.scale, degree),
    });
  }
  return out;
}

function nearestCandidate(candidates: number[], prev: number, pref: number): number {
  if (!candidates.length) {
    return prev;
  }
  if (pref > 0) {
    const above = candidates.filter((c) => c > prev);
    if (above.length) {
      return above[0];
    }
  } else if (pref < 0) {
    const below = candidates.filter((c) => c < prev);
    if (below.length) {
      return below[below.length - 1];
    }
  }
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(c - prev) < Math.abs(best - prev)) {
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Arrangement

export function buildArrangement(
  rng: Rng,
  barSec: number,
  baseBars: number,
  progressionA: readonly number[],
  progressionB: readonly number[],
): { sections: Section[]; phraseBars: number; totalBars: number } {
  let phraseBars = baseBars;
  if (phraseBars * barSec < 8) {
    phraseBars *= 2;
  }
  const phraseSec = phraseBars * barSec;
  let introPhrases = phraseSec < 11 ? 2 : 1;
  let hasBreak = rng() < 0.6;
  const target = 105 + rng() * 60;
  const maxN = Math.floor((MAX_DURATION_SEC - TAIL_SEC - 1) / phraseSec);
  const minN = Math.ceil((MIN_DURATION_SEC - TAIL_SEC) / phraseSec);
  let fixed = introPhrases + 1 + (hasBreak ? 1 : 0);
  if (fixed + 3 > maxN && hasBreak) {
    hasBreak = false;
    fixed -= 1;
  }
  if (fixed + 3 > maxN && introPhrases > 1) {
    introPhrases = 1;
    fixed -= 1;
  }
  let n = Math.round(target / phraseSec);
  n = Math.max(n, fixed + 3, minN);
  n = Math.min(n, Math.max(maxN, fixed + 3));
  const core = n - fixed;
  const coreKinds: ("A" | "B")[] = core >= 7 ? ["A", "B", "A", "B"] : ["A", "B", "A"];
  const counts = coreKinds.map(() => 0);
  for (let i = 0; i < core; i += 1) {
    counts[i % coreKinds.length] += 1;
  }

  const sections: Section[] = [];
  let bar = 0;
  const seen = { A: 0, B: 0 };
  const push = (kind: SectionKind, name: string, phrases: number) => {
    const progression = kind === "B" ? progressionB : progressionA;
    sections.push({ kind, name, startBar: bar, bars: phrases * phraseBars, progression });
    bar += phrases * phraseBars;
  };
  push("intro", "intro", introPhrases);
  coreKinds.forEach((kind, index) => {
    seen[kind] += 1;
    push(kind, `${kind}${seen[kind]}`, counts[index]);
    if (index === 1 && hasBreak) {
      push("break", "break", 1);
    }
  });
  push("outro", "outro", 1);
  return { sections, phraseBars, totalBars: bar };
}

// ---------------------------------------------------------------------------
// Song

const songCache = new Map<string, Song>();

export function createSong(fileName: string): Song {
  const id = trackIdFromFileName(fileName);
  const cached = songCache.get(id);
  if (cached) {
    return cached;
  }
  const seed = hashString(`kinin:${id}`);
  const rng = mulberry32(seed);
  const style = styleForTrackId(id, seed);
  const P = PROFILES[style];

  const bpm = Math.round(between(rng, P.bpm[0], P.bpm[1]));
  const stepSec = 60 / bpm / 4;
  const barSec = stepSec * STEPS_PER_BAR;
  const mode = pick(rng, P.modes);
  const scale = SCALES[mode];
  const keyPc = Math.floor(rng() * 12);
  const pool = P.progressions.filter((p) => p.every((d) => !isDiminished(scale, d)));
  const progressionA = pool.length ? pick(rng, pool) : [0, 0, 0, 0];
  const others = pool.filter((p) => p !== progressionA);
  const progressionB = others.length
    ? pick(rng, others)
    : [...progressionA.slice(2), ...progressionA.slice(0, 2)];
  const chordBars = pick(rng, P.chordBars);
  const sevenths = rng() < P.sevenths;
  const swing = between(rng, P.swing[0], P.swing[1]);
  const duck = between(rng, P.duck[0], P.duck[1]);

  const { sections, phraseBars, totalBars } = buildArrangement(
    rng,
    barSec,
    progressionA.length * chordBars,
    progressionA,
    progressionB,
  );
  const durationSec = Math.ceil(totalBars * barSec + TAIL_SEC);

  const toneCount = sevenths ? 4 : 3;
  const arp = makeArp(rng, P, toneCount);
  const motifA = makeMotif(rng, P.cells, P.cadences);
  const motifB = makeMotif(rng, P.cells, P.cadences);
  const leadTonic = pcToWindow(keyPc, P.registers.leadLo);
  const jitter = () => between(rng, 0.9, 1.1);
  const mix: Mix = {
    kick: P.mix.kick * jitter(),
    snare: P.mix.snare * jitter(),
    hat: P.mix.hat * jitter(),
    crash: P.mix.crash,
    bass: P.mix.bass * jitter(),
    pad: P.mix.pad * jitter(),
    arp: P.mix.arp * jitter(),
    lead: P.mix.lead * jitter(),
  };

  const song: Song = {
    id,
    title: titleFromFileName(fileName),
    artist: ARTIST,
    seed,
    style,
    styleLabel: STYLE_LABEL[style],
    bpm,
    stepSec,
    barSec,
    keyPc,
    mode,
    scale,
    keyName: keyName(keyPc, mode),
    progressionA,
    progressionB,
    chordBars,
    phraseBars,
    sevenths,
    swing,
    duck,
    sections,
    totalBars,
    durationSec,
    kickA: parseHits(pick(rng, P.kickA)),
    kickB: parseHits(pick(rng, P.kickB)),
    snare: parseHits(pick(rng, P.snare)),
    snareInst: P.snareInst,
    hats: parseHits(pick(rng, P.hats)),
    openHats: parseHits(pick(rng, P.openHats)),
    bassA: parseBass(pick(rng, P.bassA)),
    bassB: parseBass(pick(rng, P.bassB)),
    padMode: P.padMode,
    padStabs: P.padStabs.length ? parseSteps(pick(rng, P.padStabs)) : [],
    arp,
    motifA,
    motifB,
    leadAnchor: pick(rng, [2, 4, 4, 7]),
    registers: {
      bassLo: P.registers.bassLo,
      padLo: P.registers.padLo,
      arpLo: P.registers.arpLo,
      leadTonic,
    },
    mix,
    timbre: P.timbre(rng),
  };
  if (songCache.size > 64) {
    songCache.clear();
  }
  songCache.set(id, song);
  return song;
}

export function songTrackInfo(song: Song): TrackInfo {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    bpm: song.bpm,
    key: song.keyName,
    durationSec: song.durationSec,
    style: song.styleLabel,
  };
}

// ---------------------------------------------------------------------------
// Bar planning

export function sectionIndexForBar(song: Song, bar: number): number {
  const { sections } = song;
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    if (bar >= sections[i].startBar) {
      return i;
    }
  }
  return 0;
}

export function layersFor(song: Song, section: Section, barInSection: number): Layers {
  const st = song.style;
  const frac = barInSection / section.bars;
  const drums = st !== "ambient";
  const hasPad = song.padMode !== "none";
  switch (section.kind) {
    case "intro":
      return {
        kick: st === "techno" || (drums && frac >= 0.5),
        snare: false,
        hats: st === "techno" || (drums && frac >= 0.5),
        openHats: false,
        bass: (st === "techno" || st === "chiptune") && frac >= 0.5,
        pad: hasPad && (st !== "techno" || frac >= 0.5),
        arp: st !== "lofi",
        lead: false,
      };
    case "A":
      return {
        kick: drums,
        snare: drums,
        hats: true,
        openHats: st === "techno",
        bass: true,
        pad: hasPad,
        arp: st !== "lofi",
        lead:
          section.name !== "A1" ||
          section.bars <= song.phraseBars ||
          barInSection >= song.phraseBars,
      };
    case "B":
      return {
        kick: true,
        snare: true,
        hats: true,
        openHats: drums,
        bass: true,
        pad: hasPad,
        arp: true,
        lead: true,
      };
    case "break":
      return {
        kick: false,
        snare: false,
        hats: st === "techno",
        openHats: false,
        bass: false,
        pad: hasPad,
        arp: st === "ambient" || st === "chiptune" || !hasPad,
        lead: st !== "techno",
      };
    default:
      return {
        kick: drums && frac < 0.5,
        snare: drums && frac < 0.25,
        hats: drums && frac < 0.5,
        openHats: false,
        bass: frac < 0.75,
        pad: hasPad,
        arp: st !== "lofi" || frac < 0.5,
        lead: false,
      };
  }
}

function cutoffFor(kind: SectionKind, progress: number, barInSection: number): number {
  const wobble = 0.07 * Math.sin((barInSection * Math.PI) / 4);
  switch (kind) {
    case "intro":
      return 0.15 + 0.65 * progress;
    case "A":
      return 0.72 + wobble;
    case "B":
      return 0.88 + wobble;
    case "break":
      return 0.25 + 0.6 * progress;
    default:
      return 0.8 - 0.55 * progress;
  }
}

function chordDegreeAt(song: Song, section: Section, barInSection: number): number {
  const prog = section.progression;
  return prog[Math.floor(barInSection / song.chordBars) % prog.length];
}

export function bassMidi(song: Song, degree: number, tone: BassTone): number {
  const pcs = chordPitchClasses(song, degree);
  const root = pcToWindow(pcs[0], song.registers.bassLo);
  if (tone === "O") {
    return root + 12;
  }
  if (tone === "F") {
    return root + mod(pcs[2] - pcs[0], 12);
  }
  return root;
}

export function arpNotes(song: Song, degree: number): number[] {
  const base = voiceInWindow(chordPitchClasses(song, degree), song.registers.arpLo);
  if (song.arp.octaves === 1) {
    return base;
  }
  return [...base, ...base.map((n) => n + 12)];
}

/** Concrete events for one bar. Pure: same song + bar → same plan. */
export function planBar(song: Song, bar: number): BarPlan {
  const b = clamp(Math.floor(bar), 0, Math.max(0, song.totalBars - 1));
  const sectionIndex = sectionIndexForBar(song, b);
  const sec = song.sections[sectionIndex];
  const barInSection = b - sec.startBar;
  const progress = sec.bars > 1 ? barInSection / (sec.bars - 1) : 1;
  const isFinalBar = b === song.totalBars - 1;
  const isSectionEnd = barInSection === sec.bars - 1;
  const next = song.sections[sectionIndex + 1];
  const chordDegree = isFinalBar ? 0 : chordDegreeAt(song, sec, barInSection);
  const chordStart = isFinalBar || barInSection % song.chordBars === 0;
  const layers = layersFor(song, sec, barInSection);
  const rng = mulberry32(mixSeed(song.seed, b + 1));
  const level =
    sec.kind === "intro" ? 0.7 + 0.3 * progress : sec.kind === "outro" ? 1 - 0.55 * progress : 1;
  const cutoff = clamp(cutoffFor(sec.kind, progress, barInSection), 0, 1);
  const padPcs = chordPitchClasses(song, chordDegree);
  const chord = voiceInWindow(padPcs, song.registers.padLo);
  const events: NoteEvent[] = [];
  const add = (inst: Instrument, step: number, len: number, midi: number, vel: number) => {
    events.push({ inst, step, len, midi, vel: clamp(vel * level, 0.02, 1) });
  };

  if (isFinalBar) {
    if (song.style !== "ambient") {
      add("kick", 0, 1, 0, 0.9);
      add("crash", 0, 1, 0, 0.45);
    }
    add("bass", 0, 16, bassMidi(song, 0, "R"), 0.85);
    if (song.padMode === "none") {
      add("lead", 0, 16, song.registers.leadTonic, 0.7);
    } else {
      chord.forEach((midi) => add("pad", 0, 16, midi, 0.85));
    }
    return { bar: b, sectionIndex, section: sec.kind, barInSection, chordDegree, chord, cutoff, level, layers, events };
  }

  const isB = sec.kind === "B";
  const style = song.style;
  const fill = layers.snare && isSectionEnd && next !== undefined;
  const buildBars = sec.bars >= 4 ? 2 : 1;
  const build = sec.kind === "break" && style !== "ambient" && barInSection >= sec.bars - buildBars;

  // Drums
  if (layers.kick) {
    const pattern = isB ? song.kickB : song.kickA;
    pattern.forEach((v, s) => {
      if (v > 0 && !(fill && s >= 12 && style !== "techno")) {
        add("kick", s, 1, 0, v * (style === "ambient" ? 0.7 : 1));
      }
    });
  }
  if (layers.snare) {
    song.snare.forEach((v, s) => {
      if (v > 0 && !(fill && s >= 12)) {
        add(song.snareInst, s, 1, 0, v);
      }
    });
    if (fill) {
      const roll = style === "lofi" ? [14] : style === "ambient" ? [] : [12, 13, 14, 15];
      roll.forEach((s, i) => add(song.snareInst, s, 1, 0, 0.45 + (0.5 * (i + 1)) / roll.length));
    }
  }
  if (build) {
    const last = barInSection === sec.bars - 1;
    const every = last ? 1 : 2;
    for (let s = 0; s < STEPS_PER_BAR; s += every) {
      const t = s / STEPS_PER_BAR;
      add(style === "techno" ? "clap" : "snare", s, 1, 0, last ? 0.4 + 0.55 * t : 0.2 + 0.25 * t);
    }
  }
  if (layers.hats) {
    const open = layers.openHats ? song.openHats : null;
    song.hats.forEach((v, s) => {
      if (v > 0 && !(open && open[s] > 0)) {
        const human = style === "lofi" ? 0.75 + 0.4 * rng() : 0.9 + 0.2 * rng();
        add("hat", s, 1, 0, v * human);
      }
    });
    if (open) {
      open.forEach((v, s) => {
        if (v > 0) {
          add("openHat", s, 1, 0, v);
        }
      });
    }
  }
  if (barInSection === 0 && sectionIndex > 0 && (sec.kind === "A" || sec.kind === "B") && style !== "ambient") {
    add("crash", 0, 1, 0, style === "lofi" ? 0.5 : 0.8);
  }

  // Bass
  if (layers.bass) {
    const pattern = isB ? song.bassB : song.bassA;
    const tail = sec.kind === "outro" && progress >= 0.5;
    pattern.forEach((note) => {
      if (tail && note.step !== 0) {
        return;
      }
      const accent = note.step % 4 === 0 ? 1 : 0.8;
      add("bass", note.step, tail ? 16 : note.len, bassMidi(song, chordDegree, note.tone), accent);
    });
  }

  // Pads / keys / stabs
  if (layers.pad) {
    if (song.padMode === "sustain") {
      if (chordStart) {
        const len = song.chordBars * STEPS_PER_BAR - 0.25;
        chord.forEach((midi) => add("pad", 0, len, midi, 0.8));
      }
    } else if (song.padMode === "restrike") {
      const vel = chordStart ? 0.85 : 0.65;
      chord.forEach((midi) => add("pad", 0, STEPS_PER_BAR - 0.5, midi, vel));
    } else if (song.padMode === "stab") {
      song.padStabs.forEach((s) => chord.forEach((midi) => add("pad", s, 1.5, midi, 0.75)));
    }
  }

  // Arpeggio
  if (layers.arp) {
    const notes = arpNotes(song, chordDegree);
    const { rate, seq, gates, gate } = song.arp;
    const count = Math.round(STEPS_PER_BAR / rate);
    const soft = sec.kind === "intro" || sec.kind === "break" ? 0.75 : 1;
    for (let i = 0; i < count; i += 1) {
      if (!gates[i % gates.length]) {
        continue;
      }
      const step = i * rate;
      const midi = notes[seq[i % seq.length] % notes.length];
      const accent = step % 4 === 0 ? 1 : 0.72;
      add("arp", step, rate * gate, midi, accent * soft);
    }
  }

  // Lead melody
  if (layers.lead) {
    const motif = isB ? song.motifB : song.motifA;
    const block = Math.floor(barInSection / 4);
    const variant = block % 2 === 1 ? motif.alt : motif.main;
    const blockStart = block * 4;
    const degrees = [0, 1, 2, 3].map((i) => chordDegreeAt(song, sec, blockStart + i));
    const realized = realizeMotif(song, variant, degrees);
    const local = barInSection - blockStart;
    const soft = sec.kind === "break" ? 0.7 : 1;
    for (const note of realized) {
      if (Math.floor(note.step / STEPS_PER_BAR) === local) {
        const s = note.step % STEPS_PER_BAR;
        add("lead", s, note.len, note.midi, (s === 0 ? 0.95 : 0.8) * soft);
      }
    }
  }

  return { bar: b, sectionIndex, section: sec.kind, barInSection, chordDegree, chord, cutoff, level, layers, events };
}
