import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateCarouselForArticle, CarouselGenerateError } from "@/lib/peekrbuzz-daily/carousel-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/carousels/generate
 *
 * Body: { article_id: number }
 *
 * Generates the FIRST cinematic carousel draft for a published Peekrbuzz article.
 * If a draft already exists for the article, returns that one instead — use
 * /regenerate to create a new version.
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
  const body = (await req.json().catch(() => ({}))) as { article_id?: unknown };
  const articleId = typeof body.article_id === "number" ? body.article_id : Number(body.article_id);
  if (!Number.isFinite(articleId) || articleId <= 0) {
    return NextResponse.json({ error: "article_id must be a positive integer" }, { status: 400 });
  }

  // ── Idempotency: if there's already a live draft, return it ─────────────────
  const { data: existing, error: existErr } = await admin
    .from("peekrbuzz_carousels")
    .select("id, version, status")
    .eq("article_id", articleId)
    .in("status", ["draft", "approved", "published"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existErr) {
    return NextResponse.json({ error: `lookup: ${existErr.message}` }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({
      ok: true,
      reused: true,
      carousel_id: existing.id,
      version: existing.version,
      status: existing.status,
    });
  }

  // ── Env ────────────────────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  if (!tmdbApiKey) return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });

  // ── Generate ───────────────────────────────────────────────────────────────
  try {
    const result = await generateCarouselForArticle(admin, articleId, { tmdbApiKey, geminiKey });
    return NextResponse.json({ ok: true, reused: false, ...result });
  } catch (err) {
    if (err instanceof CarouselGenerateError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
