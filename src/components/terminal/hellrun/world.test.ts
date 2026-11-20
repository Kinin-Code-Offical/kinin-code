import { describe, expect, it } from "vitest";
import { WEAPON_INDEX } from "./defs";
import { emptyInput, startInventory, World, type InputState } from "./world";

const STEP = 1 / 60;

function run(world: World, seconds: number, input: Partial<InputState> = {}): void {
  const inp = { ...emptyInput(), ...input };
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    world.tick(inp, STEP);
    inp.use = false;
    inp.slot = 0;
  }
}

function press(world: World, input: Partial<InputState>): void {
  world.tick({ ...emptyInput(), ...input }, STEP);
}

/** Level 1 with all monsters removed (for deterministic movement tests). */
function quietLevel(index = 0): World {
  const w = new World(index);
  for (const e of w.enemies) e.state = "dead";
  return w;
}

describe("player movement", () => {
  it("moves continuously while a key is held and stops after release", () => {
    const w = quietLevel();
    const x0 = w.player.x;
    run(w, 1, { forward: true });
    const moved = w.player.x - x0;
    expect(moved).toBeGreaterThan(2.0);
    expect(moved).toBeLessThan(3.0);
    run(w, 0.5);
    const x1 = w.player.x;
    run(w, 0.5);
    expect(w.player.x - x1).toBeLessThan(0.01);
  });

  it("runs faster with shift and turns with the arrow keys", () => {
    const a = quietLevel();
    const b = quietLevel();
    run(a, 1, { forward: true });
    run(b, 1, { forward: true, run: true });
    expect(b.player.x).toBeGreaterThan(a.player.x + 1);
    const ang = a.player.angle;
    run(a, 0.5, { turnLeft: true });
    expect(a.player.angle).toBeLessThan(ang - 0.5);
  });

  it("slides along walls instead of stopping", () => {
    const w = quietLevel();
    // hall row 14 is the top row of the start hall; push north-east into the wall
    w.placePlayer(3.5, 14.3, -Math.PI / 4);
    const x0 = w.player.x;
    run(w, 0.6, { forward: true });
    expect(w.player.y).toBeGreaterThanOrEqual(14 + w.player.radius - 1e-3);
    expect(w.player.x).toBeGreaterThan(x0 + 0.5);
  });
});

describe("pickups", () => {
  it("picks up health only when hurt", () => {
    const w = quietLevel();
    const stim = w.items.find((i) => i.type === "stim")!;
    w.player.health = 100;
    w.placePlayer(stim.x, stim.y, 0);
    press(w, {});
    expect(stim.taken).toBe(false);
    w.player.health = 50;
    press(w, {});
    expect(stim.taken).toBe(true);
    expect(w.player.health).toBe(60);
    expect(w.itemsTaken).toBe(1);
    expect(w.events.some((e) => e.type === "msg" && e.key === "stim")).toBe(true);
  });

  it("gives a new weapon and switches to it", () => {
    const w = quietLevel();
    const gun = w.items.find((i) => i.type === "w_shotgun")!;
    w.placePlayer(gun.x, gun.y, 0);
    press(w, {});
    expect(w.player.weapons[WEAPON_INDEX.shotgun]).toBe(true);
    expect(w.player.ammo.shells).toBe(8);
    run(w, 0.5);
    expect(w.player.weapon).toBe(WEAPON_INDEX.shotgun);
    expect(w.player.weaponState).toBe("ready");
  });
});

describe("doors, key and exit", () => {
  it("opens a normal door with use", () => {
    const w = quietLevel();
    const door = w.map.doors.find((d) => d.x === 15 && d.y === 17)!;
    w.placePlayer(14.5, 17.5, 0);
    expect(w.probeUse()?.kind).toBe("door");
    press(w, { use: true });
    expect(door.moving).toBe(1);
    run(w, 1);
    expect(door.open).toBe(1);
    run(w, 1, { forward: true });
    expect(w.player.x).toBeGreaterThan(16);
  });

  it("keeps the locked door shut until the key card is picked up", () => {
    const w = quietLevel();
    const locked = w.map.doors.find((d) => d.locked)!;
    w.placePlayer(locked.x - 0.5, locked.y + 0.5, 0);
    expect(w.probeUse()?.kind).toBe("locked");
    press(w, { use: true });
    expect(locked.moving).toBe(0);
    expect(w.events.some((e) => e.type === "msg" && e.key === "needKey")).toBe(true);

    const key = w.items.find((i) => i.type === "key")!;
    w.placePlayer(key.x, key.y, 0);
    press(w, {});
    expect(w.player.hasKey).toBe(true);

    w.placePlayer(locked.x - 0.5, locked.y + 0.5, 0);
    expect(w.probeUse()?.kind).toBe("lockedOpen");
    press(w, { use: true });
    run(w, 1);
    expect(locked.open).toBe(1);
    expect(locked.locked).toBe(false);
  });

  it("completes the level when the exit switch is used", () => {
    const w = quietLevel();
    w.placePlayer(38.5, 17.5, 0);
    expect(w.probeUse()?.kind).toBe("exit");
    press(w, { use: true });
    expect(w.completed).toBe(false);
    run(w, 1.2);
    expect(w.completed).toBe(true);
  });
});

describe("monsters", () => {
  it("notice a visible player and stay idle behind walls", () => {
    const w = new World(0);
    const visible = w.enemies.find((e) => e.x === 13.5 && e.y === 18.5)!;
    const hidden = w.enemies.find((e) => e.x === 11.5 && e.y === 5.5)!;
    run(w, 0.5);
    expect(visible.state).not.toBe("idle");
    expect(hidden.state).toBe("idle");
  });

  it("wake up when they hear a gunshot through open space", () => {
    const w = new World(0);
    const courtyard = w.enemies.filter((e) => e.x > 16 && e.x < 30 && e.y > 12);
    // open the hall door so the sound can travel
    w.map.doors.find((d) => d.x === 15 && d.y === 17)!.open = 1;
    w.placePlayer(8.5, 14.5, -Math.PI / 2); // facing the wall so nobody sees us
    for (const e of w.enemies) if (e.x < 15 && e.y > 13) e.state = "dead";
    run(w, 0.3); // weapon finishes raising
    expect(courtyard.every((e) => e.state === "idle")).toBe(true);
    press(w, { fire: true });
    run(w, 0.1);
    expect(courtyard.some((e) => e.state !== "idle")).toBe(true);
  });

  it("can be shot dead with the pistol and drop a clip", () => {
    const w = new World(0, startInventory());
    for (const e of w.enemies) if (!(e.x === 13.5 && e.y === 18.5)) e.state = "dead";
    const target = w.enemies.find((e) => e.state !== "dead")!;
    w.placePlayer(10.5, 18.5, 0);
    w.player.health = 1000; // keep the test deterministic
    // keep the crosshair on the (strafing) target like a player would
    for (let i = 0; i < 240 && target.state !== "dying" && target.state !== "dead"; i++) {
      w.player.angle = Math.atan2(target.y - w.player.y, target.x - w.player.x);
      w.tick({ ...emptyInput(), fire: true }, STEP);
    }
    expect(target.state === "dying" || target.state === "dead").toBe(true);
    expect(w.kills).toBe(1);
    expect(w.items.some((i) => i.dropped && i.type === "clip")).toBe(true);
  });

  it("hurt the player with projectiles and melee", () => {
    const w = new World(1);
    const biter = w.enemies.find((e) => e.type === "biter")!;
    for (const e of w.enemies) if (e !== biter) e.state = "dead";
    w.placePlayer(biter.x - 0.5, biter.y, 0);
    w.player.health = 100;
    run(w, 3);
    expect(w.player.health).toBeLessThan(100);
  });

  it("are killed by exploding barrels", () => {
    const w = new World(1);
    const barrel = w.decos.find((d) => d.type === "barrel")!;
    const victim = w.enemies[0];
    victim.x = barrel.x + 0.4;
    victim.y = barrel.y;
    victim.hp = 30;
    w.damageBarrel(barrel, 100);
    run(w, 0.5);
    expect(barrel.dead).toBe(true);
    expect(victim.state === "dying" || victim.state === "dead").toBe(true);
  });
});

describe("death", () => {
  it("marks the player dead at zero health", () => {
    const w = quietLevel();
    w.damagePlayer(500, "trooper");
    expect(w.player.dead).toBe(true);
    expect(w.player.killer).toBe("trooper");
  });

  it("armour absorbs part of the damage", () => {
    const w = quietLevel();
    w.player.armor = 100;
    w.player.armorClass = 1;
    w.damagePlayer(30, "fiend");
    expect(w.player.health).toBe(80);
    expect(w.player.armor).toBe(90);
  });
});
