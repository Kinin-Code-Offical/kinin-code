import { describe, expect, it, vi } from "vitest";
import { HellrunGame } from "./index";

const key = (code: string, k = "") => ({ code, key: k || code });

function startedGame(onExit?: () => void): HellrunGame {
  const g = new HellrunGame({ lang: "en", onExit });
  g.keyDown(key("Enter", "Enter"));
  g.keyUp(key("Enter", "Enter"));
  return g;
}

/** Advances the game by `seconds` in 16 ms frames. */
function advance(g: HellrunGame, seconds: number): void {
  const n = Math.round((seconds * 1000) / 16);
  for (let i = 0; i < n; i++) g.update(16);
}

describe("HellrunGame screens", () => {
  it("starts on the title screen and begins level 1 on any key", () => {
    const g = new HellrunGame({ lang: "tr" });
    expect(g.currentScreen).toBe("title");
    expect(g.world).toBeNull();
    expect(g.keyDown(key("KeyX", "x"))).toBe(true);
    expect(g.currentScreen).toBe("play");
    expect(g.world?.levelIndex).toBe(0);
  });

  it("does not swallow browser keys like F5", () => {
    const g = startedGame();
    expect(g.keyDown(key("F5"))).toBe(false);
    expect(g.keyDown(key("KeyW", "w"))).toBe(true);
    expect(g.keyDown(key("Space", " "))).toBe(true);
    expect(g.keyDown(key("Tab", "Tab"))).toBe(true);
  });

  it("moves smoothly while W is held, stops after release or blur", () => {
    const g = startedGame();
    const w = g.world!;
    for (const e of w.enemies) e.state = "dead";
    const x0 = w.player.x;
    g.keyDown(key("KeyW", "w"));
    advance(g, 1);
    expect(w.player.x - x0).toBeGreaterThan(2);
    g.blur();
    advance(g, 0.4);
    const x1 = w.player.x;
    advance(g, 0.5);
    expect(Math.abs(w.player.x - x1)).toBeLessThan(0.01);
    // key repeat events do not change anything
    g.keyDown(key("ArrowRight"));
    g.keyDown(key("ArrowRight"));
    advance(g, 0.3);
    g.keyUp(key("ArrowRight"));
    const a = w.player.angle;
    advance(g, 0.3);
    expect(w.player.angle).toBeCloseTo(a, 6);
  });

  it("pauses with Esc and quits on the second Esc", () => {
    const onExit = vi.fn();
    const g = startedGame(onExit);
    g.keyDown(key("Escape", "Escape"));
    g.keyUp(key("Escape", "Escape"));
    expect(g.currentScreen).toBe("paused");
    const t = g.world!.time;
    advance(g, 0.5);
    expect(g.world!.time).toBe(t);
    g.keyDown(key("Escape", "Escape"));
    expect(g.wantsExit).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("resumes with P and quits with Q from the pause menu", () => {
    const g = startedGame();
    g.keyDown(key("KeyP", "p"));
    g.keyUp(key("KeyP", "p"));
    expect(g.currentScreen).toBe("paused");
    g.keyDown(key("KeyP", "p"));
    g.keyUp(key("KeyP", "p"));
    expect(g.currentScreen).toBe("play");
    g.keyDown(key("Escape", "Escape"));
    g.keyUp(key("Escape", "Escape"));
    g.keyDown(key("KeyQ", "q"));
    expect(g.wantsExit).toBe(true);
  });

  it("goes through all three levels to the victory screen", () => {
    const g = startedGame();
    for (let level = 0; level < 3; level++) {
      const w = g.world!;
      expect(w.levelIndex).toBe(level);
      w.completed = true;
      g.update(20); // one full fixed step
      expect(g.currentScreen).toBe("complete");
      g.keyDown(key("Enter", "Enter")); // too early: ignored
      g.keyUp(key("Enter", "Enter"));
      expect(g.currentScreen).toBe("complete");
      advance(g, 0.8);
      g.keyDown(key("Enter", "Enter"));
      g.keyUp(key("Enter", "Enter"));
    }
    expect(g.currentScreen).toBe("victory");
  });

  it("carries the inventory to the next level", () => {
    const g = startedGame();
    const w = g.world!;
    w.player.ammo.shells = 33;
    w.player.weapons[3] = true;
    w.completed = true;
    g.update(20);
    advance(g, 0.8);
    g.keyDown(key("Space", " "));
    expect(g.world!.levelIndex).toBe(1);
    expect(g.world!.player.ammo.shells).toBe(33);
    expect(g.world!.player.weapons[3]).toBe(true);
  });

  it("shows the death screen and restarts the level with R", () => {
    const g = startedGame();
    const w = g.world!;
    w.damagePlayer(1000, "trooper");
    advance(g, 1.3);
    expect(g.currentScreen).toBe("dead");
    g.keyDown(key("KeyR", "r"));
    expect(g.currentScreen).toBe("play");
    expect(g.world).not.toBe(w);
    expect(g.world!.levelIndex).toBe(0);
    expect(g.world!.player.health).toBe(100);
  });

  it("opens doors with E through the public key API", () => {
    const g = startedGame();
    const w = g.world!;
    for (const e of w.enemies) e.state = "dead";
    w.placePlayer(14.3, 17.5, 0);
    advance(g, 0.3);
    g.keyDown(key("KeyE", "e"));
    g.keyUp(key("KeyE", "e"));
    advance(g, 1);
    expect(w.map.doors.find((d) => d.x === 15 && d.y === 17)!.open).toBe(1);
  });

  it("switches weapons with number keys", () => {
    const g = startedGame();
    const w = g.world!;
    w.player.weapons[3] = true;
    w.player.ammo.shells = 10;
    advance(g, 0.3);
    g.keyDown(key("Digit3", "3"));
    g.keyUp(key("Digit3", "3"));
    advance(g, 0.5);
    expect(w.player.weapon).toBe(3);
    g.keyDown(key("Digit1", "1"));
    g.keyUp(key("Digit1", "1"));
    advance(g, 0.5);
    expect(w.player.weapon).toBe(0);
  });

  it("is safe to update with odd frame times and to dispose", () => {
    const g = startedGame();
    g.update(0);
    g.update(250);
    g.update(10_000);
    g.update(Number.NaN);
    g.setLang("tr");
    g.dispose();
    expect(g.keyDown(key("KeyW", "w"))).toBe(false);
  });
});
