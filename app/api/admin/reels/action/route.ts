import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/admin/reels/action
 *
 * Body: { id: string, action: "render" | "update_script" | "publish_ig" | "discard", script?: object }
 *
 *  render         script_ready|failed → queued (Railway worker picks it up)
 *  update_script  save edited script/caption before rendering
 *  publish_ig     ready → creates a peekrbuzz_ig_queue draft (draft_type='reel',
 *                 status='pending_review') so the existing approve→social_publisher
 *                 flow posts it to Instagram as a Reel
 *  discard        any → discarded (frees the title for future picks)
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: unknown; action?: unknown; script?: unknown; caption?: unknown; hashtags?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  const action = typeof body.action === "string" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const { data: reel, error: loadErr } = await admin.from("title_reels").select("*").eq("id", id).maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!reel) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "update_script") {
    const patch: Record<string, unknown> = { updated_at: now };
    if (body.script && typeof body.script === "object") patch.script = body.script;
    if (typeof body.caption === "string") patch.caption = body.caption;
    if (typeof body.hashtags === "string") patch.hashtags = body.hashtags;
    const { error } = await admin.from("title_reels").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "render") {
    if (!["script_ready", "failed", "ready"].includes(reel.status)) {
      return NextResponse.json({ error: `cannot render from status '${reel.status}'` }, { status: 400 });
    }
    if (!reel.script || !reel.trailer_youtube_key) {
      return NextResponse.json({ error: "reel has no script/trailer" }, { status: 400 });
    }
    const { error } = await admin.from("title_reels")
      .update({ status: "queued", error: null, updated_at: now }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "queued" });
  }

  if (action === "publish_ig") {
    if (reel.status !== "ready" || !reel.video_url) {
      return NextResponse.json({ error: "reel is not rendered yet" }, { status: 400 });
    }
    if (reel.ig_queue_id) return NextResponse.json({ ok: true, already: true, ig_queue_id: reel.ig_queue_id });

    const caption = [reel.caption ?? reel.title, reel.hashtags].filter(Boolean).join("\n\n");
    const { data: draft, error: dErr } = await admin.from("peekrbuzz_ig_queue").insert({
      draft_type: "reel",
      content_type: "reel",
      hook_text: reel.script?.hook ?? reel.title,
      caption,
      seed_title: reel.title,
      seed_poster_url: reel.thumbnail_url,
      source_label: "Peekr · Reel",
      language: "es",
      // social_publisher reads slide_urls; for reels the single entry is the MP4.
      slide_urls: [reel.video_url],
      status: "pending_review",
      reco_tmdb_ids: [reel.tmdb_id],
    }).select("id").single();
    if (dErr || !draft) return NextResponse.json({ error: `ig_queue: ${dErr?.message}` }, { status: 500 });

    await admin.from("title_reels").update({ ig_queue_id: draft.id, updated_at: now }).eq("id", id);
    return NextResponse.json({ ok: true, ig_queue_id: draft.id, review: "pending_review" });
  }

  if (action === "discard") {
    const { error } = await admin.from("title_reels").update({ status: "discarded", updated_at: now }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `unknown action '${action}'` }, { status: 400 });
}
