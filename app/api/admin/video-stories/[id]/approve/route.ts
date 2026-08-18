import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/video-stories/[id]/approve
 *
 * Moves a draft to 'approved', which is what unlocks audio generation.
 * A story flagged 'error' by the automatic review can still be approved —
 * the review is advisory, the human decides — but it must have a script.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin, userId } = auth;
  const { id } = await params;

  const { data: current } = await admin
    .from("video_stories")
    .select("status, script")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = current as { status: string; script: string | null };

  if (!row.script?.trim()) {
    return NextResponse.json(
      { error: "La historia no tiene guion todavía. Genérala o escríbela antes de aprobar." },
      { status: 400 }
    );
  }

  if (row.status === "published") {
    return NextResponse.json({ error: "Esta historia ya está publicada." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("video_stories")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
      error_message: null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, story: data });
}
