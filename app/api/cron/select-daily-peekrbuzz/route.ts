import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/buzz-generator";
import { todayInArgentina, hoursAgoIso } from "@/lib/peekrbuzz-daily/argentina";
import { callGeminiJson, GeminiError } from "@/lib/peekrbuzz-daily/gemini";
import {
  type EntityMatch,
  verifyEntitiesAgainstTmdb,
} from "@/lib/peekrbuzz-daily/tmdb";
import {
  type SignalForScoring,
  buildScoringPrompt,
  buildRewritePrompt,
} from "@/lib/peekrbuzz-daily/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Hours of RSS signal history to consider for today's candidate pool. */
const SIGNAL_LOOKBACK_HOURS = 36;
/** Hard cap on signals sent to Gemini for scoring — keeps prompt under context limit. */
const MAX_SIGNALS_FOR_SCORING = 50;
/** Buffer above 4 so TMDB filtering still leaves us 4 finalists. */
const SHORTLIST_AFTER_SCORING = 12;
/** Minimum Gemini viral-potential score to even consider a signal. */
const MIN_VIRAL_SCORE = 50;
/** Minimum TMDB popularity for the best entity in a candidate to be kept. */
const MIN_TMDB_POPULARITY = 12;
/** Final number of candidates shown to the editor. */
const TARGET_DAILY_CANDIDATES = 4;

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const apiSecret = process.env.INDEXNOW_API_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (apiSecret && auth === `Bearer ${apiSecret}`) return true;
  return false;
}

// ── Types for Gemini-scored results ───────────────────────────────────────────

interface ScoredSignal {
  signal_id: number;
  score: number;
  titles: string[];
  people: string[];
  theme: "actualidad" | "lanzamiento" | "historia" | "dato_peekr";
  reason: string;
}

interface RewriteResult {
  title: string;
  summary: string;
  body_html: string;
  editorial_theme: string;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ ok: false, message: "GEMINI_API_KEY missing" }, { status: 500 });
  }
  if (!tmdbKey) {
    return NextResponse.json({ ok: false, message: "TMDB_API_KEY missing" }, { status: 500 });
  }

  // Optional ?date=YYYY-MM-DD override for backfill. Default = today in Argentina.
  const dateOverride = request.nextUrl.searchParams.get("date");
  const targetDate = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)
    ? dateOverride
    : todayInArgentina();

  const force = request.nextUrl.searchParams.get("force") === "1";

  const admin = getSupabaseAdmin();

  // ── 1. Idempotency check ────────────────────────────────────────────────────
  const { count: existingCount } = await admin
    .from("peekrbuzz_articles")
    .select("*", { count: "exact", head: true })
    .eq("candidate_for_date", targetDate)
    .in("article_status", ["daily_candidate", "selected", "published"]);

  if ((existingCount ?? 0) >= TARGET_DAILY_CANDIDATES && !force) {
    return NextResponse.json({
      ok: true,
      target_date: targetDate,
      skipped: true,
      reason: `${existingCount} candidates already exist for ${targetDate}. Pass ?force=1 to regenerate.`,
    });
  }

  // When force-regenerating, clear out the previous batch of daily_candidate
  // rows for this date so slug collisions can't happen. Selected/published
  // rows are preserved (we never overwrite a decision the editor already made).
  if (force) {
    await admin
      .from("peekrbuzz_articles")
      .delete()
      .eq("candidate_for_date", targetDate)
      .eq("article_status", "daily_candidate")
      .eq("language", "es");
  }

  // ── 2. Fetch fresh signals (ES) ─────────────────────────────────────────────
  const sinceIso = hoursAgoIso(SIGNAL_LOOKBACK_HOURS);
  const { data: signals, error: signalsErr } = await admin
    .from("peekrbuzz_articles")
    .select("id, title, summary, source_name, source_url, image_url, published_at, language")
    .eq("article_status", "signal")
    .eq("language", "es")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(MAX_SIGNALS_FOR_SCORING);

  if (signalsErr) {
    return NextResponse.json({ ok: false, message: `signals fetch: ${signalsErr.message}` }, { status: 500 });
  }

  if (!signals || signals.length === 0) {
    return NextResponse.json({
      ok: true,
      target_date: targetDate,
      candidates_inserted: 0,
      reason: "No fresh ES signals in the last 36h. Did fetch-buzz-rss run?",
    });
  }

  type SignalRow = {
    id: number;
    title: string;
    summary: string | null;
    source_name: string | null;
    source_url: string | null;
    image_url: string | null;
    published_at: string | null;
    language: string;
  };
  const signalsTyped = signals as SignalRow[];
  const signalById = new Map(signalsTyped.map((s) => [s.id, s]));

  // ── 3. Gemini batch scoring ─────────────────────────────────────────────────
  const scoringInput: SignalForScoring[] = signalsTyped.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    source_name: s.source_name,
  }));

  let scored: ScoredSignal[];
  try {
    scored = await callGeminiJson<ScoredSignal[]>(buildScoringPrompt(scoringInput), geminiKey, {
      temperature: 0.4,
      maxOutputTokens: 4096,
    });
  } catch (err) {
    const msg = err instanceof GeminiError ? err.message : (err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, message: `Gemini scoring failed: ${msg}` }, { status: 502 });
  }

  if (!Array.isArray(scored)) {
    return NextResponse.json({ ok: false, message: "Gemini scoring did not return an array" }, { status: 502 });
  }

  // Filter + sort + cap
  const shortlist = scored
    .filter((s) => s.score >= MIN_VIRAL_SCORE && signalById.has(s.signal_id))
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_AFTER_SCORING);

  // ── 4. TMDB entity verification — keep only signals with a famous match ────
  const verifiedCandidates: Array<{
    scored: ScoredSignal;
    signal: SignalRow;
    matches: EntityMatch[];
    popularityScore: number;
  }> = [];

  for (const item of shortlist) {
    const signal = signalById.get(item.signal_id)!;
    const queries = [
      ...item.titles.map((q) => ({ query: q, type: "title" as const })),
      ...item.people.map((q) => ({ query: q, type: "person" as const })),
    ].slice(0, 6); // cap TMDB calls per signal

    const matches = await verifyEntitiesAgainstTmdb(queries, tmdbKey, MIN_TMDB_POPULARITY);
    if (matches.length === 0) continue;

    const popularityScore = matches[0].popularity;
    verifiedCandidates.push({ scored: item, signal, matches, popularityScore });
  }

  if (verifiedCandidates.length === 0) {
    return NextResponse.json({
      ok: true,
      target_date: targetDate,
      candidates_inserted: 0,
      reason: "No signal passed TMDB popularity filter.",
      scored_count: scored.length,
      shortlisted: shortlist.length,
    });
  }

  // ── 5. Final ranking (blend viral + popularity + recency) ───────────────────
  const now = Date.now();
  const finalists = verifiedCandidates
    .map((c) => {
      const tsRaw = c.signal.published_at ? new Date(c.signal.published_at).getTime() : now;
      const ageHours = Math.max(0, (now - tsRaw) / 3_600_000);
      const recencyScore = Math.max(0, 100 - ageHours * 2); // -2 pts per hour old
      const combined = c.scored.score * 0.5 + Math.min(100, c.popularityScore) * 0.3 + recencyScore * 0.2;
      return { ...c, combined };
    })
    .sort((a, b) => b.combined - a.combined);

  // Diversity: don't let two candidates share the same primary entity.
  const seenEntityKeys = new Set<string>();
  const finalFour: typeof finalists = [];
  for (const f of finalists) {
    const primaryKey = `${f.matches[0].type}:${f.matches[0].tmdb_id}`;
    if (seenEntityKeys.has(primaryKey)) continue;
    seenEntityKeys.add(primaryKey);
    finalFour.push(f);
    if (finalFour.length >= TARGET_DAILY_CANDIDATES) break;
  }

  if (finalFour.length === 0) {
    return NextResponse.json({
      ok: true,
      target_date: targetDate,
      candidates_inserted: 0,
      reason: "Diversity filter rejected all finalists (shouldn't happen).",
    });
  }

  // ── 6. Gemini rewrite in Peekr voice (parallel) ─────────────────────────────
  const rewriteResults = await Promise.all(
    finalFour.map(async (f) => {
      try {
        const prompt = buildRewritePrompt({
          original_title: f.signal.title,
          original_summary: f.signal.summary ?? "",
          source_name: f.signal.source_name ?? "RSS",
          source_url: f.signal.source_url ?? "",
          titles: f.matches.filter((m) => m.type === "title").map((m) => m.resolved_name),
          people: f.matches.filter((m) => m.type === "person").map((m) => m.resolved_name),
          theme_hint: f.scored.theme,
        });
        const rewrite = await callGeminiJson<RewriteResult>(prompt, geminiKey, {
          temperature: 0.7,
          maxOutputTokens: 1500,
        });
        return { ok: true as const, finalist: f, rewrite };
      } catch (err) {
        return {
          ok: false as const,
          finalist: f,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // ── 7. Insert daily_candidate rows ──────────────────────────────────────────
  const inserted: Array<{ id: number; title: string }> = [];
  const failed: Array<{ signal_id: number; reason: string }> = [];

  for (const result of rewriteResults) {
    if (!result.ok) {
      failed.push({ signal_id: result.finalist.signal.id, reason: result.error });
      continue;
    }
    const { finalist, rewrite } = result;
    const slugBase = slugify(rewrite.title || finalist.signal.title);
    // Suffix with date + signal id so slugs are unique across days and never clash with the source signal.
    const slug = `${slugBase}-${targetDate.replace(/-/g, "")}-${finalist.signal.id}`.slice(0, 110);

    const topicKey = `pbz-daily-${targetDate}-${finalist.signal.id}`;

    // Prefer TMDB backdrop over the RSS image — backdrops are cleaner / higher
    // quality, and we already have them from entity verification.
    const tmdbImage = finalist.matches.find((m) => m.image_url)?.image_url ?? null;
    const finalImage = tmdbImage || finalist.signal.image_url || null;

    const entityMatchesJson = {
      titles: finalist.matches
        .filter((m) => m.type === "title")
        .map((m) => ({ name: m.resolved_name, tmdb_id: m.tmdb_id, popularity: m.popularity, media_type: m.media_type })),
      people: finalist.matches
        .filter((m) => m.type === "person")
        .map((m) => ({ name: m.resolved_name, tmdb_id: m.tmdb_id, popularity: m.popularity })),
      reason: finalist.scored.reason,
    };

    const { data: insertedRow, error: insertErr } = await admin
      .from("peekrbuzz_articles")
      .insert({
        slug,
        title: rewrite.title,
        summary: rewrite.summary,
        body_html: rewrite.body_html,
        image_url: finalImage,
        source_url: finalist.signal.source_url,
        source_name: "Peekr",
        language: "es",
        topic_key: topicKey,
        category: "movies",
        editorial_theme: rewrite.editorial_theme || finalist.scored.theme,
        article_status: "daily_candidate",
        is_published: false,
        review_status: "pending_review",
        candidate_for_date: targetDate,
        rss_signal_id: finalist.signal.id,
        entity_matches: entityMatchesJson,
        popularity_score: finalist.popularityScore,
        viral_score: finalist.scored.score,
      })
      .select("id, title")
      .single();

    if (insertErr) {
      failed.push({ signal_id: finalist.signal.id, reason: `DB insert: ${insertErr.message}` });
      continue;
    }
    if (insertedRow) inserted.push({ id: insertedRow.id, title: insertedRow.title });
  }

  return NextResponse.json({
    ok: true,
    target_date: targetDate,
    signals_scanned: signalsTyped.length,
    scored_count: scored.length,
    shortlisted: shortlist.length,
    tmdb_verified: verifiedCandidates.length,
    candidates_inserted: inserted.length,
    inserted,
    failed,
  });
}
