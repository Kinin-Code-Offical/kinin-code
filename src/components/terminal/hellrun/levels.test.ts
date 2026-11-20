import { describe, expect, it } from "vitest";
import { castRay, distanceField, K_DOOR, K_EMPTY, K_EXIT, makeHit } from "./map";
import { FLAT_TEX, LEVELS, parseLevel, WALL_TEX } from "./levels";

describe("level data", () => {
  LEVELS.forEach((def, index) => {
    describe(`level ${index + 1} (${def.name.en})`, () => {
      const L = parseLevel(index);
      const m = L.map;

      it("has a rectangular grid closed by walls", () => {
        for (const row of def.rows) expect(row.length).toBe(def.rows[0].length);
        for (let x = 0; x < m.w; x++) {
          expect(m.kind[x]).not.toBe(K_EMPTY);
          expect(m.kind[(m.h - 1) * m.w + x]).not.toBe(K_EMPTY);
        }
        for (let y = 0; y < m.h; y++) {
          expect(m.kind[y * m.w]).not.toBe(K_EMPTY);
          expect(m.kind[y * m.w + m.w - 1]).not.toBe(K_EMPTY);
        }
      });

      it("uses only known textures", () => {
        for (let i = 0; i < m.w * m.h; i++) {
          if (m.kind[i] !== K_EMPTY && m.kind[i] !== K_DOOR) expect(m.tex[i]).toBeGreaterThan(0);
          expect(m.floor[i]).toBeLessThan(FLAT_TEX.length);
          expect(m.ceil[i]).toBeLessThan(FLAT_TEX.length);
        }
        for (const d of m.doors) expect(WALL_TEX[d.tex]).toBeTruthy();
      });

      it("has exactly one start, one key, a locked door and an exit", () => {
        const all = def.rows.join("");
        expect(all.split("P").length - 1).toBe(1);
        expect(L.items.filter((i) => i.type === "key").length).toBe(1);
        expect(m.doors.some((d) => d.locked)).toBe(true);
        expect(Array.from(m.kind).some((k) => k === K_EXIT)).toBe(true);
      });

      it("starts the player facing open space", () => {
        const hit = makeHit();
        castRay(m, L.startX, L.startY, Math.cos(L.startAngle), Math.sin(L.startAngle), 100, hit);
        expect(hit.dist).toBeGreaterThan(6);
      });

      it("requires the key: key reachable without the locked door, exit only through it", () => {
        const dist = new Int16Array(m.w * m.h);
        const sx = Math.floor(L.startX);
        const sy = Math.floor(L.startY);
        const passable = (allowLocked: boolean) => (i: number) => {
          const k = m.kind[i];
          if (k === K_EMPTY) return true;
          if (k === K_DOOR) return allowLocked || !m.doors[m.doorAt[i]].locked;
          return false;
        };
        const key = L.items.find((i) => i.type === "key")!;
        // exit switch is used from an adjacent floor cell
        const exitIdx = Array.from(m.kind).findIndex((k) => k === K_EXIT);
        const ex = exitIdx % m.w;
        const ey = Math.floor(exitIdx / m.w);
        const exitNeighbours = [
          [ex - 1, ey],
          [ex + 1, ey],
          [ex, ey - 1],
          [ex, ey + 1],
        ].filter(([x, y]) => x >= 0 && y >= 0 && x < m.w && y < m.h);
        const reachesExit = () => exitNeighbours.some(([x, y]) => dist[y * m.w + x] >= 0);

        distanceField(m, sx, sy, dist, passable(false));
        expect(dist[Math.floor(key.y) * m.w + Math.floor(key.x)]).toBeGreaterThan(0);
        expect(reachesExit()).toBe(false);

        distanceField(m, sx, sy, dist, passable(true));
        expect(reachesExit()).toBe(true);
      });

      it("places every monster and item on reachable floor", () => {
        const dist = new Int16Array(m.w * m.h);
        distanceField(m, Math.floor(L.startX), Math.floor(L.startY), dist, (i) => m.kind[i] !== 1 && m.kind[i] !== K_EXIT);
        for (const s of [...L.enemies, ...L.items]) {
          const i = Math.floor(s.y) * m.w + Math.floor(s.x);
          expect(m.kind[i]).toBe(K_EMPTY);
          expect(dist[i]).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  it("gets harder level by level", () => {
    const strength = LEVELS.map((_, i) => {
      const L = parseLevel(i);
      const hp = { trooper: 20, fiend: 60, biter: 150, orb: 400 } as const;
      return L.enemies.reduce((s, e) => s + hp[e.type], 0);
    });
    expect(strength[1]).toBeGreaterThan(strength[0]);
    expect(strength[2]).toBeGreaterThan(strength[1]);
  });
});
