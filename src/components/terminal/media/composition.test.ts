import { describe, expect, it } from "vitest";
import {
  KNOWN_TRACK_STYLES,
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  SCALES,
  STEPS_PER_BAR,
  TAIL_SEC,
  buildArrangement,
  chordPitchClasses,
  createSong,
  isDiminished,
  makeMotif,
  mulberry32,
  parseBass,
  parseHits,
  planBar,
  titleFromFileName,
  trackIdFromFileName,
  type ModeName,
  type Song,
} from "./composition";
import { describeTrack } from "./music";

const SITE_TRACKS = [
  "circuit_beat.mp3",
  "glow_shift.mp3",
  "horizon_chords.mp3",
  "neon_drive.mp3",
  "pulse_echo.mp3",
  "retro_wave.mp3",
  "synth.mp3",
  "synth2.mp3",
  "synth3.mp3",
];

const RANDOM_NAMES = Array.from({ length: 60 }, (_, i) => {
  const rng = mulberry32(1000 + i);
  const letters = "abcdefghijklmnopqrstuvwxyz_0123456789";
  let name = "";
  const len = 3 + Math.floor(rng() * 14);
  for (let k = 0; k < len; k += 1) {
    name += letters[Math.floor(rng() * letters.length)];
  }
  return `${name}.mp3`;
});

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const scalePcs = (song: Song) => new Set(song.scale.map((s) => mod12(song.keyPc + s)));

describe("describeTrack", () => {
  it("is deterministic and ignores directories, case and extension", () => {
    const a = describeTrack("neon_drive.mp3");
    expect(describeTrack("neon_drive.mp3")).toEqual(a);
    expect(describeTrack("/home/kinin/media/neon_drive.mp3")).toEqual(a);
    expect(describeTrack("C:\\media\\NEON_DRIVE.MP3").id).toBe(a.id);
    expect(a.id).toBe("neon_drive");
    expect(trackIdFromFileName("")).toBe("untitled");
  });

  it("makes human titles", () => {
    expect(describeTrack("neon_drive.mp3").title).toBe("Neon Drive");
    expect(describeTrack("horizon_chords.mp3").title).toBe("Horizon Chords");
    expect(describeTrack("synth.mp3").title).toBe("Synth");
    expect(describeTrack("synth2.mp3").title).toBe("Synth II");
    expect(describeTrack("synth3.mp3").title).toBe("Synth III");
    expect(titleFromFileName("night_of-the.drive.mp3")).toBe("Night of the Drive");
    expect(titleFromFileName("midnightCity.mp3")).toBe("Midnight City");
    expect(titleFromFileName("2049.mp3")).toBe("2049");
    expect(titleFromFileName("DJ_set.mp3")).toBe("DJ Set");
    expect(titleFromFileName("___.mp3")).toBe("Untitled");
    expect(describeTrack("anything.mp3").artist).toBe("KININ Synth");
  });

  it("assigns the site's tracks their styles and sane metadata", () => {
    const styles = new Set<string>();
    for (const file of SITE_TRACKS) {
      const info = describeTrack(file);
      const song = createSong(file);
      expect(song.style).toBe(KNOWN_TRACK_STYLES[song.id]);
      styles.add(info.style);
      expect(info.durationSec).toBeGreaterThanOrEqual(MIN_DURATION_SEC);
      expect(info.durationSec).toBeLessThanOrEqual(MAX_DURATION_SEC);
      expect(Number.isInteger(info.durationSec)).toBe(true);
      expect(info.bpm).toBeGreaterThanOrEqual(60);
      expect(info.bpm).toBeLessThanOrEqual(160);
      expect(info.key).toMatch(/^[A-G][#b]? (major|minor|dorian|phrygian|lydian|mixolydian)$/);
    }
    // all five styles are represented by the site's nine files
    expect(styles).toEqual(new Set(["synthwave", "chiptune", "lo-fi", "techno", "ambient"]));
  });

  it("gives unknown names a valid seeded style", () => {
    const seen = new Set<string>();
    for (const name of RANDOM_NAMES) {
      const info = describeTrack(name);
      seen.add(info.style);
      expect(info.durationSec).toBeGreaterThanOrEqual(MIN_DURATION_SEC);
      expect(info.durationSec).toBeLessThanOrEqual(MAX_DURATION_SEC);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(describeTrack("chill_rain.mp3").style).toBe("lo-fi");
    expect(describeTrack("8bit_hero.mp3").style).toBe("chiptune");
  });
});

describe("arrangement", () => {
  it("has intro → A → B → … → A → outro, contiguous and within duration bounds", () => {
    for (const file of [...SITE_TRACKS, ...RANDOM_NAMES]) {
      const song = createSong(file);
      const kinds = song.sections.map((s) => s.kind);
      expect(kinds[0]).toBe("intro");
      expect(kinds[kinds.length - 1]).toBe("outro");
      expect(kinds.filter((k) => k === "A").length).toBeGreaterThanOrEqual(2);
      expect(kinds).toContain("B");
      expect(kinds.indexOf("A")).toBeLessThan(kinds.indexOf("B"));
      let bar = 0;
      for (const section of song.sections) {
        expect(section.startBar).toBe(bar);
        expect(section.bars % song.phraseBars).toBe(0);
        expect(section.bars).toBeGreaterThan(0);
        bar += section.bars;
      }
      expect(bar).toBe(song.totalBars);
      const music = song.totalBars * song.barSec;
      expect(song.durationSec).toBe(Math.ceil(music + TAIL_SEC));
      expect(song.durationSec).toBeGreaterThanOrEqual(MIN_DURATION_SEC);
      expect(song.durationSec).toBeLessThanOrEqual(MAX_DURATION_SEC);
      expect(new Set(song.sections.map((s) => s.name)).size).toBe(song.sections.length);
    }
  });

  it("stays within bounds for extreme tempos and phrase lengths", () => {
    for (const bpm of [60, 66, 90, 120, 160, 190]) {
      for (const baseBars of [4, 8]) {
        for (let seed = 1; seed <= 20; seed += 1) {
          const barSec = 240 / bpm;
          const { totalBars, sections, phraseBars } = buildArrangement(
            mulberry32(seed),
            barSec,
            baseBars,
            [0, 3, 4, 0],
            [5, 3, 0, 4],
          );
          const duration = Math.ceil(totalBars * barSec + TAIL_SEC);
          expect(duration).toBeGreaterThanOrEqual(MIN_DURATION_SEC);
          expect(duration).toBeLessThanOrEqual(MAX_DURATION_SEC);
          expect(phraseBars * barSec).toBeGreaterThanOrEqual(8 - 1e-9);
          expect(sections.length).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });
});

describe("patterns", () => {
  it("parses drum and bass strings", () => {
    expect(parseHits("X...x...o...-...")).toEqual([1, 0, 0, 0, 0.8, 0, 0, 0, 0.58, 0, 0, 0, 0.36, 0, 0, 0]);
    expect(parseBass("R_RRR_..O___F...")).toEqual([
      { step: 0, len: 2, tone: "R" },
      { step: 2, len: 1, tone: "R" },
      { step: 3, len: 1, tone: "R" },
      { step: 4, len: 2, tone: "R" },
      { step: 8, len: 4, tone: "O" },
      { step: 12, len: 1, tone: "F" },
    ]);
  });

  it("never picks a progression with diminished chords", () => {
    for (const file of [...SITE_TRACKS, ...RANDOM_NAMES]) {
      const song = createSong(file);
      for (const d of [...song.progressionA, ...song.progressionB]) {
        expect(isDiminished(song.scale, d)).toBe(false);
      }
    }
    const dims: Record<ModeName, number> = {
      major: 6,
      minor: 1,
      dorian: 5,
      phrygian: 4,
      lydian: 3,
      mixolydian: 2,
    };
    for (const [mode, degree] of Object.entries(dims) as [ModeName, number][]) {
      expect(isDiminished(SCALES[mode], degree)).toBe(true);
    }
  });

  it("builds 4-bar call-and-response motifs that resolve to the root", () => {
    const motif = makeMotif(
      mulberry32(5),
      [[[0, 4], [4, 4], [8, 8]], [[0, 2], [2, 2], [4, 12]]],
      [[[0, 16]]],
    );
    for (const variant of [motif.main, motif.alt]) {
      const last = variant[variant.length - 1];
      expect(last.kind).toBe("root");
      expect(Math.max(...variant.map((n) => n.step))).toBeLessThan(4 * STEPS_PER_BAR);
      const steps = variant.map((n) => n.step);
      expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    }
  });
});

describe("planBar", () => {
  it("is deterministic and produces in-key, in-range events for every bar", () => {
    for (const file of [...SITE_TRACKS, ...RANDOM_NAMES.slice(0, 15)]) {
      const song = createSong(file);
      const inScale = scalePcs(song);
      for (let bar = 0; bar < song.totalBars; bar += 1) {
        const plan = planBar(song, bar);
        expect(planBar(song, bar)).toEqual(plan);
        const chordPcs = new Set(chordPitchClasses(song, plan.chordDegree));
        expect(plan.cutoff).toBeGreaterThanOrEqual(0);
        expect(plan.cutoff).toBeLessThanOrEqual(1);
        for (const ev of plan.events) {
          expect(ev.step).toBeGreaterThanOrEqual(0);
          expect(ev.step).toBeLessThan(STEPS_PER_BAR);
          expect(ev.len).toBeGreaterThan(0);
          expect(ev.vel).toBeGreaterThan(0);
          expect(ev.vel).toBeLessThanOrEqual(1);
          if (ev.midi > 0) {
            expect(ev.midi).toBeGreaterThanOrEqual(28);
            expect(ev.midi).toBeLessThanOrEqual(96);
          }
          if (ev.inst === "lead") {
            expect(inScale.has(mod12(ev.midi))).toBe(true);
          }
          if (ev.inst === "pad") {
            expect(plan.chord).toContain(ev.midi);
          }
          if (ev.inst === "arp" || ev.inst === "bass") {
            expect(chordPcs.has(mod12(ev.midi))).toBe(true);
          }
        }
      }
    }
  });

  it("has drums and bass in the A sections and a melody somewhere", () => {
    for (const file of SITE_TRACKS) {
      const song = createSong(file);
      const a = song.sections.find((s) => s.kind === "A")!;
      const plan = planBar(song, a.startBar);
      const insts = new Set(plan.events.map((e) => e.inst));
      if (song.style !== "ambient") {
        expect(insts.has("kick")).toBe(true);
      }
      expect(insts.has("hat")).toBe(true);
      expect(insts.has("bass")).toBe(true);
      let leadNotes = 0;
      for (let bar = 0; bar < song.totalBars; bar += 1) {
        leadNotes += planBar(song, bar).events.filter((e) => e.inst === "lead").length;
      }
      expect(leadNotes).toBeGreaterThan(10);
    }
  });

  it("ends on the tonic chord and builds up through the intro", () => {
    for (const file of SITE_TRACKS) {
      const song = createSong(file);
      const last = planBar(song, song.totalBars - 1);
      expect(last.chordDegree).toBe(0);
      const bass = last.events.find((e) => e.inst === "bass");
      expect(bass && mod12(bass.midi)).toBe(song.keyPc);
      const intro = song.sections[0];
      const first = planBar(song, 0);
      const lastIntro = planBar(song, intro.bars - 1);
      expect(lastIntro.cutoff).toBeGreaterThan(first.cutoff);
      expect(first.events.some((e) => e.inst === "snare" || e.inst === "lead")).toBe(false);
    }
  });

  it("follows the section's chord progression", () => {
    const song = createSong("neon_drive.mp3");
    const a = song.sections.find((s) => s.kind === "A")!;
    for (let i = 0; i < a.bars; i += 1) {
      const plan = planBar(song, a.startBar + i);
      const expected = a.progression[Math.floor(i / song.chordBars) % a.progression.length];
      expect(plan.chordDegree).toBe(expected);
    }
  });
});
