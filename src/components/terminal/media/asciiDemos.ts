/**
 * Real-time ASCII "videos" for the terminal's `video` command.
 *
 * `renderDemo(id, tSec, cols, rows, state)` returns `rows` lines of exactly
 * `cols` characters joined by "\n". Demos are time-based (smooth at any frame
 * rate). Stateful demos (fire, matrix, life) return an opaque `state` that the
 * caller passes back on the next frame; it is re-created automatically when
 * the size changes or when it belongs to another demo.
 *
 * Everything renders into a reusable Uint16Array of char codes and is turned
 * into a string once per line, so a 100×40 frame costs well under 1 ms.
 */

export type DemoId =
  | "starfield"
  | "plasma"
  | "fire"
  | "matrix"
  | "tunnel"
  | "donut"
  | "waves"
  | "life";

export const DEMOS: { id: DemoId; title: { tr: string; en: string } }[] = [
  { id: "plasma", title: { tr: "Plazma", en: "Plasma" } },
  { id: "fire", title: { tr: "Ateş", en: "Fire" } },
  { id: "tunnel", title: { tr: "Tünel", en: "Tunnel" } },
  { id: "matrix", title: { tr: "Matris Yağmuru", en: "Matrix Rain" } },
  { id: "donut", title: { tr: "Dönen Simit", en: "Spinning Donut" } },
  { id: "starfield", title: { tr: "Yıldız Alanı", en: "Starfield" } },
  { id: "waves", title: { tr: "Gece Dalgaları", en: "Night Waves" } },
  { id: "life", title: { tr: "Hayat Oyunu", en: "Game of Life" } },
];

const DEMO_IDS: readonly DemoId[] = DEMOS.map((d) => d.id);

/** Fixed mapping for the site's files; other names: keyword, then hash. */
const FILE_DEMOS: Readonly<Record<string, DemoId>> = {
  loop: "plasma",
  loop1: "plasma",
  loop2: "fire",
  loop3: "tunnel",
  loop4: "matrix",
  loop5: "donut",
  loop6: "starfield",
  loop7: "waves",
  loop8: "life",
};

const KEYWORDS: readonly [RegExp, DemoId][] = [
  [/star|space|warp|galaxy/, "starfield"],
  [/plasma|lava|psy/, "plasma"],
  [/fire|flame|burn|inferno/, "fire"],
  [/matrix|rain|code|hack/, "matrix"],
  [/tunnel|wormhole|tube/, "tunnel"],
  [/donut|torus|simit|ring/, "donut"],
  [/wave|ocean|sea|surf|tide/, "waves"],
  [/life|conway|cell|gol/, "life"],
];

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function demoForFile(fileName: string): DemoId {
  const base = (String(fileName ?? "").split(/[\\/]/).pop() ?? "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .trim()
    .toLowerCase();
  const fixed = FILE_DEMOS[base];
  if (fixed) {
    return fixed;
  }
  for (const [pattern, id] of KEYWORDS) {
    if (pattern.test(base)) {
      return id;
    }
  }
  return DEMO_IDS[fnv1a(base || "video") % DEMO_IDS.length];
}

// ---------------------------------------------------------------------------
// Shared helpers

const RAMP = " .:-=+*#%@";
const RAMP_CODES = Uint16Array.from(RAMP, (c) => c.charCodeAt(0));
const RAMP_MAX = RAMP_CODES.length - 1;
const SPACE = 32;
const TAU = Math.PI * 2;

const codesOf = (s: string) => Uint16Array.from(s, (c) => c.charCodeAt(0));

let scratch = new Uint16Array(0);

function grid(cols: number, rows: number): Uint16Array {
  const size = cols * rows;
  if (scratch.length < size) {
    scratch = new Uint16Array(size);
  }
  const g = scratch.subarray(0, size);
  g.fill(SPACE);
  return g;
}

function toText(g: Uint16Array, cols: number, rows: number): string {
  const lines = new Array<string>(rows);
  for (let y = 0; y < rows; y += 1) {
    const start = y * cols;
    if (cols <= 4096) {
      lines[y] = String.fromCharCode.apply(
        null,
        g.subarray(start, start + cols) as unknown as number[],
      );
    } else {
      let line = "";
      for (let x = 0; x < cols; x += 4096) {
        line += String.fromCharCode.apply(
          null,
          g.subarray(start + x, start + Math.min(cols, x + 4096)) as unknown as number[],
        );
      }
      lines[y] = line;
    }
  }
  return lines.join("\n");
}

/** 0..1 brightness → ramp char code. */
function shade(v: number): number {
  const i = (v * RAMP_MAX + 0.5) | 0;
  return RAMP_CODES[i < 0 ? 0 : i > RAMP_MAX ? RAMP_MAX : i];
}

/** Integer hash → [0, 1). */
function hash01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function xorshift(state: { rng: number }): number {
  let s = state.rng | 0 || 0x1234567;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  state.rng = s;
  return (s >>> 0) / 4294967296;
}

function stepClock(state: { lastT: number }, tSec: number, maxDt = 0.25): number {
  const dt = tSec - state.lastT;
  state.lastT = tSec;
  if (!(dt > 0)) {
    return 0;
  }
  return dt > maxDt ? maxDt : dt;
}

// ---------------------------------------------------------------------------
// Plasma (stateless)

let plasmaCols: Float32Array = new Float32Array(0);
let plasmaRows: Float32Array = new Float32Array(0);

function plasma(t: number, cols: number, rows: number, g: Uint16Array) {
  const scale = 9 / Math.max(cols, rows * 2);
  if (plasmaCols.length < cols) {
    plasmaCols = new Float32Array(cols);
  }
  if (plasmaRows.length < rows) {
    plasmaRows = new Float32Array(rows);
  }
  const W = cols * scale;
  const H = rows * 2 * scale;
  const cx = W * (0.5 + 0.35 * Math.sin(t * 0.37));
  const cy = H * (0.5 + 0.35 * Math.cos(t * 0.29));
  for (let x = 0; x < cols; x += 1) {
    plasmaCols[x] = Math.sin(x * scale * 1.1 + t * 0.9);
  }
  for (let y = 0; y < rows; y += 1) {
    plasmaRows[y] = Math.sin(y * 2 * scale * 1.4 - t * 0.7);
  }
  const k = 0.7 + 0.2 * Math.sin(t * 0.21);
  let i = 0;
  for (let y = 0; y < rows; y += 1) {
    const Y = y * 2 * scale;
    const dy = Y - cy;
    const row = plasmaRows[y];
    for (let x = 0; x < cols; x += 1) {
      const X = x * scale;
      const dx = X - cx;
      const v =
        plasmaCols[x] +
        row +
        Math.sin((X + Y) * k + t * 0.6) +
        Math.sin(Math.sqrt(dx * dx + dy * dy) * 1.5 - t * 1.3);
      const s = 0.5 + 0.5 * Math.sin(v * 1.9 + t * 0.5);
      g[i] = shade(Math.pow(s, 1.35));
      i += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Tunnel (stateless): flying through a curving wireframe tube of rings and
// spokes; near geometry is bright, the vanishing point fades to black.

function tunnel(t: number, cols: number, rows: number, g: Uint16Array) {
  const cx = cols * (0.5 + 0.14 * Math.sin(t * 0.53));
  const cy = rows * (0.5 + 0.17 * Math.cos(t * 0.41));
  const R = Math.max(1, Math.min(cols, rows * 2) * 0.5);
  const invR = 1 / R;
  const travel = t * 1.6;
  const spin = t * 0.08;
  const SPOKES = 12;
  let i = 0;
  for (let y = 0; y < rows; y += 1) {
    const dy = (y + 0.5 - cy) * 2;
    for (let x = 0; x < cols; x += 1) {
      const dx = x + 0.5 - cx;
      const d = Math.sqrt(dx * dx + dy * dy) * invR + 1e-4;
      const depth = 1 / d;
      const u = depth * 1.4 + travel;
      const ring = u - Math.floor(u);
      const a = (Math.atan2(dy, dx) / TAU) * SPOKES + spin + depth * 0.25;
      const spoke = a - Math.floor(a);
      let v = 0.13;
      if (ring < 0.16) {
        v = 1;
      } else if (spoke < 0.09 || spoke > 0.97) {
        v = 0.55;
      } else if (ring < 0.3) {
        v = 0.3;
      }
      const fog = d >= 0.85 ? 1 : Math.pow(d / 0.85, 1.4);
      g[i] = shade(v * fog);
      i += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Starfield (stateless: each star's depth is a function of time)

const STAR_CODES = codesOf(" .:+*#@");

let starBright: Float32Array = new Float32Array(0);

function starfield(t: number, cols: number, rows: number, g: Uint16Array) {
  const size = cols * rows;
  if (starBright.length < size) {
    starBright = new Float32Array(size);
  }
  const bright = starBright.subarray(0, size);
  bright.fill(0);
  const count = Math.max(60, Math.min(1200, Math.round(size / 8)));
  const cx = cols / 2 + Math.sin(t * 0.21) * cols * 0.04;
  const cy = rows / 2 + Math.cos(t * 0.17) * rows * 0.04;
  const unit = Math.max(cols, rows * 2) * 0.5;
  const plot = (px: number, py: number, b: number) => {
    const ix = px | 0;
    const iy = py | 0;
    if (px < 0 || py < 0 || ix >= cols || iy >= rows) {
      return;
    }
    const idx = iy * cols + ix;
    if (b > bright[idx]) {
      bright[idx] = b;
    }
  };
  for (let s = 0; s < count; s += 1) {
    const x0 = hash01(s, 1) * 2 - 1;
    const y0 = hash01(s, 2) * 2 - 1;
    const speed = 0.16 + 0.14 * hash01(s, 3);
    let z = hash01(s, 4) - t * speed;
    z -= Math.floor(z);
    z = 0.04 + z * 0.96;
    const px = cx + (x0 / z) * unit * 0.5;
    const py = cy + (y0 / z) * unit * 0.25;
    const b = Math.pow(1 - z, 1.6);
    plot(px, py, b);
    if (z < 0.4) {
      // short motion streak towards the centre
      const z2 = z + 0.035;
      plot(cx + (x0 / z2) * unit * 0.5, cy + (y0 / z2) * unit * 0.25, b * 0.45);
    }
  }
  const max = STAR_CODES.length - 1;
  for (let i = 0; i < size; i += 1) {
    const b = bright[i];
    if (b > 0) {
      const k = Math.min(max, 1 + ((b * max) | 0));
      g[i] = STAR_CODES[k];
    }
  }
}

// ---------------------------------------------------------------------------
// Donut (the classic spinning torus, stateless)

const DONUT_CODES = codesOf(".,-~:;=!*#$@");

type DonutTables = { nT: number; nP: number; cT: Float32Array; sT: Float32Array; cP: Float32Array; sP: Float32Array };
let donutTables: DonutTables | null = null;
let donutZ: Float32Array = new Float32Array(0);

function donut(t: number, cols: number, rows: number, g: Uint16Array) {
  const R1 = 1;
  const R2 = 2;
  const K2 = 5;
  const span = Math.min(cols, rows * 2);
  const K1 = (span * K2 * 3) / (8 * (R1 + R2));
  const nT = Math.max(24, Math.min(200, Math.ceil(K1 * 2.4)));
  const nP = Math.max(60, Math.min(600, Math.ceil(K1 * 7.2)));
  if (!donutTables || donutTables.nT !== nT || donutTables.nP !== nP) {
    const cT = new Float32Array(nT);
    const sT = new Float32Array(nT);
    const cP = new Float32Array(nP);
    const sP = new Float32Array(nP);
    for (let i = 0; i < nT; i += 1) {
      cT[i] = Math.cos((i / nT) * TAU);
      sT[i] = Math.sin((i / nT) * TAU);
    }
    for (let i = 0; i < nP; i += 1) {
      cP[i] = Math.cos((i / nP) * TAU);
      sP[i] = Math.sin((i / nP) * TAU);
    }
    donutTables = { nT, nP, cT, sT, cP, sP };
  }
  const size = cols * rows;
  if (donutZ.length < size) {
    donutZ = new Float32Array(size);
  }
  const zbuf = donutZ.subarray(0, size);
  zbuf.fill(0);
  const A = t * 1.1;
  const B = t * 0.55;
  const cosA = Math.cos(A);
  const sinA = Math.sin(A);
  const cosB = Math.cos(B);
  const sinB = Math.sin(B);
  const { cT, sT, cP, sP } = donutTables;
  const halfW = cols / 2;
  const halfH = rows / 2;
  const kx = K1;
  const ky = K1 * 0.5;
  const lumMax = DONUT_CODES.length - 1;
  for (let i = 0; i < nT; i += 1) {
    const costheta = cT[i];
    const sintheta = sT[i];
    const circlex = R2 + R1 * costheta;
    const circley = R1 * sintheta;
    for (let j = 0; j < nP; j += 1) {
      const cosphi = cP[j];
      const sinphi = sP[j];
      const x = circlex * (cosB * cosphi + sinA * sinB * sinphi) - circley * cosA * sinB;
      const y = circlex * (sinB * cosphi - sinA * cosB * sinphi) + circley * cosA * cosB;
      const z = K2 + cosA * circlex * sinphi + circley * sinA;
      const ooz = 1 / z;
      const xp = (halfW + kx * ooz * x) | 0;
      const yp = (halfH - ky * ooz * y) | 0;
      if (xp < 0 || yp < 0 || xp >= cols || yp >= rows) {
        continue;
      }
      const idx = yp * cols + xp;
      if (ooz <= zbuf[idx]) {
        continue;
      }
      zbuf[idx] = ooz;
      const L =
        cosphi * costheta * sinB -
        cosA * costheta * sinphi -
        sinA * sintheta +
        cosB * (cosA * sintheta - costheta * sinA * sinphi);
      const li = L > 0 ? Math.min(lumMax, (L * 8) | 0) : 0;
      g[idx] = DONUT_CODES[li];
    }
  }
}

// ---------------------------------------------------------------------------
// Night waves (stateless): moon, stars and three parallax wave layers

function waves(t: number, cols: number, rows: number, g: Uint16Array) {
  const horizon = rows * 0.42;
  const moonX = cols * 0.74;
  const moonY = rows * 0.2;
  const moonR = Math.max(1.5, Math.min(cols, rows * 2) * 0.075);
  const sea = rows - horizon;
  const layerBase = [horizon, horizon + sea * 0.32, horizon + sea * 0.62];
  const layerAmp = [sea * 0.03, sea * 0.07, sea * 0.12];
  const layerK = [0.31, 0.19, 0.11].map((k) => (k * 80) / Math.max(20, cols));
  const layerSpeed = [0.7, 1.0, 1.35];
  const layerTone = [0.45, 0.6, 0.75];
  const height = (layer: number, x: number) =>
    layerBase[layer] +
    layerAmp[layer] *
      (Math.sin(x * layerK[layer] - t * layerSpeed[layer]) * 0.65 +
        Math.sin(x * layerK[layer] * 2.3 + t * layerSpeed[layer] * 0.8 + layer * 1.7) * 0.35);
  const twinkle = Math.floor(t * 3);
  for (let x = 0; x < cols; x += 1) {
    const h0 = height(0, x);
    const h1 = height(1, x);
    const h2 = height(2, x);
    const peak2 = Math.sin(x * layerK[2] - t * layerSpeed[2]) > 0.93;
    for (let y = 0; y < rows; y += 1) {
      const idx = y * cols + x;
      const yc = y + 0.5;
      let layer = -1;
      let surface = 0;
      if (yc >= h2) {
        layer = 2;
        surface = h2;
      } else if (yc >= h1) {
        layer = 1;
        surface = h1;
      } else if (yc >= h0) {
        layer = 0;
        surface = h0;
      }
      if (layer < 0) {
        // sky
        const dx = (x + 0.5 - moonX) / moonR;
        const dy = ((yc - moonY) * 2) / moonR;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) {
          const crater = hash01(Math.floor(dx * 2.2 + 9), Math.floor(dy * 2.2 + 9), 7) < 0.22;
          g[idx] = crater ? 0x25 /* % */ : 0x40 /* @ */;
        } else if (d < 1.35) {
          g[idx] = 0x3a; // :
        } else if (d < 1.7) {
          g[idx] = 0x2e; // .
        } else if (hash01(x, y, 3) < 0.018) {
          g[idx] = hash01(x, y, twinkle) < 0.25 ? 0x2b /* + */ : 0x2e;
        }
        continue;
      }
      const depth = yc - surface;
      if (depth < 1) {
        // crest line; foam on the front layer's peaks
        g[idx] = layer === 2 ? (peak2 ? 0x40 /* @ foam */ : 0x7e /* ~ */) : layer === 1 ? 0x7e : 0x2d;
        continue;
      }
      // moon glitter path
      const pathW = 0.6 + (yc - horizon) * 0.28;
      if (Math.abs(x + 0.5 - moonX) < pathW && hash01(x, y, Math.floor(t * 7)) < 0.45) {
        g[idx] = hash01(x, y, 11) < 0.5 ? 0x3d : 0x2d; // = or -
        continue;
      }
      // horizontal wavelets drifting along each row; denser on near layers
      const rowPhase = hash01(y, 5) * TAU;
      const n =
        0.5 +
        0.5 * Math.sin(x * (0.42 - layer * 0.08) + rowPhase - t * (1.1 + layer * 0.5) + depth * 0.4);
      const v = n * layerTone[layer] * (1.25 - Math.min(0.5, depth * 0.04));
      g[idx] = v > 0.6 ? 0x3d /* = */ : v > 0.36 ? 0x2d /* - */ : v > 0.18 ? 0x2e /* . */ : SPACE;
    }
  }
}

// ---------------------------------------------------------------------------
// Fire (stateful)

type FireState = {
  kind: "fire";
  cols: number;
  rows: number;
  heat: Float32Array;
  rng: number;
  lastT: number;
  acc: number;
};

const FIRE_HZ = 30;

function fireStep(s: FireState) {
  const W = s.cols;
  const H = s.rows + 2;
  const heat = s.heat;
  const base = (H - 1) * W;
  for (let x = 0; x < W; x += 1) {
    const r = xorshift(s);
    heat[base + x] = r < 0.55 ? 1 : 0.2 + 0.5 * r;
    heat[base - W + x] = heat[base - W + x] * 0.5 + heat[base + x] * 0.5;
  }
  const cool = 1.25 / Math.max(8, s.rows);
  for (let y = 0; y < H - 2; y += 1) {
    const row = y * W;
    const below = row + W;
    const below2 = row + 2 * W;
    for (let x = 0; x < W; x += 1) {
      const xl = x > 0 ? x - 1 : x;
      const xr = x < W - 1 ? x + 1 : x;
      const avg = (heat[below + xl] + heat[below + x] + heat[below + xr] + heat[below2 + x]) * 0.25;
      const v = avg - cool * (0.4 + 1.2 * xorshift(s));
      heat[row + x] = v > 0 ? v : 0;
    }
  }
}

function fire(t: number, cols: number, rows: number, g: Uint16Array, prev: unknown): FireState {
  let s = prev as FireState | undefined;
  if (!s || s.kind !== "fire" || s.cols !== cols || s.rows !== rows) {
    s = {
      kind: "fire",
      cols,
      rows,
      heat: new Float32Array(cols * (rows + 2)),
      rng: 0x2545f491,
      lastT: t,
      acc: 0,
    };
    for (let i = 0; i < rows + 8; i += 1) {
      fireStep(s);
    }
  }
  s.acc += stepClock(s, t);
  let steps = 0;
  while (s.acc >= 1 / FIRE_HZ && steps < 4) {
    fireStep(s);
    s.acc -= 1 / FIRE_HZ;
    steps += 1;
  }
  if (steps === 4) {
    s.acc = 0;
  }
  const heat = s.heat;
  const n = cols * rows;
  for (let i = 0; i < n; i += 1) {
    const h = heat[i];
    g[i] = h <= 0.02 ? SPACE : shade(Math.pow(h, 0.85) * 1.1);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Matrix rain (stateful)

const MATRIX_GLYPHS = codesOf("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ$+-*/=%#&<>?:;|");
const MATRIX_DIM = codesOf(":;.,'`");
const MATRIX_HEAD = codesOf("@#%&$");

type MatrixState = {
  kind: "matrix";
  cols: number;
  rows: number;
  head: Float32Array;
  speed: Float32Array;
  len: Float32Array;
  glyph: Uint16Array;
  age: Float32Array;
  rng: number;
  lastT: number;
};

function matrixSpawn(s: MatrixState, x: number, initial: boolean) {
  const rows = s.rows;
  s.speed[x] = rows * (0.35 + 0.8 * xorshift(s));
  s.len[x] = Math.max(4, rows * (0.25 + 0.6 * xorshift(s)));
  s.head[x] = initial ? xorshift(s) * (rows + s.len[x]) : -xorshift(s) * rows * 0.7;
}

function matrix(t: number, cols: number, rows: number, g: Uint16Array, prev: unknown): MatrixState {
  let s = prev as MatrixState | undefined;
  const n = cols * rows;
  if (!s || s.kind !== "matrix" || s.cols !== cols || s.rows !== rows) {
    s = {
      kind: "matrix",
      cols,
      rows,
      head: new Float32Array(cols),
      speed: new Float32Array(cols),
      len: new Float32Array(cols),
      glyph: new Uint16Array(n),
      age: new Float32Array(n).fill(1e6),
      rng: 0x6d2b79f5,
      lastT: t,
    };
    for (let x = 0; x < cols; x += 1) {
      matrixSpawn(s, x, true);
      const head = s.head[x];
      for (let y = 0; y < rows && y <= head; y += 1) {
        const idx = y * cols + x;
        s.glyph[idx] = MATRIX_GLYPHS[(xorshift(s) * MATRIX_GLYPHS.length) | 0];
        s.age[idx] = (head - y) / s.speed[x];
      }
    }
  }
  const dt = stepClock(s, t);
  const { head, speed, len, glyph, age } = s;
  if (dt > 0) {
    for (let i = 0; i < n; i += 1) {
      age[i] += dt;
    }
    for (let x = 0; x < cols; x += 1) {
      const from = Math.max(0, Math.ceil(head[x]));
      head[x] += speed[x] * dt;
      const to = Math.min(rows - 1, Math.floor(head[x]));
      for (let y = from; y <= to; y += 1) {
        const idx = y * cols + x;
        glyph[idx] = MATRIX_GLYPHS[(xorshift(s) * MATRIX_GLYPHS.length) | 0];
        age[idx] = (head[x] - y) / speed[x];
      }
      if (head[x] - len[x] > rows) {
        matrixSpawn(s, x, false);
      }
    }
    // flicker: re-roll a few glyphs inside live trails
    const flips = Math.max(1, (n * dt * 0.6) | 0);
    for (let k = 0; k < flips; k += 1) {
      const idx = (xorshift(s) * n) | 0;
      if (age[idx] < 1) {
        glyph[idx] = MATRIX_GLYPHS[(xorshift(s) * MATRIX_GLYPHS.length) | 0];
      }
    }
  }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const idx = y * cols + x;
      const trail = len[x] / speed[x];
      const f = age[idx] / trail;
      if (f >= 1) {
        continue;
      }
      if (y === Math.floor(head[x])) {
        g[idx] = MATRIX_HEAD[glyph[idx] % MATRIX_HEAD.length];
      } else if (f < 0.62) {
        g[idx] = glyph[idx];
      } else if (f < 0.85) {
        g[idx] = MATRIX_DIM[glyph[idx] % MATRIX_DIM.length];
      } else {
        g[idx] = 0x2e;
      }
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Conway's Game of Life (stateful, torus, re-seeds when stale)

type LifeState = {
  kind: "life";
  cols: number;
  rows: number;
  cells: Uint8Array;
  next: Uint8Array;
  age: Uint8Array;
  trail: Uint8Array;
  rng: number;
  lastT: number;
  acc: number;
  generation: number;
  history: Int32Array;
  historyPos: number;
  stale: number;
  sparse: number;
  population: number;
  seeds: number;
};

const LIFE_HZ = 10;
const LIFE_MAX_GENERATIONS = 1500;

function lifeSeed(s: LifeState) {
  s.seeds += 1;
  s.rng = (0x1f123bb5 ^ Math.imul(s.seeds, 0x9e3779b1)) | 0;
  const n = s.cols * s.rows;
  let pop = 0;
  for (let i = 0; i < n; i += 1) {
    const alive = xorshift(s) < 0.3 ? 1 : 0;
    s.cells[i] = alive;
    s.age[i] = 0;
    pop += alive;
  }
  s.population = pop;
  s.generation = 0;
  s.history.fill(0);
  s.historyPos = 0;
  s.stale = 0;
  s.sparse = 0;
}

function lifeStep(s: LifeState) {
  const { cols, rows, cells, next, age, trail } = s;
  let hash = 0x811c9dc5 | 0;
  let pop = 0;
  for (let y = 0; y < rows; y += 1) {
    const up = (y === 0 ? rows - 1 : y - 1) * cols;
    const mid = y * cols;
    const down = (y === rows - 1 ? 0 : y + 1) * cols;
    for (let x = 0; x < cols; x += 1) {
      const l = x === 0 ? cols - 1 : x - 1;
      const r = x === cols - 1 ? 0 : x + 1;
      const count =
        cells[up + l] + cells[up + x] + cells[up + r] +
        cells[mid + l] + cells[mid + r] +
        cells[down + l] + cells[down + x] + cells[down + r];
      const i = mid + x;
      const alive = count === 3 || (count === 2 && cells[i] === 1) ? 1 : 0;
      next[i] = alive;
      if (alive) {
        age[i] = cells[i] ? Math.min(255, age[i] + 1) : 0;
        trail[i] = 4;
        pop += 1;
        hash = Math.imul(hash ^ i, 0x01000193);
      } else {
        age[i] = 0;
        if (trail[i] > 0) {
          trail[i] -= 1;
        }
      }
    }
  }
  s.cells = next;
  s.next = cells;
  s.generation += 1;
  s.population = pop;
  let repeated = false;
  for (let k = 0; k < s.history.length; k += 1) {
    if (s.history[k] === hash) {
      repeated = true;
      break;
    }
  }
  s.history[s.historyPos] = hash;
  s.historyPos = (s.historyPos + 1) % s.history.length;
  s.stale = repeated ? s.stale + 1 : 0;
  s.sparse = pop < cols * rows * 0.025 ? s.sparse + 1 : 0;
  if (pop === 0 || s.stale > 25 || s.sparse > 40 || s.generation > LIFE_MAX_GENERATIONS) {
    lifeSeed(s);
  }
}

const LIFE_ALIVE = codesOf("@%#");
const LIFE_TRAIL = codesOf(" .:+");

function life(t: number, cols: number, rows: number, g: Uint16Array, prev: unknown): LifeState {
  let s = prev as LifeState | undefined;
  const n = cols * rows;
  if (!s || s.kind !== "life" || s.cols !== cols || s.rows !== rows) {
    s = {
      kind: "life",
      cols,
      rows,
      cells: new Uint8Array(n),
      next: new Uint8Array(n),
      age: new Uint8Array(n),
      trail: new Uint8Array(n),
      rng: 0,
      lastT: t,
      acc: 0,
      generation: 0,
      history: new Int32Array(16),
      historyPos: 0,
      stale: 0,
      sparse: 0,
      population: 0,
      seeds: 0,
    };
    lifeSeed(s);
  }
  s.acc += stepClock(s, t);
  let steps = 0;
  while (s.acc >= 1 / LIFE_HZ && steps < 3) {
    lifeStep(s);
    s.acc -= 1 / LIFE_HZ;
    steps += 1;
  }
  if (steps === 3) {
    s.acc = 0;
  }
  const { cells, age, trail } = s;
  for (let i = 0; i < n; i += 1) {
    if (cells[i]) {
      const a = age[i];
      g[i] = LIFE_ALIVE[a === 0 ? 0 : a < 4 ? 1 : 2];
    } else if (trail[i] > 0) {
      g[i] = LIFE_TRAIL[trail[i] > 3 ? 3 : trail[i]];
    }
  }
  return s;
}

// ---------------------------------------------------------------------------

export function renderDemo(
  id: DemoId,
  tSec: number,
  cols: number,
  rows: number,
  state?: unknown,
): { text: string; state?: unknown } {
  const c = Math.max(0, Math.floor(Number.isFinite(cols) ? cols : 0));
  const r = Math.max(0, Math.floor(Number.isFinite(rows) ? rows : 0));
  if (c === 0 || r === 0) {
    return { text: r > 0 ? new Array<string>(r).fill("").join("\n") : "", state };
  }
  const t = Number.isFinite(tSec) ? tSec : 0;
  const g = grid(c, r);
  let next: unknown = undefined;
  switch (id) {
    case "plasma":
      plasma(t, c, r, g);
      break;
    case "tunnel":
      tunnel(t, c, r, g);
      break;
    case "starfield":
      starfield(t, c, r, g);
      break;
    case "donut":
      donut(t, c, r, g);
      break;
    case "waves":
      waves(t, c, r, g);
      break;
    case "fire":
      next = fire(t, c, r, g, state);
      break;
    case "matrix":
      next = matrix(t, c, r, g, state);
      break;
    case "life":
      next = life(t, c, r, g, state);
      break;
    default:
      plasma(t, c, r, g);
      break;
  }
  return { text: toText(g, c, r), state: next };
}
