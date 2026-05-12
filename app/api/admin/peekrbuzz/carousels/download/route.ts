import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

const SITE = "https://www.peekr.app";

interface SlideJson {
  n: number;
  kind: "hook" | "body" | "thesis";
  headline: string;
  body: string | null;
  image_url: string | null;
}

interface CarouselRow {
  id: number;
  article_id: number;
  category: string | null;
  category_emoji: string | null;
  title: string | null;
  caption: string | null;
  palette: { primary?: string; secondary?: string; accent?: string; bg?: string } | null;
  slides: SlideJson[];
}

/**
 * GET /api/admin/peekrbuzz/carousels/download?carousel_id=NN
 *
 * Builds a ZIP containing slide-01.png … slide-10.png by fetching each rendered
 * PNG from /api/buzz-carousel-slide and bundling them with JSZip. Used so the
 * editor can grab all 10 slides at once, save to phone, and post manually to
 * TikTok / Threads / wherever.
 *
 * Auth: admin session (same shape as the other carousel routes — token via
 * the Supabase access_token Bearer).
 *
 * GET (not POST) so the link can be hit directly from an <a download> tag.
 */
export async function GET(req: NextRequest) {
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

  // ── Params ─────────────────────────────────────────────────────────────────
  const idParam = req.nextUrl.searchParams.get("carousel_id");
  const carouselId = idParam ? Number(idParam) : NaN;
  if (!Number.isFinite(carouselId) || carouselId <= 0) {
    return NextResponse.json({ error: "carousel_id must be a positive integer" }, { status: 400 });
  }

  // ── Load carousel ──────────────────────────────────────────────────────────
  const { data, error: loadErr } = await admin
    .from("peekrbuzz_carousels")
    .select("id, article_id, category, category_emoji, title, caption, palette, slides")
    .eq("id", carouselId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: `lookup: ${loadErr.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: `carousel ${carouselId} not found` }, { status: 404 });
  const carousel = data as unknown as CarouselRow;

  if (!Array.isArray(carousel.slides) || carousel.slides.length === 0) {
    return NextResponse.json({ error: `carousel ${carouselId} has no slides` }, { status: 500 });
  }

  // ── Build slide URLs ───────────────────────────────────────────────────────
  const palette = {
    p:  carousel.palette?.primary   ?? "#FA0082",
    s:  carousel.palette?.secondary ?? "#6B0035",
    a:  carousel.palette?.accent    ?? "#FFC8E2",
    bg: carousel.palette?.bg        ?? "#0B0610",
  };
  const category = carousel.category       ?? "PEEKRBUZZ";
  const emoji    = carousel.category_emoji ?? "🎬";

  function slideUrl(s: SlideJson, total: number): string {
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

  // ── Fetch all slide PNGs in parallel ───────────────────────────────────────
  const slides = carousel.slides.slice().sort((a, b) => a.n - b.n);
  const renders = await Promise.all(
    slides.map(async (s) => {
      const url = slideUrl(s, slides.length);
      const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) {
        throw new Error(`render slide ${s.n}: HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { n: s.n, buf };
    }),
  ).catch((err) => ({ __error: err instanceof Error ? err.message : String(err) } as const));

  if ("__error" in renders) {
    return NextResponse.json({ error: `render: ${renders.__error}` }, { status: 500 });
  }

  // ── Build ZIP (STORE — PNGs are already compressed) ───────────────────────
  const zip = new JSZip();
  const folderName = `peekr-carousel-${carouselId}`;
  const folder = zip.folder(folderName);
  if (!folder) {
    return NextResponse.json({ error: "zip folder creation failed" }, { status: 500 });
  }
  for (const r of renders) {
    const name = `slide-${String(r.n).padStart(2, "0")}.png`;
    folder.file(name, r.buf, { binary: true });
  }
  // Include the IG caption as a text file for easy copy-paste on mobile.
  if (carousel.caption) {
    folder.file("caption.txt", carousel.caption);
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });

  return new Response(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folderName}.zip"`,
      "Content-Length": String(zipBuf.length),
      "Cache-Control": "no-store",
    },
  });
}
