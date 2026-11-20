// Sprite animation manifest: which Freedoom sprite frames are used for every
// monster state, weapon action, pickup, decoration, projectile and effect.
// Timings are in Doom "tics" (1/35 s); weapon fire sequences are stretched to
// the weapon's refire time (see defs.ts) so animation and gameplay stay in sync.

import type { DecoType, EffectType, EnemyType, ItemType, KeyColor, ProjectileType, WeaponId } from "./defs";
import { FREEDOOM_SPRITES } from "./freedoom-manifest";

export const TIC = 1 / 35;

export interface SeqFrame {
  /** full sprite name without rotation suffix, e.g. "possa" or "pisga" */
  frame: string;
  tics: number;
  bright: boolean;
}

/**
 * Builds a sequence from a compact spec, e.g. seq("poss", "E10 F8! E8"):
 * letter = frame, number = tics, "!" = fullbright.
 */
export function seq(prefix: string, spec: string): SeqFrame[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const m = /^([A-Za-z])(\d+)(!?)$/.exec(tok);
      if (!m) throw new Error(`bad frame token ${tok}`);
      return { frame: prefix + m[1].toLowerCase(), tics: Number(m[2]), bright: m[3] === "!" };
    });
}

export function seqLength(s: SeqFrame[]): number {
  let t = 0;
  for (const f of s) t += f.tics;
  return t * TIC;
}

/** Frame at time t (seconds). `scale` stretches the timeline. */
export function seqFrame(s: SeqFrame[], t: number, loop: boolean, scale = 1): SeqFrame {
  const total = seqLength(s) * scale;
  if (total <= 0) return s[0];
  let tt = t;
  if (loop) tt = ((t % total) + total) % total;
  else if (tt >= total) return s[s.length - 1];
  let acc = 0;
  for (const f of s) {
    acc += f.tics * TIC * scale;
    if (tt < acc) return f;
  }
  return s[s.length - 1];
}

// ------------------------------------------------------------------ monsters

export interface MonsterAnim {
  prefix: string;
  idle: SeqFrame[];
  walk: SeqFrame[];
  attack: SeqFrame[];
  pain: SeqFrame[];
  death: SeqFrame[];
  gib?: SeqFrame[];
  /** floating monsters hover this many cells above the floor */
  hover: number;
}

export const MONSTER_ANIMS: Record<EnemyType, MonsterAnim> = {
  trooper: {
    prefix: "poss",
    idle: seq("poss", "A10 B10"),
    walk: seq("poss", "A4 B4 C4 D4"),
    attack: seq("poss", "E10 F8! E8"),
    pain: seq("poss", "G6"),
    death: seq("poss", "H5 I5 J5 K5 L1"),
    gib: seq("poss", "M5 N5 O5 P5 Q5 R5 S5 T5 U1"),
    hover: 0,
  },
  fiend: {
    prefix: "troo",
    idle: seq("troo", "A10 B10"),
    walk: seq("troo", "A3 B3 C3 D3"),
    attack: seq("troo", "E8 F8 G6"),
    pain: seq("troo", "H4"),
    death: seq("troo", "I8 J8 K6 L6 M1"),
    gib: seq("troo", "N5 O5 P5 Q5 R5 S5 T5 U1"),
    hover: 0,
  },
  biter: {
    prefix: "sarg",
    idle: seq("sarg", "A10 B10"),
    walk: seq("sarg", "A2 B2 C2 D2"),
    attack: seq("sarg", "E8 F8 G8"),
    pain: seq("sarg", "H4"),
    death: seq("sarg", "I8 J8 K4 L4 M4 N1"),
    hover: 0,
  },
  orb: {
    prefix: "head",
    idle: seq("head", "A10"),
    walk: seq("head", "A3"),
    attack: seq("head", "B5 C5 D5!"),
    pain: seq("head", "E3 E3 F6"),
    death: seq("head", "G8 H8 I8 J8 K8 L1"),
    hover: 0.16,
  },
};

// ------------------------------------------------------------------ rotations

export interface RotationSet {
  /** sprite file name per view rotation 1..8 (index 0..7) */
  names: string[];
  /** draw mirrored */
  mirror: boolean[];
}

const rotationCache = new Map<string, RotationSet>();

/**
 * Resolves the 8 view rotations of a frame (e.g. "trooa") from the manifest:
 * "trooa1", "trooa2a8" (rot 2, mirrored for rot 8), ... or a single "trooa0".
 */
export function rotations(frame: string): RotationSet {
  const cached = rotationCache.get(frame);
  if (cached) return cached;
  const names: string[] = [];
  const mirror: boolean[] = [];
  const keys = Object.keys(FREEDOOM_SPRITES).filter((k) => k.startsWith(frame) && k.length > frame.length);
  const letter = frame[frame.length - 1];
  for (let rot = 1; rot <= 8; rot++) {
    let name = "";
    let mir = false;
    if (FREEDOOM_SPRITES[`${frame}${rot}`]) {
      name = `${frame}${rot}`;
    } else {
      for (const k of keys) {
        // pattern <frame><a><letter><b>
        const rest = k.slice(frame.length);
        if (rest.length === 3 && rest[1] === letter) {
          const a = Number(rest[0]);
          const b = Number(rest[2]);
          if (a === rot) {
            name = k;
            break;
          }
          if (b === rot) {
            name = k;
            mir = true;
            break;
          }
        }
      }
      if (!name && FREEDOOM_SPRITES[`${frame}0`]) name = `${frame}0`;
    }
    if (!name) name = `${frame}0`;
    names.push(name);
    mirror.push(mir);
  }
  const set = { names, mirror };
  rotationCache.set(frame, set);
  return set;
}

/**
 * Doom-style rotation index (0..7, 0 = facing the viewer) for a thing facing
 * `facing` seen from a viewer at angle `viewToThing` (angle of the vector
 * viewer -> thing). Our map has y pointing down, angles grow clockwise.
 */
export function rotationIndex(facing: number, viewToThing: number): number {
  const TAU = Math.PI * 2;
  let a = facing - viewToThing + Math.PI + Math.PI / 8;
  a = ((a % TAU) + TAU) % TAU;
  return Math.floor(a / (Math.PI / 4)) & 7;
}

// ------------------------------------------------------------------ things

export const KEY_SPRITES: Record<KeyColor, SeqFrame[]> = {
  red: seq("rkey", "A10 B10!"),
  yellow: seq("ykey", "A10 B10!"),
  blue: seq("bkey", "A10 B10!"),
};

export const ITEM_ANIMS: Record<Exclude<ItemType, "key">, SeqFrame[]> = {
  clip: seq("clip", "A1"),
  ammobox: seq("ammo", "A1"),
  shells: seq("shel", "A1"),
  shellbox: seq("sbox", "A1"),
  rocket: seq("rock", "A1"),
  rocketbox: seq("brok", "A1"),
  stim: seq("stim", "A1"),
  medkit: seq("medi", "A1"),
  hbonus: seq("bon1", "A6 B6 C6 D6 C6 B6"),
  abonus: seq("bon2", "A6 B6 C6 D6 C6 B6"),
  armor: seq("arm1", "A6 B7!"),
  megaarmor: seq("arm2", "A6 B6!"),
  w_chainsaw: seq("csaw", "A1"),
  w_shotgun: seq("shot", "A1"),
  w_supershotgun: seq("sgn2", "A1"),
  w_chaingun: seq("mgun", "A1"),
  w_launcher: seq("laun", "A1"),
};

export const DECO_ANIMS: Record<DecoType, SeqFrame[]> = {
  lamp: seq("colu", "A1!"),
  torch: seq("tblu", "A4! B4! C4! D4!"),
  candle: seq("cand", "A1!"),
  column: seq("elec", "A1"),
  barrel: seq("bar1", "A6 B6"),
};
export const BARREL_FUSE_ANIM = seq("bexp", "A3 B3!");

export const PROJECTILE_ANIMS: Record<ProjectileType, SeqFrame[]> = {
  fireball: seq("bal1", "A4! B4!"),
  orbball: seq("bal2", "A4! B4!"),
  rocket: seq("misl", "A1!"),
};

/** Effects play their frames evenly over their lifetime. */
export const EFFECT_ANIMS: Record<EffectType, SeqFrame[]> = {
  puff: seq("puff", "A4! B4 C4 D4"),
  blood: seq("blud", "C8 B8 A8"),
  fireballHit: seq("bal1", "C6! D6! E6!"),
  orbballHit: seq("bal2", "C6! D6! E6!"),
  rocketHit: seq("misl", "B8! C6! D4!"),
  barrelHit: seq("bexp", "C5! D5! E10!"),
};

// ------------------------------------------------------------------ weapons

export interface WeaponAnim {
  ready: SeqFrame[];
  /** one attack cycle, stretched to the weapon's refire time */
  fire: SeqFrame[];
  /** alternative cycle used on every second refire (chaingun, chainsaw) */
  fireAlt?: SeqFrame[];
  flash?: SeqFrame[];
  flashAlt?: SeqFrame[];
  /** tics into `fire` where the flash starts */
  flashAt: number;
}

export const WEAPON_ANIMS: Record<WeaponId, WeaponAnim> = {
  fist: {
    ready: seq("pung", "A1"),
    fire: seq("pung", "B4 C4 D5 C4 B5"),
    flashAt: 0,
  },
  chainsaw: {
    ready: seq("sawg", "A4 B4"),
    fire: seq("sawg", "C4"),
    fireAlt: seq("sawg", "D4"),
    flashAt: 0,
  },
  pistol: {
    ready: seq("pisg", "A1"),
    fire: seq("pisg", "A4 B6 C4 B5"),
    flash: seq("pisf", "A7!"),
    flashAt: 4,
  },
  shotgun: {
    ready: seq("shtg", "A1"),
    fire: seq("shtg", "A3 A7 B5 C5 D4 C5 B5 A3 A7"),
    flash: seq("shtf", "A4! B3!"),
    flashAt: 3,
  },
  supershotgun: {
    ready: seq("sht2", "A1"),
    fire: seq("sht2", "A3 A7 B7 C7 D7 E7 F7 G6 H6 A5"),
    flash: seq("sht2", "I4! J3!"),
    flashAt: 3,
  },
  chaingun: {
    ready: seq("chgg", "A1"),
    fire: seq("chgg", "A4"),
    fireAlt: seq("chgg", "B4"),
    flash: seq("chgf", "A4!"),
    flashAlt: seq("chgf", "B4!"),
    flashAt: 0,
  },
  launcher: {
    ready: seq("misg", "A1"),
    fire: seq("misg", "B8 B12"),
    flash: seq("misf", "A3! B4! C4! D4!"),
    flashAt: 0,
  },
};

// ------------------------------------------------------------------ preload list

function addSeq(out: Set<string>, s: SeqFrame[], rotated: boolean): void {
  for (const f of s) {
    if (rotated) for (const n of rotations(f.frame).names) out.add(n);
    else out.add(`${f.frame}0`);
  }
}

/** Every sprite file the game can display. */
export function allSpriteNames(): string[] {
  const out = new Set<string>();
  for (const m of Object.values(MONSTER_ANIMS)) {
    for (const s of [m.idle, m.walk, m.attack, m.pain]) addSeq(out, s, true);
    addSeq(out, m.death, true);
    if (m.gib) addSeq(out, m.gib, true);
  }
  for (const s of Object.values(KEY_SPRITES)) addSeq(out, s, false);
  for (const s of Object.values(ITEM_ANIMS)) addSeq(out, s, false);
  for (const s of Object.values(DECO_ANIMS)) addSeq(out, s, false);
  addSeq(out, BARREL_FUSE_ANIM, false);
  for (const [k, s] of Object.entries(PROJECTILE_ANIMS)) addSeq(out, s, k === "rocket");
  for (const s of Object.values(EFFECT_ANIMS)) addSeq(out, s, false);
  for (const w of Object.values(WEAPON_ANIMS)) {
    for (const s of [w.ready, w.fire, w.fireAlt, w.flash, w.flashAlt]) if (s) addSeq(out, s, false);
  }
  return [...out].filter((n) => FREEDOOM_SPRITES[n]);
}
