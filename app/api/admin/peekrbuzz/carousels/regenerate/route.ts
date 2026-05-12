import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateCarouselForArticle, CarouselGenerateError } from "@/lib/peekrbuzz-daily/carousel-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/carousels/regenerate
 *
 * Body: { carousel_id: number }
 *
 * Marks the current carousel as 'discarded' and generates a new version for
 * the same article. The new row has version = max(version) + 1.
 *
 * Only allowed when the current row is in 'draft' status — approved/published
 * rows cannot be regenerated (delete from IG first, then regen if needed).
 */
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

  // ── Load current row ───────────────────────────────────────────────────────
  const { data: current, error: loadErr } = await admin
    .from("peekrbuzz_carousels")
    .select("id, article_id, status")
    .eq("id", carouselId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: `lookup: ${loadErr.message}` }, { status: 500 });
  if (!current) return NextResponse.json({ error: `carousel ${carouselId} not found` }, { status: 404 });
  if (current.status !== "draft") {
    return NextResponse.json(
      { error: `cannot regenerate from status='${current.status}' — only drafts are regeneratable` },
      { status: 400 },
    );
  }

  // ── Env ────────────────────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  if (!tmdbApiKey) return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });

  // ── Discard current, then generate new ─────────────────────────────────────
  const { error: discardErr } = await admin
    .from("peekrbuzz_carousels")
    .update({ status: "discarded" })
    .eq("id", carouselId);
  if (discardErr) {
    return NextResponse.json({ error: `discard: ${discardErr.message}` }, { status: 500 });
  }

  try {
    const result = await generateCarouselForArticle(admin, current.article_id, { tmdbApiKey, geminiKey });
    return NextResponse.json({ ok: true, discarded_id: carouselId, ...result });
  } catch (err) {
    // Roll back the discard so the editor doesn't lose their last good draft.
    await admin
      .from("peekrbuzz_carousels")
      .update({ status: "draft" })
      .eq("id", carouselId);

    if (err instanceof CarouselGenerateError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
