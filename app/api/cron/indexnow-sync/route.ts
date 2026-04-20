import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { submitUrlsToIndexNow } from "@/lib/indexnow";

/**
 * Scheduled IndexNow sync — runs on Vercel Cron every 6h.
 *
 * Finds content that changed since the last sync window and pushes those
 * URLs to IndexNow (Bing, Yandex, Seznam, Naver, Yep) so non-Google engines
 * see new Peekr content within hours instead of days.
 *
 * Auth: Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}`
 * when the CRON_SECRET env var is set. We also accept INDEXNOW_API_SECRET
 * so humans can trigger the sync manually from curl.
 *
 * Safe to run anytime — idempotent, no DB writes, always caps at 10k URLs.
 */

const SITE = "https://www.peekr.app";
const LANGS = ["es", "en", "pt"] as const;

// Look-back window — covers us even if a previous run failed or was skipped.
const LOOKBACK_HOURS = 24;

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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

  const since = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Collect URLs from every content type that changed recently.
  const urls: string[] = [];

  // 1) Static hub pages — nudge crawlers once a day since indexes rotate.
  for (const lang of LANGS) {
    urls.push(
      `${SITE}/${lang}`,
      `${SITE}/${lang}/lists`,
      `${SITE}/${lang}/buzz`,
      `${SITE}/${lang}/explore`
    );
  }

  // 2) Editorial collections published or updated in the window.
  const { data: collections } = await supabase
    .from("editorial_collections")
    .select("slug,updated_at,is_published,item_count")
    .eq("is_published", true)
    .gt("item_count", 0)
    .gte("updated_at", since)
    .limit(500);

  for (const row of collections ?? []) {
    if (!row.slug) continue;
    for (const lang of LANGS) {
      urls.push(`${SITE}/${lang}/lists/${row.slug}`);
    }
  }

  // 3) Buzz articles published in the window.
  const { data: buzz } = await supabase
    .from("peekrbuzz_articles")
    .select("slug,published_at,updated_at,is_published")
    .eq("is_published", true)
    .or(`published_at.gte.${since},updated_at.gte.${since}`)
    .limit(500);

  for (const row of buzz ?? []) {
    if (!row.slug) continue;
    for (const lang of LANGS) {
      urls.push(`${SITE}/${lang}/buzz/${row.slug}`);
    }
  }

  // 4) Titles with fresh engagement — someone watched/rated them recently,
  // which means stats changed so the "On Peekr" section has new content.
  const { data: titles } = await supabase
    .from("titles_cache")
    .select("tmdb_id,media_type,title,updated_at")
    .not("tmdb_id", "is", null)
    .not("title", "is", null)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(300);

  for (const row of titles ?? []) {
    if (!row.tmdb_id || !row.title) continue;
    const type = row.media_type === "tv" ? "tv" : "movie";
    const slug = slugify(row.title);
    for (const lang of LANGS) {
      urls.push(`${SITE}/${lang}/title/${type}/${row.tmdb_id}-${slug}`);
    }
  }

  if (urls.length === 0) {
    return NextResponse.json({
      ok: true,
      submitted: 0,
      message: "No recent content to submit",
      window_hours: LOOKBACK_HOURS,
    });
  }

  const result = await submitUrlsToIndexNow(urls);

  return NextResponse.json({
    ok: result.ok,
    submitted: result.submitted,
    status: result.status,
    message: result.message,
    window_hours: LOOKBACK_HOURS,
    breakdown: {
      static: LANGS.length * 4,
      editorial: (collections?.length ?? 0) * LANGS.length,
      buzz: (buzz?.length ?? 0) * LANGS.length,
      titles: (titles?.length ?? 0) * LANGS.length,
    },
  });
}
