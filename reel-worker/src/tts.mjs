// ElevenLabs TTS via fal.ai. Returns the path of a written MP3.
//
// Model: fal-ai/elevenlabs/tts/multilingual-v2 — the most natural multilingual
// voice model ElevenLabs offers, spoken through fal's hosted endpoint (one key,
// no ElevenLabs account juggling).
//
// Env: FAL_KEY. Voice: REEL_VOICE (ElevenLabs voice name/id; default is a
// warm Latin-American Spanish female voice).

import { writeFile } from "node:fs/promises";

const FAL_ENDPOINT = "https://fal.run/fal-ai/elevenlabs/tts/multilingual-v2";

// ElevenLabs premade voices with a natural LatAm-Spanish read. The env var
// lets Jorge swap after listening to samples in the dashboard.
export const DEFAULT_VOICE = process.env.REEL_VOICE || "Valentina";

export async function synthesize(text, outPath, { voice = DEFAULT_VOICE } = {}) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");

  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      // Slightly expressive, stable delivery — good for short narration.
      stability: 0.45,
      similarity_boost: 0.8,
      style: 0.35,
      speed: 1.02,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`fal tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const url = j?.audio?.url;
  if (!url) throw new Error(`fal tts: no audio url in response ${JSON.stringify(j).slice(0, 200)}`);

  const audio = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!audio.ok) throw new Error(`fal tts audio download ${audio.status}`);
  await writeFile(outPath, Buffer.from(await audio.arrayBuffer()));
  return outPath;
}
