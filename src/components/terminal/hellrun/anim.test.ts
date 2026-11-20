import { describe, expect, it } from "vitest";
import {
  allSpriteNames,
  MONSTER_ANIMS,
  rotationIndex,
  rotations,
  seq,
  seqFrame,
  seqLength,
  TIC,
  WEAPON_ANIMS,
} from "./anim";
import { WEAPONS } from "./defs";
import { FREEDOOM_SPRITES } from "./freedoom-manifest";
import { fmt, strings, upper } from "./i18n";

describe("sprite manifest", () => {
  it("resolves 8 rotations, including mirrored pairs", () => {
    const r = rotations("trooa");
    expect(r.names).toEqual(["trooa1", "trooa2a8", "trooa3a7", "trooa4a6", "trooa5", "trooa4a6", "trooa3a7", "trooa2a8"]);
    expect(r.mirror).toEqual([false, false, false, false, false, true, true, true]);
    const p = rotations("possa");
    expect(p.names[7]).toBe("possa8");
    expect(p.mirror.every((m) => !m)).toBe(true);
    expect(rotations("trooi").names.every((n) => n === "trooi0")).toBe(true);
  });

  it("only references sprites that exist", () => {
    const names = allSpriteNames();
    expect(names.length).toBeGreaterThan(200);
    for (const n of names) expect(FREEDOOM_SPRITES[n]).toBeTruthy();
    for (const m of Object.values(MONSTER_ANIMS)) {
      for (const f of [...m.walk, ...m.attack, ...m.pain]) {
        for (const n of rotations(f.frame).names) expect(FREEDOOM_SPRITES[n]).toBeTruthy();
      }
    }
  });

  it("picks the front view when a monster faces the viewer", () => {
    // monster at the origin facing west, viewer to its west looking east
    expect(rotationIndex(Math.PI, 0)).toBe(0);
    // seen from behind
    expect(rotationIndex(0, 0)).toBe(4);
    // facing south (+y) while the viewer looks east at it: side view
    const side = rotationIndex(Math.PI / 2, 0);
    expect(side === 2 || side === 6).toBe(true);
  });

  it("plays sequences in tics and stretches them to a weapon's refire time", () => {
    const s = seq("pisg", "A4 B6 C4 B5");
    expect(seqLength(s)).toBeCloseTo(19 * TIC, 6);
    expect(seqFrame(s, 0, false).frame).toBe("pisga");
    expect(seqFrame(s, 5 * TIC, false).frame).toBe("pisgb");
    expect(seqFrame(s, 100, false).frame).toBe("pisgb");
    const pistol = WEAPONS.find((w) => w.id === "pistol")!;
    const scale = pistol.cooldown / seqLength(WEAPON_ANIMS.pistol.fire);
    // the flash/attack frame lines up with the gameplay attack moment
    expect(WEAPON_ANIMS.pistol.flashAt * TIC * scale).toBeCloseTo(pistol.fireAt, 2);
    expect(seqFrame(seq("x", "A1! B1"), 0, true).bright).toBe(true);
  });
});

describe("i18n", () => {
  it("has Turkish strings with proper characters and fills placeholders", () => {
    const tr = strings("tr");
    expect(tr.pressKey).toContain("BAŞLAMAK");
    expect(tr.credit).toBe("Grafikler: Freedoom projesi — BSD 3-Clause");
    expect(strings("en").credit).toBe("Art: Freedoom project — BSD 3-Clause");
    expect(fmt("tr", tr.msg.key, { key: tr.keyName.red })).toBe("Kırmızı anahtar kartı alındı.");
    expect(upper("tr", "outpost kapısı")).toBe("OUTPOST KAPISI");
    expect(upper("tr", "cehennem ağzı")).toBe("CEHENNEM AĞZI");
    expect(upper("tr", "bölüm i")).toBe("BÖLÜM İ");
    const en = strings("en");
    expect(Object.keys(tr.msg).sort()).toEqual(Object.keys(en.msg).sort());
    expect(tr.controls.length).toBe(en.controls.length);
  });
});
