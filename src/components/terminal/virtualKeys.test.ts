import { describe, expect, it } from "vitest";
import { VIRTUAL_LAYOUTS, getVirtualLayout } from "./virtualKeys";

describe("virtual key layouts", () => {
  for (const [app, layout] of Object.entries(VIRTUAL_LAYOUTS)) {
    it(`${app}: every grid area has exactly one key and every key has a cell`, () => {
      const columns = layout.columns.startsWith("repeat(")
        ? Number(/repeat\((\d+)/.exec(layout.columns)?.[1])
        : layout.columns.trim().split(/\s+/).length;
      const cells = new Set<string>();
      for (const row of layout.areas) {
        const names = row.trim().split(/\s+/);
        expect(names).toHaveLength(columns);
        names.filter((name) => name !== ".").forEach((name) => cells.add(name));
      }
      const areas = layout.keys.map((key) => key.area);
      expect(new Set(areas).size).toBe(areas.length);
      expect(new Set(areas)).toEqual(cells);
      // Top-bar keys (and the exit key) are separate ids, not grid cells.
      const bar = [...(layout.bar ?? []), layout.exit].map((key) => key.area);
      expect(new Set(bar).size).toBe(bar.length);
      bar.forEach((id) => expect(cells.has(id), id).toBe(false));
    });
  }

  it("HELLRUN movement, run and fire are held keys with physical codes", () => {
    const keys = VIRTUAL_LAYOUTS.hellrun.keys;
    for (const area of ["fw", "bk", "tl", "tr", "sl", "sr", "fire", "run"]) {
      const key = keys.find((k) => k.area === area);
      expect(key?.hold, area).toBe(true);
      expect(key?.code, area).toBeTruthy();
    }
  });

  it("the shell has no app layout", () => {
    expect(getVirtualLayout(null)).toBeNull();
    expect(getVirtualLayout("chess")?.title.en).toBe("Chess");
  });
});
