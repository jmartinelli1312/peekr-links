import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/peekrbuzz/ig-queue/skip
 *
 * Body: { draft_id: string }
 *
 * Marks a peekrbuzz_ig_queue draft as 'rejected' — editor decided not to
 * publish. Used by the weekend_reco UI section's "Descartar" button.
 */
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

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

  const body = (await req.json().catch(() => ({}))) as { draft_id?: unknown };
  const draftId = typeof body.draft_id === "string" ? body.draft_id : null;
  if (!draftId) return NextResponse.json({ error: "draft_id (string) required" }, { status: 400 });

  const { data: draft } = await admin
    .from("peekrbuzz_ig_queue")
    .select("id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return NextResponse.json({ error: `draft ${draftId} not found` }, { status: 404 });
  if (draft.status !== "pending_review" && draft.status !== "pending_approval") {
    return NextResponse.json(
      { error: `cannot skip from status='${draft.status}'` },
      { status: 400 },
    );
  }

  const { error: updErr } = await admin
    .from("peekrbuzz_ig_queue")
    .update({ status: "rejected" })
    .eq("id", draftId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, draft_id: draftId, status: "rejected" });
}
