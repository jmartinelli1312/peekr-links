import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/creators/onboarding { user_id, enabled }
// Toggles a creator's inclusion in the silent onboarding auto-follow list.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: unknown;
    enabled?: unknown;
  };
  const userId = String(body.user_id ?? "").trim();
  const enabled = body.enabled === true;
  if (!userId) {
    return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
  }

  if (enabled) {
    // Global preselect (all countries). Keeps any existing exclude list intact.
    const { error } = await admin.from("onboarding_suggested_users").upsert(
      {
        user_id: userId,
        preselect: true,
        priority: 10,
        notes: "toggled on from admin Creators section",
      },
      { onConflict: "user_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("onboarding_suggested_users")
      .delete()
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enabled });
}
