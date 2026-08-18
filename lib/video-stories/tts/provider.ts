/**
 * Decoupled voice provider interface.
 *
 * One provider is wired today (Gemini TTS, funded by the same key as the
 * Peekrbuzz carousels). Adding another means writing an adapter that returns
 * the same shape and extending the switch below — no caller changes.
 *
 * Providers return raw PCM rather than an encoded file: a 20-minute narration
 * has to be synthesised in segments and concatenated, and concatenating PCM is
 * a buffer join while concatenating MP3s is not.
 */

export interface VoiceOption {
  id: string;
  label: string;
  /** Short description shown next to the sample button. */
  description: string;
}

export interface SynthesisResult {
  /** Signed 16-bit little-endian PCM. */
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}

export interface TtsProvider {
  readonly name: string;
  /** Voices offered in the story editor's voice picker. */
  listVoices(): VoiceOption[];
  /** Maximum characters per request. Callers chunk to fit. */
  readonly maxCharsPerRequest: number;
  synthesize(params: {
    text: string;
    voiceId: string;
    /** Free-form style direction, e.g. "narrador sereno, tono de misterio". */
    style?: string;
  }): Promise<SynthesisResult>;
}

export class TtsError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TtsError";
  }
}

export async function getTtsProvider(): Promise<TtsProvider> {
  const configured = (process.env.VIDEO_STORY_TTS_PROVIDER || "gemini").toLowerCase();

  switch (configured) {
    case "gemini":
    default: {
      const { createGeminiTtsProvider } = await import("./gemini-tts");
      return createGeminiTtsProvider();
    }
  }
}

/**
 * Splits narration into provider-sized chunks on sentence boundaries so no
 * segment ends mid-phrase (which produces an audible clip at the seam).
 */
export function chunkForSynthesis(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Split on sentence enders, keeping the punctuation attached.
  const sentences = clean.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) ?? [clean];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length > maxChars) {
      // A single sentence longer than the limit: flush, then hard-split on
      // spaces. Rare, but a run-on paragraph would otherwise stall the loop.
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      let rest = piece;
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(" ", maxChars);
        const at = cut > maxChars * 0.5 ? cut : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
      continue;
    }

    if (current.length + piece.length + 1 > maxChars) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
