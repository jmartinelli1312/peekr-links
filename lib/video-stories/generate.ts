/**
 * Story generation orchestration.
 *
 * Two-stage by design: premise first, then the script act by act. Generating
 * ~5.000 words in a single call produces mush — the model loses the thread and
 * pads. Feeding each act the text so far keeps continuity and lets us steer
 * length per act.
 *
 * Every call here runs server-side with the service-role client; the provider
 * key never leaves the backend.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoryAIProvider } from "./ai/provider";
import {
  ACTS,
  PREMISE_SCHEMA,
  REVIEW_SCHEMA,
  buildActPrompt,
  buildCtaPrompt,
  buildPremisePrompt,
  buildReviewPrompt,
  type PremiseResult,
} from "./prompts";
import {
  DEFAULT_SETTINGS,
  GENRES,
  countWords,
  estimateMinutes,
  targetWordRange,
  type Genre,
  type StoryReview,
  type VideoStorySettings,
} from "./types";

export class StoryGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryGenerationError";
  }
}

/** Reads the singleton settings row, falling back to the documented defaults. */
export async function loadSettings(admin: SupabaseClient): Promise<VideoStorySettings> {
  const { data, error } = await admin
    .from("video_story_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;
  return data as VideoStorySettings;
}

/**
 * Picks a genre that isn't the one used most recently, so the channel doesn't
 * ship three thrillers in a row.
 */
export async function pickGenre(admin: SupabaseClient): Promise<Genre> {
  const { data } = await admin
    .from("video_stories")
    .select("genre")
    .order("generated_at", { ascending: false })
    .limit(2);

  const recent = new Set(((data as Array<{ genre: string }> | null) ?? []).map((r) => r.genre));
  const available = GENRES.filter((g) => !recent.has(g));
  const pool = available.length > 0 ? available : GENRES;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface GeneratedStory {
  premise: PremiseResult;
  script: string;
  cta: string;
  wordCount: number;
  estimatedMinutes: number;
  review: StoryReview;
}

/**
 * Runs the full generation chain. Does not touch the database — callers decide
 * whether the result becomes a new row or overwrites an existing one.
 */
export async function generateStoryContent(
  genre: Genre,
  settings: VideoStorySettings
): Promise<GeneratedStory> {
  const provider = await getStoryAIProvider();
  const { ideal } = targetWordRange(settings);

  // ── 1. Premise ─────────────────────────────────────────────────────────────
  const premise = await provider.completeJson<PremiseResult>(
    buildPremisePrompt(genre, settings),
    // Roomy budget plus a schema: the premise is six prose fields and running
    // out of tokens mid-string is what broke this the first time.
    { maxOutputTokens: 4096, timeoutMs: 120_000, schema: PREMISE_SCHEMA }
  );

  if (!premise?.premise || !premise?.internal_title) {
    throw new StoryGenerationError("El proveedor devolvió una premisa incompleta");
  }

  // ── 2. Script, act by act ──────────────────────────────────────────────────
  // Weighted so the middle acts carry the bulk and the opener stays tight.
  const actWeights = [0.22, 0.28, 0.28, 0.22];
  const acts: string[] = [];

  for (let i = 0; i < ACTS.length; i++) {
    const wordsForAct = Math.round(ideal * actWeights[i]);
    const text = await provider.completeText(
      buildActPrompt({ genre, premise, actIndex: i, wordsForAct, previousActs: acts }),
      {
        // ~1.6 tokens per Spanish word, plus headroom.
        maxOutputTokens: Math.min(16000, Math.round(wordsForAct * 2.6) + 1000),
        timeoutMs: 240_000,
      }
    );
    acts.push(text.trim());
  }

  const script = acts.join("\n\n");

  // ── 3. CTA ─────────────────────────────────────────────────────────────────
  const cta = (
    await provider.completeText(buildCtaPrompt(genre), {
      maxOutputTokens: 512,
      timeoutMs: 60_000,
    })
  ).trim();

  // ── 4. Automatic review ────────────────────────────────────────────────────
  const wordCount = countWords(script) + countWords(cta);
  const estimatedMinutes = estimateMinutes(wordCount, settings);

  const review = await runReview({ genre, script, wordCount, settings });

  return { premise, script, cta, wordCount, estimatedMinutes, review };
}

/**
 * Automatic quality pass. A provider failure here must not sink an otherwise
 * good draft, so it degrades to a "needs_review" verdict instead of throwing.
 */
export async function runReview(params: {
  genre: Genre;
  script: string;
  wordCount: number;
  settings: VideoStorySettings;
}): Promise<StoryReview> {
  try {
    const provider = await getStoryAIProvider();
    const raw = await provider.completeJson<Partial<StoryReview>>(
      buildReviewPrompt(params),
      { maxOutputTokens: 4096, timeoutMs: 180_000, schema: REVIEW_SCHEMA }
    );

    const score = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
    };

    const review: StoryReview = {
      coherencia: score(raw.coherencia),
      repeticiones: score(raw.repeticiones),
      originalidad: score(raw.originalidad),
      duracion: score(raw.duracion),
      gancho: score(raw.gancho),
      final: score(raw.final),
      verdict: "ok",
      notas: Array.isArray(raw.notas) ? raw.notas.map(String).slice(0, 12) : [],
    };

    // Recompute the verdict from the scores rather than trusting the model's
    // own label — the two disagree often enough to matter.
    const scores = [
      review.coherencia,
      review.repeticiones,
      review.originalidad,
      review.duracion,
      review.gancho,
      review.final,
    ];
    const lowest = Math.min(...scores);
    review.verdict = lowest <= 3 ? "error" : lowest <= 6 ? "needs_review" : "ok";

    return review;
  } catch (err) {
    return {
      coherencia: 0,
      repeticiones: 0,
      originalidad: 0,
      duracion: 0,
      gancho: 0,
      final: 0,
      verdict: "needs_review",
      notas: [
        `La revisión automática falló: ${err instanceof Error ? err.message : String(err)}. Revisa la historia a mano.`,
      ],
    };
  }
}

/** Maps a review verdict onto the story status shown in the dashboard. */
export function statusFromReview(review: StoryReview): "pending" | "needs_review" | "error" {
  if (review.verdict === "error") return "error";
  if (review.verdict === "needs_review") return "needs_review";
  return "pending";
}

/**
 * Generates a story and inserts it. The row is created up front so a failed
 * run leaves a visible error card instead of disappearing silently.
 */
export async function createStory(
  admin: SupabaseClient,
  opts: { genre?: Genre; scheduledFor?: string } = {}
): Promise<{ id: string }> {
  const settings = await loadSettings(admin);
  const genre = opts.genre ?? (await pickGenre(admin));

  const { data: inserted, error: insertError } = await admin
    .from("video_stories")
    .insert({
      internal_title: "Generando…",
      genre,
      status: "pending",
      scheduled_for: opts.scheduledFor ?? null,
      voice_id: settings.default_voice_id,
      voice_speed: settings.playback_speed,
      youtube_visibility: settings.default_visibility,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new StoryGenerationError(`No se pudo crear la historia: ${insertError?.message}`);
  }

  const id = (inserted as { id: string }).id;

  try {
    const result = await generateStoryContent(genre, settings);
    await admin
      .from("video_stories")
      .update({
        internal_title: result.premise.internal_title,
        youtube_title: result.premise.youtube_title,
        premise: result.premise.premise,
        hook: result.premise.hook,
        midpoint_twist: result.premise.midpoint_twist,
        ending: result.premise.ending,
        script: result.script,
        cta: result.cta,
        word_count: result.wordCount,
        estimated_minutes: result.estimatedMinutes,
        review_json: result.review,
        status: statusFromReview(result.review),
        error_message: null,
        generated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("video_stories")
      .update({
        internal_title: "Falló la generación",
        status: "error",
        error_message: message.slice(0, 1000),
      })
      .eq("id", id);
    throw new StoryGenerationError(message);
  }

  return { id };
}
