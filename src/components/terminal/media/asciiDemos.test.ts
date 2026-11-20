import { describe, expect, it } from "vitest";
import { DEMOS, demoForFile, renderDemo, type DemoId } from "./asciiDemos";

const IDS = DEMOS.map((d) => d.id);

function run(id: DemoId, cols: number, rows: number, frames: number, fps = 30, t0 = 0) {
  let state: unknown;
  const out: string[] = [];
  for (let f = 0; f < frames; f += 1) {
    const r = renderDemo(id, t0 + f / fps, cols, rows, state);
    state = r.state;
    out.push(r.text);
  }
  return { frames: out, state };
}

function expectShape(text: string, cols: number, rows: number) {
  const lines = text.split("\n");
  expect(lines.length).toBe(rows);
  for (const line of lines) {
    expect(line.length).toBe(cols);
  }
}

describe("DEMOS / demoForFile", () => {
  it("lists eight unique demos with both titles", () => {
    expect(new Set(IDS).size).toBe(8);
    expect(new Set(IDS)).toEqual(
      new Set(["starfield", "plasma", "fire", "matrix", "tunnel", "donut", "waves", "life"]),
    );
    for (const demo of DEMOS) {
      expect(demo.title.tr.length).toBeGreaterThan(0);
      expect(demo.title.en.length).toBeGreaterThan(0);
    }
  });

  it("maps the site's files deterministically", () => {
    expect(demoForFile("loop.vid")).toBe("plasma");
    expect(demoForFile("loop2.vid")).toBe("fire");
    expect(demoForFile("loop3.vid")).toBe("tunnel");
    expect(demoForFile("loop4.vid")).toBe("matrix");
    expect(demoForFile("loop5.vid")).toBe("donut");
    expect(demoForFile("/home/kinin/media/LOOP2.VID")).toBe("fire");
    expect(demoForFile("my_starfield.vid")).toBe("starfield");
    expect(demoForFile("conway.vid")).toBe("life");
  });

  it("hashes unknown names to a stable valid demo", () => {
    for (const name of ["a.vid", "zz9.vid", "", "untitled", "qwerty.vid"]) {
      const id = demoForFile(name);
      expect(IDS).toContain(id);
      expect(demoForFile(name)).toBe(id);
    }
  });
});

describe("renderDemo", () => {
  it("returns exactly rows lines of cols characters for every demo and size", () => {
    const sizes: [number, number][] = [
      [100, 40],
      [80, 24],
      [33, 17],
      [7, 3],
      [1, 1],
      [2, 50],
    ];
    for (const id of IDS) {
      for (const [cols, rows] of sizes) {
        const { frames } = run(id, cols, rows, 12, 30, 1.5);
        for (const text of frames) {
          expectShape(text, cols, rows);
          expect(/^[\x20-\x7e\n]*$/.test(text)).toBe(true);
        }
      }
    }
  });

  it("re-initialises state when the size or demo changes", () => {
    for (const id of IDS) {
      let { state } = run(id, 60, 20, 5);
      let r = renderDemo(id, 1, 90, 30, state);
      expectShape(r.text, 90, 30);
      state = r.state;
      r = renderDemo(id, 1.05, 40, 12, state);
      expectShape(r.text, 40, 12);
      // state from another demo must be ignored safely
      const other = renderDemo("life", 1, 40, 12).state;
      r = renderDemo(id, 1.1, 40, 12, other);
      expectShape(r.text, 40, 12);
    }
  });

  it("handles degenerate input", () => {
    // zero columns: still `rows` lines, each of zero characters
    expectShape(renderDemo("plasma", 0, 0, 10).text, 0, 10);
    expect(renderDemo("plasma", 0, 10, 0).text).toBe("");
    expectShape(renderDemo("fire", Number.NaN, 5.7, 3.2).text, 5, 3);
    // time going backwards must not break stateful demos
    const fwd = run("matrix", 30, 10, 10, 30, 5);
    expectShape(renderDemo("matrix", 1, 30, 10, fwd.state).text, 30, 10);
  });

  it("is deterministic for the same sequence of times", () => {
    for (const id of IDS) {
      const a = run(id, 48, 16, 20);
      const b = run(id, 48, 16, 20);
      expect(a.frames).toEqual(b.frames);
    }
  });

  it("animates (frames change over time) and draws something", () => {
    for (const id of IDS) {
      const { frames } = run(id, 80, 24, 31);
      expect(frames[30]).not.toEqual(frames[0]);
      const ink = frames[30].replace(/[\s]/g, "").length;
      expect(ink).toBeGreaterThan(80 * 24 * 0.03);
    }
  });

  it("keeps the Game of Life alive by re-seeding when it goes stale", () => {
    // A tiny board dies or freezes quickly; over 60 s it must keep changing.
    const { frames } = run("life", 12, 8, 60 * 20, 20);
    let unchangedRun = 0;
    let longest = 0;
    for (let i = 1; i < frames.length; i += 1) {
      unchangedRun = frames[i] === frames[i - 1] ? unchangedRun + 1 : 0;
      longest = Math.max(longest, unchangedRun);
    }
    // at most a few seconds (20 fps) of identical frames before a re-seed
    expect(longest).toBeLessThan(20 * 6);
  });

  it("renders 100×40 in under 3 ms per frame on average", () => {
    const results: Record<string, number> = {};
    for (const id of IDS) {
      let state: unknown;
      for (let f = 0; f < 10; f += 1) {
        state = renderDemo(id, f / 30, 100, 40, state).state;
      }
      const start = performance.now();
      for (let f = 0; f < 60; f += 1) {
        state = renderDemo(id, (10 + f) / 30, 100, 40, state).state;
      }
      results[id] = (performance.now() - start) / 60;
    }
    for (const [id, ms] of Object.entries(results)) {
      expect(ms, `${id} took ${ms.toFixed(3)} ms/frame`).toBeLessThan(3);
    }
  });
});
