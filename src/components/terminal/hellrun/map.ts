// Grid map, collision and ray casting for HELLRUN.
// Pure logic: no DOM, safe to import anywhere (SSR, tests).

export const K_EMPTY = 0;
export const K_WALL = 1;
export const K_DOOR = 2;
export const K_EXIT = 3;

/** A door counts as passable once it is at least this far open. */
export const DOOR_PASSABLE = 0.85;

export interface Door {
  x: number;
  y: number;
  /** true: the panel lies on the plane x = cx + 0.5 (you walk through it east-west). */
  vertical: boolean;
  locked: boolean;
  /** 0 = closed, 1 = fully open. */
  open: number;
  /** +1 opening, -1 closing, 0 idle. */
  moving: number;
  tex: number;
  /** wall texture drawn above the door opening when walls are taller than doors */
  lintel: number;
}

export interface GridMap {
  w: number;
  h: number;
  /** K_EMPTY / K_WALL / K_DOOR / K_EXIT per cell. */
  kind: Uint8Array;
  /** Wall texture id per cell. */
  tex: Uint8Array;
  /** Floor / ceiling flat texture id per cell. */
  floor: Uint8Array;
  ceil: Uint8Array;
  /** 1 = damaging floor (lava). */
  hazard: Uint8Array;
  /** Index into doors[] or -1. */
  doorAt: Int16Array;
  doors: Door[];
}

export function createMap(w: number, h: number): GridMap {
  const n = w * h;
  const doorAt = new Int16Array(n);
  doorAt.fill(-1);
  return {
    w,
    h,
    kind: new Uint8Array(n),
    tex: new Uint8Array(n),
    floor: new Uint8Array(n),
    ceil: new Uint8Array(n),
    hazard: new Uint8Array(n),
    doorAt,
    doors: [],
  };
}

export function inBounds(m: GridMap, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < m.w && cy < m.h;
}

export function cellKind(m: GridMap, cx: number, cy: number): number {
  if (!inBounds(m, cx, cy)) return K_WALL;
  return m.kind[cy * m.w + cx];
}

export function doorAtCell(m: GridMap, cx: number, cy: number): Door | null {
  if (!inBounds(m, cx, cy)) return null;
  const di = m.doorAt[cy * m.w + cx];
  return di >= 0 ? m.doors[di] : null;
}

/** Does this cell block movement? Out-of-bounds cells always block. */
export function isBlocking(m: GridMap, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return true;
  const i = cy * m.w + cx;
  const k = m.kind[i];
  if (k === K_EMPTY) return false;
  if (k === K_DOOR) return m.doors[m.doorAt[i]].open < DOOR_PASSABLE;
  return true;
}

/** Axis-aligned box of half-size r centred at (x, y) overlaps a blocking cell? */
export function collides(m: GridMap, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r);
  const y1 = Math.floor(y + r);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (isBlocking(m, cx, cy)) return true;
    }
  }
  return false;
}

const EPS = 1e-4;

/**
 * Move a body by (dx, dy) with wall sliding: the two axes are resolved
 * separately, so moving diagonally into a wall keeps the parallel component.
 * Returns a bit mask: 1 = blocked on X, 2 = blocked on Y.
 */
export function slideMove(
  m: GridMap,
  p: { x: number; y: number },
  dx: number,
  dy: number,
  r: number,
): number {
  let blocked = 0;
  // Sub-step large moves so nothing tunnels through a one-cell wall.
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  const steps = dist > r * 0.9 ? Math.ceil(dist / (r * 0.9)) : 1;
  const sx = dx / steps;
  const sy = dy / steps;
  for (let s = 0; s < steps; s++) {
    if (sx !== 0) {
      const nx = p.x + sx;
      if (!collides(m, nx, p.y, r)) {
        p.x = nx;
      } else {
        blocked |= 1;
        if (sx > 0) {
          const edge = Math.floor(nx + r);
          p.x = Math.max(p.x, edge - r - EPS);
        } else {
          const edge = Math.floor(nx - r) + 1;
          p.x = Math.min(p.x, edge + r + EPS);
        }
      }
    }
    if (sy !== 0) {
      const ny = p.y + sy;
      if (!collides(m, p.x, ny, r)) {
        p.y = ny;
      } else {
        blocked |= 2;
        if (sy > 0) {
          const edge = Math.floor(ny + r);
          p.y = Math.max(p.y, edge - r - EPS);
        } else {
          const edge = Math.floor(ny - r) + 1;
          p.y = Math.min(p.y, edge + r + EPS);
        }
      }
    }
  }
  return blocked;
}

export interface RayHit {
  /** Distance in multiples of the ray direction vector (perpendicular distance for camera rays). */
  dist: number;
  mapX: number;
  mapY: number;
  /** 0 = hit a face crossing an x grid line (east/west face), 1 = north/south face. */
  side: number;
  /** Texture coordinate along the face, 0..1. */
  u: number;
  tex: number;
  kind: number;
  door: Door | null;
  /** The ray hit a door frame (wall face next to a door cell). */
  jamb: boolean;
  /** First door the ray passed through its open part (lintel above it), or null. */
  passDoor: Door | null;
  passDist: number;
}

export function makeHit(): RayHit {
  return {
    dist: 0,
    mapX: 0,
    mapY: 0,
    side: 0,
    u: 0,
    tex: 0,
    kind: K_EMPTY,
    door: null,
    jamb: false,
    passDoor: null,
    passDist: 0,
  };
}

/**
 * DDA ray cast from (ox, oy) along (rdx, rdy). Doors are thin sliding panels in
 * the middle of their cell. Returns true and fills `hit` when a wall/door/exit
 * is hit closer than `maxDist`; otherwise returns false with hit.dist = maxDist.
 * If `seen` is given, every visited cell is marked there (automap).
 */
export function castRay(
  m: GridMap,
  ox: number,
  oy: number,
  rdx: number,
  rdy: number,
  maxDist: number,
  hit: RayHit,
  seen?: Uint8Array | null,
): boolean {
  let mapX = Math.floor(ox);
  let mapY = Math.floor(oy);
  const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
  const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
  let stepX: number;
  let stepY: number;
  let sideX: number;
  let sideY: number;
  if (rdx < 0) {
    stepX = -1;
    sideX = (ox - mapX) * ddx;
  } else {
    stepX = 1;
    sideX = (mapX + 1 - ox) * ddx;
  }
  if (rdy < 0) {
    stepY = -1;
    sideY = (oy - mapY) * ddy;
  } else {
    stepY = 1;
    sideY = (mapY + 1 - oy) * ddy;
  }
  const w = m.w;
  hit.passDoor = null;
  if (seen && inBounds(m, mapX, mapY)) seen[mapY * w + mapX] = 1;
  let prevDoor = false;
  const maxSteps = m.w + m.h + 8;
  for (let i = 0; i < maxSteps * 2; i++) {
    let side: number;
    if (sideX < sideY) {
      mapX += stepX;
      sideX += ddx;
      side = 0;
    } else {
      mapY += stepY;
      sideY += ddy;
      side = 1;
    }
    const entry = side === 0 ? sideX - ddx : sideY - ddy;
    if (entry > maxDist) break;
    if (mapX < 0 || mapY < 0 || mapX >= w || mapY >= m.h) {
      hit.dist = entry;
      hit.mapX = mapX;
      hit.mapY = mapY;
      hit.side = side;
      hit.u = 0;
      hit.tex = 0;
      hit.kind = K_WALL;
      hit.door = null;
      hit.jamb = false;
      return true;
    }
    const idx = mapY * w + mapX;
    if (seen) seen[idx] = 1;
    const k = m.kind[idx];
    if (k === K_EMPTY) {
      prevDoor = false;
      continue;
    }
    if (k === K_DOOR) {
      const door = m.doors[m.doorAt[idx]];
      if (door.vertical ? side === 0 : side === 1) {
        const d = door.vertical ? sideX - ddx * 0.5 : sideY - ddy * 0.5;
        const other = door.vertical ? sideY : sideX;
        if (d < other && d <= maxDist) {
          const u = door.vertical ? oy + d * rdy - mapY : ox + d * rdx - mapX;
          if (u < door.open) {
            if (!hit.passDoor) {
              hit.passDoor = door;
              hit.passDist = d;
            }
          } else {
            hit.dist = d;
            hit.mapX = mapX;
            hit.mapY = mapY;
            hit.side = side;
            hit.u = u - door.open;
            hit.tex = door.tex;
            hit.kind = K_DOOR;
            hit.door = door;
            hit.jamb = false;
            return true;
          }
        }
      }
      prevDoor = true;
      continue;
    }
    // Solid wall or exit switch.
    let u = side === 0 ? oy + entry * rdy : ox + entry * rdx;
    u -= Math.floor(u);
    // u grows towards the viewer's right (map y points down)
    if (side === 0 && rdx < 0) u = 1 - u;
    if (side === 1 && rdy > 0) u = 1 - u;
    hit.dist = entry;
    hit.mapX = mapX;
    hit.mapY = mapY;
    hit.side = side;
    hit.u = u;
    hit.tex = m.tex[idx];
    hit.kind = k;
    hit.door = null;
    hit.jamb = prevDoor;
    return true;
  }
  hit.dist = maxDist;
  hit.kind = K_EMPTY;
  hit.door = null;
  return false;
}

const losHit = makeHit();

/** True when nothing solid (walls, closed parts of doors) lies between a and b. */
export function lineOfSight(m: GridMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return true;
  if (!castRay(m, ax, ay, dx, dy, 1, losHit)) return true;
  return losHit.dist >= 1;
}

/**
 * Breadth-first distance field over 4-connected cells starting at (sx, sy).
 * `dist` receives -1 for unreachable cells. Returns the number of reached cells.
 */
export function distanceField(
  m: GridMap,
  sx: number,
  sy: number,
  dist: Int16Array,
  passable: (index: number) => boolean,
  maxDist = 32000,
  queue?: Int32Array,
): number {
  const n = m.w * m.h;
  dist.fill(-1);
  if (!inBounds(m, sx, sy)) return 0;
  const q = queue && queue.length >= n ? queue : new Int32Array(n);
  let head = 0;
  let tail = 0;
  const start = sy * m.w + sx;
  dist[start] = 0;
  q[tail++] = start;
  const w = m.w;
  while (head < tail) {
    const i = q[head++];
    const d = dist[i];
    if (d >= maxDist) continue;
    const x = i % w;
    const y = (i - x) / w;
    // west, east, north, south
    if (x > 0) {
      const j = i - 1;
      if (dist[j] < 0 && passable(j)) {
        dist[j] = d + 1;
        q[tail++] = j;
      }
    }
    if (x < w - 1) {
      const j = i + 1;
      if (dist[j] < 0 && passable(j)) {
        dist[j] = d + 1;
        q[tail++] = j;
      }
    }
    if (y > 0) {
      const j = i - w;
      if (dist[j] < 0 && passable(j)) {
        dist[j] = d + 1;
        q[tail++] = j;
      }
    }
    if (y < m.h - 1) {
      const j = i + w;
      if (dist[j] < 0 && passable(j)) {
        dist[j] = d + 1;
        q[tail++] = j;
      }
    }
  }
  return tail;
}

/** Small deterministic PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return a + Math.floor((b - a + 1) * this.next());
  }
}

export function normAngle(a: number): number {
  const TAU = Math.PI * 2;
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}
