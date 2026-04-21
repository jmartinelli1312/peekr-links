import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { submitUrlsToIndexNow } from "@/lib/indexnow";
import { generateDailyArticles } from "@/lib/buzz-generator";

/**
 * GET /api/cron/generate-buzz
 *
 * Daily programmatic-SEO generator. Picks a template based on the UTC
 * day of week and produces up to 3 Peekr Buzz articles (one per language:
 * ES/EN/PT) using either Peekr's own engagement data or fresh TMDB data.
 *
 * Week schedule:
 *   Mon   — none (skipped until we add a Peekr-activity-driven recap)
 *   Tue   — weekly-releases       (TMDB now_playing + on_the_air)
 *   Wed   — what-to-watch-after   (Peekr trending → TMDB recommendations)
 *   Thu   — best-of-genre         (TMDB discover, rotating genre)
 *   Fri   — weekly-trending       (TMDB trending/all/week)
 *   Sat   — weekend-platform      (TMDB discover, rotating platform)
 *   Sun   — director-marathon     (TMDB person credits, rotating director)
 *
 * After publishing, pings IndexNow so Bing/Yandex index immediately.
 *
 * Auth: accepts Vercel Cron's auto-injected `Bearer ${CRON_SECRET}`
 * or the existing `Bearer ${INDEXNOW_API_SECRET}` for manual triggers.
 */

const SITE = "https://www.peekr.app";

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

  // Optional `?date=YYYY-MM-DD` override to backfill a specific day or
  // preview another template. Defaults to today's UTC date.
  const dateParam = request.nextUrl.searchParams.get("date");
  const runDate = dateParam ? new Date(`${dateParam}T12:00:00Z`) : new Date();
  if (isNaN(runDate.getTime())) {
    return NextResponse.json(
      { ok: false, message: `Invalid date parameter: ${dateParam}` },
      { status: 400 }
    );
  }

  const batch = await generateDailyArticles(runDate);

  if (batch.articles.length === 0) {
    return NextResponse.json({
      ok: false,
      template: batch.template,
      topic: batch.topic,
      message: "Template produced no publishable articles",
    });
  }

  const admin = getSupabaseAdmin();
  const created: { lang: string; slug: string; url: string }[] = [];
  const skipped: { lang: string; reason: string }[] = [];

  for (const article of batch.articles) {
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
      skipped.push({ lang: article.language, reason: `DB error: ${error.message}` });
      continue;
    }

    created.push({
      lang: article.language,
      slug: article.slug,
      url: `${SITE}/${article.language}/buzz/${article.slug}`,
    });
  }

  // Ping IndexNow for immediate Bing/Yandex indexing.
  let indexnowResult = null;
  if (created.length > 0) {
    indexnowResult = await submitUrlsToIndexNow(created.map((c) => c.url));
  }

  return NextResponse.json({
    ok: created.length > 0,
    template: batch.template,
    topic: batch.topic,
    created,
    skipped,
    indexnowResult,
  });
}
