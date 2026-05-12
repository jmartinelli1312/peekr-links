/**
 * Shared carousel generation pipeline.
 *
 * Used by both `/api/admin/peekrbuzz/carousels/generate` (first version) and
 * `/api/admin/peekrbuzz/carousels/regenerate` (next version after a click).
 *
 *   1. Load article + entity_matches
 *   2. Build entity image bank from TMDB
 *   3. Call Gemini with the cinematic carousel prompt
 *   4. Validate JSON shape (1 retry on validation failure)
 *   5. Resolve slide image URLs from the bank
 *   6. Insert peekrbuzz_carousels row with status='draft'
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callGeminiJson, GeminiError } from "./gemini";
import {
  buildCarouselPrompt,
  validateCarouselJson,
  type CarouselArticleInput,
  type CarouselEntityHint,
  type CarouselJson,
} from "./carousel-prompt";
import { buildEntityImageBank, pickSlideImages } from "./carousel-tmdb-images";

const GEMINI_MODEL_NAME = "gemini-2.5-flash";

export interface GenerateCarouselResult {
  carousel_id: number;
  version: number;
  status: "draft";
  warnings: string[];
}

export class CarouselGenerateError extends Error {
  constructor(public readonly stage: string, message: string) {
    super(`[${stage}] ${message}`);
    this.name = "CarouselGenerateError";
  }
}

/**
 * Fetches the article row + its entity matches. Throws if the article is not
 * a published ES Peekrbuzz row — we only build carousels off the editor-approved
 * Spanish source.
 */
async function loadArticle(
  admin: SupabaseClient,
  articleId: number,
): Promise<{ input: CarouselArticleInput; entities: CarouselEntityHint[] }> {
  const { data, error } = await admin
    .from("peekrbuzz_articles")
    .select("id, title, summary, body_html, image_url, source_name, language, article_status, editorial_theme, entity_matches")
    .eq("id", articleId)
    .maybeSingle();

  if (error) throw new CarouselGenerateError("loadArticle", error.message);
  if (!data) throw new CarouselGenerateError("loadArticle", `article ${articleId} not found`);
  if (data.language !== "es" || data.article_status !== "published") {
    throw new CarouselGenerateError(
      "loadArticle",
      `article ${articleId} is not a published ES row (lang=${data.language} status=${data.article_status})`,
    );
  }

  const em = (data.entity_matches ?? {}) as {
    titles?: Array<{ name: string; tmdb_id: number; popularity: number; media_type?: string }>;
    people?: Array<{ name: string; tmdb_id: number; popularity: number }>;
  };

  const entities: CarouselEntityHint[] = [
    ...(em.titles ?? []).map((t) => ({
      name: t.name,
      tmdb_id: t.tmdb_id,
      type: "title" as const,
      media_type: (t.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      popularity: t.popularity,
    })),
    ...(em.people ?? []).map((p) => ({
      name: p.name,
      tmdb_id: p.tmdb_id,
      type: "person" as const,
      media_type: "person" as const,
      popularity: p.popularity,
    })),
  ];

  return {
    input: {
      title: data.title,
      summary: data.summary,
      body_html: data.body_html ?? "",
      editorial_theme: data.editorial_theme,
      source_name: data.source_name,
      image_url: data.image_url,
      entities,
    },
    entities,
  };
}

/**
 * Calls Gemini and validates the response. On the first failure, sends one
 * follow-up call with the validation errors. After that we surface an error.
 */
async function callAndValidate(prompt: string, geminiKey: string): Promise<CarouselJson> {
  const first = await callGeminiJson<unknown>(prompt, geminiKey, {
    temperature: 0.85,         // a bit creative — cinematic flair
    maxOutputTokens: 4096,
    thinkingBudget: 0,
  });
  const firstErrors = validateCarouselJson(first);
  if (firstErrors.length === 0) return first as CarouselJson;

  // Retry once with the validation feedback inlined.
  const retryPrompt = `${prompt}\n\nTu intento anterior tuvo los siguientes errores de validación. Corregilos y devolvé el JSON otra vez:\n${firstErrors.join("\n- ")}`;
  const second = await callGeminiJson<unknown>(retryPrompt, geminiKey, {
    temperature: 0.7,
    maxOutputTokens: 4096,
    thinkingBudget: 0,
  });
  const secondErrors = validateCarouselJson(second);
  if (secondErrors.length > 0) {
    throw new CarouselGenerateError("validate", `Gemini failed validation twice: ${secondErrors.join(" | ")}`);
  }
  return second as CarouselJson;
}

export async function generateCarouselForArticle(
  admin: SupabaseClient,
  articleId: number,
  opts: { tmdbApiKey: string; geminiKey: string },
): Promise<GenerateCarouselResult> {
  const { input } = await loadArticle(admin, articleId);
  const warnings: string[] = [];

  // 1. Image bank
  const bank = await buildEntityImageBank(input.entities, opts.tmdbApiKey);
  const totalImages = Array.from(bank.values()).reduce(
    (acc, b) => acc + b.backdrops.length + b.posters.length + b.profiles.length,
    0,
  );
  if (totalImages === 0 && !input.image_url) {
    warnings.push("no TMDB images available — slides will fall back to gradient");
  }

  // 2. Gemini
  const prompt = buildCarouselPrompt(input);
  let json: CarouselJson;
  try {
    json = await callAndValidate(prompt, opts.geminiKey);
  } catch (err) {
    if (err instanceof GeminiError) {
      throw new CarouselGenerateError("gemini", err.message);
    }
    throw err;
  }

  // 3. Resolve slide images
  const slidesWithImages = pickSlideImages(json.slides, bank, input.image_url);

  // 4. Determine next version for this article
  const { data: prevRows, error: prevErr } = await admin
    .from("peekrbuzz_carousels")
    .select("version")
    .eq("article_id", articleId)
    .order("version", { ascending: false })
    .limit(1);
  if (prevErr) throw new CarouselGenerateError("version-lookup", prevErr.message);
  const nextVersion = ((prevRows?.[0]?.version as number | undefined) ?? 0) + 1;

  // 5. Insert
  const { data: inserted, error: insErr } = await admin
    .from("peekrbuzz_carousels")
    .insert({
      article_id: articleId,
      version: nextVersion,
      status: "draft",
      category: json.category,
      category_emoji: json.category_emoji,
      title: json.title,
      thesis: json.thesis,
      cta: json.cta,
      slides: slidesWithImages,
      caption: json.caption,
      hashtags: json.hashtags,
      mood: json.mood,
      palette: json.palette,
      generated_by: GEMINI_MODEL_NAME,
    })
    .select("id, version")
    .single();

  if (insErr || !inserted) {
    throw new CarouselGenerateError("insert", insErr?.message ?? "no row returned");
  }

  return {
    carousel_id: inserted.id as number,
    version: inserted.version as number,
    status: "draft",
    warnings,
  };
}
