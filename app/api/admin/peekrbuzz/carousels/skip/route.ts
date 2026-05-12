import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/peekrbuzz/carousels/skip
 *
 * Body: { carousel_id: number }
 *
 * Marks the carousel as 'skipped' — editor decided not to publish this version
 * for this article. The article keeps its 'published' state on its own; only
 * the carousel row is mutated. Subsequent /generate calls for the same article
 * will return this row's status (skipped) so the UI knows to hide the editor.
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

  const body = (await req.json().catch(() => ({}))) as { carousel_id?: unknown };
  const carouselId = typeof body.carousel_id === "number" ? body.carousel_id : Number(body.carousel_id);
  if (!Number.isFinite(carouselId) || carouselId <= 0) {
    return NextResponse.json({ error: "carousel_id must be a positive integer" }, { status: 400 });
  }

  const { data: current } = await admin
    .from("peekrbuzz_carousels")
    .select("id, status")
    .eq("id", carouselId)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: `carousel ${carouselId} not found` }, { status: 404 });
  if (current.status !== "draft") {
    return NextResponse.json(
      { error: `cannot skip from status='${current.status}' — only drafts can be skipped` },
      { status: 400 },
    );
  }

  const { error: updErr } = await admin
    .from("peekrbuzz_carousels")
    .update({ status: "skipped" })
    .eq("id", carouselId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, carousel_id: carouselId, status: "skipped" });
}
