/**
 * Minimal Gemini REST client used by the daily Peekrbuzz pipeline.
 *
 * We intentionally do not depend on `@google/generative-ai` to keep peekr-links
 * dependency-light (this app is hot on cold-start latency on Vercel).
 *
 * All callers request JSON output and we parse defensively because Gemini
 * occasionally wraps JSON in ```json fences despite responseMimeType.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Set to true to request JSON output. Adds responseMimeType. */
  json?: boolean;
  /** Gemini 2.5 thinking budget — set to 0 to disable thinking for predictable token usage. */
  thinkingBudget?: number;
}

export class GeminiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Calls Gemini and returns the raw text of the first candidate. Throws
 * GeminiError on non-200 or empty response.
 */
export async function callGemini(
  prompt: string,
  apiKey: string,
  options: GeminiOptions = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.6,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
      // Gemini 2.5 Flash defaults to thinking enabled, which consumes the
      // maxOutputTokens budget before any visible output is emitted. For
      // structured-data tasks we want all tokens used for the JSON itself.
      thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(res.status, `Gemini HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new GeminiError(200, "Gemini returned empty text");
  return text;
}

/**
 * Calls Gemini and parses the response as JSON of the given shape. Strips
 * ```json fences if present. Throws if parsing fails — the caller should
 * decide whether to retry or skip.
 */
export async function callGeminiJson<T>(
  prompt: string,
  apiKey: string,
  options: Omit<GeminiOptions, "json"> = {},
): Promise<T> {
  const raw = await callGemini(prompt, apiKey, { ...options, json: true });
  return parseJsonLoose<T>(raw);
}

/**
 * Tolerant JSON parser. Gemini occasionally emits trailing commas, leading
 * prose, or markdown fences even with responseMimeType=application/json.
 * Two-pass: try strict JSON.parse first; on failure, clean common issues
 * and retry once. If the second pass also fails, log the raw output and
 * rethrow so the caller can decide whether to retry the LLM call.
 */
export function parseJsonLoose<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const firstBrace = cleaned.search(/[\[{]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  // Strip anything after the matched final brace.
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (lastBrace > 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Second pass: strip trailing commas, fix common quirks.
    const fixed = cleaned
      .replace(/,(\s*[}\]])/g, "$1") // trailing commas before } or ]
      .replace(/\\u[\dA-Fa-f]{4}/g, (m) => m); // keep escape sequences as-is
    try {
      return JSON.parse(fixed) as T;
    } catch (err) {
      console.error("[parseJsonLoose] raw output (first 500):", cleaned.slice(0, 500));
      throw err;
    }
  }
}
