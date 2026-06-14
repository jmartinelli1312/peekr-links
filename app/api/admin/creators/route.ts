import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/creators — list creators with their silent-onboarding status.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { data: creators, error } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, country_code, creator_status")
    .eq("account_type", "creator")
    .order("username", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (creators ?? []).map((c) => c.id);
  let onboardingIds = new Set<string>();
  if (ids.length > 0) {
    const { data: onb } = await admin
      .from("onboarding_suggested_users")
      .select("user_id")
      .in("user_id", ids);
    onboardingIds = new Set((onb ?? []).map((x) => x.user_id as string));
  }

  const list = (creators ?? []).map((c) => ({
    id: c.id,
    username: c.username,
    display_name: c.display_name,
    avatar_url: c.avatar_url,
    country_code: c.country_code,
    creator_status: c.creator_status,
    in_onboarding: onboardingIds.has(c.id),
  }));

  return NextResponse.json({ creators: list });
}
