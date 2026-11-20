// Full-resolution HUD, overlays and menu screens for HELLRUN (Canvas 2D text).

import type { AssetStore } from "./assets";
import { WEAPONS, type KeyColor } from "./defs";
import { fmt, type HellrunLang, type Strings } from "./i18n";
import { K_DOOR, K_EMPTY, K_EXIT } from "./map";
import type { World } from "./world";

export const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const C = {
  amber: "#f4d35e",
  gold: "#f6c27a",
  tan: "#b8894f",
  dim: "#8f7b6a",
  red: "#e0583c",
  orange: "#f08a3c",
  bg: "#120d0b",
  panel: "#1b1512",
  line: "#3a2a1c",
  text: "#efe2cc",
};

const KEY_COLORS: Record<KeyColor, string> = { red: "#e0402c", yellow: "#f2cf3a", blue: "#4a6cf0" };

export interface Frame {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  viewH: number;
  hudH: number;
  /** UI scale (1 at 858x792) */
  S: number;
  lang: HellrunLang;
  s: Strings;
  time: number;
}

function font(px: number, weight = 700): string {
  return `${weight} ${Math.max(7, Math.round(px))}px ${FONT}`;
}

function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign = "left",
  shadow = true,
): void {
  ctx.textAlign = align;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Shrinks the font until the string fits `maxW`. */
function fitFont(ctx: CanvasRenderingContext2D, str: string, px: number, maxW: number, weight = 700): number {
  let size = px;
  ctx.font = font(size, weight);
  while (size > 7 && ctx.measureText(str).width > maxW) {
    size -= 1;
    ctx.font = font(size, weight);
  }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function panel(f: Frame, x: number, y: number, w: number, h: number, alpha = 0.82): void {
  const { ctx, S } = f;
  roundRect(ctx, x, y, w, h, 6 * S);
  ctx.fillStyle = `rgba(18,13,11,${alpha})`;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * S);
  ctx.strokeStyle = "rgba(184,137,79,0.65)";
  ctx.stroke();
}

function drawIcon(f: Frame, img: HTMLImageElement | null, cx: number, cy: number, maxW: number, maxH: number): void {
  if (!img) return;
  const k = Math.max(1, Math.floor(Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)));
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  f.ctx.imageSmoothingEnabled = false;
  f.ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}

// ------------------------------------------------------------------ status bar

export function drawHud(f: Frame, world: World, assets: AssetStore): void {
  const { ctx, x, w, S, s, lang } = f;
  const y = f.y + f.viewH;
  const h = f.hudH;
  const p = world.player;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#241912");
  g.addColorStop(1, "#0e0a08");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#6b4a2a";
  ctx.fillRect(x, y, w, Math.max(1, Math.round(2 * S)));
  ctx.fillStyle = "rgba(244,211,94,0.18)";
  ctx.fillRect(x, y + Math.max(1, Math.round(2 * S)), w, 1);

  const cells = [0.12, 0.15, 0.14, 0.23, 0.08, 0.15, 0.13];
  const xs: number[] = [];
  let acc = x;
  for (const c of cells) {
    xs.push(acc);
    acc += c * w;
  }
  const cw = (i: number) => cells[i] * w;
  ctx.fillStyle = C.line;
  for (let i = 1; i < xs.length; i++) ctx.fillRect(Math.round(xs[i]), y + 6 * S, 1, h - 12 * S);

  const labelY = y + h * 0.27;
  const valueY = y + h * 0.74;
  const labelPx = Math.max(8, h * 0.17);
  const bigPx = Math.min(h * 0.46, 46 * S + 6);
  ctx.textBaseline = "middle";

  const label = (i: number, str: string) => {
    fitFont(ctx, str, labelPx, cw(i) - 8 * S, 700);
    text(ctx, str, xs[i] + cw(i) / 2, labelY, C.tan, "center", false);
  };
  const big = (i: number, str: string, color: string) => {
    fitFont(ctx, str, bigPx, cw(i) - 8 * S, 800);
    text(ctx, str, xs[i] + cw(i) / 2, valueY, color, "center");
  };

  // ammo for the current weapon
  const wdef = WEAPONS[p.weapon];
  label(0, s.hud.ammo);
  big(0, wdef.ammo ? String(p.ammo[wdef.ammo]) : "--", wdef.ammo && p.ammo[wdef.ammo] === 0 ? C.red : C.amber);

  // health
  label(1, s.hud.health);
  const low = p.health < 25;
  const hc = low ? (Math.floor(f.time * 4) % 2 === 0 ? C.red : C.orange) : p.health <= 50 ? C.orange : C.amber;
  big(1, `${p.health}%`, hc);

  // armour
  label(2, s.hud.armor);
  big(2, `${p.armor}%`, p.armor > 0 ? (p.armorClass >= 2 ? "#9fb4ff" : "#9fe08a") : C.dim);

  // arms: slots 1..5 + weapon name
  label(3, s.hud.arms);
  {
    const slots = [1, 2, 3, 4, 5];
    const bw = Math.min(cw(3) / 6.2, h * 0.3);
    const totalW = bw * slots.length + (slots.length - 1) * bw * 0.18;
    let sx = xs[3] + (cw(3) - totalW) / 2;
    const sy = y + h * 0.43;
    ctx.font = font(bw * 0.62, 800);
    for (const slot of slots) {
      const owned = WEAPONS.some((wd, i) => wd.slot === slot && p.weapons[i]);
      const current = WEAPONS[p.pendingWeapon].slot === slot;
      if (current) {
        ctx.fillStyle = "rgba(244,211,94,0.22)";
        ctx.fillRect(sx, sy, bw, bw * 0.9);
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = Math.max(1, S);
        ctx.strokeRect(sx + 0.5, sy + 0.5, bw - 1, bw * 0.9 - 1);
      }
      text(ctx, String(slot), sx + bw / 2, sy + bw * 0.47, owned ? (current ? C.amber : C.gold) : "#4a3a2c", "center", false);
      sx += bw * 1.18;
    }
    const name = s.weapon[WEAPONS[p.pendingWeapon].id];
    fitFont(ctx, name, h * 0.15, cw(3) - 10 * S, 700);
    text(ctx, name, xs[3] + cw(3) / 2, y + h * 0.84, C.text, "center", false);
  }

  // key card
  label(4, s.hud.key);
  {
    const key = world.level.def.key;
    const cx = xs[4] + cw(4) / 2;
    const cy = y + h * 0.66;
    if (p.hasKey) {
      const img = assets.image("sprite", `${key[0]}keya0`);
      if (img) drawIcon(f, img, cx, cy, cw(4) * 0.8, h * 0.5);
      else {
        ctx.fillStyle = KEY_COLORS[key];
        ctx.fillRect(cx - h * 0.1, cy - h * 0.16, h * 0.2, h * 0.32);
      }
    } else {
      ctx.strokeStyle = "#4a3a2c";
      ctx.lineWidth = Math.max(1, S);
      ctx.strokeRect(cx - h * 0.1 + 0.5, cy - h * 0.16 + 0.5, h * 0.2, h * 0.32);
    }
  }

  // ammo table
  {
    const rows: [string, number, number, boolean][] = [
      [s.hud.bullets, p.ammo.bullets, 200, wdef.ammo === "bullets"],
      [s.hud.shells, p.ammo.shells, 50, wdef.ammo === "shells"],
      [s.hud.rockets, p.ammo.rockets, 50, wdef.ammo === "rockets"],
    ];
    const rowH = h / 4;
    const px = Math.min(rowH * 0.62, 15 * S + 3);
    ctx.font = font(px, 700);
    const lx = xs[5] + 8 * S;
    const rx = xs[5] + cw(5) - 8 * S;
    rows.forEach(([name, v, max, cur], i) => {
      const ry = y + rowH * (i + 1) - rowH * 0.1;
      text(ctx, name, lx, ry, cur ? C.amber : C.dim, "left", false);
      text(ctx, `${v}/${max}`, rx, ry, cur ? C.amber : C.gold, "right", false);
    });
  }

  // level + kills
  {
    const i = 6;
    const cx = xs[i] + cw(i) / 2;
    const l1 = fmt(lang, s.levelLabel, { n: world.levelIndex + 1 });
    fitFont(ctx, l1, h * 0.19, cw(i) - 8 * S, 800);
    text(ctx, l1, cx, y + h * 0.3, C.gold, "center", false);
    fitFont(ctx, s.hud.kills, labelPx, cw(i) - 8 * S, 700);
    text(ctx, s.hud.kills, cx, y + h * 0.55, C.tan, "center", false);
    const k = `${world.kills}/${world.totalKills}`;
    fitFont(ctx, k, h * 0.22, cw(i) - 8 * S, 800);
    text(ctx, k, cx, y + h * 0.8, world.kills === world.totalKills ? "#9fe08a" : C.amber, "center", false);
  }
  ctx.textBaseline = "alphabetic";
}

// ------------------------------------------------------------------ in-game overlays

export function drawFlashes(f: Frame, hurt: number, bonus: number, dead: boolean): void {
  const { ctx, x, y, w, viewH } = f;
  if (hurt > 0.01 && !dead) {
    ctx.fillStyle = `rgba(200,20,10,${Math.min(0.5, hurt * 0.45)})`;
    ctx.fillRect(x, y, w, viewH);
  }
  if (bonus > 0.01) {
    ctx.fillStyle = `rgba(255,214,90,${Math.min(0.22, bonus * 0.2)})`;
    ctx.fillRect(x, y, w, viewH);
  }
}

export function drawCrosshair(f: Frame): void {
  const { ctx, x, y, w, viewH, S } = f;
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + viewH / 2);
  const a = Math.max(2, Math.round(4 * S));
  ctx.fillStyle = "rgba(244,211,94,0.55)";
  ctx.fillRect(cx - a - 1, cy, a, 1);
  ctx.fillRect(cx + 2, cy, a, 1);
  ctx.fillRect(cx, cy - a - 1, 1, a);
  ctx.fillRect(cx, cy + 2, 1, a);
}

/** Small one-line contextual hint near the bottom of the view. */
export function drawHint(f: Frame, str: string, alpha: number): void {
  if (alpha <= 0.01 || !str) return;
  const { ctx, x, y, w, viewH, S } = f;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  const px = fitFont(ctx, str, 16 * S + 2, w * 0.8, 700);
  const tw = ctx.measureText(str).width;
  const padX = 12 * S;
  const bh = px * 1.7;
  const by = y + viewH - bh - 12 * S;
  roundRect(ctx, x + w / 2 - tw / 2 - padX, by, tw + padX * 2, bh, bh / 2);
  ctx.fillStyle = "rgba(14,10,8,0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(244,211,94,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  text(ctx, str, x + w / 2, by + bh / 2 + 1, C.amber, "center", false);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

/** Pickup / event message, top-left. */
export function drawMessage(f: Frame, str: string, alpha: number): void {
  if (alpha <= 0.01 || !str) return;
  const { ctx, x, y, w, S } = f;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  fitFont(ctx, str, 15 * S + 2, w * 0.7, 700);
  ctx.textBaseline = "top";
  text(ctx, str, x + 12 * S, y + 10 * S, C.gold, "left", true);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

/** Level title + objective banner shown when a level starts. */
export function drawBanner(f: Frame, title: string, sub: string, alpha: number): void {
  if (alpha <= 0.01) return;
  const { ctx, x, y, w, viewH, S } = f;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  const cy = y + viewH * 0.2;
  const tpx = fitFont(ctx, title, 30 * S + 4, w * 0.86, 800);
  ctx.textBaseline = "middle";
  text(ctx, title, x + w / 2, cy, C.amber, "center");
  fitFont(ctx, sub, 15 * S + 2, w * 0.86, 600);
  text(ctx, sub, x + w / 2, cy + tpx * 1.05, C.text, "center");
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

export function drawMinimap(f: Frame, world: World): void {
  const { ctx, x, y, w, viewH, S } = f;
  const m = world.map;
  const size = Math.min(w * 0.4, viewH * 0.46);
  const cell = Math.max(2, Math.floor(size / Math.max(m.w, m.h)));
  const mw = cell * m.w;
  const mh = cell * m.h;
  const ox = Math.round(x + w - mw - 10 * S);
  const oy = Math.round(y + 10 * S);
  ctx.fillStyle = "rgba(10,7,5,0.78)";
  ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
  ctx.strokeStyle = "rgba(184,137,79,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 3.5, oy - 3.5, mw + 7, mh + 7);
  const keyColor = KEY_COLORS[world.level.def.key];
  for (let cy = 0; cy < m.h; cy++) {
    for (let cx = 0; cx < m.w; cx++) {
      const i = cy * m.w + cx;
      if (!world.seen[i]) continue;
      const k = m.kind[i];
      let col: string;
      if (k === K_EMPTY) col = m.hazard[i] ? "#5a3a12" : "#2e241c";
      else if (k === K_DOOR) col = m.doors[m.doorAt[i]].locked ? keyColor : "#f6c27a";
      else if (k === K_EXIT) col = "#6fd68d";
      else col = "#9b7448";
      ctx.fillStyle = col;
      ctx.fillRect(ox + cx * cell, oy + cy * cell, cell, cell);
    }
  }
  // key card if spotted
  for (const it of world.items) {
    if (it.type !== "key" || it.taken) continue;
    if (!world.seen[Math.floor(it.y) * m.w + Math.floor(it.x)]) continue;
    ctx.fillStyle = keyColor;
    ctx.fillRect(ox + it.x * cell - cell * 0.4, oy + it.y * cell - cell * 0.4, cell * 0.8, cell * 0.8);
  }
  // player arrow
  const p = world.player;
  const px = ox + p.x * cell;
  const py = oy + p.y * cell;
  const r = Math.max(3, cell * 0.9);
  ctx.fillStyle = C.amber;
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(p.angle) * r * 1.3, py + Math.sin(p.angle) * r * 1.3);
  ctx.lineTo(px + Math.cos(p.angle + 2.5) * r, py + Math.sin(p.angle + 2.5) * r);
  ctx.lineTo(px + Math.cos(p.angle - 2.5) * r, py + Math.sin(p.angle - 2.5) * r);
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------------ menu screens

function controlsGrid(f: Frame, cx: number, top: number, width: number, rowH: number): number {
  const { ctx, s, S } = f;
  const half = Math.ceil(s.controls.length / 2);
  const colW = width / 2;
  const px = Math.min(rowH * 0.55, 16 * S + 2);
  s.controls.forEach(([k, v], i) => {
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const bx = cx - width / 2 + col * colW + 14 * S;
    const by = top + row * rowH + rowH / 2;
    ctx.font = font(px, 800);
    ctx.textBaseline = "middle";
    text(ctx, k, bx, by, C.amber, "left", false);
    ctx.font = font(px, 500);
    text(ctx, v, bx + colW * 0.46, by, C.text, "left", false);
  });
  ctx.textBaseline = "alphabetic";
  return top + half * rowH;
}

export function drawTitle(f: Frame, progress: number, ready: boolean): void {
  const { ctx, x, y, w, h, S, s } = f;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(8,4,3,0.92)");
  g.addColorStop(0.55, "rgba(8,4,3,0.55)");
  g.addColorStop(1, "rgba(8,4,3,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // logo
  const logoPx = Math.min(h * 0.14, w * 0.17);
  ctx.font = font(logoPx, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ly = y + h * 0.15;
  ctx.fillStyle = "#3a0a04";
  ctx.fillText("HELLRUN", x + w / 2 + 4 * S, ly + 5 * S);
  const lg = ctx.createLinearGradient(0, ly - logoPx / 2, 0, ly + logoPx / 2);
  lg.addColorStop(0, "#fff2a8");
  lg.addColorStop(0.45, "#f4b23e");
  lg.addColorStop(1, "#c8361c");
  ctx.fillStyle = lg;
  ctx.fillText("HELLRUN", x + w / 2, ly);
  ctx.strokeStyle = "rgba(60,10,4,0.8)";
  ctx.lineWidth = Math.max(1, 1.5 * S);
  ctx.strokeText("HELLRUN", x + w / 2, ly);

  fitFont(ctx, s.tagline, 18 * S + 2, w * 0.9, 600);
  text(ctx, s.tagline, x + w / 2, y + h * 0.255, C.gold, "center");

  // controls
  const boxW = Math.min(w * 0.86, 640 * S + 40);
  const rowH = Math.max(14, 30 * S);
  const boxTop = y + h * 0.31;
  const boxH = rowH * 5 + 46 * S;
  panel(f, x + w / 2 - boxW / 2, boxTop, boxW, boxH, 0.78);
  ctx.font = font(13 * S + 2, 800);
  ctx.textBaseline = "middle";
  text(ctx, s.controlsTitle, x + w / 2, boxTop + 18 * S, C.tan, "center", false);
  controlsGrid(f, x + w / 2, boxTop + 34 * S, boxW, rowH);

  // press any key
  const blink = Math.floor(f.time * 1.6) % 2 === 0;
  const py = boxTop + boxH + 44 * S;
  if (blink) {
    fitFont(ctx, s.pressKey, 22 * S + 3, w * 0.9, 800);
    ctx.textBaseline = "middle";
    text(ctx, s.pressKey, x + w / 2, py, C.amber, "center");
  }
  if (!ready) {
    ctx.font = font(12 * S + 2, 500);
    text(ctx, fmt(f.lang, s.loading, { p: Math.round(progress * 100) }), x + w / 2, py + 30 * S, C.dim, "center");
  }
  // footer
  ctx.font = font(11 * S + 2, 500);
  ctx.textBaseline = "alphabetic";
  text(ctx, s.credit, x + w / 2, y + h - 12 * S, "#e9d7b6", "center");
  text(ctx, s.escQuit, x + 12 * S, y + h - 12 * S, C.dim, "left");
}

export function drawPause(f: Frame): void {
  const { ctx, x, y, w, h, S, s } = f;
  ctx.fillStyle = "rgba(10,6,4,0.72)";
  ctx.fillRect(x, y, w, h);
  const boxW = Math.min(w * 0.88, 640 * S + 40);
  const rowH = Math.max(14, 30 * S);
  const boxH = rowH * 5 + 190 * S;
  const top = y + (h - boxH) / 2;
  panel(f, x + w / 2 - boxW / 2, top, boxW, boxH, 0.9);
  ctx.textBaseline = "middle";
  fitFont(ctx, s.paused, 34 * S + 4, boxW * 0.9, 900);
  text(ctx, s.paused, x + w / 2, top + 36 * S, C.amber, "center");
  const after = controlsGrid(f, x + w / 2, top + 66 * S, boxW, rowH);
  ctx.font = font(17 * S + 2, 800);
  text(ctx, s.resume, x + w / 2, after + 30 * S, C.gold, "center", false);
  text(ctx, s.quit, x + w / 2, after + 58 * S, C.red, "center", false);
  ctx.font = font(11 * S + 2, 500);
  text(ctx, s.credit, x + w / 2, top + boxH - 16 * S, C.dim, "center", false);
  ctx.textBaseline = "alphabetic";
}

export interface LevelStats {
  name: string;
  levelIndex: number;
  kills: number;
  totalKills: number;
  items: number;
  totalItems: number;
  time: number;
  par: number;
}

export function formatTime(t: number): string {
  const sec = Math.max(0, Math.floor(t));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function drawComplete(f: Frame, st: LevelStats, t: number): void {
  const { ctx, x, y, w, h, S, s, lang } = f;
  ctx.fillStyle = "rgba(10,6,4,0.62)";
  ctx.fillRect(x, y, w, h);
  const boxW = Math.min(w * 0.8, 520 * S + 40);
  const boxH = 300 * S + 40;
  const top = y + (h - boxH) / 2 - f.hudH / 2;
  panel(f, x + w / 2 - boxW / 2, top, boxW, boxH, 0.9);
  ctx.textBaseline = "middle";
  fitFont(ctx, s.complete, 30 * S + 4, boxW * 0.9, 900);
  text(ctx, s.complete, x + w / 2, top + 40 * S, C.amber, "center");
  ctx.font = font(15 * S + 2, 600);
  text(ctx, `${fmt(lang, s.levelLabel, { n: st.levelIndex + 1 })} · ${st.name}`, x + w / 2, top + 72 * S, C.gold, "center", false);
  const k = (v: number, delay: number) => Math.round(v * Math.max(0, Math.min(1, (t - delay) / 0.6)));
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 100);
  const rows: [string, string][] = [
    [s.stats.kills, `${k(st.kills, 0.2)}/${st.totalKills}   ${k(pct(st.kills, st.totalKills), 0.2)}%`],
    [s.stats.items, `${k(st.items, 0.7)}/${st.totalItems}   ${k(pct(st.items, st.totalItems), 0.7)}%`],
    [s.stats.time, formatTime(k(st.time, 1.2))],
    [s.stats.par, formatTime(st.par)],
  ];
  const lx = x + w / 2 - boxW * 0.36;
  const rx = x + w / 2 + boxW * 0.36;
  rows.forEach(([a, b], i) => {
    const ry = top + (116 + i * 36) * S;
    ctx.font = font(19 * S + 2, 700);
    text(ctx, a, lx, ry, C.tan, "left", false);
    ctx.font = font(19 * S + 2, 800);
    text(ctx, b, rx, ry, C.text, "right", false);
  });
  if (t > 0.6 && Math.floor(f.time * 1.6) % 2 === 0) {
    ctx.font = font(16 * S + 2, 800);
    text(ctx, s.continueKey, x + w / 2, top + boxH - 28 * S, C.amber, "center", false);
  }
  ctx.textBaseline = "alphabetic";
}

export function drawDead(f: Frame, killer: string, t: number): void {
  const { ctx, x, y, w, viewH, S, s, lang } = f;
  const a = Math.min(1, t / 0.8);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textBaseline = "middle";
  const cy = y + viewH * 0.4;
  fitFont(ctx, s.died, 56 * S + 6, w * 0.9, 900);
  text(ctx, s.died, x + w / 2, cy, "#ff4a2a", "center");
  if (killer) {
    ctx.font = font(16 * S + 2, 600);
    text(ctx, fmt(lang, s.killedBy, { name: killer }), x + w / 2, cy + 46 * S, C.text, "center");
  }
  if (t > 0.8) {
    ctx.font = font(20 * S + 2, 800);
    text(ctx, s.restart, x + w / 2, cy + 92 * S, C.amber, "center");
    ctx.font = font(14 * S + 2, 600);
    text(ctx, s.deadEsc, x + w / 2, cy + 124 * S, C.dim, "center");
  }
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

export interface Totals {
  kills: number;
  totalKills: number;
  items: number;
  totalItems: number;
  time: number;
}

export function drawVictory(f: Frame, tot: Totals): void {
  const { ctx, x, y, w, h, S, s } = f;
  ctx.fillStyle = "rgba(8,4,3,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.textBaseline = "middle";
  const cy = y + h * 0.3;
  fitFont(ctx, s.victory, 44 * S + 6, w * 0.9, 900);
  text(ctx, s.victory, x + w / 2, cy, C.amber, "center");
  ctx.font = font(17 * S + 2, 600);
  text(ctx, s.victorySub, x + w / 2, cy + 48 * S, C.gold, "center");
  const rows: [string, string][] = [
    [s.stats.kills, `${tot.kills}/${tot.totalKills}`],
    [s.stats.items, `${tot.items}/${tot.totalItems}`],
    [s.totalTime, formatTime(tot.time)],
  ];
  const boxW = Math.min(w * 0.7, 440 * S + 40);
  panel(f, x + w / 2 - boxW / 2, cy + 80 * S, boxW, 140 * S, 0.8);
  rows.forEach(([a, b], i) => {
    const ry = cy + (112 + i * 36) * S;
    ctx.font = font(18 * S + 2, 700);
    text(ctx, a, x + w / 2 - boxW * 0.4, ry, C.tan, "left", false);
    ctx.font = font(18 * S + 2, 800);
    text(ctx, b, x + w / 2 + boxW * 0.4, ry, C.text, "right", false);
  });
  if (Math.floor(f.time * 1.6) % 2 === 0) {
    fitFont(ctx, s.playAgain, 17 * S + 2, w * 0.92, 800);
    text(ctx, s.playAgain, x + w / 2, cy + 270 * S, C.amber, "center");
  }
  ctx.font = font(11 * S + 2, 500);
  ctx.textBaseline = "alphabetic";
  text(ctx, s.credit, x + w / 2, y + h - 12 * S, "#e9d7b6", "center");
}
