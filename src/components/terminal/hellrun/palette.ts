// Dynamic indexed palette + light colormap.
//
// Every texel in HELLRUN is stored as a 16-bit palette index. Loaded PNGs and
// procedural fallbacks register their colours here on conversion. For each
// index we precompute NL shaded versions (fading into a warm fog), so shading a
// pixel is a single lookup: cmap[level * PAL_SIZE + index].

export const NL = 32;
export const PAL_SIZE = 1024;

/** Warm dark fog colour things fade into. */
const FOG: [number, number, number] = [22, 11, 7];

export class Palette {
  /** 0xRRGGBB per index */
  readonly rgb = new Uint32Array(PAL_SIZE);
  /** ABGR (ImageData byte order on little-endian) per level*PAL_SIZE + index */
  readonly cmap = new Uint32Array(NL * PAL_SIZE);
  private readonly lookup = new Map<number, number>();
  private count = 1;
  private lastKey = -1;
  private lastIndex = 0;

  get size(): number {
    return this.count;
  }

  /** Index 0 is reserved for "transparent". */
  index(r: number, g: number, b: number): number {
    const key = (r << 16) | (g << 8) | b;
    if (key === this.lastKey) return this.lastIndex;
    let i = this.lookup.get(key);
    if (i === undefined) {
      if (this.count < PAL_SIZE) {
        i = this.count++;
        this.rgb[i] = key;
        this.computeRow(i);
      } else {
        i = this.nearest(r, g, b);
      }
      this.lookup.set(key, i);
    }
    this.lastKey = key;
    this.lastIndex = i;
    return i;
  }

  indexHex(hex: number): number {
    return this.index((hex >> 16) & 255, (hex >> 8) & 255, hex & 255);
  }

  private nearest(r: number, g: number, b: number): number {
    let best = 1;
    let bestD = Infinity;
    for (let i = 1; i < this.count; i++) {
      const c = this.rgb[i];
      const dr = ((c >> 16) & 255) - r;
      const dg = ((c >> 8) & 255) - g;
      const db = (c & 255) - b;
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private computeRow(i: number): void {
    const c = this.rgb[i];
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    for (let l = 0; l < NL; l++) {
      // Light falls off a little faster than linear, like Doom's colormaps.
      const k = Math.pow(1 - l / NL, 1.35);
      const f = 1 - k;
      const rr = Math.min(255, Math.round(r * k + FOG[0] * f));
      const gg = Math.min(255, Math.round(g * k + FOG[1] * f));
      const bb = Math.min(255, Math.round(b * k + FOG[2] * f));
      this.cmap[l * PAL_SIZE + i] = 0xff000000 | (bb << 16) | (gg << 8) | rr;
    }
  }
}

/** Packs an RGB colour into an ABGR pixel for an ImageData Uint32 view. */
export function abgr(r: number, g: number, b: number): number {
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
