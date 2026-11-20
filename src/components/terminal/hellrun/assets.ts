// Asset store: lazily loads the Freedoom PNGs (sprites, wall patches, flats),
// converts them once into palette-indexed, column-major arrays the raycaster
// samples directly, builds a few composite wall textures, and serves
// procedural stand-ins while images load or if they fail.
//
// Art: Freedoom project (https://freedoom.github.io), BSD 3-Clause licence -
// see public/hellrun/freedoom/COPYING.adoc and CREDITS.

import { allSpriteNames } from "./anim";
import { FREEDOOM_BASE, FREEDOOM_FLATS, FREEDOOM_SPRITES, FREEDOOM_TEXTURES } from "./freedoom-manifest";
import { FLAT_TEX, WALL_TEX } from "./levels";
import type { Palette } from "./palette";

/** Indexed sprite, column-major: px[x * h + y]; 0 = transparent. */
export interface Sprite {
  w: number;
  h: number;
  /** anchor: pixels from the left edge to the centre line */
  ox: number;
  /** anchor: pixels from the top edge to the ground / origin */
  oy: number;
  px: Uint16Array;
  fallback: boolean;
}

/** Indexed wall texture, column-major, always 128 texels high; width 128 or 256. */
export interface WallTexture {
  w: number;
  h: number;
  px: Uint16Array;
  fallback: boolean;
}

/** 64x64 indexed flat, row-major. */
export interface FlatTexture {
  px: Uint16Array;
  fallback: boolean;
}

interface Rgba {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  img: HTMLImageElement | null;
}

const WALL_H = 128;

// --------------------------------------------------------------------------
// Image loading (module-level cache so several game instances share requests)

const rgbaCache = new Map<string, Promise<Rgba | null>>();
let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

function canLoadImages(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined" && typeof Image !== "undefined";
}

function loadRgba(url: string): Promise<Rgba | null> {
  let p = rgbaCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        if (typeof img.decode === "function") {
          await img.decode();
        } else {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("load failed"));
          });
        }
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return null;
        if (!scratch) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return null;
          scratch = { canvas, ctx };
        }
        const { canvas, ctx } = scratch;
        if (canvas.width < w) canvas.width = w;
        if (canvas.height < h) canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        return { w, h, data, img };
      } catch {
        return null;
      }
    })();
    rgbaCache.set(url, p);
  }
  return p;
}

// --------------------------------------------------------------------------
// Composite wall textures

type KeyTint = { band: [number, number, number]; key: string };

const LOCKED_DOORS: Record<string, KeyTint> = {
  door_red: { band: [200, 24, 16], key: "rkeya0" },
  door_yellow: { band: [232, 196, 40], key: "ykeya0" },
  door_blue: { band: [40, 64, 220], key: "bkeya0" },
};

/** Patches a composite needs (besides itself). */
function compositeSources(name: string): string[] | null {
  if (name === "comp_wall") return ["patch:wall62_1", "patch:comp04_1"];
  if (name === "exit_off" || name === "exit_on") return ["patch:wall52_1", "patch:exit1"];
  const lock = LOCKED_DOORS[name];
  if (lock) return ["patch:door2_4", `sprite:${lock.key}`];
  return null;
}

// --------------------------------------------------------------------------
// Fallback colours (a small fixed set so fallbacks never flood the palette)

const FALLBACK_HUES: Record<string, [number, number, number]> = {
  brown: [120, 84, 52],
  grey: [118, 116, 112],
  red: [150, 30, 24],
  dark: [62, 56, 52],
  green: [70, 96, 60],
  skin: [170, 120, 90],
  pink: [200, 110, 120],
  orange: [230, 140, 40],
  blue: [60, 70, 170],
  steel: [90, 92, 100],
};

function fallbackHue(name: string): [number, number, number] {
  if (/^(hell|redrock|wall22|bal1|misf|pisf|shtf|chgf|bexp|misl[bcd])/.test(name)) return FALLBACK_HUES.red;
  if (/^(brick|brbrick|mossbrik|wood|door9|door11|wall62|floor0_1|floor4|floor7|ceil1|ceil3|sflr|flat5|troo)/.test(name))
    return FALLBACK_HUES.brown;
  if (/^(rock|darkrock|ceil5|ceil4)/.test(name)) return FALLBACK_HUES.dark;
  if (/^(marble|nukage|arm1|bon1)/.test(name)) return FALLBACK_HUES.green;
  if (/^(sarg)/.test(name)) return FALLBACK_HUES.pink;
  if (/^(poss|pung)/.test(name)) return FALLBACK_HUES.skin;
  if (/^(head|bigwall|longwall|pillar|lava|tlite|colu|cand|puff)/.test(name)) return FALLBACK_HUES.orange;
  if (/^(bal2|tblu|bkey|arm2|bon2)/.test(name)) return FALLBACK_HUES.blue;
  if (/^(pisg|shtg|sht2|chgg|misg|sawg|elec|bar1)/.test(name)) return FALLBACK_HUES.steel;
  return FALLBACK_HUES.grey;
}

function shade(c: [number, number, number], k: number): [number, number, number] {
  return [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
}

function hash2(x: number, y: number): number {
  let h = Math.imul(x * 73856093 ^ (y * 19349663), 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// --------------------------------------------------------------------------

export class AssetStore {
  readonly base: string;
  /** bumps whenever a real asset replaces a fallback */
  version = 0;
  loaded = 0;
  total = 0;
  failed = 0;
  private started = false;
  private readonly sprites = new Map<string, Sprite>();
  private readonly walls: (WallTexture | null)[] = [];
  private readonly flats: (FlatTexture | null)[] = [];
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly rgba = new Map<string, Rgba>();
  private readonly fallbackIdx: number[] = [];

  constructor(
    private readonly palette: Palette,
    base: string = FREEDOOM_BASE,
  ) {
    this.base = base.replace(/\/$/, "");
    // eight shades for each fallback hue
    for (const hue of Object.values(FALLBACK_HUES)) {
      for (let s = 0; s < 8; s++) {
        const c = shade(hue, 0.35 + s * 0.13);
        this.fallbackIdx.push(palette.index(c[0], c[1], c[2]));
      }
    }
  }

  get ready(): boolean {
    return this.started && this.loaded + this.failed >= this.total;
  }

  /** Begin loading every asset the game uses (browser only, idempotent). */
  start(): void {
    if (this.started || !canLoadImages()) return;
    this.started = true;
    const jobs: { key: string; url: string }[] = [];
    const want = new Set<string>();
    const add = (key: string) => {
      if (want.has(key)) return;
      want.add(key);
      const [kind, name] = key.split(":");
      const folder = kind === "sprite" ? "sprites" : kind === "flat" ? "flats" : "patches";
      jobs.push({ key, url: `${this.base}/${folder}/${name}.png` });
    };
    // weapons and level-1 textures first, so the opening looks right quickly
    for (const name of WALL_TEX) {
      if (!name) continue;
      const comp = compositeSources(name);
      if (comp) comp.forEach(add);
      else if (FREEDOOM_TEXTURES[name]) add(`patch:${name}`);
    }
    for (const name of FLAT_TEX) if (FREEDOOM_FLATS[name]) add(`flat:${name}`);
    const sprites = allSpriteNames();
    sprites.sort((a, b) => Number(/^(pis|pun|sht|chg|saw|mis)/.test(b)) - Number(/^(pis|pun|sht|chg|saw|mis)/.test(a)));
    for (const s of sprites) add(`sprite:${s}`);
    this.total = jobs.length;

    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const data = await loadRgba(job.url);
        if (data) {
          this.rgba.set(job.key, data);
          if (data.img) this.images.set(job.key, data.img);
          this.loaded++;
          this.onLoaded(job.key);
        } else {
          this.failed++;
        }
      }
    };
    for (let i = 0; i < 6; i++) void worker();
  }

  private onLoaded(key: string): void {
    const [kind, name] = key.split(":");
    if (kind === "sprite") {
      this.sprites.delete(name);
    } else if (kind === "flat") {
      const id = (FLAT_TEX as readonly string[]).indexOf(name);
      if (id >= 0) this.flats[id] = null;
    }
    // any wall (or composite) using this source gets rebuilt lazily
    for (let id = 1; id < WALL_TEX.length; id++) {
      const n = WALL_TEX[id];
      if (n === name || compositeSources(n)?.includes(key)) this.walls[id] = null;
    }
    this.version++;
  }

  /** The decoded image (for crisp HUD icons), if loaded. */
  image(kind: "sprite" | "patch", name: string): HTMLImageElement | null {
    return this.images.get(`${kind}:${name}`) ?? null;
  }

  // ------------------------------------------------------------ sprites

  sprite(name: string): Sprite {
    let s = this.sprites.get(name);
    if (s) return s;
    const data = this.rgba.get(`sprite:${name}`);
    const meta = FREEDOOM_SPRITES[name];
    if (data) {
      s = this.spriteFromRgba(data, meta?.ox ?? data.w >> 1, meta?.oy ?? data.h);
    } else {
      s = this.fallbackSprite(name);
    }
    this.sprites.set(name, s);
    return s;
  }

  private spriteFromRgba(d: Rgba, ox: number, oy: number): Sprite {
    const { w, h, data } = d;
    const px = new Uint16Array(w * h);
    const pal = this.palette;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (data[o + 3] < 128) continue;
        px[x * h + y] = pal.index(data[o], data[o + 1], data[o + 2]);
      }
    }
    return { w, h, ox, oy, px, fallback: false };
  }

  private fallbackSprite(name: string): Sprite {
    const meta = FREEDOOM_SPRITES[name] ?? { w: 16, h: 16, ox: 8, oy: 16 };
    const w = Math.max(1, meta.w);
    const h = Math.max(1, meta.h);
    const px = new Uint16Array(w * h);
    const hueKey = Object.values(FALLBACK_HUES).indexOf(fallbackHue(name));
    const ramp = (s: number) => this.fallbackIdx[hueKey * 8 + Math.max(0, Math.min(7, s))];
    const weapon = meta.ox < 0;
    const flash = /^(pisf|shtf|chgf|misf|sht2[ij])/.test(name);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const nx = (x + 0.5) / w - 0.5;
        const ny = (y + 0.5) / h - 0.5;
        let inside: boolean;
        let s: number;
        if (flash) {
          inside = nx * nx + ny * ny < 0.2;
          s = 7 - Math.floor((nx * nx + ny * ny) * 20);
        } else if (weapon) {
          // a gun barrel narrowing towards the top, held from below
          const half = 0.12 + (ny + 0.5) * 0.18;
          inside = Math.abs(nx) < half;
          s = 2 + Math.round((0.5 - Math.abs(nx) / half) * 4);
        } else {
          // body + head silhouette
          const body = (nx * nx) / 0.16 + ((ny - 0.12) * (ny - 0.12)) / 0.14 < 1;
          const head = nx * nx + (ny + 0.32) * (ny + 0.32) < 0.018;
          inside = body || head;
          s = 3 + Math.round((0.4 - nx - ny * 0.5) * 4);
        }
        if (inside) px[x * h + y] = ramp(s);
      }
    }
    return { w, h, ox: meta.ox, oy: meta.oy, px, fallback: true };
  }

  // ------------------------------------------------------------ walls

  wall(id: number): WallTexture {
    let t = this.walls[id];
    if (t) return t;
    const name = WALL_TEX[id] ?? "";
    t = this.buildWall(name) ?? this.fallbackWall(name);
    this.walls[id] = t;
    return t;
  }

  /** Normalises a patch to 128 texels high (tiling or stretching) and >= 128 wide. */
  private normalizeRgba(src: Rgba, name: string): Rgba {
    const tileX = 128 % src.w === 0 || name === "support2";
    const tileY = WALL_H % src.h === 0;
    const w = src.w >= 128 ? src.w : 128;
    const h = WALL_H;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = tileY ? y % src.h : Math.min(src.h - 1, Math.floor((y * src.h) / h));
      for (let x = 0; x < w; x++) {
        const sx = src.w >= 128 ? x : tileX ? x % src.w : Math.min(src.w - 1, Math.floor((x * src.w) / w));
        const so = (sy * src.w + sx) * 4;
        const o = (y * w + x) * 4;
        out[o] = src.data[so];
        out[o + 1] = src.data[so + 1];
        out[o + 2] = src.data[so + 2];
        out[o + 3] = 255;
      }
    }
    return { w, h, data: out, img: null };
  }

  private buildWall(name: string): WallTexture | null {
    const comp = compositeSources(name);
    let rgba: Rgba | null = null;
    if (comp) {
      const parts = comp.map((k) => this.rgba.get(k));
      if (parts.some((p) => !p)) return null;
      const base = this.normalizeRgba(parts[0]!, comp[0].split(":")[1]);
      if (name === "comp_wall") {
        blit(base, parts[1]!, 32, 30, 1);
      } else if (name === "exit_off" || name === "exit_on") {
        drawExitSwitch(base, parts[1]!, name === "exit_on");
      } else {
        const lock = LOCKED_DOORS[name];
        drawLockBands(base, lock.band);
        blit(base, parts[1]!, 57, 6, 1);
      }
      rgba = base;
    } else {
      const src = this.rgba.get(`patch:${name}`);
      if (!src) return null;
      rgba = this.normalizeRgba(src, name);
    }
    const { w, h, data } = rgba;
    const px = new Uint16Array(w * h);
    const pal = this.palette;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        px[x * h + y] = pal.index(data[o], data[o + 1], data[o + 2]);
      }
    }
    return { w, h, px, fallback: false };
  }

  private fallbackWall(name: string): WallTexture {
    const w = 128;
    const h = WALL_H;
    const px = new Uint16Array(w * h);
    const hue = Object.values(FALLBACK_HUES).indexOf(fallbackHue(name));
    const ramp = (s: number) => this.fallbackIdx[hue * 8 + Math.max(0, Math.min(7, s))];
    const brick = /brick|stone/.test(name);
    const door = /^door/.test(name);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let s = 4 + Math.floor(hash2(x >> 1, y >> 1) * 2);
        if (brick) {
          const row = y >> 4;
          const bx = (x + (row & 1) * 16) & 31;
          if ((y & 15) === 0 || bx === 0) s = 1;
          else if ((y & 15) === 1 || bx === 1) s = 6;
        } else if (door) {
          if (x < 6 || x > 121 || (y & 31) === 0) s = 2;
          if (y > 56 && y < 72) s = 6;
        } else {
          if ((x & 63) === 0 || (y & 63) === 0) s = 1;
          else if ((x & 63) === 1 || (y & 63) === 1) s = 6;
        }
        if (name === "exit_off" || name === "exit_on") {
          if (y > 10 && y < 26 && x > 44 && x < 84) s = 7;
        }
        px[x * h + y] = ramp(s);
      }
    }
    return { w, h, px, fallback: true };
  }

  // ------------------------------------------------------------ flats

  flat(id: number): FlatTexture {
    let f = this.flats[id];
    if (f) return f;
    const name = FLAT_TEX[id] ?? "";
    const src = this.rgba.get(`flat:${name}`);
    const px = new Uint16Array(64 * 64);
    if (src && src.w >= 64 && src.h >= 64) {
      const pal = this.palette;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const o = (y * src.w + x) * 4;
          px[y * 64 + x] = pal.index(src.data[o], src.data[o + 1], src.data[o + 2]);
        }
      }
      f = { px, fallback: false };
    } else {
      const hue = Object.values(FALLBACK_HUES).indexOf(fallbackHue(name));
      const light = name === "tlite6_1";
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          let s = 2 + Math.floor(hash2(x >> 2, y >> 2) * 3);
          if ((x & 31) === 0 || (y & 31) === 0) s = 1;
          if (light && Math.abs(x - 32) + Math.abs(y - 32) < 12) s = 7;
          px[y * 64 + x] = this.fallbackIdx[hue * 8 + s];
        }
      }
      f = { px, fallback: true };
    }
    this.flats[id] = f;
    return f;
  }
}

// --------------------------------------------------------------------------
// RGBA compositing helpers

function blit(dst: Rgba, src: Rgba, dx: number, dy: number, scale: number): void {
  for (let y = 0; y < src.h * scale; y++) {
    for (let x = 0; x < src.w * scale; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const so = (Math.floor(y / scale) * src.w + Math.floor(x / scale)) * 4;
      if (src.data[so + 3] < 128) continue;
      const o = (ty * dst.w + tx) * 4;
      dst.data[o] = src.data[so];
      dst.data[o + 1] = src.data[so + 1];
      dst.data[o + 2] = src.data[so + 2];
      dst.data[o + 3] = 255;
    }
  }
}

function fill(dst: Rgba, x0: number, y0: number, w: number, h: number, c: [number, number, number]): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= dst.w || y >= dst.h) continue;
      const o = (y * dst.w + x) * 4;
      dst.data[o] = c[0];
      dst.data[o + 1] = c[1];
      dst.data[o + 2] = c[2];
      dst.data[o + 3] = 255;
    }
  }
}

/** Coloured frame bands on a door so locked doors read at a glance. */
function drawLockBands(dst: Rgba, band: [number, number, number]): void {
  const dark = shade(band, 0.45);
  const lite = shade(band, 1.25);
  for (const x0 of [0, dst.w - 10]) {
    fill(dst, x0, 0, 10, dst.h, band);
    fill(dst, x0, 0, 1, dst.h, lite);
    fill(dst, x0 + 9, 0, 1, dst.h, dark);
  }
  fill(dst, 52, 2, 24, 26, [24, 22, 20]);
  fill(dst, 53, 3, 22, 24, dark);
}

/** Exit sign above a wall switch; the lever and lamp change when used. */
function drawExitSwitch(dst: Rgba, sign: Rgba, on: boolean): void {
  blit(dst, sign, 32, 8, 2);
  // switch plate
  fill(dst, 46, 50, 36, 46, [36, 34, 32]);
  fill(dst, 47, 51, 34, 44, [92, 90, 86]);
  fill(dst, 48, 52, 32, 42, [64, 62, 58]);
  // bolts
  for (const [bx, by] of [
    [50, 54],
    [77, 54],
    [50, 90],
    [77, 90],
  ]) {
    fill(dst, bx, by, 2, 2, [150, 146, 140]);
  }
  // lamp
  const lamp: [number, number, number] = on ? [60, 230, 60] : [220, 30, 20];
  fill(dst, 59, 56, 10, 6, [20, 18, 16]);
  fill(dst, 60, 57, 8, 4, lamp);
  // slot + lever
  fill(dst, 62, 66, 4, 22, [16, 14, 12]);
  if (on) {
    fill(dst, 61, 64, 6, 8, [200, 196, 188]);
    fill(dst, 62, 65, 4, 6, [140, 136, 130]);
  } else {
    fill(dst, 61, 82, 6, 8, [200, 196, 188]);
    fill(dst, 62, 83, 4, 6, [140, 136, 130]);
  }
}
