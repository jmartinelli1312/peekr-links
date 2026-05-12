import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // PNG rendering + upload of 10 slides

const SITE = "https://www.peekr.app";

/**
 * POST /api/admin/peekrbuzz/carousels/approve
 *
 * Body: { carousel_id: number }
 *
 * Flow:
 *   1. Load carousel + parent article (we need slug for article_url).
 *   2. For each of the 10 slides, fetch its rendered PNG from
 *      /api/buzz-carousel-slide and upload to
 *      Supabase Storage: buzz-slides/cinematic/{carousel_id}/slide-{n}.png
 *   3. Build public URLs and INSERT into peekrbuzz_ig_queue with status='approved'
 *      and scheduled_for=now().
 *   4. Update carousels row: status='approved', ig_queue_id=<new id>.
 *   5. Fire-and-forget POST to the social_publisher edge function so the
 *      Instagram/Facebook/Threads post happens immediately (no 15-min cron wait).
 *
 * Returns once steps 1-4 complete; step 5 races in the background.
 */

interface SlideJson {
  n: number;
  kind: "hook" | "body" | "thesis";
  headline: string;
  body: string | null;
  image_url: string | null;
  image_credit: string | null;
}

interface CarouselRow {
  id: number;
  article_id: number;
  status: string;
  category: string | null;
  category_emoji: string | null;
  title: string | null;
  caption: string | null;
  palette: { primary?: string; secondary?: string; accent?: string; bg?: string } | null;
  slides: SlideJson[];
}

interface ArticleRow {
  id: number;
  slug: string;
  title: string;
  language: string;
  image_url: string | null;
  source_name: string | null;
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ── Body ───────────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { carousel_id?: unknown };
  const carouselId = typeof body.carousel_id === "number" ? body.carousel_id : Number(body.carousel_id);
  if (!Number.isFinite(carouselId) || carouselId <= 0) {
    return NextResponse.json({ error: "carousel_id must be a positive integer" }, { status: 400 });
  }

  // ── 1. Load carousel + article ─────────────────────────────────────────────
  const { data: carouselData, error: carouselErr } = await admin
    .from("peekrbuzz_carousels")
    .select("id, article_id, status, category, category_emoji, title, caption, palette, slides")
    .eq("id", carouselId)
    .maybeSingle();
  if (carouselErr) return NextResponse.json({ error: `lookup carousel: ${carouselErr.message}` }, { status: 500 });
  if (!carouselData) return NextResponse.json({ error: `carousel ${carouselId} not found` }, { status: 404 });

  const carousel = carouselData as unknown as CarouselRow;
  if (carousel.status !== "draft") {
    return NextResponse.json(
      { error: `cannot approve from status='${carousel.status}' — already actioned` },
      { status: 400 },
    );
  }
  if (!Array.isArray(carousel.slides) || carousel.slides.length !== 10) {
    return NextResponse.json({ error: `carousel ${carouselId} has ${carousel.slides?.length ?? 0} slides, expected 10` }, { status: 500 });
  }

  const { data: articleData, error: articleErr } = await admin
    .from("peekrbuzz_articles")
    .select("id, slug, title, language, image_url, source_name")
    .eq("id", carousel.article_id)
    .maybeSingle();
  if (articleErr || !articleData) {
    return NextResponse.json({ error: `lookup article: ${articleErr?.message ?? "not found"}` }, { status: 500 });
  }
  const article = articleData as unknown as ArticleRow;

  // ── 2. Render + upload slides ──────────────────────────────────────────────
  const palette = {
    p:  carousel.palette?.primary   ?? "#FA0082",
    s:  carousel.palette?.secondary ?? "#6B0035",
    a:  carousel.palette?.accent    ?? "#FFC8E2",
    bg: carousel.palette?.bg        ?? "#0B0610",
  };
  const category = carousel.category       ?? "PEEKRBUZZ";
  const emoji    = carousel.category_emoji ?? "🎬";

  function slideUrl(s: SlideJson): string {
    const p = new URLSearchParams();
    p.set("kind", s.kind);
    p.set("n", String(s.n));
    p.set("total", "10");
    p.set("headline", s.headline.slice(0, 200));
    if (s.body) p.set("body", s.body.slice(0, 280));
    if (s.image_url) p.set("img", s.image_url);
    p.set("category", category);
    p.set("emoji", emoji);
    p.set("palette_p",  palette.p);
    p.set("palette_s",  palette.s);
    p.set("palette_a",  palette.a);
    p.set("palette_bg", palette.bg);
    return `${SITE}/api/buzz-carousel-slide?${p.toString()}`;
  }

  // Render all 10 slides in parallel.
  const renders = await Promise.all(
    carousel.slides.map(async (s) => {
      const url = slideUrl(s);
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`render slide ${s.n} ${res.status}`);
      const buf = await res.arrayBuffer();
      return { n: s.n, buf };
    }),
  ).catch((err) => {
    return { __error: err instanceof Error ? err.message : String(err) } as const;
  });

  if ("__error" in renders) {
    return NextResponse.json({ error: `render: ${renders.__error}` }, { status: 500 });
  }

  // Upload all 10 to Supabase Storage.
  const folder = `cinematic/${carouselId}`;
  for (const r of renders) {
    const { error: upErr } = await admin
      .storage
      .from("buzz-slides")
      .upload(`${folder}/slide-${r.n}.png`, r.buf, {
        contentType: "image/png",
        upsert: true,
      });
    if (upErr) {
      return NextResponse.json({ error: `upload slide ${r.n}: ${upErr.message}` }, { status: 500 });
    }
  }

  const slideUrls = renders
    .sort((a, b) => a.n - b.n)
    .map((r) => admin.storage.from("buzz-slides").getPublicUrl(`${folder}/slide-${r.n}.png`).data.publicUrl);

  // ── 3. Insert into peekrbuzz_ig_queue (status='approved', scheduled_for=now()) ─
  const articleUrl = article.language === "es"
    ? `${SITE}/es/buzz/${article.slug}`
    : `${SITE}/${article.language}/buzz/${article.slug}`;

  const hookSlide = carousel.slides[0];

  const { data: queueRow, error: queueErr } = await admin
    .from("peekrbuzz_ig_queue")
    .insert({
      // We populate the legacy fields so older code paths still work, but the
      // cinematic publisher path will use `caption` + `slide_urls` directly.
      draft_type: "actualidad",
      hook_text: hookSlide.headline,
      bullet_points: carousel.slides.slice(1, 9).map((s) => s.headline),
      seed_title: article.title,
      seed_poster_url: article.image_url,
      source_label: article.source_name ?? "PeekrBuzz",
      language: "es",
      article_url: articleUrl,
      slide_urls: slideUrls,
      caption: carousel.caption ?? "",
      status: "approved",
      scheduled_for: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (queueErr || !queueRow) {
    return NextResponse.json({ error: `queue insert: ${queueErr?.message ?? "no id"}` }, { status: 500 });
  }

  const igQueueId = queueRow.id as string;

  // ── 4. Update carousel row ─────────────────────────────────────────────────
  const { error: updErr } = await admin
    .from("peekrbuzz_carousels")
    .update({ status: "approved", ig_queue_id: igQueueId })
    .eq("id", carouselId);
  if (updErr) {
    return NextResponse.json({ error: `update carousel: ${updErr.message}` }, { status: 500 });
  }

  // ── 5. Fire-and-forget trigger of social_publisher edge function ───────────
  // We don't await: publishing IG/FB/Threads/Bluesky can take 30-90s, but the
  // UI just needs to know the carousel is queued. The user can refresh the
  // dashboard to see published_at / ig_media_id later.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    void fetch(`${supabaseUrl}/functions/v1/social_publisher`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => {
      console.error("[carousels/approve] fire-and-forget social_publisher failed:", err);
    });
  }

  return NextResponse.json({
    ok: true,
    carousel_id: carouselId,
    ig_queue_id: igQueueId,
    slide_urls: slideUrls,
    article_url: articleUrl,
    status: "approved",
    publisher_triggered: !!(supabaseUrl && serviceKey),
  });
}
