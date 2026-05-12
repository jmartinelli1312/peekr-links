import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  return !!(cronSecret && auth === `Bearer ${cronSecret}`);
}

// ── Slugify ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 500);
}

// ── XML Parsing helpers ───────────────────────────────────────────────────────

function extractCdata(tag: string, xml: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i"));
  if (match) return match[1].trim();
  // fallback: plain text between tags
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return plain ? plain[1].trim() : "";
}

function extractPlain(tag: string, xml: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function extractImageUrl(itemXml: string): string {
  // Try media:content url="..."
  const mc = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mc) return mc[1];
  // Try enclosure url="..."
  const enc = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enc) return enc[1];
  // Try media:thumbnail url="..."
  const mt = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mt) return mt[1];
  return "";
}

interface RssItem {
  title: string;
  summary: string;
  image_url: string;
  source_url: string;
  published_at: string;
}

function parseRssFeed(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Split on <item> boundaries
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const raw = match[1];

    const title = extractCdata("title", raw) || extractPlain("title", raw);
    const summary = stripHtml(extractCdata("description", raw) || extractPlain("description", raw));
    const image_url = extractImageUrl(raw);

    // <link> in RSS often has no CDATA; but some feeds wrap it — try both
    let source_url = extractCdata("link", raw);
    if (!source_url) source_url = extractPlain("link", raw);
    // Atom-style <link href="..."/> fallback
    if (!source_url) {
      const href = raw.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) source_url = href[1];
    }

    const pubDateRaw = extractPlain("pubDate", raw);
    let published_at = "";
    if (pubDateRaw) {
      const d = new Date(pubDateRaw);
      published_at = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      published_at = new Date().toISOString();
    }

    if (title && source_url) {
      items.push({ title, summary, image_url, source_url, published_at });
    }
  }

  return items;
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface FeedSource {
  url: string;
  language: string;
  source_name: string;
}

const FEEDS: FeedSource[] = [
  // ES — cinema + general entertainment
  { url: "https://cinemascomics.com/feed", language: "es", source_name: "CinemasComics" },
  { url: "https://sensacine.com/rss/noticias.xml", language: "es", source_name: "SensaCine" },
  { url: "https://www.espinof.com/index.xml", language: "es", source_name: "Espinof" },
  // ES — TV / series
  { url: "https://www.eldiario.es/vertele/rss/", language: "es", source_name: "Vertele" },
  // PT
  { url: "https://cinepop.com.br/feed", language: "pt", source_name: "CinePop" },
];

// Drop signals older than this many hours — keeps the candidate pool fresh so
// the daily AI selector only sees recent news, not last week's leftover items.
const MAX_SIGNAL_AGE_HOURS = 36;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Fetch both feeds in parallel
    const feedResults = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "Peekr-Buzz-Bot/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${feed.url}`);
        const xml = await res.text();
        return { feed, items: parseRssFeed(xml) };
      })
    );

    // Collect all parsed items with their feed metadata
    const allItems: Array<RssItem & { language: string; source_name: string }> = [];
    const feedDiagnostics: Array<{ source: string; ok: boolean; count?: number; error?: string }> = [];
    for (let i = 0; i < feedResults.length; i++) {
      const result = feedResults[i];
      const feedMeta = FEEDS[i];
      if (result.status === "fulfilled") {
        const { feed, items } = result.value;
        feedDiagnostics.push({ source: feed.source_name, ok: true, count: items.length });
        for (const item of items) {
          allItems.push({ ...item, language: feed.language, source_name: feed.source_name });
        }
      } else {
        feedDiagnostics.push({
          source: feedMeta.source_name,
          ok: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    // Drop items older than MAX_SIGNAL_AGE_HOURS. A stale "signal" pool would
    // dilute the daily AI selector with last week's news. Items with an
    // unparseable / fallback timestamp (set to "now" upstream) pass through.
    const freshnessThreshold = Date.now() - MAX_SIGNAL_AGE_HOURS * 3_600_000;
    const freshItems = allItems.filter((i) => {
      const ts = new Date(i.published_at).getTime();
      return !Number.isFinite(ts) || ts >= freshnessThreshold;
    });
    const stale = allItems.length - freshItems.length;

    if (freshItems.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, skipped: 0, stale, feeds: feedDiagnostics });
    }

    // Fetch existing source_urls to deduplicate
    const candidateUrls = freshItems.map((i) => i.source_url);
    const { data: existing, error: fetchError } = await admin
      .from("peekrbuzz_articles")
      .select("source_url")
      .in("source_url", candidateUrls);

    if (fetchError) {
      return NextResponse.json(
        { ok: false, message: `DB fetch error: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const existingUrls = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url));

    const newItems = freshItems.filter((i) => !existingUrls.has(i.source_url));
    let inserted = 0;
    const skipped = freshItems.length - newItems.length;

    if (newItems.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, skipped, stale, feeds: feedDiagnostics });
    }

    // Track slugs generated in this batch to avoid within-batch collisions
    const batchSlugs = new Set<string>();

    // Fetch slugs already in DB that might collide
    const candidateSlugs = newItems.map((i) => slugify(i.title));
    const { data: existingSlugs } = await admin
      .from("peekrbuzz_articles")
      .select("slug")
      .in("slug", candidateSlugs);
    const dbSlugs = new Set((existingSlugs ?? []).map((r: { slug: string }) => r.slug));

    const rows = newItems.map((item) => {
      let slug = slugify(item.title);
      // Resolve collision: append 6-char timestamp suffix
      if (dbSlugs.has(slug) || batchSlugs.has(slug)) {
        const suffix = Date.now().toString(36).slice(-6);
        slug = `${slug.slice(0, 83)}-${suffix}`;
      }
      batchSlugs.add(slug);

      const topic_key = `rss-${item.language}-${Date.now()}`;

      return {
        slug,
        title: item.title,
        summary: item.summary,
        image_url: item.image_url || null,
        source_url: item.source_url,
        source_name: item.source_name,
        published_at: item.published_at,
        language: item.language,
        topic_key,
        category: "movies",
        is_published: false,
        review_status: "pending_review",
        // New daily lifecycle: every scraped row enters as a signal awaiting AI selection.
        article_status: "signal",
      };
    });

    // Upsert in chunks of 50 to stay well within payload limits
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error: upsertError, count } = await admin
        .from("peekrbuzz_articles")
        .upsert(chunk, { onConflict: "slug", count: "exact" });

      if (upsertError) {
        // Log but don't abort — partial success is acceptable
        console.error("Upsert error:", upsertError.message);
        continue;
      }

      inserted += count ?? chunk.length;
    }

    return NextResponse.json({ ok: true, inserted, skipped, stale, feeds: feedDiagnostics });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetch-buzz-rss] Unhandled error:", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
