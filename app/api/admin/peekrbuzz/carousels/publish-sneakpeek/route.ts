import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // PNG rendering + upload of the slides

const SITE = "https://www.peekr.app";

/**
 * POST /api/admin/peekrbuzz/carousels/publish-sneakpeek
 *
 * Body: { carousel_id: number }
 *
 * Publishes a peekrbuzz (cinematic) carousel as a Flutter SneakPeek carousel
 * under @peekr_oficial. Unlike the weekend-reco flow, these carousels are
 * topical (article-based) and don't reference TMDB titles — so NO title refs
 * are attached, just the rendered slide images.
 *
 * Flow:
 *   1. Load carousel from peekrbuzz_carousels.
 *   2. Render each slide PNG (/api/buzz-carousel-slide) → upload to Storage.
 *   3. INSERT sneak_peeks (content_type='carousel', is_published=true).
 *   4. Stamp peekrbuzz_carousels.sneakpeek_id so it can't double-publish.
 */

interface SlideJson {
  n: number;
  kind: "hook" | "body" | "thesis";
  headline: string;
  body: string | null;
  image_url: string | null;
}

interface CarouselRow {
  id: number;
  status: string;
  category: string | null;
  category_emoji: string | null;
  caption: string | null;
  palette: { primary?: string; secondary?: string; accent?: string; bg?: string } | null;
  slides: SlideJson[];
  sneakpeek_id: string | null;
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

  // ── Load carousel ──────────────────────────────────────────────────────────
  const { data: carouselData, error: carouselErr } = await admin
    .from("peekrbuzz_carousels")
    .select("id, status, category, category_emoji, caption, palette, slides, sneakpeek_id")
    .eq("id", carouselId)
    .maybeSingle();
  if (carouselErr) return NextResponse.json({ error: `lookup carousel: ${carouselErr.message}` }, { status: 500 });
  if (!carouselData) return NextResponse.json({ error: `carousel ${carouselId} not found` }, { status: 404 });

  const carousel = carouselData as unknown as CarouselRow;
  if (carousel.sneakpeek_id) {
    return NextResponse.json({ ok: true, already: true, sneakpeek_id: carousel.sneakpeek_id });
  }
  if (!Array.isArray(carousel.slides) || carousel.slides.length < 2) {
    return NextResponse.json(
      { error: `carousel has ${carousel.slides?.length ?? 0} slides; need ≥ 2` },
      { status: 400 },
    );
  }

  // ── Resolve @peekr_oficial ─────────────────────────────────────────────────
  const { data: official } = await admin
    .from("profiles")
    .select("id")
    .eq("username", "peekr_oficial")
    .maybeSingle();
  if (!official?.id) {
    return NextResponse.json({ error: "@peekr_oficial account not found" }, { status: 500 });
  }

  // ── Render + upload slides ─────────────────────────────────────────────────
  const palette = {
    p:  carousel.palette?.primary   ?? "#FA0082",
    s:  carousel.palette?.secondary ?? "#6B0035",
    a:  carousel.palette?.accent    ?? "#FFC8E2",
    bg: carousel.palette?.bg        ?? "#0B0610",
  };
  const category = carousel.category       ?? "PEEKRBUZZ";
  const emoji    = carousel.category_emoji ?? "🎬";
  const total    = carousel.slides.length;

  function slideUrl(s: SlideJson): string {
    const p = new URLSearchParams();
    p.set("kind", s.kind);
    p.set("n", String(s.n));
    p.set("total", String(total));
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

  const renders = await Promise.all(
    carousel.slides.map(async (s) => {
      const res = await fetch(slideUrl(s), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`render slide ${s.n} ${res.status}`);
      return { n: s.n, buf: await res.arrayBuffer() };
    }),
  ).catch((err) => ({ __error: err instanceof Error ? err.message : String(err) } as const));

  if ("__error" in renders) {
    return NextResponse.json({ error: `render: ${renders.__error}` }, { status: 500 });
  }

  const folder = `cinematic/${carouselId}`;
  for (const r of renders) {
    const { error: upErr } = await admin.storage
      .from("buzz-slides")
      .upload(`${folder}/slide-${r.n}.png`, r.buf, { contentType: "image/png", upsert: true });
    if (upErr) {
      return NextResponse.json({ error: `upload slide ${r.n}: ${upErr.message}` }, { status: 500 });
    }
  }

  const slideUrls = renders
    .sort((a, b) => a.n - b.n)
    .map((r) => admin.storage.from("buzz-slides").getPublicUrl(`${folder}/slide-${r.n}.png`).data.publicUrl);

  // ── Create the SneakPeek (no title refs) ───────────────────────────────────
  const { data: sp, error: spErr } = await admin
    .from("sneak_peeks")
    .insert({
      creator_id: official.id,
      content_type: "carousel",
      image_urls: slideUrls,
      thumbnail_url: slideUrls[0],
      caption: carousel.caption ?? null,
      is_published: true,
    })
    .select("id")
    .single();
  if (spErr || !sp) {
    return NextResponse.json({ error: `sneak_peek insert: ${spErr?.message ?? "no row"}` }, { status: 500 });
  }
  const sneakPeekId = sp.id as string;

  // ── Stamp the carousel so it can't double-publish ──────────────────────────
  await admin
    .from("peekrbuzz_carousels")
    .update({ sneakpeek_id: sneakPeekId })
    .eq("id", carouselId);

  return NextResponse.json({ ok: true, sneakpeek_id: sneakPeekId, slides: slideUrls.length });
}
