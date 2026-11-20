// Gameplay constants for HELLRUN. One map cell = 128 "units" (texels), the
// wall height is one cell, sprites use 1 texel = 1/128 cell.

export const UNITS_PER_CELL = 128;

export type EnemyType = "trooper" | "fiend" | "biter" | "orb";
export type ProjectileType = "fireball" | "orbball" | "rocket";
export type EffectType =
  | "puff"
  | "blood"
  | "fireballHit"
  | "orbballHit"
  | "rocketHit"
  | "barrelHit";
export type AmmoType = "bullets" | "shells" | "rockets";
export type KeyColor = "red" | "yellow" | "blue";
export type DecoType = "lamp" | "torch" | "candle" | "column" | "barrel";
export type ItemType =
  | "clip"
  | "ammobox"
  | "shells"
  | "shellbox"
  | "rocket"
  | "rocketbox"
  | "stim"
  | "medkit"
  | "hbonus"
  | "abonus"
  | "armor"
  | "megaarmor"
  | "key"
  | "w_chainsaw"
  | "w_shotgun"
  | "w_supershotgun"
  | "w_chaingun"
  | "w_launcher";

export type SoundName =
  | "pistol"
  | "shotgun"
  | "supershotgun"
  | "chaingun"
  | "punch"
  | "punchHit"
  | "saw"
  | "sawHit"
  | "rocketFire"
  | "pickup"
  | "weaponPickup"
  | "keyPickup"
  | "powerup"
  | "door"
  | "locked"
  | "switch"
  | "hurt"
  | "playerDeath"
  | "enemyAlert"
  | "enemyPain"
  | "enemyDeath"
  | "enemyShot"
  | "fireball"
  | "explode"
  | "bite"
  | "noAmmo"
  | "weaponUp";

export interface EnemyDef {
  hp: number;
  /** cells per second */
  speed: number;
  /** collision half-size in cells */
  radius: number;
  ranged: "hitscan" | "projectile" | null;
  projectile: ProjectileType;
  damage: [number, number];
  melee: [number, number] | null;
  meleeRange: number;
  range: number;
  cooldown: [number, number];
  reaction: number;
  /** total length of the attack animation (s) */
  attackTime: number;
  /** moment within the attack when the shot/bite happens (s) */
  fireAt: number;
  painChance: number;
  painTime: number;
  sight: number;
  deathTime: number;
  floats: boolean;
  /** height of the sprite's centre above the floor in cells (projectile spawn height) */
  eye: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  trooper: {
    hp: 20,
    speed: 1.05,
    radius: 0.16,
    ranged: "hitscan",
    projectile: "fireball",
    damage: [3, 15],
    melee: null,
    meleeRange: 0,
    range: 18,
    cooldown: [1.0, 2.2],
    reaction: 0.55,
    attackTime: 0.75,
    fireAt: 0.29,
    painChance: 0.78,
    painTime: 0.17,
    sight: 22,
    deathTime: 0.72,
    floats: false,
    eye: 0.3,
  },
  fiend: {
    hp: 60,
    speed: 1.15,
    radius: 0.16,
    ranged: "projectile",
    projectile: "fireball",
    damage: [3, 24],
    melee: [3, 24],
    meleeRange: 0.62,
    range: 20,
    cooldown: [1.1, 2.6],
    reaction: 0.5,
    attackTime: 0.63,
    fireAt: 0.46,
    painChance: 0.78,
    painTime: 0.12,
    sight: 22,
    deathTime: 0.85,
    floats: false,
    eye: 0.3,
  },
  biter: {
    hp: 150,
    speed: 2.3,
    radius: 0.23,
    ranged: null,
    projectile: "fireball",
    damage: [4, 40],
    melee: [4, 40],
    meleeRange: 0.66,
    range: 0.66,
    cooldown: [0.55, 0.9],
    reaction: 0.3,
    attackTime: 0.69,
    fireAt: 0.46,
    painChance: 0.7,
    painTime: 0.12,
    sight: 22,
    deathTime: 0.95,
    floats: false,
    eye: 0.3,
  },
  orb: {
    hp: 400,
    speed: 1.0,
    radius: 0.24,
    ranged: "projectile",
    projectile: "orbball",
    damage: [5, 40],
    melee: [10, 40],
    meleeRange: 0.72,
    range: 22,
    cooldown: [1.0, 2.2],
    reaction: 0.5,
    attackTime: 0.43,
    fireAt: 0.29,
    painChance: 0.5,
    painTime: 0.34,
    sight: 24,
    deathTime: 1.15,
    floats: true,
    eye: 0.42,
  },
};

export type WeaponId =
  | "fist"
  | "chainsaw"
  | "pistol"
  | "shotgun"
  | "supershotgun"
  | "chaingun"
  | "launcher";

export interface WeaponDef {
  id: WeaponId;
  /** number key that selects it */
  slot: number;
  ammo: AmmoType | null;
  perShot: number;
  /** seconds between shots; the fire animation is stretched to this length */
  cooldown: number;
  /** moment within the fire animation when the attack happens */
  fireAt: number;
  damage: [number, number];
  pellets: number;
  spread: number;
  melee: boolean;
  range: number;
  noisy: boolean;
  rocket: boolean;
  sound: SoundName;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "fist",
    slot: 1,
    ammo: null,
    perShot: 0,
    cooldown: 0.6,
    fireAt: 0.22,
    damage: [4, 20],
    pellets: 1,
    spread: 0,
    melee: true,
    range: 0.66,
    noisy: false,
    rocket: false,
    sound: "punch",
  },
  {
    id: "chainsaw",
    slot: 1,
    ammo: null,
    perShot: 0,
    cooldown: 0.12,
    fireAt: 0,
    damage: [4, 20],
    pellets: 1,
    spread: 0,
    melee: true,
    range: 0.7,
    noisy: true,
    rocket: false,
    sound: "saw",
  },
  {
    id: "pistol",
    slot: 2,
    ammo: "bullets",
    perShot: 1,
    cooldown: 0.4,
    fireAt: 0.085,
    damage: [5, 15],
    pellets: 1,
    spread: 0.035,
    melee: false,
    range: 32,
    noisy: true,
    rocket: false,
    sound: "pistol",
  },
  {
    id: "shotgun",
    slot: 3,
    ammo: "shells",
    perShot: 1,
    cooldown: 0.95,
    fireAt: 0.065,
    damage: [5, 15],
    pellets: 7,
    spread: 0.09,
    melee: false,
    range: 32,
    noisy: true,
    rocket: false,
    sound: "shotgun",
  },
  {
    id: "supershotgun",
    slot: 3,
    ammo: "shells",
    perShot: 2,
    cooldown: 1.5,
    fireAt: 0.073,
    damage: [5, 15],
    pellets: 20,
    spread: 0.2,
    melee: false,
    range: 32,
    noisy: true,
    rocket: false,
    sound: "supershotgun",
  },
  {
    id: "chaingun",
    slot: 4,
    ammo: "bullets",
    perShot: 1,
    cooldown: 0.115,
    fireAt: 0,
    damage: [5, 15],
    pellets: 1,
    spread: 0.045,
    melee: false,
    range: 32,
    noisy: true,
    rocket: false,
    sound: "chaingun",
  },
  {
    id: "launcher",
    slot: 5,
    ammo: "rockets",
    perShot: 1,
    cooldown: 0.62,
    fireAt: 0.25,
    damage: [20, 160],
    pellets: 1,
    spread: 0,
    melee: false,
    range: 32,
    noisy: true,
    rocket: true,
    sound: "rocketFire",
  },
];

export const WEAPON_INDEX: Record<WeaponId, number> = {
  fist: 0,
  chainsaw: 1,
  pistol: 2,
  shotgun: 3,
  supershotgun: 4,
  chaingun: 5,
  launcher: 6,
};

export const MAX_AMMO: Record<AmmoType, number> = { bullets: 200, shells: 50, rockets: 50 };

export const PROJECTILES: Record<
  ProjectileType,
  { speed: number; radius: number; splash: number; hit: EffectType }
> = {
  fireball: { speed: 3.2, radius: 0.06, splash: 0, hit: "fireballHit" },
  orbball: { speed: 3.0, radius: 0.07, splash: 0, hit: "orbballHit" },
  rocket: { speed: 6.5, radius: 0.08, splash: 1.0, hit: "rocketHit" },
};

export const EFFECT_LIFE: Record<EffectType, number> = {
  puff: 0.34,
  blood: 0.3,
  fireballHit: 0.42,
  orbballHit: 0.42,
  rocketHit: 0.48,
  barrelHit: 0.55,
};

export const DECOS: Record<DecoType, { radius: number; solid: boolean }> = {
  lamp: { radius: 0.13, solid: true },
  torch: { radius: 0.13, solid: true },
  candle: { radius: 0.1, solid: false },
  column: { radius: 0.13, solid: true },
  barrel: { radius: 0.09, solid: true },
};

/** Explosion radius (cells) and maximum damage for rockets and barrels. */
export const SPLASH_RADIUS = 1.0;
export const SPLASH_DAMAGE = 128;
export const BARREL_HP = 20;
