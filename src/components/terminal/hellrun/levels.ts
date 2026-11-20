// Hand-made HELLRUN levels and the ASCII parser.
//
// Legend
//   walls   #  primary wall    %  secondary wall    &  accent wall (crates, temple)
//           D  door            L  locked door (needs the level's key card)
//           X  exit switch (a wall you "use")
//   floor   .  floor           ~  liquid (hurts)     *  ceiling light
//           P  player start
//   enemies z  trooper (hitscan)   f  fiend (fireballs + claws)
//           b  biter (fast melee)  o  orb (floating, fireballs)
//   items   c clip   C box of bullets   s shells   S box of shells   r rocket   R box of rockets
//           h stimpack   H medikit   u health bonus   U armour bonus   a armour   A heavy armour
//           k key card   7 chainsaw   3 shotgun   6 super shotgun   4 chaingun   5 rocket launcher
//   decor   t torch   l lamp   i candle   I tech column   B barrel

import type { DecoType, EnemyType, ItemType, KeyColor } from "./defs";
import { createMap, K_DOOR, K_EMPTY, K_EXIT, K_WALL, type GridMap } from "./map";

/** Wall textures (patch names or composites built by the asset loader). Index = id. */
export const WALL_TEX = [
  "",
  "wall62_1",
  "wall52_1",
  "wall53_1",
  "comp_wall",
  "wood",
  "support2",
  "door9_1",
  "door11_1",
  "door_red",
  "door_yellow",
  "door_blue",
  "exit_off",
  "exit_on",
  "brick",
  "brbrick",
  "mossbrik",
  "brick2",
  "stonew1",
  "hell5_1",
  "hell5_2",
  "redrock",
  "wall22_1",
  "rock",
  "darkrock",
] as const;

/** Floor / ceiling flats. Index = id. */
export const FLAT_TEX = [
  "floor0_1",
  "floor0_3",
  "floor4_1",
  "floor7_1",
  "floor5_1",
  "flat1",
  "flat5",
  "flat5_6",
  "mflr8_1",
  "sflr6_1",
  "ceil5_1",
  "tlite6_1",
  "lava1",
  "nukage1",
] as const;

export type WallTexName = (typeof WALL_TEX)[number];
export type FlatTexName = (typeof FLAT_TEX)[number];

export function wallTexId(name: WallTexName): number {
  return WALL_TEX.indexOf(name);
}
export function flatTexId(name: FlatTexName): number {
  return FLAT_TEX.indexOf(name);
}

/** Flats that ignore lighting. */
export const FULLBRIGHT_FLATS: ReadonlySet<FlatTexName> = new Set<FlatTexName>(["tlite6_1", "lava1"]);
/** Flats that scroll/shimmer. */
export const LIQUID_FLATS: ReadonlySet<FlatTexName> = new Set<FlatTexName>(["lava1", "nukage1"]);

export interface LevelDef {
  name: { tr: string; en: string };
  rows: string[];
  /** radians; 0 = east (+x), PI/2 = south (+y) */
  startAngle: number;
  key: KeyColor;
  /** first entry is the main texture, others are sprinkled in as variants */
  walls: { "#": WallTexName[]; "%": WallTexName[]; "&": WallTexName[] };
  door: WallTexName;
  lockedDoor: WallTexName;
  floor: FlatTexName;
  ceiling: FlatTexName;
  liquid: FlatTexName;
  regions?: { x0: number; y0: number; x1: number; y1: number; floor?: FlatTexName; ceiling?: FlatTexName }[];
  /** wall height in cells (doors are always 1 cell tall, with a lintel above) */
  height: number;
  /** extra darkness (shade levels) */
  ambient: number;
  /** par time in seconds */
  par: number;
}

export const LEVELS: LevelDef[] = [
  {
    name: { tr: "Karakol Kapısı", en: "Outpost Gate" },
    startAngle: 0,
    key: "red",
    walls: { "#": ["wall62_1", "comp_wall", "wall53_1"], "%": ["wall52_1"], "&": ["wood"] },
    door: "door9_1",
    lockedDoor: "door_red",
    floor: "floor0_1",
    ceiling: "ceil5_1",
    liquid: "nukage1",
    regions: [
      { x0: 16, y0: 12, x1: 29, y1: 22, floor: "floor4_1", ceiling: "ceil5_1" },
      { x0: 16, y0: 2, x1: 29, y1: 10, floor: "floor0_3", ceiling: "flat1" },
      { x0: 31, y0: 14, x1: 38, y1: 20, floor: "flat5", ceiling: "ceil5_1" },
    ],
    height: 1.5,
    ambient: 3,
    par: 150,
    rows: [
      "########################################",
      "########################################",
      "################..............##########",
      "################.....f......k.##########",
      "###..........###..I......I....##########",
      "###.3......z.###.......*......##########",
      "###..&&..&&.7###..z......a....##########",
      "###..&&..&&..###..I......I....##########",
      "###.......h..###......z.......##########",
      "###..........###..............##########",
      "###..c.......###....t...t.....##########",
      "###..........#########D#################",
      "###..........###t............t##########",
      "#######D########....z.........##########",
      "#..............#..I.......I...#........#",
      "#....I....I....#.........z....#..z.....#",
      "#...........c..#..............#........#",
      "#P.....*.......D......f.......L......h.X",
      "#............z.#..............#....z...#",
      "#....I....I....#..I.......I...#........#",
      "#.h............#......s.......#........#",
      "#..............#t............t##########",
      "################..............##########",
      "########################################",
    ],
  },
  {
    name: { tr: "Atık Tesisi", en: "Sludge Works" },
    startAngle: -Math.PI / 2,
    key: "yellow",
    walls: { "#": ["brick", "brbrick", "mossbrik", "brick2"], "%": ["stonew1"], "&": ["wood"] },
    door: "door9_1",
    lockedDoor: "door_yellow",
    floor: "mflr8_1",
    ceiling: "flat1",
    liquid: "nukage1",
    regions: [
      { x0: 23, y0: 6, x1: 37, y1: 18, floor: "floor7_1", ceiling: "ceil5_1" },
      { x0: 23, y0: 21, x1: 37, y1: 28, floor: "floor5_1", ceiling: "flat1" },
      { x0: 2, y0: 1, x1: 9, y1: 4, floor: "floor4_1" },
    ],
    height: 1.5,
    ambient: 4,
    par: 210,
    rows: [
      "########################################",
      "##........##############################",
      "##...4..C.##############################",
      "##......b.##############################",
      "##.h......##############################",
      "#####D##################################",
      "##t....f.......f.....t#..b............##",
      "##.........z..........#........~~~~~~~##",
      "##..I.......*.....I...#........~~~k~~~##",
      "##....................D........~~~.~~~##",
      "##.a..................#....z...~~~.~~~##",
      "##~~~~~~~~~~..~~~~~~~~#........~~~.~~~##",
      "##~~~~~~~~~~..~~~~~~~~#...s...........##",
      "##...z................#...b.....f.....##",
      "##..I.......*.....I...#...............##",
      "##....z..........z....#.......B.......##",
      "##....................#..B..........H.##",
      "##c..................s#.6.............##",
      "##t..................t#t.............t##",
      "#####....###############################",
      "##..........############################",
      "##..C.....c.###########t.............t##",
      "##..B.......###########.....z.........##",
      "##.s........###########..I.......I....##",
      "##....................L...............X#",
      "##..........###########....f.....b....##",
      "##....P.....###########..I.......I....##",
      "##..........###########....H.....a....##",
      "#######################t.............t##",
      "########################################",
    ],
  },
  {
    name: { tr: "Cehennem Ağzı", en: "Hellmouth" },
    startAngle: -Math.PI / 2,
    key: "blue",
    walls: { "#": ["hell5_1", "hell5_2", "redrock", "wall22_1"], "%": ["rock", "darkrock"], "&": ["redrock"] },
    door: "door11_1",
    lockedDoor: "door_blue",
    floor: "floor5_1",
    ceiling: "ceil5_1",
    liquid: "lava1",
    regions: [
      { x0: 14, y0: 2, x1: 29, y1: 8, floor: "flat5_6", ceiling: "flat1" },
      { x0: 1, y0: 2, x1: 10, y1: 8, floor: "sflr6_1" },
      { x0: 33, y0: 2, x1: 42, y1: 8, floor: "sflr6_1" },
    ],
    height: 2,
    ambient: 4,
    par: 270,
    rows: [
      "############################################",
      "#####################X######################",
      "#i...k....i###t......*.......t###i...A....i#",
      "#..........###..~~........~~..###..........#",
      "#...o......###..~~...o....~~..###..b....b..#",
      "#.l......l.###................###.l......l.#",
      "#....f.....###..f..........f..###....z.....#",
      "#S.......f.###....l......l....###.C..r...S.#",
      "#t........t###t..............t###t........t#",
      "#####D###############L################D#####",
      "#t...................*....................t#",
      "#......f............................f......#",
      "#...........%%.......b........%%...........#",
      "#...s.......%%................%%...........#",
      "#................................b.........#",
      "#....................H.....................#",
      "#~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~#",
      "#~~~~~~~~..~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~#",
      "#..............z...........................#",
      "#.....B.....................f..............#",
      "#...........%%.......z........%%...........#",
      "#...........%%................%%....s..R...#",
      "#......f...........5.......................#",
      "#..c.....................................c.#",
      "#t........................................t#",
      "###################.....####################",
      "################t..........t################",
      "################...h....a...################",
      "################.c........s.################",
      "################.....P......################",
      "################t..........t################",
      "############################################",
    ],
  },
];

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  y: number;
}
export interface ItemSpawn {
  type: ItemType;
  x: number;
  y: number;
}
export interface DecoSpawn {
  type: DecoType;
  x: number;
  y: number;
}
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  /** skip occlusion tests (cheap, for liquids) */
  open?: boolean;
}

export interface ParsedLevel {
  index: number;
  def: LevelDef;
  map: GridMap;
  startX: number;
  startY: number;
  startAngle: number;
  enemies: EnemySpawn[];
  items: ItemSpawn[];
  decos: DecoSpawn[];
  lights: LightSource[];
}

const ENEMY_CHARS: Record<string, EnemyType> = { z: "trooper", f: "fiend", b: "biter", o: "orb" };
const ITEM_CHARS: Record<string, ItemType> = {
  c: "clip",
  C: "ammobox",
  s: "shells",
  S: "shellbox",
  r: "rocket",
  R: "rocketbox",
  h: "stim",
  H: "medkit",
  u: "hbonus",
  U: "abonus",
  a: "armor",
  A: "megaarmor",
  k: "key",
  "7": "w_chainsaw",
  "3": "w_shotgun",
  "6": "w_supershotgun",
  "4": "w_chaingun",
  "5": "w_launcher",
};
const DECO_CHARS: Record<string, DecoType> = { t: "torch", l: "lamp", i: "candle", I: "column", B: "barrel" };

function cellHash(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return (h >>> 0) % 1000;
}

export function parseLevel(index: number): ParsedLevel {
  const def = LEVELS[index];
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0].length;
  const map = createMap(w, h);
  const enemies: EnemySpawn[] = [];
  const items: ItemSpawn[] = [];
  const decos: DecoSpawn[] = [];
  const lights: LightSource[] = [];
  let startX = 1.5;
  let startY = 1.5;
  const floorId = flatTexId(def.floor);
  const ceilId = flatTexId(def.ceiling);
  const liquidId = flatTexId(def.liquid);
  const lightId = flatTexId("tlite6_1");
  const doorTex = wallTexId(def.door);
  const lockedTex = wallTexId(def.lockedDoor);
  const exitTex = wallTexId("exit_off");

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? "#";
      const i = y * w + x;
      map.floor[i] = floorId;
      map.ceil[i] = ceilId;
      if (ch === "#" || ch === "%" || ch === "&") {
        const list = def.walls[ch];
        let tex = list[0];
        if (list.length > 1) {
          const hv = cellHash(x, y);
          if (hv < 160) tex = list[1 + (hv % (list.length - 1))];
        }
        map.kind[i] = K_WALL;
        map.tex[i] = wallTexId(tex);
        continue;
      }
      if (ch === "D" || ch === "L") {
        map.kind[i] = K_DOOR;
        map.doorAt[i] = map.doors.length;
        map.doors.push({
          x,
          y,
          vertical: false,
          locked: ch === "L",
          open: 0,
          moving: 0,
          tex: ch === "L" ? lockedTex : doorTex,
          lintel: 0,
        });
        continue;
      }
      if (ch === "X") {
        map.kind[i] = K_EXIT;
        map.tex[i] = exitTex;
        lights.push({ x: x + 0.5, y: y + 0.5, radius: 2.2, intensity: 5 });
        continue;
      }
      map.kind[i] = K_EMPTY;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (ch === "P") {
        startX = cx;
        startY = cy;
      } else if (ch === "~") {
        map.floor[i] = liquidId;
        map.hazard[i] = 1;
        lights.push({ x: cx, y: cy, radius: 1.8, intensity: 4.5, open: true });
      } else if (ch === "*") {
        map.ceil[i] = lightId;
        lights.push({ x: cx, y: cy, radius: 5, intensity: 11 });
      } else if (ENEMY_CHARS[ch]) {
        enemies.push({ type: ENEMY_CHARS[ch], x: cx, y: cy });
      } else if (ITEM_CHARS[ch]) {
        items.push({ type: ITEM_CHARS[ch], x: cx, y: cy });
      } else if (DECO_CHARS[ch]) {
        const type = DECO_CHARS[ch];
        decos.push({ type, x: cx, y: cy });
        if (type === "torch") lights.push({ x: cx, y: cy, radius: 4.2, intensity: 10 });
        else if (type === "lamp") lights.push({ x: cx, y: cy, radius: 4.5, intensity: 10 });
        else if (type === "candle") lights.push({ x: cx, y: cy, radius: 2.2, intensity: 5 });
      }
    }
  }

  // Region overrides for floors / ceilings (lights and liquids keep theirs).
  for (const r of def.regions ?? []) {
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = y * w + x;
        if (r.floor && map.floor[i] !== liquidId) map.floor[i] = flatTexId(r.floor);
        if (r.ceiling && map.ceil[i] !== lightId) map.ceil[i] = flatTexId(r.ceiling);
      }
    }
  }

  // Door orientation: walls north and south => the panel spans x = const.
  for (const door of map.doors) {
    const n = door.y > 0 ? map.kind[(door.y - 1) * w + door.x] : K_WALL;
    const s = door.y < h - 1 ? map.kind[(door.y + 1) * w + door.x] : K_WALL;
    door.vertical = n !== K_EMPTY && s !== K_EMPTY;
    // the wall beside the door frame continues above the opening
    const side = door.vertical ? [door.x, door.y - 1] : [door.x - 1, door.y];
    const si = side[1] * w + side[0];
    door.lintel = map.kind[si] === K_WALL ? map.tex[si] : wallTexId(def.walls["#"][0]);
  }

  return { index, def, map, startX, startY, startAngle: def.startAngle, enemies, items, decos, lights };
}
