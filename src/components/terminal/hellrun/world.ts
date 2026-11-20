// HELLRUN game simulation: player, monsters, doors, pickups, projectiles.
// Pure logic (no DOM). Advanced by World.tick() at a fixed timestep.

import {
  BARREL_HP,
  DECOS,
  EFFECT_LIFE,
  ENEMIES,
  MAX_AMMO,
  PROJECTILES,
  SPLASH_DAMAGE,
  SPLASH_RADIUS,
  WEAPONS,
  WEAPON_INDEX,
  type AmmoType,
  type DecoType,
  type EffectType,
  type EnemyDef,
  type EnemyType,
  type ItemType,
  type ProjectileType,
  type SoundName,
} from "./defs";
import { parseLevel, wallTexId, type ParsedLevel } from "./levels";
import {
  castRay,
  distanceField,
  doorAtCell,
  isBlocking,
  K_DOOR,
  K_EMPTY,
  K_EXIT,
  lineOfSight,
  makeHit,
  normAngle,
  Rng,
  slideMove,
  type Door,
  type GridMap,
} from "./map";

export interface InputState {
  forward: boolean;
  back: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  run: boolean;
  fire: boolean;
  /** edge-triggered: use / open */
  use: boolean;
  /** edge-triggered weapon slot request (1..5), 0 = none */
  slot: number;
}

export function emptyInput(): InputState {
  return {
    forward: false,
    back: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
    run: false,
    fire: false,
    use: false,
    slot: 0,
  };
}

export interface Inventory {
  health: number;
  armor: number;
  armorClass: number;
  bullets: number;
  shells: number;
  rockets: number;
  weapons: boolean[];
  weapon: number;
}

export function startInventory(): Inventory {
  return {
    health: 100,
    armor: 0,
    armorClass: 0,
    bullets: 50,
    shells: 0,
    rockets: 0,
    weapons: [true, false, true, false, false, false, false],
    weapon: WEAPON_INDEX.pistol,
  };
}

export type WeaponState = "ready" | "firing" | "lowering" | "raising";

export interface Player {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  prevAngle: number;
  radius: number;
  health: number;
  armor: number;
  armorClass: number;
  ammo: Record<AmmoType, number>;
  weapons: boolean[];
  weapon: number;
  pendingWeapon: number;
  weaponState: WeaponState;
  weaponT: number;
  attackDone: boolean;
  refire: number;
  hasKey: boolean;
  bobPhase: number;
  bobAmp: number;
  /** 0..1 red flash */
  hurt: number;
  /** 0..1 pickup flash */
  bonus: number;
  dead: boolean;
  deadT: number;
  turnHold: number;
  hazardT: number;
  killer: EnemyType | "self" | "hazard" | null;
}

export type EnemyState = "idle" | "chase" | "attack" | "pain" | "dying" | "dead";

export interface Enemy {
  id: number;
  type: EnemyType;
  def: EnemyDef;
  x: number;
  y: number;
  angle: number;
  hp: number;
  state: EnemyState;
  t: number;
  cooldown: number;
  think: number;
  sees: boolean;
  lastX: number;
  lastY: number;
  attackDone: boolean;
  /** seconds spent actually moving (drives the walk animation) */
  walk: number;
  strafe: number;
  strafeT: number;
  gib: boolean;
  bob: number;
}

export interface Item {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  taken: boolean;
  dropped: boolean;
}

export interface Deco {
  id: number;
  type: DecoType;
  x: number;
  y: number;
  radius: number;
  solid: boolean;
  hp: number;
  /** barrels: -1 idle, >= 0 seconds until explosion */
  fuse: number;
  dead: boolean;
}

export interface Projectile {
  type: ProjectileType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  angle: number;
  damage: number;
  fromPlayer: boolean;
  owner: EnemyType | null;
  t: number;
  alive: boolean;
}

export interface Effect {
  type: EffectType;
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
}

export type MsgKey =
  | ItemType
  | "needKey"
  | "noAmmo"
  | "exitOn"
  | "chainsawFound";

export type WorldEvent =
  | { type: "sound"; name: SoundName; x: number; y: number }
  | { type: "msg"; key: MsgKey };

export type UseTarget = { kind: "door" | "locked" | "lockedOpen" | "exit"; dist: number } | null;

const PLAYER_RADIUS = 0.125;
const WALK_SPEED = 2.7;
const RUN_SPEED = 4.7;
const TURN_SPEED = 2.4;
const RUN_TURN_SPEED = 3.6;
const DOOR_SPEED = 2.2;
/** Reach of the use key, measured to the door plane (doors sit mid-cell). */
export const USE_RANGE = 1.5;
const PICKUP_RANGE = 0.32;
/** Seconds to lower or raise a weapon when switching. */
export const SWITCH_TIME = 0.17;
/** How far (in walkable cells) a gunshot can be heard. */
const NOISE_RANGE = 26;

function rnd(rng: Rng, [a, b]: [number, number]): number {
  return rng.int(a, b);
}

export class World {
  readonly levelIndex: number;
  readonly level: ParsedLevel;
  readonly map: GridMap;
  readonly player: Player;
  readonly enemies: Enemy[] = [];
  readonly items: Item[] = [];
  readonly decos: Deco[] = [];
  readonly projectiles: Projectile[] = [];
  readonly effects: Effect[] = [];
  readonly events: WorldEvent[] = [];
  /** cells the player has seen (automap), written by the renderer */
  readonly seen: Uint8Array;
  kills = 0;
  readonly totalKills: number;
  itemsTaken = 0;
  readonly totalItems: number;
  time = 0;
  exitTimer = -1;
  completed = false;
  /** seconds of muzzle-flash lighting left */
  flash = 0;
  private readonly rng: Rng;
  private readonly flow: Int16Array;
  private readonly sound: Int16Array;
  private readonly queue: Int32Array;
  private readonly navBlocked: Uint8Array;
  private flowCell = -1;
  private flowT = 0;
  private nextId = 1;
  private readonly hit = makeHit();
  private readonly hazardDamage: number;

  constructor(levelIndex: number, inv: Inventory = startInventory(), seed = 1337) {
    this.levelIndex = levelIndex;
    this.level = parseLevel(levelIndex);
    this.map = this.level.map;
    this.rng = new Rng(seed + levelIndex * 7919);
    const n = this.map.w * this.map.h;
    this.seen = new Uint8Array(n);
    this.flow = new Int16Array(n);
    this.sound = new Int16Array(n);
    this.queue = new Int32Array(n);
    this.navBlocked = new Uint8Array(n);
    this.hazardDamage = this.level.def.liquid === "lava1" ? 8 : 5;
    const L = this.level;
    this.player = {
      x: L.startX,
      y: L.startY,
      angle: L.startAngle,
      vx: 0,
      vy: 0,
      prevX: L.startX,
      prevY: L.startY,
      prevAngle: L.startAngle,
      radius: PLAYER_RADIUS,
      health: inv.health,
      armor: inv.armor,
      armorClass: inv.armorClass,
      ammo: { bullets: inv.bullets, shells: inv.shells, rockets: inv.rockets },
      weapons: inv.weapons.slice(),
      weapon: inv.weapon,
      pendingWeapon: inv.weapon,
      weaponState: "raising",
      weaponT: 0,
      attackDone: false,
      refire: 0,
      hasKey: false,
      bobPhase: 0,
      bobAmp: 0,
      hurt: 0,
      bonus: 0,
      dead: false,
      deadT: 0,
      turnHold: 0,
      hazardT: 0,
      killer: null,
    };
    for (const s of L.enemies) {
      const def = ENEMIES[s.type];
      this.enemies.push({
        id: this.nextId++,
        type: s.type,
        def,
        x: s.x,
        y: s.y,
        angle: Math.atan2(L.startY - s.y, L.startX - s.x),
        hp: def.hp,
        state: "idle",
        t: 0,
        cooldown: 0,
        think: this.rng.range(0, 0.2),
        sees: false,
        lastX: s.x,
        lastY: s.y,
        attackDone: false,
        walk: 0,
        strafe: 0,
        strafeT: 0,
        gib: false,
        bob: this.rng.range(0, 6),
      });
    }
    for (const s of L.items) {
      this.items.push({ id: this.nextId++, type: s.type, x: s.x, y: s.y, taken: false, dropped: false });
    }
    for (const s of L.decos) {
      const d = DECOS[s.type];
      this.decos.push({
        id: this.nextId++,
        type: s.type,
        x: s.x,
        y: s.y,
        radius: d.radius,
        solid: d.solid,
        hp: s.type === "barrel" ? BARREL_HP : 0,
        fuse: -1,
        dead: false,
      });
    }
    // Enemies route around solid decorations and liquids.
    for (const d of this.decos) {
      if (d.solid && d.type !== "barrel") this.navBlocked[Math.floor(d.y) * this.map.w + Math.floor(d.x)] = 1;
    }
    for (let i = 0; i < n; i++) if (this.map.hazard[i]) this.navBlocked[i] = 1;
    this.totalKills = this.enemies.length;
    this.totalItems = this.items.length;
  }

  // ---------------------------------------------------------------- inventory

  inventory(): Inventory {
    const p = this.player;
    return {
      health: p.health,
      armor: p.armor,
      armorClass: p.armorClass,
      bullets: p.ammo.bullets,
      shells: p.ammo.shells,
      rockets: p.ammo.rockets,
      weapons: p.weapons.slice(),
      weapon: p.pendingWeapon,
    };
  }

  // ---------------------------------------------------------------- tick

  tick(inp: InputState, dt: number): void {
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    p.prevAngle = p.angle;
    if (!p.dead && !this.completed) this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    p.hurt = Math.max(0, p.hurt - dt * 1.6);
    p.bonus = Math.max(0, p.bonus - dt * 2.5);

    if (p.dead) {
      p.deadT += dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    } else if (this.exitTimer < 0) {
      this.movePlayer(inp, dt);
      if (inp.use) this.use();
      if (inp.slot > 0) this.selectSlot(inp.slot);
      this.updateWeapon(inp, dt);
      this.pickups();
      this.hazards(dt);
    } else {
      p.vx = 0;
      p.vy = 0;
      p.bobAmp *= 0.9;
    }

    this.updateDoors(dt);
    this.updateFlow(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.separateEnemies();
    this.updateProjectiles(dt);
    this.updateBarrels(dt);
    this.updateEffects(dt);

    if (this.exitTimer >= 0) {
      this.exitTimer -= dt;
      if (this.exitTimer <= 0) {
        this.exitTimer = 0;
        this.completed = true;
      }
    }
  }

  private emit(name: SoundName, x = this.player.x, y = this.player.y): void {
    this.events.push({ type: "sound", name, x, y });
  }

  private msg(key: MsgKey): void {
    this.events.push({ type: "msg", key });
  }

  // ---------------------------------------------------------------- player

  private movePlayer(inp: InputState, dt: number): void {
    const p = this.player;
    const turn = (inp.turnRight ? 1 : 0) - (inp.turnLeft ? 1 : 0);
    if (turn !== 0) p.turnHold += dt;
    else p.turnHold = 0;
    const ramp = 0.45 + 0.55 * Math.min(1, p.turnHold / 0.18);
    p.angle = normAngle(p.angle + turn * (inp.run ? RUN_TURN_SPEED : TURN_SPEED) * ramp * dt);

    const fwd = (inp.forward ? 1 : 0) - (inp.back ? 1 : 0);
    const str = (inp.strafeRight ? 1 : 0) - (inp.strafeLeft ? 1 : 0);
    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    let mx = ca * fwd - sa * str;
    let my = sa * fwd + ca * str;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const speed = inp.run ? RUN_SPEED : WALK_SPEED;
    const tx = mx * speed;
    const ty = my * speed;
    const k = Math.min(1, dt * (len > 0 ? 11 : 9));
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
    if (Math.abs(p.vx) < 1e-3 && Math.abs(p.vy) < 1e-3) {
      p.vx = 0;
      p.vy = 0;
    }
    slideMove(this.map, p, p.vx * dt, p.vy * dt, p.radius);
    this.pushOutOfSolids(p, p.radius, null);

    const sp = Math.hypot(p.vx, p.vy);
    p.bobPhase += dt * 3.4;
    const target = Math.min(1, sp / RUN_SPEED * 1.25);
    p.bobAmp += (target - p.bobAmp) * Math.min(1, dt * 8);
  }

  /** Push a circle out of solid decorations and (living) monsters. */
  private pushOutOfSolids(b: { x: number; y: number }, r: number, self: Enemy | null): void {
    for (const d of this.decos) {
      if (!d.solid || d.dead) continue;
      this.pushOut(b, r, d.x, d.y, d.radius);
    }
    for (const e of this.enemies) {
      if (e === self || e.state === "dying" || e.state === "dead") continue;
      this.pushOut(b, r, e.x, e.y, e.def.radius);
    }
  }

  private pushOut(b: { x: number; y: number }, r: number, ox: number, oy: number, or: number): void {
    const dx = b.x - ox;
    const dy = b.y - oy;
    const min = r + or;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-4;
    const push = min - d;
    slideMove(this.map, b, (dx / d) * push, (dy / d) * push, r);
  }

  private hazards(dt: number): void {
    const p = this.player;
    const i = Math.floor(p.y) * this.map.w + Math.floor(p.x);
    if (this.map.hazard[i]) {
      p.hazardT += dt;
      if (p.hazardT >= 0.6) {
        p.hazardT -= 0.6;
        this.damagePlayer(this.hazardDamage, "hazard");
      }
    } else {
      p.hazardT = Math.max(0, p.hazardT - dt);
    }
  }

  damagePlayer(amount: number, source: EnemyType | "self" | "hazard"): void {
    const p = this.player;
    if (p.dead || amount <= 0) return;
    let dmg = amount;
    if (p.armor > 0) {
      let saved = p.armorClass >= 2 ? Math.floor(dmg / 2) : Math.floor(dmg / 3);
      if (saved > p.armor) saved = p.armor;
      p.armor -= saved;
      if (p.armor <= 0) p.armorClass = 0;
      dmg -= saved;
    }
    p.health -= dmg;
    p.hurt = Math.min(1, p.hurt + 0.25 + dmg / 40);
    if (p.health <= 0) {
      p.health = 0;
      p.dead = true;
      p.deadT = 0;
      p.killer = source;
      this.emit("playerDeath");
    } else {
      this.emit("hurt");
    }
  }

  // ---------------------------------------------------------------- use / doors

  /** What the player is looking at within `range` cells (doors, exit switch). */
  probeUse(range = USE_RANGE): UseTarget {
    const p = this.player;
    let best: UseTarget = null;
    for (const off of [0, -0.22, 0.22]) {
      const a = p.angle + off;
      if (!castRay(this.map, p.x, p.y, Math.cos(a), Math.sin(a), range, this.hit)) continue;
      const h = this.hit;
      let t: UseTarget = null;
      if (h.kind === K_DOOR && h.door) {
        if (h.door.moving > 0 || h.door.open >= 1) continue;
        if (h.door.locked) t = { kind: p.hasKey ? "lockedOpen" : "locked", dist: h.dist };
        else t = { kind: "door", dist: h.dist };
      } else if (h.kind === K_EXIT) {
        if (this.exitTimer >= 0) continue;
        t = { kind: "exit", dist: h.dist };
      }
      if (t && (!best || t.dist < best.dist)) best = t;
      if (best && off === 0) break;
    }
    return best;
  }

  private use(): void {
    const p = this.player;
    for (const off of [0, -0.22, 0.22]) {
      const a = p.angle + off;
      if (!castRay(this.map, p.x, p.y, Math.cos(a), Math.sin(a), USE_RANGE, this.hit)) continue;
      const h = this.hit;
      if (h.kind === K_DOOR && h.door) {
        this.useDoor(h.door);
        return;
      }
      if (h.kind === K_EXIT) {
        this.activateExit(h.mapX, h.mapY);
        return;
      }
    }
  }

  private useDoor(door: Door): void {
    if (door.moving > 0 || door.open >= 1) return;
    if (door.locked) {
      if (!this.player.hasKey) {
        this.msg("needKey");
        this.emit("locked", door.x + 0.5, door.y + 0.5);
        return;
      }
      door.locked = false;
    }
    door.moving = 1;
    this.emit("door", door.x + 0.5, door.y + 0.5);
  }

  /** Opens an unlocked door (used by monsters too). */
  openDoor(door: Door): void {
    if (door.locked || door.moving > 0 || door.open >= 1) return;
    door.moving = 1;
    this.emit("door", door.x + 0.5, door.y + 0.5);
  }

  private activateExit(cx: number, cy: number): void {
    if (this.exitTimer >= 0) return;
    const i = cy * this.map.w + cx;
    this.map.tex[i] = wallTexId("exit_on");
    this.exitTimer = 0.9;
    this.emit("switch", cx + 0.5, cy + 0.5);
    this.msg("exitOn");
  }

  private updateDoors(dt: number): void {
    for (const d of this.map.doors) {
      if (d.moving === 0) continue;
      d.open += d.moving * DOOR_SPEED * dt;
      if (d.open >= 1) {
        d.open = 1;
        d.moving = 0;
      } else if (d.open <= 0) {
        d.open = 0;
        d.moving = 0;
      }
    }
  }

  // ---------------------------------------------------------------- weapons

  private hasAmmoFor(index: number): boolean {
    const w = WEAPONS[index];
    if (!w.ammo) return true;
    return this.player.ammo[w.ammo] >= w.perShot;
  }

  private selectSlot(slot: number): void {
    const p = this.player;
    const options: number[] = [];
    for (let i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].slot === slot && p.weapons[i]) options.push(i);
    }
    if (options.length === 0) return;
    const current = p.pendingWeapon;
    let pick: number;
    if (options.includes(current) && options.length > 1) {
      pick = options[(options.indexOf(current) + 1) % options.length];
    } else if (options.includes(current)) {
      return;
    } else {
      // Prefer the stronger weapon of the slot when it has ammo.
      pick = options[options.length - 1];
      if (!this.hasAmmoFor(pick)) pick = options[0];
    }
    this.requestWeapon(pick);
  }

  requestWeapon(index: number): void {
    const p = this.player;
    if (!p.weapons[index] || index === p.pendingWeapon) return;
    p.pendingWeapon = index;
    if (p.weaponState === "ready") {
      p.weaponState = "lowering";
      p.weaponT = 0;
    } else if (p.weaponState === "raising") {
      // reverse the raise from where it currently is
      p.weaponState = "lowering";
      p.weaponT = Math.max(0, SWITCH_TIME - p.weaponT);
    }
  }

  private bestWeaponWithAmmo(): number {
    const order = ["chaingun", "supershotgun", "shotgun", "pistol", "chainsaw", "fist"] as const;
    for (const id of order) {
      const i = WEAPON_INDEX[id];
      if (this.player.weapons[i] && this.hasAmmoFor(i)) return i;
    }
    return WEAPON_INDEX.fist;
  }

  private updateWeapon(inp: InputState, dt: number): void {
    const p = this.player;
    p.weaponT += dt;
    switch (p.weaponState) {
      case "lowering":
        if (p.weaponT >= SWITCH_TIME) {
          p.weapon = p.pendingWeapon;
          p.weaponState = "raising";
          p.weaponT = 0;
          this.emit("weaponUp");
        }
        return;
      case "raising":
        if (p.weaponT >= SWITCH_TIME) {
          p.weaponState = "ready";
          p.weaponT = 0;
        }
        return;
      case "firing": {
        const w = WEAPONS[p.weapon];
        if (!p.attackDone && p.weaponT >= w.fireAt) {
          p.attackDone = true;
          this.attack();
        }
        if (p.weaponT >= w.cooldown) {
          if (p.pendingWeapon !== p.weapon) {
            p.weaponState = "lowering";
            p.weaponT = 0;
            p.refire = 0;
          } else if (inp.fire && this.hasAmmoFor(p.weapon)) {
            p.weaponT -= w.cooldown;
            p.attackDone = false;
            p.refire++;
            if (!p.attackDone && p.weaponT >= w.fireAt) {
              p.attackDone = true;
              this.attack();
            }
          } else {
            p.weaponState = "ready";
            p.weaponT = 0;
            p.refire = 0;
          }
        }
        return;
      }
      case "ready":
        if (p.pendingWeapon !== p.weapon) {
          p.weaponState = "lowering";
          p.weaponT = 0;
          return;
        }
        if (inp.fire) {
          if (!this.hasAmmoFor(p.weapon)) {
            this.msg("noAmmo");
            this.emit("noAmmo");
            const best = this.bestWeaponWithAmmo();
            if (best !== p.weapon) this.requestWeapon(best);
            return;
          }
          p.weaponState = "firing";
          p.weaponT = 0;
          p.attackDone = false;
          p.refire = 0;
          const w = WEAPONS[p.weapon];
          if (w.fireAt <= 0) {
            p.attackDone = true;
            this.attack();
          }
        }
        return;
    }
  }

  private attack(): void {
    const p = this.player;
    const w = WEAPONS[p.weapon];
    if (w.ammo) {
      if (p.ammo[w.ammo] < w.perShot) return;
      p.ammo[w.ammo] -= w.perShot;
    }
    if (w.melee) {
      const hitSomething = this.melee(rnd(this.rng, w.damage), w.range);
      if (w.id === "chainsaw") this.emit(hitSomething ? "sawHit" : "saw");
      else this.emit(hitSomething ? "punchHit" : "punch");
      if (w.noisy) this.makeNoise();
      return;
    }
    this.emit(w.sound);
    this.flash = 0.11;
    if (w.rocket) {
      this.spawnProjectile("rocket", p.x, p.y, p.angle, rnd(this.rng, w.damage), true, null, 0.3);
    } else {
      const accurate = w.pellets === 1 && p.refire === 0;
      for (let i = 0; i < w.pellets; i++) {
        const spread = accurate ? 0 : (this.rng.next() - this.rng.next()) * w.spread;
        this.hitscan(p.angle + spread, rnd(this.rng, w.damage), w.range);
      }
    }
    if (w.noisy) this.makeNoise();
  }

  /** Player hitscan: damages the first monster/barrel along the ray, else puffs the wall. */
  hitscan(angle: number, damage: number, range: number): Enemy | Deco | null {
    const p = this.player;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = range;
    if (castRay(this.map, p.x, p.y, dx, dy, range, this.hit)) best = this.hit.dist;
    const wallDist = best;
    let target: Enemy | null = null;
    let barrel: Deco | null = null;
    for (const e of this.enemies) {
      if (e.state === "dying" || e.state === "dead") continue;
      const ex = e.x - p.x;
      const ey = e.y - p.y;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along >= best) continue;
      const perp = Math.abs(ex * dy - ey * dx);
      if (perp < e.def.radius + 0.04) {
        best = along;
        target = e;
      }
    }
    for (const d of this.decos) {
      if (d.type !== "barrel" || d.dead || d.fuse >= 0) continue;
      const ex = d.x - p.x;
      const ey = d.y - p.y;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along >= best) continue;
      if (Math.abs(ex * dy - ey * dx) < d.radius + 0.05) {
        best = along;
        barrel = d;
        target = null;
      }
    }
    if (barrel) {
      this.damageBarrel(barrel, damage);
      this.spawnEffect("puff", p.x + dx * (best - 0.05), p.y + dy * (best - 0.05), 0.2);
      return barrel;
    }
    if (target) {
      this.damageEnemy(target, damage, angle);
      this.spawnEffect("blood", p.x + dx * (best - 0.08), p.y + dy * (best - 0.08), target.def.eye);
      return target;
    }
    if (wallDist < range) {
      const back = Math.max(0, wallDist - 0.03);
      this.spawnEffect("puff", p.x + dx * back, p.y + dy * back, 0.26 + this.rng.range(-0.05, 0.05));
    }
    return null;
  }

  private melee(damage: number, range: number): boolean {
    const p = this.player;
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    let best: Enemy | null = null;
    let bestAlong = Infinity;
    for (const e of this.enemies) {
      if (e.state === "dying" || e.state === "dead") continue;
      const ex = e.x - p.x;
      const ey = e.y - p.y;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along > range + e.def.radius) continue;
      const perp = Math.abs(ex * dy - ey * dx);
      if (perp > e.def.radius + 0.18) continue;
      if (!lineOfSight(this.map, p.x, p.y, e.x, e.y)) continue;
      if (along < bestAlong) {
        bestAlong = along;
        best = e;
      }
    }
    if (best) {
      this.damageEnemy(best, damage, p.angle);
      this.spawnEffect("blood", p.x + dx * (bestAlong - 0.1), p.y + dy * (bestAlong - 0.1), best.def.eye);
      return true;
    }
    for (const d of this.decos) {
      if (d.type !== "barrel" || d.dead || d.fuse >= 0) continue;
      const ex = d.x - p.x;
      const ey = d.y - p.y;
      const along = ex * dx + ey * dy;
      if (along > 0 && along < range + d.radius && Math.abs(ex * dy - ey * dx) < d.radius + 0.15) {
        this.damageBarrel(d, damage);
        return true;
      }
    }
    return false;
  }

  /** Wake up monsters that can hear the player's gun (sound travels through open space). */
  private makeNoise(): void {
    const p = this.player;
    const m = this.map;
    distanceField(
      m,
      Math.floor(p.x),
      Math.floor(p.y),
      this.sound,
      (i) => {
        const k = m.kind[i];
        if (k === K_EMPTY) return true;
        if (k === K_DOOR) return m.doors[m.doorAt[i]].open > 0.3;
        return false;
      },
      NOISE_RANGE,
      this.queue,
    );
    for (const e of this.enemies) {
      if (e.state !== "idle") continue;
      const d = this.sound[Math.floor(e.y) * m.w + Math.floor(e.x)];
      if (d >= 0 && d <= NOISE_RANGE) this.alert(e, false);
    }
  }

  // ---------------------------------------------------------------- pickups

  private pickups(): void {
    const p = this.player;
    for (const it of this.items) {
      if (it.taken) continue;
      const dx = it.x - p.x;
      const dy = it.y - p.y;
      if (dx * dx + dy * dy > PICKUP_RANGE * PICKUP_RANGE + p.radius * p.radius) continue;
      if (this.applyItem(it)) {
        it.taken = true;
        if (!it.dropped) this.itemsTaken++;
      }
    }
  }

  private giveAmmo(type: AmmoType, amount: number): boolean {
    const p = this.player;
    if (p.ammo[type] >= MAX_AMMO[type]) return false;
    const hadNone = p.ammo[type] === 0;
    p.ammo[type] = Math.min(MAX_AMMO[type], p.ammo[type] + amount);
    if (hadNone && p.weaponState !== "firing") {
      // Doom-like: switch away from fists/pistol when new ammo type arrives
      const cur = WEAPONS[p.pendingWeapon];
      if (type === "shells" && (cur.id === "fist" || cur.id === "pistol" || cur.id === "chainsaw")) {
        if (p.weapons[WEAPON_INDEX.supershotgun]) this.requestWeapon(WEAPON_INDEX.supershotgun);
        else if (p.weapons[WEAPON_INDEX.shotgun]) this.requestWeapon(WEAPON_INDEX.shotgun);
      } else if (type === "bullets" && (cur.id === "fist" || cur.id === "chainsaw")) {
        this.requestWeapon(p.weapons[WEAPON_INDEX.chaingun] ? WEAPON_INDEX.chaingun : WEAPON_INDEX.pistol);
      }
    }
    return true;
  }

  private giveWeapon(id: (typeof WEAPONS)[number]["id"], ammo: AmmoType | null, amount: number): boolean {
    const p = this.player;
    const idx = WEAPON_INDEX[id];
    const had = p.weapons[idx];
    let took = false;
    if (ammo) took = this.giveAmmo(ammo, amount);
    if (!had) {
      p.weapons[idx] = true;
      this.requestWeapon(idx);
      took = true;
    }
    return took;
  }

  /** Applies an item to the player. Returns false if it was not needed. */
  private applyItem(it: Item): boolean {
    const p = this.player;
    let ok = false;
    let sound: SoundName = "pickup";
    switch (it.type) {
      case "clip":
        ok = this.giveAmmo("bullets", it.dropped ? 5 : 10);
        break;
      case "ammobox":
        ok = this.giveAmmo("bullets", 50);
        break;
      case "shells":
        ok = this.giveAmmo("shells", 4);
        break;
      case "shellbox":
        ok = this.giveAmmo("shells", 20);
        break;
      case "rocket":
        ok = this.giveAmmo("rockets", 1);
        break;
      case "rocketbox":
        ok = this.giveAmmo("rockets", 5);
        break;
      case "stim":
        if (p.health < 100) {
          p.health = Math.min(100, p.health + 10);
          ok = true;
        }
        break;
      case "medkit":
        if (p.health < 100) {
          p.health = Math.min(100, p.health + 25);
          ok = true;
        }
        break;
      case "hbonus":
        p.health = Math.min(200, p.health + 1);
        ok = true;
        break;
      case "abonus":
        p.armor = Math.min(200, p.armor + 1);
        if (p.armorClass === 0) p.armorClass = 1;
        ok = true;
        break;
      case "armor":
        if (p.armor < 100) {
          p.armor = 100;
          p.armorClass = 1;
          ok = true;
        }
        break;
      case "megaarmor":
        if (p.armor < 200) {
          p.armor = 200;
          p.armorClass = 2;
          ok = true;
          sound = "powerup";
        }
        break;
      case "key":
        p.hasKey = true;
        ok = true;
        sound = "keyPickup";
        break;
      case "w_chainsaw":
        ok = this.giveWeapon("chainsaw", null, 0);
        sound = "weaponPickup";
        break;
      case "w_shotgun":
        ok = this.giveWeapon("shotgun", "shells", 8);
        sound = "weaponPickup";
        break;
      case "w_supershotgun":
        ok = this.giveWeapon("supershotgun", "shells", 8);
        sound = "weaponPickup";
        break;
      case "w_chaingun":
        ok = this.giveWeapon("chaingun", "bullets", 20);
        sound = "weaponPickup";
        break;
      case "w_launcher":
        ok = this.giveWeapon("launcher", "rockets", 2);
        sound = "weaponPickup";
        break;
    }
    if (ok) {
      p.bonus = Math.min(1, p.bonus + 0.6);
      this.emit(sound, it.x, it.y);
      this.msg(it.type);
    }
    return ok;
  }

  // ---------------------------------------------------------------- monsters

  private updateFlow(dt: number): void {
    const p = this.player;
    const m = this.map;
    const cell = Math.floor(p.y) * m.w + Math.floor(p.x);
    this.flowT -= dt;
    if (cell === this.flowCell && this.flowT > 0) return;
    this.flowCell = cell;
    this.flowT = 0.35;
    const nav = this.navBlocked;
    distanceField(
      m,
      Math.floor(p.x),
      Math.floor(p.y),
      this.flow,
      (i) => {
        if (nav[i]) return false;
        const k = m.kind[i];
        if (k === K_EMPTY) return true;
        if (k === K_DOOR) return !m.doors[m.doorAt[i]].locked;
        return false;
      },
      200,
      this.queue,
    );
  }

  private canSee(e: Enemy, fov: boolean): boolean {
    const p = this.player;
    if (p.dead) return false;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > e.def.sight * e.def.sight) return false;
    if (fov && d2 > 2.5 * 2.5) {
      const diff = Math.abs(normAngle(Math.atan2(dy, dx) - e.angle));
      if (diff > Math.PI * 0.55) return false;
    }
    return lineOfSight(this.map, e.x, e.y, p.x, p.y);
  }

  private alert(e: Enemy, quick: boolean): void {
    if (e.state !== "idle") return;
    e.state = "chase";
    e.t = 0;
    e.cooldown = quick ? 0.15 : e.def.reaction + this.rng.range(0, 0.4);
    e.sees = false;
    e.lastX = this.player.x;
    e.lastY = this.player.y;
    this.emit("enemyAlert", e.x, e.y);
  }

  private updateEnemy(e: Enemy, dt: number): void {
    e.t += dt;
    e.bob += dt;
    const def = e.def;
    const p = this.player;
    switch (e.state) {
      case "dead":
        return;
      case "dying":
        if (e.t >= def.deathTime) e.state = "dead";
        return;
      case "pain":
        if (e.t >= def.painTime) {
          e.state = "chase";
          e.t = 0;
        }
        return;
      case "idle":
        e.think -= dt;
        if (e.think <= 0) {
          e.think = 0.18 + this.rng.range(0, 0.1);
          if (this.canSee(e, true)) this.alert(e, false);
        }
        return;
      case "attack": {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (!e.attackDone && e.t >= def.fireAt) {
          e.attackDone = true;
          this.enemyAttack(e);
        }
        if (e.t >= def.attackTime) {
          e.state = "chase";
          e.t = 0;
          e.cooldown = this.rng.range(def.cooldown[0], def.cooldown[1]);
        }
        return;
      }
      case "chase":
        break;
    }

    // chase
    e.cooldown -= dt;
    e.think -= dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (e.think <= 0) {
      e.think = 0.12 + this.rng.range(0, 0.08);
      e.sees = this.canSee(e, false);
      if (e.sees) {
        e.lastX = p.x;
        e.lastY = p.y;
      }
      if (e.sees && e.cooldown <= 0 && !p.dead) {
        const meleeOk = def.melee && dist <= def.meleeRange + p.radius;
        const rangedOk = def.ranged && dist <= def.range && this.rng.next() < Math.max(0.3, 1.1 - dist / 14);
        if (meleeOk || rangedOk) {
          e.state = "attack";
          e.t = 0;
          e.attackDone = false;
          e.angle = Math.atan2(dy, dx);
          return;
        }
      }
    }
    if (p.dead) return;

    // Movement
    let tx: number;
    let ty: number;
    const stopDist = def.ranged ? 1.2 : def.meleeRange * 0.75;
    if (e.sees && dist < 6) {
      tx = p.x;
      ty = p.y;
      if (def.ranged && dist < 3.5) {
        // circle-strafe a little instead of hugging the player
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafeT = this.rng.range(0.6, 1.4);
          e.strafe = this.rng.next() < 0.5 ? -1 : 1;
        }
        tx = e.x - dy * e.strafe;
        ty = e.y + dx * e.strafe;
      }
    } else {
      const target = this.nextFlowTarget(e);
      tx = target[0];
      ty = target[1];
    }
    let mx = tx - e.x;
    let my = ty - e.y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-3 || (dist < stopDist + p.radius && e.sees && !(def.ranged && dist < 3.5))) {
      if (e.sees) e.angle = Math.atan2(dy, dx);
      return;
    }
    mx /= ml;
    my /= ml;
    const step = def.speed * dt;
    const ox = e.x;
    const oy = e.y;
    slideMove(this.map, e, mx * step, my * step, def.radius);
    this.pushOutOfSolids(e, def.radius, e);
    // don't walk into the player
    const pdx = e.x - p.x;
    const pdy = e.y - p.y;
    const minD = def.radius + p.radius;
    if (pdx * pdx + pdy * pdy < minD * minD) {
      e.x = ox;
      e.y = oy;
    }
    const moved = Math.hypot(e.x - ox, e.y - oy);
    if (moved > 1e-4) e.walk += dt; // walk animation clock
    e.angle = Math.atan2(my, mx);
    // open doors in the way
    const ahead = doorAtCell(this.map, Math.floor(e.x + mx * 0.6), Math.floor(e.y + my * 0.6));
    if (ahead && !ahead.locked && ahead.open < 1 && ahead.moving <= 0) this.openDoor(ahead);
  }

  private nextFlowTarget(e: Enemy): [number, number] {
    const m = this.map;
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    const here = this.flow[cy * m.w + cx];
    let best = here >= 0 ? here : 32000;
    let bx = cx;
    let by = cy;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const d = this.flow[ny * m.w + nx];
        if (d < 0) continue;
        if (ox !== 0 && oy !== 0) {
          // no corner cutting
          if (isBlocking(m, cx + ox, cy) || isBlocking(m, cx, cy + oy)) continue;
          if (this.flow[cy * m.w + cx + ox] < 0 || this.flow[(cy + oy) * m.w + cx] < 0) continue;
        }
        const dd = d + (ox !== 0 && oy !== 0 ? 0.4 : 0);
        if (dd < best) {
          best = dd;
          bx = nx;
          by = ny;
        }
      }
    }
    if (bx === cx && by === cy) {
      if (here < 0) return [e.lastX, e.lastY];
      return [this.player.x, this.player.y];
    }
    return [bx + 0.5, by + 0.5];
  }

  private enemyAttack(e: Enemy): void {
    const p = this.player;
    const def = e.def;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    const los = lineOfSight(this.map, e.x, e.y, p.x, p.y);
    if (def.melee && dist <= def.meleeRange + p.radius + 0.08 && los) {
      this.emit(e.type === "biter" ? "bite" : "punch", e.x, e.y);
      this.damagePlayer(rnd(this.rng, def.melee), e.type);
      return;
    }
    if (!def.ranged) return;
    if (def.ranged === "hitscan") {
      this.emit("enemyShot", e.x, e.y);
      if (!los) return;
      const moving = Math.hypot(p.vx, p.vy) > 3 ? 0.15 : 0;
      const chance = Math.max(0.25, Math.min(0.85, 0.95 - dist * 0.045 - moving));
      if (this.rng.next() < chance) this.damagePlayer(rnd(this.rng, def.damage), e.type);
      else {
        // ricochet near the player
        const a = Math.atan2(dy, dx) + this.rng.range(-0.08, 0.08);
        const back = Math.max(0.2, dist + 0.3);
        if (castRay(this.map, e.x, e.y, Math.cos(a), Math.sin(a), back + 2, this.hit)) {
          const d = this.hit.dist - 0.03;
          this.spawnEffect("puff", e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 0.28);
        }
      }
      return;
    }
    const a = Math.atan2(dy, dx) + this.rng.range(-0.04, 0.04);
    this.spawnProjectile(def.projectile, e.x, e.y, a, rnd(this.rng, def.damage), false, e.type, def.eye);
    this.emit("fireball", e.x, e.y);
  }

  damageEnemy(e: Enemy, amount: number, fromAngle: number): void {
    if (e.state === "dying" || e.state === "dead") return;
    e.hp -= amount;
    if (e.hp <= 0) {
      e.gib = e.hp <= -e.def.hp && (e.type === "trooper" || e.type === "fiend");
      e.state = "dying";
      e.t = 0;
      this.kills++;
      this.emit("enemyDeath", e.x, e.y);
      if (e.type === "trooper") {
        this.items.push({ id: this.nextId++, type: "clip", x: e.x, y: e.y, taken: false, dropped: true });
      }
      return;
    }
    // knock-back
    const kb = Math.min(0.25, amount * 0.004) / (e.def.hp > 200 ? 3 : 1);
    slideMove(this.map, e, Math.cos(fromAngle) * kb, Math.sin(fromAngle) * kb, e.def.radius);
    if (e.state === "idle") {
      this.alert(e, true);
      e.sees = true;
    }
    if (this.rng.next() < e.def.painChance) {
      e.state = "pain";
      e.t = 0;
      this.emit("enemyPain", e.x, e.y);
    }
  }

  private separateEnemies(): void {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state === "dying" || a.state === "dead") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state === "dying" || b.state === "dead") continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.def.radius + b.def.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const push = (min - d) * 0.5;
        slideMove(this.map, a, (-dx / d) * push, (-dy / d) * push, a.def.radius);
        slideMove(this.map, b, (dx / d) * push, (dy / d) * push, b.def.radius);
      }
    }
  }

  // ---------------------------------------------------------------- projectiles & effects

  private spawnProjectile(
    type: ProjectileType,
    x: number,
    y: number,
    angle: number,
    damage: number,
    fromPlayer: boolean,
    owner: EnemyType | null,
    z: number,
  ): void {
    const spec = PROJECTILES[type];
    const off = fromPlayer ? 0.18 : 0.26;
    this.projectiles.push({
      type,
      x: x + Math.cos(angle) * off,
      y: y + Math.sin(angle) * off,
      z,
      vx: Math.cos(angle) * spec.speed,
      vy: Math.sin(angle) * spec.speed,
      angle,
      damage,
      fromPlayer,
      owner,
      t: 0,
      alive: true,
    });
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.t += dt;
      const spec = PROJECTILES[pr.type];
      const steps = 2;
      for (let s = 0; s < steps && pr.alive; s++) {
        const nx = pr.x + (pr.vx * dt) / steps;
        const ny = pr.y + (pr.vy * dt) / steps;
        if (isBlocking(this.map, Math.floor(nx), Math.floor(ny))) {
          this.explodeProjectile(pr, null);
          break;
        }
        pr.x = nx;
        pr.y = ny;
        if (!pr.fromPlayer) {
          const dx = p.x - pr.x;
          const dy = p.y - pr.y;
          const r = p.radius + spec.radius + 0.04;
          if (!p.dead && dx * dx + dy * dy < r * r) {
            this.damagePlayer(pr.damage, pr.owner ?? "self");
            this.explodeProjectile(pr, null);
            break;
          }
        } else {
          for (const e of this.enemies) {
            if (e.state === "dying" || e.state === "dead") continue;
            const dx = e.x - pr.x;
            const dy = e.y - pr.y;
            const r = e.def.radius + spec.radius;
            if (dx * dx + dy * dy < r * r) {
              this.explodeProjectile(pr, e);
              break;
            }
          }
        }
        if (!pr.alive) break;
        for (const d of this.decos) {
          if (d.type !== "barrel" || d.dead || d.fuse >= 0) continue;
          const dx = d.x - pr.x;
          const dy = d.y - pr.y;
          const r = d.radius + spec.radius;
          if (dx * dx + dy * dy < r * r) {
            this.damageBarrel(d, pr.damage);
            this.explodeProjectile(pr, null);
            break;
          }
        }
      }
      if (pr.t > 8) pr.alive = false;
    }
    let w = 0;
    for (const pr of this.projectiles) if (pr.alive) this.projectiles[w++] = pr;
    this.projectiles.length = w;
  }

  private explodeProjectile(pr: Projectile, direct: Enemy | null): void {
    pr.alive = false;
    const spec = PROJECTILES[pr.type];
    const bx = pr.x - Math.cos(pr.angle) * 0.06;
    const by = pr.y - Math.sin(pr.angle) * 0.06;
    this.spawnEffect(spec.hit, bx, by, pr.z);
    if (direct) this.damageEnemy(direct, pr.damage, pr.angle);
    if (spec.splash > 0) {
      this.splash(bx, by, SPLASH_RADIUS, SPLASH_DAMAGE, "self");
      this.emit("explode", bx, by);
    }
  }

  /** Radius damage (rockets, barrels). Walls block it. */
  splash(x: number, y: number, radius: number, maxDamage: number, source: EnemyType | "self"): void {
    const p = this.player;
    const fall = (d: number) => Math.floor(maxDamage * Math.max(0, 1 - d / radius));
    {
      const d = Math.max(0, Math.hypot(p.x - x, p.y - y) - p.radius);
      if (d < radius && lineOfSight(this.map, x, y, p.x, p.y)) this.damagePlayer(fall(d), source);
    }
    for (const e of this.enemies) {
      if (e.state === "dying" || e.state === "dead") continue;
      const d = Math.max(0, Math.hypot(e.x - x, e.y - y) - e.def.radius);
      if (d < radius && lineOfSight(this.map, x, y, e.x, e.y)) {
        this.damageEnemy(e, fall(d), Math.atan2(e.y - y, e.x - x));
      }
    }
    for (const b of this.decos) {
      if (b.type !== "barrel" || b.dead || b.fuse >= 0) continue;
      const d = Math.max(0, Math.hypot(b.x - x, b.y - y) - b.radius);
      if (d < radius && lineOfSight(this.map, x, y, b.x, b.y)) this.damageBarrel(b, fall(d));
    }
  }

  damageBarrel(b: Deco, amount: number): void {
    if (b.dead || b.fuse >= 0) return;
    b.hp -= amount;
    if (b.hp <= 0) b.fuse = 0.18;
  }

  private updateBarrels(dt: number): void {
    for (const b of this.decos) {
      if (b.type !== "barrel" || b.dead || b.fuse < 0) continue;
      b.fuse -= dt;
      if (b.fuse <= 0) {
        b.dead = true;
        b.solid = false;
        this.spawnEffect("barrelHit", b.x, b.y, 0);
        this.emit("explode", b.x, b.y);
        this.splash(b.x, b.y, SPLASH_RADIUS, SPLASH_DAMAGE, "self");
      }
    }
  }

  private spawnEffect(type: EffectType, x: number, y: number, z: number): void {
    if (this.effects.length > 80) this.effects.shift();
    this.effects.push({ type, x, y, z, t: 0, life: EFFECT_LIFE[type] });
  }

  private updateEffects(dt: number): void {
    let w = 0;
    for (const fx of this.effects) {
      fx.t += dt;
      if (fx.type === "puff") fx.z += dt * 0.12;
      if (fx.t < fx.life) this.effects[w++] = fx;
    }
    this.effects.length = w;
  }

  // ---------------------------------------------------------------- debug / tests

  /** Teleport helper for tests and the harness. */
  placePlayer(x: number, y: number, angle: number): void {
    const p = this.player;
    p.x = p.prevX = x;
    p.y = p.prevY = y;
    p.angle = p.prevAngle = angle;
    p.vx = p.vy = 0;
  }
}
