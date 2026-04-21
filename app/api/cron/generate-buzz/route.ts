import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { submitUrlsToIndexNow } from "@/lib/indexnow";
import {
  findTrendingTitle,
  fetchTmdbDetails,
  fetchTmdbRecommendations,
  renderWhatToWatchAfter,
  type Lang,
} from "@/lib/buzz-generator";

/**
 * GET /api/cron/generate-buzz
 *
 * Daily programmatic-SEO generator. Produces 3 Peekr Buzz articles
 * (one per ES/EN/PT) from the most-trending title in the last 24h:
 *   - "Qué ver después de [title]"
 *   - "What to watch after [title]"
 *   - "O que assistir depois de [title]"
 *
 * Each article is 600–800 words with H2/H3 structure and internal
 * links to 6–8 TMDB-recommended similar titles. Upserts by slug so
 * running the same day is safe.
 *
 * After publishing, pings IndexNow so Bing/Yandex index immediately.
 *
 * Auth: accepts Vercel Cron's auto-injected `Bearer ${CRON_SECRET}`
 * or the existing `Bearer ${INDEXNOW_API_SECRET}` for manual triggers.
 */

const SITE = "https://www.peekr.app";
const LANGS: Lang[] = ["es", "en", "pt"];

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const apiSecret = process.env.INDEXNOW_API_SECRET;

  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (apiSecret && auth === `Bearer ${apiSecret}`) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // 1) Pick the trending title for this cycle.
  const trending = await findTrendingTitle();
  if (!trending) {
    return NextResponse.json({
      ok: false,
      message: "No trending title in the last 24h and no fallback available",
    });
  }

  // 2) For each language, fetch localized TMDB data and render an article.
  const admin = getSupabaseAdmin();
  const created: { lang: Lang; slug: string; url: string }[] = [];
  const skipped: { lang: Lang; reason: string }[] = [];

  for (const lang of LANGS) {
    const source = await fetchTmdbDetails(
      trending.tmdb_id,
      trending.media_type,
      lang
    );

    if (!source || !source.title) {
      skipped.push({ lang, reason: "Could not fetch TMDB details" });
      continue;
    }

    const recs = await fetchTmdbRecommendations(
      trending.tmdb_id,
      trending.media_type,
      lang,
      8
    );

    if (recs.length < 3) {
      skipped.push({
        lang,
        reason: `Only ${recs.length} recommendations — not enough to publish`,
      });
      continue;
    }

    const article = renderWhatToWatchAfter(source, recs, lang);

    // Upsert on slug so same-day re-runs don't duplicate.
    const { error } = await admin
      .from("peekrbuzz_articles")
      .upsert(
        {
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          body_html: article.body_html,
          image_url: article.image_url,
          source_name: article.source_name,
          source_url: null,
          category: article.category,
          language: article.language,
          topic_key: article.topic_key,
          is_published: true,
          published_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );

    if (error) {
      skipped.push({ lang, reason: `DB error: ${error.message}` });
      continue;
    }

    created.push({
      lang,
      slug: article.slug,
      url: `${SITE}/${lang}/buzz/${article.slug}`,
    });
  }

  // 3) Ping IndexNow so Bing/Yandex index the new articles immediately.
  let indexnowResult = null;
  if (created.length > 0) {
    indexnowResult = await submitUrlsToIndexNow(created.map((c) => c.url));
  }

  return NextResponse.json({
    ok: created.length > 0,
    trendingTitle: {
      tmdb_id: trending.tmdb_id,
      media_type: trending.media_type,
      recent_activity_count: trending.recent_activity_count,
    },
    created,
    skipped,
    indexnowResult,
  });
}
