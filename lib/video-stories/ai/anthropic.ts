/**
 * Anthropic (Claude) adapter for the story generator.
 *
 * Not wired by default — set VIDEO_STORY_AI_PROVIDER=anthropic to use it.
 * It needs a pay-as-you-go ANTHROPIC_API_KEY; a Claude Code / claude.ai
 * subscription is a separate product and does not grant API access.
 *
 * Uses adaptive thinking (there is no budget_tokens on Claude Opus 5) and
 * opts into server-side refusal fallbacks so a declined request is retried
 * on Anthropic's recommended fallback model instead of failing the run.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parseJsonLoose } from "@/lib/peekrbuzz-daily/gemini";
import { StoryAIError, type StoryAIOptions, type StoryAIProvider } from "./provider";

const DEFAULT_MODEL = "claude-opus-5";

/** Effort tier for narrative generation. Creative prose benefits from depth. */
const DEFAULT_EFFORT = "high";

export function createAnthropicProvider(): StoryAIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new StoryAIError("anthropic", 500, "ANTHROPIC_API_KEY is not configured");
  }

  const model = process.env.VIDEO_STORY_ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  async function call(prompt: string, options: StoryAIOptions): Promise<string> {
    let message;
    try {
      message = await client.beta.messages.create(
        {
          model,
          max_tokens: options.maxOutputTokens ?? 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: DEFAULT_EFFORT },
          // Safety classifiers can decline a request; "default" re-runs it on
          // Anthropic's recommended fallback rather than returning the refusal.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages: [{ role: "user", content: prompt }],
        },
        { timeout: options.timeoutMs ?? 300_000 }
      );
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new StoryAIError("anthropic", err.status ?? 500, `Anthropic: ${err.message}`);
      }
      throw err;
    }

    // A refusal is an HTTP 200 with an empty or partial content array — check
    // stop_reason before reading content, or this throws on content[0].
    if (message.stop_reason === "refusal") {
      throw new StoryAIError(
        "anthropic",
        200,
        `Anthropic declined the request (${message.stop_details?.category ?? "unspecified"})`
      );
    }

    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text) {
      throw new StoryAIError(
        "anthropic",
        200,
        `Anthropic returned no text (stop_reason=${message.stop_reason ?? "unknown"})`
      );
    }

    return text;
  }

  return {
    name: `anthropic:${model}`,
    completeText(prompt, options = {}) {
      return call(prompt, options);
    },
    async completeJson<T>(prompt: string, options: StoryAIOptions = {}) {
      // Same contract as the Gemini adapter: the prompt asks for JSON and the
      // tolerant parser strips fences. Keeps both adapters interchangeable.
      const raw = await call(prompt, options);
      return parseJsonLoose<T>(raw);
    },
  };
}
