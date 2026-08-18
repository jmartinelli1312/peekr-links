import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  countWords,
  effectiveWpm,
  estimateMinutes,
  formatMinutes,
  targetWordRange,
} from "../types";
import { chunkForSynthesis } from "../tts/provider";
import { assignAssets, planScenes } from "../scenes";
import { pcmDurationSeconds, pcmToWav } from "../wav";

describe("length math", () => {
  it("accounts for playback speed when converting words to minutes", () => {
    // Measured: Laomedeia narrates at 104 wpm, played back at 1.5x = 156 words
    // per finished minute. See the note on DEFAULT_SETTINGS.words_per_minute.
    expect(effectiveWpm(DEFAULT_SETTINGS)).toBe(156);
    expect(estimateMinutes(3120, DEFAULT_SETTINGS)).toBe(20);
  });

  it("derives a word range that lands inside the 18–25 minute target", () => {
    const { min, max, ideal } = targetWordRange(DEFAULT_SETTINGS);
    expect(min).toBe(2808);
    expect(max).toBe(3900);
    expect(ideal).toBeGreaterThan(min);
    expect(ideal).toBeLessThan(max);

    // Round-tripping the bounds must reproduce the configured minutes.
    expect(estimateMinutes(min, DEFAULT_SETTINGS)).toBe(18);
    expect(estimateMinutes(max, DEFAULT_SETTINGS)).toBe(25);
  });

  it("counts words consistently across whitespace shapes", () => {
    expect(countWords("  uno   dos\ntres\t cuatro ")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
  });

  it("formats minutes as mm:ss", () => {
    expect(formatMinutes(20.5)).toBe("20:30");
    expect(formatMinutes(0)).toBe("—");
  });
});

describe("chunkForSynthesis", () => {
  it("keeps every chunk within the provider limit", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Frase número ${i} del guion.`).join(" ");
    const chunks = chunkForSynthesis(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(200);
  });

  it("preserves the full text across chunks", () => {
    const text = "Uno. Dos. Tres. Cuatro. Cinco. Seis. Siete. Ocho.";
    const chunks = chunkForSynthesis(text, 20);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("splits a single over-long sentence instead of looping forever", () => {
    const runOn = `${"palabra ".repeat(120).trim()}.`;
    const chunks = chunkForSynthesis(runOn, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
  });

  it("returns nothing for empty input", () => {
    expect(chunkForSynthesis("   ", 500)).toEqual([]);
  });
});

describe("scene planning", () => {
  const script = Array.from({ length: 1200 }, (_, i) => `palabra${i}`).join(" ");

  it("covers the whole script without dropping words", () => {
    const scenes = planScenes(script);
    expect(scenes.length).toBeGreaterThan(0);
    const rebuilt = scenes.map((s) => s.text).join(" ");
    expect(countWords(rebuilt)).toBe(countWords(script));
  });

  it("cuts scenes short enough that no shot outlasts a stock clip", () => {
    const scenes = planScenes(script);
    // ~10 seconds of narration each, i.e. around 45 words.
    for (const scene of scenes) expect(countWords(scene.text)).toBeLessThanOrEqual(50);
    expect(scenes.length).toBeGreaterThanOrEqual(24);
  });

  it("never repeats a category in consecutive scenes", () => {
    const scenes = planScenes(script);
    for (let i = 1; i < scenes.length; i++) {
      expect(scenes[i].tag).not.toBe(scenes[i - 1].tag);
    }
  });

  it("rotates only through the categories that have footage", () => {
    const stocked = ["unboxing", "liquidos"] as const;
    const scenes = planScenes(script, [...stocked]);
    expect(new Set(scenes.map((s) => s.tag))).toEqual(new Set(stocked));
    for (let i = 1; i < scenes.length; i++) {
      expect(scenes[i].tag).not.toBe(scenes[i - 1].tag);
    }
  });

  it("still produces scenes when a single category is stocked", () => {
    const scenes = planScenes(script, ["cocina"]);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((s) => s.tag === "cocina")).toBe(true);
  });
});

describe("assignAssets", () => {
  it("never reuses the same clip in consecutive scenes", () => {
    const scenes = [0, 1, 2, 3, 4].map((index) => ({
      index,
      text: "x",
      tag: "unboxing" as const,
    }));
    const assigned = assignAssets(scenes, {
      unboxing: ["unboxing/a.mp4", "unboxing/b.mp4"],
    });

    expect(assigned.every((s) => s.asset)).toBe(true);
    for (let i = 1; i < assigned.length; i++) {
      expect(assigned[i].asset).not.toBe(assigned[i - 1].asset);
    }
  });

  it("falls back to another category's footage when its own folder is empty", () => {
    const scenes = [{ index: 0, text: "x", tag: "maquillaje" as const }];
    const assigned = assignAssets(scenes, { maquillaje: [], cocina: ["cocina/a.mp4"] });
    expect(assigned[0].asset).toBe("cocina/a.mp4");
  });

  it("spreads shots by clip count, not by category", () => {
    // Ten scenes over a big folder and a tiny one. The old per-category
    // rotation gave each five, so the tiny folder's single clip carried half
    // the video.
    const scenes = Array.from({ length: 10 }, (_, index) => ({
      index,
      text: "x",
      tag: "armado" as const,
    }));
    const assigned = assignAssets(scenes, {
      armado: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"],
      corte: ["c1"],
    });

    const counts = new Map<string, number>();
    for (const scene of assigned) {
      counts.set(scene.asset!, (counts.get(scene.asset!) ?? 0) + 1);
    }
    // Ten shots over ten clips: nothing may be used more than twice.
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    expect(counts.get("c1")).toBe(1);
  });

  it("leaves scenes untouched when no footage exists at all", () => {
    const scenes = [{ index: 0, text: "x", tag: "corte" as const }];
    expect(assignAssets(scenes, {})[0].asset).toBeUndefined();
  });
});

describe("wav", () => {
  it("writes a RIFF header describing the PCM payload", () => {
    const pcm = Buffer.alloc(4800); // 0.1s of 24kHz mono 16-bit
    const wav = pcmToWav(pcm, { sampleRate: 24_000, channels: 1 });

    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.length).toBe(44 + pcm.length);
  });

  it("computes duration from the raw byte length", () => {
    expect(pcmDurationSeconds(48_000, 24_000, 1, 16)).toBe(1);
  });
});
