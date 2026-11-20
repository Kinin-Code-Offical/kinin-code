// HELLRUN software renderer: draws the 3D view into a low-resolution
// framebuffer (Uint32 view over ImageData) that is blitted, unsmoothed, into
// the caller's canvas. Walls / flats / sprites are palette-indexed and shaded
// through the palette's colormap (one lookup per pixel).

import {
  BARREL_FUSE_ANIM,
  DECO_ANIMS,
  EFFECT_ANIMS,
  ITEM_ANIMS,
  KEY_SPRITES,
  MONSTER_ANIMS,
  PROJECTILE_ANIMS,
  rotationIndex,
  rotations,
  seqFrame,
  seqLength,
  TIC,
  WEAPON_ANIMS,
  type SeqFrame,
} from "./anim";
import type { AssetStore, Sprite } from "./assets";
import { WEAPONS } from "./defs";
import { FLAT_TEX, FULLBRIGHT_FLATS, LIQUID_FLATS, wallTexId } from "./levels";
import { castRay, K_DOOR, makeHit } from "./map";
import { NL, PAL_SIZE, type Palette } from "./palette";
import { SWITCH_TIME, type World } from "./world";

/** Lightmap resolution (samples per cell). */
const LM = 4;
/** Length of the camera plane vector: horizontal FOV = 2 * atan(PLANE). */
const PLANE = 0.75;
/** Doom art is drawn for 1.2:1 tall pixels; vertical projection is stretched to match. */
const ASPECT_Y = 1.2;
/** Eye height in cells (wall height = 1). */
const EYE = 0.33;
/** Constant darkness + darkness per cell of distance (colormap levels). */
const BASE_SHADE = 3;
const FOG_PER_CELL = 1.0;
/** Weapons are drawn on a 320x200 reference screen scaled to the view width. */
const WEAPON_SCALE = 1.0;
const MAX_DIST = 64;

interface SpriteDraw {
  depth: number;
  sx: number;
  z: number;
  sprite: Sprite;
  mirror: boolean;
  level: number;
}

interface Baked {
  world: World;
  lm: Float32Array;
  w: number;
  h: number;
}

export class Renderer {
  fbW = 0;
  fbH = 0;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private cctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private fb = new Uint32Array(0);
  private zbuf = new Float32Array(0);
  private wallTop = new Int32Array(0);
  private wallBot = new Int32Array(0);
  private gapTop = new Int32Array(0);
  private gapBot = new Int32Array(0);
  private readonly hit = makeHit();
  private baked: Baked | null = null;
  private readonly draws: SpriteDraw[] = [];
  private drawCount = 0;
  private fire: Uint8Array = new Uint8Array(0);
  private fireRng = 12345;
  private readonly firePal = new Uint32Array(37);
  private readonly fullbrightFlat: Uint8Array;
  private readonly liquidFlat: Uint8Array;
  private readonly jambId = wallTexId("support2");

  constructor(
    private readonly palette: Palette,
    private readonly assets: AssetStore,
    private readonly lowPower: boolean,
  ) {
    this.fullbrightFlat = new Uint8Array(FLAT_TEX.length);
    this.liquidFlat = new Uint8Array(FLAT_TEX.length);
    FLAT_TEX.forEach((n, i) => {
      this.fullbrightFlat[i] = FULLBRIGHT_FLATS.has(n) ? 1 : 0;
      this.liquidFlat[i] = LIQUID_FLATS.has(n) ? 1 : 0;
    });
    // classic fire ramp: black -> deep red -> orange -> yellow -> white
    const keys: [number, number, number, number][] = [
      [0, 7, 7, 7],
      [6, 71, 15, 7],
      [12, 143, 39, 7],
      [18, 191, 71, 7],
      [24, 223, 111, 15],
      [30, 223, 159, 31],
      [34, 207, 207, 111],
      [36, 255, 255, 255],
    ];
    for (let i = 0; i < 37; i++) {
      let k = 0;
      while (k < keys.length - 2 && keys[k + 1][0] < i) k++;
      const [a, ar, ag, ab] = keys[k];
      const [b, br, bg, bb] = keys[k + 1];
      const t = Math.max(0, Math.min(1, (i - a) / (b - a)));
      this.firePal[i] =
        (0xff000000 |
          (Math.round(ab + (bb - ab) * t) << 16) |
          (Math.round(ag + (bg - ag) * t) << 8) |
          Math.round(ar + (br - ar) * t)) >>>
        0;
    }
  }

  /** Sets the internal resolution from the target view size. */
  resize(viewW: number, viewH: number): void {
    const w = this.lowPower ? 240 : 320;
    const h = Math.max(60, Math.min(400, Math.round((w * viewH) / Math.max(1, viewW))));
    if (w === this.fbW && h === this.fbH && this.image) return;
    this.fbW = w;
    this.fbH = h;
    if (typeof OffscreenCanvas !== "undefined") {
      this.canvas = new OffscreenCanvas(w, h);
      this.cctx = this.canvas.getContext("2d");
    } else if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      this.canvas = c;
      this.cctx = c.getContext("2d");
    }
    this.image = new ImageData(w, h);
    this.fb = new Uint32Array(this.image.data.buffer);
    this.zbuf = new Float32Array(w);
    this.wallTop = new Int32Array(w);
    this.wallBot = new Int32Array(w);
    this.gapTop = new Int32Array(w);
    this.gapBot = new Int32Array(w);
    this.fire = new Uint8Array(w * h);
  }

  /** Copies the framebuffer into ctx at the given rectangle (no smoothing). */
  blit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (!this.image || !this.canvas || !this.cctx) return;
    this.cctx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas as CanvasImageSource, 0, 0, this.fbW, this.fbH, x, y, w, h);
  }

  // ----------------------------------------------------------------- lighting

  private bake(world: World): Baked {
    if (this.baked && this.baked.world === world) return this.baked;
    const m = world.map;
    const w = m.w * LM;
    const h = m.h * LM;
    const lm = new Float32Array(w * h);
    const hit = makeHit();
    for (const L of world.level.lights) {
      const r = L.radius;
      const x0 = Math.max(0, Math.floor((L.x - r) * LM));
      const x1 = Math.min(w - 1, Math.ceil((L.x + r) * LM));
      const y0 = Math.max(0, Math.floor((L.y - r) * LM));
      const y1 = Math.min(h - 1, Math.ceil((L.y + r) * LM));
      for (let sy = y0; sy <= y1; sy++) {
        for (let sx = x0; sx <= x1; sx++) {
          const wx = (sx + 0.5) / LM;
          const wy = (sy + 0.5) / LM;
          const ci = Math.floor(wy) * m.w + Math.floor(wx);
          if (m.kind[ci] !== 0 && m.kind[ci] !== K_DOOR) continue;
          const dx = wx - L.x;
          const dy = wy - L.y;
          const d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (!L.open && d > 0.3) {
            if (castRay(m, L.x, L.y, dx, dy, 1, hit) && hit.dist < 0.97) continue;
          }
          const k = 1 - d / r;
          lm[sy * w + sx] += L.intensity * k * Math.sqrt(k);
        }
      }
    }
    // soften and clamp
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            s += lm[yy * w + xx];
            n++;
          }
        }
        out[y * w + x] = Math.min(15, s / n);
      }
    }
    this.baked = { world, lm: out, w, h };
    return this.baked;
  }

  private lightAt(b: Baked, x: number, y: number): number {
    let sx = Math.floor(x * LM);
    let sy = Math.floor(y * LM);
    if (sx < 0) sx = 0;
    else if (sx >= b.w) sx = b.w - 1;
    if (sy < 0) sy = 0;
    else if (sy >= b.h) sy = b.h - 1;
    return b.lm[sy * b.w + sx];
  }

  // ----------------------------------------------------------------- world

  renderWorld(world: World, alpha: number, time: number): void {
    const W = this.fbW;
    const H = this.fbH;
    if (!W) return;
    const fb = this.fb;
    const cmap = this.palette.cmap;
    const m = world.map;
    const p = world.player;
    const baked = this.bake(world);
    const lm = baked.lm;
    const lmW = baked.w;
    const lmH = baked.h;

    // interpolated camera
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    let da = p.angle - p.prevAngle;
    if (da > Math.PI) da -= Math.PI * 2;
    else if (da < -Math.PI) da += Math.PI * 2;
    const ang = p.prevAngle + da * alpha;
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    const planeX = -dirY * PLANE;
    const planeY = dirX * PLANE;
    const proj = W / 2 / PLANE;
    const projY = proj * ASPECT_Y;
    const horizon = H / 2;
    let camZ = EYE + Math.sin(p.bobPhase * 2) * 0.012 * p.bobAmp;
    if (p.dead) camZ = Math.max(0.07, EYE - p.deadT * 0.6);
    const ambient = BASE_SHADE + world.level.def.ambient - (world.flash > 0 ? 5 : 0);
    const NLm = NL - 1;

    // ------------------------------------------------ walls
    const Hc = world.level.def.height;
    // textures are pegged to the floor: offset so texel rows line up at the bottom
    const texOff = (128 - (Math.round(Hc * 128) & 127)) & 127;
    const lintelV = (Hc - 1) * 128;
    const zbuf = this.zbuf;
    const wallTop = this.wallTop;
    const wallBot = this.wallBot;
    const gapTop = this.gapTop;
    const gapBot = this.gapBot;
    const seen = world.seen;
    const hit = this.hit;
    const shadeAt = (dist: number, wx: number, wy: number, extra: number): number => {
      let lx = (wx * LM) | 0;
      let ly = (wy * LM) | 0;
      if (lx < 0) lx = 0;
      else if (lx >= lmW) lx = lmW - 1;
      if (ly < 0) ly = 0;
      else if (ly >= lmH) ly = lmH - 1;
      let L = (ambient + dist * FOG_PER_CELL - lm[ly * lmW + lx] + extra) | 0;
      if (L < 0) L = 0;
      else if (L > NLm) L = NLm;
      return L;
    };
    for (let x = 0; x < W; x++) {
      gapTop[x] = 0;
      gapBot[x] = 0;
      const camX = (2 * (x + 0.5)) / W - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;
      const rl = Math.hypot(rdx, rdy);
      if (!castRay(m, px, py, rdx, rdy, MAX_DIST, hit, seen)) {
        zbuf[x] = MAX_DIST;
        wallTop[x] = horizon | 0;
        wallBot[x] = horizon | 0;
      } else {
        const d = hit.dist < 0.02 ? 0.02 : hit.dist;
        zbuf[x] = d;
        const lineH = projY / d;
        const top = horizon - (Hc - camZ) * lineH;
        const bot = horizon + camZ * lineH;
        let y0 = Math.ceil(top - 0.5);
        let y1 = Math.ceil(bot - 0.5);
        if (y0 < 0) y0 = 0;
        if (y1 > H) y1 = H;
        wallTop[x] = y0;
        wallBot[x] = y1;
        if (y1 > y0) {
          const tex = this.assets.wall(hit.jamb ? this.jambId : hit.tex);
          const hw = hit.side === 0 ? py + d * rdy : px + d * rdx;
          // texture u grows to the viewer's right (map y points down)
          const flip = (hit.side === 0 && rdx < 0) || (hit.side === 1 && rdy > 0);
          const along = flip ? -hw : hw;
          const back = d - 0.06 / rl > 0 ? d - 0.06 / rl : 0;
          const L = shadeAt(d, px + rdx * back, py + rdy * back, hit.side === 1 ? 1.5 : 0);
          const base = L * PAL_SIZE;
          const step = 128 / lineH;
          let v = (y0 + 0.5 - top) * step;
          let o = y0 * W + x;
          if (hit.kind === K_DOOR && hit.door) {
            const dpx = tex.px;
            const dcol = (Math.floor(hit.u * 128) & 127) * 128;
            const ltex = this.assets.wall(hit.door.lintel);
            const lpx = ltex.px;
            const lcol = (Math.floor(along * 128) & (ltex.w - 1)) * 128;
            for (let y = y0; y < y1; y++) {
              const ty = ((v | 0) + texOff) & 127;
              fb[o] = cmap[base + (v < lintelV ? lpx[lcol + ty] : dpx[dcol + ty])];
              v += step;
              o += W;
            }
          } else {
            const tpx = tex.px;
            const col = (Math.floor(along * 128) & (tex.w - 1)) * 128;
            for (let y = y0; y < y1; y++) {
              fb[o] = cmap[base + tpx[col + (((v | 0) + texOff) & 127)]];
              v += step;
              o += W;
            }
          }
        }
      }
      // the wall above an open doorway (walls are taller than doors)
      const pd = hit.passDoor;
      if (pd && Hc > 1.001) {
        const dL = hit.passDist < 0.02 ? 0.02 : hit.passDist;
        const lineL = projY / dL;
        const lt = horizon - (Hc - camZ) * lineL;
        let ly0 = Math.ceil(lt - 0.5);
        let ly1 = Math.ceil(horizon - (1 - camZ) * lineL - 0.5);
        if (ly0 < 0) ly0 = 0;
        if (ly1 > H) ly1 = H;
        if (ly1 > ly0) {
          const ltex = this.assets.wall(pd.lintel);
          const hwL = pd.vertical ? py + dL * rdy : px + dL * rdx;
          const flipL = pd.vertical ? rdx < 0 : rdy > 0;
          const col = (Math.floor((flipL ? -hwL : hwL) * 128) & (ltex.w - 1)) * 128;
          const back = dL - 0.06 / rl > 0 ? dL - 0.06 / rl : 0;
          const base = shadeAt(dL, px + rdx * back, py + rdy * back, pd.vertical ? 0 : 1.5) * PAL_SIZE;
          const step = 128 / lineL;
          let v = (ly0 + 0.5 - lt) * step;
          let o = ly0 * W + x;
          const lpx = ltex.px;
          for (let y = ly0; y < ly1; y++) {
            fb[o] = cmap[base + lpx[col + (((v | 0) + texOff) & 127)]];
            v += step;
            o += W;
          }
          if (wallTop[x] > ly1) {
            gapTop[x] = ly1;
            gapBot[x] = wallTop[x];
          }
          if (ly0 < wallTop[x]) wallTop[x] = ly0;
        }
      }
    }

    // ------------------------------------------------ floor & ceiling
    const mw = m.w;
    const mh = m.h;
    const floorIds = m.floor;
    const ceilIds = m.ceil;
    const flats = this.flatCache();
    const fullbright = this.fullbrightFlat;
    const liquid = this.liquidFlat;
    const liqT = time * 10;
    const liqX = liqT | 0;
    const rayX0 = dirX - planeX * (1 - 1 / W);
    const rayY0 = dirY - planeY * (1 - 1 / W);
    const stepScaleX = (2 * planeX) / W;
    const stepScaleY = (2 * planeY) / W;
    for (let y = 0; y < H; y++) {
      const isFloor = y + 0.5 > horizon;
      const denom = isFloor ? y + 0.5 - horizon : horizon - (y + 0.5);
      if (denom <= 0) continue;
      const rowDist = ((isFloor ? camZ : Hc - camZ) * projY) / denom;
      const ids = isFloor ? floorIds : ceilIds;
      const rowShade = ambient + rowDist * FOG_PER_CELL;
      let fx = px + rowDist * rayX0;
      let fy = py + rowDist * rayY0;
      const sx = rowDist * stepScaleX;
      const sy = rowDist * stepScaleY;
      let o = y * W;
      for (let x = 0; x < W; x++, o++, fx += sx, fy += sy) {
        if (isFloor ? y < wallBot[x] : y >= wallTop[x] && (y < gapTop[x] || y >= gapBot[x])) continue;
        const cx = fx | 0;
        const cy = fy | 0;
        if (fx < 0 || fy < 0 || cx >= mw || cy >= mh) {
          fb[o] = cmap[NLm * PAL_SIZE];
          continue;
        }
        const f = ids[cy * mw + cx];
        let tx = ((fx * 128) | 0) & 63;
        let ty = ((fy * 128) | 0) & 63;
        let L: number;
        if (liquid[f]) {
          ty = (ty + ((Math.sin((tx + liqT) * 0.2) * 2) | 0)) & 63;
          tx = (tx + liqX) & 63;
        }
        if (fullbright[f]) {
          L = 0;
        } else {
          L = (rowShade - lm[((fy * LM) | 0) * lmW + ((fx * LM) | 0)]) | 0;
          if (L < 0) L = 0;
          else if (L > NLm) L = NLm;
        }
        fb[o] = cmap[L * PAL_SIZE + flats[f][(ty << 6) | tx]];
      }
    }

    // ------------------------------------------------ sprites
    this.drawCount = 0;
    const invPlane2 = 1 / (PLANE * PLANE);
    const addThing = (x: number, y: number, z: number, sprite: Sprite, mirror: boolean, bright: boolean) => {
      const sxw = x - px;
      const syw = y - py;
      const depth = sxw * dirX + syw * dirY;
      if (depth < 0.06 || depth > MAX_DIST) return;
      const camXv = (sxw * planeX + syw * planeY) * invPlane2;
      const screenX = (W / 2) * (1 + camXv / depth);
      const scale = proj / depth / 128;
      const half = Math.max(sprite.w, 64) * scale;
      if (screenX + half < 0 || screenX - half > W) return;
      let level = 0;
      if (!bright) {
        level = (ambient + depth * FOG_PER_CELL - this.lightAt(baked, x, y)) | 0;
        if (level < 0) level = 0;
        else if (level > NLm) level = NLm;
      }
      let d = this.draws[this.drawCount];
      if (!d) {
        d = { depth, sx: screenX, z, sprite, mirror, level };
        this.draws[this.drawCount] = d;
      } else {
        d.depth = depth;
        d.sx = screenX;
        d.z = z;
        d.sprite = sprite;
        d.mirror = mirror;
        d.level = level;
      }
      this.drawCount++;
    };

    const viewAngleTo = (x: number, y: number) => Math.atan2(y - py, x - px);
    for (const e of world.enemies) {
      const anim = MONSTER_ANIMS[e.type];
      let f: SeqFrame;
      let rotated = true;
      switch (e.state) {
        case "idle":
          f = seqFrame(anim.idle, e.bob, true);
          break;
        case "chase":
          f = seqFrame(anim.walk, e.walk, true);
          break;
        case "attack":
          f = seqFrame(anim.attack, e.t, false, e.def.attackTime / seqLength(anim.attack));
          break;
        case "pain":
          f = seqFrame(anim.pain, e.t, false);
          break;
        default: {
          const s = e.gib && anim.gib ? anim.gib : anim.death;
          f = seqFrame(s, e.t, false);
          rotated = false;
        }
      }
      let name: string;
      let mirror = false;
      if (rotated) {
        const rot = rotations(f.frame);
        const ri = rotationIndex(e.angle, viewAngleTo(e.x, e.y));
        name = rot.names[ri];
        mirror = rot.mirror[ri];
      } else {
        name = `${f.frame}0`;
      }
      const hover = anim.hover > 0 && e.state !== "dying" && e.state !== "dead" ? anim.hover + Math.sin(e.bob * 2) * 0.025 : 0;
      addThing(e.x, e.y, hover, this.assets.sprite(name), mirror, f.bright);
    }
    const keyAnim = KEY_SPRITES[world.level.def.key];
    for (const it of world.items) {
      if (it.taken) continue;
      const s = it.type === "key" ? keyAnim : ITEM_ANIMS[it.type];
      const f = seqFrame(s, time, true);
      addThing(it.x, it.y, 0, this.assets.sprite(`${f.frame}0`), false, f.bright);
    }
    for (const d of world.decos) {
      if (d.dead) continue;
      const s = d.type === "barrel" && d.fuse >= 0 ? BARREL_FUSE_ANIM : DECO_ANIMS[d.type];
      const f = d.fuse >= 0 ? seqFrame(s, 0.18 - d.fuse, false) : seqFrame(s, time + d.id * 0.13, true);
      addThing(d.x, d.y, 0, this.assets.sprite(`${f.frame}0`), false, f.bright);
    }
    for (const pr of world.projectiles) {
      const s = PROJECTILE_ANIMS[pr.type];
      const f = seqFrame(s, pr.t, true);
      let name = `${f.frame}0`;
      let mirror = false;
      if (pr.type === "rocket") {
        const rot = rotations(f.frame);
        const ri = rotationIndex(pr.angle, viewAngleTo(pr.x, pr.y));
        name = rot.names[ri];
        mirror = rot.mirror[ri];
      }
      // projectile sprites are anchored near their centre; lift them to flight height
      addThing(pr.x, pr.y, pr.z - 0.05, this.assets.sprite(name), mirror, true);
    }
    for (const fx of world.effects) {
      const s = EFFECT_ANIMS[fx.type];
      const idx = Math.min(s.length - 1, Math.floor((fx.t / fx.life) * s.length));
      const f = s[idx];
      addThing(fx.x, fx.y, fx.z, this.assets.sprite(`${f.frame}0`), false, f.bright);
    }

    // far to near
    const list = this.draws;
    const n = this.drawCount;
    for (let i = 1; i < n; i++) {
      const v = list[i];
      let j = i - 1;
      while (j >= 0 && list[j].depth < v.depth) {
        list[j + 1] = list[j];
        j--;
      }
      list[j + 1] = v;
    }
    for (let i = 0; i < n; i++) this.drawSprite(list[i], proj, projY, horizon, camZ);

    // ------------------------------------------------ weapon
    this.drawWeapon(world, time, ambient, baked);
  }

  private flatsCache: Uint16Array[] = [];
  private flatsVersion = -1;
  private flatCache(): Uint16Array[] {
    if (this.flatsVersion !== this.assets.version || this.flatsCache.length === 0) {
      this.flatsCache = FLAT_TEX.map((_, i) => this.assets.flat(i).px);
      this.flatsVersion = this.assets.version;
    }
    return this.flatsCache;
  }

  private drawSprite(d: SpriteDraw, proj: number, projY: number, horizon: number, camZ: number): void {
    const W = this.fbW;
    const H = this.fbH;
    const s = d.sprite;
    const scale = proj / d.depth / 128;
    const scaleY = projY / d.depth / 128;
    const inv = 1 / scale;
    const invY = 1 / scaleY;
    const ox = d.mirror ? s.w - s.ox : s.ox;
    const x0 = d.sx - ox * scale;
    const groundY = horizon + ((camZ - d.z) * projY) / d.depth;
    const y0 = groundY - s.oy * scaleY;
    let cx0 = Math.ceil(x0 - 0.5);
    let cx1 = Math.ceil(x0 + s.w * scale - 0.5);
    let cy0 = Math.ceil(y0 - 0.5);
    let cy1 = Math.ceil(y0 + s.h * scaleY - 0.5);
    if (cx0 < 0) cx0 = 0;
    if (cx1 > W) cx1 = W;
    if (cy0 < 0) cy0 = 0;
    if (cy1 > H) cy1 = H;
    if (cx1 <= cx0 || cy1 <= cy0) return;
    const fb = this.fb;
    const cmap = this.palette.cmap;
    const base = d.level * PAL_SIZE;
    const zb = this.zbuf;
    const px = s.px;
    const sh = s.h;
    const ty0 = (cy0 + 0.5 - y0) * invY;
    for (let x = cx0; x < cx1; x++) {
      if (zb[x] <= d.depth) continue;
      let tx = ((x + 0.5 - x0) * inv) | 0;
      if (tx >= s.w) tx = s.w - 1;
      if (d.mirror) tx = s.w - 1 - tx;
      const col = tx * sh;
      let ty = ty0;
      let o = cy0 * W + x;
      for (let y = cy0; y < cy1; y++) {
        let t = ty | 0;
        if (t >= sh) t = sh - 1;
        const c = px[col + t];
        if (c) fb[o] = cmap[base + c];
        ty += invY;
        o += W;
      }
    }
  }

  // ----------------------------------------------------------------- weapon

  private drawWeapon(world: World, time: number, ambient: number, baked: Baked): void {
    const p = world.player;
    const W = this.fbW;
    const H = this.fbH;
    const wdef = WEAPONS[p.weapon];
    const anim = WEAPON_ANIMS[wdef.id];
    let frame: SeqFrame = seqFrame(anim.ready, time, true);
    let flash: SeqFrame | null = null;
    let bobX = 0;
    let bobY = 0;
    let lower = 0;
    if (p.weaponState === "firing") {
      const alt = (p.refire & 1) === 1;
      const fire = alt && anim.fireAlt ? anim.fireAlt : anim.fire;
      const scale = wdef.cooldown / seqLength(fire);
      frame = seqFrame(fire, p.weaponT, false, scale);
      const fl = alt && anim.flashAlt ? anim.flashAlt : anim.flash;
      if (fl) {
        const ft = p.weaponT - anim.flashAt * TIC * scale;
        if (ft >= 0 && ft < seqLength(fl) * scale) flash = seqFrame(fl, ft, false, scale);
      }
    } else {
      bobX = Math.cos(p.bobPhase) * 16 * p.bobAmp;
      bobY = Math.abs(Math.sin(p.bobPhase)) * 16 * p.bobAmp;
      if (p.weaponState === "lowering") lower = 96 * Math.min(1, p.weaponT / SWITCH_TIME);
      else if (p.weaponState === "raising") lower = 96 * (1 - Math.min(1, p.weaponT / SWITCH_TIME));
    }
    if (p.dead) lower = Math.min(128, p.deadT * 160);
    if (world.exitTimer >= 0) lower = Math.max(lower, (0.9 - world.exitTimer) * 100);
    let level = (ambient + 1 - this.lightAt(baked, p.x, p.y)) | 0;
    if (level < 0) level = 0;
    if (level > 20) level = 20;
    const s = (W / 320) * WEAPON_SCALE;
    this.drawPsprite(this.assets.sprite(`${frame.frame}0`), s, bobX, bobY + lower, frame.bright ? 0 : level, W, H);
    if (flash) this.drawPsprite(this.assets.sprite(`${flash.frame}0`), s, bobX, bobY + lower, 0, W, H);
  }

  private drawPsprite(spr: Sprite, s: number, bobX: number, bobY: number, level: number, W: number, H: number): void {
    // reference position (320x200): top-left = (1 - ox, 32 - oy)
    const sy = s * ASPECT_Y;
    const refX = 1 - spr.ox + bobX;
    const refY = 32 - spr.oy + bobY;
    const x0 = W / 2 + (refX - 160) * s;
    const y0 = H - (200 - refY) * sy;
    let cx0 = Math.ceil(x0 - 0.5);
    let cx1 = Math.ceil(x0 + spr.w * s - 0.5);
    let cy0 = Math.ceil(y0 - 0.5);
    let cy1 = Math.ceil(y0 + spr.h * sy - 0.5);
    if (cx0 < 0) cx0 = 0;
    if (cx1 > W) cx1 = W;
    if (cy0 < 0) cy0 = 0;
    if (cy1 > H) cy1 = H;
    const inv = 1 / s;
    const invY = 1 / sy;
    const fb = this.fb;
    const cmap = this.palette.cmap;
    const base = level * PAL_SIZE;
    for (let x = cx0; x < cx1; x++) {
      let tx = ((x + 0.5 - x0) * inv) | 0;
      if (tx >= spr.w) tx = spr.w - 1;
      const col = tx * spr.h;
      let ty = (cy0 + 0.5 - y0) * invY;
      let o = cy0 * W + x;
      for (let y = cy0; y < cy1; y++) {
        let t = ty | 0;
        if (t >= spr.h) t = spr.h - 1;
        const c = spr.px[col + t];
        if (c) fb[o] = cmap[base + c];
        ty += invY;
        o += W;
      }
    }
  }

  // ----------------------------------------------------------------- title fire

  /** Advances the classic fire effect one step and draws it. */
  stepFire(intensity: number): void {
    const W = this.fbW;
    const H = this.fbH;
    if (!W) return;
    const fire = this.fire;
    const src = Math.max(0, Math.min(36, Math.round(intensity)));
    for (let x = 0; x < W; x++) fire[(H - 1) * W + x] = src;
    let seed = this.fireRng;
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const from = y * W + x;
        const v = fire[from];
        if (v === 0) {
          fire[from - W] = 0;
          continue;
        }
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const r = (seed >> 16) & 3;
        let to = from - W - r + 1;
        if (to < 0) to = 0;
        fire[to] = v - (r & 1);
      }
    }
    this.fireRng = seed;
    const fb = this.fb;
    const pal = this.firePal;
    const lastRow = (H - 1) * W;
    for (let i = 0; i < lastRow; i++) fb[i] = pal[fire[i]];
    // hide the white-hot source row
    for (let i = lastRow; i < fb.length; i++) fb[i] = pal[fire[i - W]];
  }

  /** Darkens the framebuffer (used behind menus). */
  dim(factor: number): void {
    const fb = this.fb;
    const k = Math.max(0, Math.min(1, factor));
    const ki = Math.round(k * 256);
    for (let i = 0; i < fb.length; i++) {
      const c = fb[i];
      const r = ((c & 255) * ki) >> 8;
      const g = (((c >> 8) & 255) * ki) >> 8;
      const b = (((c >> 16) & 255) * ki) >> 8;
      fb[i] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
  }

  /** Blends the framebuffer towards red (death screen). */
  tintRed(amount: number): void {
    const fb = this.fb;
    const a = Math.round(Math.max(0, Math.min(1, amount)) * 256);
    const ia = 256 - a;
    for (let i = 0; i < fb.length; i++) {
      const c = fb[i];
      const r = c & 255;
      const g = (c >> 8) & 255;
      const b = (c >> 16) & 255;
      const lum = (r * 77 + g * 150 + b * 29) >> 8;
      const nr = (r * ia + Math.min(255, lum * 1.4 + 30) * a) >> 8;
      const ng = (g * ia + lum * 0.25 * a) >> 8;
      const nb = (b * ia + lum * 0.2 * a) >> 8;
      fb[i] = 0xff000000 | (nb << 16) | (ng << 8) | nr;
    }
  }
}
