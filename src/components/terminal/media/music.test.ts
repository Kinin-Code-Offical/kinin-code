import { describe, expect, it } from "vitest";
import { createMusicPlayer, describeTrack } from "./music";

describe("createMusicPlayer (no Web Audio / SSR)", () => {
  it("can be created and used without window or AudioContext", async () => {
    expect(typeof window).toBe("undefined");
    const player = createMusicPlayer();
    expect(player.isPlaying()).toBe(false);
    expect(player.currentTime()).toBe(0);

    const spectrum = new Uint8Array(48).fill(7);
    player.getSpectrum(spectrum);
    expect([...spectrum].every((v) => v === 0)).toBe(true);

    const wave = new Uint8Array(64).fill(3);
    player.getWaveform(wave);
    expect([...wave].every((v) => v === 128)).toBe(true);

    let ended = 0;
    player.onEnded(() => {
      ended += 1;
    });
    player.setVolume(0.5);
    player.setVolume(Number.NaN);
    await player.play("neon_drive.mp3");
    expect(player.isPlaying()).toBe(false);
    player.seek(30);
    expect(player.currentTime()).toBe(30);
    player.seek(10_000);
    expect(player.currentTime()).toBeLessThanOrEqual(describeTrack("neon_drive.mp3").durationSec);
    player.pause();
    await player.resume();
    expect(ended).toBe(0);
    player.dispose();
    player.dispose();
  });
});
