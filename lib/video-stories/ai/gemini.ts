/**
 * Gemini adapter for the story generator.
 *
 * Kept separate from lib/peekrbuzz-daily/gemini.ts on purpose: that client is
 * tuned for short structured extraction (45s timeout, thinking disabled, 2k
 * output cap), while long-form narrative acts need minutes of headroom and
 * thinking left on. The genuinely shared piece — the tolerant JSON parser —
 * is imported rather than duplicated.
 */

import { parseJsonLoose } from "@/lib/peekrbuzz-daily/gemini";
import { StoryAIError, type StoryAIOptions, type StoryAIProvider } from "./provider";

const DEFAULT_MODEL = "gemini-2.5-flash";

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function call(
  prompt: string,
  apiKey: string,
  model: string,
  options: StoryAIOptions & { json?: boolean }
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      ...(options.json
        ? {
            responseMimeType: "application/json",
            // Constrained decoding: with a schema the model cannot emit
            // malformed JSON, so the parser stops being a failure point.
            ...(options.schema ? { responseSchema: options.schema } : {}),
          }
        : {}),
      // Gemini 2.5 Flash thinks by default, and thinking tokens are billed
      // against maxOutputTokens BEFORE any visible output. Left on, a long
      // premise gets truncated mid-string and the JSON never closes — which
      // is exactly what happened. lib/peekrbuzz-daily/gemini.ts learned this
      // the same way.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(`${endpoint(model)}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new StoryAIError("gemini", res.status, `Gemini HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  // Concatenate every part — long generations are frequently split.
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");

  if (!text) {
    throw new StoryAIError(
      "gemini",
      200,
      `Gemini returned no text (finishReason=${candidate?.finishReason ?? "unknown"})`
    );
  }

  // A truncated response is the difference between "the model wrote bad JSON"
  // and "we asked for more than the token budget allowed". Say which.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new StoryAIError(
      "gemini",
      200,
      `Gemini cortó la respuesta por límite de tokens (maxOutputTokens=${
        options.maxOutputTokens ?? 8192
      }). Subí el límite o acortá el pedido.`
    );
  }

  return text;
}

export function createGeminiProvider(): StoryAIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new StoryAIError("gemini", 500, "GEMINI_API_KEY is not configured");
  }
  const model = process.env.VIDEO_STORY_GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: `gemini:${model}`,
    async completeText(prompt, options = {}) {
      return call(prompt, apiKey, model, options);
    },
    async completeJson<T>(prompt: string, options: StoryAIOptions = {}) {
      const raw = await call(prompt, apiKey, model, { ...options, json: true });
      return parseJsonLoose<T>(raw);
    },
  };
}
