import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { gatherReelFacts } from "@/lib/reels/facts";
import { generateReelScript } from "@/lib/reels/script";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * POST /api/admin/reels/create
 *
 * Body: { tmdb_id?: number, media_type?: "movie"|"tv" }
 *   Omit both → auto-pick today's title (top Peekr activity last 7d, no repeats).
 *
 * Creates a title_reels row in status 'script_ready' with facts + AI script.
 * Rendering is a separate step (POST /api/admin/reels/render) so the admin
 * can review/edit the script first.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

  // ── Auth (admin) ───────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });

  // ── Body / pick ────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { tmdb_id?: unknown; media_type?: unknown };
  let tmdbId = typeof body.tmdb_id === "number" ? body.tmdb_id : Number(body.tmdb_id);
  let mediaType = body.media_type === "tv" ? "tv" : body.media_type === "movie" ? "movie" : null;

  if (!Number.isFinite(tmdbId) || tmdbId <= 0 || !mediaType) {
    const { data: picks, error: pickErr } = await admin.rpc("pick_title_for_reel", {});
    if (pickErr) return NextResponse.json({ error: `pick: ${pickErr.message}` }, { status: 500 });
    const top = (picks as Array<{ tmdb_id: number; media_type: "movie" | "tv" }> | null)?.[0];
    if (!top) return NextResponse.json({ error: "No eligible title (need ≥3 ratings in last 7 days, not already reeled)" }, { status: 404 });
    tmdbId = top.tmdb_id;
    mediaType = top.media_type;
  }
  const mt = mediaType as "movie" | "tv";

  // ── Row first (so a failure is visible in the dashboard) ──────────────────
  const { data: row, error: insErr } = await admin
    .from("title_reels")
    .insert({ tmdb_id: tmdbId, media_type: mt, status: "pending_script", created_by: user.id })
    .select("id")
    .single();
  if (insErr || !row) return NextResponse.json({ error: `insert: ${insErr?.message}` }, { status: 500 });
  const id = row.id as string;

  try {
    const facts = await gatherReelFacts(admin, tmdbId, mt, tmdbKey);
    if (!facts.trailerKey) {
      await admin.from("title_reels").update({
        status: "failed", title: facts.title, facts,
        error: "No official YouTube trailer on TMDB for this title",
      }).eq("id", id);
      return NextResponse.json({ error: `"${facts.title}" has no trailer on TMDB`, id }, { status: 422 });
    }

    const script = await generateReelScript(facts);

    await admin.from("title_reels").update({
      status: "script_ready",
      title: facts.title,
      facts,
      script,
      trailer_youtube_key: facts.trailerKey,
      caption: script.caption,
      hashtags: script.hashtags,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ ok: true, id, title: facts.title, media_type: mt, script, facts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("title_reels").update({ status: "failed", error: msg }).eq("id", id);
    return NextResponse.json({ error: msg, id }, { status: 500 });
  }
}
