import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/ig-queue/approve
 *
 * Body: { draft_id: string }
 *
 * Generic approve for peekrbuzz_ig_queue drafts (the weekend_reco flow inserts
 * here directly, since its slides are pre-rendered by render_single_slide).
 *
 * Flow:
 *   1. Ensure draft exists in status='pending_review' with slide_urls populated.
 *   2. UPDATE status='approved', scheduled_for=now().
 *   3. Fire-and-forget invoke of social_publisher (IG + Threads).
 *
 * For the cinematic carousel flow, /api/admin/peekrbuzz/carousels/approve is
 * still the right endpoint — that one also has to render slides first.
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
  const body = (await req.json().catch(() => ({}))) as { draft_id?: unknown };
  const draftId = typeof body.draft_id === "string" ? body.draft_id : null;
  if (!draftId) {
    return NextResponse.json({ error: "draft_id (string) required" }, { status: 400 });
  }

  // ── Verify draft ───────────────────────────────────────────────────────────
  const { data: draft, error: loadErr } = await admin
    .from("peekrbuzz_ig_queue")
    .select("id, status, slide_urls, draft_type, caption")
    .eq("id", draftId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: `lookup: ${loadErr.message}` }, { status: 500 });
  if (!draft) return NextResponse.json({ error: `draft ${draftId} not found` }, { status: 404 });

  if (draft.status !== "pending_review" && draft.status !== "pending_approval") {
    return NextResponse.json(
      { error: `cannot approve from status='${draft.status}'` },
      { status: 400 },
    );
  }
  const slideUrls = (draft.slide_urls as string[] | null) ?? [];
  if (slideUrls.length < 2) {
    return NextResponse.json(
      { error: `draft has ${slideUrls.length} slide_urls; need ≥ 2 to publish to IG` },
      { status: 400 },
    );
  }
  if (!draft.caption) {
    return NextResponse.json({ error: "draft has empty caption" }, { status: 400 });
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  const { error: updErr } = await admin
    .from("peekrbuzz_ig_queue")
    .update({ status: "approved", scheduled_for: new Date().toISOString() })
    .eq("id", draftId);
  if (updErr) return NextResponse.json({ error: `update: ${updErr.message}` }, { status: 500 });

  // ── Fire-and-forget social_publisher ──────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let publisherTriggered = false;
  if (supabaseUrl && serviceKey) {
    void fetch(`${supabaseUrl}/functions/v1/social_publisher`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((err) => console.error("[ig-queue/approve] social_publisher invoke failed:", err));
    publisherTriggered = true;
  }

  return NextResponse.json({
    ok: true,
    draft_id: draftId,
    status: "approved",
    publisher_triggered: publisherTriggered,
  });
}
