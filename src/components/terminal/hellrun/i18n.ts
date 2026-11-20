// Bilingual (Turkish / English) UI strings for HELLRUN.

import type { EnemyType, KeyColor, WeaponId } from "./defs";
import type { MsgKey } from "./world";

export type HellrunLang = "tr" | "en";

export interface Strings {
  tagline: string;
  pressKey: string;
  loading: string;
  credit: string;
  escQuit: string;
  controlsTitle: string;
  controls: [string, string][];
  objective: string;
  keyName: Record<KeyColor, string>;
  hint: { door: string; locked: string; lockedOpen: string; exit: string };
  msg: Record<MsgKey, string> & { soundOn: string; soundOff: string };
  hud: {
    ammo: string;
    health: string;
    armor: string;
    arms: string;
    key: string;
    level: string;
    kills: string;
    bullets: string;
    shells: string;
    rockets: string;
  };
  weapon: Record<WeaponId, string>;
  levelLabel: string;
  complete: string;
  stats: { kills: string; items: string; time: string; par: string };
  continueKey: string;
  died: string;
  killedBy: string;
  killer: Record<EnemyType | "self" | "hazard" | "lava", string>;
  restart: string;
  deadEsc: string;
  victory: string;
  victorySub: string;
  totalTime: string;
  playAgain: string;
  paused: string;
  resume: string;
  quit: string;
}

const EN: Strings = {
  tagline: "Three levels. One way out.",
  pressKey: "PRESS ANY KEY TO START",
  loading: "loading art {p}%",
  credit: "Art: Freedoom project — BSD 3-Clause",
  escQuit: "Esc: quit",
  controlsTitle: "CONTROLS",
  controls: [
    ["W S  ↑ ↓", "move"],
    ["A D", "strafe"],
    ["← →", "turn"],
    ["Shift", "run"],
    ["Space / Ctrl", "fire (hold)"],
    ["E / Enter", "open / use"],
    ["1 – 5", "weapons"],
    ["Tab", "map"],
    ["M", "sound on/off"],
    ["Esc / P", "pause"],
  ],
  objective: "Find the {key} key card, then hit the exit switch",
  keyName: { red: "red", yellow: "yellow", blue: "blue" },
  hint: {
    door: "E: open door",
    locked: "Locked — find the {key} key card",
    lockedOpen: "E: unlock with the {key} key card",
    exit: "E: flip the exit switch",
  },
  msg: {
    clip: "Picked up a clip.",
    ammobox: "Picked up a box of bullets.",
    shells: "Picked up 4 shotgun shells.",
    shellbox: "Picked up a box of shells.",
    rocket: "Picked up a rocket.",
    rocketbox: "Picked up a box of rockets.",
    stim: "Picked up a stimpack.",
    medkit: "Picked up a medikit.",
    hbonus: "Health bonus.",
    abonus: "Armor bonus.",
    armor: "Picked up the armor.",
    megaarmor: "Picked up the heavy armor!",
    key: "Picked up the {key} key card.",
    w_chainsaw: "A chainsaw! Find some meat!",
    w_shotgun: "You got the shotgun!",
    w_supershotgun: "You got the super shotgun!",
    w_chaingun: "You got the chaingun!",
    w_launcher: "You got the rocket launcher!",
    needKey: "You need the {key} key card for this door.",
    noAmmo: "Out of ammo!",
    exitOn: "Exit switch activated!",
    chainsawFound: "A chainsaw!",
    soundOn: "Sound on",
    soundOff: "Sound off",
  },
  hud: {
    ammo: "AMMO",
    health: "HEALTH",
    armor: "ARMOR",
    arms: "ARMS",
    key: "KEY",
    level: "LEVEL",
    kills: "KILLS",
    bullets: "BULL",
    shells: "SHEL",
    rockets: "RCKT",
  },
  weapon: {
    fist: "FIST",
    chainsaw: "CHAINSAW",
    pistol: "PISTOL",
    shotgun: "SHOTGUN",
    supershotgun: "SUPER SHOTGUN",
    chaingun: "CHAINGUN",
    launcher: "LAUNCHER",
  },
  levelLabel: "LEVEL {n}",
  complete: "LEVEL COMPLETE",
  stats: { kills: "Kills", items: "Items", time: "Time", par: "Par" },
  continueKey: "Enter / Space: continue",
  died: "YOU DIED",
  killedBy: "Killed by: {name}",
  killer: {
    trooper: "Zombie Trooper",
    fiend: "Fire Fiend",
    biter: "Biter",
    orb: "Eye Orb",
    self: "your own blast",
    hazard: "toxic sludge",
    lava: "lava",
  },
  restart: "R: restart level",
  deadEsc: "Esc: menu",
  victory: "YOU ESCAPED HELL",
  victorySub: "All three levels cleared.",
  totalTime: "Total time",
  playAgain: "Enter: play again   ·   Esc: quit",
  paused: "PAUSED",
  resume: "P / Enter: resume",
  quit: "Esc again / Q: quit",
};

const TR: Strings = {
  tagline: "Üç bölüm. Tek çıkış.",
  pressKey: "BAŞLAMAK İÇİN BİR TUŞA BAS",
  loading: "grafikler yükleniyor %{p}",
  credit: "Grafikler: Freedoom projesi — BSD 3-Clause",
  escQuit: "Esc: çıkış",
  controlsTitle: "KONTROLLER",
  controls: [
    ["W S  ↑ ↓", "ileri / geri"],
    ["A D", "yana kay"],
    ["← →", "dön"],
    ["Shift", "koş"],
    ["Boşluk / Ctrl", "ateş (basılı tut)"],
    ["E / Enter", "aç / kullan"],
    ["1 – 5", "silahlar"],
    ["Tab", "harita"],
    ["M", "ses aç/kapa"],
    ["Esc / P", "duraklat"],
  ],
  objective: "{Key} anahtar kartını bul, sonra çıkış şalterine bas",
  keyName: { red: "kırmızı", yellow: "sarı", blue: "mavi" },
  hint: {
    door: "E: kapıyı aç",
    locked: "Kilitli — {key} anahtar kartını bul",
    lockedOpen: "E: {key} kartla kilidi aç",
    exit: "E: çıkış şalterini çevir",
  },
  msg: {
    clip: "Şarjör alındı.",
    ammobox: "Mermi kutusu alındı.",
    shells: "4 fişek alındı.",
    shellbox: "Fişek kutusu alındı.",
    rocket: "Roket alındı.",
    rocketbox: "Roket kutusu alındı.",
    stim: "Uyarıcı iğne alındı.",
    medkit: "Sağlık çantası alındı.",
    hbonus: "Can bonusu.",
    abonus: "Zırh bonusu.",
    armor: "Zırh alındı.",
    megaarmor: "Ağır zırh alındı!",
    key: "{Key} anahtar kartı alındı.",
    w_chainsaw: "Testere! Hadi biraz et bul!",
    w_shotgun: "Pompalıyı aldın!",
    w_supershotgun: "Çifte pompalıyı aldın!",
    w_chaingun: "Minigun'u aldın!",
    w_launcher: "Roketatarı aldın!",
    needKey: "Bu kapı için {key} anahtar kartı gerekli.",
    noAmmo: "Mermi bitti!",
    exitOn: "Çıkış şalteri çevrildi!",
    chainsawFound: "Testere!",
    soundOn: "Ses açık",
    soundOff: "Ses kapalı",
  },
  hud: {
    ammo: "MERMİ",
    health: "CAN",
    armor: "ZIRH",
    arms: "SİLAH",
    key: "KART",
    level: "BÖLÜM",
    kills: "LEŞ",
    bullets: "MERMİ",
    shells: "FİŞEK",
    rockets: "ROKET",
  },
  weapon: {
    fist: "YUMRUK",
    chainsaw: "TESTERE",
    pistol: "TABANCA",
    shotgun: "POMPALI",
    supershotgun: "ÇİFTE POMPALI",
    chaingun: "MİNİGUN",
    launcher: "ROKETATAR",
  },
  levelLabel: "BÖLÜM {n}",
  complete: "BÖLÜM TAMAMLANDI",
  stats: { kills: "Leş", items: "Eşya", time: "Süre", par: "Hedef" },
  continueKey: "Enter / Boşluk: devam",
  died: "ÖLDÜN",
  killedBy: "Seni öldüren: {name}",
  killer: {
    trooper: "Zombi Asker",
    fiend: "Ateş Şeytanı",
    biter: "Isırgan",
    orb: "Göz Küre",
    self: "kendi patlaman",
    hazard: "zehirli çamur",
    lava: "lav",
  },
  restart: "R: bölümü yeniden başlat",
  deadEsc: "Esc: menü",
  victory: "CEHENNEMDEN KAÇTIN",
  victorySub: "Üç bölümün hepsi temizlendi.",
  totalTime: "Toplam süre",
  playAgain: "Enter: yeniden oyna   ·   Esc: çıkış",
  paused: "DURAKLATILDI",
  resume: "P / Enter: devam",
  quit: "Tekrar Esc / Q: çıkış",
};

export function strings(lang: HellrunLang): Strings {
  return lang === "tr" ? TR : EN;
}

/** Locale-aware upper-casing (Turkish i -> İ). */
export function upper(lang: HellrunLang, s: string): string {
  return s.toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US");
}

function capitalize(lang: HellrunLang, s: string): string {
  return s ? upper(lang, s[0]) + s.slice(1) : s;
}

/** Fills {key}/{Key}/{n}/{p}/{name} placeholders. */
export function fmt(lang: HellrunLang, template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k in params) return String(params[k]);
    const lower = k.toLowerCase();
    if (lower in params) return capitalize(lang, String(params[lower]));
    return `{${k}}`;
  });
}
