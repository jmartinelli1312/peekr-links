import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/buzz-generator";
import { todayInArgentina } from "@/lib/peekrbuzz-daily/argentina";
import { callGeminiJson, GeminiError } from "@/lib/peekrbuzz-daily/gemini";
import { buildTranslatePrompt } from "@/lib/peekrbuzz-daily/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/approve-daily
 *
 * Body: { candidate_ids: [<id1>, <id2>] }
 *
 * Effects (all under admin auth):
 *   1. Translates each selected ES candidate to EN + PT (Gemini)
 *   2. Inserts EN + PT rows linked by topic_key
 *   3. Flips ES + EN + PT to article_status='published', is_published=true
 *   4. Marks all other daily_candidate rows for today as 'rejected'
 *
 * Returns per-candidate status so the UI can show "Publicado en ES, EN, PT".
 */

type TranslateOutput = {
  title: string;
  summary: string;
  body_html: string;
  editorial_theme: string;
};

export async function POST(req: NextRequest) {
  // ── 1. Auth (admin) ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Parse body ───────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { candidate_ids?: unknown; target_date?: string };
  const ids = Array.isArray(body.candidate_ids) ? body.candidate_ids : [];
  const candidateIds = ids
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (candidateIds.length === 0 || candidateIds.length > 2) {
    return NextResponse.json({ error: "candidate_ids must be an array of 1 or 2 numeric ids" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });

  // ── 3. Fetch the selected ES candidates ─────────────────────────────────────
  const { data: candidates, error: fetchErr } = await admin
    .from("peekrbuzz_articles")
    .select(
      "id, slug, title, summary, body_html, image_url, source_url, source_name, editorial_theme, topic_key, candidate_for_date, entity_matches, popularity_score, viral_score, rss_signal_id",
    )
    .in("id", candidateIds)
    .eq("language", "es")
    .eq("article_status", "daily_candidate");

  if (fetchErr) {
    return NextResponse.json({ error: `fetch candidates: ${fetchErr.message}` }, { status: 500 });
  }
  if (!candidates || candidates.length !== candidateIds.length) {
    return NextResponse.json(
      { error: `expected ${candidateIds.length} candidates, got ${candidates?.length ?? 0}` },
      { status: 400 },
    );
  }

  type Candidate = {
    id: number;
    slug: string;
    title: string;
    summary: string;
    body_html: string;
    image_url: string | null;
    source_url: string | null;
    source_name: string | null;
    editorial_theme: string | null;
    topic_key: string | null;
    candidate_for_date: string | null;
    entity_matches: unknown;
    popularity_score: number | null;
    viral_score: number | null;
    rss_signal_id: number | null;
  };
  const cands = candidates as Candidate[];

  const targetDate = body.target_date || cands[0].candidate_for_date || todayInArgentina();
  const nowIso = new Date().toISOString();

  // ── 4. For each candidate: translate to EN + PT, insert, then publish ───────
  const results: Array<{
    candidate_id: number;
    title: string;
    published_es: boolean;
    published_en: boolean;
    published_pt: boolean;
    errors: string[];
  }> = [];

  for (const cand of cands) {
    const errors: string[] = [];

    // Ensure a stable topic_key shared by all 3 language siblings.
    const topicKeyBase = (cand.topic_key ?? `pbz-daily-${targetDate}-${cand.rss_signal_id ?? cand.id}`).replace(
      /-(es|en|pt)$/i,
      "",
    );
    const esTopicKey = `${topicKeyBase}-es`;
    const enTopicKey = `${topicKeyBase}-en`;
    const ptTopicKey = `${topicKeyBase}-pt`;

    // 4a — Translate ES → EN and ES → PT in parallel.
    const [enRes, ptRes] = await Promise.all([
      translateCandidate(cand, "en", geminiKey),
      translateCandidate(cand, "pt", geminiKey),
    ]);

    const publishedSiblings: Array<{ lang: "en" | "pt"; row: TranslateOutput }> = [];
    if (enRes.ok) publishedSiblings.push({ lang: "en", row: enRes.value });
    else errors.push(`EN translate: ${enRes.error}`);
    if (ptRes.ok) publishedSiblings.push({ lang: "pt", row: ptRes.value });
    else errors.push(`PT translate: ${ptRes.error}`);

    // 4b — Insert translated rows as published.
    let publishedEn = false;
    let publishedPt = false;
    for (const sib of publishedSiblings) {
      const slugBase = slugify(sib.row.title || cand.title);
      const sibSlug = `${slugBase}-${sib.lang}-${targetDate.replace(/-/g, "")}-${cand.id}`.slice(0, 110);

      const { error: sibInsertErr } = await admin.from("peekrbuzz_articles").insert({
        slug: sibSlug,
        title: sib.row.title,
        summary: sib.row.summary,
        body_html: sib.row.body_html,
        image_url: cand.image_url,
        source_url: cand.source_url,
        source_name: "Peekr",
        language: sib.lang,
        topic_key: sib.lang === "en" ? enTopicKey : ptTopicKey,
        category: "movies",
        editorial_theme: sib.row.editorial_theme || cand.editorial_theme,
        article_status: "published",
        is_published: true,
        review_status: "published",
        published_at: nowIso,
        candidate_for_date: targetDate,
        rss_signal_id: cand.rss_signal_id,
        entity_matches: cand.entity_matches,
        popularity_score: cand.popularity_score,
        viral_score: cand.viral_score,
      });

      if (sibInsertErr) {
        errors.push(`${sib.lang} insert: ${sibInsertErr.message}`);
      } else {
        if (sib.lang === "en") publishedEn = true;
        else publishedPt = true;
      }
    }

    // 4c — Publish the ES candidate.
    const { error: esUpdateErr } = await admin
      .from("peekrbuzz_articles")
      .update({
        article_status: "published",
        is_published: true,
        review_status: "published",
        published_at: nowIso,
        topic_key: esTopicKey,
      })
      .eq("id", cand.id);

    const publishedEs = !esUpdateErr;
    if (esUpdateErr) errors.push(`ES update: ${esUpdateErr.message}`);

    results.push({
      candidate_id: cand.id,
      title: cand.title,
      published_es: publishedEs,
      published_en: publishedEn,
      published_pt: publishedPt,
      errors,
    });
  }

  // ── 5. Reject the un-selected candidates for the same date ──────────────────
  const { error: rejectErr, count: rejectedCount } = await admin
    .from("peekrbuzz_articles")
    .update({ article_status: "rejected", review_status: "rejected" }, { count: "exact" })
    .eq("candidate_for_date", targetDate)
    .eq("article_status", "daily_candidate")
    .eq("language", "es")
    .not("id", "in", `(${candidateIds.join(",")})`);

  return NextResponse.json({
    ok: true,
    target_date: targetDate,
    results,
    rejected_count: rejectedCount ?? 0,
    reject_error: rejectErr?.message ?? null,
  });
}

// ── Helper: translate one candidate ──────────────────────────────────────────

async function translateCandidate(
  cand: { title: string; summary: string; body_html: string; editorial_theme: string | null },
  targetLang: "en" | "pt",
  geminiKey: string,
): Promise<{ ok: true; value: TranslateOutput } | { ok: false; error: string }> {
  try {
    const prompt = buildTranslatePrompt({
      source_title: cand.title,
      source_summary: cand.summary,
      source_body_html: cand.body_html,
      editorial_theme: cand.editorial_theme || "actualidad",
      target_lang: targetLang,
    });
    const value = await callGeminiJson<TranslateOutput>(prompt, geminiKey, {
      temperature: 0.6,
      maxOutputTokens: 1500,
    });
    if (!value?.title || !value?.body_html) {
      return { ok: false, error: "Gemini returned incomplete payload" };
    }
    return { ok: true, value };
  } catch (err) {
    const msg = err instanceof GeminiError ? err.message : err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
