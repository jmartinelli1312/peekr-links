/**
 * Gemini TTS adapter.
 *
 * Uses the same GEMINI_API_KEY that already funds the Peekrbuzz carousels, so
 * narration adds no new vendor or billing relationship.
 *
 * Two things to know about this model:
 *   • It returns raw 24kHz 16-bit mono PCM (base64), not an encoded file.
 *   • Its context is small, so long narration must be synthesised in chunks
 *     and concatenated. `maxCharsPerRequest` is what callers chunk against.
 *
 * Style is steered with a natural-language prefix rather than a parameter —
 * that is how this model exposes delivery control.
 */

import { TtsError, type SynthesisResult, type TtsProvider, type VoiceOption } from "./provider";

const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24_000;

/**
 * A curated subset of the prebuilt voices — the ones that hold up over a
 * 20-minute narration. The full roster is larger; these are the ones worth
 * putting in a picker.
 */
const VOICES: VoiceOption[] = [
  // Google's own descriptors. It does not publish a gender per voice: the
  // perceived gender comes from the style direction and the content, which is
  // why the persona is pinned in video_story_settings.voice_style.
  { id: "Laomedeia", label: "Laomedeia", description: "Animada y con energía" },
  { id: "Kore", label: "Kore", description: "Firme y segura" },
  { id: "Charon", label: "Charon", description: "Informativa y clara" },
  { id: "Puck", label: "Puck", description: "Animada y enérgica" },
  { id: "Aoede", label: "Aoede", description: "Ligera y natural" },
  { id: "Leda", label: "Leda", description: "Juvenil" },
  { id: "Autonoe", label: "Autonoe", description: "Luminosa" },
  { id: "Callirrhoe", label: "Callirrhoe", description: "Relajada" },
  { id: "Despina", label: "Despina", description: "Suave" },
  { id: "Erinome", label: "Erinome", description: "Neutra y limpia" },
  { id: "Sulafat", label: "Sulafat", description: "Cálida" },
  { id: "Vindemiatrix", label: "Vindemiatrix", description: "Amable" },
];

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export function createGeminiTtsProvider(): TtsProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TtsError("gemini", 500, "GEMINI_API_KEY is not configured");
  }
  const model = process.env.VIDEO_STORY_TTS_MODEL || DEFAULT_MODEL;

  return {
    name: `gemini:${model}`,
    maxCharsPerRequest: 1800,

    listVoices() {
      return VOICES;
    },

    async synthesize({ text, voiceId, style }): Promise<SynthesisResult> {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new TtsError("gemini", 400, "No hay texto para sintetizar");
      }

      // Falls back only if settings somehow has no style; the persona normally
      // arrives from video_story_settings.voice_style so every chunk and every
      // story is read by the same narrator.
      const direction =
        style?.trim() ||
        "Voz femenina joven, latinoamericana, tono de confesión, ritmo ágil y natural.";
      const prompt = `${direction}:\n\n${trimmed}`;

      const res = await fetch(`${endpoint(model)}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } },
            },
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new TtsError("gemini", res.status, `Gemini TTS HTTP ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
        }>;
      };

      const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new TtsError("gemini", 200, "Gemini TTS no devolvió audio");
      }

      // mimeType looks like "audio/L16;codec=pcm;rate=24000" — trust the
      // declared rate when present so a model change doesn't desync playback.
      const declaredRate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1]);

      return {
        pcm: Buffer.from(inline.data, "base64"),
        sampleRate: Number.isFinite(declaredRate) && declaredRate > 0 ? declaredRate : SAMPLE_RATE,
        channels: 1,
      };
    },
  };
}
