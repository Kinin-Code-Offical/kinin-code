// HELLRUN: public game object. Owns screens (title / play / pause / level
// complete / death / victory), keyboard state, the fixed-timestep loop, audio,
// and draws everything through the renderer + HUD.

import { Sfx } from "./audio";
import { AssetStore } from "./assets";
import type { SoundName } from "./defs";
import {
  drawBanner,
  drawComplete,
  drawCrosshair,
  drawDead,
  drawFlashes,
  drawHint,
  drawHud,
  drawMessage,
  drawMinimap,
  drawPause,
  drawTitle,
  drawVictory,
  type Frame,
  type LevelStats,
  type Totals,
} from "./hud";
import { fmt, strings, upper, type HellrunLang } from "./i18n";
import { LEVELS } from "./levels";
import { Palette } from "./palette";
import { Renderer } from "./render";
import { emptyInput, startInventory, World, type InputState, type Inventory, type MsgKey, type UseTarget } from "./world";

export type { HellrunLang } from "./i18n";

export type HellrunScreen = "title" | "play" | "paused" | "complete" | "dead" | "victory";

export interface HellrunOptions {
  lang: HellrunLang;
  lowPower?: boolean;
  onExit?: () => void;
  /** Base URL of the Freedoom art folder (default "/hellrun/freedoom"). */
  assetBase?: string;
  /** Seed for gameplay randomness (default fixed). */
  seed?: number;
}

const STEP = 1 / 60;
const MAX_STEPS = 16;

type Action = "forward" | "back" | "strafeLeft" | "strafeRight" | "turnLeft" | "turnRight" | "run" | "fire";

const CODE_ACTIONS: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "strafeLeft",
  KeyD: "strafeRight",
  ArrowLeft: "turnLeft",
  ArrowRight: "turnRight",
  ShiftLeft: "run",
  ShiftRight: "run",
  Space: "fire",
  ControlLeft: "fire",
  ControlRight: "fire",
};

const KEY_ACTIONS: Record<string, Action> = {
  w: "forward",
  arrowup: "forward",
  s: "back",
  arrowdown: "back",
  a: "strafeLeft",
  d: "strafeRight",
  arrowleft: "turnLeft",
  arrowright: "turnRight",
  shift: "run",
  " ": "fire",
  spacebar: "fire",
  control: "fire",
};

/** Normalises a key event to a stable id: the physical code when present. */
function keyId(e: { key: string; code: string }): string {
  if (e.code && e.code !== "Unidentified") return e.code;
  const k = (e.key || "").toLowerCase();
  const map: Record<string, string> = {
    w: "KeyW",
    a: "KeyA",
    s: "KeyS",
    d: "KeyD",
    e: "KeyE",
    m: "KeyM",
    p: "KeyP",
    q: "KeyQ",
    r: "KeyR",
    " ": "Space",
    spacebar: "Space",
    enter: "Enter",
    escape: "Escape",
    esc: "Escape",
    tab: "Tab",
    shift: "ShiftLeft",
    control: "ControlLeft",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
  };
  if (map[k]) return map[k];
  if (/^[1-9]$/.test(k)) return `Digit${k}`;
  return `key:${k}`;
}

function isModifierOnly(id: string): boolean {
  return /^(Shift|Control|Alt|Meta|OS)/.test(id) || id === "CapsLock";
}

export class HellrunGame {
  private lang: HellrunLang;
  private readonly lowPower: boolean;
  private readonly onExit?: () => void;
  private readonly seed: number;
  private screen: HellrunScreen = "title";
  private pausedFrom: HellrunScreen = "play";
  private worldRef: World | null = null;
  private levelIndex = 0;
  private snapshot: Inventory = startInventory();
  private readonly held = new Set<string>();
  private queuedUse = false;
  private queuedSlot = 0;
  private acc = 0;
  private time = 0;
  private screenT = 0;
  private fireSteps = 0;
  private fireAcc = 0;
  private showMap = false;
  private message: { key: MsgKey | "soundOn" | "soundOff"; t: number } | null = null;
  private hint: { kind: NonNullable<UseTarget>["kind"]; t: number } | null = null;
  private bannerT = 0;
  private totals: Totals = { kills: 0, totalKills: 0, items: 0, totalItems: 0, time: 0 };
  private lastStats: LevelStats | null = null;
  private readonly sfx = new Sfx();
  private palette: Palette | null = null;
  private assets: AssetStore | null = null;
  private renderer: Renderer | null = null;
  private readonly assetBase?: string;
  private exitRequested = false;
  private disposed = false;

  constructor(opts: HellrunOptions) {
    this.lang = opts.lang;
    this.lowPower = !!opts.lowPower;
    this.onExit = opts.onExit;
    this.assetBase = opts.assetBase;
    this.seed = opts.seed ?? 1337;
  }

  get wantsExit(): boolean {
    return this.exitRequested;
  }

  /** Current screen (useful for hosts and tests). */
  get currentScreen(): HellrunScreen {
    return this.screen;
  }

  /** The running level simulation (null on the title screen). */
  get world(): World | null {
    return this.worldRef;
  }

  setLang(lang: HellrunLang): void {
    this.lang = lang;
  }

  dispose(): void {
    this.disposed = true;
    this.held.clear();
    this.sfx.dispose();
    this.renderer = null;
  }

  blur(): void {
    this.held.clear();
  }

  // ------------------------------------------------------------------ input

  keyDown(e: { key: string; code: string; shiftKey?: boolean }): boolean {
    if (this.disposed) return false;
    const id = keyId(e);
    if (/^F\d+$/.test(id) || id.startsWith("Meta") || id.startsWith("OS")) return false;
    const repeat = this.held.has(id);
    this.held.add(id);
    this.sfx.unlock();

    if (id === "KeyM" && !repeat) {
      this.sfx.setMuted(!this.sfx.muted);
      this.message = { key: this.sfx.muted ? "soundOff" : "soundOn", t: 0 };
      return true;
    }

    switch (this.screen) {
      case "title":
        if (repeat) return true;
        if (id === "Escape") {
          this.quit();
          return true;
        }
        if (isModifierOnly(id)) return true;
        this.startGame();
        return true;
      case "paused":
        if (repeat) return true;
        if (id === "Escape" || id === "KeyQ") this.quit();
        else if (id === "KeyP" || id === "Enter" || id === "NumpadEnter" || id === "Space") this.resume();
        return true;
      case "complete":
        if (repeat) return true;
        if (id === "Escape" || id === "KeyP") this.pause();
        else if ((id === "Enter" || id === "NumpadEnter" || id === "Space" || id === "KeyE") && this.screenT > 0.6) {
          this.nextLevel();
        }
        return true;
      case "dead":
        if (repeat) return true;
        if (id === "KeyR" || ((id === "Enter" || id === "Space") && this.screenT > 1.2)) this.restartLevel();
        else if (id === "Escape" || id === "KeyP") this.pause();
        return true;
      case "victory":
        if (repeat) return true;
        if (id === "Escape" || id === "KeyQ") this.quit();
        else if ((id === "Enter" || id === "NumpadEnter" || id === "Space") && this.screenT > 1) {
          this.screen = "title";
          this.screenT = 0;
          this.worldRef = null;
        }
        return true;
      case "play": {
        if (CODE_ACTIONS[id] || KEY_ACTIONS[(e.key || "").toLowerCase()]) return true;
        if (repeat) return this.isGameKey(id);
        if (id === "Escape" || id === "KeyP") {
          this.pause();
          return true;
        }
        if (id === "Tab") {
          this.showMap = !this.showMap;
          return true;
        }
        if (id === "KeyE" || id === "Enter" || id === "NumpadEnter") {
          this.queuedUse = true;
          return true;
        }
        const digit = /^(?:Digit|Numpad)([1-5])$/.exec(id);
        if (digit) {
          this.queuedSlot = Number(digit[1]);
          return true;
        }
        return this.isGameKey(id);
      }
    }
    return false;
  }

  keyUp(e: { key: string; code: string }): void {
    const id = keyId(e);
    this.held.delete(id);
    // Shift changes e.key ("W" vs "w"), so also drop any held variant without a code.
    if (!e.code) {
      for (const h of this.held) if (h.toLowerCase() === id.toLowerCase()) this.held.delete(h);
    }
  }

  private isGameKey(id: string): boolean {
    return (
      !!CODE_ACTIONS[id] ||
      /^(Digit|Numpad)[1-5]$/.test(id) ||
      ["KeyE", "Enter", "NumpadEnter", "Tab", "Escape", "KeyP", "KeyM", "KeyR", "KeyQ"].includes(id)
    );
  }

  private buildInput(): InputState {
    const inp = emptyInput();
    for (const id of this.held) {
      const a = CODE_ACTIONS[id] ?? (id.startsWith("key:") ? KEY_ACTIONS[id.slice(4)] : undefined);
      if (a) inp[a] = true;
    }
    return inp;
  }

  // ------------------------------------------------------------------ flow

  private startGame(): void {
    this.totals = { kills: 0, totalKills: 0, items: 0, totalItems: 0, time: 0 };
    this.snapshot = startInventory();
    this.startLevel(0);
  }

  private startLevel(index: number): void {
    this.levelIndex = index;
    this.worldRef = new World(index, this.snapshot, this.seed + index);
    this.screen = "play";
    this.screenT = 0;
    this.acc = 0;
    this.bannerT = 0;
    this.hint = null;
    this.message = null;
    this.queuedUse = false;
    this.queuedSlot = 0;
  }

  private restartLevel(): void {
    const inv = { ...this.snapshot, weapons: this.snapshot.weapons.slice() };
    // a fair restart: full health and a minimum of ammo for the guns you own
    inv.health = Math.max(inv.health, 100);
    inv.bullets = Math.max(inv.bullets, 60);
    if (inv.weapons[3] || inv.weapons[4]) inv.shells = Math.max(inv.shells, 12);
    if (inv.weapons[6]) inv.rockets = Math.max(inv.rockets, 4);
    this.snapshot = inv;
    this.startLevel(this.levelIndex);
  }

  private nextLevel(): void {
    const w = this.worldRef;
    if (!w) return;
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.screen = "victory";
      this.screenT = 0;
      return;
    }
    this.snapshot = w.inventory();
    this.startLevel(this.levelIndex + 1);
  }

  private pause(): void {
    if (this.screen === "paused") return;
    this.pausedFrom = this.screen;
    this.screen = "paused";
    this.held.clear();
  }

  private resume(): void {
    this.screen = this.pausedFrom;
    this.held.clear();
  }

  private quit(): void {
    if (this.exitRequested) return;
    this.exitRequested = true;
    this.held.clear();
    this.sfx.setMuted(true);
    this.onExit?.();
  }

  /** Test / harness helpers. */
  debugStartLevel(index: number, inv?: Inventory): void {
    if (inv) this.snapshot = inv;
    this.startLevel(index);
  }

  // ------------------------------------------------------------------ update

  update(dtMs: number): void {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(250, Number.isFinite(dtMs) ? dtMs : 0)) / 1000;
    this.time += dt;
    this.screenT += dt;
    if (this.message) this.message.t += dt;

    if (this.screen === "title" || this.screen === "victory") {
      this.fireAcc += dt;
      while (this.fireAcc >= 1 / 30) {
        this.fireAcc -= 1 / 30;
        if (this.fireSteps < 4) this.fireSteps++;
      }
      return;
    }
    const w = this.worldRef;
    if (!w || this.screen === "paused" || this.screen === "complete") return;

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.acc -= STEP;
      steps++;
      const inp = this.screen === "play" ? this.buildInput() : emptyInput();
      if (this.screen === "play") {
        inp.use = this.queuedUse;
        inp.slot = this.queuedSlot;
        this.queuedUse = false;
        this.queuedSlot = 0;
      }
      w.tick(inp, STEP);
      this.drainEvents(w);
      if (this.screen === "play") {
        if (w.completed) {
          this.finishLevel(w);
          break;
        }
        if (w.player.dead && w.player.deadT > 1.0) {
          this.screen = "dead";
          this.screenT = 0;
        }
      }
    }
    if (steps >= MAX_STEPS) this.acc = 0;

    if (this.screen === "play") {
      this.bannerT += dt;
      const target = w.player.dead ? null : w.probeUse();
      if (target) {
        if (!this.hint || this.hint.kind !== target.kind) this.hint = { kind: target.kind, t: 0 };
        else this.hint.t += dt;
      } else if (this.hint) {
        this.hint.t = Math.max(this.hint.t, 3.2) + dt;
        if (this.hint.t > 4) this.hint = null;
      }
    }
  }

  private finishLevel(w: World): void {
    const def = LEVELS[this.levelIndex];
    this.lastStats = {
      name: def.name[this.lang],
      levelIndex: this.levelIndex,
      kills: w.kills,
      totalKills: w.totalKills,
      items: w.itemsTaken,
      totalItems: w.totalItems,
      time: w.time,
      par: def.par,
    };
    this.totals.kills += w.kills;
    this.totals.totalKills += w.totalKills;
    this.totals.items += w.itemsTaken;
    this.totals.totalItems += w.totalItems;
    this.totals.time += w.time;
    this.screen = "complete";
    this.screenT = 0;
    this.held.clear();
  }

  private drainEvents(w: World): void {
    if (w.events.length === 0) return;
    const p = w.player;
    for (const ev of w.events) {
      if (ev.type === "msg") {
        this.message = { key: ev.key, t: 0 };
      } else {
        const d = Math.hypot(ev.x - p.x, ev.y - p.y);
        const vol = 1 / (1 + d * 0.22);
        this.sfx.play(ev.name as SoundName, vol);
      }
    }
    w.events.length = 0;
  }

  // ------------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, nowMs: number): void {
    if (this.disposed || w < 8 || h < 8) return;
    if (!this.renderer) {
      this.palette = new Palette();
      this.assets = new AssetStore(this.palette, this.assetBase);
      this.renderer = new Renderer(this.palette, this.assets, this.lowPower);
    }
    const assets = this.assets!;
    const r = this.renderer;
    assets.start();
    const S = Math.max(0.35, Math.min(w / 858, h / 792));
    const hudH = Math.round(Math.max(36, Math.min(110, h * 0.12)));
    const viewH = h - hudH;
    const f: Frame = {
      ctx,
      x,
      y,
      w,
      h,
      viewH,
      hudH,
      S,
      lang: this.lang,
      s: strings(this.lang),
      time: Number.isFinite(nowMs) ? nowMs / 1000 : this.time,
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    r.resize(w, viewH);

    const world = this.worldRef;
    if (this.screen === "title" || this.screen === "victory" || !world) {
      const steps = Math.max(1, this.fireSteps);
      for (let i = 0; i < steps; i++) r.stepFire(this.screen === "victory" ? 36 : 34);
      this.fireSteps = 0;
      r.blit(ctx, x, y, w, h);
      if (this.screen === "victory") drawVictory(f, this.totals);
      else drawTitle(f, assets.total ? (assets.loaded + assets.failed) / assets.total : 0, assets.ready);
      ctx.restore();
      return;
    }

    const alpha = this.screen === "play" || this.screen === "dead" ? Math.min(1, this.acc / STEP) : 1;
    r.renderWorld(world, alpha, this.time);
    if (this.screen === "dead" || (this.screen === "paused" && this.pausedFrom === "dead")) {
      r.tintRed(Math.min(0.7, world.player.deadT * 0.5));
    }
    r.blit(ctx, x, y, w, viewH);
    const p = world.player;
    drawFlashes(f, p.hurt, p.bonus, p.dead);
    drawHud(f, world, assets);

    const s = f.s;
    const keyName = s.keyName[world.level.def.key];
    if (this.screen === "play") {
      if (!p.dead) drawCrosshair(f);
      if (this.showMap) drawMinimap(f, world);
      const def = LEVELS[this.levelIndex];
      const bannerA = this.bannerT < 3.5 ? 1 : 1 - (this.bannerT - 3.5) / 1.2;
      if (bannerA > 0) {
        const title = `${fmt(this.lang, s.levelLabel, { n: this.levelIndex + 1 })} · ${upper(this.lang, def.name[this.lang])}`;
        drawBanner(f, title, fmt(this.lang, s.objective, { key: keyName }), bannerA);
      }
      if (this.hint && this.bannerT > 1) {
        const a = this.hint.t < 3 ? 1 : 1 - (this.hint.t - 3) / 0.8;
        drawHint(f, fmt(this.lang, s.hint[this.hint.kind], { key: keyName }), a);
      }
      if (this.message) {
        const a = this.message.t < 2.2 ? 1 : 1 - (this.message.t - 2.2) / 0.8;
        if (a <= 0) this.message = null;
        else drawMessage(f, fmt(this.lang, s.msg[this.message.key], { key: keyName }), a);
      }
    } else if (this.screen === "dead") {
      const killer = p.killer === "hazard" && world.level.def.liquid === "lava1" ? "lava" : p.killer;
      drawDead(f, killer ? s.killer[killer] : "", this.screenT);
    } else if (this.screen === "complete" && this.lastStats) {
      drawComplete(f, { ...this.lastStats, name: LEVELS[this.levelIndex].name[this.lang] }, this.screenT);
    } else if (this.screen === "paused") {
      if (this.pausedFrom === "dead") drawDead(f, "", 0.5);
      drawPause(f);
    }
    if (this.screen !== "play" && this.message && this.message.t < 1.5) {
      drawMessage(f, fmt(this.lang, s.msg[this.message.key], { key: keyName }), 1);
    }
    ctx.restore();
  }
}
