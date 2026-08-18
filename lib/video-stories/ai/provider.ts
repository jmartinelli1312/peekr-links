/**
 * Decoupled AI provider interface for story generation.
 *
 * Nothing in the pipeline imports a vendor SDK directly — callers await
 * `getStoryAIProvider()` and get whatever `VIDEO_STORY_AI_PROVIDER` selects.
 * Swapping vendors is one env var, no code change.
 *
 * Keys live only in server-side env vars. This module must never be imported
 * from a client component.
 */

export interface StoryAIOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Request timeout in ms. Long-form acts need more than the default. */
  timeoutMs?: number;
  /**
   * JSON Schema describing the expected object. Providers that support
   * constrained decoding use it so malformed JSON becomes impossible rather
   * than something the parser has to survive.
   */
  schema?: Record<string, unknown>;
}

export interface StoryAIProvider {
  /** Human-readable id, surfaced in logs and the dashboard. */
  readonly name: string;
  /** Free-form completion. Used for prose (acts of the script). */
  completeText(prompt: string, options?: StoryAIOptions): Promise<string>;
  /** JSON completion. Used for the premise and the automatic review. */
  completeJson<T>(prompt: string, options?: StoryAIOptions): Promise<T>;
}

export class StoryAIError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "StoryAIError";
  }
}

/**
 * Resolves the configured provider.
 *
 * `gemini` (default) reuses the Gemini API key that already funds the
 * Peekrbuzz carousels — no new billing. `anthropic` requires a separate
 * pay-as-you-go ANTHROPIC_API_KEY; a Claude Code / claude.ai subscription
 * does NOT grant API access.
 *
 * The adapters are imported dynamically so the unused vendor never loads.
 */
export async function getStoryAIProvider(): Promise<StoryAIProvider> {
  const configured = (process.env.VIDEO_STORY_AI_PROVIDER || "gemini").toLowerCase();

  switch (configured) {
    case "anthropic":
    case "claude": {
      const { createAnthropicProvider } = await import("./anthropic");
      return createAnthropicProvider();
    }
    case "gemini":
    default: {
      const { createGeminiProvider } = await import("./gemini");
      return createGeminiProvider();
    }
  }
}
