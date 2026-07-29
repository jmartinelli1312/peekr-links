import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/dashboard/stat-carousel/publish
 *
 * Body: { id: string, target: "sneakpeek" | "ig" }
 *
 * - target "sneakpeek": publishes the stat carousel as a SneakPeek carousel in
 *   the Flutter app UNDER THE CALLER'S OWN ACCOUNT, with the top-5 titles as
 *   referenced titles. Stamps stat_carousels.sneakpeek_id.
 * - target "ig": queues it into peekrbuzz_ig_queue as draft_type='stat_carousel'
 *   with status='pending_review' — the admin approves it from the editorial
 *   dashboard, which posts it to Peekr's official Instagram. Stamps ig_queue_id.
 *
 * Auth: Bearer token; the caller must own the stat_carousels row (or be admin).
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

  const { data: prof } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = !!prof?.is_admin;

  // ── Body ───────────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; target?: unknown };
  const id = typeof body.id === "string" ? body.id : null;
  const target = body.target === "sneakpeek" || body.target === "ig" ? body.target : null;
  if (!id || !target) {
    return NextResponse.json({ error: "id (string) and target ('sneakpeek'|'ig') required" }, { status: 400 });
  }

  // ── Load + ownership ───────────────────────────────────────────────────────
  const { data: row, error: rowErr } = await admin
    .from("stat_carousels")
    .select("id, user_id, heading, caption, slide_urls, items, sneakpeek_id, ig_queue_id")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) return NextResponse.json({ error: `lookup: ${rowErr.message}` }, { status: 500 });
  if (!row) return NextResponse.json({ error: `stat carousel ${id} not found` }, { status: 404 });
  if (row.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const slideUrls = (row.slide_urls as string[] | null) ?? [];
  if (slideUrls.length < 2) {
    return NextResponse.json({ error: "carousel has no rendered slides" }, { status: 400 });
  }

  type Item = {
    rank: number; tmdb_id: number; media_type: string;
    title: string | null; poster_path: string | null;
  };
  const items = Array.isArray(row.items) ? (row.items as Item[]) : [];

  // ── Target: SneakPeek under the caller's account ───────────────────────────
  if (target === "sneakpeek") {
    if (row.sneakpeek_id) {
      return NextResponse.json({ ok: true, already: true, sneakpeek_id: row.sneakpeek_id });
    }
    const { data: sp, error: spErr } = await admin
      .from("sneak_peeks")
      .insert({
        creator_id: row.user_id,
        content_type: "carousel",
        image_urls: slideUrls,
        thumbnail_url: slideUrls[0],
        caption: row.caption ?? row.heading ?? null,
        is_published: true,
      })
      .select("id")
      .single();
    if (spErr || !sp) {
      return NextResponse.json({ error: `sneak_peek insert: ${spErr?.message ?? "no row"}` }, { status: 500 });
    }
    const sneakPeekId = sp.id as string;

    if (items.length > 0) {
      const refs = items.map((it) => ({
        sneak_peek_id: sneakPeekId,
        tmdb_id: it.tmdb_id,
        media_type: it.media_type,
        title: it.title,
        poster_path: it.poster_path,
        ref_type: "title",
      }));
      const { error: refErr } = await admin.from("sneak_peek_title_refs").insert(refs);
      if (refErr) console.error("[stat-carousel/publish] title_refs failed:", refErr.message);
    }

    await admin.from("stat_carousels").update({ sneakpeek_id: sneakPeekId }).eq("id", id);
    return NextResponse.json({ ok: true, sneakpeek_id: sneakPeekId, titles_linked: items.length });
  }

  // ── Target: IG → editorial review queue ────────────────────────────────────
  if (row.ig_queue_id) {
    return NextResponse.json({ ok: true, already: true, ig_queue_id: row.ig_queue_id });
  }
  const { data: draft, error: draftErr } = await admin
    .from("peekrbuzz_ig_queue")
    .insert({
      draft_type: "stat_carousel",
      hook_text: row.heading,
      caption: row.caption ?? row.heading,
      seed_title: row.heading,
      seed_poster_url: slideUrls[0],
      source_label: "Peekr · Stats",
      language: "es",
      slide_urls: slideUrls,
      status: "pending_review",
      reco_tmdb_ids: items.map((i) => i.tmdb_id),
    })
    .select("id")
    .single();
  if (draftErr || !draft) {
    return NextResponse.json({ error: `ig_queue insert: ${draftErr?.message ?? "no row"}` }, { status: 500 });
  }
  const igQueueId = draft.id as string;
  await admin.from("stat_carousels").update({ ig_queue_id: igQueueId }).eq("id", id);
  return NextResponse.json({ ok: true, ig_queue_id: igQueueId, review: "pending_review" });
}
