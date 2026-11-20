import { describe, expect, it } from "vitest";
import {
  castRay,
  collides,
  createMap,
  distanceField,
  K_DOOR,
  K_EMPTY,
  K_WALL,
  lineOfSight,
  makeHit,
  slideMove,
  type GridMap,
} from "./map";

/** Builds a map from ASCII: '#' wall, '.' floor, 'D' door (closed). */
function mapFrom(rows: string[]): GridMap {
  const m = createMap(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const i = y * m.w + x;
      const ch = row[x];
      if (ch === "#") {
        m.kind[i] = K_WALL;
        m.tex[i] = 1;
      } else if (ch === "D") {
        m.kind[i] = K_DOOR;
        m.doorAt[i] = m.doors.length;
        const vertical = rows[y - 1][x] === "#" && rows[y + 1][x] === "#";
        m.doors.push({ x, y, vertical, locked: false, open: 0, moving: 0, tex: 7, lintel: 1 });
      } else {
        m.kind[i] = K_EMPTY;
      }
    }
  });
  return m;
}

const ROOM = ["######", "#....#", "#....#", "#....#", "######"];
const CORRIDOR = ["#######", "#######", "#..D..#", "#######", "#######"];

describe("collision", () => {
  it("detects overlap with walls", () => {
    const m = mapFrom(ROOM);
    expect(collides(m, 2.5, 2.5, 0.25)).toBe(false);
    expect(collides(m, 1.1, 2.5, 0.25)).toBe(true);
  });

  it("slides along a wall when moving diagonally into it", () => {
    const m = mapFrom(ROOM);
    const p = { x: 1.5, y: 2.0 };
    const blocked = slideMove(m, p, -1, 0.5, 0.25);
    expect(blocked & 1).toBe(1);
    expect(p.x).toBeCloseTo(1.25, 3);
    expect(p.y).toBeCloseTo(2.5, 5);
  });

  it("does not tunnel through a wall on a large step", () => {
    const m = mapFrom(ROOM);
    const p = { x: 2.5, y: 2.5 };
    slideMove(m, p, 10, 0, 0.2);
    expect(p.x).toBeLessThan(4.8);
    expect(p.x).toBeCloseTo(4.8 - 1e-4, 2);
  });

  it("treats closed doors as solid and open doors as passable", () => {
    const m = mapFrom(CORRIDOR);
    const p = { x: 1.5, y: 2.5 };
    slideMove(m, p, 3, 0, 0.2);
    expect(p.x).toBeLessThan(3);
    m.doors[0].open = 1;
    slideMove(m, p, 3, 0, 0.2);
    expect(p.x).toBeGreaterThan(4);
  });
});

describe("raycast", () => {
  it("measures the distance to a wall on a known map", () => {
    const m = mapFrom(ROOM);
    const hit = makeHit();
    expect(castRay(m, 1.5, 2.5, 1, 0, 50, hit)).toBe(true);
    expect(hit.dist).toBeCloseTo(3.5, 6);
    expect(hit.side).toBe(0);
    expect(hit.mapX).toBe(5);
    expect(castRay(m, 2.5, 2.5, 0, -1, 50, hit)).toBe(true);
    expect(hit.dist).toBeCloseTo(1.5, 6);
    expect(hit.side).toBe(1);
  });

  it("gives perpendicular distance for camera rays", () => {
    const m = mapFrom(ROOM);
    const hit = makeHit();
    // direction (1, 0.2): perpendicular distance to x = 5 is still 3.5
    castRay(m, 1.5, 2.5, 1, 0.2, 50, hit);
    expect(hit.dist).toBeCloseTo(3.5, 6);
  });

  it("stops at maxDist", () => {
    const m = mapFrom(ROOM);
    const hit = makeHit();
    expect(castRay(m, 1.5, 2.5, 1, 0, 2, hit)).toBe(false);
  });

  it("hits the middle of a closed door and passes an open one", () => {
    const m = mapFrom(CORRIDOR);
    const hit = makeHit();
    expect(m.doors[0].vertical).toBe(true);
    castRay(m, 1.5, 2.5, 1, 0, 50, hit);
    expect(hit.kind).toBe(K_DOOR);
    expect(hit.dist).toBeCloseTo(2.0, 6);
    m.doors[0].open = 1;
    castRay(m, 1.5, 2.5, 1, 0, 50, hit);
    expect(hit.kind).toBe(K_WALL);
    expect(hit.dist).toBeCloseTo(4.5, 6);
  });

  it("lets rays through the open part of a half-open door", () => {
    const m = mapFrom(CORRIDOR);
    const hit = makeHit();
    m.doors[0].open = 0.5;
    // near the top of the corridor cell (u < 0.5) the door has slid away
    castRay(m, 1.5, 2.2, 1, 0, 50, hit);
    expect(hit.kind).toBe(K_WALL);
    castRay(m, 1.5, 2.8, 1, 0, 50, hit);
    expect(hit.kind).toBe(K_DOOR);
  });
});

describe("line of sight", () => {
  it("is blocked by walls and closed doors", () => {
    const room = mapFrom(["#######", "#.....#", "#..#..#", "#.....#", "#######"]);
    expect(lineOfSight(room, 1.5, 1.5, 5.5, 1.5)).toBe(true);
    expect(lineOfSight(room, 1.5, 2.5, 5.5, 2.5)).toBe(false);
    const c = mapFrom(CORRIDOR);
    expect(lineOfSight(c, 1.5, 2.5, 5.5, 2.5)).toBe(false);
    c.doors[0].open = 1;
    expect(lineOfSight(c, 1.5, 2.5, 5.5, 2.5)).toBe(true);
  });
});

describe("distance field", () => {
  it("computes grid distances around obstacles", () => {
    const m = mapFrom(["#######", "#.....#", "#.###.#", "#.....#", "#######"]);
    const dist = new Int16Array(m.w * m.h);
    distanceField(m, 1, 1, dist, (i) => m.kind[i] === K_EMPTY);
    expect(dist[1 * m.w + 5]).toBe(4);
    expect(dist[3 * m.w + 5]).toBe(6);
    expect(dist[2 * m.w + 3]).toBe(-1);
  });
});
